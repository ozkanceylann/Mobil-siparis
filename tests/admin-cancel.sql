BEGIN;
DO $test$
DECLARE a record; u record; o public.gazi_siparisler; snap jsonb; result jsonb; tested integer:=0; other_id integer;
BEGIN
 SELECT id,raw_app_meta_data INTO a FROM auth.users WHERE raw_app_meta_data->>'firma'='gazi' AND coalesce(raw_app_meta_data->>'role','')<>'seller' LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Admin fixture missing'; END IF;
 SELECT siparis_no INTO other_id FROM public.gazi_siparisler WHERE kargo_durumu='Kargolandı' LIMIT 1;
 FOR o IN SELECT DISTINCT ON (public.seller_owner_phone(siparis_alan,siparis_tel)) * FROM public.gazi_siparisler x WHERE kargo_durumu='Bekliyor' AND public.seller_order_phase(x)='pending' AND coalesce(orderinvoiceid,'')='' AND coalesce(kargo_takip_kodu,'')='' AND coalesce(kargo_zpl,'')='' AND coalesce(zpl_base64,'')='' ORDER BY public.seller_owner_phone(siparis_alan,siparis_tel) LIMIT 2 LOOP
  snap:=public.seller_order_safe(o);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',a.id,'role','authenticated','app_metadata',a.raw_app_meta_data)::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN PERFORM public.admin_cancel_pending(o.siparis_no,' ',snap);RAISE EXCEPTION 'Blank reason accepted';EXCEPTION WHEN raise_exception THEN IF SQLERRM='Blank reason accepted' THEN RAISE;END IF;END;
  BEGIN PERFORM public.admin_cancel_pending(other_id,'Yönetici iptali',snap);RAISE EXCEPTION 'Shipped order accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  BEGIN PERFORM public.admin_cancel_pending(o.siparis_no,'Yönetici iptali','{}');RAISE EXCEPTION 'Stale snapshot accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
  result:=public.admin_cancel_pending(o.siparis_no,' Yönetici iptali ',snap);
  IF result->>'kargo_durumu'<>'İptal' OR result->>'iptal_nedeni'<>'Yönetici iptali' THEN RAISE EXCEPTION 'Invalid result';END IF;
  BEGIN PERFORM public.admin_cancel_pending(o.siparis_no,'Yönetici iptali',snap);RAISE EXCEPTION 'Replay accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
  EXECUTE 'RESET ROLE';
  IF NOT EXISTS(SELECT 1 FROM public.tum_siparisler WHERE siparis_no=o.siparis_no AND kargo_durumu='İptal' AND iptal_nedeni='Yönetici iptali')THEN RAISE EXCEPTION 'Master sync failed';END IF;
  tested:=tested+1;
 END LOOP;
 IF tested=0 THEN RAISE EXCEPTION 'Pending order fixture missing';END IF;
 SELECT id,raw_app_meta_data INTO u FROM auth.users WHERE raw_app_meta_data->>'role'='seller' LIMIT 1;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u.id,'role','authenticated','app_metadata',u.raw_app_meta_data)::text,true);EXECUTE 'SET LOCAL ROLE authenticated';
 BEGIN PERFORM public.admin_cancel_pending(other_id,'Deneme','{}');RAISE EXCEPTION 'Seller accessed admin cancellation';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 EXECUTE 'RESET ROLE';
END; $test$;
ROLLBACK;
SELECT 'PASS: admin cancels pending orders across sellers; required reason, stale/replay/shipped guards, master sync and seller denial; rolled back' AS result;
