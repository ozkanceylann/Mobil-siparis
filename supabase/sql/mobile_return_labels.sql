CREATE OR REPLACE FUNCTION public.admin_orders(p_filter text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb; phone text:=null;
begin
 if not public.seller_is_gazi_admin() then raise exception 'Yönetici erişimi gerekli.' using errcode='42501'; end if;
 if p_filter not in ('all','pending','prepared','shipped','in_transit','arrived','distribution','delivered','undelivered','support','returning','problem','cancelled','return_label') or p_offset<0 then raise exception 'Geçersiz filtre.'; end if;
 with owned as materialized (
 select siparis_no,nullif(trim(iade_kodu),'') is not null as has_return_label,case when trim(coalesce(p_search,''))='' then null else concat_ws(' ',siparis_no,ad_soyad,musteri_tel,sehir,ilce,kargo_takip_kodu,urun_bilgisi,iade_kodu) end as search_text,public.seller_order_phase(kargo_durumu,"isDelivered","shipmentStatusCode","shipmentStatus",teslimat_aciklama,notlar) as s from public.gazi_siparisler o where coalesce(kargo_durumu,'')<>'Silindi'
 ), filtered as (select * from owned where (p_filter='all' or (p_filter='return_label' and has_return_label) or s=p_filter or (p_filter='problem' and s in ('undelivered','support')) or (p_filter='in_transit' and s in ('shipped','arrived','distribution'))) and (trim(coalesce(p_search,''))='' or search_text ilike '%'||left(p_search,100)||'%')),
 page as (select o from public.gazi_siparisler o join (select siparis_no from filtered order by siparis_no desc offset p_offset limit 30) f using(siparis_no) order by o.siparis_no desc)
 select jsonb_build_object('phone',phone,'counts',(select jsonb_build_object('all',count(*),'return_label',count(*) filter(where has_return_label),'pending',count(*) filter(where s='pending'),'prepared',count(*) filter(where s='prepared'),'shipped',count(*) filter(where s='shipped'),'delivered',count(*) filter(where s='delivered'),'problem',count(*) filter(where s in ('undelivered','support')),'arrived',count(*) filter(where s='arrived'),'distribution',count(*) filter(where s='distribution'),'undelivered',count(*) filter(where s='undelivered'),'support',count(*) filter(where s='support'),'returning',count(*) filter(where s='returning'),'cancelled',count(*) filter(where s='cancelled')) from owned),'total',(select count(*) from filtered),'orders',coalesce((select jsonb_agg(public.seller_order_safe(o) || jsonb_build_object('seller_phone',public.seller_owner_phone((o).siparis_alan,(o).siparis_tel))) from page),'[]'::jsonb)) into result;
 return result;
end; $function$;

CREATE OR REPLACE FUNCTION public.seller_order_safe(o gazi_siparisler)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('siparis_no',o.siparis_no,'ad_soyad',o.ad_soyad,'musteri_tel',o.musteri_tel,'adres',o.adres,'sehir',o.sehir,'ilce',o.ilce,'sehir_kodu',o.sehir_kodu,'ilce_kodu',o.ilce_kodu,'urun_bilgisi',o.urun_bilgisi,'toplam_tutar',o.toplam_tutar,'odeme_sekli',o.odeme_sekli,'notlar',o.notlar,'kargo_adet',o.kargo_adet,'kargo_kg',o.kargo_kg,'tarih',o.tarih,'kargo_durumu',o.kargo_durumu,'status',public.seller_order_phase(o),'shipmentStatus',o."shipmentStatus",'kargo_takip_kodu',o.kargo_takip_kodu,'kargo_takip_url',o.kargo_takip_url,'kargo_gunc_saat',o.kargo_gunc_saat,'teslimat_aciklama',o.teslimat_aciklama,'iptal_nedeni',o.iptal_nedeni,'iade_kodu',o.iade_kodu,'iade_etiket_url',o.iade_etiket_url,'iade_durumu',o.iade_durumu,'iade_tarihi',o.iade_tarihi,'kargo_hareketleri',public.seller_tracking_events(o.kargo_api_yanit));
$function$;

CREATE OR REPLACE FUNCTION public.seller_orders(p_filter text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb; phone text:=public.seller_current_phone();
begin
 if phone is null then raise exception 'Satıcı oturumu gerekli.' using errcode='42501'; end if;
 if p_filter not in ('all','pending','prepared','shipped','in_transit','arrived','distribution','delivered','undelivered','support','returning','problem','cancelled','return_label') or p_offset<0 then raise exception 'Geçersiz filtre.'; end if;
 with owned as materialized (
 select siparis_no,nullif(trim(iade_kodu),'') is not null as has_return_label,case when trim(coalesce(p_search,''))='' then null else concat_ws(' ',siparis_no,ad_soyad,musteri_tel,sehir,ilce,kargo_takip_kodu,urun_bilgisi,iade_kodu) end as search_text,public.seller_order_phase(kargo_durumu,"isDelivered","shipmentStatusCode","shipmentStatus",teslimat_aciklama,notlar) as s from public.gazi_siparisler o where public.seller_owner_phone(siparis_alan,siparis_tel)=phone and coalesce(kargo_durumu,'')<>'Silindi'
 ), filtered as (select * from owned where (p_filter='all' or (p_filter='return_label' and has_return_label) or s=p_filter or (p_filter='problem' and s in ('undelivered','support')) or (p_filter='in_transit' and s in ('shipped','arrived','distribution'))) and (trim(coalesce(p_search,''))='' or search_text ilike '%'||left(p_search,100)||'%')),
 page as (select o from public.gazi_siparisler o join (select siparis_no from filtered order by siparis_no desc offset p_offset limit 30) f using(siparis_no) order by o.siparis_no desc)
 select jsonb_build_object('phone',phone,'counts',(select jsonb_build_object('all',count(*),'return_label',count(*) filter(where has_return_label),'pending',count(*) filter(where s='pending'),'prepared',count(*) filter(where s='prepared'),'shipped',count(*) filter(where s='shipped'),'delivered',count(*) filter(where s='delivered'),'problem',count(*) filter(where s in ('undelivered','support')),'arrived',count(*) filter(where s='arrived'),'distribution',count(*) filter(where s='distribution'),'undelivered',count(*) filter(where s='undelivered'),'support',count(*) filter(where s='support'),'returning',count(*) filter(where s='returning'),'cancelled',count(*) filter(where s='cancelled')) from owned),'total',(select count(*) from filtered),'orders',coalesce((select jsonb_agg(public.seller_order_safe(o)) from page),'[]'::jsonb)) into result;
 return result;
end; $function$;
