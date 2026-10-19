-- Original messages stay private; expose only the message of an authorized order.
create schema if not exists gazi_message_private;
revoke all on schema gazi_message_private from public, anon;
grant usage on schema gazi_message_private to authenticated;

create or replace function gazi_message_private.order_message(p_id integer)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Oturum gerekli.' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.gazi_siparisler o
    where o.siparis_no=p_id and coalesce(o.kargo_durumu,'')<>'Silindi'
    and (public.seller_is_gazi_admin()
      or public.seller_owner_phone(o.siparis_alan,o.siparis_tel)=public.seller_current_phone())
  ) then
    raise exception 'Sipariş bulunamadı veya erişim izniniz yok.' using errcode='42501';
  end if;
  select jsonb_build_object('message',t.whatsapp_message_text) into result
  from public.tum_siparisler t where t.siparis_no=p_id;
  return coalesce(result,jsonb_build_object('message',null));
end;
$$;
revoke all on function gazi_message_private.order_message(integer) from public, anon;
grant execute on function gazi_message_private.order_message(integer) to authenticated;

create or replace function public.seller_original_order_message(p_id integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select gazi_message_private.order_message(p_id); $$;
revoke all on function public.seller_original_order_message(integer) from public, anon;
grant execute on function public.seller_original_order_message(integer) to authenticated;
