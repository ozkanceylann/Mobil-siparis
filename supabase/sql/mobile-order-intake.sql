create schema if not exists mobile_intake;
revoke all on schema mobile_intake from public,anon,authenticated;
grant usage on schema mobile_intake to authenticated,service_role;
create table mobile_intake.requests (
 id uuid primary key, user_id uuid not null references auth.users(id), seller_phone text not null,
 message text not null, status text not null default 'pending' check(status in ('pending','processing','completed','rejected','failed')),
 created_at timestamptz not null default now(), claimed_at timestamptz, claim_token uuid,
 order_no integer, result_message text, parsed jsonb, is_test boolean not null default false
);
alter table mobile_intake.requests enable row level security;
revoke all on mobile_intake.requests from public,anon,authenticated;
create index mobile_intake_pending on mobile_intake.requests(created_at) where status='pending';
create index mobile_intake_owner on mobile_intake.requests(user_id,created_at desc);

create function mobile_intake.actor_phone() returns text language plpgsql security definer set search_path='' as $$
declare u auth.users; p text;
begin
 select * into u from auth.users where id=auth.uid() and deleted_at is null and (banned_until is null or banned_until<now());
 if u.id is null then raise exception 'Oturum gerekli. Yeniden giriş yapın.' using errcode='42501'; end if;
 if u.raw_app_meta_data->>'role'='seller' then p:=public.seller_normalize_phone(u.raw_app_meta_data->>'seller_phone');
 elsif u.raw_app_meta_data->>'firma'='gazi' then p:=public.seller_normalize_phone(u.raw_app_meta_data->>'admin_phone');
   if p is null and u.email='oz_@live.com' then p:='05079970697'; end if;
 end if;
 if p is null then raise exception 'Sipariş girişi için kayıtlı satıcı telefonu gerekli.' using errcode='42501'; end if;
 return p;
end $$;
create function mobile_intake.submit(p_id uuid,p_message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=mobile_intake.actor_phone(); r mobile_intake.requests; msg text:=btrim(p_message);
begin
 if p_id is null or msg is null or length(msg)<10 or length(msg)>15000 then raise exception 'Sipariş mesajı 10–15000 karakter olmalı.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('mobile-order:'||auth.uid()::text,0));
 select * into r from mobile_intake.requests where id=p_id;
 if found then
  if r.user_id<>auth.uid() or r.message<>msg then raise exception 'Geçersiz gönderim kimliği.' using errcode='42501'; end if;
 else
  select * into r from mobile_intake.requests where user_id=auth.uid() and message=msg and not is_test
   and status in ('pending','processing','completed') and created_at>now()-interval '10 minutes' order by created_at desc limit 1;
  if not found then
   if (select count(*) from mobile_intake.requests where user_id=auth.uid() and created_at>now()-interval '1 minute')>=10 then raise exception 'Çok sık gönderim yapıldı. Bir dakika bekleyin.'; end if;
   insert into mobile_intake.requests(id,user_id,seller_phone,message) values(p_id,auth.uid(),p,msg) returning * into r;
  end if;
 end if;
 return jsonb_build_object('id',r.id,'status',r.status,'order_no',r.order_no,'message',r.result_message);
end $$;
create function mobile_intake.status(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text:=mobile_intake.actor_phone(); r mobile_intake.requests;
begin
 select * into r from mobile_intake.requests where id=p_id and user_id=auth.uid() and not is_test;
 if not found then raise exception 'Gönderim bulunamadı.' using errcode='42501'; end if;
 return jsonb_build_object('id',r.id,'status',r.status,'order_no',r.order_no,'message',r.result_message);
end $$;
create function mobile_intake.claim(p_id uuid default null) returns table(id uuid,message text,seller_phone text,claim_token uuid) language plpgsql security definer set search_path='' as $$
begin
 if p_id is null then return;end if;
 update mobile_intake.requests set status='failed',result_message='İşlem zaman aşımına uğradı. Mesajı yeniden gönderebilirsiniz.' where mobile_intake.requests.id=p_id and status='processing' and claimed_at<now()-interval '5 minutes';
 return query with picked as (select r.id from mobile_intake.requests r where r.status='pending' and r.id=p_id order by r.created_at limit 1 for update skip locked)
 update mobile_intake.requests r set status='processing',claimed_at=now(),claim_token=gen_random_uuid() from picked where r.id=picked.id returning r.id,r.message,r.seller_phone,r.claim_token;
end $$;
create function mobile_intake.finish(p_id uuid,p_token uuid,p_data jsonb,p_error text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r mobile_intake.requests; d jsonb:=p_data; o public.tum_siparisler; reason text; kg text; cnt integer;
begin
 select * into r from mobile_intake.requests where id=p_id for update;
 if not found then raise exception 'Gönderim bulunamadı.'; end if;
 if r.status='completed' then return jsonb_build_object('status',r.status,'order_no',r.order_no); end if;
 if r.status<>'processing' or r.claim_token is distinct from p_token then raise exception 'Geçersiz işlem kilidi.'; end if;
 if p_error is not null then reason:='Sipariş işlenemedi. Mesajı yeniden gönderebilirsiniz.';
 elsif d->>'Siparis' is distinct from 'Evet' or coalesce((d->>'teknik_hata')::boolean,false) then reason:=coalesce(nullif(d->>'notlar',''),'Mesajdaki sipariş bilgilerini kontrol edip yeniden gönderin.');
 elsif nullif(btrim(d->>'musteri_ad_soyad'),'') is null or public.seller_normalize_phone(d->>'musteri_telefon') is null or nullif(btrim(d->>'adres'),'') is null or nullif(btrim(d->>'Sehir'),'') is null or nullif(btrim(d->>'ilce'),'') is null or jsonb_typeof(d->'urunler') is distinct from 'array' or jsonb_array_length(d->'urunler')=0 then reason:='Müşteri adı, telefonu, adres/teslim yeri, il, ilçe ve ürün bilgisi gerekli.';
 elsif coalesce(d->>'toplam','') !~ '^\d+(\.\d{1,2})?$' then reason:='Sipariş tutarı eksik veya geçersiz.';
 elsif coalesce(d->>'kargo_adet','') !~ '^([1-9]|[1-9][0-9]|100)$' then reason:='Paket adedi geçersiz.';
 else
  cnt:=(d->>'kargo_adet')::integer; kg:=d->>'kargo_kg';
  if coalesce(kg,'') !~ '^\d+(\.\d+)?(\+\d+(\.\d+)?)*$' or cardinality(string_to_array(kg,'+'))<>cnt or exists(select 1 from unnest(string_to_array(kg,'+')) v where v::numeric<=0) then reason:='Paket kilogramları ve adedi uyuşmuyor.'; end if;
 end if;
 if reason is not null then
  update mobile_intake.requests set status=case when p_error is null then 'rejected' else 'failed' end,result_message=left(reason,2000),parsed=d where id=r.id;
  return jsonb_build_object('status',case when p_error is null then 'rejected' else 'failed' end,'message',left(reason,2000));
 end if;
 if not r.is_test then
  begin
   perform set_config('search_path','public,extensions,pg_catalog',true);
   insert into public.tum_siparisler(siparis_alan,siparis_tel,ad_soyad,musteri_tel,adres,sehir,ilce,urun_bilgisi,toplam_tutar,odeme_sekli,notlar,firma,kargo_adet,kargo_kg,kargo_durumu,siparis_sekli,whatsapp_message_text,subeden_teslim,teslim_subesi,teslim_sekli_kontrol)
   values(r.seller_phone,r.seller_phone,d->>'musteri_ad_soyad',right(public.seller_normalize_phone(d->>'musteri_telefon'),10),d->>'adres',d->>'Sehir',d->>'ilce',(select string_agg(v,E'\n') from jsonb_array_elements_text(d->'urunler') v),d->>'toplam',d->>'odeme_yontemi',d->>'notlar','Gazi',cnt::text,kg,'Bekliyor','Mobil',r.message,coalesce((d->>'subeden_teslim')::boolean,false),nullif(d->>'teslim_subesi',''),coalesce((d->>'teslim_sekli_kontrol')::boolean,false)) returning * into o;
   if o.sehir_kodu is null or o.ilce_kodu is null then raise exception 'İl veya ilçe eşleşmedi. Mesajdaki il ve ilçeyi kontrol edin.'; end if;
   insert into public.gazi_siparisler_giris(siparis_no,firma) values(o.siparis_no,'Gazi');
   if not exists(select 1 from public.gazi_siparisler where siparis_no=o.siparis_no and public.seller_owner_phone(siparis_alan,siparis_tel)=r.seller_phone) then raise exception 'Sipariş kaydı doğrulanamadı.'; end if;
  exception when others then
   update mobile_intake.requests set status='failed',parsed=d,result_message=case when sqlerrm like 'İl veya ilçe%' then sqlerrm else 'Sipariş kaydedilemedi. Mesajı kontrol edip yeniden gönderin.' end where id=r.id;
   return jsonb_build_object('status','failed');
  end;
 end if;
 update mobile_intake.requests set status='completed',order_no=o.siparis_no,parsed=d,result_message=case when r.is_test then 'Test doğrulandı; sipariş oluşturulmadı.' else 'Sipariş sisteme girildi.' end where id=r.id;
 return jsonb_build_object('status','completed','order_no',o.siparis_no,'is_test',r.is_test);
end $$;
revoke all on all functions in schema mobile_intake from public,anon,authenticated;
grant execute on function mobile_intake.submit(uuid,text),mobile_intake.status(uuid) to authenticated;
grant execute on function mobile_intake.claim(uuid),mobile_intake.finish(uuid,uuid,jsonb,text) to service_role;
create function public.mobile_order_submit(p_id uuid,p_message text) returns jsonb language sql security invoker set search_path='' as $$ select mobile_intake.submit(p_id,p_message); $$;
create function public.mobile_order_status(p_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select mobile_intake.status(p_id); $$;
create function public.mobile_order_claim(p_id uuid default null) returns table(id uuid,message text,seller_phone text,claim_token uuid) language sql security invoker set search_path='' as $$ select * from mobile_intake.claim(p_id); $$;
create function public.mobile_order_finish(p_id uuid,p_token uuid,p_data jsonb,p_error text default null) returns jsonb language sql security invoker set search_path='' as $$ select mobile_intake.finish(p_id,p_token,p_data,p_error); $$;
revoke all on function public.mobile_order_submit(uuid,text),public.mobile_order_status(uuid),public.mobile_order_claim(uuid),public.mobile_order_finish(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.mobile_order_submit(uuid,text),public.mobile_order_status(uuid) to authenticated;
grant execute on function public.mobile_order_claim(uuid),public.mobile_order_finish(uuid,uuid,jsonb,text) to service_role;
