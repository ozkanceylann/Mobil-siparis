BEGIN;
DO $test$
DECLARE u record; o public.gazi_siparisler; other_id integer; result jsonb; snapshot jsonb; tested integer:=0; master_status text;
BEGIN
FOR u IN SELECT id,raw_app_meta_data FROM auth.users WHERE raw_app_meta_data->>'role'='seller' LOOP
 SELECT * INTO o FROM public.gazi_siparisler x WHERE public.seller_owner_phone(x.siparis_alan,x.siparis_tel)=public.seller_normalize_phone(u.raw_app_meta_data->>'seller_phone') AND x.kargo_durumu='Bekliyor' AND public.seller_order_phase(x)='pending' AND coalesce(orderinvoiceid,'')='' AND coalesce(kargo_takip_kodu,'')='' AND coalesce(kargo_zpl,'')='' AND coalesce(zpl_base64,'')='' LIMIT 1;
 IF NOT FOUND THEN CONTINUE; END IF;
 SELECT siparis_no INTO other_id FROM public.gazi_siparisler x WHERE public.seller_owner_phone(x.siparis_alan,x.siparis_tel) IS DISTINCT FROM public.seller_normalize_phone(u.raw_app_meta_data->>'seller_phone') LIMIT 1;
 snapshot:=public.seller_order_safe(o);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated','app_metadata',u.raw_app_meta_data)::text,true);
 EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN PERFORM public.seller_cancel_pending(o.siparis_no,' ',snapshot); RAISE EXCEPTION 'Blank reason accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM='Blank reason accepted' THEN RAISE; END IF; END;
 BEGIN PERFORM public.seller_cancel_pending(other_id,'Müşteri talebi',snapshot); RAISE EXCEPTION 'Other seller accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.seller_cancel_pending(o.siparis_no,'Müşteri talebi','{}'); RAISE EXCEPTION 'Stale snapshot accepted'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN UPDATE public.gazi_siparisler SET kargo_durumu='İptal',iptal_nedeni='Müşteri talebi',toplam_tutar='0' WHERE siparis_no=o.siparis_no; RAISE EXCEPTION 'Other field edited during cancel'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 result:=public.seller_cancel_pending(o.siparis_no,'  Müşteri talebi  ',snapshot);
 IF result->>'kargo_durumu'<>'İptal' OR result->>'iptal_nedeni'<>'Müşteri talebi' THEN RAISE EXCEPTION 'Cancel result incorrect'; END IF;
 BEGIN PERFORM public.seller_cancel_pending(o.siparis_no,'Müşteri talebi',snapshot); RAISE EXCEPTION 'Repeated cancel accepted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 EXECUTE 'RESET ROLE';
 SELECT kargo_durumu INTO master_status FROM public.tum_siparisler WHERE siparis_no=o.siparis_no;
 IF master_status IS DISTINCT FROM 'İptal' THEN RAISE EXCEPTION 'Master sync failed'; END IF;
 tested:=tested+1;
 EXIT;
END LOOP;
IF tested=0 THEN RAISE EXCEPTION 'No eligible seller fixture found'; END IF;
END; $test$;
ROLLBACK;
SELECT 'PASS: own pending cancellation, required reason, stale/replay rejection, ownership and field guards, master sync; rolled back' AS result;
