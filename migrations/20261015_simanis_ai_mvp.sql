-- SIMANIS AI • Tahap 1. Jalankan setelah kode halaman dirilis.
-- CP RESMI TIDAK diisi oleh AI. Import hanya dari sumber pemerintah tervalidasi.
begin;

create table if not exists public.curriculum_cp_sources (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects(id),
  phase text not null check (phase in ('E','F')),
  regulation text not null,
  source_title text not null,
  source_url text not null,
  content text not null check (char_length(content) >= 100),
  revision text not null default '2025',
  is_verified boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique(subject_id, phase, regulation, revision)
);

create table if not exists public.teacher_ai_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  class_id uuid not null references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  cp_source_id uuid not null references public.curriculum_cp_sources(id),
  document_type text not null check (document_type in ('TP','ATP','PROTA','PROMES','MODUL_AJAR','BAHAN_AJAR','LKPD','MEDIA_PEMBELAJARAN','ASESMEN')),
  title text not null check (char_length(title) between 3 and 180),
  content text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','FINAL')),
  semester text,
  topic text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_ai_documents_owner_idx
on public.teacher_ai_documents(owner_id, created_at desc);

create table if not exists public.teacher_ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (timezone('Asia/Jakarta',now())::date),
  generation_count integer not null default 0 check (generation_count >= 0),
  primary key (user_id,usage_date)
);

alter table public.curriculum_cp_sources enable row level security;
alter table public.teacher_ai_documents enable row level security;
alter table public.teacher_ai_daily_usage enable row level security;

drop policy if exists curriculum_cp_sources_verified_read on public.curriculum_cp_sources;
create policy curriculum_cp_sources_verified_read on public.curriculum_cp_sources
for select to authenticated using (is_verified = true);

drop policy if exists teacher_ai_documents_owner_select on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_select on public.teacher_ai_documents
for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists teacher_ai_documents_owner_insert on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_insert on public.teacher_ai_documents
for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists teacher_ai_documents_owner_update on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_update on public.teacher_ai_documents
for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists teacher_ai_documents_owner_delete on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_delete on public.teacher_ai_documents
for delete to authenticated using (owner_id = (select auth.uid()));

revoke all on public.teacher_ai_daily_usage from anon, authenticated;
grant select on public.curriculum_cp_sources to authenticated;
grant select,insert,update,delete on public.teacher_ai_documents to authenticated;

-- Klaim kuota atomik; pemanggil tidak bisa mengubah hitungan langsung.
create or replace function public.simanis_ai_claim_daily_quota()
returns boolean language plpgsql security definer
set search_path = public as $$
declare v_user uuid := auth.uid(); v_count int;
begin
  if v_user is null then return false; end if;
  insert into public.teacher_ai_daily_usage(user_id,usage_date,generation_count)
  values(v_user,timezone('Asia/Jakarta',now())::date,1)
  on conflict(user_id,usage_date) do update
    set generation_count = teacher_ai_daily_usage.generation_count + 1
    where teacher_ai_daily_usage.generation_count < 10
  returning generation_count into v_count;
  return v_count is not null;
end;
$$;
revoke all on function public.simanis_ai_claim_daily_quota() from public, anon;
grant execute on function public.simanis_ai_claim_daily_quota() to authenticated;

insert into public.app_modules(code,name,icon,route,sort_order,is_active)
values('SIMANIS_AI','SIMANIS AI','sparkles','simanis-ai.html',95,true)
on conflict(code) do update set
 name=excluded.name,icon=excluded.icon,route=excluded.route,is_active=true;

insert into public.role_module_permissions(role,module_id,can_view,can_create,can_update,can_delete)
select r.role,m.id,true,true,true,false
from (values ('GURU'),('WALI_KELAS'),('SUPER_ADMIN')) as r(role)
cross join public.app_modules m where m.code='SIMANIS_AI'
on conflict (role,module_id) do update set
 can_view=true,can_create=true,can_update=true;

commit;

-- IMPORT CP: insert into curriculum_cp_sources(...,is_verified) ...;
-- WAJIB cocokkan isi CP, mata pelajaran, fase, dan dokumen regulasi resmi.
-- Jangan tandai is_verified=true sebelum diverifikasi manual.