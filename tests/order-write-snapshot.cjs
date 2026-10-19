const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app.js','utf8');const ctx={};vm.createContext(ctx);vm.runInContext(source.match(/function orderWriteSnapshot[^\n]+/)[0],ctx);
const base={siparis_no:1,kargo_durumu:'Bekliyor',ad_soyad:'Test',notlar:'Özgün sipariş notu',toplam_tutar:'1250',odeme_sekli:'EFT'};
for(const display of [{receipts:[]},{receipts:[{id:'r',status:'pending'}]},{receiptError:true},{customer_order_history:{total:2},receipts:[],receiptError:true}]){const enriched={...base,...display};const actual=ctx.orderWriteSnapshot(enriched);assert.deepEqual(JSON.parse(JSON.stringify(actual)),base);assert.deepEqual(enriched,{...base,...display});}
assert.equal(ctx.orderWriteSnapshot({...base,notlar:'Değişmiş gerçek not'}).notlar,'Değişmiş gerçek not');console.log('PASS: receipt and history display data excluded, original order fields and concurrency checks preserved; input not mutated.');

