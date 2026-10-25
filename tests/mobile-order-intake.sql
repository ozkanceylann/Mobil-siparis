begin;
select set_config('request.jwt.claims',(select jsonb_build_object('sub',id,'role','authenticated')::text from auth.users where raw_app_meta_data->>'role'='seller' and deleted_at is null and (banned_until is null or banned_until<now()) limit 1),true);
set local role authenticated;
do $$
declare first_result jsonb; duplicate jsonb;
begin
 first_result:=public.mobile_order_submit('30000000-0000-4000-8000-000000000001','Mobil sözleşme testi tek gönderim 20261025');
 duplicate:=public.mobile_order_submit('30000000-0000-4000-8000-000000000001','Mobil sözleşme testi tek gönderim 20261025');
 assert first_result->>'id'=duplicate->>'id';
 duplicate:=public.mobile_order_submit('30000000-0000-4000-8000-000000000002','Mobil sözleşme testi tek gönderim 20261025');
 assert first_result->>'id'=duplicate->>'id';
 assert public.mobile_order_status((first_result->>'id')::uuid)->>'status'='pending';
 begin
  perform public.mobile_order_status('20000000-0000-4000-8000-000000000001');
  raise exception 'Başkasının gönderimi okunabildi!';
 exception when insufficient_privilege then null;
 end;
 assert not has_function_privilege(current_user,'public.mobile_order_claim(uuid)','execute');
 assert not has_function_privilege(current_user,'public.mobile_order_finish(uuid,uuid,jsonb,text)','execute');
end $$;
reset role;
do $$
declare claimed record; d jsonb; result jsonb; second jsonb; target integer;
begin
 select * into claimed from public.mobile_order_claim('30000000-0000-4000-8000-000000000001');
 assert claimed.id is not null;
 assert not exists(select 1 from public.mobile_order_claim(claimed.id));
 select parsed into d from mobile_intake.requests where id='20000000-0000-4000-8000-000000000001';
 d:=d||'{"siparis_alan_numara":"05550000000"}'::jsonb;
 result:=public.mobile_order_finish(claimed.id,claimed.claim_token,d,null);
 assert result->>'status'='completed',result::text;
 target:=(result->>'order_no')::integer;
 assert exists(select 1 from public.gazi_siparisler where siparis_no=target and public.seller_owner_phone(siparis_alan,siparis_tel)=claimed.seller_phone);
 assert exists(select 1 from public.tum_siparisler where siparis_no=target and siparis_sekli='Mobil' and whatsapp_message_text='Mobil sözleşme testi tek gönderim 20261025');
 second:=public.mobile_order_finish(claimed.id,claimed.claim_token,d,null);
 assert second->>'order_no'=result->>'order_no';
 assert (select count(*) from public.gazi_siparisler where siparis_no=target)=1;
end $$;
select 'PASS: real seller authorization, own status, cross-user rejection, client cannot claim/finish, duplicate submit, exclusive claim, atomic master/Gazi write, server-owned seller, repeated finish' as result;
rollback;
