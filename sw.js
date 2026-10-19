const CACHE='siparis-static-v24-order-receipts';
const STATIC=['./','index.html','style.css','app.js','customer-order-history.js','order-receipts.js','order-receipts.css','branch-selector.js','updates.js','config.js','cargo-weights.js','manifest.webmanifest','assets/supabase.js','assets/siparis-takip-mobile.svg','assets/siparis-takip-mobile-180.png','assets/siparis-takip-mobile-192.png','assets/siparis-takip-mobile-512.png'];
const ROOT=new URL('./',self.location.href);
const PATHS=new Set(STATIC.map(p=>new URL(p,ROOT).pathname));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC.map(p=>new Request(new URL(p,ROOT),{cache:'no-store'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('siparis-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll({type:'window'})).then(clients=>clients.forEach(c=>c.postMessage({type:'APP_UPDATED'})))));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==ROOT.origin||!PATHS.has(url.pathname))return;
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(new Request(new URL(url.pathname,ROOT)),copy)));}
  return response;
 }).catch(()=>caches.open(CACHE).then(c=>c.match(event.request,{ignoreSearch:true}))));
});

