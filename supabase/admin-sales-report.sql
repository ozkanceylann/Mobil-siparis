
do $do$
declare definition text;
begin
 definition:=pg_get_functiondef('public.admin_update_order(integer,jsonb,jsonb)'::regprocedure);
 definition:=replace(definition, 'if not found then raise exception ''Sipariş bulunamadı veya erişim izniniz yok.'' using errcode=''42501''; end if;',
 'if not found or o.kargo_durumu is distinct from ''Bekliyor'' or public.seller_order_status(o.kargo_durumu,o."isDelivered",o."shipmentStatusCode",o."shipmentStatus") is distinct from ''pending'' then raise exception ''Yalnızca hazırlanmamış bekleyen siparişleri düzenleyebilirsiniz.'' using errcode=''42501''; end if;');
 execute definition;
 -- Admin cards identify the seller without exposing additional fields to sellers.
 definition:=pg_get_functiondef('public.admin_orders(text,text,integer)'::regprocedure);
 definition:=replace(definition,'jsonb_agg(public.seller_order_safe(o))','jsonb_agg(public.seller_order_safe(o) || jsonb_build_object(''seller_phone'',public.seller_owner_phone((o).siparis_alan,(o).siparis_tel)))');
 execute definition;
end $do$;

create or replace function public.admin_sales_report(p_start date,p_end date)
returns jsonb language plpgsql stable security invoker set search_path='' as $fn$
declare result jsonb;
begin
 if auth.uid() is null or not public.seller_is_gazi_admin() then raise exception 'Yönetici erişimi gerekli.' using errcode='42501'; end if;
 if p_start is null or p_end is null or p_start>p_end then raise exception 'Geçersiz tarih aralığı.'; end if;
 with base as materialized (
 select coalesce(public.seller_owner_phone(siparis_alan,siparis_tel),'Belirtilmemiş') phone,
 public.seller_order_status(kargo_durumu,"isDelivered","shipmentStatusCode","shipmentStatus") status,
 regexp_replace(coalesce(toplam_tutar,''),'(₺|TL|tl|[[:space:]])','','g') raw
 from public.gazi_siparisler where tarih>=p_start::timestamp and tarih<(p_end+1)::timestamp and coalesce(kargo_durumu,'') not in ('Silindi','İptal')
 ), amounts as (
 select *,case
 when raw ~ '^[0-9]+([.,][0-9]{1,2})?$' then replace(raw,',','.')::numeric
 when raw ~ '^[0-9]{1,3}(\.[0-9]{3})+(,[0-9]{1,2})?$' then replace(replace(raw,'.',''),',','.')::numeric
 when raw ~ '^[0-9]{1,3}(,[0-9]{3})+(\.[0-9]{1,2})?$' then replace(raw,',','')::numeric
 else null end amount from base
 ), grouped as (
 select phone,count(*) orders,coalesce(sum(amount),0) amount,count(*) filter(where status='problem') problem_orders,
 count(*) filter(where amount is null) invalid_amounts from amounts group by phone
 )
 select jsonb_build_object('start',p_start,'end',p_end,'orders',coalesce(sum(orders),0),'amount',coalesce(sum(amount),0),
 'invalid_amounts',coalesce(sum(invalid_amounts),0),'sellers',coalesce(jsonb_agg(to_jsonb(g) order by amount desc,phone),'[]'::jsonb))
 into result from grouped g;
 return result;
end $fn$;
revoke all on function public.admin_sales_report(date,date) from public,anon;
grant execute on function public.admin_sales_report(date,date) to authenticated;
