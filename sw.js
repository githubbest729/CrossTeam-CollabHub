const V='collabhub-v4',SHELL=['./','index.html','offline.html','css/styles.css','js/db.js','js/seed.js','js/pwa.js','js/app.js','js/upgrade.js','favicon.svg','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','assets/sample-wonderware-tags.csv'];
self.addEventListener('install',e=>{
 if(e.addRoutes){try{e.addRoutes({condition:{urlPattern:new URLPattern({pathname:'/icons/*'})},source:'cache'})}catch(x){}}
 e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
 if(r.mode==='navigate'){e.respondWith(fetch(r).then(x=>{caches.open(V).then(c=>c.put(r,x.clone()));return x}).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('offline.html'))));return}
 if(/\.(png|ico|svg|woff2?)$/.test(u.pathname)){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(x=>{const c=x.clone();caches.open(V).then(ca=>ca.put(r,c));return x})));return}
 e.respondWith(caches.match(r).then(m=>{const n=fetch(r).then(x=>{const c=x.clone();caches.open(V).then(ca=>ca.put(r,c));return x}).catch(()=>m);return m||n}))});
self.addEventListener('message',e=>{if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('sync',e=>{if(e.tag==='sync-queue')e.waitUntil(self.clients.matchAll().then(cs=>cs.forEach(c=>c.postMessage({type:'SYNC'}))))});
self.addEventListener('periodicsync',e=>{if(e.tag==='refresh')e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).catch(()=>{}))});
self.addEventListener('push',e=>{let d={title:'CollabHub',body:'Update available'};try{if(e.data){const j=e.data.json();d=j.notification||j}}catch(x){}
 e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:'icons/icon-192.png',badge:'icons/icon-96.png',data:d.navigate||'./index.html#blockers'}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>cs.length?cs[0].focus():self.clients.openWindow(e.notification.data||'./')))});