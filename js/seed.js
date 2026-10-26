async function seedIfEmpty(){
 if((await DB.all('projects')).length)return;const now=Date.now(),D=864e5;
 const P=[['PRJ-DDC','Dubai District Cooling SCADA Migration','Wonderware System Platform migration for chiller plants','Wonderware/PLC Integration'],
 ['PRJ-JAW','Jebel Ali Water Pumping Station – Wonderware + Modbus TCP','Pump station HMI, alarms and Modbus TCP register mapping','Design Spec'],
 ['PRJ-SUB','Substations OPC UA & SQL Historian Upgrade','OPC UA gateway and SQL historian for 33/11kV substations','SQL/Historian Setup']];
 for(const [id,name,desc,phase] of P)await DB.put('projects',{id,name,desc,phase,budgetH:1200,updated:now});
 const chain=[['Site Survey & BOM Derivation','Estimation'],['Procurement PO Issue','Procurement'],['PLC Modbus/OPC Register Freeze','PLC'],['Wonderware HMI & Alarm Build','SCADA'],['SQL Database Integration','SCADA'],['QA/QC FAT Testing','QA/HSE'],['Client Training','Client']];
 let n=0;for(const [pi,p] of P.entries())chain.forEach(([title,team],i)=>{const st=i<pi+2?'Done':i===pi+2?'In Progress':'Pending';
  DB.put('milestones',{id:`MS-${p[0].slice(4)}-${i}`,projectId:p[0],title,team,order:i,status:st,progress:st==='Done'?100:st==='In Progress'?55:0,due:now+(i-2)*14*D,dep:i?`MS-${p[0].slice(4)}-${i-1}`:'',
  checklist:['Deliverable prepared','Peer reviewed','Handed to next team'].map((t,k)=>({t,done:st==='Done'||(st==='In Progress'&&k===0)})),updated:now});n++});
 const A=[['Pump Station Modbus Register Map','Modbus map','PLC','SCADA','Approved / Signed Off','PRJ-JAW'],['Chiller Plant Tag Database','Tag DB','SCADA','QA/HSE','In Review','PRJ-DDC'],['Substation OPC UA Topology','Network diagram','PLC','Client','Draft','PRJ-SUB'],['Historian SQL Query Templates','SQL','SCADA','PM','Blocker Flagged','PRJ-SUB']];
 A.forEach(([title,cat,owner,target,status,projectId],i)=>DB.put('assets_meta',{id:'AST-'+(1001+i),title,cat,owner,target,status,projectId,version:'v1.'+i,checksum:'seed',size:0,storage:'none',updated:now}));
 DB.put('tasks_blockers',{id:'BLK-1',projectId:'PRJ-SUB',title:'Awaiting OPC UA certificates from client IT',team:'Client',severity:'High',status:'Open',impactH:16,impactAED:9500,updated:now});
 DB.put('tasks_blockers',{id:'BLK-2',projectId:'PRJ-JAW',title:'Vendor lead time on gateway: 6 weeks',team:'Procurement',severity:'Medium',status:'Open',impactH:8,impactAED:4200,updated:now});
 DB.put('hours_expenditures',{id:'HRS-1',projectId:'PRJ-DDC',hours:210,costAED:42000,note:'HMI graphics & scripts',updated:now});
 DB.put('hours_expenditures',{id:'HRS-2',projectId:'PRJ-JAW',hours:96,costAED:19200,note:'Modbus mapping',updated:now});
 DB.put('hours_expenditures',{id:'HRS-3',projectId:'PRJ-SUB',hours:150,costAED:30000,note:'SQL historian',updated:now});
 const Q=['FAT test protocol executed','SAT test protocol executed','Cybersecurity / OT network reliability check','Legal documentation signed off','Annexure-SCT-HR-001 QHSE adherence audit'];
 for(const p of P)DB.put('qa_hse_audits',{id:'QA-'+p[0],projectId:p[0],items:Q.map((t,i)=>({t,done:p[0]==='PRJ-DDC'&&i<2})),updated:now});
 await DB.log('Seed data loaded');}