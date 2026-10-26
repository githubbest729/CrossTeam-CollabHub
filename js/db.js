const DB_NAME='CollabHubDB_v1';
const IDX={milestones:[['byProject','projectId'],['byStatus','status']],assets_meta:[['byProject','projectId'],['byStatus','status'],['byTeam','owner']],assets_chunks:[['byAsset','assetId']],tasks_blockers:[['byProject','projectId'],['byStatus','status']],hours_expenditures:[['byProject','projectId']],qa_hse_audits:[['byProject','projectId']],activity_log:[['byTime','ts']]};
const STORES=['projects','milestones','assets_meta','assets_chunks','tasks_blockers','hours_expenditures','qa_hse_audits','activity_log','sync_queue','archives'];
let _db;
const DB={
 open(){if(_db)return Promise.resolve(_db);return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);
  r.onupgradeneeded=()=>{const d=r.result;STORES.forEach(s=>{const st=d.createObjectStore(s,{keyPath:'id'});(IDX[s]||[]).forEach(([n,k])=>st.createIndex(n,k))})};
  r.onsuccess=()=>{_db=r.result;res(_db)};r.onerror=()=>rej(r.error)})},
 async run(s,mode,fn){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,mode);const rq=fn(t.objectStore(s));t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error)})},
 all(s){return this.run(s,'readonly',o=>o.getAll())},get(s,id){return this.run(s,'readonly',o=>o.get(id))},
 put(s,v){return this.run(s,'readwrite',o=>o.put(v))},del(s,id){return this.run(s,'readwrite',o=>o.delete(id))},
 by(s,idx,v){return this.run(s,'readonly',o=>o.index(idx).getAll(v))},
 uid(p){return p+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)},
 async log(msg){await this.put('activity_log',{id:this.uid('LOG'),ts:Date.now(),msg})},
 async sha256(buf){const h=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,16)},
 async saveFile(assetId,file){const buf=await file.arrayBuffer();const sum=await this.sha256(buf);let mode='idb';
  try{if(navigator.storage&&navigator.storage.getDirectory){const root=await navigator.storage.getDirectory();const fh=await root.getFileHandle(assetId,{create:true});const w=await fh.createWritable();await w.write(buf);await w.close();mode='opfs'}}catch(e){mode='idb'}
  if(mode==='idb'){const C=1<<20;for(let i=0,n=0;i<buf.byteLength;i+=C,n++)await this.put('assets_chunks',{id:assetId+':'+n,assetId,i:n,data:buf.slice(i,i+C)});}
  return{checksum:sum,storage:mode,size:buf.byteLength}},
 async loadFile(meta){if(meta.storage==='opfs'){const root=await navigator.storage.getDirectory();const fh=await root.getFileHandle(meta.id);return await fh.getFile()}
  const ch=(await this.by('assets_chunks','byAsset',meta.id)).sort((a,b)=>a.i-b.i);return new Blob(ch.map(c=>c.data),{type:meta.mime||'application/octet-stream'})},
 async gzip(text){const s=new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));return await new Response(s).arrayBuffer()},
 async gunzip(buf){const s=new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));return await new Response(s).text()},
 async archiveProject(pid){const bundle={};for(const s of ['milestones','assets_meta','tasks_blockers','hours_expenditures','qa_hse_audits'])bundle[s]=await this.by(s,'byProject',pid);
  const p=await this.get('projects',pid);bundle.project=p;const data=await this.gzip(JSON.stringify(bundle));
  await this.put('archives',{id:'ARC-'+pid,projectId:pid,ts:Date.now(),data});
  for(const s of Object.keys(bundle))if(s!=='project')for(const r of bundle[s])await this.del(s,r.id);
  p.archived=true;await this.put('projects',p);await this.log('Archived project '+p.name)},
 async exportAll(){const out={v:1,ts:Date.now(),note:'Binary attachments (OPFS/chunks) are not included.'};
  for(const s of STORES){if(s==='assets_chunks')continue;out[s]=await this.all(s);}
  out.archives=(out.archives||[]).map(a=>({...a,data:btoa(String.fromCharCode(...new Uint8Array(a.data)))}));
  const gz=await this.gzip(JSON.stringify(out));const blob=new Blob([gz],{type:'application/gzip'});const name='collabhub-backup-'+new Date().toISOString().slice(0,10)+'.json.gz';
  if('showSaveFilePicker' in window){try{const h=await showSaveFilePicker({suggestedName:name});const w=await h.createWritable();await w.write(blob);await w.close();return}catch(e){if(e.name==='AbortError')return}}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click()},
 async importAll(file){let buf=await file.arrayBuffer();let txt;try{txt=await this.gunzip(buf)}catch(e){txt=new TextDecoder().decode(buf)}
  const d=JSON.parse(txt);let added=0,skipped=0;
  for(const s of STORES){if(!d[s])continue;for(let r of d[s]){if(s==='archives'&&typeof r.data==='string')r.data=Uint8Array.from(atob(r.data),c=>c.charCodeAt(0)).buffer;
   const ex=await this.get(s,r.id);if(ex&&(ex.updated||ex.ts||0)>=(r.updated||r.ts||0)){skipped++;continue}await this.put(s,r);added++}}
  return{added,skipped}}
};