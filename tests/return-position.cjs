const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');
const block=source.slice(source.indexOf('async function loadOrders('),source.indexOf('\nfunction accountMarkup'));
function setup(){
 const elements={orders:{innerHTML:''}},calls=[];
 let rows=Array.from({length:65},(_,i)=>({siparis_no:100-i,status:'support',kargo_gunc_saat:'old'})),renders=0,scrolls=0;
 const c=vm.createContext({S:{user:{id:'seller'},admin:false,tab:'shipments',filter:'support',search:'',tabSearch:'',orders:[],request:0},sheet:{open:false},navigator:{onLine:true},document:{visibilityState:'visible',activeElement:null,getElementById:id=>elements[id]},window:{scrollTo:()=>scrolls++},app:{},console,toast:()=>{},errText:()=>'',esc:x=>x,markExtras:list=>list.forEach(o=>{o._extrasToken=123;o.receipts=[];}),hydrateExtras:()=>{},renderShell:()=>{renders++;elements.orders.innerHTML='rendered';},db:{rpc:async(name,args)=>{calls.push(args.p_offset);return {data:{orders:JSON.parse(JSON.stringify(rows.slice(args.p_offset,args.p_offset+30))),total:rows.length,counts:{}}};}}});
 vm.runInContext(source.slice(source.indexOf('function missingPendingNotice('),source.indexOf('function overview(')),c);
 vm.runInContext(block,c);
 return {c,elements,calls,run:code=>vm.runInContext(code,c),rows,renderCount:()=>renders,scrollCount:()=>scrolls};
}
(async()=>{
 let t=setup();await t.run('loadOrders();');await t.run('loadOrders(true);');
 let existing=t.c.S.orders;
 t.rows.forEach(o=>o.kargo_gunc_saat='new');
 await t.run('checkOrdersOnReturn()');
 assert.equal(t.c.S.orders,existing,'unchanged records preserve the loaded list object and display state');
 assert.equal(t.renderCount(),2);assert.equal(t.scrollCount(),0);assert.deepEqual(t.calls,[0,30,0,30]);
 t.rows[40].status='delivered';await t.run('checkOrdersOnReturn()');
 assert.equal(t.renderCount(),3,'a change on the second loaded page reloads');assert.equal(t.scrollCount(),1);assert.equal(t.c.S.orders.length,30);
 t=setup();await t.run('loadOrders()');t.rows.unshift({siparis_no:101,status:'support'});await t.run('checkOrdersOnReturn()');assert.equal(t.scrollCount(),1,'new records reset to top');
 t=setup();await t.run('loadOrders()');t.c.db.rpc=async()=>({error:{message:'offline'}});await t.run('checkOrdersOnReturn()');assert.equal(t.renderCount(),1);assert.equal(t.scrollCount(),0,'errors leave the list intact');
 t=setup();await t.run('loadOrders()');let resolve;t.c.db.rpc=()=>new Promise(r=>resolve=r);const pending=t.run('checkOrdersOnReturn()');t.c.S.request++;t.c.S.filter='all';resolve({data:{orders:[],total:0}});await pending;assert.equal(t.renderCount(),1,'stale response cannot reset a newer screen');
 t=setup();await t.run('loadOrders()');t.c.sheet.open=true;await t.run('checkOrdersOnReturn()');assert.equal(t.calls.length,1,'open details remain undisturbed');
 console.log('PASS: unchanged multi-page list, polling timestamp, second-page edit, new record, network error, stale request and open detail');
})().catch(error=>{console.error(error);process.exitCode=1;});
