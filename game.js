/* Project Kingdom — game rules and data. Visual presentation lives in style.css. */
'use strict';
const KEY='project-kingdom-save-v01';
const TYPES={
  wood:{name:'Houthakker',resource:'Hout',icon:'🌲',field:'wood',base:[10,25,25,15]},
  clay:{name:'Kleigroeve',resource:'Klei',icon:'🧱',field:'clay',base:[25,10,25,15]},
  iron:{name:'Ertsmijn',resource:'Erts',icon:'⛏️',field:'iron',base:[25,25,10,15]},
  crop:{name:'Graanveld',resource:'Graan',icon:'🌾',field:'crop',base:[20,20,20,10]}
};
const RES=['wood','clay','iron','crop'];
const ICON={wood:'🪵',clay:'🧱',iron:'⛏️',crop:'🌾'};
const YIELD=[0,10,15,23,35,53,80,120,180,270,405];
const now=()=>Date.now();
const cap=n=>{let v=800;for(let i=2;i<=n;i++)v*=i<5?1.2:i<10?1.3:1.5;return Math.round(v)};
const storageCap=n=>n>0?cap(n):600;
const fmt=n=>Math.floor(n).toLocaleString('nl-NL');
const duration=n=>Math.round(20*Math.pow(1.55,n-1))*1000;
const speedFactor=level=>Math.pow(.95,Math.max(0,(level||1)-1));
const buildDuration=n=>Math.max(1000,Math.round(duration(n)*speedFactor(state.buildings.main||1)));
const trainDuration=ms=>Math.max(1000,Math.round(ms*speedFactor(state.buildings.barracks||1)));
const researchDuration=ms=>Math.max(1000,Math.round(ms*speedFactor(state.buildings.academy||1)));
const initial=()=>({
  version:1,
  plots:{},
  stock:{wood:200,clay:200,iron:200,crop:200},
  fields:['wood','crop','iron','crop','clay','crop','wood','iron','crop','clay'].map((type,i)=>({type,id:i,level:0})),
  buildings:{main:1,warehouse:0,granary:0,wall:0,rally:0,barracks:0,market:0,smithy:0,academy:0,stables:0,residence:0,workshop:0},
  queue:null,
  villageName:'Dorp 1',
  last:now()
});
function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY));
    if(x&&x.version===1&&Array.isArray(x.fields)&&x.fields.length===10&&x.stock&&x.buildings)return x;
  }catch{}
  return initial();
}
let state=load(),screen='fields',resourceOpen=null;
if(typeof state.villageName!=='string'||!state.villageName.trim())state.villageName='Dorp 1';
const villageName=()=>state.villageName||'Dorp 1';
const safeText=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const villagePill=()=>`<button type="button" class="pill village-name-pill" data-rename-village title="Dorpsnaam wijzigen">${safeText(villageName())} ✎</button>`;
if(!state.plots||typeof state.plots!=='object')state.plots={};
if(!state.buildings)state.buildings={main:1,warehouse:0,granary:0};
for(const [id,def] of Object.entries({main:1,warehouse:0,granary:0,wall:0,rally:0,barracks:0,market:0,smithy:0,academy:0,stables:0,residence:0,workshop:0})){
  if(state.buildings[id]==null)state.buildings[id]=def;
}

// Units persist inside the original village save, alongside world state.
const SCOUT_COST=[160,100,50,50],SCOUT_TRAIN_MS=600000,SCOUT_STEP_MS=400000;
// Approved infantry costs, upkeep, prerequisites and academy research times.
const INFANTRY={
 spear:{name:'Speerdrager',icon:'assets/unit-spear.png',cost:[90,100,35,25],ms:480000,researchMs:900000,attack:15,inf:35,cav:55,speed:6,carry:30,upkeep:1,barracks:1,academy:1},
 sword:{name:'Zwaardkrijger',icon:'assets/unit-sword.png',cost:[150,150,180,40],ms:720000,researchMs:1800000,attack:55,inf:45,cav:25,speed:6,carry:40,upkeep:2,barracks:3,academy:3},
 bow:{name:'Boogschutter',icon:'assets/unit-bow.png',cost:[240,80,110,50],ms:660000,researchMs:2700000,attack:30,inf:55,cav:20,speed:6,carry:20,upkeep:2,barracks:5,academy:5},
 axe:{name:'Bijlkrijger',icon:'assets/unit-axe.png',cost:[270,180,240,110],ms:900000,researchMs:3600000,attack:80,inf:25,cav:15,speed:5,carry:45,upkeep:3,barracks:7,academy:8,smithy:3}
};
const researchCost=def=>def.cost.map(n=>Math.ceil((n*13-0.000001)/10));
function initResearch(){
 if(!state.research||typeof state.research!=='object')state.research={done:{},queue:null};
 if(!state.research.done||typeof state.research.done!=='object')state.research.done={};
 if(!state.research.queue||typeof state.research.queue!=='object')state.research.queue=null;
}
function resolveResearch(at){
 initResearch();const q=state.research.queue;
 if(q&&q.end<=at){if(INFANTRY[q.type])state.research.done[q.type]=true;state.research.queue=null;}
}
function researchRequirements(def){return (state.buildings.barracks||0)>=def.barracks&&(state.buildings.academy||0)>=def.academy&&(!def.smithy||(state.buildings.smithy||0)>=def.smithy)}
const UNIT_ICON_SCOUT='assets/unit-scout.png';
const HORSE_SCOUT={name:'Bereden verkenner',icon:'🐎',cost:[200,150,250,100],ms:900000,researchMs:2700000,attack:0,inf:15,cav:10,speed:18,carry:50,upkeep:2};
const SCOUT_TYPES={scout:{name:'Verkenner',icon:'🥾',speed:9,vision:1,upkeep:1},horse:{name:'Bereden verkenner',icon:'🐎',speed:18,vision:2,upkeep:2}};
const scoutAvailable=(type='scout')=>Math.max(0,(type==='horse'?state.army.mountedScouts:state.army.scouts)-state.army.expeditions.filter(m=>m.type===type).reduce((n,m)=>n+m.count,0));

function armyTrainingEntries(){return [...state.army.training.map(t=>({end:t,type:'scout'})),...(state.army.unitTraining||[])].sort((a,b)=>a.end-b.end)}
function lastTrainingEnd(){const list=armyTrainingEntries();return list.length?list[list.length-1].end:0}
function maxUnitOrder(def){return Math.max(0,Math.min(500,...RES.map((r,i)=>Math.floor((state.stock[r]+0.00000001)/def.cost[i]))))}
function unitAvailable(type){return type==='scout'?scoutAvailable('scout'):(state.army.units[type]||0)}
function nextArmyTrainingBoundary(cursor){const ends=[...armyTrainingEntries().map(t=>t.end),...(state.army.mountedTraining||[]),state.army.mountedResearch?.queue?.end].filter(t=>Number.isFinite(t)&&t>cursor);return ends.length?Math.min(...ends):Infinity}
function unitUnlocked(def){return researchRequirements(def)&&!!state.research.done[Object.keys(INFANTRY).find(id=>INFANTRY[id]===def)]}

function initScouts(){
 if(!state.army||typeof state.army!=='object')state.army={scouts:1,training:[],scout:{q:0,r:0,travel:null}};
 if(!Number.isFinite(state.army.scouts))state.army.scouts=1;
 if(!Array.isArray(state.army.training))state.army.training=[];
 if(!state.army.trainingStarted||typeof state.army.trainingStarted!=='object')state.army.trainingStarted={};
 if(!state.army.scout)state.army.scout={q:0,r:0,travel:null};
 if(!Number.isFinite(state.army.starvationProgress))state.army.starvationProgress=0;
 if(!Array.isArray(state.army.losses))state.army.losses=[];
 if(!state.army.units||typeof state.army.units!=='object')state.army.units={};
 if(!Array.isArray(state.army.unitTraining))state.army.unitTraining=[];
 if(!Number.isInteger(state.army.scout.q))state.army.scout.q=0;
 if(!Number.isInteger(state.army.scout.r))state.army.scout.r=0;
 if(!Number.isFinite(state.army.mountedScouts))state.army.mountedScouts=0;
 if(!Array.isArray(state.army.mountedTraining))state.army.mountedTraining=[];
 if(!Array.isArray(state.army.expeditions))state.army.expeditions=[];
 if(!state.army.mountedResearch||typeof state.army.mountedResearch!=='object')state.army.mountedResearch={done:false,queue:null};
 // One-time migration of a pre-0.12.7a expedition. No old journey is discarded.
 const old=state.army.scout;
 if(old.travel&&!old.migrated){const tr=old.travel, count=Math.min(state.army.scouts,Math.max(1,old.missionCount||1));
  if(count)state.army.expeditions.push({id:'legacy-'+(tr.start||Date.now()),type:'scout',count:tr.returning?Math.max(0,count-(old.missionLost||0)):count,lost:old.missionLost||0,q:old.q||0,r:old.r||0,target:old.missionTarget||{q:tr.q,r:tr.r},travel:{...tr,route:Array.isArray(tr.route)?tr.route:[],nextStepEnd:tr.nextStepEnd||tr.end}});
  if(tr.returning&&old.missionLost)state.army.scouts=Math.max(0,state.army.scouts-old.missionLost);
  old.migrated=true;old.travel=null;old.missionTarget=null;old.missionCount=0;old.q=0;old.r=0;
 }
}
// Population: one point requires one grain per hour. A field at level 0 has no workers.
const BUILDING_POP={main:3,warehouse:1,granary:1,barracks:3,market:3,smithy:3,academy:5,stables:5,residence:3,workshop:5,rally:1,wall:0};
const FIELD_POP={wood:2,clay:2,iron:3,crop:0};
function levelBand(level){return Math.min(3,Math.floor((Math.max(1,level)-1)/5))}
function populationForLevel(base,level){let total=0;for(let lv=1;lv<=Math.max(0,level);lv++)total+=base+levelBand(lv);return total}
function buildingPopulation(){return Object.entries(BUILDING_POP).reduce((sum,[id,base])=>{const lv=state.buildings[id]||0;return sum+(!state.economyV127a?(lv>0&&id!=='wall'?base+levelBand(lv):0):populationForLevel(base,lv))},0)}
function fieldPopulation(){return state.fields.reduce((sum,f)=>sum+(!state.economyV127a?(f.level>0?(FIELD_POP[f.type]||0)+levelBand(f.level):0):populationForLevel(FIELD_POP[f.type]||0,f.level)),0)}
function population(){return buildingPopulation()+fieldPopulation()}
function upkeepPerHour(){if(!state.army)return 0;const atHome=Object.entries(INFANTRY).reduce((a,[id,d])=>a+(state.army.units[id]||0)*d.upkeep,0);const stationed=Object.values(state.world?.oases||{}).reduce((s,o)=>s+Object.entries(o.garrison||{}).reduce((a,[id,n])=>a+n*(INFANTRY[id]?.upkeep||0),0),0);const moving=(state.world?.missions||[]).reduce((s,m)=>s+Object.entries(m.units||{}).reduce((a,[id,n])=>a+n*(INFANTRY[id]?.upkeep||0),0),0);return state.army.scouts+state.army.mountedScouts*2+atHome+stationed+moving}
function cropNet(){return perHour('crop')-population()-upkeepPerHour()}

function maxScoutOrder(){return Math.max(0,Math.min(500,...RES.map((r,i)=>Math.floor((state.stock[r]+0.000001)/SCOUT_COST[i]))))}
function applyCropInterval(hours){
 if(hours<=0)return;
 let crop=state.stock.crop,prod=perHour('crop')-population(),remaining=hours,guard=0;
 while(remaining>1e-10 && guard++<10000){
  const deficit=upkeepPerHour()-prod;
  if(deficit<=0){crop=Math.min(availableCap('crop'),crop-deficit*remaining);break;}
  if(crop>0){const toZero=crop/deficit;const step=Math.min(remaining,toZero);crop=Math.max(0,crop-deficit*step);remaining-=step;if(remaining<1e-10)break;}
  if(upkeepPerHour()<=0){crop=Math.min(availableCap('crop'),crop+prod*remaining);break;}
  const progress=state.army.starvationProgress||0;
  const timeUntilDeath=Math.max(0,(1-progress)/deficit);
  if(remaining+1e-10<timeUntilDeath){state.army.starvationProgress=progress+remaining*deficit;remaining=0;break;}
  remaining-=timeUntilDeath;state.army.starvationProgress=0;
  // Every soldier consumes grain, including those travelling or stationed at an oasis.
  // Famine removes a real unit rather than charging an invisible army.
  const candidates=[];
  for(const [id,d] of Object.entries(INFANTRY)){
   if((state.army.units[id]||0)>0)candidates.push({id,rate:d.upkeep,remove:()=>state.army.units[id]--});
   for(const o of Object.values(state.world?.oases||{}))if((o.garrison?.[id]||0)>0)candidates.push({id,rate:d.upkeep,remove:()=>{o.garrison[id]--;if(Object.values(o.garrison).reduce((a,b)=>a+b,0)<2&&o.unprotectedSince==null)o.unprotectedSince=Date.now();}});
   for(const m of state.world?.missions||[])if((m.units?.[id]||0)>0)candidates.push({id,rate:d.upkeep,remove:()=>m.units[id]--});
  }
  // For starvation, first remove free scouts, then remove a deployed scout from its expedition.
  for(const type of ['horse','scout']){
   const available=scoutAvailable(type),rate=SCOUT_TYPES[type].upkeep;
   if(available>0)candidates.push({id:type,rate,remove:()=>{if(type==='horse')state.army.mountedScouts--;else state.army.scouts--;}});
   else for(const m of state.army.expeditions.filter(x=>x.type===type&&x.count>0))candidates.push({id:type,rate,remove:()=>{m.count--;m.lost=(m.lost||0)+1;if(type==='horse')state.army.mountedScouts--;else state.army.scouts--;}});
  }
  candidates.sort((a,b)=>b.rate-a.rate);
  if(!candidates.length){remaining=0;break;}
  const victim=candidates[0];victim.remove();
  state.army.losses.push({time:Date.now(),kind:victim.id,reason:'starvation',count:1});
  if(state.army.losses.length>30)state.army.losses=state.army.losses.slice(-30);
 }
 state.stock.crop=Math.max(0,Math.min(availableCap('crop'),crop));
 if(state.stock.crop>0||upkeepPerHour()<=perHour('crop')-population())state.army.starvationProgress=0;
}
function applyResourceInterval(from,to){
 let hours=Math.max(0,to-from)/3600000;if(!hours)return;
 for(const r of ['wood','clay','iron'])state.stock[r]=Math.max(0,Math.min(availableCap(r),state.stock[r]+perHour(r)*hours));
 applyCropInterval(hours);
}
function resolveArmyTraining(time){
 while(state.army.training.length&&state.army.training[0]<=time){const done=state.army.training.shift();delete state.army.trainingStarted[String(done)];state.army.scouts++;}
 while(state.army.unitTraining.length&&state.army.unitTraining[0].end<=time){const finished=state.army.unitTraining.shift();state.army.units[finished.type]=(state.army.units[finished.type]||0)+1;}
 while(state.army.mountedTraining.length&&state.army.mountedTraining[0]<=time){state.army.mountedTraining.shift();state.army.mountedScouts++;}
 const research=state.army.mountedResearch;if(research.queue&&research.queue.end<=time){research.queue=null;research.done=true;}
}
function expeditionStepMs(type){return Math.round(3600000/SCOUT_TYPES[type].speed)}
function advanceExpeditions(time){
 const active=[];
 for(const m of state.army.expeditions){
  if(m.count<=0)continue;
  let tr=m.travel,guard=0;
  while(tr&&tr.nextStepEnd<=time&&guard++<600){
   const step=Array.isArray(tr.route)?tr.route.shift():null;
   if(step){m.q=step.q;m.r=step.r;if(!tr.returning)revealScoutHex(m.q,m.r,SCOUT_TYPES[m.type].vision);}
   tr.nextStepEnd+=expeditionStepMs(m.type);
   if(tr.route?.length)continue;
   if(!tr.returning){
    const o=oasisByCoord(m.target.q,m.target.r),risk=o?Math.min(.85,.16+Object.entries(o.animals).reduce((v,[id,n])=>v+n*(ANIMALS[id]?.atk||0),0)/24000):.08;
    const random=worldHash(m.target.q,m.target.r,Math.floor(tr.start/3600000)+901+m.count);
    const lost=Math.min(m.count,Math.floor(risk*m.count)+(random<risk?1:0));
    m.lost=(m.lost||0)+lost;m.count-=lost;
    if(m.type==='horse')state.army.mountedScouts=Math.max(0,state.army.mountedScouts-lost);
    else state.army.scouts=Math.max(0,state.army.scouts-lost);
    if(m.count===0){logReport({kind:'loss',title:'Verkenners vermist',q:m.target.q,r:m.target.r,detail:`Alle verkenners van deze expeditie zijn omgekomen. Geen informatie ontvangen.`});tr=null;break;}
    const route=scoutRoute(m.q,m.r,0,0,true)||[],ms=expeditionStepMs(m.type);
    tr={q:0,r:0,start:tr.end,end:tr.end+route.length*ms,nextStepEnd:tr.end+ms,route,returning:true};m.travel=tr;
    if(!route.length){tr.nextStepEnd=tr.end;}
   }else{
    const o=oasisByCoord(m.target.q,m.target.r);
    state.world.scouted[oasisKey(m.target.q,m.target.r)]=true;
    logReport({kind:'scout',title:o?'Verkenning van oase':'Verkenningsrapport',q:m.target.q,r:m.target.r,detail:o?`Oase +${o.bonus*100}% ${TYPES[o.resource].resource.toLowerCase()}. Aanwezige dieren zijn hieronder weergegeven. ${m.lost||0} verkenner(s) verloren.`:`Terrein verkend. ${m.lost||0} verkenner(s) verloren.`,animals:o?Object.fromEntries(Object.entries(o.animals).map(([id,n])=>[id,Math.ceil(n)])):null});
    tr=null;break;
   }
  }
  if(tr)active.push(m);
 }
 state.army.expeditions=active;
}
const availableCap=r=>storageCap(state.buildings[r==='crop'?'granary':'warehouse']||0);
function perHour(r){const base=25+state.fields.filter(f=>f.type===r).reduce((n,f)=>n+(YIELD[f.level]||Math.round(405*Math.pow(1.5,f.level-10))),0);return base*(1+oasisBonus(r))}
function update(){
 const t=now();initWorld();initScouts();initResearch();initOases();
 let cursor=Math.min(t,state.last||t),safety=0;
 // Event-based offline progression: finish construction and training in chronological order.
 while(cursor<t&&safety++<10000){
  let boundary=t;
  if(state.queue&&state.queue.end>cursor)boundary=Math.min(boundary,state.queue.end);
  boundary=Math.min(boundary,nextArmyTrainingBoundary(cursor));
  if(state.research.queue&&state.research.queue.end>cursor)boundary=Math.min(boundary,state.research.queue.end);
  if(state.world?.missions?.length){for(const m of state.world.missions)if(m.arrive>cursor)boundary=Math.min(boundary,m.arrive);}
  for(const m of state.army.expeditions){if(m.travel?.nextStepEnd>cursor)boundary=Math.min(boundary,m.travel.nextStepEnd);}
  if(state.world?.oases)for(const o of Object.values(state.world.oases))if(o.owner==='player'&&(o.unprotectedSince!==null&&o.unprotectedSince!==undefined)&&Object.values(o.garrison||{}).reduce((a,b)=>a+b,0)<2){const deadline=o.unprotectedSince+(1+2*worldHash(o.q,o.r,777))*3600000;if(deadline>cursor)boundary=Math.min(boundary,deadline);}
  applyResourceInterval(cursor,boundary);advanceOases(cursor,boundary);cursor=boundary;
  advanceExpeditions(cursor);resolveMissions(cursor);
  if(state.queue&&state.queue.end<=cursor){
   const q=state.queue;
   if(q.kind==='field')state.fields[q.id].level++;
   if(q.kind==='building')state.buildings[q.id]=(state.buildings[q.id]||0)+1;
   state.queue=null;
  }
  resolveArmyTraining(cursor);resolveResearch(cursor);
 }
 // Legacy saves may have timers ending before their saved last-update timestamp.
 if(state.queue&&state.queue.end<=t){const q=state.queue;if(q.kind==='field')state.fields[q.id].level++;if(q.kind==='building')state.buildings[q.id]=(state.buildings[q.id]||0)+1;state.queue=null;}
 resolveArmyTraining(t);resolveResearch(t);advanceExpeditions(t);resolveMissions(t);
 state.last=t;state.economyV127a=true;save();
}

function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function price(type,level){return TYPES[type].base.map(x=>Math.ceil(x*Math.pow(1.3,level)))}
const BLD={
  main:{name:'Hoofdgebouw',icon:'🏛️',base:[65,70,50,35]},
  warehouse:{name:'Pakhuis',icon:'📦',base:[65,70,45,30]},
  granary:{name:'Graanschuur',icon:'🌾',base:[55,60,40,35]},
  wall:{name:'Stadsmuur',icon:'🧱',base:[70,95,80,40]},
  rally:{name:'Verzamelplaats',icon:'🚩',base:[40,55,55,20]},
  barracks:{name:'Kazerne',icon:'⚔️',base:[100,110,85,65]},
  market:{name:'Marktplaats',icon:'🏪',base:[90,110,70,50]},
  smithy:{name:'Smederij',icon:'⚒️',base:[120,100,130,60]},
  academy:{name:'Academie',icon:'📚',base:[130,145,100,80]},
  stables:{name:'Stallen',icon:'🐎',base:[170,150,130,110]},
  residence:{name:'Residentie',icon:'👑',base:[140,180,120,100]},
  workshop:{name:'Werkplaats',icon:'🏗️',base:[220,190,240,130]}
};
const buildingPrice=(id,lvl)=>BLD[id].base.map(c=>Math.ceil(c*Math.pow(1.3,Math.max(0,lvl-1))));
const enough=c=>RES.every((r,i)=>state.stock[r]>=c[i]);
function startBuild(kind,id,cost,next){
  update();
  if(state.queue||!enough(cost))return;
  RES.forEach((r,i)=>state.stock[r]-=cost[i]);
  state.queue={kind,id,next,start:now(),end:now()+buildDuration(next)};
  save();
  closeModal();
  render();
}
const $=s=>document.querySelector(s);
function renderResources(){
  const el=$('#resources'),net=cropNet();
  el.innerHTML=RES.map(r=>`<button class="resource ${state.stock[r]>=availableCap(r)?'full':''}" data-res="${r}"><span class="emoji">${ICON[r]}</span><span class="num">${fmt(state.stock[r])}</span><span class="cap">/ ${fmt(availableCap(r))}</span>${r==='crop'?`<span class="pk-crop-net ${net<0?'pk-negative':'pk-positive'}">${net>=0?'+':''}${fmt(net)}/u</span>`:''}</button>`).join('');
  const p=$('#productionPanel');
  p.classList.toggle('hidden',!resourceOpen);
  if(resourceOpen==='crop')p.innerHTML=`<b>🌾 Graanbalans</b><div>Brutoproductie: <b>+${fmt(perHour('crop'))}/u</b></div><div>Gebouwen: <b>−${fmt(buildingPopulation())}/u</b></div><div>Landerijen: <b>−${fmt(fieldPopulation())}/u</b></div><div>Troepen: <b>−${fmt(upkeepPerHour())}/u</b></div><div>Netto: <b class="${net<0?'pk-negative':'pk-positive'}">${net>=0?'+':''}${fmt(net)}/u</b></div><div>Bevolking: <b>${fmt(population())}</b></div>${net<0&&state.stock.crop<=0?'<div class="pk-negative">⚠️ Hongersnood: troepen sterven geleidelijk.</div>':''}`;
  else if(resourceOpen)p.innerHTML=`${ICON[resourceOpen]} <b>${TYPES[resourceOpen].resource}</b> · +${fmt(perHour(resourceOpen))} per uur · opslag ${fmt(state.stock[resourceOpen])} / ${fmt(availableCap(resourceOpen))}`;
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{resourceOpen=resourceOpen===b.dataset.res?null:b.dataset.res;renderResources()}));
}

const LAND_PLOTS=[
 {id:0,x:13.5,y:10.5,w:24,h:16},
 {id:1,x:50,y:14,w:29,h:14},
 {id:2,x:15,y:31,w:26,h:17},
 {id:3,x:14,y:53.5,w:27,h:15},
 {id:4,x:15,y:75,w:28,h:16},
 {id:5,x:86,y:53.5,w:27,h:15},
 {id:6,x:86,y:10.5,w:24,h:16},
 {id:7,x:85,y:31,w:26,h:17},
 {id:8,x:50,y:83,w:31,h:16},
 {id:9,x:85,y:75,w:28,h:16}
];
function renderFields(){
  const spots=LAND_PLOTS.map(pos=>{
    const f=state.fields[pos.id],busy=state.queue?.kind==='field'&&state.queue.id===f.id;
    return `<button type="button" class="land-hotspot ${busy?'land-busy':''}" style="left:${pos.x}%;top:${pos.y}%;width:${pos.w}%;height:${pos.h}%" data-field="${f.id}" aria-label="${TYPES[f.type].name} ${f.id+1}, niveau ${f.level}"><span class="land-level">${busy?'🔨 ':''}${f.level}</span></button>`;
  }).join('');
  return `<div class="scene-head"><div><h1>De landerijen</h1></div>${villagePill()}</div><section class="landscape-scene" aria-label="Geïllustreerde landerijen met tien interactieve grondstofvelden"><img class="landscape-art" src="assets/landerijen-v040.webp" alt="Doorlopend landschap met twee houthakkers, twee mijnen, twee kleigroeven, vier graanvelden en een dorp met brug" draggable="false">${spots}<button type="button" class="land-village" data-open-village aria-label="Ga naar de dorpskern"><span>🏰 Dorp</span></button></section>`;
}

const VILLAGE_PLOTS=[
 {n:1,x:67,y:26},{n:2,x:79,y:35},{n:3,x:80,y:46},
 {n:4,x:75,y:57},{n:5,x:50,y:63},{n:6,x:24,y:57},
 {n:7,x:20,y:46},{n:8,x:20,y:35},{n:9,x:33,y:26}
];
function plotArt(type){
  return type==='warehouse'?'assets/warehouse-v050.png'
    :type==='granary'?'assets/granary-v050.png'
    :type==='barracks'?'assets/barracks-v070.png'
    :type==='market'?'assets/market-v081.png'
    :type==='smithy'?'assets/smithy-v082.png'
    :type==='academy'?'assets/academy-v090.png'
    :type==='stables'?'assets/stables-v0112.png'
    :type==='residence'?'assets/residence-v010.png'
    :type==='workshop'?'assets/workshop-v010.png'
    :null;
}
function renderVillage(){
  const rallyBuilt=(state.buildings.rally||0)>0;
  const wallBuilt=(state.buildings.wall||0)>0;
  const plots=VILLAGE_PLOTS.map(p=>{
    const type=state.plots[p.n];
    const art=plotArt(type);
    return `<button class="village-plot plot-${p.n} ${[1,2,9].includes(p.n)?'village-rear':'village-front'} ${art?'village-occupied':''}" style="left:${p.x}%;top:${p.y}%" data-plot="${p.n}" aria-label="Bouwplaats ${p.n}${type?', '+BLD[type].name:''}">${art?`<img src="${art}" alt="" class="building-asset"><span class="level-badge">${state.buildings[type]||'🔨'}</span>`:`<span class="plot-number">${p.n}</span>`}</button>`;
  }).join('');
  return `<div class="scene-head"><div><h1>De dorpskern</h1></div>${villagePill()}</div>
  <section class="village-layout" aria-label="Illustratie van een dorp met negen bouwplaatsen">
    <img class="village-art" src="${wallBuilt?'assets/village-wall-integrated-v0112.png':'assets/village-no-wall-v0112.png'}" alt="Dorpskern met hoofdgebouw, negen bouwplaatsen, een rivier en brug" draggable="false">
    ${rallyBuilt?`<img class="village-rally-v011" src="assets/rally-v060.png" alt="" draggable="false">`:''}
    ${plots}
    <button class="village-main-hotspot" data-building="main" aria-label="Hoofdgebouw verbeteren"><span class="level-badge">${state.buildings.main||1}</span></button>
    <button class="fixed-hotspot fixed-rally ${rallyBuilt?'is-built':''}" data-building="rally" aria-label="${rallyBuilt?'Verzamelplaats verbeteren':'Verzamelplaats bouwen'}">${rallyBuilt?`<span class="level-badge">${state.buildings.rally||1}</span>`:`<span class="fixed-placeholder">🚩</span>`}</button>
    <button class="fixed-hotspot fixed-wall ${wallBuilt?'is-built':''}" data-building="wall" aria-label="${wallBuilt?'Stadsmuur verbeteren':'Stadsmuur bouwen'}">${wallBuilt?`<span class="level-badge">${state.buildings.wall||1}</span>`:`<span class="fixed-placeholder">🛡️</span>`}</button>
  </section>
  `;
}
function barracksReady(){return (state.buildings.main||0)>=3 && (state.buildings.rally||0)>=1;}
function marketReady(){return (state.buildings.main||0)>=3;}
function smithyReady(){return (state.buildings.main||0)>=5 && (state.buildings.barracks||0)>=3;}
function academyReady(){return (state.buildings.main||0)>=5 && (state.buildings.barracks||0)>=3;}
function stablesReady(){return (state.buildings.academy||0)>=5 && (state.buildings.smithy||0)>=3;}
function residenceReady(){return (state.buildings.main||0)>=5;}
function workshopReady(){return (state.buildings.main||0)>=10 && (state.buildings.academy||0)>=10;}
function typeReady(type){
  if(type==='barracks')return barracksReady();
  if(type==='market')return marketReady();
  if(type==='smithy')return smithyReady();
  if(type==='academy')return academyReady();
  if(type==='stables')return stablesReady();
  if(type==='residence')return residenceReady();
  if(type==='workshop')return workshopReady();
  return true;
}
function buildRequirementText(type){
  if(type==='barracks')return `Vereisten: hoofdgebouw niveau 3 ${(state.buildings.main||0)>=3?'✅':'🔒'} · verzamelplaats niveau 1 ${(state.buildings.rally||0)>=1?'✅':'🔒'}`;
  if(type==='market')return `Vereiste: hoofdgebouw niveau 3 ${(state.buildings.main||0)>=3?'✅':'🔒'}`;
  if(type==='smithy')return `Vereisten: hoofdgebouw niveau 5 ${(state.buildings.main||0)>=5?'✅':'🔒'} · kazerne niveau 3 ${(state.buildings.barracks||0)>=3?'✅':'🔒'}`;
  if(type==='academy')return `Vereisten: hoofdgebouw niveau 5 ${(state.buildings.main||0)>=5?'✅':'🔒'} · kazerne niveau 3 ${(state.buildings.barracks||0)>=3?'✅':'🔒'}`;
  if(type==='stables')return `Vereisten: academie niveau 5 ${(state.buildings.academy||0)>=5?'✅':'🔒'} · smederij niveau 3 ${(state.buildings.smithy||0)>=3?'✅':'🔒'}`;
  if(type==='residence')return `Vereiste: hoofdgebouw niveau 5 ${(state.buildings.main||0)>=5?'✅':'🔒'}`;
  if(type==='workshop')return `Vereisten: hoofdgebouw niveau 10 ${(state.buildings.main||0)>=10?'✅':'🔒'} · academie niveau 10 ${(state.buildings.academy||0)>=10?'✅':'🔒'}`;
  return 'Direct beschikbaar';
}
function beginPlacedBuilding(plot,type){
  update();
  if(state.queue||state.plots[plot]||Object.values(state.plots).includes(type)||!typeReady(type))return;
  const cost=buildingPrice(type,1);
  if(!enough(cost))return;
  RES.forEach((r,i)=>state.stock[r]-=cost[i]);
  state.plots[plot]=type;
  const t=now();
  state.queue={kind:'building',id:type,next:1,start:t,end:t+buildDuration(1)};
  save();closeModal();render();
}
function placeExistingBuilding(plot,type){
  if(state.plots[plot]||Object.values(state.plots).includes(type))return;
  state.plots[plot]=type;save();closeModal();render();
}
function buildOptionHtml(type){
  const builtLevel=state.buildings[type]||0;
  const placed=Object.values(state.plots).includes(type);
  if(placed)return '';
  const ready=typeReady(type);
  const cost=buildingPrice(type,1);
  const placeOnly=builtLevel>0;
  const disabled=!placeOnly&&( !ready || state.queue || !enough(cost));
  const title=placeOnly
    ? `${BLD[type].icon} Plaats ${BLD[type].name} (niveau ${builtLevel})`
    : `${BLD[type].icon} Bouw ${BLD[type].name} · niveau 1${!ready?' 🔒':''}`;
  const actionAttr=placeOnly?`data-place-existing="${type}"`:`data-build-place="${type}"`;
  const details=buildRequirementText(type);
  const costs=placeOnly?`<p class="subtle">Dit gebouw is al gebouwd en kan gratis op een vrije plek worden neergezet.</p>`:costHtml(cost,BUILDING_POP[type]||0);
  return `<div class="build-option"><button class="action ${!placeOnly&&!ready?'locked-choice':''}" ${actionAttr} ${disabled?'disabled':''}>${title}</button><div class="subtle">${details}</div>${costs}${!placeOnly&&ready?affordability(cost):''}</div>`;
}
function showPlot(n){
  update();
  const built=state.plots[n];
  if(built){showBuilding(built);return;}
  const controls=['warehouse','granary','market','barracks','smithy','academy','stables','residence','workshop'].map(buildOptionHtml).filter(Boolean).join('');
  modal(`<h2>🏗️ Bouwplaats ${n}</h2><p>Jij bepaalt waar je gebouwen komen te staan.</p>${controls||'<p>Alle beschikbare gebouwen hebben al een plek gekregen. Andere gebouwen volgen later.</p>'}<p class="subtle">Je begint met 600 opslagruimte. Pakhuis en graanschuur verhogen dat naar 800 op niveau 1.</p>`);
  document.querySelectorAll('[data-place-existing]').forEach(b=>b.addEventListener('click',()=>placeExistingBuilding(n,b.dataset.placeExisting)));
  document.querySelectorAll('[data-build-place]').forEach(b=>b.addEventListener('click',()=>beginPlacedBuilding(n,b.dataset.buildPlace)));
}
// v0.12: persistent, seeded hex-world. The world is independent of village progression.
const WORLD_RADIUS=10;
let mapCamera={x:0,y:0,zoom:1},mapSelection=null, mapMounted=false;
const worldArt=new Image();worldArt.src='assets/fantasyhextiles_v3.png';
const scoutMapArt=new Image();scoutMapArt.src='assets/unit-scout.png';
const worldHash=(q,r,salt=0)=>{let x=(Math.imul(q+1027,374761393)^Math.imul(r+2049,668265263)^Math.imul(state.world.seed+salt,2246822519))|0;x=Math.imul(x^(x>>>13),1274126177);return ((x^(x>>>16))>>>0)/4294967296};
function initWorld(){
 if(!state.world||!Number.isInteger(state.world.seed)){
   state.world={seed:Math.floor(Math.random()*2147483646)+1,discovered:[]};
 }
 if(!Array.isArray(state.world.discovered))state.world.discovered=[];
 // 3x3 beginning around our hometown. Fogged tiles keep their content hidden.
 for(let q=-1;q<=1;q++)for(let r=-1;r<=1;r++){
  const key=`${q},${r}`;if(!state.world.discovered.includes(key))state.world.discovered.push(key);
 }
 save();
}
function worldTerrain(q,r){
 if(q===0&&r===0)return {name:villageName(),sprite:[1,1],kind:'village'};
 const n=worldHash(q,r);
 if(n<.09)return {name:'Water',sprite:[6,0],kind:'water'};
 if(n<.17)return {name:'Heuvels',sprite:[3,0],kind:'hills'};
 if(n<.23)return {name:'Bergen',sprite:[5,0],kind:'mountain'};
 if(n<.45)return {name:'Dicht bos',sprite:[2,0],kind:'forest'};
 if(n<.65)return {name:'Bos',sprite:[1,0],kind:'forest'};
 if(n<.73)return {name:'Moeras',sprite:[4,1],kind:'swamp'};
 if(n<.83)return {name:'Akkerland',sprite:[3,1],kind:'field'};
 if(n<.94)return {name:'Grasland',sprite:[0,0],kind:'plain'};
 return {name:'Open vlakte',sprite:[6,1],kind:'plain'};
}

// v0.12.7 Wilde Oases: persistent world population, missions and military reports.
const ANIMALS={
 snake:{name:'Slang',icon:'🐍',atk:45,inf:8,cav:5},wolf:{name:'Wolf',icon:'🐺',atk:22,inf:12,cav:8},hyena:{name:'Hyena',icon:'🐾',atk:32,inf:18,cav:12},eagle:{name:'Adelaar',icon:'🦅',atk:25,inf:12,cav:18},
 boar:{name:'Wild zwijn',icon:'🐗',atk:35,inf:25,cav:15},lion:{name:'Leeuw',icon:'🦁',atk:90,inf:55,cav:35},tiger:{name:'Tijger',icon:'🐅',atk:105,inf:50,cav:40},
 moose:{name:'Eland',icon:'🫎',atk:65,inf:70,cav:45},bear:{name:'Beer',icon:'🐻',atk:85,inf:75,cav:55},croc:{name:'Krokodil',icon:'🐊',atk:100,inf:80,cav:50},bison:{name:'Wisent',icon:'🐂',atk:75,inf:95,cav:65},
 rhino:{name:'Neushoorn',icon:'🦏',atk:125,inf:125,cav:110},elephant:{name:'Olifant',icon:'🐘',atk:150,inf:160,cav:145}
};
const OASIS_HERDS={forest:{wolf:80,boar:40,bear:20},field:{hyena:120,lion:40,boar:20},plain:{hyena:120,lion:40,boar:20},swamp:{snake:120,croc:80,boar:40},mountain:{eagle:100,bear:40,bison:30},hills:{wolf:80,moose:45,bear:35}};
const oasisKey=(q,r)=>`${q},${r}`;
const oasisByCoord=(q,r)=>state.world.oases?.[oasisKey(q,r)]||null;
function makeOasis(q,r){
 const t=worldTerrain(q,r),key=oasisKey(q,r),rare=worldHash(q,r,400)<.15;
 const primary={forest:'wood',mountain:'iron',hills:'iron',swamp:'clay',field:'crop',plain:'crop'};
 const resource=t.kind!=='field'&&t.kind!=='plain'&&worldHash(q,r,401)<.10?'crop':primary[t.kind];
 let base=OASIS_HERDS[t.kind]||OASIS_HERDS.forest;
 // Savanna colossi are rare; give some rare plains herds heavier defenders.
 if(rare&&(t.kind==='plain'||t.kind==='field')&&worldHash(q,r,402)<.55)base={hyena:60,lion:80,rhino:60,elephant:40};
 if(rare&&t.kind==='forest'){base=worldHash(q,r,403)<.5?{wolf:80,moose:60,bear:40,bison:20}:{wolf:60,boar:50,bear:25,tiger:20};}
 const original={};for(const [id,n] of Object.entries(base)){original[id]=Math.max(1,Math.round(n*(.8+.4*worldHash(q,r,430+Object.keys(ANIMALS).indexOf(id)))))}
 return {q,r,resource,bonus:rare?.5:.25,owner:null,cleared:false,animals:{...original},original,unprotectedSince:null,lastWildUpdate:Date.now()};
}
function initOases(){
 if(!state.world)return;
 if(!state.world.oases||typeof state.world.oases!=='object'){
  const candidates=[];
  for(let q=-WORLD_RADIUS;q<=WORLD_RADIUS;q++)for(let r=-WORLD_RADIUS;r<=WORLD_RADIUS;r++){
   if(hexDistance(q,r)<=3)continue;
   const terrain=worldTerrain(q,r);
   if(terrain.kind==='water'||terrain.kind==='village')continue;
   candidates.push({q,r,score:worldHash(q,r,500)});
  }
  candidates.sort((a,b)=>a.score-b.score);
  const target=Math.round(candidates.length*.05),picked=[];
  for(const c of candidates){
   if(picked.length>=target)break;
   if(picked.some(p=>hexDistance(p.q,p.r,c.q,c.r)<3))continue;
   picked.push(c);
  }
  state.world.oases={};for(const x of picked)state.world.oases[oasisKey(x.q,x.r)]=makeOasis(x.q,x.r);
 }
 for(const oasis of Object.values(state.world.oases)){if(oasis.animals)for(const id of Object.keys(oasis.animals))oasis.animals[id]=Math.max(0,Math.round(oasis.animals[id]));}
 if(!Array.isArray(state.world.reports))state.world.reports=[];
 if(!Array.isArray(state.world.missions))state.world.missions=[];
 if(!state.world.scouted||typeof state.world.scouted!=='object')state.world.scouted={};
}
function logReport(report){state.world.reports.unshift({id:`${Date.now()}-${Math.random().toString(36).slice(2,6)}`,time:Date.now(),read:false,...report});state.world.reports=state.world.reports.slice(0,100)}
const oasisBonus=r=>Object.values(state.world?.oases||{}).reduce((sum,o)=>sum+(o.owner==='player'&&o.resource===r?o.bonus:0),0);
function advanceOases(from,to){
 const hours=Math.max(0,(to-from)/3600000);
 for(const o of Object.values(state.world.oases||{})){
  if(o.owner==='player'){
   const count=Object.values(o.garrison||{}).reduce((a,b)=>a+b,0);
   if(count>=2){o.unprotectedSince=null;continue;}
   if(o.unprotectedSince===null||o.unprotectedSince===undefined)o.unprotectedSince=from;
   const age=Math.max(0,(to-o.unprotectedSince)/3600000);
   // Testable deterministic hazard, continuous over time (not one roll per page load).
   const threshold=1+2*worldHash(o.q,o.r,777);
   if(age>=threshold){if(count){const units=Object.fromEntries(Object.entries(o.garrison||{}).filter(([,n])=>n>0));const speed=Math.min(...Object.keys(units).map(id=>INFANTRY[id]?.speed||5));const travelMs=Math.ceil(hexDistance(0,0,o.q,o.r)/speed*3600000);state.world.missions.push({kind:'return',q:o.q,r:o.r,units,arrive:to+travelMs,travelMs});}o.owner=null;o.cleared=false;o.garrison={};o.unprotectedSince=null;o.animals={...o.original};logReport({kind:'loss',q:o.q,r:o.r,title:'Oase verloren',detail:'Wilde dieren hebben je onbewaakte oase overgenomen. De productiebonus is vervallen.'});}
  }else if(!o.cleared&&hours>0){
   for(const id of Object.keys(o.original)){const extra=(o.wildRecovery?.[id]||0)+o.original[id]*.25*hours,whole=Math.floor(extra);o.animals[id]=Math.min(o.original[id],Math.round(o.animals[id]||0)+whole);o.wildRecovery ||= {};o.wildRecovery[id]=extra-whole;}
  }
 }
}
function splitLosses(counts,lossRatio,atLeastOne=false){
 const entries=Object.entries(counts).filter(([,n])=>n>0);
 const total=entries.reduce((v,[,n])=>v+n,0);
 const dead=Math.min(total-(atLeastOne?1:0),Math.max(0,Math.round(total*lossRatio)));
 const alloc=entries.map(([id,n])=>({id,n,dead:Math.floor(n*dead/total),frac:n*dead/total%1}));
 let left=dead-alloc.reduce((a,x)=>a+x.dead,0);
 alloc.sort((a,b)=>b.frac-a.frac);for(const e of alloc)if(left>0&&e.dead<e.n){e.dead++;left--}
 const survivors={};for(const e of alloc)survivors[e.id]=e.n-e.dead;
 return survivors;
}
function fightOasis(o,attackers){
 const atk=Object.entries(attackers).reduce((s,[id,n])=>s+(INFANTRY[id]?.attack||0)*n,0);
 const def=Object.entries(o.animals).reduce((s,[id,n])=>s+(ANIMALS[id]?.inf||0)*Math.ceil(n),0)*1.05;
 const winner=atk>def;
 const ratio=Math.pow(Math.min(atk,def)/Math.max(1,atk,def),1.5);
 const survivingAttackers=winner?splitLosses(attackers,ratio):{};
 const survivingAnimals=winner?{}:splitLosses(Object.fromEntries(Object.entries(o.animals).map(([id,n])=>[id,Math.ceil(n)])),Math.min(.95,ratio),true);
 const priorAnimals=Object.fromEntries(Object.entries(o.animals).map(([id,n])=>[id,Math.ceil(n)]));
 o.animals=winner?Object.fromEntries(Object.keys(o.original).map(id=>[id,0])):survivingAnimals;o.wildRecovery={};
 o.cleared=winner;
 logReport({kind:'battle',title:winner?'Overwinning bij oase':'Aanval op oase mislukt',q:o.q,r:o.r,winner,attackers,attackLeft:survivingAttackers,defenders:priorAnimals,defenseLeft:survivingAnimals,attackPower:Math.round(atk),defensePower:Math.round(def)});
 return survivingAttackers;
}
function resolveMissions(t){
 const active=[];
 for(const m of state.world.missions){
  if(m.arrive>t){active.push(m);continue;}
  const o=oasisByCoord(m.q,m.r);
  if(m.kind==='return'){
   for(const [id,n] of Object.entries(m.units))state.army.units[id]=(state.army.units[id]||0)+n;
  }else if(m.kind==='reinforce'){
   if(o?.owner==='player'){
    o.garrison ||= {};for(const [id,n] of Object.entries(m.units))o.garrison[id]=(o.garrison[id]||0)+n;
    if(Object.values(o.garrison).reduce((a,b)=>a+b,0)>=2)o.unprotectedSince=null;
   }else active.push({kind:'return',q:m.q,r:m.r,units:m.units,arrive:m.arrive+m.travelMs});
  }else if(m.kind==='attack'){
   if(o){
    const survivors=o.cleared||o.owner==='player'?m.units:fightOasis(o,m.units);
    if(Object.values(survivors).some(n=>n>0))active.push({kind:'return',q:m.q,r:m.r,units:survivors,arrive:m.arrive+m.travelMs});
   }else active.push({kind:'return',q:m.q,r:m.r,units:m.units,arrive:m.arrive+m.travelMs});
  }
 }
 state.world.missions=active;
}
function oasisStatus(o){
 if(o.owner!=='player')return o.cleared?'Vrijgemaakt':'Wild gebied';
 return Object.values(o.garrison||{}).reduce((a,b)=>a+b,0)>=2?'Beschermd':'Onbewaakt';
}
function sendOasisMission(o,kind){
 update();if(!o||kind==='attack'&&(o.owner||o.cleared)||kind==='reinforce'&&o.owner!=='player')return;
 const units={};
 for(const id of Object.keys(INFANTRY)){
  const input=document.getElementById(`pk-send-${id}`),n=Number(input?.value||0);
  if(!Number.isSafeInteger(n)||n<0||n>(state.army.units[id]||0))return;
  if(n)units[id]=n;
 }
 if(!Object.keys(units).length){alert('Selecteer eerst ten minste één soldaat.');return;}
 const slowest=Math.min(...Object.keys(units).map(id=>INFANTRY[id].speed));
 const travelMs=Math.ceil(hexDistance(0,0,o.q,o.r)/slowest*3600000);
 for(const [id,n] of Object.entries(units))state.army.units[id]-=n;
 state.world.missions.push({kind,q:o.q,r:o.r,units,arrive:now()+travelMs,travelMs});
 save();closeModal();render();
}
function sendOasisReinforcementHome(o){
 update();if(o?.owner!=='player')return;
 const g=o.garrison||{};const units={};
 for(const id of Object.keys(INFANTRY)){
  const n=Number(document.getElementById(`pk-recall-${id}`)?.value||0);
  if(!Number.isSafeInteger(n)||n<0||n>(g[id]||0))return;
  if(n)units[id]=n;
 }
 if(!Object.keys(units).length)return;
 for(const [id,n] of Object.entries(units))g[id]-=n;
 if(Object.values(g).reduce((a,b)=>a+b,0)<2)o.unprotectedSince=now();
 const travelMs=Math.ceil(hexDistance(0,0,o.q,o.r)/Math.min(...Object.keys(units).map(id=>INFANTRY[id].speed))*3600000);
 state.world.missions.push({kind:'return',q:o.q,r:o.r,units,arrive:now()+travelMs,travelMs});
 save();closeModal();render();
}
function claimOasis(o){
 update();if(!o||o.owner||!o.cleared||!state.world.discovered.includes(oasisKey(o.q,o.r)))return;
 const claimed=Object.values(state.world.oases).filter(x=>x.owner==='player').length;
 const level=state.buildings.residence||0,slots=level>=15?3:level>=10?2:level>=5?1:0;
 if(claimed>=slots)return;
 o.owner='player';o.unprotectedSince=now();o.garrison={};save();showWorldTile(o.q,o.r);renderResources();
}
function unitInputRows(ids,prefix,counts){return `<div class="pk-mission-rows">${ids.filter(id=>(counts[id]||0)>0).map(id=>`<label><img src="${INFANTRY[id].icon}" alt=""><span>${INFANTRY[id].name} (${counts[id]})</span><input id="${prefix}-${id}" type="number" min="0" max="${counts[id]}" value="0" inputmode="numeric"></label>`).join('')}</div>`}
let reportFilter='all';
const reportCategory=r=>r.kind==='scout'?'scout':r.kind==='battle'?'battle':'other';
function unreadReports(){return (state.world?.reports||[]).filter(r=>r.read===false).length;}
function renderUnread(){const badge=document.getElementById('pk-unread-badge');if(badge){const n=unreadReports();badge.textContent=n>99?'99+':n;badge.hidden=!n;}}
function showReports(){
 update();const tabs=[['all','Alles'],['scout','Verkenning'],['battle','Gevechten'],['other','Overig']];
 const list=state.world.reports.map((r,i)=>({...r,index:i})).filter(r=>reportFilter==='all'||reportCategory(r)===reportFilter);
 modal(`<h2>📜 Berichten en rapporten</h2><p class="subtle">${unreadReports()} ongelezen · maximaal 100 bewaarde berichten</p><div class="pk-report-tabs">${tabs.map(([id,label])=>`<button class="small-btn ${reportFilter===id?'selected':''}" data-filter="${id}">${label}</button>`).join('')}</div>${list.length?list.map(r=>`<div class="pk-message-row ${r.read===false?'unread':''}"><button class="pk-report-item" data-report="${r.index}"><strong>${r.kind==='battle'?'⚔️':r.kind==='scout'?'🥾':'⚠️'} ${safeText(r.title)}</strong><small>${new Date(r.time).toLocaleString('nl-NL')} · ${Number.isFinite(r.q)?r.q+' | '+r.r:'Koninkrijk'} ${r.read===false?'· Nieuw':''}</small></button><button class="pk-report-delete" data-delete-report="${r.index}" aria-label="Verwijder bericht">✕</button></div>`).join(''):'<p>Geen berichten in deze categorie.</p>'}`);
 document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{reportFilter=b.dataset.filter;showReports()});
 document.querySelectorAll('[data-report]').forEach(b=>b.onclick=()=>showReport(Number(b.dataset.report)));
 document.querySelectorAll('[data-delete-report]').forEach(b=>b.onclick=()=>{state.world.reports.splice(Number(b.dataset.deleteReport),1);save();renderUnread();showReports()});
 renderUnread();
}
function reportTable(title,counts,left,animals=false){
 const ids=Object.keys(counts||{}).filter(id=>counts[id]>0);const defs=animals?ANIMALS:INFANTRY;
 return `<h3>${title}</h3><div class="pk-report-scroll"><table class="pk-report-table"><thead><tr><th></th>${ids.map(id=>`<th title="${safeText(defs[id]?.name||id)}"><span>${animals?defs[id]?.icon:`<img src="${defs[id]?.icon}" alt="">`}</span><small>${safeText(defs[id]?.name||id)}</small></th>`).join('')}</tr></thead><tbody><tr><th>Aantal</th>${ids.map(id=>`<td>${Math.round(counts[id])}</td>`).join('')}</tr><tr><th>Verlies</th>${ids.map(id=>`<td>${Math.max(0,Math.round(counts[id])-Math.round(left[id]||0))}</td>`).join('')}</tr><tr><th>Over</th>${ids.map(id=>`<td>${Math.round(left[id]||0)}</td>`).join('')}</tr></tbody></table></div>`;
}
function showReport(index){
 const r=state.world.reports[index];if(!r)return;r.read=true;save();renderUnread();
 const content=r.kind==='battle'?`${reportTable('⚔️ Aanvaller',r.attackers,r.attackLeft)}${reportTable('🛡️ Wilde dieren',r.defenders,r.defenseLeft,true)}<p><b>Gevechtssterkte:</b> ⚔️ ${fmt(r.attackPower)} · 🛡️ ${fmt(r.defensePower)}</p><p>${r.winner?'De dieren zijn verslagen. De oase is vrijgemaakt.':'De aanval is afgeslagen.'}</p>`:
 r.kind==='scout'?`<p>${safeText(r.detail||'')}</p>${r.animals?reportTable('Waargenomen dieren',r.animals,r.animals,true):''}`:`<p>${safeText(r.detail||'')}</p>`;
 modal(`<button class="small-btn" id="pk-back-reports">← Rapporten</button><h2>${safeText(r.title)}</h2><p class="subtle">${new Date(r.time).toLocaleString('nl-NL')} · ${r.q} | ${r.r}</p>${content}`);
 document.getElementById('pk-back-reports').onclick=showReports;
}
function renderMap(){
 initWorld();
 return `<div class="scene-head"><div><h1>De wereld</h1><p>Ontdek je eigen koninkrijk</p></div><span class="pill" id="worldCounter">${state.world.discovered.length} ontdekt</span></div>
  <div class="world-map-shell"><canvas id="kingdomWorld" aria-label="Hexagonwereldkaart"></canvas>
  <div class="map-controls"><button type="button" data-world-zoom="in" aria-label="Inzoomen">＋</button><button type="button" data-world-zoom="out" aria-label="Uitzoomen">−</button><button type="button" data-world-zoom="home" aria-label="Centreer op eigen dorp">⌂</button></div></div>
  <p class="note" id="scoutStatus">Tik op een ontdekt vakje of de rand van de mist om je verkenner automatisch een route te laten lopen.</p>
  <button type="button" class="pk-map-reports" id="pk-map-reports">📜 Berichten en rapporten</button><p class="world-credit">Kaarttegels: The Clover Patch, Fantasy Hex Tiles (CC BY 4.0).</p>`;
}
let mapRedraw=null;
function setupWorld(){
 const canvas=document.getElementById('kingdomWorld');if(!canvas)return;
 const wrap=canvas.parentElement,ctx=canvas.getContext('2d');
 const scale=2.18,stepX=32*scale*.75,stepY=28*scale;
 const known=new Set(state.world.discovered);
 const at=(q,r)=>({x:q*stepX,y:r*stepY+(q%2!==0?stepY/2:0)});
 const draw=()=>{
  known.clear();for(const key of state.world.discovered)known.add(key);
  const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(2,window.devicePixelRatio||1);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#14261d';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2+mapCamera.x,h/2+mapCamera.y);ctx.scale(mapCamera.zoom,mapCamera.zoom);
  ctx.imageSmoothingEnabled=false;
  for(let q=-WORLD_RADIUS;q<=WORLD_RADIUS;q++)for(let r=-WORLD_RADIUS;r<=WORLD_RADIUS;r++){
    const {x,y}=at(q,r),key=`${q},${r}`,visible=known.has(key),t=worldTerrain(q,r);
    const dx=x+mapCamera.x/mapCamera.zoom,dy=y+mapCamera.y/mapCamera.zoom;
    if(Math.abs(dx)>w/(mapCamera.zoom*2)+130||Math.abs(dy)>h/(mapCamera.zoom*2)+130)continue;
    if(visible&&worldArt.complete&&worldArt.naturalWidth){
      ctx.drawImage(worldArt,t.sprite[0]*32,t.sprite[1]*48,32,48,x-32*scale/2,y-24*scale,32*scale,48*scale);
    }else{
      // Hex footprint: width 32, height 28; obscure unexplored locations.
      ctx.beginPath();let pts=[[x-16*scale,y],[x-8*scale,y-14*scale],[x+8*scale,y-14*scale],[x+16*scale,y],[x+8*scale,y+14*scale],[x-8*scale,y+14*scale]];
      pts.forEach(([px,py],i)=>i?ctx.lineTo(px,py):ctx.moveTo(px,py));ctx.closePath();ctx.fillStyle='#26382f';ctx.fill();ctx.strokeStyle='#45584b';ctx.lineWidth=1;ctx.stroke();
    }
    const oasis=visible?oasisByCoord(q,r):null;
    if(oasis){
      ctx.beginPath();ctx.arc(x,y-5,18,0,Math.PI*2);ctx.fillStyle='#254837';ctx.fill();ctx.strokeStyle=oasis.bonus===.5?'#ffd969':'#d8bd85';ctx.lineWidth=oasis.bonus===.5?4:2.5;ctx.stroke();
      ctx.textAlign='center';ctx.font='21px system-ui';ctx.fillStyle='#fff7db';ctx.fillText(oasis.resource==='wood'?'🌲':oasis.resource==='crop'?'🌾':oasis.resource==='clay'?'🧱':'⛏️',x,y+2);
      if(oasis.bonus===.5){ctx.font='bold 13px system-ui';ctx.fillStyle='#ffdc68';ctx.fillText('★',x+16,y-21);}
    }
    if(visible&&q===0&&r===0&&mapSelection?.q===0&&mapSelection?.r===0){ctx.fillStyle='#f1d595';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText(villageName(),x,y+33)}
    if(mapSelection&&mapSelection.q===q&&mapSelection.r===r){ctx.beginPath();ctx.ellipse(x,y,29,27,0,0,Math.PI*2);ctx.strokeStyle='#ffe7aa';ctx.lineWidth=2.5;ctx.stroke()}
  }
  for(const m of state.army.expeditions){
   if(!m.travel)continue;
   const spot=at(m.q,m.r);
   ctx.fillStyle='#fce3a7';ctx.strokeStyle='#183b28';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(spot.x,spot.y-16,11,0,Math.PI*2);ctx.fill();ctx.stroke();
   if(m.type==='scout'&&scoutMapArt.complete&&scoutMapArt.naturalWidth){ctx.drawImage(scoutMapArt,spot.x-11,spot.y-27,22,22)}else{ctx.font='17px system-ui';ctx.textAlign='center';ctx.fillStyle='#132f24';ctx.fillText(SCOUT_TYPES[m.type]?.icon||'🥾',spot.x,spot.y-11);}
   const stops=m.travel.route||[];
   ctx.strokeStyle='#f7d78b';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(spot.x,spot.y-16);
   for(const node of stops){const v=at(node.q,node.r);ctx.lineTo(v.x,v.y-16)}
   ctx.stroke();ctx.setLineDash([]);
  }
  ctx.restore();
 };
 mapRedraw=draw;
 const redraw=()=>{draw()};worldArt.addEventListener('load',redraw,{once:true});scoutMapArt.addEventListener('load',redraw,{once:true});draw();
 const pointers=new Map();let dragStart=null,moved=false,pinch=null;
 const px=e=>({x:e.clientX-canvas.getBoundingClientRect().left,y:e.clientY-canvas.getBoundingClientRect().top});
 canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,px(e));if(pointers.size===1){dragStart=px(e);moved=false}else if(pointers.size===2){let a=[...pointers.values()];pinch=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;let old=pointers.get(e.pointerId),pos=px(e);pointers.set(e.pointerId,pos);if(pointers.size===2){let a=[...pointers.values()],dist=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinch)mapCamera.zoom=Math.max(.65,Math.min(2.7,mapCamera.zoom*dist/pinch));pinch=dist;moved=true}else{mapCamera.x+=pos.x-old.x;mapCamera.y+=pos.y-old.y;if(Math.hypot(pos.x-dragStart.x,pos.y-dragStart.y)>7)moved=true}draw()});
 canvas.addEventListener('pointerup',e=>{const pos=px(e);pointers.delete(e.pointerId);if(!moved&&pointers.size===0){
    let nearest=null,dist=Infinity;for(let q=-WORLD_RADIUS;q<=WORLD_RADIUS;q++)for(let r=-WORLD_RADIUS;r<=WORLD_RADIUS;r++){
      let a=at(q,r),sx=canvas.clientWidth/2+mapCamera.x+a.x*mapCamera.zoom,sy=canvas.clientHeight/2+mapCamera.y+a.y*mapCamera.zoom,d=Math.hypot(pos.x-sx,pos.y-sy);if(d<dist){nearest={q,r};dist=d}
    }
    if(nearest&&dist<stepY*mapCamera.zoom*.7){mapSelection=nearest;draw();showWorldTile(nearest.q,nearest.r)}
  }if(pointers.size<2)pinch=null;});
 canvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);pinch=null});
 canvas.addEventListener('wheel',e=>{e.preventDefault();mapCamera.zoom=Math.max(.65,Math.min(2.7,mapCamera.zoom*(e.deltaY>0?.9:1.1)));draw()},{passive:false});
 wrap.querySelectorAll('[data-world-zoom]').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.worldZoom==='home'){mapCamera={x:0,y:0,zoom:1}}else{mapCamera.zoom=Math.max(.65,Math.min(2.7,mapCamera.zoom*(b.dataset.worldZoom==='in'?1.2:1/1.2)))}draw()}));
}
function adjacent(q,r,a,b){let dq=q-a,dr=r-b;return (dq===0&&Math.abs(dr)===1)||(Math.abs(dq)===1&&(dr===0||dr===(a%2!==0?1:-1)));}
function hexDistance(q,r,toQ=0,toR=0){
 const key=(a,b)=>`${a},${b}`,queue=[[q,r,0]],seen=new Set([key(q,r)]);
 for(let i=0;i<queue.length;i++){
  const [a,b,d]=queue[i];if(a===toQ&&b===toR)return d;
  for(const [dq,dr] of [[0,-1],[0,1],[1,0],[-1,0],[1,a%2!==0?1:-1],[-1,a%2!==0?1:-1]]){
   const x=a+dq,y=b+dr,k=key(x,y);if(Math.abs(x)>WORLD_RADIUS||Math.abs(y)>WORLD_RADIUS||seen.has(k))continue;
   seen.add(k);queue.push([x,y,d+1]);
  }
 }
 return Math.abs(q-toQ)+Math.abs(r-toR);
}
// Neighbour rules use the same odd-column offset layout as the canvas.
function hexNeighbours(q,r){
 return [[q,r-1],[q,r+1],[q-1,r],[q+1,r],
         [q-1,r+(q%2!==0?1:-1)],[q+1,r+(q%2!==0?1:-1)]]
  .filter(([x,y])=>Math.abs(x)<=WORLD_RADIUS&&Math.abs(y)<=WORLD_RADIUS);
}
function revealScoutHex(q,r,radius=1){
 if(!state.world||!Array.isArray(state.world.discovered))return;
 const seen=new Set(state.world.discovered);
 for(let x=q-radius;x<=q+radius;x++)for(let y=r-radius-1;y<=r+radius+1;y++){
  if(Math.abs(x)<=WORLD_RADIUS&&Math.abs(y)<=WORLD_RADIUS&&hexDistance(q,r,x,y)<=radius)seen.add(`${x},${y}`);
 }
 state.world.discovered=[...seen];
}
function scoutRoute(fromQ,fromR,toQ,toR,allowUnknownDestination=false){
 const goal=`${toQ},${toR}`,known=new Set(state.world.discovered),start=`${fromQ},${fromR}`;
 if(!known.has(goal)&&!allowUnknownDestination)return null;
 const queue=[[fromQ,fromR]],came=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++){
  const [q,r]=queue[i],key=`${q},${r}`;
  if(key===goal){
   const path=[];let cur=key;
   while(cur!==start){const [x,y]=cur.split(',').map(Number);path.unshift({q:x,r:y});cur=came.get(cur);}
   return path;
  }
  for(const [x,y] of hexNeighbours(q,r)){
   const next=`${x},${y}`;
   if(came.has(next)||(!known.has(next)&&next!==goal))continue;
   came.set(next,key);queue.push([x,y]);
  }
 }
 return null;
}
function dispatchScout(q,r){
 update();const type=document.getElementById('pk-scout-type')?.value||'scout',available=scoutAvailable(type);
 const n=Number(document.getElementById('pk-scout-count')?.value||1);
 if(!SCOUT_TYPES[type]||!Number.isSafeInteger(n)||n<1||n>available)return;
 const path=scoutRoute(0,0,q,r,!state.world.discovered.includes(`${q},${r}`));
 if(!path?.length){alert('Er is nog geen route beschikbaar. Ontdek eerst de aangrenzende hexagons.');return;}
 const ms=expeditionStepMs(type),t=now();
 state.army.expeditions.push({id:`${t}-${Math.random().toString(36).slice(2,7)}`,type,count:n,lost:0,q:0,r:0,target:{q,r},travel:{q,r,start:t,end:t+path.length*ms,nextStepEnd:t+ms,route:path,returning:false}});
 save();closeModal();render();
}
function showWorldTile(q,r){
 update();const known=state.world.discovered.includes(oasisKey(q,r));
 const path=scoutRoute(0,0,q,r,!known);
 const can=!!path?.length&&(scoutAvailable('scout')>0||scoutAvailable('horse')>0);
 const choices=[['scout',scoutAvailable('scout')],['horse',scoutAvailable('horse')]].filter(([,n])=>n>0);
 const expedition=can?`<div class="pk-mission-box"><label>Soort verkenner <select id="pk-scout-type">${choices.map(([id,n])=>`<option value="${id}">${SCOUT_TYPES[id].name} (${n})</option>`).join('')}</select></label><label>Aantal verkenners <input type="number" id="pk-scout-count" value="1" min="1" max="${Math.max(...choices.map(c=>c[1]))}"></label><p class="subtle" id="pk-scout-eta">Reistijd heen: ${clockTime(path.length*expeditionStepMs(choices[0][0]))}</p><button class="action" id="sendScout">🥾 Verken · ${path.length} velden</button></div>`:'';
 const bindScout=()=>{if(!can)return;const button=$('#sendScout'),sel=$('#pk-scout-type'),input=$('#pk-scout-count'),eta=$('#pk-scout-eta');if(button)button.onclick=()=>dispatchScout(q,r);if(sel)sel.onchange=()=>{const available=scoutAvailable(sel.value);input.max=available;input.value=Math.min(Number(input.value)||1,available);eta.textContent=`Reistijd heen: ${clockTime(path.length*expeditionStepMs(sel.value))}`;};};
 if(!known){modal(`<h2>🌫️ Onbekend gebied</h2><p>Dit terrein is nog niet verkend.</p><p class="subtle">${can?'Verkenners keren automatisch terug. Je ontvangt pas na terugkomst een rapport.':'Ontdek eerst de aangrenzende hexagons, of wacht tot je verkenners terug zijn.'}</p>${expedition}`);bindScout();return;}
 const t=worldTerrain(q,r),o=oasisByCoord(q,r),scouted=state.world.scouted[oasisKey(q,r)];
 if(t.kind==='village'){modal(`<h2>🏰 ${safeText(villageName())}</h2><p>Je eigen nederzetting.</p><div class="stats"><div class="stat">Coördinaten<b>0 | 0</b></div><div class="stat">Bevolking<b>${fmt(population())}</b></div></div>${expedition}`);bindScout();return;}
 if(!o){modal(`<h2>${t.name}</h2><p>Terrein: ${t.name.toLowerCase()}</p><p>Coördinaten: ${q} | ${r}</p>${expedition}`);bindScout();return;}
 if(!scouted&&o.owner!=='player'){
  modal(`<h2>🌿 ${safeText(TYPES[o.resource].resource)}oase +${o.bonus*100}%</h2><p>Terrein: ${t.name} · ${q} | ${r}</p><p>Deze oase is ontdekt. Welke dieren er leven, ontdek je pas wanneer verkenners levend terugkeren.</p>${expedition}`);bindScout();return;
 }
 const animals=Object.entries(o.animals).filter(([,n])=>n>0).map(([id,n])=>`${ANIMALS[id].icon} ${ANIMALS[id].name}: <b>${Math.ceil(n)}</b>`).join('<br>');
 const slots=(state.buildings.residence||0)>=15?3:(state.buildings.residence||0)>=10?2:(state.buildings.residence||0)>=5?1:0;
 const owned=Object.values(state.world.oases).filter(x=>x.owner==='player').length;
 const g=Object.values(o.garrison||{}).reduce((a,b)=>a+b,0);
 const claim=o.cleared&&!o.owner?`<p>✅ Deze oase is vrijgemaakt. Open de <b>residentie</b> om haar te claimen (niveau 5, 10 of 15).</p>`:'';
 const attack=!o.cleared&&!o.owner?`<h3>⚔️ Aanvallen</h3><p class="subtle">Eenheden reizen met de langzaamste deelnemer. De uitkomst wordt bij aankomst berekend.</p>${unitInputRows(Object.keys(INFANTRY),'pk-send',state.army.units)}<button class="action" id="pk-attack">Stuur aanval</button>`:'';
 const reinforce=o.owner==='player'?`<h3>🛡️ Garnizoen</h3><p>Gestationeerd: ${g} · <b>${oasisStatus(o)}</b>${g<2&&o.unprotectedSince!==null?` · ${clockTime(now()-o.unprotectedSince)} onbewaakt`:''}</p><p class="subtle">Twee soldaten beschermen deze oase volledig tegen wilde dieren.</p>${unitInputRows(Object.keys(INFANTRY),'pk-send',state.army.units)}<button class="action" id="pk-reinforce">Versterking sturen</button><h3>Troepen terugroepen</h3>${unitInputRows(Object.keys(INFANTRY),'pk-recall',o.garrison||{})}<button class="small-btn" id="pk-recall-units">Terugroepen</button>`:'';
 modal(`<h2>🌿 ${safeText(TYPES[o.resource].resource)}oase +${o.bonus*100}%</h2><p>Terrein: ${t.name} · ${q} | ${r}</p><p><b>Status:</b> ${oasisStatus(o)}</p>${!o.cleared&&!o.owner?`<h3>Wilde dieren</h3><p>${animals||'Geen dieren'}</p>`:''}${claim}${attack}${reinforce}`);
 const bind=(id,cb)=>{const el=document.getElementById(id);if(el)el.onclick=cb};
 bind('pk-attack',()=>sendOasisMission(o,'attack'));bind('pk-reinforce',()=>sendOasisMission(o,'reinforce'));bind('pk-recall-units',()=>sendOasisReinforcementHome(o));
}

function renderQueue(){
  const q=state.queue,el=$('#queue');
  if(!q){el.innerHTML='';return}
  let label=q.kind==='field'?TYPES[state.fields[q.id].type].name:BLD[q.id].name;
  let left=Math.max(0,Math.ceil((q.end-now())/1000)),total=q.end-q.start;
  el.innerHTML=`<strong>🔨 In aanbouw: ${label} → niveau ${q.next}</strong><div>Resterend: ${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}</div><div class="meter"><div style="width:${Math.min(100,Math.max(0,(now()-q.start)/total*100))}%"></div></div>`;
}
function render(){
  update();
  renderResources();
  const mainEl=$('#main');
  if(screen==='messages'){if(!$('#modalBackdrop').classList.contains('hidden'))closeModal();screen='fields';showReports();}
  if(screen!=='map'||!mainEl.querySelector('#kingdomWorld')){
    mainEl.innerHTML=screen==='fields'?renderFields():screen==='village'?renderVillage():renderMap();
    if(screen==='map'){setupWorld();const reports=document.getElementById('pk-map-reports');if(reports)reports.onclick=showReports;}
  }
  renderQueue();
  refreshLiveTimers();
  if(screen==='map'){
    const status=$('#scoutStatus');
    if(status)status.innerHTML=state.army.expeditions.length?state.army.expeditions.map(m=>`<div>${SCOUT_TYPES[m.type].icon} ${m.count} ${SCOUT_TYPES[m.type].name.toLowerCase()}(s) · ${m.travel.returning?'terugreis':'heenreis'} ${m.target.q} | ${m.target.r} · nog <span data-timer-end="${m.travel.end}">${clockTime(m.travel.end-now())}</span></div>`).join(''):`🥾 ${scoutAvailable('scout')} verkenner(s), 🐎 ${scoutAvailable('horse')} bereden verkenner(s) beschikbaar.`;
    const counter=$('#worldCounter');if(counter)counter.textContent=`${state.world.discovered.length} ontdekt`;
    if(mapRedraw)mapRedraw();
  }
  document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));renderUnread();
  document.querySelectorAll('[data-rename-village]').forEach(b=>b.addEventListener('click',showRenameVillage));
  document.querySelectorAll('[data-field]').forEach(b=>b.addEventListener('click',()=>showField(+b.dataset.field)));
  document.querySelectorAll('[data-open-village]').forEach(b=>b.addEventListener('click',()=>{screen='village';render()}));
  document.querySelectorAll('[data-building]').forEach(b=>b.addEventListener('click',()=>showBuilding(b.dataset.building)));
  document.querySelectorAll('[data-plot]').forEach(b=>b.addEventListener('click',()=>showPlot(+b.dataset.plot)));
}
function modal(html){$('#modal').innerHTML=`<button class="close" aria-label="Sluiten" id="closeModal">✕</button>`+html;$('#modalBackdrop').classList.remove('hidden');$('#closeModal').onclick=closeModal}
function showRenameVillage(){
 modal(`<h2>🏡 Dorp hernoemen</h2><p>Kies een naam voor je dorp (maximaal 24 tekens).</p><form id="villageRenameForm"><input class="village-name-input" id="villageNameInput" maxlength="24" required value="${safeText(villageName())}" aria-label="Dorpsnaam"><p class="subtle" id="villageNameError"></p><button type="submit" class="action">Naam opslaan</button></form>`);
 const input=$('#villageNameInput');input.focus();input.select();
 $('#villageRenameForm').onsubmit=e=>{e.preventDefault();const name=input.value.trim();if(!name||name.length>24){$('#villageNameError').textContent='Vul een naam in van maximaal 24 tekens.';return;}state.villageName=name;save();closeModal();render();};
}
function closeModal(){$('#modalBackdrop').classList.add('hidden')}
// Project Kingdom v0.10.1: estimate affordability using current production.
function affordability(cost){
  const missing=RES.map((r,i)=>({r,needed:cost[i],have:state.stock[r],rate:r==='crop'?cropNet():perHour(r),cap:availableCap(r)}));
  const blocked=missing.filter(x=>x.needed>x.cap);
  if(blocked.length){
    const names=blocked.map(x=>x.r==='crop'?'graanschuur':'pakhuis');
    const unique=[...new Set(names)];
    return `<p class="affordability warning">📦 Opslag te klein voor deze upgrade. Verbeter eerst ${unique.length===2?'je pakhuis en graanschuur':unique[0]==='pakhuis'?'je pakhuis':'je graanschuur'}.</p>`;
  }
  if(enough(cost))return '<p class="affordability ready">✓ Voldoende grondstoffen: je kunt bouwen.</p>';
  // Real stock accumulates until capped; the slowest resource sets the target.
  const hours=Math.max(...missing.map(x=>Math.max(0,x.needed-x.have)/x.rate));
  if(!Number.isFinite(hours))return '<p class="affordability warning">Geen productie voor een benodigde grondstof.</p>';
  const date=new Date(now()+Math.ceil(hours*3600000));
  const clock=date.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  const day=date.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});
  const today=new Date().toDateString()===date.toDateString();
  return `<p class="affordability">🕒 Voldoende grondstoffen ${today?'vandaag':'op '+day} om <b>${clock}</b></p>`;
}
// Project Kingdom v0.10.1: estimate affordability using current production.
function affordability(cost){
  const missing=RES.map((r,i)=>({r,needed:cost[i],have:state.stock[r],rate:r==='crop'?cropNet():perHour(r),cap:availableCap(r)}));
  const blocked=missing.filter(x=>x.needed>x.cap);
  if(blocked.length){
    const names=blocked.map(x=>x.r==='crop'?'graanschuur':'pakhuis');
    const unique=[...new Set(names)];
    return `<p class="affordability warning">📦 Opslag te klein voor deze upgrade. Verbeter eerst ${unique.length===2?'je pakhuis en graanschuur':unique[0]==='pakhuis'?'je pakhuis':'je graanschuur'}.</p>`;
  }
  if(enough(cost))return '<p class="affordability ready">✓ Voldoende grondstoffen: je kunt bouwen.</p>';
  // Real stock accumulates until capped; the slowest resource sets the target.
  const hours=Math.max(...missing.map(x=>Math.max(0,x.needed-x.have)/x.rate));
  if(!Number.isFinite(hours))return '<p class="affordability warning">Geen productie voor een benodigde grondstof.</p>';
  const date=new Date(now()+Math.ceil(hours*3600000));
  const clock=date.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  const day=date.toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});
  const today=new Date().toDateString()===date.toDateString();
  return `<p class="affordability">🕒 Voldoende grondstoffen ${today?'vandaag':'op '+day} om <b>${clock}</b></p>`;
}
function costHtml(cost,extra=null){return `<div class="cost-grid ${extra!==null?'with-upkeep':''}">${cost.map((c,i)=>`<div class="cost ${state.stock[RES[i]]<c?'insufficient':''}">${ICON[RES[i]]}<br><b>${fmt(c)}</b></div>`).join('')}${extra!==null?`<div class="cost upkeep-cost">🚫🌾<br><b>+${extra}/u</b></div>`:''}</div>`}
function showField(id){
  update();
  let f=state.fields[id],t=TYPES[f.type],next=f.level+1,cost=price(f.type,f.level),busy=!!state.queue;
  modal(`<h2>${t.icon} ${t.name}</h2><p>Veld ${id+1} · niveau ${f.level}</p><div class="stats"><div class="stat">Huidige productie<b>+${fmt(YIELD[f.level]||405*Math.pow(1.5,f.level-10))}/u</b></div><div class="stat">Na verbetering<b>+${fmt(YIELD[next]||405*Math.pow(1.5,next-10))}/u</b></div></div><p><b>Upgrade naar niveau ${next}</b></p>${costHtml(cost,(FIELD_POP[f.type]||0)+levelBand(next))}${affordability(cost)}<p class="subtle">Bouwtijd: ${clockTime(buildDuration(next))} · kosten groeien per niveau ×1,3.</p><button class="action" id="doBuild" ${busy||!enough(cost)?'disabled':''}>${busy?'Er loopt al een bouwopdracht':!enough(cost)?'Niet genoeg grondstoffen':'Verbeter veld'}</button>`);
  $('#doBuild').onclick=()=>startBuild('field',id,cost,next);
}

// v0.12.2: render read-only timer values without recreating open modals every second.
function clockTime(ms){let sec=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(sec/3600)>0?String(Math.floor(sec/3600))+':':''}${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function troopAtHome(){return scoutAvailable('scout')}
function trainingQueueHtml(filter=null){
 const entries=armyTrainingEntries();const pending=filter?entries.filter(x=>x.type===filter):entries;
 if(!pending.length)return '<p class="subtle">Geen eenheden in training.</p>';
 const next=pending[0],idx=entries.findIndex(x=>x.end===next.end&&x.type===next.type);
 const prev=idx>0?entries[idx-1].end:now();
 const stored=next.type==='scout'?state.army.trainingStarted[String(next.end)]:null;
 const base=next.type==='scout'?trainDuration(SCOUT_TRAIN_MS):trainDuration(INFANTRY[next.type]?.ms||600000);
 const start=Number.isFinite(stored)?stored:Math.min(prev,next.end-base);
 return `<div class="pk-training-queue"><div class="pk-timer-row"><span>Volgende ${next.type==='scout'?'verkenner':INFANTRY[next.type]?.name.toLowerCase()||'eenheid'} gereed over</span><strong data-timer-end="${next.end}">${clockTime(next.end-now())}</strong></div><div class="meter pk-training-meter"><div data-training-progress="${next.end}" data-training-start="${start}"></div></div><p class="subtle">${pending.length} in training · Laatste gereed over <span data-timer-end="${pending[pending.length-1].end}">${clockTime(pending[pending.length-1].end-now())}</span></p></div>`;
}
function unitStatsHtml(type){const d=INFANTRY[type];const scout=type==='scout',horse=type==='horse';return `<div class="pk-unit-details"><p><b>Aanval:</b> ${scout?0:horse?0:d.attack}<br><b>Verdediging tegen infanterie:</b> ${scout?10:horse?15:d.inf}<br><b>Verdediging tegen cavalerie:</b> ${scout?5:horse?10:d.cav}<br><b>Snelheid:</b> ${scout?9:horse?18:d.speed} velden/u<br><b>Draagkracht:</b> ${scout?25:horse?50:d.carry}<br><b>Graanverbruik:</b> ${scout?1:horse?2:d.upkeep} per uur</p><b>Trainingskosten</b>${costHtml(scout?SCOUT_COST:horse?HORSE_SCOUT.cost:d.cost)}</div>`}
function bindTroopDetails(){document.querySelectorAll('#modal [data-troop-detail]').forEach(b=>b.onclick=()=>{const detail=b.nextElementSibling;if(detail)detail.hidden=!detail.hidden;});}
function scoutingHtml(){
 const a=state.army;
 const stationed=[...(scoutAvailable('scout')>0?[['scout','Verkenner',UNIT_ICON_SCOUT,scoutAvailable('scout')]]:[]),...(scoutAvailable('horse')>0?[['horse','Bereden verkenner',null,scoutAvailable('horse')]]:[]),...Object.entries(INFANTRY).filter(([id])=>(a.units[id]||0)>0).map(([id,d])=>[id,d.name,d.icon,a.units[id]])];
 const garrison=stationed.length?stationed.map(([id,name,icon,count])=>`<div class="pk-troop-item"><button type="button" data-troop-detail="${id}" class="pk-troop-toggle">${icon?`<img src="${icon}" width="24" height="24" alt="">`:'🐎'} <span>${name}: <b>${count}</b></span> <span>⌄</span></button><div hidden>${unitStatsHtml(id)}</div></div>`).join(''):'<p class="subtle">Er zijn geen troepen in het dorp.</p>';
 const expedition=a.expeditions.length?a.expeditions.map(m=>`<div class="pk-movement"><b>${SCOUT_TYPES[m.type].icon} ${SCOUT_TYPES[m.type].name} · ${m.count} eenheden</b><p>Bestemming: ${m.target.q} | ${m.target.r} · ${m.travel.returning?'Terugreis':'Heenreis'}</p><div>Resterend: <strong data-timer-end="${m.travel.end}">${clockTime(m.travel.end-now())}</strong></div></div>`).join(''):'<p class="subtle">Er zijn geen expedities onderweg.</p>';
 return `<section class="pk-army"><hr><h3>🚩 Troepenoverzicht</h3><div class="pk-army-stats"><div><b>${scoutAvailable('scout')+scoutAvailable('horse')+Object.values(a.units).reduce((n,v)=>n+v,0)}</b><small>In dorp</small></div><div><b>${a.expeditions.reduce((n,m)=>n+m.count,0)}</b><small>Verkenners onderweg</small></div><div><b>${armyTrainingEntries().length+a.mountedTraining.length}</b><small>In training</small></div></div><p>🌾 Graanverbruik troepen: <b>${upkeepPerHour()} per uur</b></p><h3>Lopende expedities</h3>${expedition}<h3>Garnizoen</h3>${garrison}<h3>Training</h3>${trainingQueueHtml()}<h3>📜 Rapporten</h3><button class="action" id="pk-open-reports">Berichten bekijken (${state.world.reports.length})</button>${state.world.missions.length?`<h3>Legerbewegingen</h3>${state.world.missions.map(m=>`<p class="pk-movement">${m.kind==='attack'?'⚔️ Aanval':m.kind==='reinforce'?'🛡️ Versterking':'🏠 Terugreis'} · ${m.q} | ${m.r}<br>${Object.values(m.units).reduce((a,b)=>a+b,0)} soldaten · aankomst over <span data-timer-end="${m.arrive}">${clockTime(m.arrive-now())}</span></p>`).join('')}`:''}</section>`;
}
function refreshLiveTimers(){
 const m=document.getElementById('modal');if(!m||document.getElementById('modalBackdrop').classList.contains('hidden'))return;
 m.querySelectorAll('[data-timer-end]').forEach(el=>el.textContent=clockTime(Number(el.dataset.timerEnd)-now()));
 m.querySelectorAll('[data-training-progress]').forEach(el=>{const end=Number(el.dataset.trainingProgress),start=Number(el.dataset.trainingStart);el.style.width=`${Math.max(0,Math.min(100,100*(now()-start)/Math.max(1,end-start)))}%`});
 // On completion refresh the modal once to update unit counts without losing an active interaction.
 if(m.querySelector('[data-timer-end]')&&state.research&&state.research.queue===null&&m.querySelector('.pk-new-infantry')&&m.querySelector('h3')?.textContent?.includes('Troepenonderzoek'))showBuilding('academy');
 const nextShown=m.querySelector('.pk-training-queue [data-timer-end]');if(nextShown&&Number(nextShown.dataset.timerEnd)<=now()){const barracks=m.querySelector('.scout-training');if(barracks)showBuilding('barracks');else if(m.querySelector('.pk-army'))showBuilding('rally');}
 const preview=m.querySelector('[data-army-training-count]');if(preview&&Number(preview.dataset.armyTrainingCount)!==state.army.training.length){const id=preview.dataset.armyBuilding;if(id)showBuilding(id)}
}

function showBuilding(id){
  if(!BLD[id])return;
  update();
  let level=state.buildings[id]||0,next=level+1,cost=buildingPrice(id,next);
  const underConstruction=level===0 && Object.values(state.plots).includes(id);
  if(underConstruction){modal(`<h2>${BLD[id].icon} ${BLD[id].name} in aanbouw</h2><p>Dit gebouw wordt op deze plek gebouwd. Na afronding verschijnt het op niveau 1.</p>`);return;}
  let info=
    id==='warehouse'?`Opslag hout, klei en erts: ${fmt(storageCap(level))} → ${fmt(storageCap(next))}`:
    id==='granary'?`Graanopslag: ${fmt(storageCap(level))} → ${fmt(storageCap(next))}`:
    id==='main'?`Het hoofdgebouw versnelt het bouwen en verbeteren van gebouwen en velden. Huidige bouwtijdbesparing: ${Math.round((1-speedFactor(level))*100)}%.`:
    id==='wall'?'De stadsmuur omringt het dorp. Verdediging voegen we later toe, maar je kunt hem nu al bouwen en verbeteren.':
    id==='barracks'?`Train hier verkenners en onderzochte infanterie. Huidige trainingstijdbesparing: ${Math.round((1-speedFactor(level))*100)}%.`:
    id==='market'?'De marktplaats wordt later de plek voor handel en transport. Voor nu kun je hem bouwen en verbeteren.':
    id==='smithy'?'De smederij wordt later de plek om wapens en uitrusting te verbeteren. Voor nu kun je hem bouwen en verbeteren.':
    id==='academy'?`Onderzoek hier nieuwe infanterie. Huidige onderzoekstijdbesparing: ${Math.round((1-speedFactor(level))*100)}%.`:
    id==='stables'?'Hier train je bereden verkenners nadat je ze in de academie hebt onderzocht.':
    id==='residence'?'Met residentie niveau 5, 10 en 15 kun je maximaal 1, 2 of 3 wilde oases claimen. Kolonisten volgen later.':
    id==='workshop'?'Hier bouwen we later belegeringswerktuigen zoals stormrammen en katapulten.':
    'De verzamelplaats is de vaste plek voor troepenbewegingen. Gevechten en troepen volgen later.';
  modal(`<h2>${BLD[id].icon} ${BLD[id].name}</h2><p>Huidig niveau: ${level}</p><p>${info}</p><p><b>${level?'Upgrade':'Bouwen'} naar niveau ${next}</b></p>${costHtml(cost,(BUILDING_POP[id]||0)+levelBand(next))}${affordability(cost)}<p class="subtle">Bouwtijd: ${clockTime(buildDuration(next))}</p><button class="action" id="doBuild" ${state.queue||!enough(cost)?'disabled':''}>${state.queue?'Er loopt al een bouwopdracht':!enough(cost)?'Niet genoeg grondstoffen':level?'Gebouw verbeteren':'Gebouw plaatsen'}</button>`);
  $('#doBuild').onclick=()=>startBuild('building',id,cost,next);
  if(id==='residence'){
    const current=Object.values(state.world.oases||{}).filter(o=>o.owner==='player').length;
    const limit=level>=15?3:level>=10?2:level>=5?1:0;
    const free=Object.values(state.world.oases||{}).filter(o=>o.cleared&&!o.owner&&state.world.discovered.includes(oasisKey(o.q,o.r)));
    const panel=`<section class="pk-residence-oases"><hr><h3>🌿 Oasebeheer</h3><p>Geclaimde oases: <b>${current}/${limit}</b> · niveaus 5 / 10 / 15 geven 1 / 2 / 3 plaatsen.</p>${free.length?free.map(o=>`<div class="pk-report-item"><b>${TYPES[o.resource].resource}oase +${o.bonus*100}% (${o.q} | ${o.r})</b><button class="action" data-residence-claim="${oasisKey(o.q,o.r)}" ${current>=limit?'disabled':''}>Oase claimen</button></div>`).join(''):'<p class="subtle">Er zijn nog geen vrijgemaakte oases beschikbaar.</p>'}</section>`;
    $('#modal').insertAdjacentHTML('beforeend',panel);
    document.querySelectorAll('[data-residence-claim]').forEach(b=>b.onclick=()=>{const o=state.world.oases[b.dataset.residenceClaim];claimOasis(o);showBuilding('residence');});
  }
  if(id==='rally'){$('#modal').insertAdjacentHTML('beforeend',scoutingHtml());const recall=$('#recallScout');if(recall)recall.onclick=recallScout;bindTroopDetails();const reports=$('#pk-open-reports');if(reports)reports.onclick=showReports;}
  if(id==='academy'&&level>=1){
    const panel=document.createElement('section');panel.className='pk-new-infantry';
    panel.innerHTML='<hr><h3>📚 Troepenonderzoek</h3><p class="subtle">Onderzoek is eenmalig per dorp. Kosten: 130% van de trainingskosten; maximaal één onderzoek tegelijk.</p>';
    $('#modal').appendChild(panel);
    if(state.research.queue){const q=state.research.queue;const def=INFANTRY[q.type];
      panel.insertAdjacentHTML('beforeend',`<div class="pk-unit-card"><b>🔬 Onderzoek bezig: ${def?def.name:q.type}</b><p>Gereed over <strong data-timer-end="${q.end}">${clockTime(q.end-now())}</strong></p><div class="meter"><div data-training-progress="${q.end}" data-training-start="${q.start}" style="width:${Math.max(0,Math.min(100,100*(now()-q.start)/(q.end-q.start)))}%"></div></div></div>`);
    }
    Object.entries(INFANTRY).forEach(([type,def])=>{
      const done=!!state.research.done[type],active=state.research.queue?.type===type,requirements=researchRequirements(def),costs=researchCost(def);
      if(done||active)return;
      const req=`Kazerne ${def.barracks} · Academie ${def.academy}${def.smithy?' · Smederij '+def.smithy:''}`;
      const box=document.createElement('div');box.className='pk-unit-card';
      box.innerHTML=`<div class="pk-unit-title"><img src="${def.icon}" width="28" height="28" alt=""><b>${def.name}</b></div><p class="subtle">Vereisten: ${req}</p><p>${done?'✅ Onderzocht':active?'⏳ Onderzoek bezig':requirements?'🔓 Onderzoek beschikbaar':'🔒 Gebouwen nog niet op niveau'}</p><p>Onderzoekstijd: <b>${clockTime(researchDuration(def.researchMs))}</b> (basis ${clockTime(def.researchMs)})</p><p><b>Eenmalige onderzoekskosten:</b></p>${costHtml(costs)}<button type="button" class="action" ${done||active||!requirements||!!state.research.queue||!!state.army.mountedResearch.queue||!enough(costs)?'disabled':''}>${done?'Onderzocht':active?'Bezig':state.research.queue?'Ander onderzoek bezig':!requirements?'Vereisten ontbreken':!enough(costs)?'Niet genoeg grondstoffen':'Start onderzoek'}</button>`;
      panel.appendChild(box);
      box.querySelector('button').onclick=()=>{
        update();initResearch();if(state.research.done[type]||state.research.queue||state.army.mountedResearch.queue||!researchRequirements(def)||!enough(costs))return;
        RES.forEach((r,i)=>state.stock[r]-=costs[i]);const start=now();state.research.queue={type,start,end:start+researchDuration(def.researchMs)};
        save();showBuilding('academy');renderResources();
      };
    });
  }
  if(id==='academy'&&level>=5){
   const d=HORSE_SCOUT,research=state.army.mountedResearch;
   if(!research.done){const prereq=(state.buildings.stables||0)>=1,price=researchCost(d),running=research.queue;
    $('#modal').insertAdjacentHTML('beforeend',`<section class="pk-unit-card"><h3>🐎 Bereden verkenner onderzoeken</h3><p>Vereisten: academie niveau 5 en stallen niveau 1.</p>${running?`<p>Onderzoek gereed over <strong data-timer-end="${running.end}">${clockTime(running.end-now())}</strong></p>`:`<p>Onderzoekstijd: ${clockTime(researchDuration(d.researchMs))}</p>${costHtml(price)}<button class="action" id="pk-research-horse" ${!prereq||!enough(price)||!!state.research.queue?'disabled':''}>Onderzoeken</button>`}</section>`);
    const b=$('#pk-research-horse');if(b)b.onclick=()=>{update();if(state.army.mountedResearch.done||state.army.mountedResearch.queue||state.research.queue||!prereq||!enough(price))return;RES.forEach((r,i)=>state.stock[r]-=price[i]);const t=now();state.army.mountedResearch.queue={start:t,end:t+researchDuration(d.researchMs)};save();showBuilding('academy');renderResources()};
   }
  }
  if(id==='stables'&&level>=1){
   const d=HORSE_SCOUT,ready=state.army.mountedResearch.done;
   $('#modal').insertAdjacentHTML('beforeend',`<section class="pk-unit-card"><h3>🐎 Bereden verkenner</h3><p>Beschikbaar: <b>${state.army.mountedScouts}</b> · In training: <b>${state.army.mountedTraining.length}</b></p><p>⚔️ 0 · 🛡️ 15/10 · 🐎 18 hex/u · 📦 50 · 🌾 2/u · zichtstraal 2</p><p>${ready?'Onderzocht':'🔒 Eerst onderzoeken in de academie (niveau 5)'}</p>${state.army.mountedTraining.length?`<p>Volgende gereed over <strong data-timer-end="${state.army.mountedTraining[0]}">${clockTime(state.army.mountedTraining[0]-now())}</strong></p>`:''}<label>Aantal <input id="pk-horse-count" type="number" min="1" max="500" value="1" inputmode="numeric"></label><div id="pk-horse-cost">${costHtml(d.cost)}</div><button class="action" id="pk-horse-train" ${ready?'':'disabled'}>Train bereden verkenners</button></section>`);
   const input=$('#pk-horse-count'),btn=$('#pk-horse-train');const preview=()=>{const n=Number(input.value),valid=Number.isSafeInteger(n)&&n>=1&&n<=500,price=d.cost.map(c=>c*(valid?n:0));$('#pk-horse-cost').innerHTML=costHtml(price);btn.disabled=!ready||!valid||!enough(price);return valid?n:0};
   input.oninput=preview;btn.onclick=()=>{update();const n=preview(),price=d.cost.map(c=>c*n);if(!n||!state.army.mountedResearch.done||!enough(price))return;RES.forEach((r,i)=>state.stock[r]-=price[i]);let last=Math.max(now(),state.army.mountedTraining.at(-1)||0);for(let i=0;i<n;i++){last+=Math.max(1000,Math.round(d.ms*speedFactor(state.buildings.stables||1)));state.army.mountedTraining.push(last);}save();showBuilding('stables');renderResources()};preview();
  }
  if(id==='barracks'&&(state.buildings.barracks||0)>=1){
    const sc=state.army.scout,wait=state.army.training.length;
    const card=document.createElement('div');card.className='scout-training';
    const t=state.army.training[0],ts=state.army.trainingStarted||{};
    card.innerHTML=`<div data-army-training-count="${wait}" data-army-building="barracks"><hr><h3><img class="pk-inline-unit" src="${UNIT_ICON_SCOUT}" alt=""> Verkenner</h3><p>Beschikbaar: <b>${state.army.scouts}</b> · In training: <b>${wait}</b></p><p>⚔️ Aanval 0 · 🛡️ Verdediging 10 / 5 · 🚶 9 velden/u · 📦 25 · 🌾 1 graan/u</p><p><b>Training:</b> ${clockTime(trainDuration(SCOUT_TRAIN_MS))} per verkenner (basis 10:00)</p>${wait?trainingQueueHtml('scout'):''}<div class="pk-batch"><label for="scoutAmount">Aantal verkenners</label><div class="pk-batch-row"><input type="number" inputmode="numeric" min="1" max="500" step="1" id="scoutAmount" value="1"><button type="button" class="small-btn" id="scoutMax">Maximum (${maxScoutOrder()})</button></div><p class="subtle" id="scoutTotalTime"></p><p><b>Totale kosten</b></p><div id="scoutCostPreview"></div><button type="button" class="action" id="trainScout">Train verkenners</button></div></div>`;
    $('#modal').appendChild(card);
    const quantity=$('#scoutAmount'),train=$('#trainScout'),preview=$('#scoutCostPreview'),timing=$('#scoutTotalTime');
    function selection(){
      const n=Number(quantity.value),valid=Number.isSafeInteger(n)&&n>=1&&n<=500;
      const costs=SCOUT_COST.map(c=>c*(valid?n:0));
      preview.innerHTML=costHtml(costs);
      const end=Math.max(now(),lastTrainingEnd())+Math.max(0,valid?n:0)*trainDuration(SCOUT_TRAIN_MS);
      timing.textContent=valid?`${n} × ${clockTime(trainDuration(SCOUT_TRAIN_MS))} · laatste gereed over ${clockTime(end-now())}`:'Vul een geldig aantal van 1 tot 500 in.';
      train.disabled=!valid||!enough(costs);train.textContent=valid?`Train ${n} verkenner${n===1?'':'s'}`:'Train verkenners';
      return valid?n:0;
    }
    quantity.addEventListener('input',selection);
    $('#scoutMax').onclick=()=>{quantity.value=maxScoutOrder();selection()};
    train.onclick=()=>{
      update();const n=selection(),costs=SCOUT_COST.map(c=>c*n);
      if(!n||!enough(costs))return;
      RES.forEach((r,i)=>state.stock[r]-=costs[i]);
      const times=state.army.training;let nextStart=Math.max(now(),lastTrainingEnd());
      for(let i=0;i<n;i++){const finish=nextStart+trainDuration(SCOUT_TRAIN_MS);times.push(finish);state.army.trainingStarted[String(finish)]=nextStart;nextStart=finish;}
      save();showBuilding('barracks');renderResources();
    };
    selection();
    // Additional infantry shares the barracks queue with scouts, including offline completion.
    const list=document.createElement('section');list.className='pk-new-infantry';
    list.innerHTML='<hr><h3>⚔️ Overige infanterie</h3><p class="subtle">Eenheden vereisen onderzoek in de academie (behalve de verkenner).</p>';
    $('#modal').appendChild(list);
    list.insertAdjacentHTML('beforeend',trainingQueueHtml());
    Object.entries(INFANTRY).forEach(([type,def])=>{
      const unlocked=unitUnlocked(def),queued=state.army.unitTraining.filter(x=>x.type===type).length;
      if(!unlocked)return;
      const node=document.createElement('div');node.className='pk-unit-card';
      const requirements=[`Kazerne niveau ${def.barracks}`,def.academy?`Academie niveau ${def.academy}`:'',def.smithy?`Smederij niveau ${def.smithy}`:''].filter(Boolean).join(' · ');
      node.innerHTML=`<div class="pk-unit-title"><img src="${def.icon}" width="28" height="28" alt=""><b>${def.name}</b></div><p>In dorp: <b>${unitAvailable(type)}</b> · In training: <b>${queued}</b></p>${queued?trainingQueueHtml(type):''}<p class="subtle">Aanval ${def.attack} · Verdediging ${def.inf}/${def.cav} · ${def.speed} velden/u · Draagkracht ${def.carry} · 🌾 ${def.upkeep}/u</p><p class="subtle">${requirements}${unlocked?' · Onderzocht':' · 🔒 Eerst onderzoeken in academie'}</p><p>Training per eenheid: <b>${clockTime(trainDuration(def.ms))}</b> (basis ${clockTime(def.ms)})</p><div class="pk-unit-order"><label>Aantal <input type="number" min="1" max="500" inputmode="numeric" value="1" ${unlocked?'':'disabled'}></label><button type="button" class="small-btn" ${unlocked?'':'disabled'}>Maximum (${maxUnitOrder(def)})</button></div><div class="pk-unit-cost"></div><p class="pk-unit-time subtle"></p><button type="button" class="action pk-unit-train" ${unlocked?'':'disabled'}>Train ${def.name.toLowerCase()}</button>`;
      list.appendChild(node);
      const input=node.querySelector('input'),max=node.querySelector('.small-btn'),button=node.querySelector('.pk-unit-train');
      const costNode=node.querySelector('.pk-unit-cost'),timeNode=node.querySelector('.pk-unit-time');
      function preview(){const n=Number(input.value),valid=Number.isSafeInteger(n)&&n>=1&&n<=500;const total=def.cost.map(v=>v*(valid?n:0));costNode.innerHTML=costHtml(total);timeNode.textContent=valid?`Totale trainingsduur ${clockTime(trainDuration(def.ms)*n)} · laatste gereed over ${clockTime(Math.max(now(),lastTrainingEnd())+trainDuration(def.ms)*n-now())}`:'Vul een aantal van 1 t/m 500 in.';button.disabled=!unlocked||!valid||!enough(total);return valid?n:0}
      max.onclick=()=>{input.value=maxUnitOrder(def);preview()};input.addEventListener('input',preview);
      button.onclick=()=>{update();let n=preview();const cost=def.cost.map(v=>v*n);if(!unlocked||!n||!enough(cost))return;RES.forEach((r,i)=>state.stock[r]-=cost[i]);let end=Math.max(now(),lastTrainingEnd());for(let j=0;j<n;j++){end+=trainDuration(def.ms);state.army.unitTraining.push({type,end});}state.army.unitTraining.sort((a,b)=>a.end-b.end);save();showBuilding('barracks');renderResources()};
      preview();
    });
  }
}
$('#helpBtn').onclick=()=>modal(`<h2>📜 Welkom in Project Kingdom!</h2><p>Dit is ons eerste speelbare prototype. Je begint met 200 van elke grondstof, produceert 25 per uur en hebt standaard maximaal 600 opslagruimte per grondstof.</p><p>Open <b>Velden</b>, tik op een stuk land en koop een upgrade. Na de bouwtijd stijgt de productie. Ook als je deze pagina sluit, verstrijkt de tijd gewoon.</p><p>Bij <b>Dorp</b> kun je gebouwen bouwen, plaatsen of verbeteren. Pakhuis en graanschuur verhogen je opslag vanaf niveau 1 naar 800. De marktplaats ontgrendel je met hoofdgebouw niveau 3. De kazerne ontgrendel je met hoofdgebouw niveau 3 en verzamelplaats niveau 1. De smederij en academie ontgrendel je met hoofdgebouw niveau 5 en kazerne niveau 3. Hoofdgebouw, verzamelplaats en muur hebben een vaste plek.</p><p class="subtle">Tip: op een iPhone kun je via Safari → Deel → Zet op beginscherm een snelkoppeling toevoegen zodra de game online staat.</p><button class="small-btn" id="resetBtn">Begin opnieuw (verwijder spelstand)</button>`);
document.addEventListener('click',e=>{if(e.target.id==='resetBtn'&&confirm('Weet je zeker dat je opnieuw wilt beginnen?')){state=initial();save();closeModal();render()}});
$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{if(b.dataset.screen==='messages'){showReports();return;}screen=b.dataset.screen;resourceOpen=null;closeModal();render()});
render();
setInterval(render,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
