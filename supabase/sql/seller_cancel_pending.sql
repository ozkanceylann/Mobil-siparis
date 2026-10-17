CREATE OR REPLACE FUNCTION public.seller_guard_order_update()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $function$
DECLARE allowed text[]:=array['ad_soyad','musteri_tel','adres','sehir','ilce','sehir_kodu','ilce_kodu','urun_bilgisi','toplam_tutar','odeme_sekli','notlar','kargo_adet','kargo_kg','subeden_teslim','teslim_subesi','teslim_sekli_kontrol'];
BEGIN
 IF nullif(old.orderinvoiceid,'') IS NOT NULL AND (new.subeden_teslim IS DISTINCT FROM old.subeden_teslim OR new.teslim_subesi IS DISTINCT FROM old.teslim_subesi) THEN new.teslim_sekli_kontrol:=true; END IF;
 IF auth.jwt()->'app_metadata'->>'role'='seller' THEN
  IF old.kargo_durumu IS DISTINCT FROM 'Bekliyor' OR public.seller_owner_phone(old.siparis_alan,old.siparis_tel) IS DISTINCT FROM public.seller_current_phone() THEN RAISE EXCEPTION 'Yalnızca kendi bekleyen siparişinizi düzenleyebilirsiniz.' USING errcode='42501'; END IF;
  IF new.kargo_durumu='İptal' THEN
   IF public.seller_order_phase(old) IS DISTINCT FROM 'pending' OR nullif(trim(old.orderinvoiceid),'') IS NOT NULL OR nullif(trim(old.kargo_takip_kodu),'') IS NOT NULL OR nullif(trim(old.kargo_zpl),'') IS NOT NULL OR nullif(trim(old.zpl_base64),'') IS NOT NULL
   THEN RAISE EXCEPTION 'Kargo işlemi başlamış sipariş mobil panelden iptal edilemez.' USING errcode='42501'; END IF;
   IF char_length(trim(coalesce(new.iptal_nedeni,''))) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'İptal açıklaması 3–2000 karakter olmalı.'; END IF;
   IF (to_jsonb(new)-array['kargo_durumu','iptal_nedeni','iptal_tarihi']) IS DISTINCT FROM (to_jsonb(old)-array['kargo_durumu','iptal_nedeni','iptal_tarihi'])
   THEN RAISE EXCEPTION 'İptal sırasında diğer sipariş alanları değiştirilemez.' USING errcode='42501'; END IF;
   new.iptal_nedeni:=trim(new.iptal_nedeni);
   new.iptal_tarihi:=now() AT TIME ZONE 'Europe/Istanbul';
  ELSIF (to_jsonb(new)-allowed) IS DISTINCT FROM (to_jsonb(old)-allowed) THEN RAISE EXCEPTION 'Sipariş sahipliği ve süreç alanları değiştirilemez.' USING errcode='42501'; END IF;
 END IF;
 RETURN new;
END; $function$;
ALTER POLICY seller_pending_update ON public.gazi_siparisler
WITH CHECK (public.seller_owner_phone(siparis_alan,siparis_tel)=(SELECT public.seller_current_phone()) AND kargo_durumu IN ('Bekliyor','İptal'));
CREATE OR REPLACE FUNCTION public.seller_cancel_pending(p_id integer,p_reason text,p_original jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path TO ''
AS $function$
DECLARE o public.gazi_siparisler;
BEGIN
 IF public.seller_current_phone() IS NULL THEN RAISE EXCEPTION 'Satıcı oturumu gerekli.' USING errcode='42501'; END IF;
 IF char_length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'İptal açıklaması 3–2000 karakter olmalı.'; END IF;
 SELECT * INTO o FROM public.gazi_siparisler WHERE siparis_no=p_id AND public.seller_owner_phone(siparis_alan,siparis_tel)=public.seller_current_phone() FOR UPDATE;
 IF NOT FOUND OR o.kargo_durumu IS DISTINCT FROM 'Bekliyor' THEN RAISE EXCEPTION 'Sipariş artık bekleyen aşamasında değil veya erişim izniniz yok.' USING errcode='42501'; END IF;
 IF p_original IS DISTINCT FROM public.seller_order_safe(o) THEN RAISE EXCEPTION 'Sipariş başka bir işlemde güncellendi. Yeniden açıp deneyin.' USING errcode='40001'; END IF;
 UPDATE public.gazi_siparisler SET kargo_durumu='İptal',iptal_nedeni=trim(p_reason),iptal_tarihi=now() AT TIME ZONE 'Europe/Istanbul' WHERE siparis_no=p_id RETURNING * INTO o;
 RETURN public.seller_order_safe(o);
END; $function$;
REVOKE ALL ON FUNCTION public.seller_cancel_pending(integer,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seller_cancel_pending(integer,text,jsonb) TO authenticated;

