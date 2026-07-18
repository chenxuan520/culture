"use strict";

// ===== 核心数据与六边形世界 =====
const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d');
const mini = $('mini'), mctx = mini.getContext('2d');
const mapArea = $('mapArea');
const SQRT3 = Math.sqrt(3), HEX = 38, MAP_W = 20, MAP_H = 15, FIXED_STEP = 0.05;
const DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
const RESOURCE_KEYS = ['food','production','science','gold','energy'];
const RESOURCE_META = {
  food:{name:'食物',icon:'🌾'}, production:{name:'生产',icon:'⚙️'}, science:{name:'科研',icon:'🔬'},
  gold:{name:'金币',icon:'🪙'}, energy:{name:'能量',icon:'⚡'}
};
const TERRAIN = {
  grass:{name:'草原',icon:'🌱',fill:'#254c3a',edge:'#3d7357',move:1},
  plains:{name:'平原',icon:'🌾',fill:'#5b5735',edge:'#7c7750',move:1},
  forest:{name:'森林',icon:'🌲',fill:'#173f36',edge:'#2d6655',move:1.35},
  hills:{name:'丘陵',icon:'⛰️',fill:'#544e46',edge:'#756d61',move:1.45},
  desert:{name:'沙漠',icon:'🏜️',fill:'#725b35',edge:'#9a7a49',move:1.15},
  water:{name:'水域',icon:'🌊',fill:'#163d5b',edge:'#286b91',move:99},
  mountain:{name:'山脉',icon:'🏔️',fill:'#3e4650',edge:'#67727e',move:99}
};
const RESOURCE_DEFS = {
  wheat:{name:'小麦',icon:'🌾',yield:{food:3}}, iron:{name:'铁矿',icon:'⛏️',yield:{production:3}},
  crystal:{name:'星晶',icon:'💎',yield:{science:2,energy:2}}, oil:{name:'石油',icon:'🛢️',yield:{production:2,energy:2}},
  timber:{name:'古木',icon:'🪵',yield:{production:2,gold:1}}, fish:{name:'鱼群',icon:'🐟',yield:{food:3,gold:1}}
};
const IMPROVEMENTS = {
  farm:{name:'智能农场',icon:'🚜',duration:1.15,hp:115,yield:{food:3,gold:1},desc:'稳定提供食物，邻近城市时额外繁荣。'},
  mine:{name:'磁轨矿山',icon:'⛏️',duration:1.35,hp:140,yield:{production:3,gold:1},desc:'适合丘陵、铁矿和星晶地块。'},
  lumber:{name:'永续伐木场',icon:'🪵',duration:1.2,hp:125,yield:{production:3,food:1},desc:'森林不会被移除，持续循环采伐。'},
  solar:{name:'日冕电站',icon:'☀️',duration:1.4,hp:105,yield:{energy:4,gold:1},desc:'沙漠地块上的高效能源设施。'},
  lab:{name:'星晶实验站',icon:'🧪',duration:1.55,hp:110,yield:{science:4,energy:1},desc:'对星晶进行科研转化。'},
  extractor:{name:'深层萃取井',icon:'🏭',duration:1.45,hp:130,yield:{production:2,energy:3},desc:'开采石油并转化为生产与能量。'},
  harbor:{name:'潮汐渔港',icon:'⚓',duration:1.35,hp:120,yield:{food:3,gold:2},desc:'预留水域设施；当前版本陆地工人不能建设。'}
};
const ERAS = [
  {name:'远古时代',icon:'🏺'}, {name:'古典时代',icon:'🏛️'}, {name:'工业时代',icon:'🏭'},
  {name:'现代时代',icon:'📡'}, {name:'原子时代',icon:'⚛️'}, {name:'未来时代',icon:'🌌'}
];
const TECHS = [
  {id:'agriculture',name:'灌溉网络',icon:'🌱',era:0,time:8,cost:34,pre:[],desc:'解锁智能农场，城市食物脉冲 +1。',unlock:['farm']},
  {id:'mining',name:'深层采矿',icon:'⛏️',era:0,time:9,cost:38,pre:[],desc:'解锁磁轨矿山与永续伐木场。',unlock:['mine','lumber']},
  {id:'engineering',name:'模块化工程',icon:'🏗️',era:1,time:13,cost:62,pre:['agriculture','mining'],desc:'解锁锻造工坊、维修无人机和开拓者。',unlock:['forge','repairDrone','settler']},
  {id:'tactics',name:'联合作战学',icon:'🎯',era:1,time:14,cost:64,pre:['mining'],desc:'解锁弓手、骑士与兵种配合加成。',unlock:['archer','knight']},
  {id:'combustion',name:'内燃机与装甲',icon:'🛞',era:2,time:18,cost:92,pre:['engineering'],desc:'解锁主战坦克与深层萃取井。',unlock:['tank','extractor']},
  {id:'electricity',name:'城市电网',icon:'⚡',era:2,time:18,cost:90,pre:['engineering'],desc:'解锁学院、日冕电站与护盾穹顶。',unlock:['academy','solar','shieldDome']},
  {id:'aeronautics',name:'反重力航空',icon:'🎈',era:3,time:24,cost:126,pre:['combustion','electricity'],desc:'解锁空港与基洛夫飞艇。',unlock:['skyDock','kirov']},
  {id:'prismatics',name:'光棱共振',icon:'🔷',era:3,time:24,cost:128,pre:['electricity','tactics'],desc:'解锁光棱坦克与光棱矩阵。',unlock:['prism','prismMatrix']},
  {id:'automation',name:'自治工团',icon:'🤖',era:4,time:30,cost:168,pre:['aeronautics'],desc:'工人 AI 建造更快，维修半径提升。',unlock:['automation']},
  {id:'quantum',name:'量子纠缠武器',icon:'🌀',era:4,time:32,cost:176,pre:['prismatics'],desc:'解锁量子行者与量子中继站。',unlock:['quantumWalker','quantumRelay']},
  {id:'singularity',name:'可控奇点',icon:'🌌',era:5,time:38,cost:240,pre:['automation','quantum'],desc:'全军获得 20% 火力，城市每脉冲生成额外能量。',unlock:['singularity']}
];
const UNIT_DEFS = {
  worker:{name:'工人',icon:'👷',role:'支援',hp:105,attack:2,range:1,interval:1.35,move:1.15,cost:{food:10,production:18,gold:8},time:2.0,tech:null,combat:false,desc:'拥有 5 次建设次数，可开启 AI 因地制宜建造并维修附近友军。'},
  settler:{name:'开拓者',icon:'🧭',role:'拓殖',hp:120,attack:4,range:1,interval:1.4,move:1.0,cost:{food:28,production:32,gold:14},time:2.8,tech:'engineering',combat:false,desc:'在远离现有城市的陆地建立新城。'},
  scout:{name:'侦察兵',icon:'🦅',role:'侦察',hp:115,attack:15,range:1,interval:.8,move:1.65,cost:{food:10,production:16,gold:8},time:1.6,tech:null,combat:true,desc:'高速探索星火遗迹，穿越森林与丘陵更轻松。'},
  warrior:{name:'近卫军',icon:'🛡️',role:'近战',hp:190,attack:28,range:1,interval:.72,move:1.08,cost:{food:16,production:24,gold:8},time:2.1,tech:null,combat:true,armor:5,desc:'可靠的前线部队，近战反击能力较强。'},
  archer:{name:'长弓手',icon:'🏹',role:'远程',hp:125,attack:25,range:3,interval:.78,move:1.05,cost:{food:14,production:26,gold:12},time:2.2,tech:'tactics',combat:true,desc:'三格射程，适合在兵种配合后方持续输出。'},
  knight:{name:'星辉骑士',icon:'🐎',role:'机动',hp:210,attack:36,range:1,interval:.67,move:1.48,cost:{food:22,production:34,gold:18},time:2.6,tech:'tactics',combat:true,armor:7,desc:'快速冲锋单位，追击锁定目标时伤害更高。'},
  tank:{name:'主战坦克',icon:'🛡️',role:'装甲',hp:300,attack:49,range:2,interval:.72,move:1.2,cost:{production:48,gold:28,energy:8},time:3.0,tech:'combustion',combat:true,armor:11,desc:'高生命装甲单位，可在两格外炮击。'},
  prism:{name:'光棱坦克',icon:'🔷',role:'光棱',hp:230,attack:46,range:4,interval:.9,move:1.08,cost:{production:55,gold:35,energy:18},time:3.5,tech:'prismatics',combat:true,armor:6,desc:'三格内与其他光棱坦克组网，两辆起攻击至少翻倍。'},
  kirov:{name:'基洛夫飞艇',icon:'🎈',role:'空军',hp:420,attack:72,range:2,interval:1.15,move:.82,cost:{production:68,gold:45,energy:24},time:4.2,tech:'aeronautics',combat:true,armor:9,flying:true,desc:'无视地形并造成一格范围爆破，移动缓慢但极具压迫感。'},
  repairDrone:{name:'维修蜂群',icon:'🛠️',role:'支援',hp:140,attack:8,range:1,interval:1.0,move:1.5,cost:{production:28,gold:18,energy:10},time:2.4,tech:'engineering',combat:false,flying:true,desc:'自动维修两格内所有受损友军、城市和设施。'},
  quantumWalker:{name:'量子行者',icon:'🌀',role:'奇点',hp:275,attack:62,range:3,interval:.68,move:1.3,cost:{production:72,gold:50,energy:34},time:4.5,tech:'quantum',combat:true,armor:8,desc:'攻击会跃迁至第二个目标，并短暂扰乱敌人。'},
  raider:{name:'灰烬劫掠者',icon:'☠️',role:'近战',hp:105,attack:13,range:1,interval:1.05,move:.92,combat:true,armor:1,enemy:true},
  enemyArcher:{name:'灰烬投矛手',icon:'🗡️',role:'远程',hp:82,attack:11,range:2,interval:1.15,move:.85,combat:true,enemy:true},
  enemyBuggy:{name:'废土战车',icon:'🏎️',role:'机动',hp:135,attack:16,range:1,interval:.95,move:1.1,combat:true,armor:2,enemy:true}
};
const BUILDING_DEFS = {
  granary:{name:'生态粮仓',icon:'🏡',time:1.8,cost:{production:25,gold:10},tech:'agriculture',desc:'城市每脉冲食物 +3，生命上限 +60。'},
  forge:{name:'纳米锻造工坊',icon:'🏭',time:2.4,cost:{production:34,gold:16},tech:'engineering',desc:'本城生产速度 +25%，每脉冲生产 +2。'},
  academy:{name:'全息学院',icon:'🎓',time:2.5,cost:{production:32,gold:18},tech:'electricity',desc:'每脉冲科研 +4，科技完成时返还能量。'},
  skyDock:{name:'云穹空港',icon:'🛫',time:3.0,cost:{production:42,gold:24,energy:8},tech:'aeronautics',desc:'基洛夫飞艇生产速度 +30%，城市视野扩大。'},
  shieldDome:{name:'相位护盾穹顶',icon:'🫧',time:3.2,cost:{production:48,gold:24,energy:16},tech:'electricity',desc:'城市获得 180 点再生护盾，优先吸收伤害。'},
  prismMatrix:{name:'光棱矩阵',icon:'💠',time:3.5,cost:{production:52,gold:30,energy:20},tech:'prismatics',desc:'全军光棱伤害 +15%，组网距离 +1。'},
  quantumRelay:{name:'量子中继站',icon:'🌀',time:4.1,cost:{production:62,gold:38,energy:28},tech:'quantum',desc:'每脉冲能量 +4，并周期性修复全城附近单位。'}
};
const PRODUCT_IDS = ['worker','settler','scout','warrior','archer','knight','tank','prism','kirov','repairDrone','quantumWalker','granary','forge','academy','skyDock','shieldDome','prismMatrix','quantumRelay'];

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function lerp(a,b,t){return a+(b-a)*t;}
function key(q,r){return q+','+r;}
function uid(prefix='id'){return prefix+'_'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-4);}
function fmt(v){return Math.floor(v).toLocaleString('zh-CN');}
function deepCost(cost){const out={}; for(const k of RESOURCE_KEYS) if(cost?.[k]) out[k]=cost[k]; return out;}
function costText(cost){return Object.entries(cost||{}).map(([k,v])=>`${RESOURCE_META[k].icon}${v}`).join(' ');}
function yieldText(y){const parts=Object.entries(y||{}).filter(([,v])=>v).map(([k,v])=>`${RESOURCE_META[k].icon}+${v}`);return parts.join(' ')||'无产出';}
function hexDistance(a,b){const ax=a.q,az=a.r,ay=-ax-az,bx=b.q,bz=b.r,by=-bx-bz;return Math.max(Math.abs(ax-bx),Math.abs(ay-by),Math.abs(az-bz));}
function axialToWorld(q,r){return {x:HEX*SQRT3*(q+r/2),y:HEX*1.5*r};}
function cubeRound(q,r){let x=q,z=r,y=-x-z;let rx=Math.round(x),ry=Math.round(y),rz=Math.round(z);const dx=Math.abs(rx-x),dy=Math.abs(ry-y),dz=Math.abs(rz-z);if(dx>dy&&dx>dz)rx=-ry-rz;else if(dy>dz)ry=-rx-rz;else rz=-rx-ry;return {q:rx,r:rz};}
function worldToAxial(x,y){return cubeRound((SQRT3/3*x-y/3)/HEX,(2/3*y)/HEX);}
function hashNoise(q,r,seed=17){let n=(q*374761393+r*668265263+seed*982451653)|0;n=(n^(n>>>13))*1274126177;n^=n>>>16;return (n>>>0)/4294967295;}
function seeded(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function terrainCost(tile,unit){if(unit?.def?.flying)return 1;if(!tile||tile.terrain==='water'||tile.terrain==='mountain')return Infinity;let c=TERRAIN[tile.terrain].move;if(unit?.type==='scout'&&(tile.terrain==='forest'||tile.terrain==='hills'))c=.9;return c;}
function isLand(tile){return tile&&tile.terrain!=='water'&&tile.terrain!=='mountain';}
function hexNeighbors(q,r){const out=[];for(const [dq,dr] of DIRS){const t=tileAt(q+dq,r+dr);if(t)out.push(t);}return out;}

const DEFAULT_MAP_CONFIG = {mode:'default',seed:24681357,width:20,height:15,water:.10,mountain:.07,forest:.17,hills:.17,desert:.13,resourceRate:1,ruinRate:.045};
let currentMapConfig = {...DEFAULT_MAP_CONFIG};
function scaledMapSize(players=2,randomJitter=0,seed=0){
  const scale=Math.sqrt(Math.max(2,players)/2),jitter=1+randomJitter;
  return{width:Math.max(18,Math.round(MAP_W*scale*jitter)),height:Math.max(13,Math.round(MAP_H*scale*jitter))};
}
function createMapConfig(mode='default',seedOverride=null,players=2){
  if(mode!=='random'){const size=scaledMapSize(players);return{...DEFAULT_MAP_CONFIG,width:size.width,height:size.height};}
  const seed=(seedOverride??((Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0))>>>0,rnd=seeded(seed);
  const size=scaledMapSize(players,(rnd()-.5)*.22,seed),width=size.width,height=size.height;
  return{mode:'random',seed,width,height,water:.07+rnd()*.09,mountain:.05+rnd()*.08,forest:.13+rnd()*.12,hills:.13+rnd()*.12,desert:.10+rnd()*.13,resourceRate:.85+rnd()*.55,ruinRate:.035+rnd()*.055};
}
function mapLayout(config=currentMapConfig){
  const w=config.width||MAP_W,h=config.height||MAP_H,midR=Math.floor(h/2),enemyQ=Math.max(8,w-4);
  return{midR,player:{q:3,r:midR},enemy:{q:enemyQ,r:midR},camera:{q:Math.min(5,w-1),r:midR},
    playerUnits:[[4,midR],[3,Math.min(h-1,midR+1)],[4,Math.max(0,midR-1)]],
    enemyUnits:[[enemyQ-1,midR],[enemyQ,Math.min(h-1,midR+1)],[enemyQ-1,Math.max(0,midR-1)],[enemyQ+1,midR],[enemyQ,Math.max(0,midR-1)]].map(([q,r])=>[clamp(q,0,w-1),clamp(r,0,h-1)])};
}
function mapSideSlots(side,count=3,layout=mapLayout()){
  const dir=side==='player'?1:-1,base=side==='player'?layout.player:layout.enemy,rows=count===1?[0]:count===2?[-2,2]:[-3,0,3];
  return rows.map((off,i)=>({q:clamp(base.q+i*dir*2,1,mapWidth()-2),r:clamp(base.r+off,1,mapHeight()-2)}));
}
function mapWidth(){return currentMapConfig.width||MAP_W;}
function mapHeight(){return currentMapConfig.height||MAP_H;}
let tiles = new Map();
function tileAt(q,r){return tiles.get(key(q,r));}
function generateMap(config=currentMapConfig){
  currentMapConfig={...config};const rnd=seeded(currentMapConfig.seed), map=new Map(),w=mapWidth(),h=mapHeight(),layout=mapLayout(currentMapConfig);
  for(let r=0;r<h;r++)for(let q=0;q<w;q++){
    const edge=Math.min(q,r,w-1-q,h-1-r), n=(rnd()+hashNoise(q,r,31+currentMapConfig.seed)+hashNoise(q,r,79+currentMapConfig.seed))/3;
    let terrain='grass';
    if(currentMapConfig.mode==='random'){
      const water=currentMapConfig.water,mountain=water+currentMapConfig.mountain,forest=mountain+currentMapConfig.forest,hills=forest+currentMapConfig.hills,desert=hills+currentMapConfig.desert;
      if(edge===0&&n<Math.min(.46,water+.24))terrain='water';
      else if(n<water)terrain='water'; else if(n<mountain)terrain='mountain'; else if(n<forest)terrain='forest';
      else if(n<hills)terrain='hills'; else if(n<desert)terrain='desert'; else terrain=rnd()<.48?'plains':'grass';
    }else{
      if(edge===0&&n<.36)terrain='water';
      else if(n<.10)terrain='water'; else if(n<.17)terrain='mountain'; else if(n<.34)terrain='forest';
      else if(n<.51)terrain='hills'; else if(n<.66)terrain='plains'; else if(n<.79)terrain='desert';
    }
    const t={q,r,terrain,resource:null,improvement:null,ruin:false,decor:rnd()};
    map.set(key(q,r),t);
  }
  // 固定起始走廊，避免随机地图把双方困住。
  const safe=[];for(let r=Math.max(1,layout.midR-3);r<=Math.min(h-2,layout.midR+3);r++)for(let q=1;q<=w-2;q++)if(Math.abs(r-layout.midR)<=2||q<layout.player.q+3||q>layout.enemy.q-3)safe.push([q,r]);
  for(const [q,r] of safe){const t=map.get(key(q,r));if(t&&(t.terrain==='water'||t.terrain==='mountain'))t.terrain=rnd()<.35?'forest':'plains';}
  const sideSafe=[...mapSideSlots('player',3,layout),...mapSideSlots('enemy',3,layout)].flatMap(s=>[[s.q,s.r],[s.q+1,s.r],[s.q-1,s.r],[s.q,s.r+1],[s.q,s.r-1]]);
  for(const p of [[layout.player.q,layout.player.r],[layout.enemy.q,layout.enemy.r],...layout.playerUnits,...layout.enemyUnits,...sideSafe]){const t=map.get(key(...p));if(t)t.terrain='plains';}
  for(const t of map.values()){
    if(t.terrain==='mountain'||t.terrain==='water')continue;
    const rv=rnd(),rate=currentMapConfig.resourceRate;
    if(t.terrain==='forest'&&rv<.34*rate)t.resource='timber';
    else if(t.terrain==='hills'&&rv<.30*rate)t.resource=rv<.15*rate?'iron':'crystal';
    else if(t.terrain==='desert'&&rv<.25*rate)t.resource=rv<.12*rate?'oil':'crystal';
    else if((t.terrain==='grass'||t.terrain==='plains')&&rv<.23*rate)t.resource='wheat';
    if(isLand(t)&&rnd()<currentMapConfig.ruinRate&&hexDistance(t,layout.player)>3&&hexDistance(t,layout.enemy)>2)t.ruin=true;
  }
  return map;
}

function techById(id){return TECHS.find(t=>t.id===id);}
function productDef(id){return UNIT_DEFS[id]||BUILDING_DEFS[id];}
function isUnitProduct(id){return !!UNIT_DEFS[id]&&!UNIT_DEFS[id].enemy;}
function createUnit(type,team,q,r,extra={}){
  const def=UNIT_DEFS[type];
  return {id:uid('u'),type,def,team,q,r,hp:def.hp,maxHp:def.hp,route:[],moveProgress:0,target:null,manualTarget:false,holdPosition:false,
    attackTimer:Math.random()*.4,combatGlow:0,beamTick:0,aiWorker:false,charges:type==='worker'?5:0,work:null,overdrive:0,
    disrupted:0,spawnFlash:1,name:(team==='player'?'': '灰烬·')+def.name,...extra};
}
function createCity(team,q,r,capital=false,name){
  const city={id:uid('c'),team,q,r,capital,name:name||(capital?(team==='player'?'曙光城':'灰烬要塞'):'新星城'),
    hp:capital?(team==='player'?760:390):430,maxHp:capital?(team==='player'?760:390):430,shield:0,maxShield:0,queue:[],buildings:[],population:capital?4:2,flash:0};
  return city;
}
function freshState(started=false){
  tiles=generateMap(createMapConfig('default'));const layout=mapLayout();
  const playerCity=createCity('player',layout.player.q,layout.player.r,true,'曙光城');
  const enemyCity=createCity('enemy',layout.enemy.q,layout.enemy.r,true,'灰烬要塞');
  const s={started,paused:false,gameOver:false,speed:1,simTime:0,pulseTimer:0,enemySpawnTimer:0,enemyThink:0,
    resources:{food:92,production:72,science:0,gold:118,energy:32},lastYield:{food:0,production:0,science:0,gold:0,energy:0},
    cities:[playerCity,enemyCity],units:[],effects:[],logs:[],completed:new Set(),research:null,aiTech:true,selection:{kind:'city',id:playerCity.id},
    hovered:null,showIntel:false,keys:new Set(),score:0,era:0,overdriveGlobal:0,uiTimer:0,uiHoldUntil:0,toastSeq:0,tutorialActive:false,tutorialRewarded:false,
    mapMode:currentMapConfig.mode,mapSeed:currentMapConfig.seed,mapSize:{width:mapWidth(),height:mapHeight()},
    camera:{x:axialToWorld(layout.camera.q,layout.camera.r).x,y:axialToWorld(layout.camera.q,layout.camera.r).y,zoom:.86},screen:{w:1,h:1,dpr:1},lastFrame:performance.now(),acc:0};
  s.units.push(createUnit('warrior','player',layout.playerUnits[0][0],layout.playerUnits[0][1]),createUnit('worker','player',layout.playerUnits[1][0],layout.playerUnits[1][1]),createUnit('scout','player',layout.playerUnits[2][0],layout.playerUnits[2][1]));
  s.units.push(createUnit('raider','enemy',layout.enemyUnits[0][0],layout.enemyUnits[0][1]),createUnit('enemyArcher','enemy',layout.enemyUnits[1][0],layout.enemyUnits[1][1]),createUnit('enemyBuggy','enemy',layout.enemyUnits[2][0],layout.enemyUnits[2][1]));
  return s;
}
let state=freshState(false);

function cityAt(q,r){return state.cities.find(c=>c.q===q&&c.r===r&&c.hp>0);}
function unitsAt(q,r){return state.units.filter(u=>u.q===q&&u.r===r&&u.hp>0);}
function unitById(id){return state.units.find(u=>u.id===id&&u.hp>0);}
function cityById(id){return state.cities.find(c=>c.id===id&&c.hp>0);}
function selectedObject(){
  const s=state.selection;if(!s)return null;
  if(s.kind==='unit')return unitById(s.id);if(s.kind==='city')return cityById(s.id);if(s.kind==='tile'||s.kind==='improvement')return tileAt(s.q,s.r);return null;
}
function enemyOf(team){return team==='player'?'enemy':'player';}
function canAfford(cost){return Object.entries(cost||{}).every(([k,v])=>(state.resources[k]||0)>=v);}
function pay(cost){if(!canAfford(cost))return false;for(const [k,v]of Object.entries(cost||{}))state.resources[k]-=v;return true;}
function refund(cost){for(const [k,v]of Object.entries(cost||{}))state.resources[k]+=v;}
function hasTech(id){return !id||state.completed.has(id);}
function availableTech(t){return !state.completed.has(t.id)&&(!state.research||state.research.id!==t.id)&&t.pre.every(hasTech);}
function buildingOwned(id){return state.cities.some(c=>c.team==='player'&&c.buildings.includes(id));}
function hasBuilding(city,id){return city.buildings.includes(id);}
function eraFromProgress(){let e=0;for(const t of TECHS)if(state.completed.has(t.id))e=Math.max(e,t.era);return e;}
function hasProductUnlock(id){const d=productDef(id);return !!d&&hasTech(d.tech);}

function addLog(text,type=''){
  state.logs.unshift({text,type,time:state.simTime});state.logs=state.logs.slice(0,5);
}
function toast(text,type=''){
  const host=$('toasts'),box=document.createElement('div');box.className='toast '+type;box.textContent=text;host.appendChild(box);
  while(host.children.length>5)host.firstElementChild.remove();
  setTimeout(()=>{box.style.opacity='0';box.style.transform='translateX(15px)';setTimeout(()=>box.remove(),220);},2300);
}
function floating(q,r,text,color='#fff',offset=0){state.effects.push({type:'float',q,r,text,color,life:1,max:1,offset});}
function burst(q,r,color='#ffd166',count=13,scale=1){
  const p=axialToWorld(q,r);for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,sp=(24+Math.random()*52)*scale;state.effects.push({type:'particle',x:p.x,y:p.y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.45+Math.random()*.55,max:1,size:2+Math.random()*3,color});}
}

