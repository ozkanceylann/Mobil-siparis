do $do$
declare definition text;
begin
 definition:=pg_get_functiondef('public.seller_tracking_events(text)'::regprocedure);
 definition:=replace(definition,'''locationAddress'',e->>''locationAddress''','''locationAddress'',e->>''locationAddress'',''locationPhone'',e->>''locationPhone''');
 execute definition;
end $do$;
