-- Satıcılar yalnızca kendi telefonlarına tanımlanan adı okuyabilir.
-- Yönetici okuma politikası ve sipariş erişim kuralları değişmez.
create policy seller_read_own_order_taker_name
on public.gazi_order_takers for select to authenticated
using (phone = (select '90' || substr(public.seller_current_phone(),2)));
