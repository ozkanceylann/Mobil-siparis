import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const app={innerHTML:''},sheet={innerHTML:'',showModal(){}};
const context=vm.createContext({
 window:{APP_CONFIG:{},addEventListener(){}},
 supabase:{createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}})},
 document:{getElementById:id=>id==='app'?app:sheet,addEventListener(){}},
 navigator:{onLine:true},matchMedia:()=>({matches:false})
});
vm.runInContext(readFileSync(new URL('../app.js',import.meta.url),'utf8'),context);
context.order={siparis_no:1,status:'shipped',kargo_adet:'2',shipmentStatus:'Transfer_Aşamasında',kargo_takip_kodu:'123',kargo_hareketleri:[
 {eventStatus:'Gönderi Hazırlandı',eventDateTime:'12.10.2026 09:00:00',eventDateTime2:'2026-10-12 09:00:00'},
 {eventStatus:'Şubeden Çıkış',eventDateTime:'12.10.2026 13:00:00',eventDateTime2:'2026-10-12 13:00:00'},
 {eventStatus:'<script>alert(1)</script>',eventDateTime:'12.10.2026 12:00:00',eventDateTime2:'2026-10-12 12:00:00'}
]};
const events=vm.runInContext('trackingEvents(order)',context);
assert.equal(events[0].eventStatus,'Şubeden Çıkış');
assert.equal(events[2].eventStatus,'Gönderi Hazırlandı');
const html=vm.runInContext('card(order)',context);
assert.match(html,/2 paket/);
assert.match(html,/<details class="tracking"><summary>/);
assert.match(html,/Transfer Aşamasında/);
assert.ok(html.indexOf('Şubeden Çıkış')<html.indexOf('Gönderi Hazırlandı'));
assert.doesNotMatch(html,/<script>/);
assert.match(html,/&lt;script&gt;/);
assert.ok(html.indexOf('</button>')<html.indexOf('<details'),'Tracking must open independently of order detail');
context.order={...context.order,status:'problem',shipmentStatus:'Geri_Geliyor',kargo_hareketleri:[]};
assert.equal(vm.runInContext('orderLabel(order)',context),'İade');
assert.match(vm.runInContext('trackingMarkup(order)',context),/henüz sisteme gelmedi/);
vm.runInContext('S.counts={all:14,problem:3}',context);
assert.match(vm.runInContext('overview()',context),/data-filter="problem"[^]*<strong>3<\/strong>/);
vm.runInContext('renderLogin()',context);
assert.match(app.innerHTML,/-Oz Yazılım-/);
console.log('PASS: package count, independent tracking disclosure, latest-first history, XSS escaping, returns, problem count and signature.');
context.order={status:'problem',shipmentStatus:'Teslim_Edilemedi',kargo_takip_kodu:'123',kargo_hareketleri:[
 {eventStatus:'Gönderi Hazırlandı',eventDateTime2:'2026-10-10 10:00:00',locationAddress:'AKHİSAR Şube',locationPhone:'0236 414 13 50 - 413 91 09'},
 {eventStatus:'Transfer Aşamasında',eventDateTime2:'2026-10-11 10:00:00',locationAddress:'İZMİR AKTARMA',locationPhone:'0232 486 86 63'},
 {eventStatus:'Gönderi Varış Birimine Ulaştı',eventDateTime2:'2026-10-12 09:00:00',locationAddress:'NARLIDERE Şube',locationPhone:'0232 239 06 99 - 239 46 99'},
 {eventStatus:'Teslim Edilemedi',eventDateTime2:'2026-10-12 13:00:00',locationAddress:'NARLIDERE Şube',locationPhone:null}
]};
let contactHtml=vm.runInContext('trackingMarkup(order)',context);
assert.equal((contactHtml.match(/href="tel:/g)||[]).length,1,'Only one branch contact');
assert.match(contactHtml,/href="tel:\+902322390699"/);
assert.doesNotMatch(contactHtml,/0236 414|0232 486/);
assert.ok(contactHtml.indexOf('tel:')<contactHtml.indexOf('Gönderi Varış'),'Phone on latest destination event');
context.order.kargo_hareketleri=context.order.kargo_hareketleri.slice(0,2);
assert.doesNotMatch(vm.runInContext('trackingMarkup(order)',context),/href="tel:/,'No source or hub phone before destination arrival');
assert.equal(vm.runInContext('branchPhone("javascript:alert(1)")',context),null);
console.log('PASS: destination-only contact, one occurrence, latest branch event, missing-phone fallback, safe Turkish landline dial link.');
