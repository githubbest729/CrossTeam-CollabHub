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
/* ---- v5/v6 feature layer (merged from upgrade.js) ---- */
const CHAIN=[['Site Survey & BOM Derivation','Estimation'],['Procurement PO Issue','Procurement'],['PLC Modbus/OPC Register Freeze','PLC'],['Wonderware HMI & Alarm Build','SCADA'],['SQL Database Integration','SCADA'],['QA/QC FAT Testing','QA/HSE'],['Client Training','Client']];
const VP={q:'',proj:'',team:'',st:'',page:0,size:10};window.curProj=window.curProj||'';
const fld=(l,h)=>`<label class="fld"><small>${l}</small>${h}</label>`;
const optP=(pr,sel,all)=>(all?'<option value="">All projects</option>':'')+pr.map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${esc(p.name)}</option>`).join('');
const optT=(sel,all)=>(all?'<option value="">All teams</option>':'')+TEAMS.map(t=>`<option ${t===sel?'selected':''}>${t}</option>`).join('');
const closeM=()=>{$('#modal').hidden=true};window.closeM=closeM;
const _ex=DB.exportAll.bind(DB);DB.exportAll=async()=>{await _ex();localStorage.setItem('lastBackup',Date.now())};
const _dash=dash;
dash=async function(){await _dash();const d=localStorage.getItem('lastBackup');const old=!d||Date.now()-d>(JSON.parse(localStorage.settings||'{}').backupDays||7)*864e5;
 V.insertAdjacentHTML('afterbegin',`<div class="row"><button id="np">+ New Project</button>${old?'<span class="tag s-Blocker">⚠ Backup overdue — export a snapshot in Data tab</span>':''}</div>`);
 $('#np').onclick=newProj;V.querySelectorAll('[data-arch]').forEach(b=>{const c=b.closest('.card');c.style.cursor='pointer';c.title='Open milestones';c.onclick=e=>{if(e.target.closest('button'))return;curProj=b.dataset.arch;location.hash='milestones'}})};
function newProj(){$('#modal').hidden=false;$('#modal').innerHTML=`<div class="card"><h2>New Project</h2><div class="row">${fld('Project name','<input id="n1" size="34">')}${fld('Description','<input id="n2" size="34">')}${fld('Phase','<select id="n3">'+PHASES.map(p=>`<option>${p}</option>`).join('')+'</select>')}${fld('Budget (hours)','<input id="n4" type="number" value="800">')}</div>
<label><input type="checkbox" id="n5" checked> Create standard 7-gate milestone pipeline</label><p><button id="ns">Create</button> <button class="g" onclick="closeM()">Cancel</button></p></div>`;
 $('#ns').onclick=async()=>{const name=$('#n1').value.trim();if(!name)return toast('Name required');const id=DB.uid('PRJ'),now=Date.now();
  await DB.put('projects',{id,name,desc:$('#n2').value,phase:$('#n3').value,budgetH:+$('#n4').value||0,updated:now});
  await DB.put('qa_hse_audits',{id:'QA-'+id,projectId:id,items:['FAT test protocol executed','SAT test protocol executed','Cybersecurity / OT network reliability check','Legal documentation signed off','Annexure-SCT-HR-001 QHSE adherence audit'].map(t=>({t,done:false})),updated:now});
  if($('#n5').checked)for(const [i,[title,team]] of CHAIN.entries())await DB.put('milestones',{id:`MS-${id}-${i}`,projectId:id,title,team,order:i,status:'Pending',progress:0,due:now+(i+1)*14*864e5,dep:i?`MS-${id}-${i-1}`:'',checklist:['Deliverable prepared','Peer reviewed','Handed to next team'].map(t=>({t,done:false})),updated:now});
  await DB.log('Project created: '+name);closeM();dash()}}
vault=async function(){const [all,pr]=await Promise.all([DB.all('assets_meta'),DB.all('projects')]);const pn=id=>pr.find(p=>p.id===id)?.name||id;
 let r=all.filter(a=>(!VP.proj||a.projectId===VP.proj)&&(!VP.team||a.owner===VP.team||a.target===VP.team)&&(!VP.st||a.status===VP.st)&&(!VP.q||(a.title+a.id+(a.fname||'')).toLowerCase().includes(VP.q.toLowerCase()))).sort((a,b)=>a.id.localeCompare(b.id,undefined,{numeric:true}));
 const pages=Math.max(1,Math.ceil(r.length/VP.size));VP.page=Math.min(VP.page,pages-1);const rows=r.slice(VP.page*VP.size,(VP.page+1)*VP.size);const act=pr.filter(p=>!p.archived);
 V.innerHTML=`<h2>Engineering Asset Vault <small>(${r.length} of ${all.length})</small></h2><div class="card"><b>Upload asset</b><div class="row">${fld('Title','<input id="at">')}${fld('Linked project','<select id="ap">'+optP(act,'')+'</select>')}${fld('Owning team (sends)','<select id="ao">'+optT('SCADA')+'</select>')}${fld('Target team (receives)','<select id="aT">'+optT('QA/HSE')+'</select>')}${fld('File','<input type="file" id="af">')}<button id="au">Upload</button></div></div>
 <div class="row"><input id="vq" placeholder="Search title / ID / filename" value="${esc(VP.q)}"><select id="vp">${optP(pr,VP.proj,1)}</select><select id="vt">${optT(VP.team,1)}</select><select id="vs"><option value="">All statuses</option>${STAT.map(s=>`<option ${VP.st===s?'selected':''}>${s}</option>`).join('')}</select></div>
 <div class="tw"><table><tr><th>ID</th><th>Title</th><th>Project</th><th>Owner→Target</th><th>Ver</th><th>Status</th><th>Size / SHA-256</th><th>Actions</th></tr>${rows.map(a=>`<tr><td>${a.id}</td><td class="cut" title="${esc(a.title)}">${esc(a.title)}</td><td class="cut" title="${esc(pn(a.projectId))}">${esc(pn(a.projectId))}</td><td>${a.owner}→${a.target}</td><td>${a.version}</td>
 <td><select data-st="${a.id}">${STAT.map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}</select></td><td>${a.storage==='none'?'<small>Sample record (no file)</small>':(a.size/1024).toFixed(1)+' KB · '+a.checksum}</td>
 <td>${a.storage!=='none'?`<button class="g" data-v="${a.id}">Preview</button> <button class="g" data-d="${a.id}">Download</button> `:''}<button class="g" data-x="${a.id}">Delete</button></td></tr>`).join('')||'<tr><td colspan=8>No assets match.</td></tr>'}</table></div>
 <div class="row"><button class="g" id="pv" ${VP.page?'':'disabled'}>‹ Prev</button><small>Page ${VP.page+1} / ${pages}</small><button class="g" id="pn" ${VP.page<pages-1?'':'disabled'}>Next ›</button></div>`;
 const rr=k=>e=>{VP[k]=e.target.value;VP.page=0;vault()};$('#vq').oninput=e=>{VP.q=e.target.value;VP.page=0;clearTimeout(window._vt);window._vt=setTimeout(async()=>{await vault();const i=$('#vq');i.focus();i.setSelectionRange(99,99)},300)};
 $('#vp').onchange=rr('proj');$('#vt').onchange=rr('team');$('#vs').onchange=rr('st');$('#pv').onclick=()=>{VP.page--;vault()};$('#pn').onclick=()=>{VP.page++;vault()};
 $('#au').onclick=async()=>{const f=$('#af').files[0];if(!f)return toast('Choose a file');if($('#ao').value===$('#aT').value&&!confirm('Owner and target team are the same. Continue?'))return;await upload(f,$('#at').value||f.name,$('#ap').value,$('#ao').value,$('#aT').value);vault()};
 V.querySelectorAll('[data-st]').forEach(s=>s.onchange=async()=>{const a=await DB.get('assets_meta',s.dataset.st);a.status=s.value;a.updated=Date.now();await DB.put('assets_meta',a);await DB.log(a.id+' → '+s.value);toast('Status updated');badge((await DB.all('assets_meta')).filter(x=>x.status!=='Approved / Signed Off').length)});
 V.querySelectorAll('[data-v]').forEach(b=>b.onclick=async()=>inspect(await DB.get('assets_meta',b.dataset.v)));
 V.querySelectorAll('[data-d]').forEach(b=>b.onclick=async()=>{const m=await DB.get('assets_meta',b.dataset.d);const f=await DB.loadFile(m);const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=m.fname||m.title;a.click()});
 V.querySelectorAll('[data-x]').forEach(b=>b.onclick=async()=>{const m=await DB.get('assets_meta',b.dataset.x);if(!confirm('Delete '+m.title+' permanently?'))return;
  if(m.storage==='opfs')try{await(await navigator.storage.getDirectory()).removeEntry(m.id)}catch(e){}
  for(const c of await DB.by('assets_chunks','byAsset',m.id))await DB.del('assets_chunks',c.id);await DB.del('assets_meta',m.id);await DB.log('Deleted asset '+m.title);vault()})};
miles=async function(){const [ms,pr]=await Promise.all([DB.all('milestones'),DB.all('projects')]);for(const m of ms){const n=m.checklist.filter(c=>c.done).length,p=Math.round(n/m.checklist.length*100),st=p===100?'Done':p?'In Progress':'Pending';if(m.progress!==p||m.status!==st){m.progress=p;m.status=st;await DB.put('milestones',m)}}const act=pr.filter(p=>!p.archived);if(!act.find(p=>p.id===curProj))curProj=act[0]?.id||'';
 const list=ms.filter(m=>m.projectId===curProj).sort((a,b)=>a.order-b.order);const nm=id=>list.find(m=>m.id===id)?.title;
 V.innerHTML=`<h2>Milestone & Gate Tracker</h2><div class="row">${fld('Project','<select id="mp">'+optP(act,curProj)+'</select>')}</div><div class="ms2">${list.map(m=>`<div class="card"><div class="row"><span class="led ${m.status==='Done'?'ok':m.status==='In Progress'?'warn':''}"></span><b>${m.order+1}. ${esc(m.title)}</b></div>
 <div class="row"><span class="tag">${m.team}</span><select data-ms="${m.id}">${['Pending','In Progress','Done'].map(s=>`<option ${m.status===s?'selected':''}>${s}</option>`).join('')}</select><small>Due ${new Date(m.due).toLocaleDateString()}</small></div>
 <small>${m.dep?'Depends on: '+esc(nm(m.dep)||'—'):'No prerequisite (first gate)'}</small>${(()=>{const pq=m.dep&&list.find(x=>x.id===m.dep);return pq&&pq.status!=='Done'&&(m.status==='Done'||(m.status==='In Progress'&&pq.status==='Pending'))?' <span class="tag s-Review">⚠ Prerequisite not Done</span>':''})()}<div class="bar"><i style="width:${m.progress}%"></i></div><div class="chk">${m.checklist.map((c,i)=>`<label><input type="checkbox" data-ck="${m.id}:${i}" ${c.done?'checked':''}> ${esc(c.t)}</label>`).join('')}</div></div>`).join('')||'<p>No milestones for this project.</p>'}</div>`;
 $('#mp').onchange=e=>{curProj=e.target.value;miles()};
 V.querySelectorAll('[data-ms]').forEach(s=>s.onchange=async()=>{const m=await DB.get('milestones',s.dataset.ms);if(s.value==='Done'&&m.dep){const d=await DB.get('milestones',m.dep);if(d&&d.status!=='Done'&&!confirm('Prerequisite "'+d.title+'" is not Done. Close anyway?'))return miles()}
  if(s.value==='Done')m.checklist.forEach(c=>c.done=true);else if(s.value==='Pending')m.checklist.forEach(c=>c.done=false);else if(m.checklist.every(c=>c.done))m.checklist[2].done=false;else if(!m.checklist.some(c=>c.done))m.checklist[0].done=true;const n=m.checklist.filter(c=>c.done).length;m.progress=Math.round(n/m.checklist.length*100);m.status=n===3?'Done':n?'In Progress':'Pending';m.updated=Date.now();await DB.put('milestones',m);await DB.log(m.title+' → '+s.value);miles()});
 V.querySelectorAll('[data-ck]').forEach(c=>c.onchange=async()=>{const [id,i]=c.dataset.ck.split(':');const m=await DB.get('milestones',id);m.checklist[i].done=c.checked;m.progress=Math.round(m.checklist.filter(x=>x.done).length/m.checklist.length*100);m.status=m.progress===100?'Done':m.progress?'In Progress':'Pending';await DB.put('milestones',m);miles()})};
const _bl=blockers;
blockers=async function(){await _bl();const bl=(await DB.all('tasks_blockers')).filter(b=>b.status!=='Open').sort((a,b)=>b.updated-a.updated);
 const open=(await DB.all('tasks_blockers')).filter(b=>b.status==='Open').length;badge(open);
 V.insertAdjacentHTML('beforeend',`<details class="card"><summary><b>Resolved history (${bl.length})</b></summary><div class="tw"><table><tr><th>ID</th><th>Blocker</th><th>Team</th><th>Resolved</th><th>Resolution note</th></tr>${bl.map(b=>`<tr><td>${b.id}</td><td>${esc(b.title)}</td><td>${b.team}</td><td class="s-Approved">✔ ${new Date(b.updated).toLocaleDateString()}</td><td>${esc(b.note||'—')}</td></tr>`).join('')}</table></div></details>`);
 V.querySelectorAll('[data-r]').forEach(r=>r.onclick=async()=>{const note=prompt('Resolution note (what fixed it?)');if(note===null)return;const b=await DB.get('tasks_blockers',r.dataset.r);b.status='Resolved';b.note=note;b.updated=Date.now();await DB.put('tasks_blockers',b);await DB.log('Blocker resolved: '+b.title+(note?' — '+note:''));blockers()})};
const _qa=qa;
qa=async function(){await _qa();const a=await DB.all('qa_hse_audits');
 V.querySelectorAll('.grid .card').forEach((c,i)=>{const x=a[i];if(!x)return;const n=x.items.filter(t=>t.done).length;if(n===x.items.length){c.insertAdjacentHTML('beforeend',x.signed?`<p><small>Signed off by <b>${esc(x.signed.by)}</b> on ${new Date(x.signed.ts).toLocaleString()}</small></p>`:`<div class="row"><input placeholder="Inspector name" data-n="${x.id}"><button data-s="${x.id}">Sign off</button></div>`)}
  else if(x.signed){x.signed=null;DB.put('qa_hse_audits',x)}});
 V.querySelectorAll('[data-s]').forEach(b=>b.onclick=async()=>{const n=V.querySelector(`[data-n="${b.dataset.s}"]`).value.trim();if(!n)return toast('Enter inspector name');const x=await DB.get('qa_hse_audits',b.dataset.s);x.signed={by:n,ts:Date.now()};await DB.put('qa_hse_audits',x);await DB.log('QA/HSE audit signed off by '+n);qa()})};
data=async function(){const e=navigator.storage?.estimate?await navigator.storage.estimate():{usage:0,quota:1};const cnt={};for(const s of STORES)cnt[s]=(await DB.all(s)).length;
 const arc=await DB.all('archives'),pr=await DB.all('projects');const lb=localStorage.getItem('lastBackup');
 V.innerHTML=`<h2>Data & Lifecycle</h2><div class="card"><div class="row"><button id="ex">Export snapshot (.json.gz)</button><input type="file" id="im" accept=".gz,.json"><button id="ib" class="g">Import / merge</button><button id="ct" class="g">Import contacts</button></div>
 <p>Last backup: <b class="${lb?'':'s-Blocker'}">${lb?new Date(+lb).toLocaleString():'Never — export one now'}</b> · Persistent storage: <b>${navigator.storage?.persisted?(await navigator.storage.persisted())?'granted':'not granted':'n/a'}</b> · Used ${(e.usage/1048576).toFixed(2)} MB of ${(e.quota/1073741824).toFixed(1)} GB</p><div id="out"></div></div>
 <h3>Storage breakdown (records)</h3><div class="grid sb">${STORES.map(s=>`<div class="card kpi"><b>${cnt[s]}</b><small>${SN[s]}</small><br><code class="muted">${s}</code></div>`).join('')}</div>
 <h3>Archived projects</h3><div class="tw"><table><tr><th>Project</th><th>Archived</th><th>Size</th><th></th></tr>${arc.map(a=>`<tr><td>${esc(pr.find(p=>p.id===a.projectId)?.name||a.projectId)}</td><td>${new Date(a.ts).toLocaleDateString()}</td><td>${(a.data.byteLength/1024).toFixed(1)} KB gz</td><td><button class="g" data-rs="${a.id}">Restore</button> <button class="g" data-rd="${a.id}">Delete forever</button></td></tr>`).join('')||'<tr><td colspan=4>No archived projects.</td></tr>'}</table></div>
 <h3>Reset</h3><div class="row"><button class="g" id="r1">Clear ALL data (start fresh)</button><button class="g" id="r2">Reload demo data</button></div>`;
 $('#ex').onclick=async()=>{await DB.exportAll();data()};$('#ib').onclick=async()=>{const f=$('#im').files[0];if(!f)return;const r=await DB.importAll(f);toast(`Imported ${r.added}, kept newer local ${r.skipped}`);data()};
 $('#ct').onclick=async()=>{const c=await pickContacts();$('#out').innerHTML=c.map(x=>`<div>${esc((x.name||[])[0])} ${esc((x.email||[])[0]||'')}</div>`).join('')};
 V.querySelectorAll('[data-rs]').forEach(b=>b.onclick=async()=>{const a=await DB.get('archives',b.dataset.rs);const bd=JSON.parse(await DB.gunzip(a.data));for(const s of ['milestones','assets_meta','tasks_blockers','hours_expenditures','qa_hse_audits'])for(const r of bd[s]||[])await DB.put(s,r);bd.project.archived=false;await DB.put('projects',bd.project);await DB.del('archives',a.id);await DB.log('Restored '+bd.project.name);data()});
 V.querySelectorAll('[data-rd]').forEach(b=>b.onclick=async()=>{if(confirm('Permanently delete this archive?')){await DB.del('archives',b.dataset.rd);data()}});
 const wipe=async()=>{for(const s of STORES)await DB.run(s,'readwrite',o=>o.clear());try{const r=await navigator.storage.getDirectory();for await(const [n] of r.entries())await r.removeEntry(n)}catch(e){}};
 $('#r1').onclick=async()=>{if(confirm('Delete EVERYTHING on this device? Export a snapshot first.')){await wipe();toast('All data cleared');data()}};
 $('#r2').onclick=async()=>{if(confirm('Replace all data with demo data?')){await wipe();await seedIfEmpty();data()}}};

const SN={projects:'Projects',milestones:'Milestones',assets_meta:'Asset Metadata',assets_chunks:'Stored File Chunks',tasks_blockers:'Blockers & Tasks',hours_expenditures:'Hours & Budget Logs',qa_hse_audits:'QA/HSE Audits',activity_log:'Activity Logs',sync_queue:'Offline Sync Queue',archives:'Archived Projects'};
function seedDocs(){const L=[];const pump=['RUN','SPD','AMPS','FAULT','TEMP'];let a=40001;
 const row=(n,t,sc,rw,d)=>{L.push([a,n,t,sc,rw,d].join(','));a+=t==='FLOAT32'?2:1};
 for(let i=1;i<=4;i++)for(const k of pump)row(`PMP10${i}_${k}`,k==='RUN'||k==='FAULT'?'INT16':'INT16',k==='SPD'?'0.1':k==='AMPS'?'0.1':k==='TEMP'?'0.1':'1',k==='SPD'?'R/W':'R',`Pump ${i} ${{RUN:'run status',SPD:'speed setpoint %',AMPS:'motor current A',FAULT:'fault word',TEMP:'winding temp C'}[k]}`);
 row('RES1_LVL','FLOAT32','1','R','Reservoir 1 level m');row('RES2_LVL','FLOAT32','1','R','Reservoir 2 level m');row('DISCH_PRESS','FLOAT32','1','R','Discharge pressure bar');row('FLOW_TOT','FLOAT32','1','R','Totalized flow m3');row('CL2_RESID','FLOAT32','1','R','Chlorine residual mg/L');
 const modbus='Address,TagName,DataType,Scaling,Access,Description\n'+L.join('\n');
 const th=[];for(let c=1;c<=4;c++)for(const [at,u,lo,hi] of [['Temp_Supply','degC',4,8],['Temp_Return','degC',10,16],['Power_kW','kW',0,900]])th.push([`CH0${c}`,at,`CH0${c}_PLC.${at}`,u,lo-2,lo,hi,hi+2].join(','));
 const chill='ArchestrA_Object,Attribute,IO_Reference,Units,LoLo,Lo,Hi,HiHi\n'+th.join('\n');
 const nodes=['Feeder_Incomer_33kV','Transformer_T1_Temp','Busbar_11kV_Voltage','CB_101_Status','Protection_Relay_Trip'].map((n,i)=>({nodeId:`ns=2;s=SS01.${n}`,browseName:n,dataType:['Float','Float','Float','Boolean','Boolean'][i],pollMs:[1000,5000,1000,500,500][i]}));
 const json=JSON.stringify({server:'opc.tcp://gateway.sub01.local:4840',namespace:'urn:agac:substation:33-11kV',security:{policy:'Basic256Sha256',mode:'SignAndEncrypt'},subscription:{publishingIntervalMs:1000},nodes},null,1);
 const sql=`-- Hourly chiller plant efficiency (kW/TR)
DECLARE @Start DATETIME = DATEADD(DAY,-1,GETDATE());
SELECT DateTime, AVG(CASE WHEN TagName='CHP_kW' THEN Value END) / NULLIF(AVG(CASE WHEN TagName='CHP_TR' THEN Value END),0) AS kW_per_TR
FROM Runtime.dbo.History
WHERE TagName IN ('CHP_kW','CHP_TR') AND DateTime >= @Start AND wwRetrievalMode='Cyclic' AND wwResolution=3600000
GROUP BY DateTime ORDER BY DateTime;

-- Alarm frequency per tag, last 30 days (adjust view name to your alarm DB)
SELECT TagName, COUNT(*) AS AlarmCount
FROM Runtime.dbo.AlarmHistory
WHERE AlarmTime >= DATEADD(DAY,-30,GETDATE())
GROUP BY TagName ORDER BY AlarmCount DESC;`;
 return{'AST-1001':['pump_station_modbus_map.csv','text/csv',modbus],'AST-1002':['chiller_plant_wonderware_tags.csv','text/csv',chill],'AST-1003':['substation_opc_ua_nodes.json','application/json',json],'AST-1004':['historian_queries.sql','text/plain',sql]}}
async function attachSeedFiles(){const D=seedDocs();for(const id in D){const m=await DB.get('assets_meta',id);if(!m||m.storage==='idb')continue;const [fn,mime,txt]=D[id];if(m.storage==='opfs')try{await(await navigator.storage.getDirectory()).removeEntry(id)}catch(e){}const info=await DB.saveFile(id,new Blob([txt],{type:mime}),true);await DB.put('assets_meta',{...m,fname:fn,mime,...info,updated:Date.now()})}}
const _v4=vault;vault=async function(){await attachSeedFiles();await _v4()};
inspect=async function(m){const t=await(await DB.loadFile(m)).text(),fn=m.fname||m.title,js=/\.json$/i.test(fn);let body;
 if(/\.csv$/i.test(fn)){body=`<input id="cq" placeholder="Search rows…" size="30"><div class="tw"><table id="ct2">${parseCSV(t).map((x,i)=>`<tr>${x.map(c=>i?`<td>${esc(c)}</td>`:`<th>${esc(c)}</th>`).join('')}</tr>`).join('')}</table></div>`}
 else{let x=t;if(js)try{x=JSON.stringify(JSON.parse(t),null,2)}catch(e){}x=esc(x);x=js?x.replace(/(&quot;[^&]*?&quot;)(\s*:)/g,'<span class="k">$1</span>$2'):x.replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|AND|OR|AS|DECLARE|DATEADD|AVG|COUNT|CASE|WHEN|THEN|END|IN)\b/g,'<span class="k">$1</span>');body='<pre>'+x+'</pre>'}
 $('#modal').hidden=false;$('#modal').innerHTML=`<div class="card"><h2>${esc(m.title)} <small>${esc(fn)}</small></h2>${body}<p><button onclick="closeM()">Close</button></p></div>`;
 const q=$('#cq');if(q)q.oninput=()=>{const v=q.value.toLowerCase();document.querySelectorAll('#ct2 tr').forEach((r,i)=>{if(i)r.hidden=!r.textContent.toLowerCase().includes(v)})}};
const _d3=dash;dash=async function(){await _d3();V.querySelectorAll('[data-arch]').forEach(b=>{const x=document.createElement('button');x.className='g';x.textContent='Log Hours / Budget';x.onclick=e=>{e.stopPropagation();hoursModal(b.dataset.arch)};b.before(x)})};
async function hoursModal(pid){const p=await DB.get('projects',pid),r=(await DB.by('hours_expenditures','byProject',pid)).sort((a,b)=>(b.ts||0)-(a.ts||0));const H=r.reduce((a,b)=>a+b.hours,0),C=r.reduce((a,b)=>a+(b.costAED||0),0);
 $('#modal').hidden=false;$('#modal').innerHTML=`<div class="card"><h2>${esc(p.name)}</h2><p><b>${H}</b> / ${p.budgetH} h (${p.budgetH?Math.round(H/p.budgetH*100):0}%) · AED <b>${C.toLocaleString()}</b></p><div class="bar"><i style="width:${Math.min(100,p.budgetH?H/p.budgetH*100:0)}%"></i></div>
 <div class="row">${fld('Hours','<input id="h1" type="number" style="width:90px">')}${fld('Cost (AED)','<input id="h2" type="number" style="width:110px">')}${fld('Note','<input id="h3" size="26">')}<button id="hs">Log</button></div>
 <div class="tw"><table><tr><th>Date</th><th>Hours</th><th>AED</th><th>Note</th><th></th></tr>${r.map(x=>`<tr><td>${x.ts?new Date(x.ts).toLocaleDateString():'—'}</td><td>${x.hours}</td><td>${(x.costAED||0).toLocaleString()}</td><td>${esc(x.note)}</td><td><button class="g" data-hd="${x.id}">✕</button></td></tr>`).join('')}</table></div><p><button onclick="closeM()">Close</button></p></div>`;
 $('#hs').onclick=async()=>{const h=+$('#h1').value;if(!h)return toast('Enter hours');await DB.put('hours_expenditures',{id:DB.uid('HRS'),projectId:pid,hours:h,costAED:+$('#h2').value||0,note:$('#h3').value,ts:Date.now(),updated:Date.now()});await DB.log(`Logged ${h}h on ${p.name}`);hoursModal(pid);dash()};
 document.querySelectorAll('[data-hd]').forEach(b=>b.onclick=async()=>{if(confirm('Delete this entry?')){await DB.del('hours_expenditures',b.dataset.hd);hoursModal(pid);dash()}})}
window.VB=window.VB||{proj:''};
blockers=async function(){const [all,pr,lg]=await Promise.all([DB.all('tasks_blockers'),DB.all('projects'),DB.all('activity_log')]);const pn=id=>pr.find(p=>p.id===id)?.name||id;const f=all.filter(b=>!VB.proj||b.projectId===VB.proj);
 const op=f.filter(b=>b.status==='Open'),rs=f.filter(b=>b.status!=='Open').sort((a,b)=>b.updated-a.updated);badge(all.filter(b=>b.status==='Open').length);
 V.innerHTML=`<h2>Blocker Elimination Board</h2><div class="card"><b>Log blocker</b><div class="row">${fld('Description','<input id="bt" size="30">')}${fld('Project','<select id="bp">'+optP(pr.filter(p=>!p.archived),'')+'</select>')}${fld('Blocking team','<select id="bm">'+optT('Client')+'</select>')}${fld('Severity','<select id="bs"><option>High</option><option>Medium</option><option>Low</option></select>')}${fld('Hours impact','<input id="bh" type="number" style="width:90px">')}${fld('Cost impact (AED)','<input id="bc" type="number" style="width:110px">')}<button id="ba">Log blocker</button></div></div>
 <div class="row">${fld('Filter by project','<select id="bf">'+optP(pr,VB.proj,1)+'</select>')}</div>
 <div class="tw"><table><tr><th>ID</th><th>Project</th><th>Blocker</th><th>Team</th><th>Sev</th><th>Impact</th><th>Status</th><th></th></tr>${op.map(b=>`<tr><td>${b.id}</td><td class="cut" title="${esc(pn(b.projectId))}">${esc(pn(b.projectId))}</td><td>${esc(b.title)}</td><td>${b.team}</td><td>${b.severity}</td><td>${b.impactH}h / AED ${b.impactAED}</td><td class="s-Blocker">Open</td><td><button class="g" data-r="${b.id}">Resolve</button></td></tr>`).join('')||'<tr><td colspan=8>No open blockers 🎉</td></tr>'}</table></div>
 <details class="card"><summary><b>Resolved history (${rs.length})</b></summary><div class="tw"><table><tr><th>ID</th><th>Project</th><th>Blocker</th><th>Resolved</th><th>Note</th></tr>${rs.map(b=>`<tr><td>${b.id}</td><td class="cut">${esc(pn(b.projectId))}</td><td>${esc(b.title)}</td><td class="s-Approved">✔ ${new Date(b.updated).toLocaleDateString()}</td><td>${esc(b.note||'—')}</td></tr>`).join('')}</table></div></details>
 <div class="row"><h3 style="margin:0">Broadcast log</h3><button class="g" id="lc">Clear Log</button><button class="g" id="le">Export Log (.txt)</button></div><div class="card logbox">${lg.sort((a,b)=>b.ts-a.ts).slice(0,500).map(l=>`<div><code class="hash">${new Date(l.ts).toLocaleString()}</code> <span class="tag">${logCat(l.msg)}</span> ${esc(l.msg)}</div>`).join('')||'<small>Log is empty.</small>'}</div>`;
 $('#bf').onchange=e=>{VB.proj=e.target.value;blockers()};
 $('#lc').onclick=async()=>{if(confirm('Clear the entire broadcast log?')){for(const l of lg)await DB.del('activity_log',l.id);blockers()}};
 $('#le').onclick=()=>{const t=lg.sort((a,b)=>b.ts-a.ts).map(l=>new Date(l.ts).toISOString()+' ['+logCat(l.msg)+'] '+l.msg).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/plain'}));a.download='collabhub-log.txt';a.click()};
 $('#ba').onclick=async()=>{if(!$('#bt').value.trim())return toast('Describe the blocker');const b={id:DB.uid('BLK'),projectId:$('#bp').value,title:$('#bt').value,team:$('#bm').value,severity:$('#bs').value,status:'Open',impactH:+$('#bh').value||0,impactAED:+$('#bc').value||0,updated:Date.now()};await DB.put('tasks_blockers',b);await DB.put('sync_queue',{id:DB.uid('Q'),op:'blocker',ref:b.id});await DB.log('Blocker logged: '+b.title);blockers()};
 V.querySelectorAll('[data-r]').forEach(r=>r.onclick=async()=>{const note=prompt('Resolution note (what fixed it?)');if(note===null)return;const b=await DB.get('tasks_blockers',r.dataset.r);b.status='Resolved';b.note=note;b.updated=Date.now();await DB.put('tasks_blockers',b);await DB.log('Blocker resolved: '+b.title+(note?' — '+note:''));blockers()})};
const _q4=qa;qa=async function(){await _q4();const a=await DB.all('qa_hse_audits'),pr=await DB.all('projects');
 V.querySelectorAll('.grid .card').forEach((c,i)=>{const x=a[i];if(x&&x.items.every(i=>i.done))c.insertAdjacentHTML('beforeend',`<button data-cert="${x.id}">🖨 Export Annexure-SCT-HR-001 Certificate</button>`)});
 V.querySelectorAll('[data-cert]').forEach(b=>b.onclick=()=>{const x=a.find(y=>y.id===b.dataset.cert),p=pr.find(y=>y.id===x.projectId),sg=x.signed||{by:S().name,ts:Date.now()};
  const h=`<html><body style="font-family:sans-serif;padding:40px"><h1>QA/QC, Legal & HSE Sign-Off Certificate</h1><h3>Annexure-SCT-HR-001 — Al Gurg Automation and Controls</h3><p><b>Project:</b> ${esc(p?.name)}</p><table border=1 cellpadding=8 style="border-collapse:collapse;width:100%">${x.items.map(i=>`<tr><td>${esc(i.t)}</td><td>${i.done?'✔ Verified':'✘'}</td></tr>`).join('')}</table><p><b>Auditor:</b> ${esc(sg.by)}<br><b>Signed:</b> ${new Date(sg.ts).toLocaleString()}</p><p style="margin-top:60px">Signature: ____________________</p></body></html>`;
  const f=document.createElement('iframe');f.style.cssText='position:fixed;width:0;height:0;border:0';document.body.appendChild(f);f.srcdoc=h;f.onload=()=>{f.contentWindow.focus();f.contentWindow.print();setTimeout(()=>f.remove(),5000)}})};

const ic=p=>`<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const IC={eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',down:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',up:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
dashboard:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',vault:'<path d="M3 7h6l2 2h10v10H3z"/>',milestones:'<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',blockers:'<circle cx="12" cy="12" r="9"/><path d="M5 5l14 14"/>',qa:'<path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',data:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 2 4 3 8 3s8-1 8-3V5"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
const S=()=>Object.assign({theme:'dark',dense:'comfortable',name:'SCADA Lead Engineer',dept:'SCADA & HMI',backupDays:7},JSON.parse(localStorage.settings||'{}'));
const _lg=DB.log.bind(DB);DB.log=m=>_lg(m+' — '+S().name);
const selc=v=>/Approved|Done/.test(v)?'ok':/Review|Progress/.test(v)?'warn':/Blocker/.test(v)?'bad':'mute';
function applyS(){const s=S();document.documentElement.dataset.theme=s.theme;localStorage.setItem('theme',s.theme);document.body.classList.toggle('compact',s.dense==='compact')}
function decorate(){
 document.querySelectorAll('#nav a:not([data-i])').forEach(a=>{a.dataset.i=1;a.insertAdjacentHTML('afterbegin',ic(IC[a.getAttribute('href').slice(1)]||''))});
 V.querySelectorAll('select[data-st],select[data-ms]').forEach(x=>{const f=()=>{x.className='sel-'+selc(x.value)};if(!x.dataset.c){x.dataset.c=1;x.addEventListener('change',f)}f()});
 V.querySelectorAll('button[data-v]:not([data-i]),button[data-d]:not([data-i]),button[data-x]:not([data-i])').forEach(b=>{b.dataset.i=1;const k=b.dataset.v?'eye':b.dataset.d?'down':'trash',l={eye:'Preview',down:'Download',trash:'Delete'}[k];b.innerHTML=ic(IC[k])+l;b.title=l});
 V.querySelectorAll('td').forEach(td=>{if(td.dataset.h||td.children.length)return;const m=td.textContent.match(/^([\d.]+ KB) · ([0-9a-f]{16})$/);if(!m)return;td.dataset.h=1;td.innerHTML=`${m[1]} <code class="hash" title="SHA-256 ${m[2]} — click to copy" data-c="${m[2]}">#${m[2].slice(0,6)}</code>`});
 V.querySelectorAll('.tw table').forEach(t=>{const hs=[...t.querySelectorAll('th')].map(x=>x.textContent);t.querySelectorAll('tr').forEach(r=>[...r.children].forEach((td,i)=>{if(td.tagName==='TD')td.dataset.l=hs[i]||''}))});
 V.querySelectorAll('input[type=file]:not([data-f])').forEach(i=>{i.dataset.f=1;const l=document.createElement('label');l.className='cfu';l.innerHTML=ic(IC.up)+'<span>Choose or drop a file</span>';i.before(l);l.appendChild(i);i.hidden=true;
  i.onchange=()=>l.querySelector('span').textContent=i.files[0]?.name||'Choose or drop a file';l.ondragover=e=>{e.preventDefault();l.classList.add('hv')};l.ondragleave=()=>l.classList.remove('hv');l.ondrop=e=>{e.preventDefault();l.classList.remove('hv');i.files=e.dataTransfer.files;i.onchange()}});
 if(V.querySelector('h2')?.textContent.startsWith('Executive'))V.querySelectorAll('.grid .kpi:not([data-i])').forEach((c,k)=>{c.dataset.i=1;c.insertAdjacentHTML('afterbegin',ic(IC[['vault','milestones','blockers','qa','clock','data'][k]]||''))});
 V.querySelectorAll('input[data-n]').forEach(i=>{if(!i.value&&!i.dataset.p){i.dataset.p=1;i.value=S().name}})}
V.addEventListener('click',e=>{const h=e.target.closest('.hash');if(h){navigator.clipboard?.writeText(h.dataset.c);toast('Checksum copied')}});
let _r;new MutationObserver(()=>{cancelAnimationFrame(_r);_r=requestAnimationFrame(decorate)}).observe(document.body,{childList:true,subtree:true});
const _d5=dash;dash=async function(){await _d5();const [ms,bl]=await Promise.all([DB.all('milestones'),DB.all('tasks_blockers')]);const ord=['Estimation','Procurement','PLC','SCADA','QA/HSE','Client'];
 const h=Array.from(V.querySelectorAll('h2')).find(x=>x.textContent==='Projects');if(!h)return;let g='';
 ord.forEach((t,i)=>{const x=20+i*148,a=ms.filter(m=>m.team===t&&m.status==='In Progress').length,d=ms.filter(m=>m.team===t&&m.status==='Done').length,p=ms.filter(m=>m.team===t&&m.status==='Pending').length,b=bl.filter(m=>m.team===t&&m.status==='Open').length;
  g+=`<g data-team="${t}" style="cursor:pointer"><rect x="${x}" y="20" width="128" height="76" rx="10" class="nd${F.team===t?' on':''}"/><text x="${x+64}" y="42" text-anchor="middle" class="nt">${t}</text><text x="${x+64}" y="62" text-anchor="middle" class="ns">${d} Done · ${a} Active</text><text x="${x+64}" y="80" text-anchor="middle" class="ns">${p} Pending</text>${b?`<circle cx="${x+120}" cy="22" r="11" fill="#ef4444"/><text x="${x+120}" y="26" text-anchor="middle" fill="#fff" font-size="12">${b}</text>`:''}${i<5?`<path d="M${x+130} 58h16" stroke="#22d3ee" stroke-width="2" marker-end="url(#ar)"/>`:''}</g>`});
 h.insertAdjacentHTML('beforebegin',`<h2>Cross-Functional Workflow Map <small>(click a team to filter)</small></h2><div class="card tw"><svg viewBox="0 0 900 112" style="min-width:720px;width:100%"><defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0 0L8 4L0 8z" fill="#22d3ee"/></marker></defs>${g}</svg></div>`);
 V.querySelectorAll('[data-team]').forEach(n=>n.onclick=()=>{F.team=F.team===n.dataset.team?'':n.dataset.team;dash()})};
const TS=[{h:'dashboard',sel:'.kpi',t:'Command Dashboard & Workflow Map',x:'Six live SCADA KPIs and the department handoff map. Click a map node to filter; use + New Project and Log Hours / Budget on each card.'},
{h:'vault',sel:'#au',t:'Engineering Asset Vault',x:'Upload registers, tag DBs and SQL here. Try Preview on AST-1001 to inspect the Modbus tag map.',tr:()=>document.querySelector('[data-v="AST-1001"]')?.click()},
{h:'milestones',sel:'.ms2 .card',t:'Milestone & Gate Tracker',x:'Tick the 3 handoff boxes — status and progress update automatically.',tr:()=>document.querySelector('[data-ck]:not(:checked)')?.click()},
{h:'blockers',sel:'#ba',t:'Blocker Elimination Board',x:'Log blockers with hours and AED impact, then Resolve them with a note.'},
{h:'qa',sel:'.grid .card',t:'QA/HSE Gate — Annexure-SCT-HR-001',x:'Tick all 5 checks to unlock the gate, sign off with the auditor name, then export the certificate.'},
{h:'data',sel:'#ex',t:'2–3 Year Storage & Backup',x:'Live persistent-storage telemetry and one-click .json.gz snapshot export.'}];
function endTour(keep){document.querySelectorAll('#tsp,#tc').forEach(e=>e.remove());if(!keep)localStorage.tourDone=1}
function tour(i=0){endTour(1);const s=TS[i];if((location.hash.slice(1)||'dashboard')!==s.h)location.hash=s.h;
 setTimeout(()=>{let el=document.querySelector(s.sel);if(el)el.scrollIntoView({block:'center'});const r=el?el.getBoundingClientRect():{top:90,left:20,width:200,height:50};
  document.body.insertAdjacentHTML('beforeend',`<div id="tsp" style="top:${r.top-6}px;left:${r.left-6}px;width:${r.width+12}px;height:${r.height+12}px"></div><div id="tc" class="card"><small>Step ${i+1} of ${TS.length}</small><h3>${s.t}</h3><p>${s.x}</p><div class="row">${i?'<button class="g" id="tb">Back</button>':''}${s.tr?'<button class="g" id="tt">Try It Now</button>':''}<button id="tn">${i<TS.length-1?'Next':'Finish'}</button><button class="g" id="tk">Skip Tour</button></div></div>`);
  if($('#tb'))$('#tb').onclick=()=>tour(i-1);if($('#tt'))$('#tt').onclick=s.tr;$('#tn').onclick=()=>i<TS.length-1?tour(i+1):endTour();$('#tk').onclick=()=>endTour()},350)}
function settings(){const s=S(),o=(a,v)=>a.map(([k,l])=>`<option value="${k}" ${v==k?'selected':''}>${l}</option>`).join('');
 $('#modal').hidden=false;$('#modal').innerHTML=`<div class="card"><h2>Settings</h2><div class="row">${fld('Theme','<select id="s1">'+o([['dark','SCADA Dark'],['blue','AGAC Industrial Blue'],['day','Daylight High-Contrast']],s.theme)+'</select>')}${fld('UI density','<select id="s2">'+o([['comfortable','Comfortable'],['compact','Compact']],s.dense)+'</select>')}${fld('Backup reminder','<select id="s3">'+o([[3,'3 days'],[7,'7 days'],[14,'14 days']],s.backupDays)+'</select>')}</div>
 <div class="row">${fld('Engineer name','<input id="s4" value="'+esc(s.name)+'">')}${fld('Department','<input id="s5" value="'+esc(s.dept)+'">')}</div><p><button id="ss">Save</button> <button class="g" onclick="closeM()">Cancel</button></p></div>`;
 $('#ss').onclick=()=>{localStorage.settings=JSON.stringify({theme:$('#s1').value,dense:$('#s2').value,backupDays:+$('#s3').value,name:$('#s4').value||'SCADA Lead Engineer',dept:$('#s5').value});applyS();closeM();toast('Settings saved')}}
(()=>{const t=document.querySelector('.tools');t.insertAdjacentHTML('afterbegin','<button class="g" id="tutBtn">? Tutorial</button><button class="g" id="setBtn" title="Settings">⚙</button>');$('#tutBtn').onclick=()=>tour(0);$('#setBtn').onclick=settings;applyS();decorate();if(!localStorage.tourDone)setTimeout(()=>tour(0),1500)})();

const logCat=m=>/^Blocker/.test(m)?'Blocker':/QA\/HSE/.test(m)?'QA/HSE':/AST-|Uploaded|Deleted asset/.test(m)?'Asset':/→/.test(m)?'Milestone':/Project|Archived|Restored/.test(m)?'Project':'General';
const _d6=dash;dash=async function(){await _d6();if(!F.team&&!F.phase)return;const h=Array.from(V.querySelectorAll('h2')).find(x=>x.textContent.startsWith('Executive'));if(!h)return;
 h.insertAdjacentHTML('afterend',`<div class="row"><span class="fpill">Filtering by: ${[F.team,F.phase].filter(Boolean).map(esc).join(' · ')} — <a href="#dashboard" id="fx">× Show All Departments</a></span></div>`);
 $('#fx').onclick=e=>{e.preventDefault();F.team='';F.phase='';dash()}};
const _q6=qa;qa=async function(){await _q6();const a=await DB.all('qa_hse_audits');
 V.querySelectorAll('.grid .card').forEach((c,i)=>{const x=a[i];if(!x)return;const N=x.items.length,n=x.items.filter(t=>t.done).length,ok=n===N;c.classList.toggle('okc',ok);
  c.querySelector('.bar')?.insertAdjacentHTML('afterend',`<small class="tag vtag">${n} / ${N} Verified (${Math.round(n/N*100)}%)</small>`);
  const p=c.querySelector('p');if(p)ok?p.outerHTML='<p class="s-Approved">✓ Gate Unlocked &amp; Compliant</p>':p.remove();
  if(!ok)c.insertAdjacentHTML('beforeend',`<button class="g" disabled>🔒 Gate Locked — Complete ${N-n} more check${N-n>1?'s':''} to unlock Certificate</button>`)})};

['put','del'].forEach(k=>{const o=DB[k].bind(DB);DB[k]=async(...a)=>{const r=await o(...a);clearTimeout(window._qt);window._qt=setTimeout(quota,300);return r}});
const _dt=data;data=async function(){await _dt();quota()};
