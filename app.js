'use strict';
const CFG=window.APP_CONFIG;
const db=supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey,{auth:{storageKey:'siparis-takip-session',persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
const app=document.getElementById('app'), sheet=document.getElementById('sheet');
CustomerOrderHistory.bind(showOrder);

// Safari before 15.4 has no native dialog API. Keep every existing sheet flow usable.
(function prepareSheet() {
 if (typeof sheet.showModal === 'function' && typeof sheet.close === 'function') return;
 const backdrop=document.createElement('div');
 backdrop.className='sheet-backdrop';backdrop.hidden=true;
 document.body.appendChild(backdrop);
 sheet.classList.add('legacy-sheet');
 sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
 sheet.setAttribute('tabindex','-1');
 Object.defineProperty(sheet,'open',{get:()=>sheet.hasAttribute('open')});
 let previousFocus,previousHidden,scrollY=0,bodyStyle;
 const focusable=()=>Array.from(sheet.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')).filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length);
 sheet.showModal=function(){
  if(sheet.open)return;
  previousFocus=document.activeElement;previousHidden=app.getAttribute('aria-hidden');
  scrollY=window.pageYOffset;
  bodyStyle={position:document.body.style.position,top:document.body.style.top,width:document.body.style.width};
  sheet.setAttribute('open','');backdrop.hidden=false;
  document.body.style.position='fixed';document.body.style.top=-scrollY+'px';document.body.style.width='100%';
  sheet.scrollTop=0;(focusable()[0]||sheet).focus();
  app.setAttribute('aria-hidden','true');
 };
 sheet.close=function(value){
  if(!sheet.open)return;
  if(value!==undefined)sheet.returnValue=String(value);
  sheet.removeAttribute('open');backdrop.hidden=true;
  if(previousHidden===null)app.removeAttribute('aria-hidden');else app.setAttribute('aria-hidden',previousHidden);
  Object.assign(document.body.style,bodyStyle);window.scrollTo(0,scrollY);
  if(previousFocus&&previousFocus.isConnected)previousFocus.focus();
  sheet.dispatchEvent(new Event('close'));
 };
 document.addEventListener('focusin',event=>{
  if(sheet.open&&!sheet.contains(event.target))(focusable()[0]||sheet).focus();
 });
 document.addEventListener('keydown',event=>{
  if(!sheet.open)return;
  if(event.key==='Escape'){
   event.preventDefault();
   if(sheet.dispatchEvent(new Event('cancel',{cancelable:true})))sheet.close();
  }else if(event.key==='Tab'){
   const items=focusable(),first=items[0],last=items[items.length-1];
   if(!first){event.preventDefault();sheet.focus();}
   else if(event.shiftKey&&(document.activeElement===first||document.activeElement===sheet)){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
 });
})();

const S={user:null,admin:false,manageAccounts:false,tab:'home',filter:'all',search:'',offset:0,orders:[],counts:{},total:0,request:0,detail:null,cities:[],candidates:[],updated:null,report:null,reportLoading:false,reportError:'',reportStart:'',reportEnd:'',reportMetric:'amount',reportRequest:0};
const labels={handover:'DHL Alımı Bekleyen',support:'Destek Gerekiyor',all:'Tümü',pending:'Bekleyen',prepared:'Hazırlanan',shipped:'Kargoda',arrived:'Varış Şubesinde',distribution:'Dağıtımda',delivered:'Teslim',return_label:'İade Etiketi',undelivered:'Teslim Edilemeyenler',returning:'Geri Geliyor',cancelled:'İptal'};
const paths={chart:'M4 3v18h17 M8 16v-5 M13 16V7 M18 16v-8',box:'M12 3 3 8v9l9 5 9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5.8l9 5v4',home:'m3 10 9-7 9 7v10H3z M9 20v-7h6v7',list:'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',truck:'M3 6h11v12H3z M14 10h4l3 4v4h-7 M8 18a2 2 0 1 1-4 0 M20 18a2 2 0 1 1-4 0',user:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-3a8 6 0 0 1 16 0v3',search:'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M15 15l6 6',refresh:'M20 7v5h-5 M4 17v-5h5 M5 8a8 8 0 0 1 13-3l2 7 M19 16a8 8 0 0 1-13 3l-2-7',arrow:'M5 12h14 M14 7l5 5-5 5',edit:'m16 3 5 5-12 12-6 1 1-6z M13 6l5 5',lock:'M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3',check:'m5 12 4 4 10-10',close:'m6 6 12 12 M6 18 18 6',download:'M12 3v12 M7 10l5 5 5-5 M4 17v4h16v-4',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',phone:'M5 3h4l2 5-3 2a14 14 0 0 0 6 6l2-3 5 2v4c0 4-7 1-12-4S1 3 5 3',logout:'M9 3H3v18h6 M8 12h13 M16 7l5 5-5 5',shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6z M8 12l3 3 5-6',chevron:'m9 5 7 7-7 7'};
const icon=(name,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.box}"/></svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phone=v=>{const d=String(v||'').replace(/\D/g,'');return /^05\d{9}$/.test(d)?d:/^5\d{9}$/.test(d)?'0'+d:/^905\d{9}$/.test(d)?'0'+d.slice(2):/^00905\d{9}$/.test(d)?'0'+d.slice(4):null;};
const pretty=v=>{const p=phone(v);return p?`${p.slice(0,4)} ${p.slice(4,7)} ${p.slice(7,9)} ${p.slice(9)}`:v||'—';};
const money=v=>{const n=Number(String(v||'0').replace(',','.'));return Number.isFinite(n)?new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(n):esc(v);};
const date=v=>{if(!v)return '—';const d=new Date(v);return isNaN(d.getTime())?esc(v):new Intl.DateTimeFormat('tr-TR',{day:'numeric',month:'short',year:'numeric'}).format(d);};
let toastTimer,searchTimer,deferredInstall;
function toast(message){const e=document.getElementById('toast');e.textContent=message;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),5000);}
function errText(error){const m=error?.message||'';return /Sipariş|Geçersiz|kontrol edin|adedi|tutarı|Satıcı|yalnızca|Yalnızca|Şehir|alan|gerekli/i.test(m)?m:'İşlem tamamlanamadı. Bağlantınızı kontrol edip tekrar deneyin.';}
function installCard(){return isInstalled()?'':`<div class="install-card install-app-card"><img src="assets/siparis-takip-mobile-192.png" alt="" width="44" height="44"><div><strong>Sipariş Takip</strong><p>Telefonuna ekle, uygulama gibi aç.</p></div><button type="button" data-action="install">Ana Ekrana Ekle</button></div>`;}
function isInstalled(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone;}
function renderLogin(admin=false){S.admin=admin;app.innerHTML=`<section class="login">${signature()}<div class="row"><div class="brand-icon mobile-app-mark"><img src="assets/siparis-takip-mobile-192.png" alt="" width="44" height="44"></div><div><div class="brand-title">Sipariş Takip</div><div class="sub">SATIŞTAN TESLİMATA</div></div></div><div class="login-art"><div class="box-art">${icon('box')}</div><div class="mini-tag">${icon('check')} Her adım kontrolünde</div></div><div class="eyebrow">${admin?'YÖNETİCİ GİRİŞİ':'SATICI PANELİ'}</div><h1>${admin?'Hesapları yönet.':'Siparişlerin,<br>hep yanında.'}</h1><p class="intro">${admin?'Mevcut Gazi yönetici hesabınla giriş yap.':'Kargolarını takip et, bekleyen siparişlerini kolayca düzenle.'}</p><form id="login-form"><div class="field"><label for="username">${admin?'E-posta adresi':'Telefon numaran'}</label><input id="username" name="username" type="${admin?'email':'tel'}" inputmode="${admin?'email':'tel'}" autocomplete="username" placeholder="${admin?'Yönetici e-postan':'05xx xxx xx xx'}" required ${admin?'':'maxlength="20"'}></div><div class="field"><label for="password">Şifren</label><div class="password-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Şifreni gir" required><button type="button" data-action="toggle-password" aria-label="Şifreyi göster">${icon('eye')}</button></div></div><p id="login-error" class="form-error" role="alert"></p><button class="primary" type="submit">Giriş yap ${icon('arrow')}</button></form><p class="hint">${admin?'Satıcı hesaplarını oluşturabilir ve şifrelerini yenileyebilirsin.':'Hesabın yöneticin tarafından açılır. Şifreni unuttuysan yöneticinle iletişime geç.'}</p>${installCard()}<div class="login-footer"><span>${icon('shield')} Güvenli, kişisel erişim</span><button class="text-btn" data-action="login-mode">${admin?'Satıcı girişi':'Yönetici girişi'}</button></div></section>`;}
function header(){return `<header class="topbar topbar--compact">${signature()}<button class="icon-btn" data-action="refresh" aria-label="Siparişleri yenile">${icon('refresh')}</button></header>${navigator.onLine?'':'<div class="offline">Çevrimdışısın. Güncel kayıtlar için internete bağlan.</div>'}`;}
function nav(){return `<nav class="bottom-nav" aria-label="Ana menü">${[['home','home','Özet'],['orders','list','Siparişler'],['shipments','truck','Kargolar'],...(S.admin?[['reports','chart','Raporlar']]:[]),['account','user','Hesabım']].map(([t,i,l])=>`<button class="nav-item ${S.tab===t?'active':''}" data-tab="${t}" ${S.tab===t?'aria-current="page"':''}>${icon(i)}${l}</button>`).join('')}</nav>`;}
function signature(){return '<div class="oz-signature"><span></span><b>-Oz Yazılım-</b><span></span></div>';}
function overview(){const c=S.counts;return `<section class="overview"><div class="overview-top"><div><div class="eyebrow">TOPLAM SİPARİŞİN</div><div class="big-num">${c.all??'—'}</div></div><button class="problem-stat" data-filter="problem"><span>DESTEK / TESLİM EDİLEMEDİ</span><strong>${c.undelivered==null?'—':(c.undelivered+(c.support||0))}</strong><small>Siparişleri gör ${icon('chevron')}</small></button></div><div class="overview-grid">${[['pending','Bekleyen'],['inTransit','Kargoda'],['delivered','Teslim edildi'],['handover','DHL Alımı Bekleyen']].map(([s,l])=>`<button class="stat ${s==='handover'?'stat-handover':''}" aria-pressed="${S.filter===(s==='inTransit'?'in_transit':s)}" data-filter="${s==='inTransit'?'in_transit':s}"><strong>${s==='inTransit'?(c.shipped==null?'—':c.shipped+(c.arrived||0)+(c.distribution||0)):(c[s]??'—')}</strong><span>${l}</span></button>`).join('')}</div></section>`;}
const trackingText=v=>String(v||'').replace(/_/g,' ').trim();
function orderLabel(o){if(hasReturnLabel(o))return 'İade etiketi oluşturuldu';return labels[o.status]||(o.status==='problem'?'Destek Gerekiyor':'Kargoda');}
function cargoMovementTime(event) {
  function parse(value) {
    let text = String(value ?? "").trim();
    const local = text.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(.*)$/);
    if (local) text = local[3] + "-" + local[2].padStart(2, "0") + "-" + local[1].padStart(2, "0") + local[4];
    const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?(Z|[+-]\d{2}:?\d{2})?$/i);
    if (!m) return null;
    const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4] || 0, m[5] || 0, m[6] || 0].map(Number);
    const ms = Number((m[7] || "").padEnd(3, "0"));
    const utc = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const date = new Date(utc);
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
        date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) return null;
    // DHL dates without an offset are recorded in Türkiye time.
    let offset = 180;
    if (m[8]) {
      if (m[8].toUpperCase() === "Z") offset = 0;
      else {
        const zone = m[8].replace(":", "");
        const hours = Number(zone.slice(1, 3)), minutes = Number(zone.slice(3, 5));
        if (hours > 23 || minutes > 59) return null;
        offset = (hours * 60 + minutes) * (zone[0] === "-" ? -1 : 1);
      }
    }
    return { time: utc - offset * 60000, hasTime: m[4] !== undefined };
  }
  const dates = [event?.eventDateTime2, event?.eventDateTime].map(parse).filter(Boolean);
  return (dates.find(date => date.hasTime) || dates[0])?.time ?? -Infinity;
}

function sortCargoMovements(movements) {
  if (!Array.isArray(movements)) return [];
  return movements.map((event, index) => ({event, index, time: cargoMovementTime(event)}))
    .sort((a, b) => b.time - a.time || a.index - b.index)
    .map(item => item.event);
}


function trackingEvents(o){return sortCargoMovements(o.kargo_hareketleri);}
function branchPhone(value){const first=String(value||'').split(/\s+[-–/]\s+|[,;]/)[0],digits=first.replace(/\D/g,'');const local=/^0[2-5]\d{9}$/.test(digits)?digits:/^[2-5]\d{9}$/.test(digits)?'0'+digits:/^90[2-5]\d{9}$/.test(digits)?'0'+digits.slice(2):/^0090[2-5]\d{9}$/.test(digits)?'0'+digits.slice(4):null;return local?{href:'+90'+local.slice(1),label:`${local.slice(0,4)} ${local.slice(4,7)} ${local.slice(7,9)} ${local.slice(9)}`}:null;}
function destinationBranch(events){
 const branchKey=e=>String(e.locationAddress||e.location||'').trim().toLocaleLowerCase('tr-TR');
 const atDestination=e=>/varış (?:birimine|şubesi|şubesinde)|varis (?:birimine|subesi|subesinde)|arrives at destination|teslim edilemedi|undelivered/i.test(trackingText(e.eventStatus))||String(e.eventSequence)==='3';
 const arrival=events.find(atDestination)||events.find(e=>/adresinize yönlendirildi|teslim edildi|out for delivery|^delivered$/i.test(trackingText(e.eventStatus)));
 if(!arrival||!branchKey(arrival)||/aktarma|transfer hub/i.test(branchKey(arrival)))return null;
 const matches=events.filter(e=>branchKey(e)===branchKey(arrival)),contact=matches.map(e=>branchPhone(e.locationPhone)).find(Boolean);
 return {name:String(arrival.locationAddress||arrival.location).trim(),index:events.indexOf(matches[0]),phone:contact||null};
}
function destinationContact(events){const branch=destinationBranch(events);return branch?.phone?{index:branch.index,...branch.phone}:null;}
function trackingMarkup(o){if(!o.kargo_takip_kodu&&!o.shipmentStatus)return '';const events=trackingEvents(o),contact=destinationContact(events),current=trackingText(o.shipmentStatus)||trackingText(events[0]?.eventStatus)||trackingText(o.kargo_durumu)||'Durum bekleniyor';return `<details class="tracking"><summary><div><div class="tracking-label">KARGO TAKİBİ</div><strong>${esc(current)}</strong><div class="tracking-time">${esc(o.kargo_gunc_saat||events[0]?.eventDateTime||'')}</div></div>${icon('chevron','tracking-arrow')}</summary><div class="tracking-body">${o.kargo_takip_kodu?`<div class="tracking-code">Takip no: ${esc(o.kargo_takip_kodu)}</div>`:''}${events.length?`<ol class="tracking-events">${events.map((e,i)=>`<li class="${i===0?'latest':''}"><strong>${esc(trackingText(e.eventStatus)||'Kargo hareketi')}</strong><time>${esc(e.eventDateTime||e.eventDateTime2||'')}</time><span>${esc([e.location,e.locationAddress].filter(Boolean).join(' · '))}${contact?.index===i?` <a class="branch-phone" href="tel:${contact.href}" aria-label="Varış şubesini ara: ${esc(e.locationAddress||e.location)}">${icon('phone')} ${esc(contact.label)}</a>`:''}</span>${e.description?`<p>${esc(e.description)}</p>`:''}</li>`).join('')}</ol>`:'<p class="hint">Geçmiş kargo hareketleri henüz sisteme gelmedi.</p>'}</div></details>`;}
function canEdit(o){return o?.status==='pending'&&o.kargo_durumu==='Bekliyor';}
function customerPhoneMarkup(o){const d=String(o.musteri_tel||'').replace(/\D/g,'');const p=/^0\d{10}$/.test(d)?d:/^\d{10}$/.test(d)?'0'+d:/^90\d{10}$/.test(d)?'0'+d.slice(2):/^0090\d{10}$/.test(d)?'0'+d.slice(4):null;if(!p)return '<span class="customer-phone-missing">Müşteri telefonu yok</span>';const label=p.slice(0,4)+' '+p.slice(4,7)+' '+p.slice(7,9)+' '+p.slice(9);return '<a class="customer-phone" href="tel:+90'+p.slice(1)+'" aria-label="Müşteriyi ara: '+esc(o.ad_soyad||'')+'">'+icon('phone')+' '+esc(label)+'</a>';}
function whatsappOrderMessage(o){
 const tracking=String(o.kargo_takip_kodu||'').trim(),events=trackingEvents(o);
 const status=trackingText(o.shipmentStatus)||trackingText(events[0]?.eventStatus)||trackingText(o.kargo_durumu)||labels[o.status]||'';
 const emoji={delivered:'\u2705',returning:'\u21A9\uFE0F',undelivered:'\u26A0\uFE0F',support:'\u26A0\uFE0F',distribution:'\u{1F69A}',arrived:'\u{1F4CD}',pending:'\u23F3',prepared:'\u{1F4E6}',cancelled:'\u274C'}[o.status]||'\u{1F69A}';
 const lines=['Merhaba \u{1F44B}'];
 if(tracking)lines.push(`\u{1F69A} DHL Kargo\n\u{1F50E} Gönderi takip numaranız: ${tracking}`);
 if(status)lines.push(`${emoji} Siparişiniz ${status}${/aşamasında[.!]?$/i.test(status)?'':' aşamasında'}.`);
 else lines.push('\u{1F4E6} Siparişiniz hakkında bilgi vermek için yazıyorum.');
 if(['undelivered','arrived','support'].includes(o.status)){
  const branch=destinationBranch(events);
  if(branch)lines.push(`\u{1F4CD} Varış şubesi: ${branch.name}${branch.phone?`\n\u260E\uFE0F Şube telefonu: ${branch.phone.label}`:''}`);
 }
 return lines.join('\n\n');
}
function whatsappContactMarkup(o){const p=phone(o.musteri_tel);if(!p)return '';const message=whatsappOrderMessage(o);const href='https://api.whatsapp.com/send?phone=90'+p.slice(1)+'&text='+encodeURIComponent(message);return '<a class="whatsapp-contact" href="'+esc(href)+'" target="_blank" rel="noopener noreferrer" aria-label="Müşteriyle WhatsApp üzerinden yazış: '+esc(o.ad_soyad||'')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5A11.8 11.8 0 0 0 12 .1C5.4.1.1 5.4.1 12c0 2.1.5 4.1 1.6 5.9L0 24l6.3-1.7A12 12 0 0 0 12 23.8h.1c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.5-8.4ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4A9.8 9.8 0 1 1 12 21.8Zm5.4-7.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.3-.5-2.5-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.8.4-.3.3-1.1 1.1-1.1 2.6s1.1 3 1.3 3.2c.1.2 2.2 3.4 5.4 4.8.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z"/></svg></a>';}
function orderDate(value){
 const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})(?:T| |$)/);
 if(!match)return '—';
 const [,year,month,day]=match;
 const d=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
 return d.getUTCFullYear()===Number(year)&&d.getUTCMonth()===Number(month)-1&&d.getUTCDate()===Number(day)?`${day}.${month}.${year}`:'—';
}
function packageCountMarkup(value){
 const count=Number(value),valid=Number.isSafeInteger(count)&&count>=1&&count<=100;
 const hue=valid?(count===1?42:((count-1)*137.508+145)%360):null;
 return `<span class="package-count${valid?(count===1?' package-count--gold':''):' package-count--empty'}"${valid?` style="--count-hue:${hue.toFixed(3)}"`:''} aria-label="${valid?count+' paket':'Paket adedi belirtilmemiş'}">${valid?count:'—'}</span>`;
}
function hasReturnLabel(o){return Boolean(String(o?.iade_kodu||'').trim());}
function safeReturnLabel(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='mn.tc'&&!u.username&&!u.password&&!u.port&&u.pathname==='/'&&/^[A-Za-z0-9]+$/.test(u.searchParams.get('rtnid')||'')?u.href:null;}catch{return null;}}
function returnLabelMarkup(o){if(!hasReturnLabel(o))return '';const url=safeReturnLabel(o.iade_etiket_url);return `<section class="return-label"><div><strong>İade etiketi oluşturuldu</strong><p>İade kodu: ${esc(o.iade_kodu)}</p>${o.iade_tarihi?`<p>${date(o.iade_tarihi)}</p>`:''}</div>${url?`<a class="return-label-open" href="${esc(url)}" target="_blank" rel="noopener noreferrer">İade Fişini Aç ${icon('arrow')}</a>`:'<span class="hint">Fiş bağlantısı henüz yok.</span>'}</section>`;}
async function loadCustomerNoteIcons(orders){
 const ids=orders.map(o=>Number(o.siparis_no)).filter(n=>Number.isSafeInteger(n)&&n>0);if(!ids.length)return;
 try{const {data,error}=await db.rpc('seller_customer_notes',{p_order_ids:ids});if(error)throw error;for(const o of orders)o.customer_note=String(data?.[String(o.siparis_no)]||'');}
 catch{toast('Müşteri notları yüklenemedi. Yenile düğmesiyle tekrar deneyin.');}
}
function customerNoteIcon(o){return String(o.customer_note||'').trim()?`<button type="button" class="customer-note-card" data-action="customer-note" data-note-order="${Number(o.siparis_no)}"><span>Müşteri notu</span><strong>${esc(o.customer_note)}</strong></button>`:'';}
function showCustomerNote(id){const o=S.orders.find(o=>Number(o.siparis_no)===Number(id));if(!o?.customer_note)return;++detailRequest;S.detail=null;sheet.innerHTML=`<div class="sheet-head"><div><div class="eyebrow">MÜŞTERİ NOTU</div><h2 id="sheet-title">${esc(o.ad_soyad||'Müşteri')}</h2></div><button class="icon-btn" type="button" data-action="close-sheet" aria-label="Kapat">${icon('close')}</button></div><div class="sheet-content customer-note-readonly"><p>${esc(o.customer_note)}</p><button type="button" class="secondary" data-action="close-sheet">Kapat</button></div>`;if(!sheet.open)sheet.showModal();}
function hasZeroOrderTotal(value) {
  if (typeof value === "number") return Number.isFinite(value) && value === 0;
  if (typeof value !== "string" || !value.trim()) return false;
  const amount = value.trim().replace(/\s*(?:TL|TRY|₺)\s*$/i, "").replace(/\s/g, "");
  return /^[+-]?0+(?:[.,]0+)*$/.test(amount);
}
function deliveryBadge(o){return o.subeden_teslim===true?'<span class="badge branch-delivery">Şubeden teslim</span>':'';}
function originalMessageCard(o){return `<details class="card-original-message" data-original-message="${Number(o.siparis_no)}"><summary>Orjinal mesaj <span class="original-message-arrow" aria-hidden="true"></span></summary><div class="original-message-text" role="status">Mesajı görmek için açın.</div></details>`;}
document.addEventListener('toggle',async event=>{
 const panel=event.target;
 if(!panel.matches||!panel.matches('details[data-original-message]')||!panel.open||panel.dataset.loaded||panel.dataset.loading)return;
 const content=panel.querySelector('.original-message-text');
 panel.dataset.loading='true';content.textContent='Orjinal mesaj yükleniyor…';
 try{
  const {data,error}=await db.rpc('seller_original_order_message',{p_id:Number(panel.dataset.originalMessage)});
  if(error)throw error;
  content.textContent=data?.message||'Bu siparişin orjinal mesajı kayıtlı değil.';
  panel.dataset.loaded='true';
 }catch(error){content.textContent='Mesaj alınamadı. Kapatıp yeniden açarak tekrar deneyin.';}
 finally{delete panel.dataset.loading;}
},true);
function card(o){return `<article class="order${hasZeroOrderTotal(o.toplam_tutar)?' order-zero-total':''}"><div class="order-open" role="button" tabindex="0" data-order="${o.siparis_no}" aria-label="${esc(o.ad_soyad)}, sipariş ${o.siparis_no}, ${esc(orderLabel(o))}"><div class="order-header"><div class="order-meta">${o.subeden_teslim===true?'<div class="order-delivery-badges">'+deliveryBadge(o)+'</div>':''}<span class="order-id" aria-label="Sipariş ${o.siparis_no}">#${o.siparis_no}</span><span class="order-date" aria-label="Sipariş tarihi: ${orderDate(o.tarih)}">${orderDate(o.tarih)}</span><span class="badge ${hasReturnLabel(o)?'return-label-status':o.status}">${esc(o.status==='undelivered'?'Teslim Edilemedi':orderLabel(o))}</span></div></div><div class="order-body"><div class="parcel-stack">${packageCountMarkup(o.kargo_adet)}<div class="parcel">${icon(o.status==='delivered'?'check':'box')}</div></div><div class="customer-info"><div class="customer">${esc(o.ad_soyad||'İsimsiz müşteri')}</div>${customerNoteIcon(o)}<div class="product">${esc(o.urun_bilgisi||'Ürün bilgisi yok')}</div><div class="sub">${esc(o.sehir||'—')} ${o.ilce?'· '+esc(o.ilce):''}<div class="customer-contacts">${customerPhoneMarkup(o)}${whatsappContactMarkup(o)}</div></div></div></div>${o.status==='support'&&o.teslimat_aciklama?`<p class="support-reason">${icon('shield')} ${esc(o.teslimat_aciklama)}</p>`:''}${returnLabelMarkup(o)}<div class="order-footer"><span class="price">${money(o.toplam_tutar)}</span><span class="order-action">${canEdit(o)?'Düzenle':'Siparişi gör'} ${icon(canEdit(o)?'edit':'chevron')}</span></div></div>${CustomerOrderHistory.markup(o)}${originalMessageCard(o)}${trackingMarkup(o)}</article>`;}
function renderShell(){app.innerHTML=`<div class="shell">${header()}${S.tab==='reports'&&S.admin?reportMarkup():S.tab==='account'?accountMarkup():`<section class="hero"><div class="eyebrow">${S.tab==='home'?'HER ADIMDA YANINDA':S.tab==='shipments'?'GÖNDERİLERİN':'SANA ÖZEL'}</div><h1>${S.tab==='home'?'Bugün ne durumda?':S.tab==='shipments'?'Yoldaki siparişlerin.':'Bekleyen siparişlerin.'}</h1><p>${S.tab==='home'?'Siparişten teslimata, tüm süreç tek yerde.':S.tab==='shipments'?'Kargolarının son durumunu kolayca kontrol et.':'Bekleyenleri düzenle, diğerlerini takip et.'}</p></section>${S.tab==='home'?overview():''}<div class="section-head"><h2>${S.tab==='home'?'Siparişlerin':'Sipariş listesi'}</h2><span id="result-count">${S.total} kayıt</span></div><div class="search">${icon('search')}<input id="search" type="search" placeholder="Sipariş no, müşteri, kargo kodu…" aria-label="Sipariş ara" value="${esc(S.search)}" maxlength="100"></div><div class="chips">${Object.keys(labels).map(k=>`<button class="chip ${S.filter===k?'active':''}" data-filter="${k}" aria-pressed="${S.filter===k}">${labels[k]}<small>${S.counts[k]??''}</small></button>`).join('')}</div><div id="orders">${S.orders.map(card).join('')||'<div class="empty">'+icon('box')+'<div>Bu filtreye uygun sipariş bulunmuyor.</div></div>'}</div><div id="pagination">${pagination()}</div><p class="status-note">${S.updated?'Panel yenileme: '+esc(S.updated)+'. ':''}Kargo durumları sistemdeki son DHL güncellemesini gösterir.</p>${S.tab==='home'?installCard():''}`}</div>${nav()}`;}
function reportDates(){const d=new Date(),today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Istanbul'}).format(d);if(!S.reportEnd)S.reportEnd=today;if(!S.reportStart)S.reportStart=today.slice(0,8)+'01';}
function reportMarkup(){reportDates();const r=S.report,rows=r?.sellers||[],metric=S.reportMetric,max=Math.max(1,...rows.map(x=>Number(x[metric])||0));return `<section class="hero"><div class="eyebrow">YÖNETİCİ RAPORU</div><h1>Kim ne kadar sattı?</h1><p>Sipariş tarihine göre satıcı karşılaştırması.</p></section><form id="report-form" class="report-form"><div class="form-grid"><div class="field"><label for="start">Başlangıç</label><input id="start" name="start" type="date" value="${esc(S.reportStart)}" required></div><div class="field"><label for="end">Bitiş (dahil)</label><input id="end" name="end" type="date" value="${esc(S.reportEnd)}" required></div></div><button class="primary" type="submit" ${S.reportLoading?'disabled':''}>${S.reportLoading?'Sorgulanıyor…':'Raporu getir'}</button></form>${S.reportError?'<p class="form-error" role="alert">'+esc(S.reportError)+'</p>':''}${r?`<div class="report-totals"><div><span>Sipariş tutarı</span><strong>${money(r.amount)}</strong></div><div><span>Sipariş sayısı</span><strong>${r.orders}</strong></div></div><p class="hint">${date(r.start)} – ${date(r.end)} · İptal ve silinen siparişler hariç. Tutar, kayıtlı sipariş bedelidir; tahsilat veya net kazanç değildir. İade/sorunlu siparişler toplamda yer alır ve ayrıca gösterilir.${r.invalid_amounts?' '+r.invalid_amounts+' kaydın tutarı okunamadığı için tutar toplamına eklenmedi.':''}</p><div class="chips"><button class="chip ${metric==='amount'?'active':''}" data-action="report-metric" data-metric="amount">Tutar (₺)</button><button class="chip ${metric==='orders'?'active':''}" data-action="report-metric" data-metric="orders">Sipariş adedi</button></div><div class="report-chart" role="img" aria-label="Satıcıların ${metric==='amount'?'sipariş tutarı':'sipariş sayısı'} karşılaştırması">${rows.map(x=>`<div class="report-bar-row"><div class="between row"><span>${esc(x.name||pretty(x.phone)||'Satıcı belirtilmemiş')}</span><strong>${metric==='amount'?money(x.amount):x.orders+' sipariş'}</strong></div><div class="report-track"><div class="report-bar" style="width:${Math.max(0,Math.min(100,100*Number(x[metric])/max))}%"></div></div></div>`).join('')||'<div class="empty">Bu tarih aralığında sipariş yok.</div>'}</div><div class="report-table-wrap"><table class="report-table"><caption>Satıcı satış dökümü</caption><thead><tr><th>Satıcı</th><th>Adet</th><th>Tutar</th><th>Sorunlu / İade</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.name||pretty(x.phone))}</td><td>${x.orders}</td><td>${money(x.amount)}</td><td>${x.problem_orders}</td></tr>`).join('')}</tbody></table></div>`:''}`;}
async function loadReport(){if(!S.user||!S.admin||S.tab!=='reports')return;reportDates();if(S.reportStart>S.reportEnd){S.reportError='Başlangıç tarihi bitiş tarihinden sonra olamaz.';renderShell();return;}if(!navigator.onLine){S.reportError='Rapor için internete bağlan.';renderShell();return;}const id=++S.reportRequest;S.reportLoading=true;S.reportError='';S.report=null;renderShell();const {data,error}=await db.rpc('admin_sales_report',{p_start:S.reportStart,p_end:S.reportEnd});if(id!==S.reportRequest||!S.user||!S.admin||S.tab!=='reports')return;S.reportLoading=false;if(error)S.reportError=errText(error);else S.report=data;renderShell();}
function pagination(){return S.orders.length<S.total?'<button class="secondary load-more" data-action="more">Daha fazla göster</button>':'';}
async function loadOrders(append=false){if(!S.user||S.manageAccounts||(S.tab==='account'||S.tab==='reports'))return;if(!navigator.onLine){toast('Güncel siparişler için internete bağlan.');return;}const id=++S.request;S.offset=append?S.orders.length:0;const target=document.getElementById('orders');if(!append&&target)target.innerHTML='<div class="skeleton"></div><div class="skeleton"></div>';const {data,error}=await db.rpc(S.admin?'admin_orders':'seller_orders',{p_filter:S.filter,p_search:S.search,p_offset:S.offset});if(id!==S.request||!S.user)return;if(error){if(target)target.innerHTML='<div class="error-box">'+esc(errText(error))+'<button class="text-btn" data-action="refresh">Tekrar dene</button></div>';return;}await Promise.all([loadCustomerNoteIcons(data.orders||[]),CustomerOrderHistory.load(db,data.orders||[])]);if(id!==S.request||!S.user)return;S.orders=append?[...S.orders,...data.orders]:data.orders;S.counts=data.counts;S.total=data.total;S.updated=new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});if(document.activeElement?.id==='search'){document.getElementById('orders').innerHTML=S.orders.map(card).join('')||'<div class="empty">Sonuç bulunamadı.</div>';document.getElementById('pagination').innerHTML=pagination();document.getElementById('result-count').textContent=S.total+' kayıt';}else renderShell();}
function accountMarkup(){if(S.admin)return adminAccountMarkup();return `<section class="hero"><div class="eyebrow">KİŞİSEL ALANIN</div><h1>Hesabım.</h1><p>Güvenli erişimin, telefonunda.</p></section><div class="account-card"><div class="row"><div class="avatar">${icon('user')}</div><div><h3>${esc(pretty(S.user.app_metadata.seller_phone))}</h3><div class="sub">Satıcı hesabı</div></div></div><div class="info-row">${icon('shield')} Yalnızca kendi siparişlerini görürsün.</div><div class="info-row">${icon('edit')} Bekleyen siparişlerini düzenleyebilirsin.</div><div class="info-row">${icon('lock')} Hazırlanan ve kargodaki siparişler yalnızca görüntülenir.</div></div><button class="secondary" data-action="password-change">${icon('lock')} Şifremi değiştir</button>${installCard()}<button class="text-btn" data-action="logout">Güvenli çıkış yap</button>`;}
function adminAccountMarkup(){return `<section class="hero"><div class="eyebrow">YÖNETİCİ HESABI</div><h1>Hesabım.</h1><p>Tüm siparişler senin kontrolünde.</p></section><div class="account-card"><h3>${esc(pretty(S.user.app_metadata.admin_phone||CFG.adminPhone))}</h3><div class="sub">Yönetici · ${esc(S.user.email)}</div><div class="info-row">${icon('shield')} Tüm satıcıların siparişlerini görebilirsin.</div><div class="info-row">${icon('edit')} Yalnızca hazırlanmamış (bekleyen) siparişleri düzenleyebilirsin.</div></div><button class="secondary" data-action="manage-sellers">${icon('user')} Satıcı hesaplarını yönet</button><button class="secondary" data-action="password-change">${icon('lock')} Şifremi değiştir</button>${installCard()}<button class="text-btn" data-action="logout">Güvenli çıkış yap</button>`;}
async function authenticate(form){const button=form.querySelector('[type=submit]'),errorBox=document.getElementById('login-error');button.disabled=true;errorBox.textContent='';const username=form.username.value.trim(), p=phone(username);if(!S.admin&&!p){errorBox.textContent='Geçerli bir cep telefonu numarası gir.';button.disabled=false;return;}const {data,error}=await db.auth.signInWithPassword({email:S.admin?username:p===CFG.adminPhone?CFG.adminEmail:p+'@'+CFG.sellerEmailDomain,password:form.password.value});form.password.value='';if(error){errorBox.textContent='Telefon/e-posta veya şifre hatalı. Hesabının açıldığından emin ol.';button.disabled=false;return;}await enter(data.user);}
async function enter(user){const m=user.app_metadata||{};if(m.role!=='seller'&&!(m.firma==='gazi'&&m.role!=='seller')){await db.auth.signOut();renderLogin();toast('Bu hesabın panele erişim izni yok.');return;}if(m.role==='seller'&&!phone(m.seller_phone)){await db.auth.signOut();renderLogin();toast('Hesap sahipliği doğrulanamadı.');return;}S.user=user;S.admin=m.role!=='seller';S.tab='home';S.manageAccounts=false;renderShell();await loadOrders();}
let detailRequest=0;
async function showOrder(id){if(!navigator.onLine){toast('Sipariş detayı için internete bağlan.');return;}const request=++detailRequest;const {data,error}=await db.rpc(S.admin?'admin_order_detail':'seller_order_detail',{p_id:Number(id)});if(request!==detailRequest||!S.user)return;if(error){toast(errText(error));return;}S.detail=data;renderDetail();if(!sheet.open)sheet.showModal();}
function cancelPendingOrder(){
 if(!canEdit(S.detail))return;
 sheet.innerHTML=sheetHeader('Bekleyen siparişi iptal et')+`<div class="sheet-content"><p class="hint">#${S.detail.siparis_no} · ${esc(S.detail.ad_soyad)}<br>İptal açıklaması Gazi panelinde de görünecek.</p><form id="cancel-order-form"><div class="field"><label for="cancel_reason">İptal açıklaması</label><textarea id="cancel_reason" name="reason" required minlength="3" maxlength="2000" rows="4" placeholder="Siparişi neden iptal ediyorsun?"></textarea></div><p id="cancel-error" class="form-error" role="alert"></p><button type="submit" class="primary cancel-order-confirm">Açıklamayla iptal et</button><button type="button" class="secondary" data-action="cancel-order-back">Vazgeç</button></form></div>`;
}
let cancellingOrder=false;
async function saveCancelPending(form){
 if(cancellingOrder||!canEdit(S.detail))return;
 const reason=form.reason.value.trim(),errorBox=document.getElementById('cancel-error');
 if(reason.length<3){errorBox.textContent='İptal açıklaması en az 3 karakter olmalı.';return;}
 if(!navigator.onLine){errorBox.textContent='İptal için internete bağlan.';return;}
 const order=S.detail,userId=S.user?.id,button=form.querySelector('[type="submit"]');
 cancellingOrder=true;button.disabled=true;errorBox.textContent='';
 try{
  const {data,error}=await db.rpc(S.admin?'admin_cancel_pending':'seller_cancel_pending',{p_id:order.siparis_no,p_reason:reason,p_original:order});
  if(S.user?.id!==userId)return;
  if(error)throw error;
  if(S.detail?.siparis_no===order.siparis_no){++detailRequest;S.detail=data;renderDetail();}
  toast('Sipariş açıklamanla birlikte iptal edildi.');await loadOrders();
 }catch(error){if(form.isConnected)errorBox.textContent=errText(error);else toast(errText(error));}
 finally{cancellingOrder=false;button.disabled=false;}
}
function sheetHeader(title){return `<div class="sheet-head"><h2 id="sheet-title">${title}</h2><button class="icon-btn" data-action="close-sheet" aria-label="Kapat">${icon('close')}</button></div>`;}
function safeTracking(url){try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}}
function renderDetail(){
 const o=S.detail,track=safeTracking(o.kargo_takip_url);
 sheet.innerHTML=sheetHeader('Sipariş #'+o.siparis_no)+`<div class="sheet-content" id="orderDetails">
 <section class="detail-overview" aria-label="Sipariş özeti"><div class="detail-overview-main"><span class="detail-eyebrow">SİPARİŞ #${o.siparis_no}</span><h3>${esc(o.ad_soyad||'Müşteri')}</h3><div class="detail-overview-status"><span class="badge ${hasReturnLabel(o)?'return-label-status':o.status}">${esc(orderLabel(o))}</span>${deliveryBadge(o)}</div></div><div class="detail-overview-total"><strong>${money(o.toplam_tutar)}</strong><span>${esc(o.odeme_sekli||'Belirtilmemiş')}</span></div></section>
 <div class="detail-compact-meta">${customerPhoneMarkup(o)}<span>${date(o.tarih)}</span>${o.siparis_alan?'<span class="detail-taker">Sipariş alan: '+esc(pretty(o.siparis_alan))+'</span>':''}</div>
 <div class="detail-layout"><div class="detail-group detail-block"><div class="detail-title">Teslimat adresi</div><div class="detail-delivery-type">${o.subeden_teslim===true?'Şubeden teslim'+(o.teslim_subesi?' · '+esc(o.teslim_subesi):''):'Adrese teslim'}</div>${o.teslim_sekli_kontrol?'<p class="support-detail-reason" role="alert">Teslim şeklini kontrol edin.</p>':''}<p class="detail-address-text">${esc(o.adres||'—')}</p><div class="detail-city-line"><strong>${esc(o.sehir||'—')} / ${esc(o.ilce||'—')}</strong></div><div class="detail-address-tools">Kodlar: ${esc(o.sehir_kodu||'—')} / ${esc(o.ilce_kodu||'—')}</div></div>
 <div class="detail-group detail-block"><div class="detail-title">Ürün bilgisi</div><div class="detail-product-lines">${esc(o.urun_bilgisi||'—')}</div><div class="detail-parcel-line">${packageCountMarkup(o.kargo_adet)}<strong>${esc(CargoWeights.display(o.kargo_kg,o.kargo_adet)||'—')} kg</strong></div></div>
 ${o.notlar?'<div class="detail-group detail-note"><div class="detail-title">Sipariş notu</div><div class="note-text">'+esc(o.notlar)+'</div></div>':''}</div>
 ${o.status==='support'&&o.teslimat_aciklama?'<div class="detail-group"><div class="detail-title">Destek gerekiyor</div><p>'+esc(o.teslimat_aciklama)+'</p></div>':''}
 ${returnLabelMarkup(o)}${trackingMarkup(o)}${o.iptal_nedeni?'<div class="detail-group"><div class="detail-title">İptal nedeni</div><p>'+esc(o.iptal_nedeni)+'</p></div>':''}${track?`<a class="secondary" href="${esc(track)}" target="_blank" rel="noopener noreferrer">${icon('truck')} DHL takip sayfası</a>`:''}</div>
 <div class="sheet-actions">${canEdit(o)?'<button type="button" class="cancel-order-button" data-action="cancel-order">Sipariş iptal</button><button class="primary" data-action="edit-order">'+icon('edit')+' Düzenle</button>':'<p class="hint">'+icon('lock')+' Bu aşamadaki siparişler yalnızca görüntülenir.</p>'}<button type="button" class="secondary sheet-close" data-action="close-sheet">Kapat</button></div>`;
}

const field=(key,label,value,extra='')=>`<div class="field"><label for="${key}">${label}</label><input id="${key}" name="${key}" value="${esc(value)}" ${extra}></div>`;
let branchSelector=null;
async function requestDeliveryBranches(body){
 const {data,error}=await db.auth.getSession();
 if(error||!data.session?.access_token)throw new Error('Oturum gerekli. Yeniden giriş yapın.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);
 try{
  const response=await fetch('https://n8n.ozkanceylan.uk/webhook/gazi_subeler',{method:'POST',body:new URLSearchParams({...body,accessToken:data.session.access_token,publicKey:CFG.supabaseKey}),signal:controller.signal});
  const result=await response.json();
  if(!response.ok||result.success!==true||result.environment!=='production'||!Array.isArray(result.branches))throw new Error(result.message||'Şube listesi alınamadı.');
  return result;
 }catch(error){throw new Error(error.name==='AbortError'?'Şube listesi zaman aşımına uğradı. Yeniden deneyin.':error.message||'Şube listesi alınamadı.');}
 finally{clearTimeout(timer);}
}
function deliveryFields(o){return `<div class="field"><label for="delivery_select">Teslim şekli</label><select id="delivery_select"><option value="" ${o.teslim_sekli_kontrol?'selected':''} disabled>Teslim şeklini seçin</option><option value="false" ${!o.teslim_sekli_kontrol&&!o.subeden_teslim?'selected':''}>Adrese teslim</option><option value="true" ${!o.teslim_sekli_kontrol&&o.subeden_teslim?'selected':''}>Şubeden teslim</option></select></div><div class="field" id="delivery_branch_field" ${o.subeden_teslim?'':'hidden'}><label for="delivery_branch_select">Teslim alınacak DHL şubesi</label><select id="delivery_branch_select" disabled><option>Önce il ve ilçe seçin</option></select><input type="hidden" id="delivery_branch" value="${esc(o.teslim_subesi||'')}"><p id="delivery_branch_info" class="hint" role="status"></p><button type="button" class="text-btn" id="delivery_branch_retry" hidden>Şubeleri yeniden getir</button></div>`;}
async function editOrder(){if(!S.detail||!canEdit(S.detail))return;const o=S.detail;branchSelector=null;if(!S.cities.length){const {data,error}=await db.from('sehir').select('id,name').order('name');if(error){toast('Şehir listesi alınamadı.');return;}S.cities=data;}const city=S.cities.find(c=>c.id===o.sehir_kodu)||S.cities.find(c=>c.name.toLocaleUpperCase('tr-TR')===(o.sehir||'').toLocaleUpperCase('tr-TR'));sheet.innerHTML=sheetHeader(S.admin?'Siparişi düzenle':'Bekleyen siparişi düzenle')+`<div class="sheet-content"><p class="hint">#${o.siparis_no} · Sipariş işleme alınırsa değişiklik kaydedilemez.</p><form id="edit-form">${field('ad_soyad','Müşteri adı',o.ad_soyad,'required maxlength="120" autocomplete="name"')}${field('musteri_tel','Müşteri telefonu',o.musteri_tel,'type="tel" inputmode="tel" required maxlength="20"')}<div class="form-grid"><div class="field"><label for="city">Şehir</label><select id="city" required><option value="">Şehir seç</option>${S.cities.map(c=>`<option value="${esc(c.id)}" ${city?.id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label for="district">İlçe</label><select id="district" required><option value="">İlçe seç</option></select></div></div>${deliveryFields(o)}<div class="field"><label for="adres">Adres</label><textarea id="adres" name="adres" required maxlength="1000">${esc(o.adres)}</textarea></div>${field('urun_bilgisi','Ürün bilgisi',o.urun_bilgisi,'required maxlength="1000"')}<div class="form-grid">${field('toplam_tutar','Tutar (₺)',o.toplam_tutar,'inputmode="decimal" required maxlength="12"')}${field('kargo_adet','Paket adedi',o.kargo_adet||'1','type="number" min="1" max="99" required')}</div>${field('kargo_kg','Paket KG (örnek: 5+10+5+6)',CargoWeights.display(o.kargo_kg,o.kargo_adet),'required maxlength="200" placeholder="5+10+5+6"')}${field('odeme_sekli','Ödeme şekli',o.odeme_sekli,'maxlength="100"')}<div class="field"><label for="notlar">Sipariş notu</label><textarea id="notlar" name="notlar" maxlength="2000">${esc(o.notlar)}</textarea></div><p id="edit-error" class="form-error" role="alert"></p><button type="submit" class="primary">Değişiklikleri kaydet ${icon('check')}</button></form></div>`;await loadDistricts(city?.id,o);
 if(!document.getElementById('delivery_select'))return;
 document.getElementById('delivery_select').addEventListener('change',event=>{document.getElementById('delivery_branch_field').hidden=event.target.value!=='true';});
 branchSelector=MobileBranches.bind({order:o,locked:false,request:requestDeliveryBranches});
}
async function loadDistricts(cityId,o=null){const select=document.getElementById('district');if(!select)return;select.disabled=true;select.innerHTML='<option value="">İlçe yükleniyor…</option>';if(!cityId){select.innerHTML='<option value="">Önce şehir seç</option>';select.disabled=false;return;}const {data,error}=await db.from('ilce').select('id,name,code').eq('city_id',cityId).order('name');if(!document.getElementById('district')||document.getElementById('city').value!==cityId)return;if(error){select.innerHTML='<option value="">İlçeler yüklenemedi</option>';select.disabled=false;return;}select.innerHTML='<option value="">İlçe seç</option>'+data.map(d=>`<option value="${esc(d.code)}" ${o&&(d.code===o.ilce_kodu||d.name.toLocaleUpperCase('tr-TR')===(o.ilce||'').toLocaleUpperCase('tr-TR'))?'selected':''}>${esc(d.name)}</option>`).join('');select.disabled=false;}
async function saveEdit(form){if(!canEdit(S.detail)){toast('Yalnızca hazırlanmamış siparişleri düzenleyebilirsin.');return;}const button=form.querySelector('[type=submit]'),errorBox=document.getElementById('edit-error');button.disabled=true;errorBox.textContent='';if(!navigator.onLine){errorBox.textContent='Kaydetmek için internete bağlan.';button.disabled=false;return;}const delivery=document.getElementById('delivery_select');
 if(!['true','false'].includes(delivery.value)){errorBox.textContent='Teslim şeklini seçin.';button.disabled=false;return;}
 if(delivery.value==='true'&&!branchSelector?.valid()){errorBox.textContent='Teslim alınacak DHL şubesini listeden seçin.';button.disabled=false;return;}
 const changes=Object.fromEntries(new FormData(form));
 changes.subeden_teslim=delivery.value==='true';changes.teslim_subesi=changes.subeden_teslim?document.getElementById('delivery_branch').value.trim():null;changes.teslim_sekli_kontrol=false;try{changes.kargo_kg=CargoWeights.normalize(changes.kargo_kg,changes.kargo_adet);}catch(error){errorBox.textContent=error.message;button.disabled=false;return;}changes.sehir_kodu=document.getElementById('city').value;changes.ilce_kodu=document.getElementById('district').value;const {data,error}=await db.rpc(S.admin?'admin_update_order':'seller_update_pending',{p_id:S.detail.siparis_no,p_changes:changes,p_original:S.detail});button.disabled=false;if(error){errorBox.textContent=errText(error);return;}S.detail=data;renderDetail();toast('Sipariş bilgileri kaydedildi.');await loadOrders();}
function renderAdmin(){app.innerHTML=`<div class="shell">${header()}<section class="hero"><div class="eyebrow">YÖNETİCİ ALANI</div><h1>Satıcı hesapları.</h1><button class="text-btn" data-action="orders-home">← Siparişlere dön</button><p>Telefonu doğrula, kişisel şifreyle hesabını aç.</p></section><div class="detail-block"><p class="hint">Liste “Sipariş Alan” telefonuna göre çıkarılır. Eski kayıtlarda hatalı numara olabilir; hesabı açmadan önce satıcıya ait olduğunu doğrula. Her hesap yalnızca o telefonla eşleşen siparişleri görür.</p></div><div id="admin-list" class="admin-list">${adminList()}</div><button class="text-btn" data-action="logout">Çıkış yap</button></div>`;}
function adminList(){return S.candidates.map(c=>`<div class="seller-row"><div class="row between"><div><h3>${esc(pretty(c.phone))}</h3><div class="sub">${c.orders} sipariş · ${c.user_id?'Hesap açık':'Henüz hesap yok'}</div></div><span class="badge ${c.user_id?'delivered':'pending'}">${c.user_id?'Aktif':'Yeni'}</span></div><div class="seller-actions"><button data-seller="${c.phone}" data-mode="${c.user_id?'reset':'create'}">${c.user_id?'Şifreyi yenile':'Hesap oluştur'}</button></div></div>`).join('')||'<div class="loading">Satıcılar yükleniyor…</div>';}
async function loadCandidates(){const {data,error}=await db.rpc('seller_admin_candidates');if(error){toast(errText(error));return;}if(!S.user||!S.admin)return;S.candidates=data;if(S.manageAccounts)renderAdmin();}
function sellerAccount(p,mode){sheet.innerHTML=sheetHeader(mode==='create'?'Satıcı hesabı oluştur':'Satıcı şifresini yenile')+`<div class="sheet-content"><h3>${esc(pretty(p))}</h3><p class="hint">Bu numaranın ilgili satıcıya ait olduğunu doğrula. Şifreyi satıcıya güvenli bir yolla kendin ilet.</p><form id="seller-form" data-phone="${p}" data-mode="${mode}"><div class="field"><label for="new_password">Kişisel şifre (en az 6 karakter)</label><div class="password-wrap"><input id="new_password" name="password" type="password" minlength="6" maxlength="128" autocomplete="new-password" required><button type="button" data-action="toggle-password" aria-label="Şifreyi göster">${icon('eye')}</button></div></div><button type="button" class="text-btn" data-action="generate-password">Güçlü şifre oluştur</button><p id="seller-error" class="form-error" role="alert"></p><button type="submit" class="primary">${mode==='create'?'Hesabı oluştur':'Şifreyi kaydet'}</button></form></div>`;sheet.showModal();}
async function saveSeller(form){const button=form.querySelector('[type=submit]'),errorBox=document.getElementById('seller-error');button.disabled=true;errorBox.textContent='';const {data,error}=await db.functions.invoke('seller-admin',{body:{phone:form.dataset.phone,action:form.dataset.mode,password:form.password.value}});button.disabled=false;if(error){let message='Hesap işlemi tamamlanamadı.';try{message=(await error.context.json()).error||message;}catch{}errorBox.textContent=message;return;}if(!data?.ok){errorBox.textContent=data?.error||'İşlem tamamlanamadı.';return;}form.password.value='';sheet.close();toast('Satıcı hesabı güncellendi. Şifreyi satıcıya güvenli yolla ilet.');await loadCandidates();}
function changePassword(){sheet.innerHTML=sheetHeader('Şifremi değiştir')+`<div class="sheet-content"><form id="password-form">${field('new_password','Yeni şifre','','type="password" minlength="6" maxlength="128" autocomplete="new-password" required')}${field('confirm_password','Yeni şifreyi tekrar gir','','type="password" minlength="6" maxlength="128" autocomplete="new-password" required')}<p id="password-error" class="form-error" role="alert"></p><button class="primary" type="submit">Şifreyi kaydet</button></form></div>`;sheet.showModal();}
async function savePassword(form){const b=form.querySelector('button'),e=document.getElementById('password-error');e.textContent='';if(form.new_password.value!==form.confirm_password.value){e.textContent='Şifreler eşleşmiyor.';return;}b.disabled=true;const {error}=await db.auth.updateUser({password:form.new_password.value});b.disabled=false;if(error){e.textContent='Şifre değiştirilemedi. Yeniden giriş yapıp tekrar dene.';return;}form.reset();sheet.close();toast('Şifren güncellendi.');}
async function install(){if(deferredInstall){await deferredInstall.prompt();const result=await deferredInstall.userChoice;if(result.outcome==='accepted')toast('Uygulama ana ekranına ekleniyor.');deferredInstall=null;return;}const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;sheet.innerHTML=sheetHeader('Ana ekranına ekle')+`<div class="sheet-content"><div class="detail-block"><h3>${ios?'iPhone / iPad':'Telefonunda uygulama gibi kullan'}</h3><p>${ios?'Safari’de bu sayfayı aç. Paylaş simgesine dokun, “Ana Ekrana Ekle”yi seç ve “Ekle”ye bas.':'Chrome’da sağ üstteki menüyü aç. “Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğine dokun.'}</p><p class="hint">Ana ekrandaki Sipariş Takip simgesinden paneline hızlıca girebilirsin.</p></div></div>`;if(!sheet.open)sheet.showModal();}
async function logout(){++S.reportRequest;S.report=null;S.reportError='';++S.request;++detailRequest;clearTimeout(searchTimer);S.user=null;S.manageAccounts=false;S.orders=[];S.counts={};S.candidates=[];S.detail=null;S.search='';S.filter='all';if(sheet.open)sheet.close();sheet.innerHTML='';const {error}=await db.auth.signOut({scope:'local'});renderLogin();if(error){await db.auth.signOut({scope:'local'});toast('Oturum kapatıldı.');}}
document.addEventListener('click',async event=>{if(event.target.closest('a.customer-phone,a.whatsapp-contact,a.branch-phone,a.return-label-open'))return;const el=event.target.closest('button,[data-order]');if(!el)return;if(el.dataset.order)return showOrder(el.dataset.order);if(el.dataset.tab){if(el.dataset.tab==='reports'&&!S.admin)return;clearTimeout(searchTimer);++S.request;++S.reportRequest;S.tab=el.dataset.tab;S.search='';S.orders=[];S.total=0;S.filter=S.tab==='shipments'?'in_transit':S.tab==='orders'?'pending':'all';renderShell();window.scrollTo(0,0);return S.tab==='reports'?loadReport():loadOrders();}if(el.dataset.filter){clearTimeout(searchTimer);++S.request;S.search='';S.filter=el.dataset.filter;S.orders=[];renderShell();return loadOrders();}if(el.dataset.seller)return sellerAccount(el.dataset.seller,el.dataset.mode);switch(el.dataset.action){case'customer-note':return showCustomerNote(el.dataset.noteOrder);case'login-mode':return renderLogin(!S.admin);case'toggle-password':{const input=el.parentElement.querySelector('input');input.type=input.type==='password'?'text':'password';el.setAttribute('aria-label',input.type==='password'?'Şifreyi göster':'Şifreyi gizle');break;}case'report-metric':S.reportMetric=el.dataset.metric;return renderShell();case'refresh':return S.manageAccounts?loadCandidates():S.tab==='reports'?loadReport():loadOrders();case'manage-sellers':if(!S.admin)return;S.manageAccounts=true;renderAdmin();return loadCandidates();case'orders-home':S.manageAccounts=false;S.tab='home';renderShell();return loadOrders();case'more':el.disabled=true;return loadOrders(true);case'close-sheet':sheet.close();break;case'cancel-order':return cancelPendingOrder();case'cancel-order-back':return renderDetail();case'edit-order':return editOrder();case'install':return install();case'logout':return logout();case'password-change':return changePassword();case'generate-password':{const values=crypto.getRandomValues(new Uint32Array(18));const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@';const input=document.getElementById('new_password');input.value=Array.from(values,n=>alphabet[n%alphabet.length]).join('');input.type='text';break;}}});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='report-form'){S.reportStart=e.target.start.value;S.reportEnd=e.target.end.value;loadReport();}if(e.target.id==='login-form')authenticate(e.target);if(e.target.id==='edit-form')saveEdit(e.target);if(e.target.id==='cancel-order-form')saveCancelPending(e.target);if(e.target.id==='seller-form')saveSeller(e.target);if(e.target.id==='password-form')savePassword(e.target);});
document.addEventListener('input',e=>{if(e.target.id!=='search')return;S.search=e.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>loadOrders(),350);});
document.addEventListener('change',e=>{if(e.target.id==='city')loadDistricts(e.target.value);});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;});
window.addEventListener('appinstalled',()=>{deferredInstall=null;document.querySelectorAll('.install-card').forEach(card=>card.remove());toast('Sipariş Takip ana ekranına eklendi.');});
window.addEventListener('offline',()=>{toast('Bağlantı kesildi. Düzenleme için internet gerekli.');});
window.addEventListener('online',()=>{toast('Yeniden çevrimiçisin.');if(S.user&&!S.manageAccounts&&S.tab!=='account')(S.tab==='reports'?loadReport():loadOrders());});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.user&&!S.manageAccounts&&!sheet.open&&S.tab!=='account'&&navigator.onLine)(S.tab==='reports'?loadReport():loadOrders());});
db.auth.onAuthStateChange((event)=>{if(event==='SIGNED_OUT'&&S.user){++S.request;S.user=null;S.orders=[];S.detail=null;if(sheet.open)sheet.close();sheet.innerHTML='';renderLogin();}});
(async()=>{app.innerHTML='<div class="loading">Sipariş Takip açılıyor…</div>';const {data:{session}}=await db.auth.getSession();if(session){const {data:{user},error}=await db.auth.getUser();if(!error&&user)await enter(user);else{await db.auth.signOut({scope:'local'});renderLogin();}}else renderLogin();})();

document.addEventListener('keydown',event=>{const el=event.target.closest('.order-open[data-order]');if(!el||event.target!==el||!['Enter',' '].includes(event.key))return;event.preventDefault();showOrder(el.dataset.order);});

