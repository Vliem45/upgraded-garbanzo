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
const initial=()=>({
  version:1,
  plots:{},
  stock:{wood:200,clay:200,iron:200,crop:200},
  fields:['wood','crop','iron','crop','clay','crop','wood','iron','crop','clay'].map((type,i)=>({type,id:i,level:0})),
  buildings:{main:1,warehouse:0,granary:0,wall:0,rally:0,barracks:0,market:0,smithy:0,academy:0,stables:0,residence:0,workshop:0},
  queue:null,
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
if(!state.plots||typeof state.plots!=='object')state.plots={};
if(!state.buildings)state.buildings={main:1,warehouse:0,granary:0};
for(const [id,def] of Object.entries({main:1,warehouse:0,granary:0,wall:0,rally:0,barracks:0,market:0,smithy:0,academy:0,stables:0,residence:0,workshop:0})){
  if(state.buildings[id]==null)state.buildings[id]=def;
}

// Units persist inside the original village save, alongside world state.
const SCOUT_COST=[160,100,50,50],SCOUT_TRAIN_MS=600000,SCOUT_STEP_MS=400000;
function initScouts(){
 if(!state.army||typeof state.army!=='object')state.army={scouts:1,training:[],scout:{q:0,r:0,travel:null}};
 if(!Number.isFinite(state.army.scouts))state.army.scouts=1;
 if(!Array.isArray(state.army.training))state.army.training=[];
 if(!state.army.trainingStarted||typeof state.army.trainingStarted!=='object')state.army.trainingStarted={};
 if(!state.army.scout)state.army.scout={q:0,r:0,travel:null};
 if(!Number.isFinite(state.army.starvationProgress))state.army.starvationProgress=0;
 if(!Array.isArray(state.army.losses))state.army.losses=[];
 if(!Number.isInteger(state.army.scout.q))state.army.scout.q=0;
 if(!Number.isInteger(state.army.scout.r))state.army.scout.r=0;
}
function upkeepPerHour(){return state.army?state.army.scouts:0}
function maxScoutOrder(){return Math.max(0,Math.min(500,...RES.map((r,i)=>Math.floor((state.stock[r]+0.000001)/SCOUT_COST[i]))))}
function applyCropInterval(hours){
 if(hours<=0)return;
 let crop=state.stock.crop,prod=perHour('crop'),remaining=hours,guard=0;
 while(remaining>1e-10 && guard++<10000){
  const deficit=upkeepPerHour()-prod;
  if(deficit<=0){crop=Math.min(availableCap('crop'),crop-deficit*remaining);break;}
  if(crop>0){const toZero=crop/deficit;const step=Math.min(remaining,toZero);crop=Math.max(0,crop-deficit*step);remaining-=step;if(remaining<1e-10)break;}
  if(state.army.scouts<=0){crop=Math.min(availableCap('crop'),crop+prod*remaining);break;}
  const progress=state.army.starvationProgress||0;
  const timeUntilDeath=Math.max(0,(1-progress)/deficit);
  if(remaining+1e-10<timeUntilDeath){state.army.starvationProgress=progress+remaining*deficit;remaining=0;break;}
  remaining-=timeUntilDeath;state.army.starvationProgress=0;
  state.army.scouts=Math.max(0,state.army.scouts-1);
  state.army.losses.push({time:Date.now(),kind:'scout',reason:'starvation',count:1});
  if(state.army.losses.length>30)state.army.losses=state.army.losses.slice(-30);
  // A lone scout on the map is lost only if no stationed scout remains.
  if(state.army.scouts===0){state.army.scout.travel=null;state.army.scout.q=0;state.army.scout.r=0;}
 }
 state.stock.crop=Math.max(0,Math.min(availableCap('crop'),crop));
 if(state.stock.crop>0||upkeepPerHour()<=perHour('crop'))state.army.starvationProgress=0;
}
function applyResourceInterval(from,to){
 let hours=Math.max(0,to-from)/3600000;if(!hours)return;
 for(const r of ['wood','clay','iron'])state.stock[r]=Math.max(0,Math.min(availableCap(r),state.stock[r]+perHour(r)*hours));
 applyCropInterval(hours);
}
function resolveArmyTraining(time){
 while(state.army.training.length&&state.army.training[0]<=time){const done=state.army.training.shift();delete state.army.trainingStarted[String(done)];state.army.scouts++;}
}
function finishArmyTimers(time){
 initScouts();let changed=false;
 while(state.army.training.length&&state.army.training[0]<=time){const done=state.army.training.shift();delete state.army.trainingStarted[String(done)];state.army.scouts++;changed=true;}
 const scout=state.army.scout;
 if(scout.travel&&time>=scout.travel.end){
  scout.q=scout.travel.q;scout.r=scout.travel.r;scout.travel=null;
  for(let q=scout.q-1;q<=scout.q+1;q++)for(let r=scout.r-1;r<=scout.r+1;r++){
   if(Math.abs(q)<=WORLD_RADIUS&&Math.abs(r)<=WORLD_RADIUS){const key=`${q},${r}`;if(!state.world.discovered.includes(key))state.world.discovered.push(key);}
  }
  changed=true;
 }
 return changed;
}
const availableCap=r=>storageCap(state.buildings[r==='crop'?'granary':'warehouse']||0);
function perHour(r){return 25+state.fields.filter(f=>f.type===r).reduce((n,f)=>n+(YIELD[f.level]||Math.round(405*Math.pow(1.5,f.level-10))),0)}
function update(){
 const t=now();initWorld();initScouts();
 let cursor=Math.min(t,state.last||t),safety=0;
 // Event-based offline progression: finish construction and training in chronological order.
 while(cursor<t&&safety++<10000){
  let boundary=t;
  if(state.queue&&state.queue.end>cursor)boundary=Math.min(boundary,state.queue.end);
  if(state.army.training.length&&state.army.training[0]>cursor)boundary=Math.min(boundary,state.army.training[0]);
  applyResourceInterval(cursor,boundary);cursor=boundary;
  if(state.queue&&state.queue.end<=cursor){
   const q=state.queue;
   if(q.kind==='field')state.fields[q.id].level++;
   if(q.kind==='building')state.buildings[q.id]=(state.buildings[q.id]||0)+1;
   state.queue=null;
  }
  resolveArmyTraining(cursor);
 }
 // Legacy saves may have timers ending before their saved last-update timestamp.
 if(state.queue&&state.queue.end<=t){const q=state.queue;if(q.kind==='field')state.fields[q.id].level++;if(q.kind==='building')state.buildings[q.id]=(state.buildings[q.id]||0)+1;state.queue=null;}
 resolveArmyTraining(t);finishArmyTimers(t);
 state.last=t;save();
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
  state.queue={kind,id,next,start:now(),end:now()+duration(next)};
  save();
  closeModal();
  render();
}
const $=s=>document.querySelector(s);
function renderResources(){
  const el=$('#resources');
  el.innerHTML=RES.map(r=>`<button class="resource ${state.stock[r]>=availableCap(r)?'full':''}" data-res="${r}"><span class="emoji">${ICON[r]}</span><span class="num">${fmt(state.stock[r])}</span><span class="cap">/ ${fmt(availableCap(r))}</span></button>`).join('');
  const p=$('#productionPanel');
  p.classList.toggle('hidden',!resourceOpen);
  if(resourceOpen)p.innerHTML=`${ICON[resourceOpen]} <b>${TYPES[resourceOpen].resource}</b> · +${fmt(perHour(resourceOpen)-(resourceOpen==='crop'?upkeepPerHour():0))} per uur · opslag ${fmt(state.stock[resourceOpen])} / ${fmt(availableCap(resourceOpen))}`;
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{resourceOpen=resourceOpen===b.dataset.res?null:b.dataset.res;renderResources()}))
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
  return `<div class="scene-head"><div><h1>De landerijen</h1><p>Tik op een grondstofgebied om te verbeteren</p></div><span class="pill">10 velden</span></div><section class="landscape-scene" aria-label="Geïllustreerde landerijen met tien interactieve grondstofvelden"><img class="landscape-art" src="assets/landerijen-v040.webp" alt="Doorlopend landschap met twee houthakkers, twee mijnen, twee kleigroeven, vier graanvelden en een dorp met brug" draggable="false">${spots}<button type="button" class="land-village" data-open-village aria-label="Ga naar de dorpskern"><span>🏰 Dorp</span></button></section><p class="land-instruction">Tik op een veld om te upgraden of op het dorp om naar de dorpskern te gaan.</p><div class="info-strip"><span>🏡 Basisproductie +25/u</span><span>🔨 Eén bouwproject tegelijk</span></div>`;
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
  return `<div class="scene-head"><div><h1>De dorpskern</h1></div><span class="pill">🏡 Dorp 1</span></div>
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
  state.queue={kind:'building',id:type,next:1,start:t,end:t+duration(1)};
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
  const costs=placeOnly?`<p class="subtle">Dit gebouw is al gebouwd en kan gratis op een vrije plek worden neergezet.</p>`:`<p class="subtle">Bouwkosten: 🪵 ${fmt(cost[0])} · 🧱 ${fmt(cost[1])} · ⛏️ ${fmt(cost[2])} · 🌾 ${fmt(cost[3])}</p>`;
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
 if(q===0&&r===0)return {name:'Dorp 1',sprite:[1,1],kind:'village'};
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
function renderMap(){
 initWorld();
 return `<div class="scene-head"><div><h1>De wereld</h1><p>Ontdek je eigen koninkrijk</p></div><span class="pill" id="worldCounter">${state.world.discovered.length} ontdekt</span></div>
  <div class="world-map-shell"><canvas id="kingdomWorld" aria-label="Hexagonwereldkaart"></canvas>
  <div class="map-controls"><button type="button" data-world-zoom="in" aria-label="Inzoomen">＋</button><button type="button" data-world-zoom="out" aria-label="Uitzoomen">−</button><button type="button" data-world-zoom="home" aria-label="Centreer op eigen dorp">⌂</button></div></div>
  <p class="note" id="scoutStatus">Tik op een aangrenzende zeshoek om je verkenner te sturen. Elke stap duurt 6 minuten en 40 seconden.</p>
  <p class="world-credit">Kaarttegels: The Clover Patch, Fantasy Hex Tiles (CC BY 4.0).</p>`;
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
    if(visible&&q===0&&r===0){ctx.fillStyle='#f1d595';ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.fillText('Dorp 1',x,y+33)}
    if(mapSelection&&mapSelection.q===q&&mapSelection.r===r){ctx.beginPath();ctx.ellipse(x,y,29,27,0,0,Math.PI*2);ctx.strokeStyle='#ffe7aa';ctx.lineWidth=2.5;ctx.stroke()}
  }
  const scout=state.army.scout,spot=at(scout.q,scout.r);
  ctx.fillStyle='#fce3a7';ctx.strokeStyle='#183b28';ctx.lineWidth=3;ctx.beginPath();ctx.arc(spot.x,spot.y-16,8,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText('🚶',spot.x,spot.y-12);
  if(scout.travel){const goal=at(scout.travel.q,scout.travel.r);ctx.strokeStyle='#f7d78b';ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(spot.x,spot.y-16);ctx.lineTo(goal.x,goal.y-16);ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();
 };
 mapRedraw=draw;
 const redraw=()=>{draw()};worldArt.addEventListener('load',redraw,{once:true});draw();
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
function dispatchScout(q,r){
 update();const sc=state.army.scout;
 if(sc.travel||!state.army.scouts||!adjacent(q,r,sc.q,sc.r))return;
 sc.travel={q,r,end:now()+SCOUT_STEP_MS};save();closeModal();render();if(mapRedraw)mapRedraw();
}
function showWorldTile(q,r){
 initScouts();
 if(!state.world.discovered.includes(`${q},${r}`)){
   const sc=state.army.scout,can=state.army.scouts>0&&!sc.travel&&adjacent(q,r,sc.q,sc.r);
   modal(`<h2>🌫️ Onbekend gebied</h2><p>Dit terrein is nog niet verkend.</p>${can?'<button class="action" id="sendScout">🧭 Stuur verkenner (6:40)</button>':'<p class="subtle">Je kunt alleen aangrenzende tegels verkennen en niet tijdens een lopende tocht.</p>'}`);
   if(can)$('#sendScout').onclick=()=>dispatchScout(q,r);return;
 }
 const sc=state.army.scout,can=state.army.scouts>0&&!sc.travel&&adjacent(q,r,sc.q,sc.r);
 const sendButton=can?'<button class="action" id="sendScout">🧭 Stuur verkenner (6:40)</button>':'';
 const hook=()=>{if(can)$('#sendScout').onclick=()=>dispatchScout(q,r)};
 const t=worldTerrain(q,r);
 if(t.kind==='village'){
  modal(`<h2>🏰 Dorp 1</h2><p>Je eigen nederzetting.</p><div class="stats"><div class="stat">Eigenaar<b>Jouw koninkrijk</b></div><div class="stat">Coördinaten<b>0 | 0</b></div><div class="stat">Bevolking<b>Nog niet ingevoerd</b></div><div class="stat">Diplomatie<b>Eigen dorp</b></div></div><p class="subtle">Berichten en aanvallen volgen later. Gebruik het menu om je dorp te beheren.</p>${sendButton}`);hook();
 }else modal(`<h2>${t.name}</h2><p>Terrein: ${t.name.toLowerCase()}</p><div class="stats"><div class="stat">Coördinaten<b>${q} | ${r}</b></div><div class="stat">Status<b>Ontdekt</b></div></div><p class="subtle">Dieren, ruïnes en extra terreineffecten volgen later.</p>${sendButton}`);hook();
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
  if(screen!=='map'||!mainEl.querySelector('#kingdomWorld')){
    mainEl.innerHTML=screen==='fields'?renderFields():screen==='village'?renderVillage():renderMap();
    if(screen==='map')setupWorld();
  }
  renderQueue();
  refreshLiveTimers();
  if(screen==='map'){
    const status=$('#scoutStatus'),sc=state.army.scout;
    if(status)status.textContent=sc.travel?`🧭 Verkenner onderweg naar ${sc.travel.q} | ${sc.travel.r}. Nog ${Math.max(0,Math.ceil((sc.travel.end-now())/60_000))} minuten.`:`🧭 ${state.army.scouts} verkenner(s) beschikbaar. Tik op een aangrenzende zeshoek om te reizen (6:40 per veld).`;
    const counter=$('#worldCounter');if(counter)counter.textContent=`${state.world.discovered.length} ontdekt`;
    if(mapRedraw)mapRedraw();
  }
  document.querySelectorAll('.bottom button').forEach(b=>b.classList.toggle('active',b.dataset.screen===screen));
  document.querySelectorAll('[data-field]').forEach(b=>b.addEventListener('click',()=>showField(+b.dataset.field)));
  document.querySelectorAll('[data-open-village]').forEach(b=>b.addEventListener('click',()=>{screen='village';render()}));
  document.querySelectorAll('[data-building]').forEach(b=>b.addEventListener('click',()=>showBuilding(b.dataset.building)));
  document.querySelectorAll('[data-plot]').forEach(b=>b.addEventListener('click',()=>showPlot(+b.dataset.plot)));
}
function modal(html){$('#modal').innerHTML=`<button class="close" aria-label="Sluiten" id="closeModal">✕</button>`+html;$('#modalBackdrop').classList.remove('hidden');$('#closeModal').onclick=closeModal}
function closeModal(){$('#modalBackdrop').classList.add('hidden')}
// Project Kingdom v0.10.1: estimate affordability using current production.
function affordability(cost){
  const missing=RES.map((r,i)=>({r,needed:cost[i],have:state.stock[r],rate:perHour(r),cap:availableCap(r)}));
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
  const missing=RES.map((r,i)=>({r,needed:cost[i],have:state.stock[r],rate:perHour(r),cap:availableCap(r)}));
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
function costHtml(cost){return `<div class="cost-grid">${cost.map((c,i)=>`<div class="cost ${state.stock[RES[i]]<c?'insufficient':''}">${ICON[RES[i]]}<br><b>${fmt(c)}</b></div>`).join('')}</div>`}
function showField(id){
  update();
  let f=state.fields[id],t=TYPES[f.type],next=f.level+1,cost=price(f.type,f.level),busy=!!state.queue;
  modal(`<h2>${t.icon} ${t.name}</h2><p>Veld ${id+1} · niveau ${f.level}</p><div class="stats"><div class="stat">Huidige productie<b>+${fmt(YIELD[f.level]||405*Math.pow(1.5,f.level-10))}/u</b></div><div class="stat">Na verbetering<b>+${fmt(YIELD[next]||405*Math.pow(1.5,next-10))}/u</b></div></div><p><b>Upgrade naar niveau ${next}</b></p>${costHtml(cost)}${affordability(cost)}<p class="subtle">Bouwtijd: ${Math.ceil(duration(next)/1000)} seconden · kosten groeien per niveau ×1,3.</p><button class="action" id="doBuild" ${busy||!enough(cost)?'disabled':''}>${busy?'Er loopt al een bouwopdracht':!enough(cost)?'Niet genoeg grondstoffen':'Verbeter veld'}</button>`);
  $('#doBuild').onclick=()=>startBuild('field',id,cost,next);
}

// v0.12.2: render read-only timer values without recreating open modals every second.
function clockTime(ms){let sec=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(sec/3600)>0?String(Math.floor(sec/3600))+':':''}${String(Math.floor(sec%3600/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}`}
function troopAtHome(){let sc=state.army.scout;return Math.max(0,state.army.scouts-((sc.travel||sc.q!==0||sc.r!==0)?1:0))}
function scoutingHtml(){
 const a=state.army,sc=a.scout,t=a.training[0],ts=a.trainingStarted||{};
 let first=t?`<div class="pk-timer-row"><b>Volgende verkenner klaar over</b><strong data-timer-end="${t}">${clockTime(t-now())}</strong></div><div class="meter pk-training-meter"><div data-training-progress="${t}" data-training-start="${ts[String(t)]||t-1400000}" style="width:0%"></div></div>`:'<p class="subtle">Geen verkenners in training.</p>';
 let expedition=sc.travel?`<div class="pk-movement"><b>🧭 Ontdekking · heenreis</b><p>Troepen: 1 verkenner<br>Van: ${sc.q} | ${sc.r}<br>Bestemming: <b>${sc.travel.q} | ${sc.travel.r}</b></p><div class="pk-timer-row"><span>Resterende reistijd</span><strong data-timer-end="${sc.travel.end}">${clockTime(sc.travel.end-now())}</strong></div></div>`:
 (sc.q!==0||sc.r!==0?`<div class="pk-movement"><b>🧭 Op verkenning</b><p>1 verkenner bevindt zich op <b>${sc.q} | ${sc.r}</b> en wacht op een nieuwe opdracht.</p></div>`:'<p class="subtle">Er zijn geen troepen onderweg.</p>');
 return `<section class="pk-army"><hr><h3>🚩 Troepenoverzicht</h3><div class="pk-army-stats"><div><b>${troopAtHome()}</b><small>In dorp</small></div><div><b>${sc.travel?1:0}</b><small>Onderweg</small></div><div><b>${a.training.length}</b><small>In training</small></div></div><p>🧭 Verkenners in het dorp: <b>${troopAtHome()}</b><br>🌾 Graanverbruik verkenners: <b>${a.scouts} per uur</b>${a.losses.length?`<br>⚠️ Gestorven door graantekort: <b>${a.losses.filter(x=>x.reason==='starvation').length}</b>`:''}</p><h3>Troepenbewegingen</h3>${expedition}<h3>Training</h3><p>In training: <b>${a.training.length}</b></p>${first}</section>`;
}
function refreshLiveTimers(){
 const m=document.getElementById('modal');if(!m||document.getElementById('modalBackdrop').classList.contains('hidden'))return;
 m.querySelectorAll('[data-timer-end]').forEach(el=>el.textContent=clockTime(Number(el.dataset.timerEnd)-now()));
 m.querySelectorAll('[data-training-progress]').forEach(el=>{const end=Number(el.dataset.trainingProgress),start=Number(el.dataset.trainingStart);el.style.width=`${Math.max(0,Math.min(100,100*(now()-start)/Math.max(1,end-start)))}%`});
 // On completion refresh the modal once to update unit counts without losing an active interaction.
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
    id==='main'?'Het hoofdgebouw vormt het hart van het dorp. Bouwtijdkortingen voegen we later toe.':
    id==='wall'?'De stadsmuur omringt het dorp. Verdediging voegen we later toe, maar je kunt hem nu al bouwen en verbeteren.':
    id==='barracks'?'Train hier verkenners om de wereld te ontdekken.':
    id==='market'?'De marktplaats wordt later de plek voor handel en transport. Voor nu kun je hem bouwen en verbeteren.':
    id==='smithy'?'De smederij wordt later de plek om wapens en uitrusting te verbeteren. Voor nu kun je hem bouwen en verbeteren.':
    id==='academy'?'De academie wordt later de plek om nieuwe troepensoorten te onderzoeken. Je kunt haar nu bouwen en verbeteren.':
    id==='stables'?'Hier trainen we later onze cavalerie. Nu kun je de stallen bouwen en verbeteren.':
    id==='residence'?'De residentie wordt later belangrijk bij het stichten en beheren van nieuwe dorpen.':
    id==='workshop'?'Hier bouwen we later belegeringswerktuigen zoals stormrammen en katapulten.':
    'De verzamelplaats is de vaste plek voor troepenbewegingen. Gevechten en troepen volgen later.';
  modal(`<h2>${BLD[id].icon} ${BLD[id].name}</h2><p>Huidig niveau: ${level}</p><p>${info}</p><p><b>${level?'Upgrade':'Bouwen'} naar niveau ${next}</b></p>${costHtml(cost)}${affordability(cost)}<p class="subtle">Bouwtijd: ${Math.ceil(duration(next)/1000)} seconden</p><button class="action" id="doBuild" ${state.queue||!enough(cost)?'disabled':''}>${state.queue?'Er loopt al een bouwopdracht':!enough(cost)?'Niet genoeg grondstoffen':level?'Gebouw verbeteren':'Gebouw plaatsen'}</button>`);
  $('#doBuild').onclick=()=>startBuild('building',id,cost,next);
  if(id==='rally'){$('#modal').insertAdjacentHTML('beforeend',scoutingHtml());}
  if(id==='barracks'&&(state.buildings.barracks||0)>=1){
    const sc=state.army.scout,wait=state.army.training.length;
    const card=document.createElement('div');card.className='scout-training';
    const t=state.army.training[0],ts=state.army.trainingStarted||{};
    card.innerHTML=`<div data-army-training-count="${wait}" data-army-building="barracks"><hr><h3>🧭 Verkenner</h3><p>Beschikbaar: <b>${state.army.scouts}</b> · In training: <b>${wait}</b></p><p>⚔️ Aanval 0 · 🛡️ Verdediging 10 / 5 · 🚶 9 velden/u · 📦 25 · 🌾 1 graan/u</p><p><b>Basistraining:</b> 10:00 per verkenner</p>${t?`<div class="pk-timer-row"><span>Volgende gereed over</span><strong data-timer-end="${t}">${clockTime(t-now())}</strong></div><div class="meter pk-training-meter"><div data-training-progress="${t}" data-training-start="${ts[String(t)]||t-600000}"></div></div>`:''}<div class="pk-batch"><label for="scoutAmount">Aantal verkenners</label><div class="pk-batch-row"><input type="number" inputmode="numeric" min="1" max="500" step="1" id="scoutAmount" value="1"><button type="button" class="small-btn" id="scoutMax">Maximum (${maxScoutOrder()})</button></div><p class="subtle" id="scoutTotalTime"></p><p><b>Totale kosten</b></p><div id="scoutCostPreview"></div><button type="button" class="action" id="trainScout">Train verkenners</button></div></div>`;
    $('#modal').appendChild(card);
    const quantity=$('#scoutAmount'),train=$('#trainScout'),preview=$('#scoutCostPreview'),timing=$('#scoutTotalTime');
    function selection(){
      const n=Number(quantity.value),valid=Number.isSafeInteger(n)&&n>=1&&n<=500;
      const costs=SCOUT_COST.map(c=>c*(valid?n:0));
      preview.innerHTML=costHtml(costs);
      const end=Math.max(now(),state.army.training.length?state.army.training[state.army.training.length-1]:0)+Math.max(0,valid?n:0)*SCOUT_TRAIN_MS;
      timing.textContent=valid?`${n} × 10 minuten · laatste gereed over ${clockTime(end-now())}`:'Vul een geldig aantal van 1 tot 500 in.';
      train.disabled=!valid||!enough(costs);train.textContent=valid?`Train ${n} verkenner${n===1?'':'s'}`:'Train verkenners';
      return valid?n:0;
    }
    quantity.addEventListener('input',selection);
    $('#scoutMax').onclick=()=>{quantity.value=maxScoutOrder();selection()};
    train.onclick=()=>{
      update();const n=selection(),costs=SCOUT_COST.map(c=>c*n);
      if(!n||!enough(costs))return;
      RES.forEach((r,i)=>state.stock[r]-=costs[i]);
      const times=state.army.training;let nextStart=Math.max(now(),times.length?times[times.length-1]:0);
      for(let i=0;i<n;i++){const finish=nextStart+SCOUT_TRAIN_MS;times.push(finish);state.army.trainingStarted[String(finish)]=nextStart;nextStart=finish;}
      save();showBuilding('barracks');renderResources();
    };
    selection();
  }
}
$('#helpBtn').onclick=()=>modal(`<h2>📜 Welkom in Project Kingdom!</h2><p>Dit is ons eerste speelbare prototype. Je begint met 200 van elke grondstof, produceert 25 per uur en hebt standaard maximaal 600 opslagruimte per grondstof.</p><p>Open <b>Velden</b>, tik op een stuk land en koop een upgrade. Na de bouwtijd stijgt de productie. Ook als je deze pagina sluit, verstrijkt de tijd gewoon.</p><p>Bij <b>Dorp</b> kun je gebouwen bouwen, plaatsen of verbeteren. Pakhuis en graanschuur verhogen je opslag vanaf niveau 1 naar 800. De marktplaats ontgrendel je met hoofdgebouw niveau 3. De kazerne ontgrendel je met hoofdgebouw niveau 3 en verzamelplaats niveau 1. De smederij en academie ontgrendel je met hoofdgebouw niveau 5 en kazerne niveau 3. Hoofdgebouw, verzamelplaats en muur hebben een vaste plek.</p><p class="subtle">Tip: op een iPhone kun je via Safari → Deel → Zet op beginscherm een snelkoppeling toevoegen zodra de game online staat.</p><button class="small-btn" id="resetBtn">Begin opnieuw (verwijder spelstand)</button>`);
document.addEventListener('click',e=>{if(e.target.id==='resetBtn'&&confirm('Weet je zeker dat je opnieuw wilt beginnen?')){state=initial();save();closeModal();render()}});
$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{screen=b.dataset.screen;resourceOpen=null;render()});
render();
setInterval(render,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
