begin;
CREATE OR REPLACE FUNCTION public.seller_order_safe(o gazi_siparisler)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select jsonb_build_object('siparis_no',o.siparis_no,'ad_soyad',o.ad_soyad,'musteri_tel',o.musteri_tel,'adres',o.adres,'sehir',o.sehir,'ilce',o.ilce,'sehir_kodu',o.sehir_kodu,'ilce_kodu',o.ilce_kodu,'urun_bilgisi',o.urun_bilgisi,'toplam_tutar',o.toplam_tutar,'odeme_sekli',o.odeme_sekli,'notlar',o.notlar,'kargo_adet',o.kargo_adet,'kargo_kg',o.kargo_kg,'siparis_alan',o.siparis_alan,'subeden_teslim',o.subeden_teslim,'teslim_subesi',o.teslim_subesi,'teslim_sekli_kontrol',o.teslim_sekli_kontrol,'tarih',o.tarih,'kargo_durumu',o.kargo_durumu,'status',public.seller_order_phase(o),'shipmentStatus',o."shipmentStatus",'kargo_takip_kodu',o.kargo_takip_kodu,'kargo_takip_url',o.kargo_takip_url,'kargo_gunc_saat',o.kargo_gunc_saat,'teslimat_aciklama',o.teslimat_aciklama,'iptal_nedeni',o.iptal_nedeni,'iade_kodu',o.iade_kodu,'iade_etiket_url',o.iade_etiket_url,'iade_durumu',o.iade_durumu,'iade_tarihi',o.iade_tarihi,'kargo_hareketleri',public.seller_tracking_events(o.kargo_api_yanit));
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_order(p_id integer, p_changes jsonb, p_original jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o public.gazi_siparisler; updated public.gazi_siparisler; c text; d text; city text; district text;
 allowed text[]:=array['ad_soyad','musteri_tel','adres','sehir','ilce','sehir_kodu','ilce_kodu','urun_bilgisi','toplam_tutar','odeme_sekli','notlar','kargo_adet','kargo_kg','subeden_teslim','teslim_subesi','teslim_sekli_kontrol'];
begin
 if not public.seller_is_gazi_admin() then raise exception 'Yönetici erişimi gerekli.' using errcode='42501'; end if;
 select * into o from public.gazi_siparisler where siparis_no=p_id for update;
 if not found or o.kargo_durumu is distinct from 'Bekliyor' or public.seller_order_status(o.kargo_durumu,o."isDelivered",o."shipmentStatusCode",o."shipmentStatus") is distinct from 'pending' then raise exception 'Yalnızca hazırlanmamış bekleyen siparişleri düzenleyebilirsiniz.' using errcode='42501'; end if;
 if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k where not(k=any(allowed))) then raise exception 'Geçersiz düzenleme alanı.'; end if;
 if p_original is distinct from public.seller_order_safe(o) then raise exception 'Sipariş başka bir işlemde güncellendi. Yeniden açıp deneyin.' using errcode='40001'; end if;
 if exists(select 1 from jsonb_each(p_changes) where (case when key in ('subeden_teslim','teslim_sekli_kontrol') then jsonb_typeof(value) <> 'boolean' else jsonb_typeof(value) not in ('string','null') end) or length(value#>>'{}')>2000) then raise exception 'Geçersiz alan uzunluğu veya türü.'; end if;
 updated:=jsonb_populate_record(o,p_changes);
 if p_changes ? 'teslim_subesi' and length(coalesce(updated.teslim_subesi,''))>150 then raise exception 'Şube adı çok uzun.'; end if;
 if p_changes ? 'subeden_teslim' then
  if updated.subeden_teslim then
   if trim(coalesce(updated.teslim_subesi,''))='' then raise exception 'Teslim alınacak DHL şubesini seçin.'; end if;
  else updated.teslim_subesi:=null;
  end if;
  updated.teslim_sekli_kontrol:=false;
 end if;
 if trim(coalesce(updated.ad_soyad,''))='' or trim(coalesce(updated.adres,''))='' or trim(coalesce(updated.urun_bilgisi,''))='' or public.seller_normalize_phone(updated.musteri_tel) is null then raise exception 'Ad, telefon, adres ve ürün bilgilerini kontrol edin.'; end if;
 if coalesce(updated.toplam_tutar,'') !~ '^[0-9]+([.,][0-9]{1,2})?$' or replace(updated.toplam_tutar,',','.')::numeric<0 then raise exception 'Geçerli bir sipariş tutarı girin.'; end if;
 if coalesce(updated.kargo_adet,'') !~ '^[1-9][0-9]?$' then raise exception 'Paket adedi 1–99 olmalı.'; end if;
 if (p_changes ? 'sehir_kodu') or (p_changes ? 'ilce_kodu') then
  select name into city from public.sehir where id=updated.sehir_kodu;
  select name,code into district,d from public.ilce where city_id=updated.sehir_kodu and code=updated.ilce_kodu;
  if city is null or district is null then raise exception 'Şehir ve ilçe seçimini kontrol edin.'; end if;
  updated.sehir:=city; updated.ilce:=district;
 elsif updated.sehir is distinct from o.sehir or updated.ilce is distinct from o.ilce then raise exception 'Şehir ve ilçe kodları birlikte seçilmeli.';
 end if;
 update public.gazi_siparisler set ad_soyad=updated.ad_soyad,musteri_tel=updated.musteri_tel,adres=updated.adres,sehir=updated.sehir,ilce=updated.ilce,sehir_kodu=updated.sehir_kodu,ilce_kodu=updated.ilce_kodu,urun_bilgisi=updated.urun_bilgisi,toplam_tutar=updated.toplam_tutar,odeme_sekli=updated.odeme_sekli,notlar=updated.notlar,kargo_adet=updated.kargo_adet,kargo_kg=updated.kargo_kg,subeden_teslim=updated.subeden_teslim,teslim_subesi=updated.teslim_subesi,teslim_sekli_kontrol=updated.teslim_sekli_kontrol where siparis_no=p_id returning * into o;
 return public.seller_order_safe(o);
end; $function$;

CREATE OR REPLACE FUNCTION public.seller_update_pending(p_id integer, p_changes jsonb, p_original jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare o public.gazi_siparisler; updated public.gazi_siparisler; c text; d text; city text; district text;
 allowed text[]:=array['ad_soyad','musteri_tel','adres','sehir','ilce','sehir_kodu','ilce_kodu','urun_bilgisi','toplam_tutar','odeme_sekli','notlar','kargo_adet','kargo_kg','subeden_teslim','teslim_subesi','teslim_sekli_kontrol'];
begin
 if public.seller_current_phone() is null then raise exception 'Satıcı oturumu gerekli.' using errcode='42501'; end if;
 select * into o from public.gazi_siparisler where siparis_no=p_id and public.seller_owner_phone(siparis_alan,siparis_tel)=public.seller_current_phone() for update;
 if not found or o.kargo_durumu is distinct from 'Bekliyor' then raise exception 'Sipariş artık bekleyen aşamasında değil veya erişim izniniz yok.' using errcode='42501'; end if;
 if jsonb_typeof(p_changes) is distinct from 'object' or exists(select 1 from jsonb_object_keys(p_changes) k where not(k=any(allowed))) then raise exception 'Geçersiz düzenleme alanı.'; end if;
 if p_original is distinct from public.seller_order_safe(o) then raise exception 'Sipariş başka bir işlemde güncellendi. Yeniden açıp deneyin.' using errcode='40001'; end if;
 if exists(select 1 from jsonb_each(p_changes) where (case when key in ('subeden_teslim','teslim_sekli_kontrol') then jsonb_typeof(value) <> 'boolean' else jsonb_typeof(value) not in ('string','null') end) or length(value#>>'{}')>2000) then raise exception 'Geçersiz alan uzunluğu veya türü.'; end if;
 updated:=jsonb_populate_record(o,p_changes);
 if p_changes ? 'teslim_subesi' and length(coalesce(updated.teslim_subesi,''))>150 then raise exception 'Şube adı çok uzun.'; end if;
 if p_changes ? 'subeden_teslim' then
  if updated.subeden_teslim then
   if trim(coalesce(updated.teslim_subesi,''))='' then raise exception 'Teslim alınacak DHL şubesini seçin.'; end if;
  else updated.teslim_subesi:=null;
  end if;
  updated.teslim_sekli_kontrol:=false;
 end if;
 if trim(coalesce(updated.ad_soyad,''))='' or trim(coalesce(updated.adres,''))='' or trim(coalesce(updated.urun_bilgisi,''))='' or public.seller_normalize_phone(updated.musteri_tel) is null then raise exception 'Ad, telefon, adres ve ürün bilgilerini kontrol edin.'; end if;
 if coalesce(updated.toplam_tutar,'') !~ '^[0-9]+([.,][0-9]{1,2})?$' or replace(updated.toplam_tutar,',','.')::numeric<0 then raise exception 'Geçerli bir sipariş tutarı girin.'; end if;
 if coalesce(updated.kargo_adet,'') !~ '^[1-9][0-9]?$' then raise exception 'Paket adedi 1–99 olmalı.'; end if;
 if (p_changes ? 'sehir_kodu') or (p_changes ? 'ilce_kodu') then
  select name into city from public.sehir where id=updated.sehir_kodu;
  select name,code into district,d from public.ilce where city_id=updated.sehir_kodu and code=updated.ilce_kodu;
  if city is null or district is null then raise exception 'Şehir ve ilçe seçimini kontrol edin.'; end if;
  updated.sehir:=city; updated.ilce:=district;
 elsif updated.sehir is distinct from o.sehir or updated.ilce is distinct from o.ilce then raise exception 'Şehir ve ilçe kodları birlikte seçilmeli.';
 end if;
 update public.gazi_siparisler set ad_soyad=updated.ad_soyad,musteri_tel=updated.musteri_tel,adres=updated.adres,sehir=updated.sehir,ilce=updated.ilce,sehir_kodu=updated.sehir_kodu,ilce_kodu=updated.ilce_kodu,urun_bilgisi=updated.urun_bilgisi,toplam_tutar=updated.toplam_tutar,odeme_sekli=updated.odeme_sekli,notlar=updated.notlar,kargo_adet=updated.kargo_adet,kargo_kg=updated.kargo_kg,subeden_teslim=updated.subeden_teslim,teslim_subesi=updated.teslim_subesi,teslim_sekli_kontrol=updated.teslim_sekli_kontrol where siparis_no=p_id returning * into o;
 return public.seller_order_safe(o);
end; $function$;

commit;
