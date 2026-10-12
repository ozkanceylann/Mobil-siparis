CREATE OR REPLACE FUNCTION public.seller_order_status(durum text, delivered boolean, code smallint)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select case when durum='İptal' then 'cancelled' when code in (6,7,8) then 'problem' when delivered is true or code=5 or durum='Tamamlandı' then 'delivered' when durum='Bekliyor' then 'pending' when durum='Hazırlandı' then 'prepared' else 'shipped' end;
$function$;


create or replace function public.seller_order_status(durum text, delivered boolean, code smallint, tracking_status text)
returns text language sql immutable set search_path='' as $fn$
select case when durum='İptal' then 'cancelled'
when code in (6,7,8) or replace(lower(coalesce(tracking_status,'')),'_',' ') ~ '(teslim edilemedi|geri geliyor|iade|return|undeliver)' then 'problem'
when replace(lower(coalesce(tracking_status,'')),'_',' ') ~ '(teslim edildi|delivered)' then 'delivered'
else public.seller_order_status(durum,delivered,code) end;
$fn$;

create or replace function public.seller_tracking_events(raw text)
returns jsonb language plpgsql immutable set search_path='' as $fn$
declare payload jsonb; events jsonb;
begin
 begin payload:=raw::jsonb; exception when others then return '[]'::jsonb; end;
 events:=payload#>'{tracking,movements}';
 if jsonb_typeof(events) is distinct from 'array' then return '[]'::jsonb; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('eventStatus',e->>'eventStatus','eventDateTime',e->>'eventDateTime','eventDateTime2',e->>'eventDateTime2','eventSequence',e->>'eventSequence','location',e->>'location','locationAddress',e->>'locationAddress','description',e->>'description')) from jsonb_array_elements(events) e),'[]'::jsonb);
end; $fn$;

CREATE OR REPLACE FUNCTION public.seller_order_safe(o gazi_siparisler)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('siparis_no',o.siparis_no,'ad_soyad',o.ad_soyad,'musteri_tel',o.musteri_tel,'adres',o.adres,'sehir',o.sehir,'ilce',o.ilce,'sehir_kodu',o.sehir_kodu,'ilce_kodu',o.ilce_kodu,'urun_bilgisi',o.urun_bilgisi,'toplam_tutar',o.toplam_tutar,'odeme_sekli',o.odeme_sekli,'notlar',o.notlar,'kargo_adet',o.kargo_adet,'kargo_kg',o.kargo_kg,'tarih',o.tarih,'kargo_durumu',o.kargo_durumu,'status',public.seller_order_status(o.kargo_durumu,o."isDelivered",o."shipmentStatusCode",o."shipmentStatus"),'shipmentStatus',o."shipmentStatus",'kargo_takip_kodu',o.kargo_takip_kodu,'kargo_takip_url',o.kargo_takip_url,'kargo_gunc_saat',o.kargo_gunc_saat,'teslimat_aciklama',o.teslimat_aciklama,'iptal_nedeni',o.iptal_nedeni,'kargo_hareketleri',public.seller_tracking_events(o.kargo_api_yanit));
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
 if p_filter not in ('all','pending','prepared','shipped','delivered','problem','cancelled') or p_offset<0 then raise exception 'Geçersiz filtre.'; end if;
 with owned as materialized (
 select o.*,public.seller_order_status(kargo_durumu,"isDelivered","shipmentStatusCode","shipmentStatus") as s from public.gazi_siparisler o where public.seller_owner_phone(siparis_alan,siparis_tel)=phone and coalesce(kargo_durumu,'')<>'Silindi'
 ), filtered as (select * from owned where (p_filter='all' or s=p_filter) and (trim(coalesce(p_search,''))='' or concat_ws(' ',siparis_no,ad_soyad,musteri_tel,sehir,ilce,kargo_takip_kodu,urun_bilgisi) ilike '%'||left(p_search,100)||'%')),
 page as (select o from public.gazi_siparisler o join (select siparis_no from filtered order by siparis_no desc offset p_offset limit 30) f using(siparis_no) order by o.siparis_no desc)
 select jsonb_build_object('phone',phone,'counts',(select jsonb_build_object('all',count(*),'pending',count(*) filter(where s='pending'),'prepared',count(*) filter(where s='prepared'),'shipped',count(*) filter(where s='shipped'),'delivered',count(*) filter(where s='delivered'),'problem',count(*) filter(where s='problem'),'cancelled',count(*) filter(where s='cancelled')) from owned),'total',(select count(*) from filtered),'orders',coalesce((select jsonb_agg(public.seller_order_safe(o)) from page),'[]'::jsonb)) into result;
 return result;
end; $function$;
