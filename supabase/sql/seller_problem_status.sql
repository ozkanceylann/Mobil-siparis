CREATE OR REPLACE FUNCTION public.seller_order_status(durum text, delivered boolean, code smallint, tracking_status text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO ''
AS $function$
select case when durum='İptal' then 'cancelled'
when code in (6,7,8) or translate(lower(translate(replace(concat_ws(' ',durum,tracking_status),'_',' '),'İ','I')),'ıİşğüöç','iisguoc') ~ '(sorun|problem|exception|teslim edilem|geri gel|geri don|iade|return|undeliver|not delivered|delivery fail)' then 'problem'
when replace(lower(coalesce(tracking_status,'')),'_',' ') ~ '(teslim edildi|delivered)' then 'delivered'
else public.seller_order_status(durum,delivered,code) end;
$function$;
