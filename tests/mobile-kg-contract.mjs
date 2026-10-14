import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../cargo-weights.js';
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const code=app.slice(app.indexOf('async function saveEdit(form)'),app.indexOf('function renderAdmin',app.indexOf('async function saveEdit(form)')));
const calls=[];
const errorBox={textContent:''},button={disabled:false};
const S={admin:false,detail:{siparis_no:1,status:'pending',kargo_durumu:'Bekliyor'}};
const db={rpc:async(name,body)=>{calls.push({name,body});return {data:{...S.detail,...body.p_changes},error:null};}};
const document={getElementById:id=>id==='edit-error'?errorBox:{value:id==='city'?'34':'3401'}};
class MockFormData { constructor(form){this.values=form.values;} [Symbol.iterator](){return Object.entries(this.values)[Symbol.iterator]();} }
const save=new Function('S','db','document','navigator','FormData','CargoWeights','canEdit','toast','errText','renderDetail','loadOrders',code+'return saveEdit;')(
S,db,document,{onLine:true},MockFormData,globalThis.CargoWeights,o=>o?.status==='pending'&&o.kargo_durumu==='Bekliyor',()=>{},()=>'',()=>{},async()=>{});
const form={values:{ad_soyad:'Test',kargo_adet:'4',kargo_kg:'5+10'},querySelector:()=>button};
await save(form);assert.equal(calls.length,0);assert.match(errorBox.textContent,/KG sayısı/);assert.equal(button.disabled,false);
form.values.kargo_kg='5,10,5,6';
await save(form);assert.equal(calls.length,1);assert.equal(calls[0].body.p_changes.kargo_kg,'5+10+5+6');assert.equal(calls[0].name,'seller_update_pending');
S.admin=true;form.values.kargo_kg='5+10+5+6';await save(form);assert.equal(calls[1].name,'admin_update_order');
console.log('Mobile seller/admin edit KG normalization and invalid-count prevention passed.');

