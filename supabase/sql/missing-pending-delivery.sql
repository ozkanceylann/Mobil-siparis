-- Extend the existing, ownership-scoped list response; no new endpoint or polling.
DO $patch$
DECLARE name text; definition text; revised text;
BEGIN
 FOREACH name IN ARRAY ARRAY['admin_orders','seller_orders'] LOOP
  definition:=pg_get_functiondef(('public.'||name||'(text,text,integer)')::regprocedure);
  IF position('missing_pending_ids' in definition)>0 THEN CONTINUE; END IF;
  revised:=replace(definition,'select case when trim(o.kargo_adet)',
   'select (o.teslim_sekli_kontrol is true or nullif(btrim(o.sehir),'''') is null or nullif(btrim(o.ilce),'''') is null or (o.subeden_teslim is true and nullif(btrim(o.teslim_subesi),'''') is null) or (o.subeden_teslim is not true and nullif(btrim(o.adres),'''') is null)) as has_missing_delivery,case when trim(o.kargo_adet)');
  revised:=replace(revised,'''total'',(select count(*) from filtered)',
   '''missing_pending_ids'',coalesce((select jsonb_agg(siparis_no order by split_sort desc,siparis_no asc) from owned where s=''pending'' and has_missing_delivery),''[]''::jsonb),''total'',(select count(*) from filtered)');
  IF revised=definition OR position('as has_missing_delivery' in revised)=0 OR position('''missing_pending_ids'',' in revised)=0 THEN
   RAISE EXCEPTION 'Unexpected list function structure: %',name;
  END IF;
  EXECUTE revised;
 END LOOP;
END;
$patch$;
