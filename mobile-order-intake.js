'use strict';
window.MobileOrderIntake=(()=>{
 let api,state=null,polling=false,ownerId=null,runId=0;
 const terminal=s=>['completed','rejected','failed'].includes(s);
 const key=()=> 'mobile-order-draft:'+api.getUser().id;
 function save(){try{sessionStorage.setItem(key(),JSON.stringify(state));}catch{}}
 function restore(){ownerId=api.getUser().id;try{state=JSON.parse(sessionStorage.getItem(key())||'null');}catch{state=null;}state=state||{text:'',id:null,status:'draft',message:''};}
 function uuid(){if(crypto.randomUUID)return crypto.randomUUID();const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return [...b].map((x,i)=>([4,6,8,10].includes(i)?'-':'')+x.toString(16).padStart(2,'0')).join('');}
 const busy=()=>!!state?.id&&!terminal(state.status);
 function render(){
  if(!api.getUser())return;
  const locked=busy(),done=state.status==='completed';
  api.sheet.innerHTML=api.sheetHeader('Yeni sipariş')+`<div class="sheet-content mobile-order-intake"><p class="hint">WhatsApp için hazırladığınız sipariş mesajını buraya yapıştırın. Bilgiler mesajdan alınır; sipariş hesabınıza kaydedilir.</p><form id="new-order-form"><div class="field"><label for="new-order-message">Sipariş mesajı</label><textarea id="new-order-message" name="message" rows="12" minlength="10" maxlength="15000" required placeholder="Müşteri adı, telefon, adres, ürünler ve tutarı içeren hazır mesajı yapıştırın…" ${locked||done?'readonly':''}>${api.esc(state.text)}</textarea></div><p id="new-order-result" class="${done?'intake-success':'form-error'}" role="${['rejected','failed'].includes(state.status)?'alert':'status'}" aria-live="polite">${api.esc(done?'✅ Sipariş sisteme girildi. Sipariş No: '+state.order_no:state.message||'')}</p>${done?'<button type="button" class="primary" data-intake="reset">Yeni sipariş gir</button>':`<button type="submit" class="primary" ${polling?'disabled':''}>${polling?'Sipariş işleniyor…':locked?'Sonucu kontrol et':'Gönder'}</button>`}<p class="hint">${locked?'İşlem sürerken tekrar gönderilmez. Bu ekranı kapatıp yeniden açarak sonucu görebilirsiniz.':done?'Siparişinizi Bekleyen listesinden görebilirsiniz.':'Eksik bilgi varsa mesajı düzeltmeniz istenir.'}</p><button type="button" class="secondary" data-action="close-sheet">${done?'Kapat':'Siparişlere dön'}</button></form></div>`;
 }
 function update(){save();if(api.sheet.querySelector('#new-order-form'))render();}
 function result(data){if(!data?.id||!data?.status)throw Error('Gönderim sonucu alınamadı.');Object.assign(state,data);update();}
 async function watch(userId,ticket){
  const started=Date.now();
  while(ticket===runId&&api.getUser()?.id===userId&&busy()){
   const {data,error}=await api.db.rpc('mobile_order_status',{p_id:state.id});
   if(ticket!==runId||api.getUser()?.id!==userId)return;
   if(error)throw error;
   result(data);
   if(terminal(state.status)){
    if(state.status==='completed'){api.toast('Sipariş sisteme girildi. Sipariş No: '+state.order_no);await api.onCreated();}
    return;
   }
   if(Date.now()-started>180000){state.message='İşlem devam ediyor. Sonucu kontrol et düğmesiyle aynı gönderimi sorgulayabilirsiniz.';return;}
   await new Promise(resolve=>setTimeout(resolve,2000));
  }
 }
 async function send(form){
  if(polling||!api.getUser())return;
  const userId=api.getUser().id,ticket=++runId;
  const text=form.message.value.trim();
  if(text.length<10||text.length>15000)return;
  if(!navigator.onLine){api.toast('Sipariş göndermek için internete bağlanın.');return;}
  if(!busy()){state={text,id:uuid(),status:'submitting',message:'Sipariş işleniyor…'};}
  polling=true;update();
  try{
   if(state.status==='submitting'){
    const {data,error}=await api.db.rpc('mobile_order_submit',{p_id:state.id,p_message:state.text});
    if(ticket!==runId||api.getUser()?.id!==userId)return;
    if(error){if(['42501','P0001','22023'].includes(error.code)){state.status='rejected';state.message=error.message;update();return;}throw error;}
    result(data);
   }
   if(!terminal(state.status)){
    // This request only wakes the worker. Authenticated RPCs own all data and results.
    void fetch('https://n8n.ozkanceylan.uk/webhook/mobil-siparis-isle',{method:'POST',body:new URLSearchParams({request_id:state.id})}).catch(()=>{});
    await watch(userId,ticket);
   }else if(state.status==='completed')await api.onCreated();
  }catch{
   if(ticket!==runId||api.getUser()?.id!==userId)return;
   state.message='Yanıt alınamadı. Metniniz korundu. Aynı gönderimin sonucunu kontrol etmek için düğmeye basın.';
  }finally{if(ticket===runId){polling=false;if(api.getUser()?.id===userId)update();}}
 }
 function open(){if(!api.getUser())return;if(ownerId!==api.getUser().id){++runId;polling=false;restore();}else if(!polling)restore();render();if(!api.sheet.open)api.sheet.showModal();}
 function bind(options){api=options;
  document.addEventListener('click',e=>{
   if(e.target.closest('[data-action="new-order"]'))open();
   if(e.target.closest('[data-intake="reset"]')){state={text:'',id:null,status:'draft',message:''};update();}
  });
  document.addEventListener('input',e=>{if(e.target.id==='new-order-message'&&!busy()){state.text=e.target.value;save();}});
  document.addEventListener('submit',e=>{if(e.target.id==='new-order-form'){e.preventDefault();void send(e.target);}});
 }
 return {bind};
})();
