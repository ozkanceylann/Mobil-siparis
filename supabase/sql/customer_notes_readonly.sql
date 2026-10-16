create or replace function public.seller_customer_notes(p_order_ids integer[])
returns jsonb language plpgsql stable security invoker set search_path='' set statement_timeout='10s' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Oturum gerekli' using errcode='42501';end if;
 if coalesce(cardinality(p_order_ids),0)>100 then raise exception 'En fazla 100 sipariş sorgulanabilir';end if;
 select coalesce(jsonb_object_agg(o.siparis_no::text,c.note),'{}'::jsonb) into result
 from public.gazi_siparisler o
 join lateral (
   select min(m."not") as note,count(*) as matches from public.musteriler m
   where m.musteri_no=o.musteri_no
   or (o.musteri_no is null and length(regexp_replace(coalesce(o.musteri_tel,''),'[^0-9]','','g'))>=10
     and right(regexp_replace(m.musteri_tel,'[^0-9]','','g'),10)=right(regexp_replace(o.musteri_tel,'[^0-9]','','g'),10))
 ) c on c.matches=1
 where o.siparis_no=any(p_order_ids) and coalesce(o.kargo_durumu,'')<>'Silindi' and nullif(trim(c.note),'') is not null;
 return result;
end $$;
revoke all on function public.seller_customer_notes(integer[]) from public,anon;
grant execute on function public.seller_customer_notes(integer[]) to authenticated;
