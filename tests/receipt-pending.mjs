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
const base={siparis_no:1100,ad_soyad:'Normal Sipariş',musteri_tel:'05550000000',adres:'Deneme Mah. Sokak 1',sehir:'İSTANBUL',ilce:'KADIKÖY',subeden_teslim:false,teslim_sekli_kontrol:false,urun_bilgisi:'5 kg zeytin',kargo_adet:'1',kargo_kg:'5',toplam_tutar:'1000',odeme_sekli:'Kapıda Nakit',status:'pending',kargo_durumu:'Bekliyor'};
const receiptOrders=[{...base,siparis_no:1201,ad_soyad:'Dekont Bir',odeme_sekli:'EFT'},{...base,siparis_no:1202,ad_soyad:'Dekont İki',odeme_sekli:'EFT'}];
let user,waiting=true,lastFilter;const errors=[];
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/updates.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await page.route('https://jarsxtpqzqzhlshpmgot.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),body=route.request().postDataJSON();let data=[];
  if(url.pathname.endsWith('/token')){
   user={id:'00000000-0000-0000-0000-000000000001',email:body.email,app_metadata:{role:'seller',seller_phone:'05000000001'},aud:'authenticated'};
   const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id,role:'authenticated'})).toString('base64url'),'stub'].join('.');
   data={access_token:token,refresh_token:'stub-refresh',expires_in:3600,token_type:'bearer',user};
  }else if(url.pathname.endsWith('/user'))data=user;
  else if(url.pathname.endsWith('/logout'))data={};
  else if(url.pathname.endsWith('/seller_orders')){
   lastFilter=body.p_filter;let orders=body.p_search?[]:body.p_filter==='receipt_pending'?(waiting?receiptOrders:[]):[base];
   data={counts:{all:40,pending:40,receipt_pending:waiting?2:0,receipt_pending_parcels:waiting?2:0},orders,total:orders.length,missing_pending_ids:[]};
  }else if(url.pathname.endsWith('/seller_order_detail'))data=receiptOrders.find(o=>o.siparis_no===body.p_id);
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#username').fill('05000000001');await page.locator('#password').fill('Ab3!xy');await page.locator('#login-form .primary').click();
 const notice=page.locator('.receipt-pending-notice');await notice.waitFor();assert((await notice.textContent()).includes('Dekont bekleyen siparişin var'));
 assert.equal(await page.locator('[data-order="1201"]').count(),0,'warning includes orders outside the current page');
 assert.equal(await notice.locator('small').textContent(),'2 bekleyen sipariş · Kontrol et');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});const box=await notice.boundingBox();assert(box.x>=0&&box.x+box.width<=width,'notice overflow at '+width);}
 await page.locator('#search').fill('unrelated');await page.waitForTimeout(500);assert(await notice.isVisible(),'warning independent of search');
 await notice.click();await page.locator('[data-order="1201"]').waitFor();assert.equal(lastFilter,'receipt_pending');assert.equal(await page.locator('#search').inputValue(),'');assert.equal(await page.locator('[data-order="1100"]').count(),0);await page.getByRole('heading',{name:'Dekont bekleyen siparişlerin'}).waitFor();
 await page.locator('[data-order="1201"]').click();await page.getByRole('heading',{name:'Sipariş #1201',exact:true}).waitFor();await page.locator('[data-action="close-sheet"]').click();
 waiting=false;await page.locator('[data-action="refresh"]').first().click();await notice.waitFor({state:'detached'});assert.equal(await page.locator('[data-order="1201"]').count(),0,'completed/resolved orders disappear from receipt queue');
 await page.locator('[data-tab="account"]').click();await page.locator('[data-action="logout"]').click();await page.locator('#login-form').waitFor();assert.equal(await page.locator('.receipt-pending-notice').count(),0,'no warning survives logout');assert.deepEqual(errors,[]);
 console.log('PASS: off-page receipt warning, 320/390/430px layout, search-independent count, scoped list, open receipt details, zero-state removal and logout cleanup.');
}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
