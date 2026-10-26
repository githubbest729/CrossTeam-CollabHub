let deferred,reg;const $=s=>document.querySelector(s);
function toast(msg,action,cb){const t=$('#toast');t.hidden=false;t.innerHTML=msg+(action?` <button id="ta">${action}</button>`:'');if(action)$('#ta').onclick=cb;else setTimeout(()=>t.hidden=true,3500)}
async function quota(){try{if(navigator.storage&&navigator.storage.persist)await navigator.storage.persist();
 if(navigator.storage&&navigator.storage.estimate){const e=await navigator.storage.estimate();const p=e.quota?e.usage/e.quota*100:0;$('#qfill').style.width=Math.max(p,1)+'%';$('#qtxt').textContent=(e.usage/1048576).toFixed(1)+' MB'}}catch(e){}}
function badge(n){if('setAppBadge' in navigator){n>0?navigator.setAppBadge(n).catch(()=>{}):navigator.clearAppBadge().catch(()=>{})}}
async function shareText(title,text){if('share' in navigator){try{await navigator.share({title,text})}catch(e){}}else{await navigator.clipboard?.writeText(text);toast('Copied to clipboard')}}
async function pickContacts(){if('contacts' in navigator&&'ContactsManager' in window){try{return await navigator.contacts.select(['name','email','tel'],{multiple:true})}catch(e){return[]}}toast('Contact Picker not supported');return[]}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;$('#installBtn').hidden=true}};
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)&&!navigator.standalone;
if(ios){$('#installBtn').hidden=false;$('#installBtn').onclick=()=>{$('#modal').hidden=false;$('#modal').innerHTML='<div class="card"><h2>Add to Home Screen</h2><p>Tap the Share icon in Safari, then choose <b>Add to Home Screen</b>.</p><button onclick="$(\'#modal\').hidden=true">OK</button></div>'}}
if('serviceWorker' in navigator){navigator.serviceWorker.register('sw.js').then(r=>{reg=r;
 const prompt=w=>toast('New version available',' Refresh',()=>{w.postMessage({type:'SKIP_WAITING'})});
 if(r.waiting&&navigator.serviceWorker.controller)prompt(r.waiting);
 r.addEventListener('updatefound',()=>{const w=r.installing;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)prompt(w)})});
 if('periodicSync' in r)navigator.permissions.query({name:'periodic-background-sync'}).then(p=>{if(p.state==='granted')r.periodicSync.register('refresh',{minInterval:864e5})}).catch(()=>{});
 }).catch(()=>{});
 let rl;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!rl){rl=1;location.reload()}})}
if('launchQueue' in window)launchQueue.setConsumer(async p=>{for(const h of p.files||[]){const f=await h.getFile();window.__launchFile=f;if(window.openVault)openVault(f)}});
window.addEventListener('online',()=>reg&&'sync' in reg&&reg.sync.register('sync-queue').catch(()=>{}));
quota();