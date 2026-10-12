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
