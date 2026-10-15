-- SIMANIS AI: kuota permintaan model eksternal, terpisah dari nilai/absensi.
-- Deploy kode API lebih dahulu; baru jalankan migrasi ini.
begin;
create table if not exists public.simanis_ai_teacher_quota (
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  generation_count integer not null default 0 check (generation_count >= 0),
  primary key(owner_id,usage_day)
);
create table if not exists public.simanis_ai_school_quota (
  usage_day date primary key,
  generation_count integer not null default 0 check (generation_count >= 0)
);
alter table public.simanis_ai_teacher_quota enable row level security;
alter table public.simanis_ai_school_quota enable row level security;
revoke all on public.simanis_ai_teacher_quota from public,anon,authenticated;
revoke all on public.simanis_ai_school_quota from public,anon,authenticated;

-- Satu transaksi ter-serialisasi menjamin batas harian tidak dilewati
-- meskipun banyak guru menekan Generate bersamaan.
create or replace function public.simanis_ai_claim_daily_quota()
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (timezone('Asia/Jakarta', now()))::date;
  v_personal integer := 0;
  v_school integer := 0;
begin
  if v_user is null then return false; end if;
  if not exists (
    select 1 from public.profiles p
    where p.id=v_user and p.is_active=true
      and p.role in ('GURU','WALI_KELAS','SUPER_ADMIN')
  ) then return false; end if;

  -- Harian: maks. 3 generasi per guru dan 60 total untuk sekolah.
  perform pg_advisory_xact_lock(20261015, 1);
  select generation_count into v_personal
    from public.simanis_ai_teacher_quota
    where owner_id=v_user and usage_day=v_day;
  select generation_count into v_school
    from public.simanis_ai_school_quota
    where usage_day=v_day;
  if coalesce(v_personal,0)>=3 or coalesce(v_school,0)>=60
    then return false;
  end if;

  insert into public.simanis_ai_teacher_quota(owner_id,usage_day,generation_count)
  values(v_user,v_day,1)
  on conflict(owner_id,usage_day)
    do update set generation_count=public.simanis_ai_teacher_quota.generation_count+1;
  insert into public.simanis_ai_school_quota(usage_day,generation_count)
  values(v_day,1)
  on conflict(usage_day)
    do update set generation_count=public.simanis_ai_school_quota.generation_count+1;
  return true;
end;
$$;
revoke all on function public.simanis_ai_claim_daily_quota() from public,anon;
grant execute on function public.simanis_ai_claim_daily_quota() to authenticated;
commit;
