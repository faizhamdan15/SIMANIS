-- Rekap absensi bulanan guru/staf SIMANIS.
-- Hanya membaca data: 1 baris per guru aktif untuk bulan yang diminta.
-- Menjaga aturan jadwal yang sama dengan Absensi Guru harian, termasuk jadwal kerja TU.
-- Berlaku sampai hari ini WIB: tanggal mendatang tidak menjadi alfa.
-- ALFA OTOMATIS adalah SUBSET kolom ALFA dan harus diverifikasi admin.
begin;

create or replace function public.get_teacher_attendance_monthly_summary(
  p_year integer,
  p_month integer
)
returns table(
  teacher_id uuid,
  teacher_code integer,
  teacher_name text,
  scheduled_days bigint,
  present_days bigint,
  late_days bigint,
  leave_days bigint,
  sick_days bigint,
  duty_days bigint,
  absence_days bigint,
  automatic_absence_days bigint,
  pending_days bigint,
  recorded_days bigint,
  total_late_minutes bigint,
  attendance_rate numeric
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_first date;
  v_last date;
  v_today date := (timezone('Asia/Jakarta', now()))::date;
begin
  if auth.uid() is null or not (
    public.current_app_role() in (
      'SUPER_ADMIN', 'KEPALA_MADRASAH', 'TU',
      'WAKA_KURIKULUM', 'WAKA_KESISWAAN'
    )
    or public.is_admin_head_manager()
    or public.has_staff_position('KEPALA_TU')
    or public.has_staff_position('PKM_KURIKULUM')
    or public.has_staff_position('PKM_KESISWAAN')
  ) then
    raise exception 'Rekap bulanan hanya untuk akun pengelola absensi.'
      using errcode = '42501';
  end if;

  if p_year is null or p_month is null
     or p_year not between 2020 and 2100 or p_month not between 1 and 12 then
    raise exception 'Tahun atau bulan tidak valid.' using errcode='22023';
  end if;

  v_first := make_date(p_year, p_month, 1);
  v_last := least(
    (v_first + interval '1 month' - interval '1 day')::date,
    v_today
  );

  return query
  with scheduled_records as (
    select
      a.teacher_id as person_id,
      a.attendance_status as day_status,
      a.late_minutes as day_late_minutes,
      ta.id as recorded_id
    from generate_series(v_first::timestamp, v_last::timestamp, interval '1 day') as g(day_date)
    cross join lateral public.get_teacher_attendance_by_date(g.day_date::date) a
    left join public.teacher_attendance ta
      on ta.teacher_id = a.teacher_id
     and ta.attendance_date = g.day_date::date
    where a.has_schedule = true
  ), totals as (
    select
      sr.person_id,
      count(*)::bigint as scheduled,
      count(*) filter(where sr.day_status = 'HADIR')::bigint as hadir,
      count(*) filter(where sr.day_status = 'TERLAMBAT')::bigint as terlambat,
      count(*) filter(where sr.day_status = 'IZIN')::bigint as izin,
      count(*) filter(where sr.day_status = 'SAKIT')::bigint as sakit,
      count(*) filter(where sr.day_status = 'DINAS')::bigint as dinas,
      count(*) filter(where sr.day_status = 'ALFA')::bigint as alfa,
      count(*) filter(where sr.day_status = 'ALFA' and sr.recorded_id is null)::bigint as alfa_otomatis,
      count(*) filter(where sr.day_status = 'BELUM_ABSEN')::bigint as belum_absen,
      count(sr.recorded_id)::bigint as tercatat,
      coalesce(sum(greatest(coalesce(sr.day_late_minutes,0),0)),0)::bigint as menit_terlambat
    from scheduled_records sr
    group by sr.person_id
  )
  select
    t.id,
    t.teacher_code,
    t.full_name,
    coalesce(x.scheduled, 0)::bigint,
    coalesce(x.hadir, 0)::bigint,
    coalesce(x.terlambat, 0)::bigint,
    coalesce(x.izin, 0)::bigint,
    coalesce(x.sakit, 0)::bigint,
    coalesce(x.dinas, 0)::bigint,
    coalesce(x.alfa, 0)::bigint,
    coalesce(x.alfa_otomatis, 0)::bigint,
    coalesce(x.belum_absen, 0)::bigint,
    coalesce(x.tercatat, 0)::bigint,
    coalesce(x.menit_terlambat, 0)::bigint,
    case when coalesce(x.scheduled,0) > 0
      then round((coalesce(x.hadir,0) + coalesce(x.terlambat,0))::numeric
        * 100 / x.scheduled, 1)
      else 0::numeric
    end
  from public.teachers t
  left join totals x on x.person_id = t.id
  where t.is_active = true
  order by t.full_name asc nulls last, t.teacher_code asc nulls last, t.id;
end;
$$;

revoke all on function public.get_teacher_attendance_monthly_summary(integer,integer)
  from public, anon;
grant execute on function public.get_teacher_attendance_monthly_summary(integer,integer)
  to authenticated;

comment on function public.get_teacher_attendance_monthly_summary(integer,integer)
is 'Rekap jadwal dan kehadiran bulanan sampai hari berjalan (Asia/Jakarta). Hari tanpa jadwal tidak dihitung, ALFA otomatis perlu verifikasi.';
commit;
