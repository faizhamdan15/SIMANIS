-- SIMANIS AI • MVP TANPA API • Persiapan skema, jalankan setelah peninjauan PR.
-- Tabel CP hanya berisi teks dari sumber resmi yang telah diperiksa manusia.
-- Tidak ada layanan AI berbayar, token/kuota AI, atau perubahan ke tabel nilai.
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
  unique(subject_id,phase,regulation,revision)
);

create table if not exists public.teacher_ai_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  class_id uuid not null references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  cp_source_id uuid references public.curriculum_cp_sources(id),
  cp_manual_text text check (cp_manual_text is null or char_length(cp_manual_text) <= 20000),
  cp_manual_source_url text check (cp_manual_source_url is null or char_length(cp_manual_source_url) <= 600),
  document_type text not null check (
    document_type in ('TP','ATP','PROTA','PROMES','MODUL_AJAR','BAHAN_AJAR',
                      'LKPD','MEDIA_PEMBELAJARAN','ASESMEN')
  ),
  title text not null check (char_length(title) between 3 and 180),
  content text not null default '',
  status text not null default 'DRAFT' check (status in ('DRAFT','FINAL')),
  semester text,
  topic text,
  creation_method text not null default 'COPY_PASTE_CHATGPT',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teacher_ai_final_cp_required check (
    status <> 'FINAL'
    or cp_source_id is not null
    or (
      nullif(btrim(coalesce(cp_manual_text,'')), '') is not null
      and nullif(btrim(coalesce(cp_manual_source_url,'')), '') is not null
    )
  )
);

create index if not exists teacher_ai_documents_owner_idx
  on public.teacher_ai_documents(owner_id,created_at desc);

alter table public.curriculum_cp_sources enable row level security;
alter table public.teacher_ai_documents enable row level security;

drop policy if exists curriculum_cp_sources_verified_read on public.curriculum_cp_sources;
create policy curriculum_cp_sources_verified_read
on public.curriculum_cp_sources for select to authenticated
using (is_verified = true);

drop policy if exists teacher_ai_documents_owner_select on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_select
on public.teacher_ai_documents for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists teacher_ai_documents_owner_insert on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_insert
on public.teacher_ai_documents for insert to authenticated
with check (owner_id = (select auth.uid()));

drop policy if exists teacher_ai_documents_owner_update on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_update
on public.teacher_ai_documents for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists teacher_ai_documents_owner_delete on public.teacher_ai_documents;
create policy teacher_ai_documents_owner_delete
on public.teacher_ai_documents for delete to authenticated
using (owner_id = (select auth.uid()));

revoke all on public.curriculum_cp_sources from anon,authenticated;
revoke all on public.teacher_ai_documents from anon,authenticated;
grant select on public.curriculum_cp_sources to authenticated;
grant select,insert,update,delete on public.teacher_ai_documents to authenticated;

-- Menu sesuai pola hak akses yang sudah dipakai SIMANIS.
insert into public.app_modules(code,name,icon,route,sort_order,is_active)
values('SIMANIS_AI','SIMANIS AI • Perangkat Pembelajaran',
       'sparkles','simanis-ai.html',95,true)
on conflict(code) do update set
  name=excluded.name,icon=excluded.icon,route=excluded.route,is_active=true;

insert into public.role_module_permissions
(role,module_id,can_view,can_create,can_update,can_delete)
select r.role,m.id,true,true,true,false
from (values ('GURU'),('WALI_KELAS'),('SUPER_ADMIN')) as r(role)
cross join public.app_modules m
where m.code='SIMANIS_AI'
on conflict (role,module_id) do update set
  can_view=true,can_create=true,can_update=true;

commit;

-- Untuk mengunggah CP resmi: isi curriculum_cp_sources via SQL Editor,
-- awalnya is_verified=false. Setelah cek dokumen asli, admin baru boleh
-- ubah is_verified=true dan verified_at=now().
-- Guru juga bisa menempel CP manual ke prompt tetapi tidak boleh
-- menyebutnya 'CP terverifikasi madrasah' sebelum admin mengesahkan.
