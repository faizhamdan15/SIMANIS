-- SIMANIS AI: generous trial quota + verified refund of failed generations.
-- Additive migration, no student/teacher grading data is touched.
begin;

create table if not exists public.simanis_ai_quota_reservations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  created_at timestamptz not null default now(),
  refunded boolean not null default false
);
create index if not exists simanis_ai_reservation_owner_day_idx
on public.simanis_ai_quota_reservations(owner_id, usage_day, created_at);

alter table public.simanis_ai_quota_reservations enable row level security;
revoke all on public.simanis_ai_quota_reservations from public, anon, authenticated;

-- Backward compatible legacy endpoint while new Vercel code deploys.
create or replace function public.simanis_ai_claim_daily_quota()
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (timezone('Asia/Jakarta', now()))::date;
  v_personal int := 0;
  v_school int := 0;
begin
  if v_user is null then return false; end if;
  if not exists (select 1 from public.profiles p
     where p.id=v_user and p.is_active=true
       and p.role in ('GURU','WALI_KELAS','SUPER_ADMIN')) then return false; end if;
  perform pg_advisory_xact_lock(20261015,1);
  select generation_count into v_personal
  from public.simanis_ai_teacher_quota where owner_id=v_user and usage_day=v_day;
  select generation_count into v_school
  from public.simanis_ai_school_quota where usage_day=v_day;
  if coalesce(v_personal,0)>=12 or coalesce(v_school,0)>=120 then return false; end if;
  insert into public.simanis_ai_teacher_quota(owner_id,usage_day,generation_count)
    values(v_user,v_day,1)
  on conflict(owner_id,usage_day) do update
    set generation_count=public.simanis_ai_teacher_quota.generation_count+1;
  insert into public.simanis_ai_school_quota(usage_day,generation_count)
    values(v_day,1)
  on conflict(usage_day) do update
    set generation_count=public.simanis_ai_school_quota.generation_count+1;
  return true;
end;
$$;
revoke all on function public.simanis_ai_claim_daily_quota() from public, anon;
grant execute on function public.simanis_ai_claim_daily_quota() to authenticated;

-- New RPC: claim a one-time reservation ID not exposed to the browser.
create or replace function public.simanis_ai_reserve_generation()
returns uuid language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (timezone('Asia/Jakarta', now()))::date;
  v_personal int := 0;
  v_school int := 0;
  v_claim uuid;
begin
  if v_user is null then return null; end if;
  if not exists (select 1 from public.profiles p
     where p.id=v_user and p.is_active=true
       and p.role in ('GURU','WALI_KELAS','SUPER_ADMIN')) then return null; end if;
  perform pg_advisory_xact_lock(20261015,1);
  select generation_count into v_personal
  from public.simanis_ai_teacher_quota where owner_id=v_user and usage_day=v_day;
  select generation_count into v_school
  from public.simanis_ai_school_quota where usage_day=v_day;
  if coalesce(v_personal,0)>=12 or coalesce(v_school,0)>=120 then return null; end if;

  insert into public.simanis_ai_teacher_quota(owner_id,usage_day,generation_count)
    values(v_user,v_day,1)
  on conflict(owner_id,usage_day) do update
    set generation_count=public.simanis_ai_teacher_quota.generation_count+1;
  insert into public.simanis_ai_school_quota(usage_day,generation_count)
    values(v_day,1)
  on conflict(usage_day) do update
    set generation_count=public.simanis_ai_school_quota.generation_count+1;

  insert into public.simanis_ai_quota_reservations(owner_id,usage_day)
    values(v_user,v_day) returning id into v_claim;
  return v_claim;
end;
$$;
revoke all on function public.simanis_ai_reserve_generation() from public, anon;
grant execute on function public.simanis_ai_reserve_generation() to authenticated;

-- A claim can be refunded ONCE, only by the same authenticated user
-- with its unguessable reservation ID. No table SELECT privileges.
create or replace function public.simanis_ai_refund_generation(p_reservation_id uuid)
returns boolean language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_day date;
begin
  if v_user is null or p_reservation_id is null then return false; end if;
  perform pg_advisory_xact_lock(20261015,1);
  update public.simanis_ai_quota_reservations q
    set refunded=true
    where q.id=p_reservation_id
      and q.owner_id=v_user and q.refunded=false
      and q.created_at >= now()-interval '10 minutes'
    returning q.usage_day into v_day;
  if v_day is null then return false; end if;
  update public.simanis_ai_teacher_quota
    set generation_count=greatest(0,generation_count-1)
    where owner_id=v_user and usage_day=v_day;
  update public.simanis_ai_school_quota
    set generation_count=greatest(0,generation_count-1)
    where usage_day=v_day;
  return true;
end;
$$;
revoke all on function public.simanis_ai_refund_generation(uuid) from public, anon;
grant execute on function public.simanis_ai_refund_generation(uuid) to authenticated;

-- Read-only user-visible usage without disclosing identities or school counts.
create or replace function public.simanis_ai_my_quota_status()
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_day date := (timezone('Asia/Jakarta', now()))::date;
  v_used int := 0;
  v_school int := 0;
begin
  if v_user is null then return null; end if;
  if not exists (select 1 from public.profiles p
     where p.id=v_user and p.is_active=true
       and p.role in ('GURU','WALI_KELAS','SUPER_ADMIN')) then return null; end if;
  select generation_count into v_used from public.simanis_ai_teacher_quota
   where owner_id=v_user and usage_day=v_day;
  select generation_count into v_school from public.simanis_ai_school_quota
   where usage_day=v_day;
  return jsonb_build_object(
    'date',v_day,'used',coalesce(v_used,0),'remaining',greatest(0,12-coalesce(v_used,0)),
    'daily_limit',12,'school_remaining',greatest(0,120-coalesce(v_school,0)));
end;
$$;
revoke all on function public.simanis_ai_my_quota_status() from public, anon;
grant execute on function public.simanis_ai_my_quota_status() to authenticated;

-- One-time courtesy reset of three SIMANIS development trials, only if
-- they are the ONLY usage today. Other teachers' usage is left untouched.
do $$
declare v_day date := (timezone('Asia/Jakarta',now()))::date;
begin
  perform pg_advisory_xact_lock(20261015,1);
  if (select count(*) from public.simanis_ai_teacher_quota where usage_day=v_day)=1
   and (select sum(generation_count) from public.simanis_ai_teacher_quota where usage_day=v_day)=3
   and (select generation_count from public.simanis_ai_school_quota where usage_day=v_day)=3
  then
    update public.simanis_ai_teacher_quota set generation_count=0 where usage_day=v_day;
    update public.simanis_ai_school_quota set generation_count=0 where usage_day=v_day;
  end if;
end;
$$;
commit;
