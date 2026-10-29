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

const availableCap=r=>storageCap(state.buildings[r==='crop'?'granary':'warehouse']||0);
function perHour(r){return 25+state.fields.filter(f=>f.type===r).reduce((n,f)=>n+(YIELD[f.level]||Math.round(405*Math.pow(1.5,f.level-10))),0)}
function update(){
  let t=now();
  let until=state.queue?Math.min(t,state.queue.end):t;
  let dt=Math.max(0,until-state.last)/3600000;
  for(const r of RES) state.stock[r]=Math.min(availableCap(r),state.stock[r]+perHour(r)*dt);
  if(state.queue&&t>=state.queue.end){
    const q=state.queue;
    if(q.kind==='field')state.fields[q.id].level++;
    if(q.kind==='building')state.buildings[q.id]=(state.buildings[q.id]||0)+1;
    state.queue=null;
    let after=Math.max(0,t-until)/3600000;
    for(const r of RES)state.stock[r]=Math.min(availableCap(r),state.stock[r]+perHour(r)*after)
  }
  state.last=t;
  save();
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
  if(resourceOpen)p.innerHTML=`${ICON[resourceOpen]} <b>${TYPES[resourceOpen].resource}</b> · +${fmt(perHour(resourceOpen))} per uur · opslag ${fmt(state.stock[resourceOpen])} / ${fmt(availableCap(resourceOpen))}`;
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
    :type==='stables'?'assets/stables-v011.png'
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
    return `<button class="village-plot ${[1,2,9].includes(p.n)?'village-rear':'village-front'} ${art?'village-occupied':''}" style="left:${p.x}%;top:${p.y}%" data-plot="${p.n}" aria-label="Bouwplaats ${p.n}${type?', '+BLD[type].name:''}">${art?`<img src="${art}" alt="" class="building-asset"><span class="level-badge">${state.buildings[type]||'🔨'}</span>`:`<span class="plot-number">${p.n}</span>`}</button>`;
  }).join('');
  return `<div class="scene-head"><div><h1>De dorpskern</h1></div><span class="pill">🏡 Dorp 1</span></div>
  <section class="village-layout" aria-label="Illustratie van een dorp met negen bouwplaatsen">
    <img class="village-art" src="assets/village-layout-v011.png" alt="Dorpskern met hoofdgebouw, negen bouwplaatsen, een rivier en brug" draggable="false">
    ${wallBuilt?`<img class="village-wall-v011" src="assets/wall-v060.png" alt="" draggable="false">`:''}
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
function renderMap(){
  const symbols=['?','?','?','?','?','?','🌲','⛰️','🌾','?','?','🌿','🏰','🌳','?','?','🪨','🌲','🌿','?','?','?','?','?','?'];
  return `<div class="scene-head"><div><h1>De wereld</h1><p>De eerste negen vakken zijn bekend</p></div><span class="pill">3 × 3 ontdekt</span></div><section class="world">${symbols.map((s,i)=>`<div class="worldcell ${s==='?'?'fog':''}">${s}</div>`).join('')}</section><p class="note">🧭 De wereldkaart is alvast zichtbaar. Verkenners, NPC-koninkrijken en verdere ontdekking bouwen we in een volgende versie.</p>`;
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
  $('#main').innerHTML=screen==='fields'?renderFields():screen==='village'?renderVillage():renderMap();
  renderQueue();
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
    id==='barracks'?'De kazerne is de toekomstige plek om soldaten te trainen. Troepentraining voegen we later toe.':
    id==='market'?'De marktplaats wordt later de plek voor handel en transport. Voor nu kun je hem bouwen en verbeteren.':
    id==='smithy'?'De smederij wordt later de plek om wapens en uitrusting te verbeteren. Voor nu kun je hem bouwen en verbeteren.':
    id==='academy'?'De academie wordt later de plek om nieuwe troepensoorten te onderzoeken. Je kunt haar nu bouwen en verbeteren.':
    id==='stables'?'Hier trainen we later onze cavalerie. Nu kun je de stallen bouwen en verbeteren.':
    id==='residence'?'De residentie wordt later belangrijk bij het stichten en beheren van nieuwe dorpen.':
    id==='workshop'?'Hier bouwen we later belegeringswerktuigen zoals stormrammen en katapulten.':
    'De verzamelplaats is de vaste plek voor troepenbewegingen. Gevechten en troepen volgen later.';
  modal(`<h2>${BLD[id].icon} ${BLD[id].name}</h2><p>Huidig niveau: ${level}</p><p>${info}</p><p><b>${level?'Upgrade':'Bouwen'} naar niveau ${next}</b></p>${costHtml(cost)}${affordability(cost)}<p class="subtle">Bouwtijd: ${Math.ceil(duration(next)/1000)} seconden</p><button class="action" id="doBuild" ${state.queue||!enough(cost)?'disabled':''}>${state.queue?'Er loopt al een bouwopdracht':!enough(cost)?'Niet genoeg grondstoffen':level?'Gebouw verbeteren':'Gebouw plaatsen'}</button>`);
  $('#doBuild').onclick=()=>startBuild('building',id,cost,next);
}
$('#helpBtn').onclick=()=>modal(`<h2>📜 Welkom in Project Kingdom!</h2><p>Dit is ons eerste speelbare prototype. Je begint met 200 van elke grondstof, produceert 25 per uur en hebt standaard maximaal 600 opslagruimte per grondstof.</p><p>Open <b>Velden</b>, tik op een stuk land en koop een upgrade. Na de bouwtijd stijgt de productie. Ook als je deze pagina sluit, verstrijkt de tijd gewoon.</p><p>Bij <b>Dorp</b> kun je gebouwen bouwen, plaatsen of verbeteren. Pakhuis en graanschuur verhogen je opslag vanaf niveau 1 naar 800. De marktplaats ontgrendel je met hoofdgebouw niveau 3. De kazerne ontgrendel je met hoofdgebouw niveau 3 en verzamelplaats niveau 1. De smederij en academie ontgrendel je met hoofdgebouw niveau 5 en kazerne niveau 3. Hoofdgebouw, verzamelplaats en muur hebben een vaste plek.</p><p class="subtle">Tip: op een iPhone kun je via Safari → Deel → Zet op beginscherm een snelkoppeling toevoegen zodra de game online staat.</p><button class="small-btn" id="resetBtn">Begin opnieuw (verwijder spelstand)</button>`);
document.addEventListener('click',e=>{if(e.target.id==='resetBtn'&&confirm('Weet je zeker dat je opnieuw wilt beginnen?')){state=initial();save();closeModal();render()}});
$('#modalBackdrop').addEventListener('click',e=>{if(e.target.id==='modalBackdrop')closeModal()});
document.querySelectorAll('.bottom button').forEach(b=>b.onclick=()=>{screen=b.dataset.screen;resourceOpen=null;render()});
render();
setInterval(render,1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
