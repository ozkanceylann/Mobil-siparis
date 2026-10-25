import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const root=resolve(new URL('..',import.meta.url).pathname);
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://local').pathname+(new URL(req.url,'http://local').pathname==='/'?'index.html':''));if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(path)]||'text/plain');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const browser=await chromium.launch({executablePath:process.env.BROWSER_PATH||undefined,headless:true,args:['--no-sandbox']});
try{
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const user={id:'00000000-0000-4000-8000-000000000001',email:'05079970697@satici.ozkanceylan.uk',app_metadata:{role:'seller',firma:'seller',seller_phone:'05079970697'},user_metadata:{},aud:'authenticated'};
 const token=[Buffer.from('{"alg":"HS256"}').toString('base64url'),Buffer.from(JSON.stringify({sub:user.id,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'test'].join('.');
 let requests=[],mode='processing',lastId,statusCalls=0,wakes=0,dropResponse=false;
 await page.route('https://n8n.ozkanceylan.uk/**',route=>{wakes++;return route.fulfill({status:200,body:''});});
 await page.route('https://jarsxtpqzqzhlshpmgot.supabase.co/**',async route=>{
  const path=new URL(route.request().url()).pathname,body=route.request().postDataJSON();let data;
  if(path.endsWith('/token'))data={access_token:token,refresh_token:'test',expires_in:3600,token_type:'bearer',user};
  else if(path.endsWith('/user'))data=user;
  else if(path.endsWith('/seller_orders'))data={orders:[],total:0,counts:{}};
  else if(path.endsWith('/mobile_order_submit')){requests.push(body);lastId=body.p_id;if(dropResponse){dropResponse=false;return route.abort();}await new Promise(r=>setTimeout(r,300));data={id:lastId,status:'pending'};}
  else if(path.endsWith('/mobile_order_status')){statusCalls++;data={id:body.p_id,status:mode,order_no:mode==='completed'?12345:null,message:mode==='rejected'?'Eksik bilgi – müşteri telefonu':null};}
  else if(path.endsWith('/seller_customer_notes'))data={};
  else data=[];
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('#username').waitFor({timeout:10000}).catch(async e=>{console.error(errors,page.url(),await page.content());throw e;});await page.locator('#username').fill('05079970697');await page.locator('#password').fill('Test123!');await page.locator('#login-form .primary').click();await page.locator('[data-action="new-order"]').waitFor();
 await page.locator('[data-action="new-order"]').click();
 const text='Test Müşteri\n05079970697\nCaferağa Mahallesi Moda Caddesi 1 Kadıköy İstanbul\n10 kg zeytin 260\n2000 TL kart';
 await page.locator('#new-order-message').fill(text);
 await page.evaluate(()=>{const f=document.querySelector('#new-order-form');f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>document.querySelector('#new-order-form .primary').disabled);
 await page.waitForTimeout(600);assert.equal(requests.length,1);assert.deepEqual(Object.keys(requests[0]).sort(),['p_id','p_message']);assert.equal(requests[0].p_message,text);assert.equal(await page.locator('#new-order-message').getAttribute('readonly'),'');assert.ok(statusCalls>0);
 await page.reload();await page.locator('[data-action="new-order"]').waitFor();await page.locator('[data-action="new-order"]').click();assert.equal(await page.locator('#new-order-message').inputValue(),text);assert.equal(await page.locator('#new-order-form .primary').innerText(),'Sonucu kontrol et');
 mode='completed';await page.locator('#new-order-form .primary').click();await page.getByText('✅ Sipariş sisteme girildi. Sipariş No: 12345').waitFor();assert.equal(requests.length,1,'Reload must not create another submission');
 await page.locator('[data-intake="reset"]').click();await page.locator('#new-order-message').fill(text+' ikinci');mode='rejected';await page.locator('#new-order-form .primary').click();await page.getByText('Eksik bilgi – müşteri telefonu').waitFor();await page.waitForFunction(()=>!document.querySelector('#new-order-form .primary').disabled);assert.equal(await page.locator('#new-order-message').inputValue(),text+' ikinci');assert.equal(await page.locator('#new-order-message').getAttribute('readonly'),null);
 const rejectedId=requests[1].p_id;mode='completed';await page.locator('#new-order-message').fill(text+' düzeltilmiş');await page.locator('#new-order-form .primary').click();await page.getByText('✅ Sipariş sisteme girildi. Sipariş No: 12345').waitFor();assert.notEqual(requests[2].p_id,rejectedId);
 await page.locator('[data-intake="reset"]').click();await page.locator('#new-order-message').fill(text+' bağlantı');dropResponse=true;await page.locator('#new-order-form .primary').click();await page.getByText(/Yanıt alınamadı. Metniniz korundu/).waitFor();const uncertainId=requests.at(-1).p_id;await page.locator('#new-order-form .primary').click();await page.getByText('✅ Sipariş sisteme girildi. Sipariş No: 12345').waitFor();assert.equal(requests.at(-1).p_id,uncertainId,'Ambiguous submit retry must reuse id');
 for(const width of [320,390,430]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>{const r=document.getElementById('sheet').getBoundingClientRect(),b=document.querySelector('[data-action="new-order"]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&b.left>=0&&b.right<=innerWidth;}),true,'New order sheet/header must fit at '+width);}

 assert.deepEqual(errors,[]);assert.ok(wakes>=2);
 console.log('PASS: mobile UI, double submit lock, authenticated request contract, reload recovery, missing fields, corrected retry, uncertain response idempotency, 320/390/430px. API responses mocked.');
 await ctx.close();
}finally{await browser.close();server.close();}
