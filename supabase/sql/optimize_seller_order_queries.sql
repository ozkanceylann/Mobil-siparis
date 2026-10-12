CREATE OR REPLACE FUNCTION public.seller_order_phase(durum text, delivered boolean, code smallint, tracking_status text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $function$
declare t text; base text;
begin
base:=public.seller_order_status(durum,delivered,code,tracking_status);
if base='cancelled' then return 'cancelled'; end if;
t:=translate(lower(translate(replace(concat_ws(' ',durum,tracking_status),'_',' '),'İ','I')),'ışğüöç','isguoc');
if code=7 or t ~ '(geri gel|geri don|iade|return)' then return 'returning'; end if;
if code=6 or t ~ '(teslim edilem|undeliver|not delivered|delivery fail)' then return 'undelivered'; end if;
if code=8 or t ~ '(destek|support|sorun|problem|exception)' or base='problem' then return 'support'; end if;
if base='delivered' then return 'delivered'; end if;
if code=4 or t ~ '(dagitimda|alici adresine yonlendir|adresinize yonlendir|out for delivery)' then return 'distribution'; end if;
if code=3 or t ~ '(varis sube|varis birim|teslimat birimine ulast)' then return 'arrived'; end if;
return base;
end;
$function$;
CREATE OR REPLACE FUNCTION public.seller_order_phase(durum text, delivered boolean, code smallint, tracking_status text, explanation_text text, notes_text text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $function$
declare phase text; explanation text; notes text;
begin
phase:=public.seller_order_phase(durum,delivered,code,tracking_status);
if phase='cancelled' then return phase; end if;
explanation:=translate(lower(translate(coalesce(explanation_text,''),'İ','I')),'ışğüöç','isguoc');
if phase='returning' or explanation ~ '(iade fat|iade teslim|geri gel|geri don)' then return 'returning'; end if;
if phase in ('delivered','pending','prepared','support') then return phase; end if;
if explanation ~ '(teslimat problem|destek|support|adreste taninm|adres.*(yanlis|yetersiz|eksik)|telefon.*(yanlis|hatali|eksik)|tel.*yanlis|kabul etmiyor|reddet|subeden teslim|ulasilamiyor)' then return 'support'; end if;
if phase='undelivered' then
notes:=translate(lower(translate(coalesce(notes_text,''),'İ','I')),'ışğüöç','isguoc');
if notes ~ '(tel.*yanlis|telefon.*hatali|adres.*yanlis)' then return 'support'; end if;
end if;
return phase;
end;
$function$;
CREATE OR REPLACE FUNCTION public.seller_order_phase(o public.gazi_siparisler)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
select public.seller_order_phase(o.kargo_durumu,o."isDelivered",o."shipmentStatusCode",o."shipmentStatus",o.teslimat_aciklama,o.notlar);
$function$;
CREATE OR REPLACE FUNCTION public.admin_orders(p_filter text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb; phone text:=null;
begin
 if not public.seller_is_gazi_admin() then raise exception 'Yönetici erişimi gerekli.' using errcode='42501'; end if;
 if p_filter not in ('all','pending','prepared','shipped','in_transit','arrived','distribution','delivered','undelivered','support','returning','problem','cancelled') or p_offset<0 then raise exception 'Geçersiz filtre.'; end if;
 with owned as materialized (
 select siparis_no,case when trim(coalesce(p_search,''))='' then null else concat_ws(' ',siparis_no,ad_soyad,musteri_tel,sehir,ilce,kargo_takip_kodu,urun_bilgisi) end as search_text,public.seller_order_phase(kargo_durumu,"isDelivered","shipmentStatusCode","shipmentStatus",teslimat_aciklama,notlar) as s from public.gazi_siparisler o where coalesce(kargo_durumu,'')<>'Silindi'
 ), filtered as (select * from owned where (p_filter='all' or s=p_filter or (p_filter='problem' and s in ('undelivered','support')) or (p_filter='in_transit' and s in ('shipped','arrived','distribution'))) and (trim(coalesce(p_search,''))='' or search_text ilike '%'||left(p_search,100)||'%')),
 page as (select o from public.gazi_siparisler o join (select siparis_no from filtered order by siparis_no desc offset p_offset limit 30) f using(siparis_no) order by o.siparis_no desc)
 select jsonb_build_object('phone',phone,'counts',(select jsonb_build_object('all',count(*),'pending',count(*) filter(where s='pending'),'prepared',count(*) filter(where s='prepared'),'shipped',count(*) filter(where s='shipped'),'delivered',count(*) filter(where s='delivered'),'problem',count(*) filter(where s in ('undelivered','support')),'arrived',count(*) filter(where s='arrived'),'distribution',count(*) filter(where s='distribution'),'undelivered',count(*) filter(where s='undelivered'),'support',count(*) filter(where s='support'),'returning',count(*) filter(where s='returning'),'cancelled',count(*) filter(where s='cancelled')) from owned),'total',(select count(*) from filtered),'orders',coalesce((select jsonb_agg(public.seller_order_safe(o) || jsonb_build_object('seller_phone',public.seller_owner_phone((o).siparis_alan,(o).siparis_tel))) from page),'[]'::jsonb)) into result;
 return result;
end; $function$;
CREATE OR REPLACE FUNCTION public.seller_orders(p_filter text DEFAULT 'all'::text, p_search text DEFAULT ''::text, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare result jsonb; phone text:=public.seller_current_phone();
begin
 if phone is null then raise exception 'Satıcı oturumu gerekli.' using errcode='42501'; end if;
 if p_filter not in ('all','pending','prepared','shipped','in_transit','arrived','distribution','delivered','undelivered','support','returning','problem','cancelled') or p_offset<0 then raise exception 'Geçersiz filtre.'; end if;
 with owned as materialized (
 select siparis_no,case when trim(coalesce(p_search,''))='' then null else concat_ws(' ',siparis_no,ad_soyad,musteri_tel,sehir,ilce,kargo_takip_kodu,urun_bilgisi) end as search_text,public.seller_order_phase(kargo_durumu,"isDelivered","shipmentStatusCode","shipmentStatus",teslimat_aciklama,notlar) as s from public.gazi_siparisler o where public.seller_owner_phone(siparis_alan,siparis_tel)=phone and coalesce(kargo_durumu,'')<>'Silindi'
 ), filtered as (select * from owned where (p_filter='all' or s=p_filter or (p_filter='problem' and s in ('undelivered','support')) or (p_filter='in_transit' and s in ('shipped','arrived','distribution'))) and (trim(coalesce(p_search,''))='' or search_text ilike '%'||left(p_search,100)||'%')),
 page as (select o from public.gazi_siparisler o join (select siparis_no from filtered order by siparis_no desc offset p_offset limit 30) f using(siparis_no) order by o.siparis_no desc)
 select jsonb_build_object('phone',phone,'counts',(select jsonb_build_object('all',count(*),'pending',count(*) filter(where s='pending'),'prepared',count(*) filter(where s='prepared'),'shipped',count(*) filter(where s='shipped'),'delivered',count(*) filter(where s='delivered'),'problem',count(*) filter(where s in ('undelivered','support')),'arrived',count(*) filter(where s='arrived'),'distribution',count(*) filter(where s='distribution'),'undelivered',count(*) filter(where s='undelivered'),'support',count(*) filter(where s='support'),'returning',count(*) filter(where s='returning'),'cancelled',count(*) filter(where s='cancelled')) from owned),'total',(select count(*) from filtered),'orders',coalesce((select jsonb_agg(public.seller_order_safe(o)) from page),'[]'::jsonb)) into result;
 return result;
end; $function$;
