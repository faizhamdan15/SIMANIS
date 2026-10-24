-- SIMANIS / Jadwal Kerja Harian Tata Usaha (tanpa jadwal pelajaran).
-- REVIEW sebelum migrasi produksi: tidak memasukkan staf secara otomatis.
-- Konfigurasi berlaku sejak effective_from, tidak menandai tanggal sebelumnya sebagai ALFA.
begin;

create table if not exists public.staff_work_schedules (
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  day_of_week smallint not null check(day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  effective_from date not null default (timezone('Asia/Jakarta', now()))::date,
  note text check (note is null or char_length(note) <= 150),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (teacher_id, day_of_week),
  constraint staff_work_schedules_valid_hours check (end_time > start_time)
);

create index if not exists staff_work_schedules_active_day_idx
  on public.staff_work_schedules (day_of_week, is_active, effective_from);

alter table public.staff_work_schedules enable row level security;
grant select,insert,update on public.staff_work_schedules to authenticated;
revoke all on public.staff_work_schedules from anon;

drop policy if exists staff_work_schedules_read on public.staff_work_schedules;
create policy staff_work_schedules_read on public.staff_work_schedules
 for select to authenticated using (
   teacher_id = (select public.current_teacher_id())
   or (select public.current_app_role()) in ('SUPER_ADMIN','TU','WAKA_KURIKULUM')
   or public.has_staff_position('KEPALA_TU')
 );
drop policy if exists staff_work_schedules_admin_insert on public.staff_work_schedules;
create policy staff_work_schedules_admin_insert on public.staff_work_schedules
 for insert to authenticated with check (
   (select public.current_app_role()) in ('SUPER_ADMIN','TU','WAKA_KURIKULUM')
   or public.has_staff_position('KEPALA_TU')
 );
drop policy if exists staff_work_schedules_admin_update on public.staff_work_schedules;
create policy staff_work_schedules_admin_update on public.staff_work_schedules
 for update to authenticated
 using (
   (select public.current_app_role()) in ('SUPER_ADMIN','TU','WAKA_KURIKULUM')
   or public.has_staff_position('KEPALA_TU')
 ) with check (
   (select public.current_app_role()) in ('SUPER_ADMIN','TU','WAKA_KURIKULUM')
   or public.has_staff_position('KEPALA_TU')
 );

-- Keep the exact original RPC signatures, preserving callers and existing permissions.

CREATE OR REPLACE FUNCTION public.get_teacher_attendance_by_date(p_date date)
 RETURNS TABLE(teacher_id uuid, teacher_code integer, teacher_name text, has_schedule boolean, scheduled_start time without time zone, scheduled_end time without time zone, teaching_slots bigint, schedule_detail text, attendance_status text, check_in timestamp with time zone, check_out timestamp with time zone, late_minutes integer, note text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
with active_semester as (
    select sm.id
    from public.semesters sm
    join public.academic_years ay
        on ay.id = sm.academic_year_id
    where p_date between coalesce(sm.start_date, ay.start_date)
                     and coalesce(sm.end_date, ay.end_date)
    order by sm.is_active desc, ay.is_active desc
    limit 1
),
day_schedule as (
    select
        v.teacher_id,
        v.teacher_code,
        v.teacher_name,
        v.scheduled_start,
        v.scheduled_end,
        v.teaching_slots,
        v.schedule_detail
    from public.v_teacher_schedule_summary v
    join active_semester a
        on a.id = v.semester_id
    where v.day_of_week = public.indonesian_day_name(p_date)
),
staff_day as (
    select w.teacher_id, w.start_time, w.end_time, w.note
    from public.staff_work_schedules w
    where w.is_active = true
      and w.day_of_week = extract(isodow from p_date)::smallint
      and p_date >= w.effective_from
)
select
    t.id as teacher_id,
    t.teacher_code,
    t.full_name as teacher_name,

    (ds.teacher_id is not null or ws.teacher_id is not null) as has_schedule,

    coalesce(ds.scheduled_start, ws.start_time) as scheduled_start,
    coalesce(ds.scheduled_end, ws.end_time) as scheduled_end,

    coalesce(ds.teaching_slots, 0)::bigint as teaching_slots,
    coalesce(ds.schedule_detail,
      'Jadwal Kerja TU' ||
      case when nullif(trim(ws.note), '') is not null
        then ' · ' || left(trim(ws.note), 140) else '' end
    ) as schedule_detail,

    case
        when ds.teacher_id is null and ws.teacher_id is null then 'TIDAK_ADA_JADWAL'
        when ta.id is not null then ta.status
        when p_date < (timezone('Asia/Jakarta',now()))::date then 'ALFA'
        else 'BELUM_ABSEN'
    end as attendance_status,

    ta.check_in,
    ta.check_out,
    coalesce(ta.late_minutes, 0) as late_minutes,
    ta.note

from public.teachers t

left join day_schedule ds
    on ds.teacher_id = t.id

left join staff_day ws
    on ws.teacher_id = t.id

left join public.teacher_attendance ta
    on ta.teacher_id = t.id
   and ta.attendance_date = p_date

where t.is_active = true

order by
    case when t.teacher_code is null then 999999 else t.teacher_code end,
    t.full_name;
$function$


CREATE OR REPLACE FUNCTION public.teacher_check_in(p_teacher_id uuid, p_method text DEFAULT 'MANUAL'::text, p_note text DEFAULT NULL::text)
 RETURNS teacher_attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_now timestamptz := now();
  v_local_now timestamp;
  v_date date;
  v_day text;
  v_semester_id uuid;
  v_scheduled_start time;
  v_has_schedule boolean := false;
  v_tolerance integer := 10;
  v_late integer := 0;
  v_status text := 'HADIR';
  v_result public.teacher_attendance;
begin
  if public.current_app_role() not in ('SUPER_ADMIN','TU','WAKA_KURIKULUM')
     and public.current_teacher_id() is distinct from p_teacher_id
     and p_method <> 'SCANNER_BRIDGE' then
    raise exception 'Anda tidak berwenang melakukan check-in untuk guru ini.';
  end if;

  if p_method not in ('MANUAL','QR_KIOSK','QR_PRIBADI','ADMIN','SCANNER_BRIDGE') then
    raise exception 'Metode check-in tidak valid.';
  end if;

  select (v_now at time zone coalesce(a.timezone, 'Asia/Jakarta'))
  into v_local_now
  from public.attendance_settings a
  limit 1;

  if v_local_now is null then
    v_local_now := v_now at time zone 'Asia/Jakarta';
  end if;

  v_date := v_local_now::date;
  v_day := public.indonesian_day_name(v_date);

  select sm.id
  into v_semester_id
  from public.semesters sm
  join public.academic_years ay on ay.id = sm.academic_year_id
  where v_date between coalesce(sm.start_date, ay.start_date)
                   and coalesce(sm.end_date, ay.end_date)
  order by sm.is_active desc, ay.is_active desc
  limit 1;

  if v_semester_id is not null then
    select min(ts.start_time)
    into v_scheduled_start
    from public.schedules s
    join public.time_slots ts on ts.id = s.time_slot_id
    where s.semester_id = v_semester_id
      and s.teacher_id = p_teacher_id
      and s.day_of_week = v_day;
    v_has_schedule := v_scheduled_start is not null;
  end if;

  -- Staf yang tidak mengajar dapat hadir berdasarkan jadwal kerja harian,
  -- tanpa membuat jadwal mata pelajaran palsu.
  if not v_has_schedule then
    select w.start_time into v_scheduled_start
    from public.staff_work_schedules w
    where w.teacher_id = p_teacher_id
      and w.day_of_week = extract(isodow from v_date)::smallint
      and w.is_active = true and v_date >= w.effective_from;
    v_has_schedule := v_scheduled_start is not null;
  end if;

  if not v_has_schedule then
    raise exception 'Belum ada jadwal mengajar atau jadwal kerja untuk % (%).', v_date, v_day;
  end if;

  select teacher_late_tolerance_minutes
  into v_tolerance
  from public.attendance_settings
  limit 1;
  v_tolerance := coalesce(v_tolerance, 10);

  if v_local_now::time > (v_scheduled_start + make_interval(mins => v_tolerance))::time then
    v_late := greatest(0, floor(extract(epoch from (v_local_now::time - v_scheduled_start))/60)::integer);
    v_status := 'TERLAMBAT';
  end if;

  insert into public.teacher_attendance (
    teacher_id, attendance_date, status, check_in, check_in_method,
    late_minutes, note, recorded_by
  ) values (
    p_teacher_id, v_date, v_status, v_now, p_method,
    v_late, p_note, auth.uid()
  )
  on conflict (teacher_id, attendance_date)
  do update set
    check_in = coalesce(public.teacher_attendance.check_in, excluded.check_in),
    check_in_method = coalesce(public.teacher_attendance.check_in_method, excluded.check_in_method),
    status = case when public.teacher_attendance.status in ('IZIN','SAKIT','DINAS') then public.teacher_attendance.status else excluded.status end,
    late_minutes = case when public.teacher_attendance.status in ('IZIN','SAKIT','DINAS') then public.teacher_attendance.late_minutes else excluded.late_minutes end,
    note = coalesce(excluded.note, public.teacher_attendance.note),
    recorded_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$function$


CREATE OR REPLACE FUNCTION public.save_teacher_attendance_admin(p_teacher_id uuid, p_date date, p_status text, p_note text DEFAULT NULL::text, p_check_in_time time without time zone DEFAULT NULL::time without time zone, p_check_out_time time without time zone DEFAULT NULL::time without time zone)
 RETURNS teacher_attendance
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_role text := public.current_app_role();
  v_timezone text := 'Asia/Jakarta';
  v_check_in timestamptz;
  v_check_out timestamptz;
  v_scheduled_start time;
  v_tolerance integer := 10;
  v_late integer := 0;
  v_final_status text := upper(p_status);
  v_day text;
  v_result public.teacher_attendance;
begin
  if v_role not in ('SUPER_ADMIN','TU','WAKA_KURIKULUM') then
    raise exception 'Anda tidak berwenang mengubah absensi guru.';
  end if;

  if v_final_status not in ('HADIR','TERLAMBAT','IZIN','SAKIT','DINAS','ALFA') then
    raise exception 'Status absensi tidak valid.';
  end if;

  select coalesce(timezone,'Asia/Jakarta'), coalesce(teacher_late_tolerance_minutes,10)
  into v_timezone, v_tolerance
  from public.attendance_settings limit 1;

  v_timezone := coalesce(v_timezone,'Asia/Jakarta');
  v_tolerance := coalesce(v_tolerance,10);
  v_day := public.indonesian_day_name(p_date);

  select min(ts.start_time)
  into v_scheduled_start
  from public.schedules s
  join public.time_slots ts on ts.id = s.time_slot_id
  join public.semesters sm on sm.id = s.semester_id
  join public.academic_years ay on ay.id = sm.academic_year_id
  where s.teacher_id = p_teacher_id
    and s.day_of_week = v_day
    and p_date between coalesce(sm.start_date, ay.start_date) and coalesce(sm.end_date, ay.end_date);

  if v_scheduled_start is null then
    select w.start_time into v_scheduled_start
    from public.staff_work_schedules w
    where w.teacher_id = p_teacher_id
      and w.day_of_week = extract(isodow from p_date)::smallint
      and w.is_active = true and p_date >= w.effective_from;
  end if;

  if v_scheduled_start is null and v_final_status = 'ALFA' then
    raise exception 'Guru tanpa jadwal tidak boleh ditandai ALFA.';
  end if;

  if p_check_in_time is not null then
    v_check_in := (p_date + p_check_in_time) at time zone v_timezone;
    if v_scheduled_start is not null and p_check_in_time > (v_scheduled_start + make_interval(mins => v_tolerance))::time then
      v_late := greatest(0, floor(extract(epoch from (p_check_in_time - v_scheduled_start))/60)::integer);
      if v_final_status = 'HADIR' then v_final_status := 'TERLAMBAT'; end if;
    end if;
  end if;

  if p_check_out_time is not null then
    v_check_out := (p_date + p_check_out_time) at time zone v_timezone;
  end if;

  if v_check_out is not null and v_check_in is not null and v_check_out < v_check_in then
    raise exception 'Jam pulang tidak boleh lebih awal dari jam masuk.';
  end if;

  if v_final_status in ('IZIN','SAKIT','DINAS','ALFA') then
    v_check_in := null;
    v_check_out := null;
    v_late := 0;
  end if;

  insert into public.teacher_attendance(
    teacher_id, attendance_date, status, check_in, check_out,
    check_in_method, check_out_method, late_minutes, note, recorded_by
  ) values (
    p_teacher_id, p_date, v_final_status, v_check_in, v_check_out,
    case when v_check_in is not null then 'ADMIN' else null end,
    case when v_check_out is not null then 'ADMIN' else null end,
    v_late, nullif(trim(p_note),''), auth.uid()
  )
  on conflict (teacher_id, attendance_date)
  do update set
    status = excluded.status,
    check_in = excluded.check_in,
    check_out = excluded.check_out,
    check_in_method = excluded.check_in_method,
    check_out_method = excluded.check_out_method,
    late_minutes = excluded.late_minutes,
    note = excluded.note,
    recorded_by = auth.uid(),
    updated_at = now()
  returning * into v_result;

  return v_result;
end;
$function$

commit;
