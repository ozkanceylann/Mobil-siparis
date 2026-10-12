const CACHE='siparis-static-v1';
const STATIC=['./','index.html','style.css','app.js','config.js','manifest.webmanifest','assets/supabase.js','assets/icon.svg','assets/icon-192.png','assets/icon-512.png','assets/icon-maskable.png'];
const ROOT=new URL('./',self.location.href);
const PATHS=new Set(STATIC.map(p=>new URL(p,ROOT).href));
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('siparis-static-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET'||!PATHS.has(event.request.url)) return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));}
  return response;
 }).catch(()=>caches.match(event.request)));
});
