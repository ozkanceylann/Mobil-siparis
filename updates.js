'use strict';
(()=>{
 const root=new URL('./',location.href),key='siparis-release:'+root.pathname;
 const dirty=new WeakSet();
 let registration,checking=false,pending=null,reloading=false,announced=false;
 let current;try{current=sessionStorage.getItem(key);}catch{}
 current=current||new URL(location.href).searchParams.get('updated');
 document.addEventListener('input',e=>{if(e.target.form)dirty.add(e.target.form);},true);
 document.addEventListener('reset',e=>dirty.delete(e.target),true);
 function applyUpdate(){
  if(!pending||reloading||!navigator.onLine||document.visibilityState==='hidden')return;
  const editing=[...document.querySelectorAll('form')].some(f=>dirty.has(f)||f.querySelector('button[type="submit"]:disabled'));
  if(editing){if(!announced){announced=true;const t=document.getElementById('toast');if(t){t.textContent='Yeni sürüm hazır. İşlemini bitirince uygulama güncellenecek.';t.classList.add('show');}}return;}
  try{sessionStorage.setItem(key,pending);}catch{}
  reloading=true;
  const url=new URL(location.href);url.searchParams.set('updated',pending);
  location.replace(url.href);
 }
 async function fingerprint(){
  const sources=await Promise.all(['index.html','app.js','mobile-order-intake.js','viewport-lock.css','viewport-lock.js','style.css','updates.js'].map(async path=>{
   const response=await fetch(new URL(path,root),{cache:'no-store'});
   if(!response.ok)throw Error('Update unavailable');
   return response.text();
  }));
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(sources.join('\n')));
  return Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('');
 }
 async function checkRelease(){
  if(checking||!navigator.onLine||document.visibilityState==='hidden')return;
  checking=true;
  try{
   const latest=await fingerprint();
   // On the first launch refresh once, so previously cached assets also migrate.
   if(latest!==current)pending=latest;
   await registration?.update().catch(()=>{});
   applyUpdate();
  }catch{}finally{checking=false;}
 }
 if('serviceWorker'in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',checkRelease);
  navigator.serviceWorker.addEventListener('message',e=>{if(e.data?.type==='APP_UPDATED')checkRelease();});
  navigator.serviceWorker.register(new URL('sw.js',root),{updateViaCache:'none'}).then(r=>{registration=r;checkRelease();}).catch(()=>{});
 }
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')checkRelease();});
 window.addEventListener('focus',checkRelease);
 window.addEventListener('online',checkRelease);
 document.addEventListener('click',()=>setTimeout(applyUpdate,300));
 setInterval(checkRelease,60000);
 checkRelease();
})();
