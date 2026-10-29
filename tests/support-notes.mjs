import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname+(new URL(req.url,'http://local').pathname==='/'?'index.html':''));if(!path.startsWith(root+'/'))throw Error();const body=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'})[extname(path)]||'text/plain');res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});
const base={siparis_no:101,ad_soyad:'Destek Müşterisi',musteri_tel:'05550000000',sehir:'İSTANBUL',ilce:'KADIKÖY',sehir_kodu:'34',ilce_kodu:'3401',adres:'Deneme Mah. 12',subeden_teslim:false,teslim_sekli_kontrol:false,urun_bilgisi:'5 kg Zeytin',kargo_adet:'1',kargo_kg:'5',toplam_tutar:'1000',odeme_sekli:'Nakit',status:'support',kargo_durumu:'Kargolandı'};
const orders=[base,{...base,siparis_no:102,status:'undelivered'},{...base,siparis_no:103,status:'pending',kargo_durumu:'Bekliyor'}];
let user,writes=0,details=0,fail=false;const notes={},errors=[];
try{
 const page=await browser.newPage({serviceWorkers:'block'});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/updates.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await page.route('https://jarsxtpqzqzhlshpmgot.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),body=route.request().postDataJSON();let data=[],status=200;
  if(url.pathname.endsWith('/token')){user={id:'00000000-0000-0000-0000-000000000001',email:body.email,app_metadata:{role:'seller',seller_phone:'05000000001'},aud:'authenticated'};const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id,role:'authenticated'})).toString('base64url'),'stub'].join('.');data={access_token:token,refresh_token:'stub-refresh',expires_in:3600,token_type:'bearer',user};}
  else if(url.pathname.endsWith('/user'))data=user;
  else if(url.pathname.endsWith('/seller_orders'))data={phone:'05000000001',counts:{all:3,pending:1,undelivered:1,support:1},orders,total:3};
  else if(url.pathname.endsWith('/seller_support_notes'))data=Object.fromEntries(body.p_order_ids.filter(id=>notes[id]).map(id=>[id,notes[id]]));
  else if(url.pathname.endsWith('/seller_save_support_note')){writes++;await new Promise(r=>setTimeout(r,200));if(fail){status=403;data={message:'Sipariş bulunamadı veya erişim izniniz yok.',code:'42501'};}else{data={note:body.p_note,updated_at:new Date().toISOString()};notes[body.p_id]=data;}}
  else if(url.pathname.endsWith('/seller_order_detail')){details++;data=orders.find(o=>o.siparis_no===body.p_id);}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#username').fill('05000000001');await page.locator('#password').fill('Ab3!xy');await page.locator('#login-form .primary').click();
 const button=page.locator('[data-support-note="101"]');await page.locator('[data-support-note="101"].support-note-missing').waitFor();assert.equal(await page.locator('[data-support-note="103"]').count(),0);
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const b=await button.boundingBox(),wa=await button.locator('..').locator('.whatsapp-contact').boundingBox();assert(b.y+b.height<=wa.y,'Explanation above WhatsApp at '+width);assert(b.x>=0&&b.x+b.width<=width,'No overflow at '+width);}
 await page.setViewportSize({width:390,height:900});await button.click();await page.locator('#support-note-form').waitFor();assert.equal(details,0,'Explanation button must not open order detail');
 const note='Müşteriyle görüşüldü. Yarın şubeden teslim alacak. <img src=x onerror=alert(1)>';
 await page.locator('#support-note-text').fill(note);await page.locator('#support-note-form [type=submit]').click();assert(await page.locator('#support-note-form [type=submit]').isDisabled());
 await page.locator('dialog[open]').waitFor({state:'detached'});await page.locator('[data-support-note="101"].support-note-saved').waitFor();assert.equal(writes,1);
 await page.getByRole('button',{name:'Siparişleri yenile',exact:true}).click();await page.locator('[data-support-note="101"].support-note-saved').waitFor();
 await page.locator('[data-support-note="101"]').click();await page.locator('#support-note-form').waitFor();assert.equal(await page.locator('#support-note-text').inputValue(),note);assert.equal(await page.locator('dialog img').count(),0,'Note must be escaped');
 await page.locator('#support-note-text').fill(note+' Güncellendi.');await page.locator('#support-note-form [type=submit]').click();await page.locator('dialog[open]').waitFor({state:'detached'});assert.equal(writes,2);
 fail=true;await page.locator('[data-support-note="102"]').click();await page.locator('#support-note-text').fill('Müşteri arandı.');await page.locator('#support-note-form [type=submit]').click();await page.locator('#support-note-error').getByText('Sipariş bulunamadı veya erişim izniniz yok.').waitFor();assert(await page.locator('#support-note-form [type=submit]').isEnabled());assert(await page.locator('[data-support-note="102"]').evaluate(e=>e.classList.contains('support-note-missing')));assert.equal(await page.locator('#support-note-text').inputValue(),'Müşteri arandı.');assert.equal(details,0);assert.deepEqual(errors,[]);
 console.log('PASS: support/failed-only buttons above WhatsApp at 320/390/1440, red to green only after save, persistence, editing, escaped text and failed-save recovery without order navigation.');
}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
