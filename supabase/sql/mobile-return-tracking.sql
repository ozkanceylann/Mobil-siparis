-- Return tracking is shared by mobile and operations; shipment cancellation remains operations-only.
do $$ declare v text; begin
v:=pg_get_functiondef('public.seller_order_safe(public.gazi_siparisler)'::regprocedure);
if position('iade_hareketleri' in v)=0 then
v:=replace(v,'''iade_tarihi'',o.iade_tarihi,','''iade_tarihi'',o.iade_tarihi,''iade_takip_kodu'',o.iade_takip_kodu,''iade_teslim_tarihi'',o.iade_teslim_tarihi,''iade_hareketleri'',o.iade_hareketleri,''iade_takip_hatasi'',o.iade_takip_hatasi,');
execute v; end if; end $$;
do $$ declare v text; f regprocedure; begin
foreach f in array array['public.admin_orders(text,text,integer)'::regprocedure,'public.seller_orders(text,text,integer)'::regprocedure] loop
v:=pg_get_functiondef(f);
if position('iade_teslim_tarihi' in v)=0 then
v:=replace(v,'as parcel_count,siparis_no','as parcel_count,iade_teslim_tarihi,iade_tarihi,siparis_no');
v:=replace(v,'order by split_sort desc','order by case when p_filter in (''return_label'',''cargo_returns'') then (iade_teslim_tarihi is not null)::integer else 0 end asc,case when p_filter in (''return_label'',''cargo_returns'') then coalesce(iade_teslim_tarihi,iade_tarihi) end desc nulls last,split_sort desc');
v:=replace(v,'order by coalesce(o.bolunme_ana_siparis_no','order by case when p_filter in (''return_label'',''cargo_returns'') then (o.iade_teslim_tarihi is not null)::integer else 0 end asc,case when p_filter in (''return_label'',''cargo_returns'') then coalesce(o.iade_teslim_tarihi,o.iade_tarihi) end desc nulls last,coalesce(o.bolunme_ana_siparis_no');
v:=replace(v,'order by coalesce((o).bolunme_ana_siparis_no','order by case when p_filter in (''return_label'',''cargo_returns'') then ((o).iade_teslim_tarihi is not null)::integer else 0 end asc,case when p_filter in (''return_label'',''cargo_returns'') then coalesce((o).iade_teslim_tarihi,(o).iade_tarihi) end desc nulls last,coalesce((o).bolunme_ana_siparis_no');
execute v;
end if; end loop; end $$;