CREATE OR REPLACE FUNCTION public.admin_cancel_pending(p_id integer,p_reason text,p_original jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $function$
DECLARE o public.gazi_siparisler;
BEGIN
 IF NOT public.seller_is_gazi_admin() THEN RAISE EXCEPTION 'Yönetici erişimi gerekli.' USING errcode='42501'; END IF;
 IF char_length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'İptal açıklaması 3–2000 karakter olmalı.'; END IF;
 SELECT * INTO o FROM public.gazi_siparisler WHERE siparis_no=p_id FOR UPDATE;
 IF NOT FOUND OR o.kargo_durumu IS DISTINCT FROM 'Bekliyor' OR public.seller_order_phase(o) IS DISTINCT FROM 'pending'
 THEN RAISE EXCEPTION 'Yalnızca bekleyen siparişler iptal edilebilir.' USING errcode='42501'; END IF;
 IF nullif(trim(o.orderinvoiceid),'') IS NOT NULL OR nullif(trim(o.kargo_takip_kodu),'') IS NOT NULL OR nullif(trim(o.kargo_zpl),'') IS NOT NULL OR nullif(trim(o.zpl_base64),'') IS NOT NULL
 THEN RAISE EXCEPTION 'Kargo işlemi başlamış sipariş mobil panelden iptal edilemez.' USING errcode='42501'; END IF;
 IF p_original IS DISTINCT FROM public.seller_order_safe(o) THEN RAISE EXCEPTION 'Sipariş başka bir işlemde güncellendi. Yeniden açıp deneyin.' USING errcode='40001'; END IF;
 UPDATE public.gazi_siparisler SET kargo_durumu='İptal',iptal_nedeni=trim(p_reason),iptal_tarihi=now() AT TIME ZONE 'Europe/Istanbul' WHERE siparis_no=p_id RETURNING * INTO o;
 RETURN public.seller_order_safe(o);
END; $function$;
REVOKE ALL ON FUNCTION public.admin_cancel_pending(integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_cancel_pending(integer,text,jsonb) TO authenticated;

