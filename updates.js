'use strict';
(()=>{
 const current=document.querySelector('meta[name="app-version"]')?.content;
 if(!current||current==='__RELEASE__')return;
 const root=new URL('./',location.href);
 const dirty=new WeakSet();
 let registration,checking=false,pending=null,reloading=false,announced=false;
 document.addEventListener('input',e=>{if(e.target.form)dirty.add(e.target.form);},true);
 document.addEventListener('reset',e=>dirty.delete(e.target),true);
 function applyUpdate(){
  if(!pending||reloading||!navigator.onLine||document.visibilityState==='hidden')return;
  const editing=[...document.querySelectorAll('form')].some(f=>dirty.has(f)||f.querySelector('button[type="submit"]:disabled'));
  if(editing){if(!announced){announced=true;const t=document.getElementById('toast');if(t){t.textContent='Yeni sürüm hazır. İşlemini bitirince uygulama güncellenecek.';t.classList.add('show');}}return;}
  reloading=true;
  const url=new URL(location.href);url.searchParams.set('v',pending);
  location.replace(url.href);
 }
 async function checkRelease(){
  if(checking||!navigator.onLine||document.visibilityState==='hidden')return;
  checking=true;
  try{
   const url=new URL('version.json',root);url.searchParams.set('_',Date.now());
   const response=await fetch(url,{cache:'no-store'});
   if(response.ok){const data=await response.json();if(/^[a-f0-9]{40}$/.test(data.version)&&data.version!==current)pending=data.version;}
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
