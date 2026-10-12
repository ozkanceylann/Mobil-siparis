import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const reply = (status:number, data:unknown) => new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
const normalize = (value:string) => {
 const d=value.replace(/\D/g,'');
 if(/^05\d{9}$/.test(d)) return d;
 if(/^5\d{9}$/.test(d)) return '0'+d;
 if(/^905\d{9}$/.test(d)) return '0'+d.slice(2);
 if(/^00905\d{9}$/.test(d)) return '0'+d.slice(4);
 return null;
};

Deno.serve(async (req:Request) => {
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers:cors});
 if(req.method!=='POST') return reply(405,{error:'Yalnızca POST desteklenir.'});
 try {
  const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');
  if(!token) return reply(401,{error:'Oturum gerekli.'});
  const url=Deno.env.get('SUPABASE_URL')!;
  const service=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await service.auth.getUser(token);
  if(authError||!user) return reply(401,{error:'Oturum geçersiz.'});
  if(user.app_metadata.firma!=='gazi'||user.app_metadata.role==='seller') return reply(403,{error:'Yönetici yetkisi gerekli.'});
  const body=await req.json();
  const phone=typeof body.phone==='string'?normalize(body.phone):null;
  if(!phone||!['create','reset','disable','enable'].includes(body.action)) return reply(400,{error:'Telefon ve işlem bilgilerini kontrol edin.'});
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false}});
  const {data:candidates,error:candidateError}=await caller.rpc('seller_admin_candidates');
  if(candidateError) return reply(500,{error:'Satıcı listesi alınamadı.'});
  const candidate=candidates.find((c:{phone:string})=>c.phone===phone);
  if(!candidate) return reply(400,{error:'Bu telefonla eşleşen sipariş bulunmuyor.'});
  const alias=phone+'@satici.ozkanceylan.uk';
  if(body.action==='create'||body.action==='reset') {
   if(typeof body.password!=='string'||body.password.length<12||body.password.length>128) return reply(400,{error:'Şifre 12–128 karakter olmalı.'});
  }
  if(body.action==='create') {
   if(candidate.user_id) return reply(409,{error:'Bu satıcının hesabı zaten var.'});
   const {error}=await service.auth.admin.createUser({email:alias,password:body.password,email_confirm:true,app_metadata:{role:'seller',firma:'seller',seller_phone:phone}});
   if(error) return reply(400,{error:'Hesap oluşturulamadı. Telefonun daha önce kayıtlı olmadığını kontrol edin.'});
  } else {
   if(!candidate.user_id) return reply(404,{error:'Önce satıcı hesabı oluşturun.'});
   const {data:existing,error:lookupError}=await service.auth.admin.getUserById(candidate.user_id);
   if(lookupError||existing.user?.app_metadata.role!=='seller'||normalize(existing.user.app_metadata.seller_phone||'')!==phone) return reply(403,{error:'Hesap doğrulanamadı.'});
   const attributes=body.action==='reset'?{password:body.password}:body.action==='disable'?{ban_duration:'876000h'}:{ban_duration:'none'};
   const {error}=await service.auth.admin.updateUserById(candidate.user_id,attributes);
   if(error) return reply(400,{error:'Hesap güncellenemedi.'});
  }
  return reply(200,{ok:true,phone,action:body.action});
 } catch {
  return reply(400,{error:'İşlem tamamlanamadı. Girdiğiniz bilgileri kontrol edin.'});
 }
});
