CREATE SCHEMA seller_support;
REVOKE ALL ON SCHEMA seller_support FROM PUBLIC;
GRANT USAGE ON SCHEMA seller_support TO authenticated,service_role;
CREATE TABLE seller_support.notes (
 siparis_no integer PRIMARY KEY REFERENCES public.gazi_siparisler(siparis_no) ON DELETE CASCADE,
 note text NOT NULL CHECK (length(note) BETWEEN 1 AND 2000 AND note ~ '[^[:space:]]'),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_by uuid NOT NULL
);
ALTER TABLE seller_support.notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_note_read ON seller_support.notes FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.gazi_siparisler o WHERE o.siparis_no=notes.siparis_no AND coalesce(o.kargo_durumu,'')<>'Silindi'
 AND (public.seller_is_gazi_admin() OR public.seller_owner_phone(o.siparis_alan,o.siparis_tel)=public.seller_current_phone()))
);
GRANT SELECT ON seller_support.notes TO authenticated;
GRANT ALL ON seller_support.notes TO service_role;

CREATE FUNCTION public.seller_support_notes(p_order_ids integer[]) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''
AS $f$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Oturum gerekli' USING ERRCODE='42501';END IF;
 IF coalesce(cardinality(p_order_ids),0)>100 THEN RAISE EXCEPTION 'En fazla 100 sipariş sorgulanabilir';END IF;
 RETURN coalesce((SELECT jsonb_object_agg(siparis_no::text,jsonb_build_object('note',note,'updated_at',updated_at))
 FROM seller_support.notes WHERE siparis_no=ANY(p_order_ids)),'{}'::jsonb);
END $f$;

CREATE FUNCTION seller_support.save_note(p_id integer,p_note text,p_previous_updated_at timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $f$
DECLARE o public.gazi_siparisler;previous seller_support.notes;result seller_support.notes;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Oturum gerekli' USING ERRCODE='42501';END IF;
 IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 2000 OR p_note !~ '[^[:space:]]' THEN RAISE EXCEPTION '1–2000 karakter açıklama yazın.';END IF;
 SELECT * INTO o FROM public.gazi_siparisler WHERE siparis_no=p_id AND coalesce(kargo_durumu,'')<>'Silindi'
 AND (public.seller_is_gazi_admin() OR public.seller_owner_phone(siparis_alan,siparis_tel)=public.seller_current_phone()) FOR NO KEY UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sipariş bulunamadı veya erişim izniniz yok.' USING ERRCODE='42501';END IF;
 IF public.seller_order_phase(o) NOT IN ('support','undelivered') THEN RAISE EXCEPTION 'Yalnız destek / teslim edilemedi aşamasındaki siparişlere açıklama eklenebilir.';END IF;
 SELECT * INTO previous FROM seller_support.notes WHERE siparis_no=p_id;
 IF previous.updated_at IS DISTINCT FROM p_previous_updated_at THEN RAISE EXCEPTION 'Açıklama başka bir oturumda değişti. Kapatıp yeniden açın.' USING ERRCODE='40001';END IF;
 INSERT INTO seller_support.notes(siparis_no,note,updated_by) VALUES(p_id,btrim(p_note),auth.uid())
 ON CONFLICT(siparis_no) DO UPDATE SET note=excluded.note,updated_at=clock_timestamp(),updated_by=excluded.updated_by RETURNING * INTO result;
 RETURN jsonb_build_object('note',result.note,'updated_at',result.updated_at);
END $f$;

CREATE FUNCTION public.seller_save_support_note(p_id integer,p_note text,p_previous_updated_at timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=''
AS $f$ SELECT seller_support.save_note(p_id,p_note,p_previous_updated_at); $f$;
REVOKE ALL ON FUNCTION public.seller_support_notes(integer[]),public.seller_save_support_note(integer,text,timestamptz),seller_support.save_note(integer,text,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.seller_support_notes(integer[]),public.seller_save_support_note(integer,text,timestamptz),seller_support.save_note(integer,text,timestamptz) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
