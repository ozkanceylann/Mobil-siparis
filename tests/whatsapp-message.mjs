import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context=vm.createContext({URL,window:{APP_CONFIG:{},addEventListener(){}},supabase:{createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}})},document:{getElementById:()=>({}),addEventListener(){}},navigator:{onLine:true},matchMedia:()=>({matches:false})});
vm.runInContext(readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
context.order={musteri_tel:'05550000000',status:'undelivered',shipmentStatus:'Teslim_Edilemedi',kargo_takip_kodu:'303030541320',kargo_hareketleri:[
 {eventStatus:'Gönderi Hazırlandı',eventDateTime2:'2026-10-10 10:00:00',locationAddress:'AKHİSAR Şube',locationPhone:'0236 414 13 50'},
 {eventStatus:'Varış birimine ulaştı',eventSequence:'3',eventDateTime2:'2026-10-12 09:00:00',locationAddress:'KUŞADASI Şube',locationPhone:'0256 123 45 67'},
 {eventStatus:'Teslim Edilemedi',eventDateTime2:'2026-10-12 13:00:00',locationAddress:'KUŞADASI Şube',locationPhone:null}
]};
const message=vm.runInContext('whatsappOrderMessage(order)',context);
assert.match(message,/Merhaba 👋/);assert.match(message,/🚚 DHL Kargo/);assert.match(message,/⚠️ Siparişiniz Teslim Edilemedi aşamasında/);
assert.match(message,/📍 Varış şubesi: KUŞADASI Şube/);assert.match(message,/☎️ Şube telefonu: 0256 123 45 67/);assert.doesNotMatch(message,/AKHİSAR|0236|�|\*/);
const html=vm.runInContext('whatsappContactMarkup(order)',context),href=html.match(/href="([^"]+)"/)[1].replaceAll('&amp;','&'),url=new URL(href);
assert.equal(url.origin,'https://api.whatsapp.com');assert.equal(url.pathname,'/send');assert.equal(url.searchParams.get('phone'),'905550000000');assert.equal(url.searchParams.get('text'),message);
context.order.status='arrived';assert.match(vm.runInContext('whatsappOrderMessage(order)',context),/Şube telefonu/);
context.order.status='shipped';assert.doesNotMatch(vm.runInContext('whatsappOrderMessage(order)',context),/Varış şubesi|Şube telefonu/);
context.order.status='undelivered';context.order.kargo_hareketleri=context.order.kargo_hareketleri.slice(0,1);assert.doesNotMatch(vm.runInContext('whatsappOrderMessage(order)',context),/Varış şubesi|Şube telefonu/);
context.order.kargo_hareketleri=[{eventStatus:'Varış Şubesinde',locationAddress:'KUŞADASI Şube'}];assert.match(vm.runInContext('whatsappOrderMessage(order)',context),/Varış şubesi: KUŞADASI/);assert.doesNotMatch(vm.runInContext('whatsappOrderMessage(order)',context),/Şube telefonu/);
console.log('PASS: emojis preserved in direct WhatsApp URL; destination branch and phone; no sender/hub phone; missing phone handled.');
console.log(message);
