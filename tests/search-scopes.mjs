import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const elements=Object.fromEntries(['orders','pagination','result-count','search-scope','search','tab-search'].map(id=>[id,{id,innerHTML:'',textContent:'',value:''}]));
const handlers={},calls=[];let scheduled;
const fixtures=[{siparis_no:1,status:'pending',ad_soyad:'Test'},{siparis_no:2,status:'delivered',ad_soyad:'Test'}];
const ctx=vm.createContext({
 S:{user:{},tab:'orders',filter:'pending',search:'',tabSearch:'',request:0,orders:[]},
 labels:{pending:'Bekleyen',delivered:'Teslim',all:'Tümü'},
 navigator:{onLine:true},document:{activeElement:elements.search,getElementById:id=>elements[id],addEventListener:(type,fn)=>handlers[type]=fn},
 db:{rpc:async(name,body)=>{calls.push({name,body});const orders=fixtures.filter(o=>body.p_filter==='all'||o.status===body.p_filter).slice(body.p_offset);return {data:{orders,total:orders.length,counts:{all:2}}};}},
 markExtras:()=>{},hydrateExtras:async()=>{},app:{},loadCustomerNoteIcons:async()=>{},CustomerOrderHistory:{load:async()=>{}},OrderReceipts:{load:async()=>{}},card:o=>String(o.siparis_no),pagination:()=>'<button>More</button>',renderShell:()=>{},toast:()=>{},
 setTimeout:fn=>{scheduled=fn;return 1;},clearTimeout:()=>{scheduled=null;}
});
vm.runInContext('let searchTimer;'+source.slice(source.indexOf('function searchScope()'),source.indexOf('async function loadOrders(append=false)')),ctx);
// Use the actual request function and actual input/tab/filter handlers.
const loadStart=source.indexOf('async function loadOrders(append=false)');
vm.runInContext(source.slice(loadStart,source.indexOf('\nfunction accountMarkup',loadStart)),ctx);
for(const type of ['input','click']){
 const start=source.indexOf("document.addEventListener('"+type+"',");
 vm.runInContext(source.slice(start,source.indexOf('\n',start)),ctx);
}
async function input(id,value){elements[id].value=value;ctx.document.activeElement=elements[id];handlers.input({target:elements[id]});await scheduled();}
for(const admin of [false,true]){
 ctx.S.admin=admin;ctx.S.filter='pending';
 await input('search','Test');
 assert.equal(calls.at(-1).name,admin?'admin_orders':'seller_orders');
 assert.equal(calls.at(-1).body.p_filter,'all');
 assert.equal(ctx.S.orders.length,2,'Global search includes another status');
 assert.equal(ctx.S.filter,'pending','Original filter is preserved');
 assert.equal(elements['search-scope'].textContent,'Arama sonuçları · Tüm siparişler');
 await vm.runInContext('loadOrders(true)',ctx);
 assert.equal(calls.at(-1).body.p_offset,2);assert.equal(calls.at(-1).body.p_filter,'all');
 await input('tab-search','Test');
 assert.equal(elements.search.value,'');assert.equal(ctx.S.search,'');
 assert.equal(calls.at(-1).body.p_filter,'pending');assert.equal(calls.at(-1).body.p_offset,0);
 assert.equal(ctx.S.orders.length,1,'Tab search stays in selected filter');
 await input('search','Test');assert.equal(elements['tab-search'].value,'');
 await input('search','  ');assert.equal(calls.at(-1).body.p_filter,'pending');assert.equal(calls.at(-1).body.p_search,'');
 await input('search','Test');
 await handlers.click({target:{closest:selector=>selector.startsWith('a.')?null:{dataset:{filter:'delivered'}}}});
 assert.equal(ctx.S.search,'');assert.equal(ctx.S.tabSearch,'');assert.equal(calls.at(-1).body.p_filter,'delivered');
}
ctx.S.filter='in_transit';assert.equal(vm.runInContext('searchScope()',ctx),'Seçili sekme · Kargoda');
// Changing the input invalidates an earlier response immediately, before debounce.
let resolve;ctx.db.rpc=()=>new Promise(r=>resolve=r);
const pending=vm.runInContext('loadOrders()',ctx);const previous=ctx.S.orders;
handlers.input({target:{id:'search',value:'new'}});
resolve({data:{orders:[],counts:{},total:0}});await pending;assert.equal(ctx.S.orders,previous);
assert.match(source,/class="search-fields"/);assert.match(source,/aria-label="Seçili sekmede ara"/);
console.log('PASS global/tab search, role routes, pagination, clear/filter reset and stale-response protection');
