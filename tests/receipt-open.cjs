const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('order-receipts.js','utf8');
const code=source.slice(source.indexOf('async function open(db,r,message)'),source.indexOf('async function mount('));
function fixture(blocked=false){
 const events=[],links=[],message={replaceChildren:a=>links.push(a)},preview={closed:false,opener:{},document:{title:'',body:{}},location:{replace:u=>events.push(['navigate',u])},close(){this.closed=true;events.push(['close']);}};
 let complete;
 const context=vm.createContext({URL,window:{open(){events.push(['open']);return blocked?null:preview;}},document:{createElement:tag=>({tag})}});
 vm.runInContext(code,context);
 const db={storage:{from:bucket=>{assert.equal(bucket,'order-receipts');return{createSignedUrl(path,expires){assert.equal(expires,120);events.push(['sign',path]);return new Promise(r=>complete=r);}};}}};
 return {events,links,message,preview,run:path=>context.open(db,{object_path:path},message),complete:r=>complete(r)};
}
(async()=>{
 for(const path of ['test/receipt.pdf','test/receipt.jpg']){
  const f=fixture();const result=f.run(path);
  assert.deepEqual(f.events,[['open'],['sign',path]],'Popup must be opened synchronously before signing starts');
  assert.equal(f.preview.opener,null);
  f.complete({data:{signedUrl:'https://receipts.test/'+path+'?token=test'}});await result;
  assert.equal(f.events.at(-1)[0],'navigate');assert.equal(f.links.length,0);
 }
 const blocked=fixture(true),pending=blocked.run('test/file.pdf');blocked.complete({data:{signedUrl:'https://receipts.test/file.pdf'}});await pending;
 assert.equal(blocked.links.length,1);assert.equal(blocked.links[0].href,'https://receipts.test/file.pdf');assert.equal(blocked.links[0].target,'_blank');assert.equal(blocked.links[0].rel,'noopener noreferrer');
 const closed=fixture(),closing=closed.run('test/file.pdf');closed.preview.closed=true;closed.complete({data:{signedUrl:'https://receipts.test/file.pdf'}});await closing;assert.equal(closed.links.length,1);
 for(const answer of [{error:Error('Signing failed')},{data:{signedUrl:'javascript:alert(1)'}},{data:{}}]){
  const f=fixture(),result=f.run('test/file.pdf');f.complete(answer);await assert.rejects(result);assert(f.preview.closed);assert.equal(f.links.length,0);
 }
 console.log('PASS: synchronous tab reservation, PDF/image paths, blocked/closed tab fallback and safe error cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
