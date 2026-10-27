const TEAMS=['SCADA','PLC','PM','Estimation','Procurement','QA/HSE','Client'];
const PHASES=['Site Survey','Estimation/BOM','Design Spec','Wonderware/PLC Integration','SQL/Historian Setup','FAT','Site Commissioning','Training/Handover'];
const STAT=['Draft','In Review','Blocker Flagged','Approved / Signed Off'];
const VIEWS={dashboard:'Dashboard',vault:'Asset Vault',milestones:'Milestones',blockers:'Blockers',qa:'QA/HSE Gate',data:'Data'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sc=s=>/Approved|Done/.test(s)?'s-Approved':/Blocker|Open/.test(s)?'s-Blocker':'s-Review';
let F={team:'',phase:''};const V=$('#view');
function nav(){const h=location.hash.slice(1)||'dashboard';$('#nav').innerHTML=Object.entries(VIEWS).map(([k,v])=>`<a href="#${k}" class="${k===h?'on':''}">${v}</a>`).join('');return h}
async function dash(){const [pr,ms,as,bl,hr]=await Promise.all(['projects','milestones','assets_meta','tasks_blockers','hours_expenditures'].map(s=>DB.all(s)));
 const act=pr.filter(p=>!p.archived&&(!F.phase||p.phase===F.phase));const ids=new Set(act.map(p=>p.id));
 const fm=ms.filter(m=>ids.has(m.projectId)&&(!F.team||m.team===F.team));const done=fm.filter(m=>m.status==='Done').length;
 const open=bl.filter(b=>b.status==='Open'&&ids.has(b.projectId)&&(!F.team||b.team===F.team)).length;
 const pend=as.filter(a=>a.status!=='Approved / Signed Off'&&ids.has(a.projectId)).length;
 const h=hr.filter(x=>ids.has(x.projectId)).reduce((a,b)=>a+b.hours,0),bud=act.reduce((a,b)=>a+b.budgetH,0);badge(open+pend);
 const e=navigator.storage?.estimate?await navigator.storage.estimate():{usage:0,quota:1};
 const k=(v,l)=>`<div class="card kpi"><b>${v}</b><small>${l}</small></div>`;
 V.innerHTML=`<h2>Executive Command Dashboard</h2><div class="row"><select id="ft"><option value="">All departments</option>${TEAMS.map(t=>`<option ${F.team===t?'selected':''}>${t}</option>`).join('')}</select>
 <select id="fp"><option value="">All phases</option>${PHASES.map(t=>`<option ${F.phase===t?'selected':''}>${t}</option>`).join('')}</select></div>
 <div class="grid">${k(act.length,'Active projects')}${k(fm.length?Math.round(done/fm.length*100)+'%':'–','Milestones complete')}${k(open,'Open blockers')}${k(pend,'Pending sign-offs')}${k(h+' / '+bud+' h','Hours vs budget')}${k((e.usage/e.quota*100).toFixed(2)+'%','Storage used')}</div>
 <h2>Projects</h2><div class="grid">${act.map(p=>{const m=ms.filter(x=>x.projectId===p.id);const pc=m.length?Math.round(m.reduce((a,b)=>a+b.progress,0)/m.length):0;
 return`<div class="card"><b>${esc(p.name)}</b><p>${esc(p.desc)}</p><small>${esc(p.phase)}</small><div class="bar"><i style="width:${pc}%"></i></div><div class="row"><small>${pc}%</small><button class="g" data-arch="${p.id}">Archive</button><button class="g" data-share="${p.id}">Share</button></div></div>`}).join('')}</div>`;
 $('#ft').onchange=e=>{F.team=e.target.value;dash()};$('#fp').onchange=e=>{F.phase=e.target.value;dash()};
 V.querySelectorAll('[data-arch]').forEach(b=>b.onclick=async()=>{if(confirm('Archive to compressed cold storage?')){await DB.archiveProject(b.dataset.arch);dash()}});
 V.querySelectorAll('[data-share]').forEach(b=>b.onclick=async()=>{const id=b.dataset.share,p=pr.find(x=>x.id===id),m=ms.filter(x=>x.projectId===id).sort((a,c)=>a.order-c.order);
  shareText(p.name,p.name+'\n'+m.map(x=>`${x.status==='Done'?'[x]':'[ ]'} ${x.title} (${x.progress}%)`).join('\n'))})}
async function vault(){const as=await DB.all('assets_meta'),pr=await DB.all('projects');
 V.innerHTML=`<h2>Engineering Asset Vault</h2><div class="card"><div class="row"><input id="at" placeholder="Title"><select id="ap">${pr.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select>
 <select id="ao">${TEAMS.map(t=>`<option>${t}</option>`).join('')}</select><select id="aT">${TEAMS.map(t=>`<option>${t}</option>`).join('')}</select><input type="file" id="af"><button id="au">Upload</button></div></div>
 <div class="tw"><table><tr><th>ID</th><th>Title</th><th>Owner→Target</th><th>Ver</th><th>Status</th><th>Checksum</th><th></th></tr>${as.map(a=>`<tr><td>${a.id}</td><td>${esc(a.title)}</td><td>${a.owner}→${a.target}</td><td>${a.version}</td>
 <td><select data-st="${a.id}">${STAT.map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td>${a.checksum}</td><td>${a.storage!=='none'?`<button class="g" data-v="${a.id}">Inspect</button> <button class="g" data-d="${a.id}">Download</button>`:''}</td></tr>`).join('')}</table></div>`;
 $('#au').onclick=async()=>{const f=$('#af').files[0];if(!f)return toast('Choose a file');await upload(f,$('#at').value||f.name,$('#ap').value,$('#ao').value,$('#aT').value);vault()};
 V.querySelectorAll('[data-st]').forEach(s=>s.onchange=async()=>{const a=await DB.get('assets_meta',s.dataset.st);a.status=s.value;a.updated=Date.now();await DB.put('assets_meta',a);await DB.log(a.id+' → '+s.value);toast('Status updated')});
 V.querySelectorAll('[data-v]').forEach(b=>b.onclick=async()=>inspect(await DB.get('assets_meta',b.dataset.v)));
 V.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{const m=await DB.get('assets_meta',b.dataset.d);const f=await DB.loadFile(m);const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=m.fname||m.title;a.click()})}
async function upload(f,title,projectId,owner,target){const id='AST-'+(Date.now()%1e7);const info=await DB.saveFile(id,f);
 const dup=(await DB.all('assets_meta')).filter(a=>a.title===title&&a.projectId===projectId).length;
 await DB.put('assets_meta',{id,title,fname:f.name,mime:f.type,cat:'File',owner,target,projectId,status:'Draft',version:'v1.'+dup,...info,updated:Date.now()});await DB.log('Uploaded '+title);toast('Uploaded '+title)}
window.openVault=async f=>{const pr=await DB.all('projects');await upload(f,f.name,pr[0]?.id,'SCADA','QA/HSE');location.hash='vault';vault()};
function parseCSV(t){return t.trim().split(/\r?\n/).map(l=>l.split(','))}
async function inspect(m){const f=await DB.loadFile(m);const t=await f.text();let body;
 if(/\.csv$/i.test(m.fname||'')){const r=parseCSV(t).slice(0,200);body=`<div class="tw"><table>${r.map((x,i)=>`<tr>${x.map(c=>i?`<td>${esc(c)}</td>`:`<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>`}
 else{try{body='<pre>'+esc(JSON.stringify(JSON.parse(t),null,2).slice(0,20000))+'</pre>'}catch(e){body='<pre>'+esc(t.slice(0,20000))+'</pre>'}}
 $('#modal').hidden=false;$('#modal').innerHTML=`<div class="card"><h2>Tag & Register Map Inspector – ${esc(m.title)}</h2>${body}<p><button onclick="$('#modal').hidden=true">Close</button></p></div>`}
async function miles(){const ms=(await DB.all('milestones')).sort((a,b)=>a.projectId.localeCompare(b.projectId)||a.order-b.order),pr=await DB.all('projects');
 V.innerHTML='<h2>Milestone & Gate Tracker</h2>'+pr.filter(p=>!p.archived).map(p=>`<h3>${esc(p.name)}</h3><div class="ms">${ms.filter(m=>m.projectId===p.id).map(m=>`<div class="card"><div class="row"><span class="led ${m.status==='Done'?'ok':m.status==='In Progress'?'warn':''}"></span><b>${esc(m.title)}</b><span class="tag">${m.team}</span>
 <select data-ms="${m.id}">${['Pending','In Progress','Done'].map(s=>`<option ${m.status===s?'selected':''}>${s}</option>`).join('')}</select><small>Due ${new Date(m.due).toLocaleDateString()}${m.dep?' · after '+m.dep.split('-').pop():''}</small></div>
 <div class="bar"><i style="width:${m.progress}%"></i></div><div class="chk">${m.checklist.map((c,i)=>`<label><input type="checkbox" data-ck="${m.id}:${i}" ${c.done?'checked':''}> ${esc(c.t)}</label>`).join('')}</div></div>`).join('')}</div>`).join('');
 V.querySelectorAll('[data-ms]').forEach(s=>s.onchange=async()=>{const m=await DB.get('milestones',s.dataset.ms);m.status=s.value;m.progress=s.value==='Done'?100:s.value==='Pending'?0:Math.max(m.progress,50);m.checklist.forEach(c=>{if(s.value==='Done')c.done=true});m.updated=Date.now();await DB.put('milestones',m);await DB.log(m.title+' → '+s.value);miles()});
 V.querySelectorAll('[data-ck]').forEach(c=>c.onchange=async()=>{const [id,i]=c.dataset.ck.split(':');const m=await DB.get('milestones',id);m.checklist[i].done=c.checked;m.progress=Math.round(m.checklist.filter(x=>x.done).length/m.checklist.length*100);m.status=m.progress===100?'Done':m.progress?'In Progress':'Pending';await DB.put('milestones',m);miles()})}
async function blockers(){const bl=await DB.all('tasks_blockers'),pr=await DB.all('projects'),log=(await DB.all('activity_log')).sort((a,b)=>b.ts-a.ts).slice(0,8);
 V.innerHTML=`<h2>Blocker Elimination Board</h2><div class="card"><div class="row"><input id="bt" placeholder="Blocker description" size="30"><select id="bp">${pr.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('')}</select><select id="bm">${TEAMS.map(t=>`<option>${t}</option>`).join('')}</select>
 <select id="bs"><option>High</option><option>Medium</option><option>Low</option></select><input id="bh" type="number" placeholder="Hours" style="width:80px"><input id="bc" type="number" placeholder="AED" style="width:90px"><button id="ba">Log blocker</button></div></div>
 <div class="tw"><table><tr><th>ID</th><th>Blocker</th><th>Team</th><th>Sev</th><th>Impact</th><th>Status</th><th></th></tr>${bl.map(b=>`<tr><td>${b.id}</td><td>${esc(b.title)}</td><td>${b.team}</td><td>${b.severity}</td><td>${b.impactH}h / AED ${b.impactAED}</td><td class="${sc(b.status)}">${b.status}</td>
 <td>${b.status==='Open'?`<button class="g" data-r="${b.id}">Resolve</button>`:''}</td></tr>`).join('')}</table></div><h3>Broadcast log</h3><div class="card">${log.map(l=>`<div><small>${new Date(l.ts).toLocaleString()}</small> ${esc(l.msg)}</div>`).join('')}</div>`;
 $('#ba').onclick=async()=>{if(!$('#bt').value)return;const b={id:DB.uid('BLK'),projectId:$('#bp').value,title:$('#bt').value,team:$('#bm').value,severity:$('#bs').value,status:'Open',impactH:+$('#bh').value||0,impactAED:+$('#bc').value||0,updated:Date.now()};
  await DB.put('tasks_blockers',b);await DB.put('sync_queue',{id:DB.uid('Q'),op:'blocker',ref:b.id});await DB.log('Blocker logged: '+b.title);blockers()};
 V.querySelectorAll('[data-r]').forEach(r=>r.onclick=async()=>{const b=await DB.get('tasks_blockers',r.dataset.r);b.status='Resolved';b.updated=Date.now();await DB.put('tasks_blockers',b);await DB.log('Blocker resolved: '+b.title);blockers()})}
async function qa(){const a=await DB.all('qa_hse_audits'),pr=await DB.all('projects');
 V.innerHTML='<h2>QA/QC, Legal & HSE Gate — Annexure-SCT-HR-001</h2><div class="grid">'+a.map(x=>{const p=pr.find(p=>p.id===x.projectId);const n=x.items.filter(i=>i.done).length;
 return`<div class="card"><b>${esc(p?.name)}</b><div class="bar"><i style="width:${n/x.items.length*100}%"></i></div><div class="chk">${x.items.map((i,k)=>`<label><input type="checkbox" data-q="${x.id}:${k}" ${i.done?'checked':''}> ${esc(i.t)}</label>`).join('')}</div><p class="${n===x.items.length?'s-Approved':'s-Blocker'}">${n===x.items.length?'Gate Unlocked — Verified':'Gate locked'}</p></div>`}).join('')+'</div>';
 V.querySelectorAll('[data-q]').forEach(c=>c.onchange=async()=>{const [id,k]=c.dataset.q.split(':');const x=await DB.get('qa_hse_audits',id);x.items[k].done=c.checked;await DB.put('qa_hse_audits',x);await DB.log('QA/HSE audit updated');qa()})}
function data(){V.innerHTML=`<h2>Data & Lifecycle</h2><div class="card"><div class="row"><button id="ex">Export snapshot (.json.gz)</button><input type="file" id="im" accept=".gz,.json"><button id="ib" class="g">Import / merge</button><button id="ct" class="g">Import contacts</button></div><div id="out"></div></div>`;
 $('#ex').onclick=()=>DB.exportAll();$('#ib').onclick=async()=>{const f=$('#im').files[0];if(!f)return;const r=await DB.importAll(f);toast(`Imported ${r.added}, kept newer local ${r.skipped}`)};
 $('#ct').onclick=async()=>{const c=await pickContacts();$('#out').innerHTML=c.map(x=>`<div>${esc((x.name||[])[0])} ${esc((x.email||[])[0]||'')}</div>`).join('')}}
async function route(){const h=nav();({dashboard:dash,vault,milestones:miles,blockers,qa,data})[h]?.()}
window.addEventListener('hashchange',route);
(async()=>{await DB.open();await seedIfEmpty();const q=new URLSearchParams(location.search);
 if(q.get('share-target'))toast('Shared: '+(q.get('title')||q.get('text')||q.get('url')||''));
 if(q.get('action'))location.hash={milestone:'milestones',upload:'vault',blocker:'blockers',qa:'qa'}[q.get('action')]||'';
 const t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t;
 $('#themeBtn').onclick=()=>{const n=document.documentElement.dataset.theme==='light'?'dark':'light';document.documentElement.dataset.theme=n;localStorage.setItem('theme',n)};
 route();quota()})();