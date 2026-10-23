import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname+(req.url==='/'?'index.html':''));if(!path.startsWith(root+'/'))throw Error();const body=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[extname(path)]||'text/plain');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const origin='http://127.0.0.1:'+server.address().port;
const fixture={siparis_no:1200,ad_soyad:'Deneme Müşteri',musteri_tel:'05550000000',adres:'Deneme Mahallesi, Örnek Sokak 12',sehir:'İSTANBUL',ilce:'KADIKÖY',sehir_kodu:'34',ilce_kodu:'3401',urun_bilgisi:'Bakım seti · 2 ürün',toplam_tutar:'990',odeme_sekli:'Kapıda ödeme',notlar:'',kargo_adet:'1',kargo_kg:'1',tarih:'2026-10-12T12:00:00',kargo_durumu:'Bekliyor',status:'pending',shipmentStatus:null,kargo_takip_kodu:null,kargo_takip_url:null,kargo_gunc_saat:null,teslimat_aciklama:null,iptal_nedeni:null};
const shipped={...fixture,siparis_no:1199,ad_soyad:'Örnek Müşteri',status:'shipped',kargo_durumu:'Kargolandı',shipmentStatus:'Transfer aşamasında',kargo_takip_kodu:'123456789',kargo_takip_url:'https://www.dhl.com/tr-tr/home/tracking.html',kargo_gunc_saat:'12.10.2026 14:30'};
const errors=[];
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 let user,loginBody,updateBody,accountBody;
 const token=()=>[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id,role:'authenticated'})).toString('base64url'),'stub'].join('.');
 await page.route('https://jarsxtpqzqzhlshpmgot.supabase.co/**',async route=>{
  const url=new URL(route.request().url());const body=route.request().postDataJSON();let data;let status=200;
  if(url.pathname.endsWith('/token')){loginBody=body;user={id:'00000000-0000-0000-0000-000000000001',email:body.email,app_metadata:body.email.includes('@satici.')?{role:'seller',firma:'seller',seller_phone:'05000000001'}:{firma:'gazi'},user_metadata:{},aud:'authenticated',created_at:new Date().toISOString()};data={access_token:token(),refresh_token:'stub-refresh',expires_in:3600,token_type:'bearer',user};}
  else if(url.pathname.endsWith('/user'))data=user;
  else if(url.pathname.endsWith('/logout'))data={};
  else if(url.pathname.endsWith('/seller_orders')){const orders=[fixture,shipped].filter(o=>(body.p_filter==='all'||o.status===body.p_filter)&&(!body.p_search||o.ad_soyad.includes(body.p_search)||String(o.siparis_no).includes(body.p_search)));data={phone:'05000000001',counts:{handover:8,handover_parcels:14,all:2,pending:1,prepared:0,shipped:1,delivered:0,problem:0,cancelled:0},orders,total:orders.length};}
  else if(url.pathname.endsWith('/seller_order_detail'))data=body.p_id===1200?fixture:shipped;
  else if(url.pathname.endsWith('/seller_update_pending')){updateBody=body;data={...fixture,...body.p_changes};}
  else if(url.pathname.endsWith('/seller_admin_candidates'))data=[{phone:'05000000001',orders:1212,user_id:null}];
  else if(url.pathname.endsWith('/seller-admin')){accountBody=body;data={ok:true};}
  else if(url.pathname.endsWith('/sehir'))data=[{id:'34',name:'İSTANBUL'}];
  else if(url.pathname.endsWith('/ilce'))data=[{id:'1',city_id:'34',code:'3401',name:'KADIKÖY'}];
  else {status=404;data={message:'Unexpected test route '+url.pathname};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(origin);await page.locator('#login-form').waitFor();
 await page.screenshot({path:resolve(root,'../login-qa.png'),fullPage:true});
 await page.locator('#username').fill('0500 000 00 01');await page.locator('#password').fill('Ab3!xy');await page.locator('#login-form .primary').click();
 await page.locator('[data-order="1200"]').waitFor();assert.equal(loginBody.email,'05000000001@satici.ozkanceylan.uk');
 assert.equal(await page.locator('.stat-handover strong').textContent(),'8');assert.equal(await page.locator('.stat-handover .handover-parcels').textContent(),'14 parça');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Mobile horizontal overflow at '+width);}
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:resolve(root,'../dashboard-qa.png'),fullPage:true});
 await page.locator('[data-order="1199"]').click();await page.locator('dialog[open]').waitFor();assert.equal(await page.locator('dialog [data-action="edit-order"]').count(),0);assert.equal(await page.locator('dialog a[target="_blank"]').count(),1);await page.locator('[data-action="close-sheet"]').click();
 await page.locator('[data-order="1200"]').click();await page.locator('[data-action="edit-order"]').click();await page.locator('#district option[value="3401"]').waitFor({state:'attached'});await page.locator('#kargo_adet').fill('4');await page.locator('#kargo_kg').fill('5+10');await page.locator('#edit-form .primary').click();await page.getByText('KG sayısı paket adediyle aynı olmalı. Örnek: 5+10').waitFor();assert.equal(updateBody,undefined);await page.locator('#kargo_kg').fill('5+10+5+6');await page.locator('#ad_soyad').fill('Düzenlenmiş Müşteri');await page.locator('#edit-form .primary').click();await page.getByText('Sipariş bilgileri kaydedildi.').waitFor();assert.equal(updateBody.p_id,1200);assert.equal(updateBody.p_changes.kargo_kg,'5+10+5+6');assert.equal(updateBody.p_changes.kargo_adet,'4');assert.equal(updateBody.p_changes.ad_soyad,'Düzenlenmiş Müşteri');assert.deepEqual(updateBody.p_original,fixture);assert.equal('siparis_alan'in updateBody.p_changes,false);await page.locator('[data-action="close-sheet"]').click();
 await page.locator('#search').fill('1200');await page.waitForTimeout(500);assert.equal(await page.locator('[data-order]').count(),1);await page.locator('[data-tab="account"]').click();await page.locator('[data-action="install"]').click();await page.locator('dialog[open]').waitFor();await page.locator('[data-action="close-sheet"]').click();await page.locator('[data-action="logout"]').click();await page.locator('#login-form').waitFor();assert.equal(await page.locator('[data-order]').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('siparis-takip-session')),null);
 await page.locator('[data-action="login-mode"]').click();await page.locator('#username').fill('admin@example.test');await page.locator('#password').fill('Ab3!xy');await page.locator('#login-form .primary').click();await page.locator('[data-seller]').waitFor();await page.locator('[data-seller]').click();await page.locator('#new_password').fill('Cd4!yz');await page.locator('#seller-form .primary').click();await page.getByText('Satıcı hesabı güncellendi. Şifreyi satıcıya güvenli yolla ilet.').waitFor();assert.equal(accountBody.phone,'05000000001');assert.equal(accountBody.action,'create');assert.equal(accountBody.password,'Cd4!yz');assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: 320/390/430px without overflow; phone login; search; read-only shipment; pending edit contract; account creation; install guidance; logout clears session; no page errors. API responses mocked; DB boundaries tested separately.');
 await context.close();
}finally{await browser.close();server.close();}
