-- Nama PIC Keuangan dibaca dari penugasan jabatan PKM Bendahara & Sarpras,
-- bukan nama akun Super Admin yang sedang masuk.
begin;
create or replace function public.get_finance_responsible_person()
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_holder_name text;
begin
  if auth.uid() is null or not public.has_module_permission('KEUANGAN','view') then
    raise exception 'Anda tidak memiliki akses untuk melihat penanggung jawab Keuangan.'
      using errcode = '42501';
  end if;

  select trim(p.full_name)
    into v_holder_name
  from public.profile_positions pp
  join public.staff_positions sp
    on sp.code=pp.position_code and sp.is_active=true
  join public.profiles p
    on p.id=pp.user_id and p.is_active=true
  where pp.position_code='PKM_BENDAHARA_SARPRAS' and pp.is_active=true
  order by pp.assigned_at desc
  limit 1;

  return v_holder_name;
end;
$function$;

revoke all on function public.get_finance_responsible_person() from public, anon;
grant execute on function public.get_finance_responsible_person() to authenticated;

comment on function public.get_finance_responsible_person()
is 'Nama penanggung jawab Keuangan dari posisi struktural PKM Bendahara & Sarpras. Tidak mengungkap seluruh akun atau data autentikasi.';
commit;
