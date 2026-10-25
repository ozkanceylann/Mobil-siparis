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
const base={siparis_no:100,ad_soyad:'Deneme Müşteri',musteri_tel:'05550000000',sehir:'İSTANBUL',ilce:'KADIKÖY',sehir_kodu:'34',ilce_kodu:'3401',adres:'Deneme Mah. 12',subeden_teslim:false,teslim_sekli_kontrol:false,urun_bilgisi:'5 kg Zeytin',kargo_adet:'1',kargo_kg:'5',toplam_tutar:'1000',odeme_sekli:'Nakit',status:'pending',kargo_durumu:'Bekliyor'};
const orders=[{...base,siparis_no:10262,sehir:'',ilce:'',sehir_kodu:null,ilce_kodu:null},{...base,siparis_no:10260,subeden_teslim:true,teslim_subesi:''}];
const missing=()=>orders.filter(o=>o.status==='pending'&&(!o.sehir||!o.ilce||(o.subeden_teslim&&!o.teslim_subesi))).map(o=>o.siparis_no);
let user,opened=[],writes=0;const errors=[];
try{
 const page=await browser.newPage({serviceWorkers:'block'});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/updates.js*',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));
 await page.route('https://jarsxtpqzqzhlshpmgot.supabase.co/**',async route=>{
  const url=new URL(route.request().url()),body=route.request().postDataJSON();let data=[];
  if(url.pathname.endsWith('/token')){user={id:'00000000-0000-0000-0000-000000000001',email:body.email,app_metadata:{role:'seller',seller_phone:'05000000001'},aud:'authenticated'};const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:user.id,role:'authenticated'})).toString('base64url'),'stub'].join('.');data={access_token:token,refresh_token:'stub-refresh',expires_in:3600,token_type:'bearer',user};}
  else if(url.pathname.endsWith('/user'))data=user;
  else if(url.pathname.endsWith('/seller_orders'))data={phone:'05000000001',counts:{all:40,pending:40,handover:0,shipped:0,delivered:0,undelivered:0},orders:body.p_search?[]:[base],total:body.p_search?0:40,missing_pending_ids:missing()};
  else if(url.pathname.endsWith('/seller_order_detail')){opened.push(body.p_id);data={...orders.find(o=>o.siparis_no===body.p_id)};}
  else if(url.pathname.endsWith('/seller_update_pending')){writes++;const order=orders.find(o=>o.siparis_no===body.p_id);Object.assign(order,body.p_changes,{sehir:'İSTANBUL',ilce:'KADIKÖY'});data={...order};}
  else if(url.pathname.endsWith('/sehir'))data=[{id:'34',name:'İSTANBUL'}];
  else if(url.pathname.endsWith('/ilce'))data=[{id:'1',city_id:'34',code:'3401',name:'KADIKÖY'}];
  else if(url.pathname.includes('/rpc/'))data=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.route('https://n8n.ozkanceylan.uk/webhook/gazi_subeler',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,environment:'production',branches:[{code:'B1',name:'KADIKÖY',address:'Şube adresi'}]})}));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#username').fill('05000000001');await page.locator('#password').fill('Ab3!xy');await page.locator('#login-form .primary').click();
 await page.locator('.missing-pending-notice').waitFor();assert.equal(await page.locator('[data-order="10262"]').count(),0,'off-page missing order still detected');
 for(const width of [320,390,1440]){await page.setViewportSize({width,height:900});const box=await page.locator('.missing-pending-notice').boundingBox();assert(box.x>=0&&box.x+box.width<=width,'warning overflow '+width);assert(await page.locator('.missing-pending-notice').isVisible());}
 await page.setViewportSize({width:390,height:900});
 await page.locator('#search').fill('unrelated');await page.waitForTimeout(500);assert(await page.locator('.missing-pending-notice').isVisible(),'independent of search');
 await page.locator('.missing-pending-notice').click();await page.getByRole('heading',{name:'Sipariş #10262',exact:true}).waitFor();
 await page.locator('.missing-queue-navigation [data-action="missing-next"]').click();await page.getByRole('heading',{name:'Sipariş #10260',exact:true}).waitFor();
 await page.locator('.missing-queue-navigation [data-action="missing-next"]').click();await page.getByRole('heading',{name:'Sipariş #10262',exact:true}).waitFor();
 assert.deepEqual(opened.slice(0,3),[10262,10260,10262]);
 await page.locator('[data-action="edit-order"]').click();await page.locator('#city').selectOption('34');await page.locator('#district option[value="3401"]').waitFor({state:'attached'});await page.locator('#district').selectOption('3401');await page.locator('#edit-form .primary').click();
 await page.getByRole('heading',{name:'Sipariş #10260',exact:true}).waitFor();assert.equal(writes,1);assert.equal(await page.locator('.missing-pending-notice small').textContent(),'1 bekleyen sipariş · Kontrol et');
 await page.locator('[data-action="edit-order"]').click();await page.locator('#delivery_branch_select option[value="B1"]').waitFor({state:'attached'});await page.locator('#delivery_branch_select').selectOption('B1');await page.locator('#edit-form .primary').click();
 await page.getByText('Eksik bilgili bekleyen sipariş kalmadı.').waitFor();assert.equal(writes,2);assert.equal(await page.locator('.missing-pending-notice').count(),0);assert.equal(await page.locator('dialog[open]').count(),0);assert.deepEqual(errors,[]);
 console.log('PASS: off-page queue, search-independent warning, 320/390/1440 layouts, next cycles, save auto-advances, last save clears warning and dialog.');
}finally{await browser.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
