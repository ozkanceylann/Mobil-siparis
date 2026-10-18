import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const {chromium}=require('playwright');
const root=new URL('../',import.meta.url);
const appSource=await readFile(new URL('app.js',root),'utf8');
const weights=await readFile(new URL('cargo-weights.js',root),'utf8');
const css=await readFile(new URL('style.css',root),'utf8');
assert.ok(!weights.includes('(?<='),'Cargo weights must parse on Safari 15 (no lookbehind)');
const fixture={siparis_no:1200,ad_soyad:'Deneme Müşteri',musteri_tel:'05550000000',adres:'Deneme Sokak 12',sehir:'İSTANBUL',ilce:'KADIKÖY',sehir_kodu:'34',ilce_kodu:'3401',urun_bilgisi:'Deneme ürün',toplam_tutar:'990',odeme_sekli:'Kapıda ödeme',notlar:'',kargo_adet:'2',kargo_kg:'5-10',tarih:'2026-10-18T12:00:00',kargo_durumu:'Bekliyor',status:'pending',customer_note:'Örnek müşteri notu'};
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try {
 for(const legacy of [false,true]) {
  const context=await browser.newContext({viewport:{width:414,height:736},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  const page=await context.newPage();page.setDefaultTimeout(10000);
  const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(error.stack);});
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="app"></main><dialog id="sheet" aria-labelledby="sheet-title"></dialog><div id="toast"></div>');
  await page.addStyleTag({content:legacy?css.replace(/\d+dvh/g,'invalid-unit'):css});
  await page.evaluate(({fixture,legacy})=>{
   if(legacy){
    delete HTMLDialogElement.prototype.showModal;delete HTMLDialogElement.prototype.close;delete HTMLDialogElement.prototype.open;
    String.prototype.replaceAll=undefined;
   }
   window.APP_CONFIG={};
   window.savedChanges=null;
   const user={id:'test-user',app_metadata:{role:'seller',seller_phone:'05000000001'}};
   const client={
    auth:{getSession:async()=>({data:{session:null}}),onAuthStateChange:()=>{}},
    rpc:async(name,args)=>{
     if(name==='seller_order_detail')return {data:fixture};
     if(name==='seller_update_pending'){window.savedChanges=args;return {data:{...fixture,...args.p_changes}};}
     if(name==='seller_orders')return {data:{orders:[fixture],total:1,counts:{all:1,pending:1}}};
     throw Error('Unexpected RPC: '+name);
    },
    from:table=>({select:()=>({order:async()=>({data:[{id:'34',name:'İSTANBUL'}]}),eq:()=>({order:async()=>({data:[{code:'3401',name:'KADIKÖY'}]})})})})
   };
   window.supabase={createClient:()=>client};window.testUser=user;window.fixture=fixture;
  },{fixture,legacy});
  await page.addScriptTag({content:weights});
  await page.addScriptTag({content:appSource});
  await page.locator('#login-form').waitFor();
  await page.evaluate(()=>{S.user=window.testUser;S.orders=[window.fixture];S.counts={all:1,pending:1};S.total=1;renderShell();});
  await page.locator('[data-order="1200"] .order-id').tap();
  await page.locator('#sheet[open]').waitFor();
  assert.equal(await page.locator('#sheet').evaluate(el=>el.classList.contains('legacy-sheet')),legacy);
  assert.ok(await page.locator('#sheet').innerText().then(text=>text.includes('5+10')));
  assert.equal(await page.locator('[data-action="cancel-order"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(162, 56, 48)');
  for(const width of [320,414,430]){
   await page.setViewportSize({width,height:736});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.ok(await page.locator('#sheet').evaluate(el=>el.getBoundingClientRect().height<=innerHeight));
  }
  for(const viewport of [{width:1366,height:600},{width:1024,height:480},{width:520,height:400},{width:390,height:736}]) {
   await page.setViewportSize(viewport);
   await page.evaluate(()=>{const block=document.querySelector('#sheet .detail-block p');block.textContent=('Uzun sipariş adresi ve açıklaması\n').repeat(60);});
   for(const end of [false,true]) {
    await page.locator('#sheet>.sheet-content').evaluate((el,end)=>{el.scrollTop=end?el.scrollHeight:0;},end);
    const bounds=await page.locator('[data-action="edit-order"]').boundingBox();
    assert.ok(bounds.y>=0&&bounds.y+bounds.height<=viewport.height,'Edit action must remain inside the app window');
    const cancel=await page.locator('[data-action="cancel-order"]').boundingBox();
    assert.ok(cancel.x+cancel.width<=bounds.x,'Cancel stays to the left of Edit');
    const dialog=await page.locator('#sheet').boundingBox();
    assert.ok(dialog.y>=0&&dialog.y+dialog.height<=viewport.height+1,'Sheet must fit the app window');
    assert.equal(await page.locator('#sheet').evaluate(el=>el.scrollHeight>el.clientHeight),false);
   }
  }
  if(legacy){
   assert.equal(await page.locator('.sheet-backdrop').isVisible(),true);
   assert.equal(await page.locator('#app').getAttribute('aria-hidden'),'true');
   await page.keyboard.press('Shift+Tab');
   assert.equal(await page.locator('#sheet').evaluate(el=>el.contains(document.activeElement)),true);
  }
  await page.locator('[data-action="edit-order"]').tap();
  await page.locator('#district option[value="3401"]').waitFor({state:'attached'});
  await page.locator('#ad_soyad').fill('Düzenlenmiş Müşteri');
  await page.locator('#kargo_kg').fill('6+11');
  assert.deepEqual(await page.locator('#edit-form').evaluate(form=>Array.from(form.elements).filter(el=>el.validity&&!el.validity.valid).map(el=>({name:el.name,value:el.value,reason:el.validationMessage}))),[]);
  await page.locator('#edit-form [type="submit"]').tap();
  await page.waitForFunction(()=>window.savedChanges!==null).catch(async error=>{
   console.error(await page.evaluate(()=>({saved:window.savedChanges,toast:document.getElementById('toast').textContent,formError:document.getElementById('edit-error')?.textContent,form:document.getElementById('edit-form')?.outerHTML})));
   throw error;
  });
  await page.locator('#sheet .detail-block h3').filter({hasText:'Düzenlenmiş Müşteri'}).waitFor();
  assert.equal(await page.evaluate(()=>window.savedChanges.p_changes.ad_soyad),'Düzenlenmiş Müşteri');
  assert.equal(await page.evaluate(()=>window.savedChanges.p_changes.kargo_kg),'6+11');
  await page.locator('[data-action="close-sheet"]').tap();
  await page.locator('#sheet[open]').waitFor({state:'hidden'});
  if(legacy){
   assert.equal(await page.locator('.sheet-backdrop').isVisible(),false);
   assert.equal(await page.locator('#app').getAttribute('aria-hidden'),null);
   assert.equal(await page.evaluate(()=>document.body.style.position),'');
  }
  await page.locator('[data-order="1200"] .order-id').tap();
  await page.locator('#sheet[open]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#sheet[open]').waitFor({state:'hidden'});
  assert.deepEqual(errors,[]);
  await context.close();
  console.log('PASS '+(legacy?'legacy APIs disabled':'native dialog')+': card, detail, edit/save, close/reopen, Escape, narrow viewports.');
 }
} finally {await browser.close();}
