import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const source=await readFile(new URL('../order-receipts.js',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route('https://receipts.test/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Test dekont</h1>'}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><main id="root"></main>');
 await page.evaluate(()=>{
  window.testReceipt={id:'test-receipt',order_id:1,object_path:'test/dekont.pdf',file_name:'Dekont.pdf',status:'pending',source:'panel',created_at:'2026-10-20T09:00:00Z'};
  window.testDB={from:()=>({select(){return this},eq(){return this},order:async()=>({data:[window.testReceipt]})}),storage:{from:()=>({createSignedUrl:async()=>{await new Promise(r=>setTimeout(r,200));return window.signingFailure?{error:Error('Test bağlantı hatası')}:{data:{signedUrl:'https://receipts.test/dekont.pdf?token=test'}};}})}};
 });
 await page.addScriptTag({content:source});
 await page.evaluate(async()=>{const o={siparis_no:1,odeme_sekli:'EFT'};document.getElementById('root').innerHTML=OrderReceipts.markup(o);await OrderReceipts.mount(window.testDB,o,document.getElementById('root'));});
 const button=page.locator('[data-receipt-open]');
 const opened=context.waitForEvent('page');await button.tap();const preview=await opened;await preview.waitForURL('https://receipts.test/**');
 assert.equal(await preview.locator('h1').innerText(),'Test dekont');assert.equal(await preview.evaluate(()=>opener),null);await preview.close();
 await page.evaluate(()=>{window.originalOpen=window.open;window.open=()=>null;});
 await button.tap();const link=page.locator('[data-receipt-message] a');await link.waitFor();assert.match(await link.innerText(),/dokunun/);
 const fallbackOpened=context.waitForEvent('page');await link.tap();const fallback=await fallbackOpened;await fallback.waitForURL('https://receipts.test/**');assert.equal(await fallback.locator('h1').innerText(),'Test dekont');await fallback.close();
 await page.evaluate(()=>{window.open=window.originalOpen;window.signingFailure=true;});
 await button.tap();await page.waitForFunction(()=>document.querySelector('[data-receipt-message]').textContent.includes('Test bağlantı hatası'));await page.waitForFunction(()=>!document.querySelector('[data-receipt-open]').disabled);
 assert.equal(context.pages().length,1,'A failed request must close the blank preview');assert.deepEqual(errors,[]);
 await context.close();console.log('PASS mobile touch: delayed private URL, popup, native fallback link and signing failure');
}finally{await browser.close();}
