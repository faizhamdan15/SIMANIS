-- SIMANIS: get the appointed finance treasurer, independently of who prints a receipt.
-- Read-only, restricted to users who may view Finance or hold its structural assignment.
BEGIN;
CREATE OR REPLACE FUNCTION public.finance_get_treasurer_name()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_name text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.current_app_role() = 'SUPER_ADMIN'
    OR public.has_module_permission('KEUANGAN','view')
    OR public.has_staff_position('PKM_BENDAHARA_SARPRAS')
  ) THEN
    RAISE EXCEPTION 'Tidak berwenang melihat penanggung jawab keuangan.'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.full_name
  INTO v_name
  FROM public.profile_positions pp
  JOIN public.profiles p ON p.id = pp.user_id
  WHERE pp.position_code = 'PKM_BENDAHARA_SARPRAS'
    AND pp.is_active = true
    AND p.is_active = true
  ORDER BY pp.assigned_at DESC NULLS LAST
  LIMIT 1;

  RETURN NULLIF(BTRIM(v_name),'');
END;
$function$;

REVOKE ALL ON FUNCTION public.finance_get_treasurer_name()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_get_treasurer_name()
  TO authenticated;
COMMENT ON FUNCTION public.finance_get_treasurer_name()
  IS 'Returns the active PKM Bendahara & Sarpras position holder for official Finance displays and print signatures, not the current login or transaction creator.';
COMMIT;
