"use strict";
(() => {
  // ===== 增强版：合成音频、敌军文明 AI、难度系统与 WASD =====
  const ORIGINAL = {
    createUnit, createCity, freshState, productDef, tileYield, cityYield, resourcePulse,
    updateCities, updateMovement, healNearby, autoAcquire, targetAttack, targetArmor, damageMultiplier,
    applyDamage, performAttack, updateCombatUnit, updateUnitSystems, simStep,
    renderCitySelection, renderTileSelection, renderGlobal, renderPanels, tooltipHTML,
    drawResourcesAndImprovements, drawCities, drawTargetLocks, drawUnits, drawMinimap,
    updateCamera, startResearch, finishResearch, queueProduct, completeProduct,
    finishWorkerBuild, setUnitRoute, setLockedTarget, destroyTarget, endGame, foundCity,
    clearHalfEnemies, beginGame, resetGame, tutorialTaskDone, demoTutorialStep
  };

  const ENEMY_BUILDING_DEFS = {
    ashGranary:{name:'灰烬生化仓',icon:'🧫',time:3.2,cost:{food:16,production:24,gold:10},tech:'agriculture',desc:'提高食物与人口增长。'},
    warLab:{name:'裂变研究所',icon:'🧪',time:4.0,cost:{production:30,gold:22,energy:8},tech:'mining',desc:'提高科研速度与科研产出。'},
    warFoundry:{name:'战争铸造厂',icon:'🏭',time:4.4,cost:{production:38,gold:24},tech:'engineering',desc:'提高城市生产速度并强化机械部队。'},
    bastion:{name:'猩红棱堡',icon:'🧱',time:5.0,cost:{production:48,gold:32,energy:18},tech:'electricity',desc:'提供城市护盾、装甲和防御火力。'},
    warCore:{name:'自适应战争核心',icon:'🧠',time:6.2,cost:{production:74,gold:52,energy:34},tech:'quantum',desc:'提高全军火力，并加快困难 AI 的战术适应。'}
  };

  Object.assign(UNIT_DEFS.raider,{hp:170,attack:27,interval:.78,move:1.16,armor:4,cost:{food:15,production:24,gold:8},time:2.1,tech:null,desc:'灰烬前线突击兵，单体略脆于近卫军，但部署快、机动高，适合压制资源设施。'});
  Object.assign(UNIT_DEFS.enemyArcher,{hp:118,attack:24,range:3,interval:.82,move:1.02,cost:{food:13,production:27,gold:12},time:2.2,tech:'tactics',desc:'三格投射单位，负责在突击兵后方持续输出，并为攻城单位提供掩护。'});
  Object.assign(UNIT_DEFS.enemyBuggy,{hp:215,attack:34,interval:.72,move:1.46,armor:6,cost:{food:12,production:42,gold:20,energy:5},time:2.7,tech:'combustion',desc:'高速侧翼战车，会追击脆弱远程单位，定位接近星火骑士但更依赖机动。'});
  Object.assign(UNIT_DEFS,{
    enemyWorker:{name:'灰烬工蜂',icon:'🛠️',role:'工程',hp:105,attack:2,range:1,interval:1.35,move:1.15,cost:{food:10,production:18,gold:8},time:2.0,tech:null,combat:false,enemy:true,worker:true,desc:'拥有 5 次建设次数，可自动开发资源并维修附近友军、城市和设施。'},
    enemySettler:{name:'灰烬播种舰',icon:'🚚',role:'拓殖',hp:125,attack:4,range:1,interval:1.4,move:1.0,cost:{food:28,production:32,gold:14},time:2.8,tech:'engineering',combat:false,enemy:true,settler:true,desc:'在远离现有城市的陆地建立新的灰烬城市。'},
    enemySiege:{name:'灰烬攻城兽',icon:'🦂',role:'攻城',hp:275,attack:50,range:3,interval:1.0,move:.82,cost:{production:62,gold:36,energy:12},time:3.8,tech:'engineering',combat:true,armor:8,enemy:true,siege:true,desc:'远程轰击城市与建筑，射程较远且装甲厚重。'},
    enemyDrone:{name:'灰烬猎杀号',icon:'🛸',role:'空袭',hp:220,attack:42,range:2,interval:.74,move:1.52,cost:{production:58,gold:34,energy:20},time:3.9,tech:'aeronautics',combat:true,armor:4,enemy:true,flying:true,desc:'无视地形的高速空袭单位，会猎杀后排与工人。'},
    enemyTitan:{name:'熔核泰坦',icon:'🤖',role:'重装',hp:440,attack:62,range:2,interval:.9,move:.76,cost:{production:82,gold:48,energy:32},time:4.9,tech:'singularity',combat:true,armor:10,enemy:true,boss:true,desc:'灰烬终局重装单位，拥有高生命、装甲和稳定火力。'}
  });

  const AI_DIFFICULTIES = {
    easy:{key:'easy',label:'简单',icon:'🌱',desc:'敌军决策较慢，波次稀疏且不会主动扩张。适合第一次游玩。',economy:.90,researchSpeed:.90,techCost:1.08,productionSpeed:.90,unitHp:.95,cityHp:.95,damage:.90,attackInterval:1.12,armor:0,cityArmor:0,cityAttack:9,maxUnits:12,maxCities:1,initialWave:18,waveInterval:24,waveSize:2,waveGrowth:.25,defenseScan:4,eliteChance:0,workerCharges:3,improvementsPerCity:2,expandAt:999,capitalShield:0,shieldRegen:0,repairRate:2.2,startTechs:[],adaptEvery:999,maxAdapt:0,starting:{food:92,production:72,science:0,gold:118,energy:32},initialUnits:['raider']},
    medium:{key:'medium',label:'中等',icon:'⚔️',desc:'敌军拥有独立经济、科研、工人和生产队列，会用更快决策组织扩张与混编波次。',economy:1,researchSpeed:1,techCost:1,productionSpeed:1,unitHp:1,cityHp:1,damage:1,attackInterval:1,armor:0,cityArmor:1,cityAttack:12,maxUnits:20,maxCities:2,initialWave:16,waveInterval:18,waveSize:4,waveGrowth:.55,defenseScan:5,eliteChance:0,workerCharges:4,improvementsPerCity:3,expandAt:30,capitalShield:0,shieldRegen:.8,repairRate:3.3,startTechs:[],adaptEvery:70,maxAdapt:2,starting:{food:92,production:72,science:0,gold:118,energy:32},initialUnits:['raider','enemyArcher']},
    hard:{key:'hard',label:'困难',icon:'☠️',desc:'敌军不靠开局资源领先，而是更快决策、扩张更积极、波次更紧凑并更会反制。',economy:1,researchSpeed:1,techCost:1,productionSpeed:1,unitHp:1,cityHp:1,damage:1,attackInterval:1,armor:0,cityArmor:1,cityAttack:13,maxUnits:30,maxCities:3,initialWave:12,waveInterval:13,waveSize:5,waveGrowth:.75,defenseScan:7,eliteChance:0,workerCharges:4,improvementsPerCity:4,expandAt:18,capitalShield:0,shieldRegen:1.4,repairRate:4.6,startTechs:[],adaptEvery:38,maxAdapt:5,starting:{food:92,production:72,science:0,gold:118,energy:32},initialUnits:['raider','enemyArcher']}
  };
  const ENEMY_TECH_PRIORITY=['mining','agriculture','tactics','engineering','combustion','electricity','aeronautics','prismatics','automation','quantum','singularity'];
  const ENEMY_CITY_NAMES=['赤沙前哨','熔铁巢都','终焉工厂','裂变堡垒'];
  const SPARK_ENEMY_CITY_NAMES=['星辉前哨','晨星中继','光棱工坊','天穹堡垒'];
  let selectedDifficulty='medium',selectedMapMode='default',selectedLeftAI=0,selectedRightAI=1,selectedPlayerSide='left',selectedPlayerFaction='spark',selectedWorkerDefaultAI=false,selectedSettlerAutoFound=false;
  try{
    const saved=localStorage.getItem('starfireDifficulty');if(AI_DIFFICULTIES[saved])selectedDifficulty=saved;
    const mapMode=localStorage.getItem('starfireMapMode');if(mapMode==='default'||mapMode==='random')selectedMapMode=mapMode;
    selectedLeftAI=clamp(Number(localStorage.getItem('starfireLeftAI')||0),0,2);
    selectedRightAI=clamp(Number(localStorage.getItem('starfireRightAI')||1),1,3);
    const side=localStorage.getItem('starfirePlayerSide');if(side==='left'||side==='right')selectedPlayerSide=side;
    const faction=localStorage.getItem('starfirePlayerFaction'),oldEnemyFaction=localStorage.getItem('starfireEnemyFaction');if(faction==='spark'||faction==='ash')selectedPlayerFaction=faction;else if(faction==='rbp'||oldEnemyFaction==='bgy')selectedPlayerFaction='ash';else selectedPlayerFaction='spark';
    selectedWorkerDefaultAI=localStorage.getItem('starfireWorkerDefaultAI')==='1';
    selectedSettlerAutoFound=localStorage.getItem('starfireSettlerAutoFound')==='1';
  }catch{}

  function difficultyConfig(key=state?.difficulty||selectedDifficulty){return AI_DIFFICULTIES[key]||AI_DIFFICULTIES.medium;}
  const FACTION_COLORS={
    blue:{name:'蓝色阵线',badge:'蓝色友军',glow:'#4db7ff',stroke:'#69c6ff',fill:'rgba(10,48,78,.96)',ring:'rgba(125,205,255,.56)',health:'#69c6ff',mini:'#4db7ff',unitMini:'#bde7ff',text:'#edf8ff',soft:'#cdeeff'},
    green:{name:'绿色阵线',badge:'绿色友军',glow:'#53e38f',stroke:'#63ee9d',fill:'rgba(13,66,45,.96)',ring:'rgba(130,255,184,.54)',health:'#63ee9d',mini:'#53e38f',unitMini:'#c7f8d9',text:'#eafff4',soft:'#c7f8d9'},
    yellow:{name:'黄色阵线',badge:'黄色友军',glow:'#ffd22e',stroke:'#ffd84a',fill:'rgba(78,66,13,.96)',ring:'rgba(255,224,92,.54)',health:'#ffd84a',mini:'#ffd22e',unitMini:'#fff0a5',text:'#fff8d6',soft:'#fff0a5'},
    red:{name:'红色军团',badge:'红色敌军',glow:'#ff445f',stroke:'#ff5c72',fill:'rgba(80,18,31,.96)',ring:'rgba(255,110,126,.54)',health:'#ff5c72',mini:'#ff445f',unitMini:'#ff9aa7',text:'#ffd7dc',soft:'#ffd7dc'},
    black:{name:'黑色军团',badge:'黑色敌军',glow:'#111827',stroke:'#0f172a',fill:'rgba(3,7,12,.98)',ring:'rgba(75,85,99,.55)',health:'#111827',mini:'#020617',unitMini:'#111827',text:'#f8fafc',soft:'#94a3b8'},
    purple:{name:'紫色军团',badge:'紫色敌军',glow:'#a66cff',stroke:'#b985ff',fill:'rgba(48,28,86,.96)',ring:'rgba(191,145,255,.52)',health:'#b985ff',mini:'#a66cff',unitMini:'#dec7ff',text:'#efe3ff',soft:'#efe3ff'}
  };
  const TEAM_FACTIONS={spark:['blue','green','yellow'],ash:['red','black','purple']};
  const SPARK_PRODUCTS=[...PRODUCT_IDS],ASH_PRODUCTS=['enemyWorker','enemySettler','raider','enemyArcher','enemyBuggy','enemySiege','enemyDrone','enemyTitan','repairDrone','granary','forge','academy','shieldDome','quantumRelay'];
  const ASH_COMBAT_TYPES=['raider','enemyArcher','enemyBuggy','enemySiege','enemyDrone','enemyTitan'],SPARK_COMBAT_TYPES=['warrior','archer','knight','tank','prism','kirov','quantumWalker'];
  function teamFactions(team){return TEAM_FACTIONS[team]||TEAM_FACTIONS.spark;}
  function opposingTeam(team){return team==='ash'?'spark':'ash';}
  function homeSideForPlayer(side=selectedPlayerSide){return side==='right'?'enemy':'player';}
  function oppositeMapSide(side){return side==='enemy'?'player':'enemy';}
  function sideLabel(side=selectedPlayerSide){return side==='right'?'右侧开局':'左侧开局';}
  function factionLabel(key=selectedPlayerFaction){return key==='ash'?'灰烬军团':'星火联盟';}
  function normalizePlayerFaction(key){return key==='ash'?'ash':'spark';}
  function currentPlayerFaction(){return normalizePlayerFaction(state?.playerFaction||selectedPlayerFaction);}
  function productRosterFor(team=selectedPlayerFaction){return normalizePlayerFaction(team)==='ash'?ASH_PRODUCTS:SPARK_PRODUCTS;}
  function applyProductRoster(team=selectedPlayerFaction){PRODUCT_IDS.splice(0,PRODUCT_IDS.length,...productRosterFor(team));}
  function playerCanProduceUnit(id){return !!UNIT_DEFS[id]&&(currentPlayerFaction()==='ash'||!UNIT_DEFS[id].enemy);}
  function combatRosterFor(team){return normalizePlayerFaction(team)==='ash'?ASH_COMBAT_TYPES:SPARK_COMBAT_TYPES;}
  function openingUnitsFor(team,difficulty){
    const normalized=normalizePlayerFaction(team);
    if(normalized==='ash')return difficultyConfig(difficulty).initialUnits;
    return ['warrior','scout'];
  }
  function factionTeamForKey(key){if(teamFactions('ash').includes(key))return'ash';if(teamFactions('spark').includes(key))return'spark';return null;}
  function enemyFactionKind(){return opposingTeam(currentPlayerFaction());}
  function enemyFactionLabel(){return factionLabel(enemyFactionKind());}
  function factionLabelForObject(obj){return factionLabel(factionTeamForKey(factionKey(obj))||currentPlayerFaction());}
  function workerTypeFor(team){return normalizePlayerFaction(team)==='ash'?'enemyWorker':'worker';}
  function settlerTypeFor(team){return normalizePlayerFaction(team)==='ash'?'enemySettler':'settler';}
  function enemySupportTypes(){const team=enemyFactionKind();return{worker:workerTypeFor(team),settler:settlerTypeFor(team)};}
  function isWorkerType(id){return id==='worker'||id==='enemyWorker';}
  function isSettlerType(id){return id==='settler'||id==='enemySettler';}
  function enemyCityNamesFor(team){return normalizePlayerFaction(team)==='ash'?ENEMY_CITY_NAMES:SPARK_ENEMY_CITY_NAMES;}
  function capitalNameFor(team){return normalizePlayerFaction(team)==='ash'?'灰烬要塞':'曙光城';}
  function outpostNameFor(team,i){const names=enemyCityNamesFor(team);return names[i-1]||`${normalizePlayerFaction(team)==='ash'?'灰烬':'星火'}前哨 ${i}`;}
  function factionKey(obj){const playerTeam=currentPlayerFaction();if(!obj)return teamFactions(playerTeam)[0];if(obj.faction)return obj.faction;if(obj.team==='enemy')return teamFactions(opposingTeam(playerTeam))[0];return obj.allyAI?teamFactions(playerTeam)[1]:teamFactions(playerTeam)[0];}
  function factionColor(obj){return FACTION_COLORS[factionKey(obj)]||FACTION_COLORS.blue;}
  function setFaction(obj,key){if(obj)obj.faction=key;return obj;}
  function genericBuildingDef(id){return BUILDING_DEFS[id]||ENEMY_BUILDING_DEFS[id]||null;}
  function isBuildingProduct(id){return !!genericBuildingDef(id)&&!UNIT_DEFS[id];}
  productDef=function(id){return UNIT_DEFS[id]||BUILDING_DEFS[id]||ENEMY_BUILDING_DEFS[id]||null;};
  function hasManualOverride(unit){return !!unit&&unit.team==='player'&&((unit.manualOverrideUntil||0)>(state?.simTime||0)||unit.manualMove&&unit.route?.length>0);}

  // ===== Web Audio：完全内嵌、无需音频文件 =====
  class StarfireAudio{
    constructor(){
      this.ctx=null;this.master=null;this.musicBus=null;this.sfxBus=null;this.noiseBuffer=null;this.timer=null;
      this.nextBeat=0;this.step=0;this.muted=false;this.volume=.78;this.last={};this.ready=false;this.toneCount=0;this.lastError='';
      try{const raw=localStorage.getItem('starfireAudioV2Volume');if(raw!==null){const v=Number(raw);if(Number.isFinite(v))this.volume=clamp(v,0,1);}this.muted=localStorage.getItem('starfireAudioV2Muted')==='1';}catch{}
    }
    ensure(){
      if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});return true;}
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC){this.ready=false;updateAudioUI('浏览器不支持');return false;}
      try{
        this.ctx=new AC();this.master=this.ctx.createGain();this.musicBus=this.ctx.createGain();this.sfxBus=this.ctx.createGain();
        const compressor=this.ctx.createDynamicsCompressor();compressor.threshold.value=-18;compressor.knee.value=18;compressor.ratio.value=5;compressor.attack.value=.004;compressor.release.value=.22;
        this.musicBus.gain.value=.42;this.sfxBus.gain.value=.96;this.musicBus.connect(this.master);this.sfxBus.connect(this.master);this.master.connect(compressor);compressor.connect(this.ctx.destination);
        this.noiseBuffer=this.ctx.createBuffer(1,Math.floor(this.ctx.sampleRate*.8),this.ctx.sampleRate);const data=this.noiseBuffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        this.nextBeat=this.ctx.currentTime+.05;this.timer=setInterval(()=>this.scheduleMusic(),90);this.ready=true;this.applyVolume();this.ctx.resume().catch(()=>{});updateAudioUI();return true;
      }catch(err){console.warn('Audio init failed',err);this.lastError=String(err?.message||err);this.ready=false;updateAudioUI('声音初始化失败');return false;}
    }
    applyVolume(){if(!this.master||!this.ctx)return;const target=this.muted?0:this.volume;this.master.gain.cancelScheduledValues(this.ctx.currentTime);this.master.gain.setTargetAtTime(target,this.ctx.currentTime,.025);}
    setVolume(v){this.volume=clamp(v,0,1);try{localStorage.setItem('starfireAudioV2Volume',String(this.volume));}catch{}this.applyVolume();updateAudioUI();}
    toggle(){this.ensure();this.muted=!this.muted;try{localStorage.setItem('starfireAudioV2Muted',this.muted?'1':'0');}catch{}this.applyVolume();updateAudioUI();if(!this.muted)this.sfx('confirm',1.15);}
    tone(freq,dur=.12,type='sine',gain=.06,when=null,endFreq=null,bus='sfx'){
      if(!this.ctx||this.muted)return;this.toneCount++;when=when??this.ctx.currentTime;const osc=this.ctx.createOscillator(),g=this.ctx.createGain();osc.type=type;osc.frequency.setValueAtTime(Math.max(20,freq),when);if(endFreq)osc.frequency.exponentialRampToValueAtTime(Math.max(20,endFreq),when+dur);
      g.gain.setValueAtTime(.0001,when);g.gain.exponentialRampToValueAtTime(Math.max(.0002,gain),when+.012);g.gain.exponentialRampToValueAtTime(.0001,when+dur);osc.connect(g);g.connect(bus==='music'?this.musicBus:this.sfxBus);osc.start(when);osc.stop(when+dur+.025);
    }
    noise(dur=.18,gain=.08,filterFreq=900,when=null){
      if(!this.ctx||this.muted||!this.noiseBuffer)return;when=when??this.ctx.currentTime;const src=this.ctx.createBufferSource(),f=this.ctx.createBiquadFilter(),g=this.ctx.createGain();src.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.setValueAtTime(filterFreq,when);f.frequency.exponentialRampToValueAtTime(Math.max(60,filterFreq*.22),when+dur);g.gain.setValueAtTime(gain,when);g.gain.exponentialRampToValueAtTime(.0001,when+dur);src.connect(f);f.connect(g);g.connect(this.sfxBus);src.start(when);src.stop(when+dur+.02);
    }
    allow(name,gap){const now=this.ctx?.currentTime||0;if((this.last[name]??-99)+gap>now)return false;this.last[name]=now;return true;}
    sfx(name,power=1){
      if(!this.ctx||this.muted)return;const t=this.ctx.currentTime,p=clamp(power,.25,1.8);
      if(name==='click'){if(!this.allow(name,.035))return;this.tone(520,.055,'square',.035*p,t,690);}
      else if(name==='confirm'){this.tone(440,.10,'sine',.070*p,t,660);this.tone(660,.14,'triangle',.055*p,t+.060,880);}
      else if(name==='move'){if(!this.allow(name,.08))return;this.tone(210,.09,'triangle',.055*p,t,300);this.tone(390,.08,'sine',.040*p,t+.045,510);}
      else if(name==='lock'){if(!this.allow(name,.1))return;this.tone(700,.07,'square',.045*p,t,560);this.tone(980,.11,'sine',.052*p,t+.06,760);}
      else if(name==='research'){this.tone(330,.18,'sine',.025*p,t,440);this.tone(495,.22,'triangle',.022*p,t+.08,660);}
      else if(name==='researchDone'){[523,659,784,1046].forEach((f,i)=>this.tone(f,.25,'sine',.060*p,t+i*.075,f*1.02));}
      else if(name==='build'){this.noise(.12,.035*p,2400,t);this.tone(180,.12,'square',.025*p,t,260);this.tone(560,.08,'triangle',.025*p,t+.09,720);}
      else if(name==='complete'){[392,523,659].forEach((f,i)=>this.tone(f,.3,'triangle',.032*p,t+i*.055,f*1.02));}
      else if(name==='laser'){if(!this.allow(name,.055))return;this.tone(1280,.13,'sawtooth',.022*p,t,240);}
      else if(name==='shot'){if(!this.allow(name,.065))return;this.noise(.07,.032*p,1700,t);this.tone(180,.08,'square',.025*p,t,90);}
      else if(name==='melee'){if(!this.allow(name,.07))return;this.noise(.06,.022*p,950,t);this.tone(120,.07,'triangle',.025*p,t,75);}
      else if(name==='bomb'){if(!this.allow(name,.11))return;this.noise(.35,.135*p,760,t);this.tone(92,.36,'sine',.095*p,t,38);}
      else if(name==='alarm'){if(!this.allow(name,.7))return;for(let i=0;i<3;i++){this.tone(660,.13,'square',.055*p,t+i*.23,520);this.tone(440,.13,'square',.042*p,t+i*.23+.11,360);}}
      else if(name==='pulse'){if(!this.allow(name,1.8))return;this.tone(220,.12,'sine',.022*p,t,330);}
      else if(name==='audioTest'){this.noise(.08,.018*p,3200,t);[523.25,659.25,783.99].forEach((f,i)=>{this.tone(f,.28,i===1?'triangle':'sine',.115*p,t+i*.18,f*1.015);});}
      else if(name==='win'){[392,494,587,784,988].forEach((f,i)=>this.tone(f,.48,'triangle',.05*p,t+i*.12,f*1.04));}
      else if(name==='loss'){[330,277,220,165].forEach((f,i)=>this.tone(f,.55,'sawtooth',.035*p,t+i*.16,f*.72));this.noise(.5,.05*p,500,t+.3);}
    }
    scheduleMusic(){
      if(!this.ctx||this.muted||this.ctx.state!=='running')return;const active=state?.started&&!state.paused&&!state.gameOver;if(!active){this.nextBeat=Math.max(this.nextBeat,this.ctx.currentTime+.2);return;}
      const combat=state.units?.some(u=>u.combatGlow>0&&u.hp>0),hard=state.difficulty==='hard';const beatLen=combat?.31:.46;const roots=combat?[43,46,41,48]:[48,45,50,43];
      while(this.nextBeat<this.ctx.currentTime+.45){const beat=this.step++,root=roots[Math.floor(beat/8)%roots.length],scale=[0,3,5,7,10,12];const midi=root+scale[(beat*3+Math.floor(beat/4))%scale.length],freq=440*Math.pow(2,(midi-69)/12);
        if(beat%8===0){[0,7,12].forEach((off,i)=>{const f=440*Math.pow(2,(root+off-69)/12);this.tone(f,beatLen*7.4,i===0?'sine':'triangle',.021+(i===0?.007:0),this.nextBeat,null,'music');});}
        if(beat%2===0)this.tone(freq,beatLen*.8,'triangle',combat?.026:.019,this.nextBeat,freq*(combat?1.02:1),'music');
        if(combat&&beat%2===1)this.tone(hard?72:82,.12,'sine',.023,this.nextBeat,52,'music');
        this.nextBeat+=beatLen;
      }
    }
  }
  const gameAudio=new StarfireAudio();
  function updateAudioUI(forced=''){
    const supported=!!(window.AudioContext||window.webkitAudioContext),ctxState=gameAudio.ctx?.state||'none',pct=Math.round(gameAudio.volume*100),muted=gameAudio.muted||pct===0;
    let status=forced;if(!status){if(!supported)status='浏览器不支持 Web Audio';else if(muted)status='当前已静音';else if(ctxState==='running')status='音频引擎运行中';else if(ctxState==='suspended')status='等待浏览器授权';else status='声音待启动';}
    const toggleText=muted?'🔇':'🔊';
    const toggle=$('audioDockToggle');if(toggle)toggle.textContent=toggleText;
    const volume=$('audioDockVolume');if(volume)volume.value=pct;
    const volumeText=$('audioDockVolumeText');if(volumeText)volumeText.textContent=pct+'%';
    const audioStatus=$('audioStatus');if(audioStatus){audioStatus.textContent=status;audioStatus.classList.toggle('audioStatusOk',ctxState==='running'&&!muted&&!forced.includes('失败'));audioStatus.classList.toggle('audioStatusWarn',muted||ctxState==='suspended');audioStatus.classList.toggle('audioStatusError',!supported||forced.includes('失败'));}
    const dock=$('audioDock');if(dock){dock.classList.toggle('audioRunning',ctxState==='running'&&!muted);dock.classList.toggle('audioMuted',muted);dock.classList.toggle('audioError',!supported||!!gameAudio.lastError);}
  }
  async function toggleAudioExplicit(){
    if(gameAudio.muted||gameAudio.volume===0){gameAudio.muted=false;if(gameAudio.volume===0)gameAudio.volume=.78;try{localStorage.setItem('starfireAudioV2Muted','0');localStorage.setItem('starfireAudioV2Volume',String(gameAudio.volume));}catch{}gameAudio.ensure();if(gameAudio.ctx)try{await gameAudio.ctx.resume();}catch{}gameAudio.applyVolume();gameAudio.sfx('confirm',1.15);updateAudioUI('声音已开启');}
    else{gameAudio.muted=true;try{localStorage.setItem('starfireAudioV2Muted','1');}catch{}gameAudio.applyVolume();updateAudioUI('声音已静音');}
  }
  function setAudioVolumeFromControl(value,preview=false){gameAudio.ensure();gameAudio.muted=false;try{localStorage.setItem('starfireAudioV2Muted','0');}catch{}gameAudio.setVolume(Number(value)/100);if(preview&&gameAudio.ctx?.state==='running')gameAudio.sfx('click',1.05);}


  // ===== 敌军文明状态与难度缩放 =====
  function makeEnemyAI(key){
    const cfg=difficultyConfig(key);return{difficulty:key,resources:{...cfg.starting},lastYield:{food:0,production:0,science:0,gold:0,energy:0},completed:new Set(cfg.startTechs),research:null,era:0,thinkTimer:.3,waveTimer:cfg.initialWave,waveNumber:0,plan:'建立资源网络',adaptation:0,lastAdaptMark:0,lastStand:false,citySerial:0,productionSerial:0,expansionRequested:false};
  }
  function makeAllyAI(count=0){return{resources:{food:70+count*35,production:95+count*45,science:22+count*10,gold:95+count*35,energy:22+count*8},lastYield:{food:0,production:0,science:0,gold:0,energy:0},plan:'盟友前哨整备中'};}
  function enemyUnitName(def,team,extra){
    if(team!=='enemy')return def.name;
    const teamKind=extra.teamKind||factionTeamForKey(extra.faction)||enemyFactionKind();
    if(teamKind!=='ash')return def.name;
    return def.name.startsWith('灰烬')||def.name==='熔核泰坦'?def.name:'灰烬·'+def.name;
  }
  function createUnitEnhanced(type,team,q,r,extra={}){
    const def=UNIT_DEFS[type],isWorker=type==='worker'||!!def.worker;const base=def.hp||1,charges=isWorker?(extra.charges??5):0;
    return {id:uid('u'),type,def,team,q,r,hp:base,maxHp:base,baseMaxHp:base,route:[],moveProgress:0,target:null,manualTarget:false,holdPosition:false,
      attackTimer:Math.random()*.4,combatGlow:0,beamTick:0,aiWorker:!!def.worker,charges,work:null,overdrive:0,disrupted:0,spawnFlash:1,
      name:enemyUnitName(def,team,extra),aiOrder:team==='enemy'?(def.combat?'garrison':'economy'):'',elite:false,waveId:0,colonyTarget:null,...extra};
  }
  createUnit=createUnitEnhanced;
  createCity=function(team,q,r,capital=false,name){
    const base=capital?(team==='player'?760:520):(team==='player'?430:470);return{id:uid('c'),team,q,r,capital,name:name||(capital?(team==='player'?'曙光城':'灰烬要塞'):'新星城'),hp:base,maxHp:base,baseMaxHp:base,shield:0,maxShield:0,queue:[],buildings:[],population:capital?4:2,flash:0,lastDamaged:-999};
  };
  function applyEnemyUnitScale(u,cfg,initial=false){
    if(u.team!=='enemy')return;const ratio=initial?1:clamp(u.hp/Math.max(1,u.maxHp),0,1),eliteScale=u.elite?1.24:1;u.maxHp=Math.round((u.baseMaxHp||u.def.hp)*cfg.unitHp*eliteScale);u.hp=initial?u.maxHp:Math.max(1,Math.round(u.maxHp*ratio));u.aiDifficulty=cfg.key;
  }
  function applyEnemyCityScale(c,cfg,initial=false){
    if(c.team!=='enemy')return;const ratio=initial?1:clamp(c.hp/Math.max(1,c.maxHp),0,1);c.maxHp=Math.round((c.baseMaxHp||470)*cfg.cityHp);c.hp=initial?c.maxHp:Math.max(1,Math.round(c.maxHp*ratio));const bastion=c.buildings.includes('bastion')||c.buildings.includes('shieldDome');c.maxShield=Math.round((c.capital?cfg.capitalShield:cfg.capitalShield*.42)+(bastion?220:0));c.shield=initial?c.maxShield:Math.min(c.maxShield,Math.max(c.shield,Math.round(c.maxShield*.22)));
  }
  function applyDifficultyScales(targetState=state,initial=false){const cfg=difficultyConfig(targetState.difficulty);for(const u of targetState.units)applyEnemyUnitScale(u,cfg,initial);for(const c of targetState.cities)applyEnemyCityScale(c,cfg,initial);}
  function sideSlots(side,count,layout){
    return mapSideSlots(side,count,layout);
  }
  function addPlayerOpeningUnits(s,slot,primary=false,faction='blue',teamKind='spark'){
    const spots=primary?[[slot.q+1,slot.r],[slot.q,slot.r+1],[slot.q+1,slot.r-1]]:[[slot.q+1,slot.r],[slot.q,slot.r+1]];
    const combat=teamKind==='ash'?(primary?'raider':'enemyArcher'):(primary?'warrior':'archer'),worker=teamKind==='ash'?'enemyWorker':'worker',scout=teamKind==='ash'?'enemyArcher':'scout';
    s.units.push(createUnit(combat,'player',clamp(spots[0][0],0,mapWidth()-1),clamp(spots[0][1],0,mapHeight()-1),{aiWorker:!primary,allyAI:!primary,faction,aiOrder:''}));
    s.units.push(createUnit(worker,'player',clamp(spots[1][0],0,mapWidth()-1),clamp(spots[1][1],0,mapHeight()-1),{aiWorker:primary?selectedWorkerDefaultAI:true,allyAI:!primary,faction,aiOrder:''}));
    if(primary)s.units.push(createUnit(scout,'player',clamp(spots[2][0],0,mapWidth()-1),clamp(spots[2][1],0,mapHeight()-1),{aiWorker:false,faction,aiOrder:''}));
  }
  function addEnemyOpeningUnits(s,slot,types,faction='red'){
    const spots=[[slot.q-1,slot.r],[slot.q,slot.r+1],[slot.q-1,slot.r-1],[slot.q+1,slot.r]].map(([q,r])=>[clamp(q,0,mapWidth()-1),clamp(r,0,mapHeight()-1)]);
    types.forEach((type,i)=>s.units.push(createUnit(type,'enemy',spots[i%spots.length][0],spots[i%spots.length][1],{aiOrder:'garrison',faction})));
  }
  freshState=function(started=false,difficulty=selectedDifficulty,mapMode=selectedMapMode,leftAI=selectedLeftAI,rightAI=selectedRightAI,playerSide=selectedPlayerSide,playerFaction=selectedPlayerFaction){
    leftAI=clamp(Number(leftAI)||0,0,2);rightAI=clamp(Number(rightAI)||1,1,3);
    playerSide=playerSide==='right'?'right':'left';playerFaction=normalizePlayerFaction(playerFaction);applyProductRoster(playerFaction);
    const mapConfig=createMapConfig(mapMode,null,1+leftAI+rightAI);tiles=generateMap(mapConfig);const layout=mapLayout(),cfg=difficultyConfig(difficulty);
    const playerMapSide=homeSideForPlayer(playerSide),enemyMapSide=oppositeMapSide(playerMapSide);
    const playerSlots=sideSlots(playerMapSide,1+leftAI,layout),enemySlots=sideSlots(enemyMapSide,rightAI,layout);
    const enemyTeam=opposingTeam(playerFaction),friendlyOrder=teamFactions(playerFaction),enemyOrder=teamFactions(enemyTeam);
    const playerCity=setFaction(createCity('player',playerSlots[0].q,playerSlots[0].r,true,capitalNameFor(playerFaction)),friendlyOrder[0]),enemyCity=setFaction(createCity('enemy',enemySlots[0].q,enemySlots[0].r,true,capitalNameFor(enemyTeam)),enemyOrder[0]);
    const s={started,paused:false,gameOver:false,speed:1,simTime:0,pulseTimer:0,enemySpawnTimer:0,enemyThink:0,difficulty,
      resources:{food:92,production:72,science:0,gold:118,energy:32},lastYield:{food:0,production:0,science:0,gold:0,energy:0},enemyAI:makeEnemyAI(difficulty),allyAI:makeAllyAI(leftAI),
      cities:[playerCity,enemyCity],units:[],effects:[],logs:[],completed:new Set(),research:null,aiTech:true,selection:{kind:'city',id:playerCity.id},hovered:null,showIntel:false,keys:new Set(),score:0,era:0,overdriveGlobal:0,uiTimer:0,uiHoldUntil:0,toastSeq:0,tutorialActive:false,tutorialRewarded:false,singularityCooldown:0,
      mapMode:currentMapConfig.mode,mapSeed:currentMapConfig.seed,mapSize:{width:mapWidth(),height:mapHeight()},leftAI,rightAI,playerSide,playerFaction,playerMapSide,enemyMapSide,
      camera:{x:axialToWorld(playerSlots[0].q,playerSlots[0].r).x,y:axialToWorld(playerSlots[0].q,playerSlots[0].r).y,zoom:.86},screen:{w:1,h:1,dpr:1},lastFrame:performance.now(),acc:0};
    for(let i=1;i<playerSlots.length;i++){const c=setFaction(createCity('player',playerSlots[i].q,playerSlots[i].r,false,`盟友前哨 ${i}`),friendlyOrder[i]);c.allyAI=true;s.cities.push(c);}
    for(let i=1;i<enemySlots.length;i++)s.cities.push(setFaction(createCity('enemy',enemySlots[i].q,enemySlots[i].r,false,outpostNameFor(enemyTeam,i)),enemyOrder[i]));
    playerSlots.forEach((slot,i)=>addPlayerOpeningUnits(s,slot,i===0,friendlyOrder[i],playerFaction));
    enemySlots.forEach((slot,i)=>addEnemyOpeningUnits(s,slot,openingUnitsFor(enemyTeam,difficulty),enemyOrder[i]));
    applyDifficultyScales(s,true);return s;
  };

  // ===== 双方经济与敌方科研 =====
  function tileYieldForTeam(tile,team){
    const out={};if(!tile?.improvement)return out;
    const owner=tile.improvement.owner||tile.improvement.team;if(owner!==team)return out;const imp=IMPROVEMENTS[tile.improvement.type];if(!imp)return out;
    for(const[k,v]of Object.entries(imp.yield||{}))out[k]=(out[k]||0)+v;if(tile.resource)for(const[k,v]of Object.entries(RESOURCE_DEFS[tile.resource].yield||{}))out[k]=(out[k]||0)+v;return out;
  }
  tileYield=function(tile){return tileYieldForTeam(tile,'player');};
  function enemyCityYield(city){
    if(city.team!=='enemy')return{};const y={food:1.5,production:1.4,science:1,gold:2,energy:0};if(city.capital)y.gold+=1;y.food+=Math.floor(city.population/5);
    if(city.buildings.includes('ashGranary')||city.buildings.includes('granary'))y.food+=4;
    if(city.buildings.includes('warLab')||city.buildings.includes('academy'))y.science+=4.5;
    if(city.buildings.includes('warFoundry')||city.buildings.includes('forge'))y.production+=5;
    if(city.buildings.includes('bastion')||city.buildings.includes('shieldDome')){y.production+=1.5;y.energy+=2;}
    if(city.buildings.includes('warCore')||city.buildings.includes('quantumRelay')){y.science+=2;y.energy+=5;}
    return y;
  }
  function allyCityYield(city){
    if(!city.allyAI)return{};const y={food:1.5,production:1.4,science:1,gold:2,energy:0};y.food+=Math.floor(city.population/5);
    if(city.buildings.includes('granary'))y.food+=3;if(city.buildings.includes('forge'))y.production+=2;if(city.buildings.includes('academy'))y.science+=4;if(city.buildings.includes('quantumRelay'))y.energy+=4;
    return y;
  }
  function calculateAllyYield(){const total={food:0,production:0,science:0,gold:0,energy:0};for(const c of state.cities)if(c.allyAI&&c.hp>0)for(const[k,v]of Object.entries(allyCityYield(c)))total[k]+=v;for(const t of tiles.values())for(const[k,v]of Object.entries(tileYieldForTeam(t,'ally')))total[k]+=v;return total;}
  function calculateEnemyYield(){const total={food:0,production:0,science:0,gold:0,energy:0},cfg=difficultyConfig();for(const c of state.cities)if(c.team==='enemy'&&c.hp>0)for(const[k,v]of Object.entries(enemyCityYield(c)))total[k]+=v;for(const t of tiles.values())for(const[k,v]of Object.entries(tileYieldForTeam(t,'enemy')))total[k]+=v;for(const k of RESOURCE_KEYS)total[k]*=cfg.economy;return total;}
  resourcePulse=function(){
    const y=calculateYield();state.lastYield=y;for(const k of RESOURCE_KEYS)state.resources[k]+=y[k]||0;
    for(const c of state.cities){if(c.team!=='player'||c.hp<=0||c.allyAI)continue;if(hasBuilding(c,'shieldDome')){c.maxShield=180;c.shield=Math.min(c.maxShield,c.shield+7);}if(hasBuilding(c,'quantumRelay'))for(const u of state.units)if(u.team==='player'&&hexDistance(u,c)<=2)u.hp=Math.min(u.maxHp,u.hp+8);if(state.resources.food>90+c.population*14&&c.population<15){state.resources.food-=24+c.population*2;c.population++;floating(c.q,c.r,'人口 +1','#66e7a7',-20);}}
    if(state.allyAI){const ay=calculateAllyYield();state.allyAI.lastYield=ay;for(const k of RESOURCE_KEYS)state.allyAI.resources[k]+=ay[k]||0;for(const c of state.cities)if(c.allyAI&&c.hp>0&&state.allyAI.resources.food>80+c.population*12&&c.population<12){state.allyAI.resources.food-=20+c.population*2;c.population++;}}
    if(!state.tutorialActive&&state.enemyAI){const ey=calculateEnemyYield(),ai=state.enemyAI,cfg=difficultyConfig();ai.lastYield=ey;for(const k of RESOURCE_KEYS)ai.resources[k]+=ey[k]||0;for(const c of state.cities)if(c.team==='enemy'&&c.hp>0&&ai.resources.food>80+c.population*12&&c.population<(cfg.key==='hard'?18:12)){ai.resources.food-=20+c.population*2;c.population++;}
      if(cfg.maxAdapt>0){const mark=Math.floor(state.simTime/cfg.adaptEvery);if(mark>ai.lastAdaptMark&&ai.adaptation<cfg.maxAdapt){ai.lastAdaptMark=mark;ai.adaptation++;addLog(`🧠 ${enemyFactionLabel()} AI 完成第 ${ai.adaptation} 次战术适应，决策和反制会更积极。`,'warn');if(cfg.key==='hard')toast(`☠️ 困难 AI 战术适应 ${ai.adaptation}/${cfg.maxAdapt}`,'danger');}}
    }
    if(Math.floor(state.simTime)%4===0)gameAudio.sfx('pulse',.7);
  };
  function enemyHasTech(id){return !id||state.enemyAI?.completed.has(id);}
  function enemyTechAvailable(t){return !state.enemyAI.completed.has(t.id)&&state.enemyAI.research?.id!==t.id&&t.pre.every(enemyHasTech);}
  function chooseEnemyResearch(){const ai=state.enemyAI;if(!ai||ai.research)return false;const cfg=difficultyConfig(),options=TECHS.filter(enemyTechAvailable).filter(t=>ai.resources.science>=t.cost*cfg.techCost);if(!options.length)return false;options.sort((a,b)=>ENEMY_TECH_PRIORITY.indexOf(a.id)-ENEMY_TECH_PRIORITY.indexOf(b.id)||a.cost-b.cost);const t=options[0],cost=t.cost*cfg.techCost;ai.resources.science-=cost;ai.research={id:t.id,progress:0,time:t.time};ai.plan=`研发 ${t.name}`;addLog(`📡 情报：${enemyFactionLabel()}开始研发「${t.name}」。`,'warn');return true;}
  function finishEnemyResearch(){const ai=state.enemyAI,t=techById(ai.research.id);ai.completed.add(t.id);ai.research=null;ai.era=Math.max(ai.era,t.era);ai.resources.energy+=4+t.era*2;addLog(`⚠️ ${enemyFactionLabel()}完成科技「${t.name}」，敌军兵种可能升级。`,'warn');burst(16,7,factionColor({team:'enemy'}).glow,10,.55);}
  function updateEnemyResearch(dt){if(state.tutorialActive||!state.enemyAI)return;if(!state.enemyAI.research){chooseEnemyResearch();return;}const labs=state.cities.filter(c=>c.team==='enemy'&&(c.buildings.includes('warLab')||c.buildings.includes('academy'))).length,mult=difficultyConfig().researchSpeed*(1+labs*.12);state.enemyAI.research.progress+=dt*mult;if(state.enemyAI.research.progress>=state.enemyAI.research.time)finishEnemyResearch();}

  // ===== 敌方生产、设施、扩张 =====
  function enemyCanAfford(cost){return Object.entries(cost||{}).every(([k,v])=>(state.enemyAI.resources[k]||0)>=v);}
  function enemyPay(cost){if(!enemyCanAfford(cost))return false;for(const[k,v]of Object.entries(cost||{}))state.enemyAI.resources[k]-=v;return true;}
  function allyCanAfford(cost){return Object.entries(cost||{}).every(([k,v])=>(state.allyAI?.resources[k]||0)>=v);}
  function allyPay(cost){if(!allyCanAfford(cost))return false;for(const[k,v]of Object.entries(cost||{}))state.allyAI.resources[k]-=v;return true;}
  function allyQueueProduct(city,id){if(!city?.allyAI||!hasProductUnlock(id)||!playerCanProduceUnit(id))return false;const d=productDef(id);if(!d||!allyPay(d.cost))return false;city.queue.push({qid:uid('aq'),id,progress:0,time:d.time,cost:deepCost(d.cost),ally:true});state.allyAI.plan=`${city.name} 正在生产 ${d.name}`;return true;}
  function enemyUnlocked(id){const d=productDef(id);return !!d&&enemyHasTech(d.tech);}
  function enemyQueueProduct(city,id){if(!city||city.team!=='enemy'||!enemyUnlocked(id))return false;const d=productDef(id);if(!d)return false;if(isBuildingProduct(id)&&(city.buildings.includes(id)||city.queue.some(x=>x.id===id)))return false;if(!enemyPay(d.cost))return false;city.queue.push({qid:uid('eq'),id,progress:0,time:d.time,cost:deepCost(d.cost),enemy:true});state.enemyAI.plan=`${city.name} 正在生产 ${d.name}`;return true;}
  function findSpawnTile(city,def){const rings=[tileAt(city.q,city.r),...hexNeighbors(city.q,city.r)];for(const t of rings)if(t&&(def.flying||isLand(t)))return t;return tileAt(city.q,city.r);}
  function spawnEnemyNearCity(city,type,forceElite=false){const def=UNIT_DEFS[type],t=findSpawnTile(city,def),cfg=difficultyConfig(),elite=!!def.combat&&(forceElite||Math.random()<cfg.eliteChance),color=factionColor(city),faction=factionKey(city);const u=createUnit(type,'enemy',t.q,t.r,{aiOrder:def.combat?'garrison':'economy',elite,charges:isWorkerType(type)?cfg.workerCharges:0,faction,teamKind:factionTeamForKey(faction)||enemyFactionKind()});applyEnemyUnitScale(u,cfg,true);state.units.push(u);burst(t.q,t.r,elite?'#ffd166':color.glow,elite?18:10,.7);return u;}
  function completeEnemyProduct(city,item){const id=item.id,d=productDef(id);if(UNIT_DEFS[id]){const u=spawnEnemyNearCity(city,id);if(isWorkerType(id)){u.aiWorker=true;u.aiOrder='economy';}if(isSettlerType(id))u.aiOrder='expand';if(u.elite)addLog(`☠️ ${city.name} 部署精英单位「${u.name||d.name}」。`,'danger');else if(d.combat)addLog(`⚠️ ${city.name} 完成 ${u.name||d.name}，正在集结。`,'warn');}
    else if(isBuildingProduct(id)){city.buildings.push(id);if(id==='bastion'||id==='shieldDome')applyEnemyCityScale(city,difficultyConfig(),false);addLog(`🏭 情报：${city.name} 建成 ${d.name}。`,'warn');burst(city.q,city.r,factionColor(city).glow,14,.75);}}
  function enemyImprovementCount(){let n=0;for(const t of tiles.values())if(t.improvement?.team==='enemy')n++;return n;}
  function enemyWorkerCount(){const worker=enemySupportTypes().worker;return state.units.filter(u=>u.team==='enemy'&&u.type===worker&&u.hp>0).length+state.cities.reduce((n,c)=>n+c.queue.filter(x=>x.id===worker).length,0);}
  function enemySettlerCount(){const settler=enemySupportTypes().settler;return state.units.filter(u=>u.team==='enemy'&&u.type===settler&&u.hp>0).length+state.cities.reduce((n,c)=>n+c.queue.filter(x=>x.id===settler).length,0);}
  function enemyBuildingOrder(){return enemyFactionKind()==='ash'?['ashGranary','warLab','warFoundry','bastion','warCore']:['granary','forge','academy','shieldDome','quantumRelay'];}
  function enemyNextBuilding(city){const cfg=difficultyConfig(),orders=enemyBuildingOrder();for(const id of orders){if(city.buildings.includes(id)||city.queue.some(x=>x.id===id)||!enemyUnlocked(id))continue;if((id==='bastion'||id==='shieldDome')&&cfg.key==='easy')continue;if((id==='warCore'||id==='quantumRelay')&&cfg.key!=='hard')continue;return id;}return null;}
  function availableEnemyCombatTypes(){return combatRosterFor(enemyFactionKind()).filter(id=>enemyUnlocked(id));}
  function chooseEnemyCombatType(){const cfg=difficultyConfig(),available=availableEnemyCombatTypes(),players=state.units.filter(u=>u.team==='player'&&u.hp>0),heavy=players.filter(u=>['tank','prism','kirov','quantumWalker','enemySiege','enemyDrone','enemyTitan'].includes(u.type)).length,ranged=players.filter(u=>(u.def.range||1)>1).length,weights={raider:6,warrior:6,scout:5,enemyArcher:5,archer:5,enemyBuggy:4,knight:4,tank:3,enemySiege:3,prism:3,enemyDrone:2,kirov:2,quantumWalker:1,enemyTitan:1};let weighted=[];for(const id of available){let w=weights[id]||2;if(heavy&&['enemySiege','enemyDrone','enemyTitan','tank','prism','kirov','quantumWalker'].includes(id))w+=heavy*1.4;if(ranged>=2&&['enemyBuggy','enemyDrone','knight','tank'].includes(id))w+=3;if(cfg.key==='hard'&&['enemySiege','enemyDrone','enemyTitan','tank','prism','kirov','quantumWalker'].includes(id))w*=1.45;for(let i=0;i<Math.ceil(w);i++)weighted.push(id);}weighted=weighted.filter(id=>enemyCanAfford(UNIT_DEFS[id].cost));return weighted.length?weighted[Math.floor(Math.random()*weighted.length)]:available.filter(id=>enemyCanAfford(UNIT_DEFS[id].cost)).sort((a,b)=>Object.values(UNIT_DEFS[a].cost).reduce((x,y)=>x+y,0)-Object.values(UNIT_DEFS[b].cost).reduce((x,y)=>x+y,0))[0]||null;}
  function decideEnemyProduction(city){if(city.queue.length||city.hp<=0)return;const ai=state.enemyAI,cfg=difficultyConfig(),enemyCities=state.cities.filter(c=>c.team==='enemy'&&c.hp>0),improvements=enemyImprovementCount(),desired=enemyCities.length*cfg.improvementsPerCity;
    const support=enemySupportTypes();
    if(improvements<desired&&enemyWorkerCount()<Math.max(1,enemyCities.length)&&enemyQueueProduct(city,support.worker))return;
    if(enemyCities.length<cfg.maxCities&&state.simTime>=cfg.expandAt+(enemyCities.length-1)*12&&enemySettlerCount()===0&&enemyUnlocked(support.settler)&&enemyQueueProduct(city,support.settler)){ai.expansionRequested=true;return;}
    const building=enemyNextBuilding(city);if(building&&(city.buildings.length<2||ai.waveNumber%2===1||cfg.key==='hard')&&enemyQueueProduct(city,building))return;
    const combatCount=state.units.filter(u=>u.team==='enemy'&&u.def.combat&&u.hp>0).length;if(state.simTime>=cfg.initialWave&&combatCount<cfg.maxUnits){const type=chooseEnemyCombatType();if(type&&enemyQueueProduct(city,type))return;}
    if(building)enemyQueueProduct(city,building);
  }
  updateCities=function(dt){
    for(const c of state.cities){if(c.hp<=0)continue;c.flash=Math.max(0,c.flash-dt*2.5);
      if(c.team==='player'&&c.allyAI&&!c.queue.length){
        const ash=currentPlayerFaction()==='ash',order=state.units.filter(u=>u.team==='player'&&u.allyAI&&u.def.combat&&u.hp>0).length<state.leftAI*3+2?(ash?'raider':'warrior'):state.units.filter(u=>u.team==='player'&&u.allyAI&&(u.type==='worker'||u.type==='enemyWorker')&&u.hp>0).length<state.leftAI+1?(ash?'enemyWorker':'worker'):(ash?'enemyArcher':'archer');
        allyQueueProduct(c,order);
      }
      if(c.team==='player'&&c.queue.length){const item=c.queue[0],prod=(c.allyAI?allyCityYield(c):cityYield(c)).production||0;let mult=1+Math.min(3.5,prod/6);if(hasBuilding(c,'forge'))mult*=1.25;if(item.id==='kirov'&&hasBuilding(c,'skyDock'))mult*=1.3;const bank=c.allyAI?state.allyAI?.resources:state.resources,invest=Math.min(bank?.production||0,prod*dt*.75);if(invest>0){bank.production-=invest;item.progress+=invest*.08;}item.progress+=dt*mult;if(item.progress>=item.time){c.queue.shift();completeProduct(c,item);renderPanels();}}
      if(c.team==='enemy'&&!state.tutorialActive&&c.queue.length){const item=c.queue[0],cfg=difficultyConfig();let mult=cfg.productionSpeed*((c.buildings.includes('warFoundry')||c.buildings.includes('forge'))?1.28:1)*(state.enemyAI.lastStand?1.18:1);item.progress+=dt*mult;if(item.progress>=item.time){c.queue.shift();completeEnemyProduct(c,item);renderPanels();}}
      if(c.team==='player'&&c.maxShield>0)c.shield=Math.min(c.maxShield,c.shield+dt*1.3);
      if(c.team==='enemy'&&!state.tutorialActive&&c.maxShield>0&&state.simTime-c.lastDamaged>.9){const regen=difficultyConfig().shieldRegen*((c.buildings.includes('bastion')||c.buildings.includes('shieldDome'))?1.35:1);c.shield=Math.min(c.maxShield,c.shield+dt*regen);}
    }
  };

  function enemyCanImproveTile(tile){if(!tile||!isLand(tile)||cityAt(tile.q,tile.r)||tile.improvement)return{ok:false};const type=improvementForTile(tile);if(!type||type==='harbor')return{ok:false};const tech=improvementTech(type);if(!enemyHasTech(tech))return{ok:false};const near=state.cities.some(c=>c.team==='enemy'&&c.hp>0&&hexDistance(c,tile)<=7);return near?{ok:true,type}:{ok:false};}
  function enemyAssignWorkerBuild(u,tile){const check=enemyCanImproveTile(tile);if(!check.ok||u.charges<=0)return false;if(state.units.some(x=>x.id!==u.id&&x.work&&x.work.q===tile.q&&x.work.r===tile.r))return false;const path=findPath(u,{q:u.q,r:u.r},tile);if(!path.length&&(u.q!==tile.q||u.r!==tile.r))return false;u.work={q:tile.q,r:tile.r,type:check.type,progress:0,time:IMPROVEMENTS[check.type].duration*1.15,building:false};u.route=path;u.moveProgress=0;return true;}
  function chooseEnemyWorkerTask(u){const list=[];for(const t of tiles.values()){const d=hexDistance(u,t);if(d>8)continue;const check=enemyCanImproveTile(t);if(!check.ok)continue;let score=(t.resource?48:8)-d*2.1;if(t.resource==='crystal'||t.resource==='oil')score+=8;list.push({t,score});}list.sort((a,b)=>b.score-a.score);for(const x of list.slice(0,22))if(enemyAssignWorkerBuild(u,x.t))return true;return false;}
  function finishEnemyWorkerBuild(u){const w=u.work,t=tileAt(w.q,w.r);if(!t||t.improvement){u.work=null;return;}const d=IMPROVEMENTS[w.type],color=factionColor(u);t.improvement={type:w.type,team:'enemy',owner:'enemy',faction:factionKey(u),hp:d.hp,maxHp:d.hp};u.charges--;u.work=null;addLog(`⚠️ ${u.name||u.def.name} 完成 ${d.name}，敌方经济产出提高。`,'warn');burst(t.q,t.r,color.glow,12,.7);if(u.charges<=0){state.units=state.units.filter(x=>x.id!==u.id);if(state.selection?.id===u.id)state.selection=null;}}
  healNearby=function(unit,dt){const drone=unit.type==='repairDrone',automated=unit.team==='player'?state.completed.has('automation'):enemyHasTech('automation'),radius=drone?2:(automated?2:1),rate=unit.team==='enemy'?difficultyConfig().repairRate:(drone?10:4.2);let healed=false;for(const u of state.units)if(u.team===unit.team&&u.id!==unit.id&&u.hp>0&&u.hp<u.maxHp&&hexDistance(unit,u)<=radius){u.hp=Math.min(u.maxHp,u.hp+rate*dt);healed=true;}for(const c of state.cities)if(c.team===unit.team&&c.hp>0&&c.hp<c.maxHp&&hexDistance(unit,c)<=radius){c.hp=Math.min(c.maxHp,c.hp+rate*dt);healed=true;}for(const t of tiles.values())if(t.improvement?.team===unit.team&&t.improvement.hp<t.improvement.maxHp&&hexDistance(unit,t)<=radius){t.improvement.hp=Math.min(t.improvement.maxHp,t.improvement.hp+rate*dt);healed=true;}unit.repairFx=(unit.repairFx||0)-dt;if(healed&&unit.repairFx<=0){unit.repairFx=.45;const p=unitDrawPos(unit);state.effects.push({type:'repair',x:p.x,y:p.y,life:.42,max:.42});}}
  function updateEnemyWorkers(dt){if(state.tutorialActive)return;for(const u of [...state.units]){if(u.team!=='enemy'||!isWorkerType(u.type)||u.hp<=0)continue;healNearby(u,dt);u.aiThink=(u.aiThink||0)-dt;if(u.work){const w=u.work,t=tileAt(w.q,w.r);if(!t||t.improvement){u.work=null;continue;}if(u.q===w.q&&u.r===w.r&&!u.route.length){w.building=true;w.progress+=dt*difficultyConfig().productionSpeed;u.combatGlow=.2;u.buildFx=(u.buildFx||0)-dt;if(u.buildFx<=0){u.buildFx=.18;const p=axialToWorld(u.q,u.r),color=factionColor(u);state.effects.push({type:'particle',x:p.x+(Math.random()-.5)*16,y:p.y-7,vx:(Math.random()-.5)*14,vy:-15-Math.random()*15,life:.4,max:.4,size:2.3,color:color.glow});}if(w.progress>=w.time)finishEnemyWorkerBuild(u);}}
      else if(u.aiThink<=0){u.aiThink=.9;if(!chooseEnemyWorkerTask(u))u.aiThink=2;}}
  }
  function findEnemyExpansionSite(u){const enemyCities=state.cities.filter(c=>c.team==='enemy'&&c.hp>0),playerCapital=state.cities.find(c=>c.team==='player'&&c.capital&&c.hp>0),list=[];for(const t of tiles.values()){if(!isLand(t)||cityAt(t.q,t.r)||t.improvement)continue;const minAll=Math.min(...state.cities.filter(c=>c.hp>0).map(c=>hexDistance(c,t)));if(minAll<4)continue;const nearEnemy=Math.min(...enemyCities.map(c=>hexDistance(c,t)));if(nearEnemy>9)continue;const path=findPath(u,{q:u.q,r:u.r},t);if(!path.length)continue;let score=(t.resource?24:0)+(t.terrain==='hills'?5:0)-Math.abs(nearEnemy-6)*2;if(playerCapital)score-=hexDistance(t,playerCapital)*.45;list.push({t,score});}list.sort((a,b)=>b.score-a.score);return list[0]?.t||null;}
  function foundEnemyCity(u){const t=tileAt(u.q,u.r),cfg=difficultyConfig();if(!t||!isLand(t)||cityAt(t.q,t.r))return false;const idx=state.cities.filter(c=>c.team==='enemy').length,teamKind=factionTeamForKey(factionKey(u))||enemyFactionKind(),c=setFaction(createCity('enemy',t.q,t.r,false,outpostNameFor(teamKind,idx)),factionKey(u));state.cities.push(c);applyEnemyCityScale(c,cfg,true);state.units=state.units.filter(x=>x.id!==u.id);state.enemyAI.resources.production+=35;state.enemyAI.resources.gold+=20;state.enemyAI.plan=`${c.name} 开始建设`;addLog(`☠️ ${u.name||u.def.name} 建立了新城市「${c.name}」。`,'danger');toast(`⚠️ 敌军扩张：${c.name} 已建立！`,'danger');burst(c.q,c.r,factionColor(c).glow,25,1.2);gameAudio.sfx('alarm');return true;}
  function updateEnemySettlers(){if(state.tutorialActive)return;for(const u of [...state.units]){if(u.team!=='enemy'||!isSettlerType(u.type)||u.hp<=0)continue;if(u.colonyTarget){const t=tileAt(u.colonyTarget.q,u.colonyTarget.r);if(!t||cityAt(t.q,t.r)){u.colonyTarget=null;u.route=[];}}
      if(!u.colonyTarget){const t=findEnemyExpansionSite(u);if(t){u.colonyTarget={q:t.q,r:t.r};setUnitRoute(u,t.q,t.r,false);state.enemyAI.plan=`${u.name||u.def.name} 前往 ${t.q},${t.r}`;}}
      if(u.colonyTarget&&u.q===u.colonyTarget.q&&u.r===u.colonyTarget.r&&!u.route.length)foundEnemyCity(u);}}

  // ===== 波次、目标选择与困难模式反制 =====
  function enemyStrategicTarget(unit){const targets=allTargetsFor('enemy');if(!targets.length)return null;const capital=state.cities.find(c=>c.team==='player'&&c.capital&&c.hp>0);targets.sort((a,b)=>{const score=t=>{let s=hexDistance(unit,t);if(unit.type==='enemySiege'&&t.kind==='city')s-=6;if(unit.type==='raider'&&t.kind==='improvement')s-=5;if((unit.type==='enemyDrone'||unit.type==='enemyBuggy')&&t.kind==='unit'&&!t.obj.def?.armor)s-=3;if(t.kind==='city'&&t.obj.capital)s-=2;if(difficultyConfig().key==='hard'&&t.kind==='unit'&&t.obj.hp/t.obj.maxHp<.45)s-=3;return s;};return score(a)-score(b);});return targets[0]||(capital?{kind:'city',obj:capital,q:capital.q,r:capital.r,team:'player'}:null);}
  autoAcquire=function(unit){const cfg=difficultyConfig(),baseRange=unit.team==='player'?3:cfg.defenseScan,holdRange=unit.def?.range||1,range=unit.team==='player'&&unit.holdPosition?holdRange:baseRange,targets=allTargetsFor(unit.team).filter(t=>{const d=hexDistance(unit,t);if(d>range)return false;if(unit.team==='player'&&t.kind==='city'&&allTargetsFor(unit.team).some(x=>x.kind==='unit'&&hexDistance(unit,x)<=3))return false;return true;});targets.sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b)||(a.kind==='unit'?-1:1));if(targets[0])setLockedTarget(unit,targets[0],false);else if(unit.team==='enemy'&&unit.aiOrder==='attack'){const t=enemyStrategicTarget(unit);if(t)setLockedTarget(unit,t,false);}};
  function launchEnemyWave(force=false){const ai=state.enemyAI,cfg=difficultyConfig(),available=state.units.filter(u=>u.team==='enemy'&&u.def.combat&&u.hp>0&&u.aiOrder!=='attack');if(!available.length){ai.waveTimer=2.4;ai.plan='等待新部队完工';return false;}const desired=Math.min(cfg.maxUnits,Math.ceil(cfg.waveSize+ai.waveNumber*cfg.waveGrowth)),take=Math.min(available.length,force?Math.max(1,Math.ceil(desired*.55)):desired);if(!force&&take<Math.min(2,desired)&&ai.waveNumber>0){ai.waveTimer=1.4;ai.plan=`集结中 ${take}/${desired}`;return false;}available.sort((a,b)=>(b.elite?1:0)-(a.elite?1:0)||(b.def.range||1)-(a.def.range||1));const group=available.slice(0,take);ai.waveNumber++;for(const u of group){u.aiOrder='attack';u.waveId=ai.waveNumber;const target=enemyStrategicTarget(u);if(target)setLockedTarget(u,target,false);}ai.waveTimer=cfg.waveInterval*(.88+Math.random()*.25)/(1+ai.adaptation*.035);ai.plan=`第 ${ai.waveNumber} 波正在进攻（${group.length} 单位）`;addLog(`🚨 ${enemyFactionLabel()}发动第 ${ai.waveNumber} 波进攻：${group.length} 个单位已锁定目标。`,'danger');toast(`🚨 敌军第 ${ai.waveNumber} 波来袭！规模 ${group.length}`,'danger');gameAudio.sfx('alarm',cfg.key==='hard'?1.25:1);return true;}
  function triggerHardLastStand(){const ai=state.enemyAI,cfg=difficultyConfig(),capital=state.cities.find(c=>c.team==='enemy'&&c.capital&&c.hp>0);if(cfg.key!=='hard'||ai.lastStand||!capital||capital.hp/capital.maxHp>.45)return;ai.lastStand=true;ai.adaptation=Math.max(ai.adaptation,4);ai.resources.production+=180;ai.resources.gold+=120;ai.resources.energy+=90;capital.shield=Math.min(capital.maxShield,capital.shield+420);ai.waveTimer=0;const available=availableEnemyCombatTypes(),type=available[available.length-1]||combatRosterFor(enemyFactionKind())[0];spawnEnemyNearCity(capital,type,true);spawnEnemyNearCity(capital,type,true);ai.plan='濒死总动员：全线反攻';addLog(`☠️ 困难 AI 启动“${enemyFactionLabel()}总动员”：堡垒护盾回充并部署两支精英预备队！`,'danger');toast('☠️ 敌军总动员！困难 AI 进入最后阶段。','danger');gameAudio.sfx('alarm',1.5);}
  function updateEnemyStrategicAI(dt){if(state.tutorialActive||!state.enemyAI)return;const ai=state.enemyAI,cfg=difficultyConfig();ai.thinkTimer-=dt;ai.waveTimer-=dt;triggerHardLastStand();if(ai.thinkTimer<=0){ai.thinkTimer=cfg.key==='hard'?.45:cfg.key==='medium'?.8:1.35;chooseEnemyResearch();for(const c of state.cities)if(c.team==='enemy'&&c.hp>0)decideEnemyProduction(c);const garrison=state.units.filter(u=>u.team==='enemy'&&u.def.combat&&u.hp>0&&u.aiOrder!=='attack').length;if(ai.waveTimer>0&&!ai.lastStand)ai.plan=`集结下一波：${garrison} 单位，${Math.max(0,ai.waveTimer).toFixed(1)}s 后出击`;}
    const garrison=state.units.filter(u=>u.team==='enemy'&&u.def.combat&&u.hp>0&&u.aiOrder!=='attack').length,enemyCities=state.cities.filter(c=>c.team==='enemy'&&c.hp>0).length,cap=Math.max(2,enemyCities*(cfg.key==='hard'?4:3));if(ai.waveNumber>0&&garrison>cap)launchEnemyWave(true);
    if(ai.waveTimer<=0)launchEnemyWave();}

  targetAttack=function(target){if(target.kind==='unit'){let a=target.obj.def.attack||0;if(target.obj.team==='enemy')a*=difficultyConfig().damage*(target.obj.elite?1.08:1);return a;}if(target.kind==='city'){if(target.team==='player')return 21;const c=target.obj;return difficultyConfig().cityAttack*((c.buildings.includes('bastion')||c.buildings.includes('shieldDome'))?1.2:1)*((c.buildings.includes('warCore')||c.buildings.includes('quantumRelay'))?1.15:1);}return 0;};
  targetArmor=function(target){if(target.kind==='unit'){let a=target.obj.def.armor||0;if(target.obj.team==='enemy')a+=difficultyConfig().armor+(target.obj.elite?2:0)+Math.floor(state.enemyAI.adaptation/3);return a;}if(target.kind==='city'){if(target.team==='player')return 10;return 4+difficultyConfig().cityArmor+((target.obj.buildings.includes('bastion')||target.obj.buildings.includes('shieldDome'))?3:0);}if(target.kind==='improvement')return target.team==='enemy'?3+difficultyConfig().armor*.5:2;return 0;};
  damageMultiplier=function(unit){let m=formationMultiplier(unit);if(unit.team==='player')m*=1.08;else m*=difficultyConfig().damage*(unit.elite?1.10:1)*(state.enemyAI.lastStand?1.08:1);if(unit.overdrive>0)m*=1.45;if(state.completed.has('singularity')&&unit.team==='player')m*=1.2;if(unit.type==='knight'&&unit.chargeReady>0)m*=1.25;if(unit.type==='prism'){const n=prismNetwork(unit).length;if(n>=2)m*=Math.min(2.5,2+(n-2)*.25);if(buildingOwned('prismMatrix'))m*=1.15;}if(unit.type==='enemySiege'&&resolveTarget(unit.target)?.kind==='city')m*=1.28;if(unit.team==='enemy'&&state.cities.some(c=>c.team==='enemy'&&(c.buildings.includes('warCore')||c.buildings.includes('quantumRelay'))))m*=1.1;return m;};
  applyDamage=function(target,amount,attacker=null){amount=Math.max(0,Math.round(amount));let hpDamage=amount;if(target.kind==='city'&&target.obj.shield>0){const absorbed=Math.min(target.obj.shield,hpDamage);target.obj.shield-=absorbed;hpDamage-=absorbed;if(absorbed>0)floating(target.q,target.r,`护盾 -${absorbed}`,'#59dcff',-34);}target.obj.hp-=hpDamage;target.obj.hp=Math.max(0,target.obj.hp);target.obj.flash=1;if(target.kind==='city')target.obj.lastDamaged=state.simTime;if(target.obj.hp<=0)destroyTarget(target,attacker);return hpDamage;};
  performAttack=function(unit,target){if(!target||unit.hp<=0)return;let raw=unit.def.attack*(.9+Math.random()*.2)*damageMultiplier(unit);const tile=tileAt(target.q,target.r);if(target.kind==='unit'&&(tile?.terrain==='forest'||tile?.terrain==='hills'))raw*=.9;const damage=Math.max(1,Math.round(raw-targetArmor(target)*.72)),counterBase=targetAttack(target),dist=hexDistance(unit,target),canCounter=counterBase>0&&dist<=targetRange(target);let counter=canCounter?Math.max(0,Math.round(counterBase*(unit.def.range>1?.26:.42)*(0.88+Math.random()*.2)-(unit.def.armor||0)*.35)):0;if(unit.team==='player')counter=Math.round(counter*.78);if(state.tutorialActive&&unit.team==='player')counter=0;attackVisual(unit,target);const hpDamage=applyDamage(target,damage,unit);floating(target.q,target.r,`-${hpDamage}`,'#ff7a88',-27);const attackerTarget={kind:'unit',obj:unit,q:unit.q,r:unit.r,team:unit.team},selfDamage=unit.hp>0?applyDamage(attackerTarget,counter,target.obj):0;floating(unit.q,unit.r,`-${selfDamage}`,'#ffd166',-39);splashAttack(unit,target,damage);unit.chargeReady=0;unit.combatGlow=1;state.score+=unit.team==='player'?Math.min(10,Math.round(hpDamage/8)):0;if(unit.type==='prism'||unit.type==='quantumWalker')gameAudio.sfx('laser',.75);else if(unit.type==='kirov'||unit.type==='enemySiege'||unit.type==='enemyTitan')gameAudio.sfx('bomb',unit.type==='enemyTitan'?1.1:.8);else if((unit.def.range||1)>1)gameAudio.sfx('shot',.65);else gameAudio.sfx('melee',.55);};
  updateCombatUnit=function(unit,dt){
    if(!unit.def.combat||unit.hp<=0)return;
    let target=resolveTarget(unit.target);
    if(!target){
      unit.target=null;unit.manualTarget=false;if(hasManualOverride(unit))return;unit.acquireTimer=(unit.acquireTimer||0)-dt;
      if(unit.acquireTimer<=0){unit.acquireTimer=unit.team==='player'?.28:(difficultyConfig().key==='hard'?.32:.58);autoAcquire(unit);target=resolveTarget(unit.target);}
    }
    if(!target)return;
    const dist=hexDistance(unit,target),range=unit.def.range||1;
    let interval=(unit.def.interval||1)*(unit.overdrive>0?.72:1)*(unit.disrupted>0?1.35:1);
    if(unit.team==='enemy')interval*=difficultyConfig().attackInterval;
    if(!unit.manualTarget&&unit.team==='player'&&dist>9){unit.target=null;unit.route=[];return;}
    if(dist<=range){
      unit.route=[];unit.moveProgress=0;unit.attackTimer+=dt;unit.combatGlow=1;unit.beamTick=(unit.beamTick||0)-dt;
      if(unit.beamTick<=0){unit.beamTick=.11;const a=unitDrawPos(unit),b=targetPosition(target);if(unit.type==='prism')beamEffect(a,b,'rgba(113,215,255,.45)',.12,1);else if(unit.def.range>1)state.effects.push({type:'spark',x:lerp(a.x,b.x,Math.random()),y:lerp(a.y,b.y,Math.random()),color:unit.team==='player'?'#ffd166':'#ff6d7e',life:.16,max:.16});}
      while(unit.attackTimer>=interval&&unit.hp>0&&resolveTarget(unit.target)){unit.attackTimer-=interval;performAttack(unit,resolveTarget(unit.target));}
    }else{
      if(unit.team==='player'&&unit.holdPosition){unit.target=null;unit.route=[];return;}
      unit.attackTimer=Math.min(unit.attackTimer,interval*.65);unit.repathTimer=(unit.repathTimer||0)-dt;
      const cadence=unit.team==='player'?.32:(difficultyConfig().key==='hard'?.3:.55),end=unit.route[unit.route.length-1];
      if(!unit.route.length){unit.repathTimer=cadence;setUnitRoute(unit,target.q,target.r,false);}
      else if(unit.repathTimer<=0){
        unit.repathTimer=cadence;
        // 只有目标已经离开原路线终点的有效射程时才重算。保留相同首步的移动进度，避免“不断重寻路而原地踏步”。
        const targetMoved=!end||hexDistance(end,target)>Math.max(0,range-1);
        if(targetMoved){
          const oldFirst=unit.route[0],oldProgress=unit.moveProgress,path=findPath(unit,{q:unit.q,r:unit.r},{q:target.q,r:target.r});
          if(path.length){const sameFirst=oldFirst&&path[0]&&oldFirst.q===path[0].q&&oldFirst.r===path[0].r;unit.route=path;unit.moveProgress=sameFirst?oldProgress:0;}
        }
      }
    }
  };
  updateUnitSystems=function(dt){for(const u of [...state.units]){u.overdrive=Math.max(0,u.overdrive-dt);u.disrupted=Math.max(0,u.disrupted-dt);u.chargeReady=Math.max(0,(u.chargeReady||0)-dt);u.combatGlow=Math.max(0,u.combatGlow-dt*1.6);if(state.tutorialActive&&u.team==='enemy')continue;updateCombatUnit(u,dt);updateMovement(u,dt);}};
  simStep=function(dt){if(!state.started||state.paused||state.gameOver)return;state.simTime+=dt;state.pulseTimer+=dt;state.singularityCooldown=Math.max(0,(state.singularityCooldown||0)-dt);while(state.pulseTimer>=1){state.pulseTimer-=1;resourcePulse();}updateResearch(dt);updateEnemyResearch(dt);updateCities(dt);updateWorkers(dt);updateEnemyWorkers(dt);updateEnemySettlers(dt);updateUnitSystems(dt);updateEnemyStrategicAI(dt);cleanupDead();};

  // ===== 信息面板：直接展示敌方发展证据 =====
  renderCitySelection=function(c){if(c.team==='player'&&!c.allyAI)return ORIGINAL.renderCitySelection(c);if(c.allyAI){const y=allyCityYield(c),ar=state.allyAI?.resources||{};let html=`<div class="card"><div class="hero"><div class="heroIcon">🤝</div><div><h2>${c.name}</h2><p>盟友 AI 城市，使用自己的资源生产和发展，不会消耗你的顶部资源。</p>${healthBar(c.hp,c.maxHp)}</div></div><div class="badges">${badge('盟友 AI','good')}</div><div class="stats">${stat('人口',c.population)}${stat('队列',c.queue.length?`${c.queue.length} 项`:'空')}${stat('基础产出',yieldText(y))}${stat('坐标',`${c.q}, ${c.r}`)}</div><div class="sub">盟友资源 <span>${RESOURCE_KEYS.map(k=>`${RESOURCE_META[k].icon}${fmt(ar[k]||0)}`).join(' ')}</span></div><div class="queue">`;if(!c.queue.length)html+='<div class="empty">盟友队列空闲，AI 会自己安排项目。</div>';c.queue.forEach((item,i)=>{const d=productDef(item.id),pct=item.progress/item.time*100;html+=`<div class="queueItem"><div class="qIcon">${d.icon}</div><div><b>${i===0?'▶ ':''}${d.name}</b><small>${i===0?`${Math.max(0,item.time-item.progress).toFixed(1)} 秒后完成`:'等待前项完成'} · 消耗盟友资源</small><div class="progress"><div class="fill" style="width:${i===0?pct:0}%"></div></div></div></div>`;});html+=`</div></div>`;return html;}const cfg=difficultyConfig(),icon=c.capital?'🏰':'🏯',y=enemyCityYield(c),label=factionLabelForObject(c);let tags=badge(c.capital?`${label}首都`:`${label}前哨`,'danger');for(const b of c.buildings){const d=genericBuildingDef(b);if(d)tags+=badge(`${d.icon} ${d.name}`,'danger');}if(c.shield>0)tags+=badge(`🫧 护盾 ${Math.ceil(c.shield)}/${c.maxShield}`,'cyan');let html=`<div class="card"><div class="hero"><div class="heroIcon">${icon}</div><div><h2>${c.name}</h2><p>这不是定时刷兵点：它拥有真实资源收入、科技、建筑与生产队列，并受当前 ${cfg.icon}${cfg.label} 难度加成。</p>${healthBar(c.hp,c.maxHp)}${c.maxShield?healthBar(c.shield,c.maxShield,'linear-gradient(90deg,#ff6d7e,#c997ff)'):''}</div></div><div class="badges">${tags}</div><div class="stats">${stat('人口',c.population)}${stat('生产队列',c.queue.length?`${c.queue.length} 项`:'空')}${stat('基础产出',yieldText(y))}${stat('坐标',`${c.q}, ${c.r}`)}</div><div class="sub">敌方生产情报 <span>${state.enemyAI.plan}</span></div><div class="queue">`;if(!c.queue.length)html+='<div class="empty">当前队列空闲，AI 会在下一次决策时安排项目。</div>';c.queue.forEach((item,i)=>{const d=productDef(item.id),pct=item.progress/item.time*100;html+=`<div class="queueItem"><div class="qIcon">${d.icon}</div><div><b>${i===0?'▶ ':''}${d.name}</b><small>${i===0?`${Math.max(0,(item.time-item.progress)/Math.max(.1,cfg.productionSpeed)).toFixed(1)} 秒左右完成`:'等待前项'} · ${costText(item.cost)}</small><div class="progress"><div class="fill" style="width:${i===0?pct:0}%;background:linear-gradient(90deg,#ff6d7e,#c997ff)"></div></div></div></div>`;});html+=`</div><div class="sub">攻击提示 <span>优先摧毁经济与生产</span></div><p class="desc">先破坏附近敌方设施和工程单位可减缓敌军资源；攻城部队会优先轰击城市，机动部队会追杀后排。</p></div>`;return html;};
  renderTileSelection=function(t){if(t.improvement?.team!=='enemy')return ORIGINAL.renderTileSelection(t);const terrain=TERRAIN[t.terrain],res=t.resource?RESOURCE_DEFS[t.resource]:null,imp=IMPROVEMENTS[t.improvement.type],color=improvementColor(t.improvement),y=tileYieldForTeam(t,'enemy'),label=factionLabelForObject(t.improvement);return `<div class="card"><div class="hero"><div class="heroIcon">${imp.icon}</div><div><h2>敌方 ${imp.name}</h2><p>${label}的资源设施。它真实参与敌方每秒经济结算，可由作战单位锁定并摧毁。</p>${healthBar(t.improvement.hp,t.improvement.maxHp)}</div></div><div class="badges">${badge(color.badge||'敌方设施','danger')}${badge(`${terrain.icon} ${terrain.name}`,'cyan')}${res?badge(`${res.icon} ${res.name}`,'warn'):''}</div><div class="sub">敌方每战略脉冲贡献 <span>${yieldText(y)}</span></div><div class="yields">${RESOURCE_KEYS.map(k=>`<div class="yield">${RESOURCE_META[k].icon} ${RESOURCE_META[k].name} <b style="color:${color.health}">+${y[k]||0}</b></div>`).join('')}</div><p class="desc">选择己方作战单位后，左键此设施即可锁定并追击；不能用面板直接拆除敌方设施。</p><div class="actions"><button class="action" data-action="center-selection">🎯 镜头居中</button></div></div>`;};
  renderGlobal=function(){const ours=state.units.filter(u=>u.team==='player'&&u.hp>0).length,enemies=state.units.filter(u=>u.team==='enemy'&&u.hp>0).length,cities=state.cities.filter(c=>c.team==='player'&&c.hp>0).length,enemyCities=state.cities.filter(c=>c.team==='enemy'&&c.hp>0).length,ai=state.enemyAI,cfg=difficultyConfig(),enemyImps=enemyImprovementCount(),tech=ai.research?techById(ai.research.id):null,pct=tech?clamp(ai.research.progress/ai.research.time*100,0,100):0,label=enemyFactionLabel();const er=RESOURCE_KEYS.map(k=>`<i>${RESOURCE_META[k].icon}${fmt(ai.resources[k])} <span style="color:#b5848c">(+${fmt(ai.lastYield[k]||0)})</span></i>`).join('');$('global').innerHTML=`<div class="row"><b>🌌 文明总览</b><span class="small muted">评分 ${fmt(state.score)}</span></div><div class="globalGrid" style="margin-top:8px"><div><b>${ours}</b><span>己方单位</span></div><div><b>${enemies}</b><span>敌军单位</span></div><div><b>${cities}</b><span>己方城市</span></div><div><b>${state.completed.size}/${TECHS.length}</b><span>己方科技</span></div><div><b>${state.speed.toFixed(1)}×</b><span>模拟倍率</span></div><div><b>${ERAS[state.era].icon}</b><span>${ERAS[state.era].name}</span></div></div><div class="enemyIntel"><div class="enemyIntelHead"><b>${cfg.icon} ${label} AI · ${cfg.label}</b><span>适应 ${ai.adaptation}/${cfg.maxAdapt}${ai.lastStand?' · 总动员':''}</span></div><div class="enemyPlan">📍 当前计划：${ai.plan}<span class="enemyWaveBadge">第 ${ai.waveNumber} 波</span></div><div class="globalGrid"><div><b>${enemyCities}</b><span>敌方城市</span></div><div><b>${enemyImps}</b><span>资源设施</span></div><div><b>${ai.completed.size}/${TECHS.length}</b><span>敌方科技</span></div></div><div class="enemyResourceRow">${er}</div><div class="enemyResearch">${tech?`${tech.icon} 正在研发：${tech.name} · ${Math.max(0,tech.time-ai.research.progress).toFixed(1)} 基础秒`:'📭 研发槽等待科研资源'}<div class="progress"><div class="fill" style="width:${pct}%;background:linear-gradient(90deg,#ff6d7e,#c997ff)"></div></div></div><div class="difficultyLegend"><span class="${cfg.key==='easy'?'active':''}">🌱 简单</span><span class="${cfg.key==='medium'?'active':''}">⚔️ 中等</span><span class="${cfg.key==='hard'?'active':''}">☠️ 困难</span></div></div><p class="desc"><b style="color:var(--cyan)">创新系统：</b>敌军不再只定时刷兵，而会通过城市与设施获得资源、研发科技、安排生产、派工程单位开发、建造新城并按波次进攻。</p>`;};
  tooltipHTML=function(hit){if(hit?.kind==='unit'&&hit.obj.team==='enemy'){const u=hit.obj,order=u.aiOrder==='attack'?`第 ${u.waveId||'?'} 波进攻`:isWorkerType(u.type)?'自动开发资源':isSettlerType(u.type)?'寻找扩张地点':'驻防集结';return `<b>${u.def.icon} ${u.name||u.def.name}${u.elite?' ⭐':''}</b><br><span>敌方 · ${u.def.role} · 生命 ${Math.ceil(u.hp)}/${u.maxHp}<br>AI 命令：${order}${u.target?` · 锁定 ${targetName(u.target)}`:''}</span>`;}if(hit?.kind==='improvement'&&hit.obj.improvement?.team==='enemy'){const t=hit.obj,imp=IMPROVEMENTS[t.improvement.type];return `<b>${imp.icon} 敌方 ${imp.name}</b><br><span>每脉冲 ${yieldText(tileYieldForTeam(t,'enemy'))}<br>可被己方战斗单位锁定摧毁</span>`;}return ORIGINAL.tooltipHTML(hit);};
  function renderSettings(){const cfg=difficultyConfig(),sel=$('difficultySelect'),hint=$('difficultyHint'),desc=$('introDifficultyDesc'),mapSel=$('mapModeSelect'),playerFactionSel=$('playerFactionSelect'),sideSel=$('playerSideSelect'),leftSel=$('leftAISlots'),rightSel=$('rightAISlots'),workerSel=$('workerDefaultAI'),settlerSel=$('settlerAutoFound'),skirmish=$('skirmishHint');if(sel)sel.value=cfg.key;if(hint)hint.textContent=`${cfg.icon}${cfg.label}：${cfg.desc}`;if(desc)desc.textContent=`${cfg.label}：${cfg.desc}`;if(mapSel)mapSel.value=selectedMapMode;if(playerFactionSel)playerFactionSel.value=selectedPlayerFaction;if(sideSel)sideSel.value=selectedPlayerSide;if(leftSel)leftSel.value=String(selectedLeftAI);if(rightSel)rightSel.value=String(selectedRightAI);if(workerSel)workerSel.value=selectedWorkerDefaultAI?'on':'off';if(settlerSel)settlerSel.value=selectedSettlerAutoFound?'on':'off';if(skirmish)skirmish.textContent=`${selectedMapMode==='random'?'随机地图':'默认地图'} · ${factionLabel()} · ${sideLabel()} · ${1+selectedLeftAI}v${selectedRightAI}${selectedMapMode==='random'&&state?.mapSize?` · ${state.mapSize.width}×${state.mapSize.height}`:''}`;document.querySelectorAll('[data-difficulty]').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===cfg.key));updateAudioUI();}
  renderPanels=function(){ORIGINAL.renderPanels();renderSettings();};

  // ===== 画面：敌军设施产出、生产队列、精英标记与攻击路线 =====
  function improvementColor(improvement){
    if(!improvement)return FACTION_COLORS.blue;
    if(improvement.faction)return factionColor(improvement);
    if(improvement.team==='enemy')return FACTION_COLORS.red;
    if(improvement.owner==='ally')return FACTION_COLORS.green;
    return FACTION_COLORS[teamFactions(currentPlayerFaction())[0]];
  }
  drawResourcesAndImprovements=function(){
    for(const t of tiles.values()){
      if(!t.resource&&!t.improvement&&!t.ruin)continue;const p=axialToWorld(t.q,t.r);
      if(t.ruin){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.simTime*.2);ctx.shadowBlur=14;ctx.shadowColor='#c997ff';ctx.font='21px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✨',0,0);ctx.restore();}
      if(t.resource){ctx.beginPath();ctx.arc(p.x-13,p.y-10,12,0,Math.PI*2);ctx.fillStyle='rgba(3,10,18,.72)';ctx.fill();ctx.strokeStyle='rgba(255,209,102,.55)';ctx.lineWidth=1/state.camera.zoom;ctx.stroke();ctx.font='16px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(RESOURCE_DEFS[t.resource].icon,p.x-13,p.y-10);}
      if(t.improvement){
        const imp=IMPROVEMENTS[t.improvement.type],color=improvementColor(t.improvement);
        ctx.save();ctx.shadowBlur=state.selection?.q===t.q&&state.selection?.r===t.r?14:5;ctx.shadowColor=color.glow;ctx.beginPath();ctx.arc(p.x+5,p.y+5,17,0,Math.PI*2);ctx.fillStyle='rgba(6,19,28,.9)';ctx.fill();ctx.lineWidth=2/state.camera.zoom;ctx.strokeStyle=color.stroke;ctx.stroke();ctx.shadowBlur=0;ctx.font='21px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(imp.icon,p.x+5,p.y+5);ctx.restore();
        const y=tileYieldForTeam(t,t.improvement.owner||t.improvement.team);ctx.font='bold 8px system-ui';ctx.textAlign='center';ctx.fillStyle=color.soft;ctx.fillText(yieldText(y),p.x,p.y+29);
        if(t.improvement.hp<t.improvement.maxHp)drawWorldHealth(p.x-20,p.y+33,40,4,t.improvement.hp/t.improvement.maxHp,color.health);
      }
    }
  };
  drawCities=function(){
    for(const c of state.cities){
      if(c.hp<=0)continue;const p=axialToWorld(c.q,c.r),player=c.team==='player',selected=state.selection?.kind==='city'&&state.selection.id===c.id,color=factionColor(c);
      ctx.save();ctx.shadowBlur=selected?24:10;ctx.shadowColor=color.glow;ctx.beginPath();ctx.arc(p.x,p.y,31,0,Math.PI*2);ctx.fillStyle=color.fill;ctx.fill();ctx.lineWidth=(selected?4:2.5)/state.camera.zoom;ctx.strokeStyle=color.stroke;ctx.stroke();
      ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?27:34,xx=p.x+Math.cos(a)*r,yy=p.y+Math.sin(a)*r;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.closePath();ctx.lineWidth=1.2/state.camera.zoom;ctx.strokeStyle=color.ring;ctx.stroke();ctx.shadowBlur=0;
      if(c.flash>0){ctx.beginPath();ctx.arc(p.x,p.y,36+c.flash*7,0,Math.PI*2);ctx.strokeStyle=`rgba(255,255,255,${c.flash*.7})`;ctx.lineWidth=3/state.camera.zoom;ctx.stroke();}
      ctx.font=`${c.capital?31:27}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(player?(c.capital?'🏠':'🏙️'):(c.capital?'🏰':'🏯'),p.x,p.y-2);ctx.restore();
      if(c.shield>0){ctx.beginPath();ctx.arc(p.x,p.y,39,0,Math.PI*2);ctx.strokeStyle=rgba(color.glow,.65);ctx.lineWidth=2.2/state.camera.zoom;ctx.setLineDash([5,4]);ctx.lineDashOffset=-state.simTime*12;ctx.stroke();ctx.setLineDash([]);}
      drawWorldHealth(p.x-30,p.y+38,60,6,c.hp/c.maxHp,color.health);
      ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle=color.text;ctx.fillText(c.name,p.x,p.y-38);
      if(c.queue.length){const item=c.queue[0],d=productDef(item.id);ctx.font='13px system-ui';ctx.fillStyle=color.text;ctx.fillText(`${d.icon} ${Math.max(0,item.time-item.progress).toFixed(1)}s`,p.x,p.y+57);}
    }
  };
  drawTargetLocks=function(){for(const u of state.units){const t=resolveTarget(u.target);if(!t)continue;const enemyLine=u.team==='enemy';if(enemyLine&&!state.showIntel&&state.selection?.id!==u.id)continue;const a=unitDrawPos(u),b=targetPosition(t),selected=state.selection?.id===u.id;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.setLineDash(enemyLine?[7,8]:[4,7]);ctx.lineDashOffset=(enemyLine?-1:1)*state.simTime*13;ctx.lineWidth=(selected?2.2:1.25)/state.camera.zoom;ctx.strokeStyle=enemyLine?(selected?'rgba(255,93,111,.95)':'rgba(255,93,111,.45)'):(selected?'rgba(255,109,126,.9)':'rgba(255,109,126,.42)');ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.arc(b.x,b.y,22+Math.sin(state.simTime*7)*2,0,Math.PI*2);ctx.strokeStyle=enemyLine?'#ff5d6f':selected?'#ff6d7e':'rgba(255,109,126,.55)';ctx.lineWidth=1.7/state.camera.zoom;ctx.stroke();ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillStyle=enemyLine?'#ff9eaa':'#ffb2bb';ctx.fillText(enemyLine?'⚠️':'🎯',b.x,b.y-28);}};
  drawUnits=function(){
    for(const u of state.units){
      if(u.hp<=0)continue;let p=unitDrawPos(u),off=unitStackOffset(u);p={x:p.x+off.x,y:p.y+off.y};const selected=state.selection?.kind==='unit'&&state.selection.id===u.id,r=u.type==='kirov'||u.type==='enemyTitan'?23:18,color=factionColor(u);
      ctx.save();ctx.shadowBlur=selected?23:u.combatGlow>0?15:u.elite?13:6;ctx.shadowColor=u.elite?'#ffd166':color.glow;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=color.fill;ctx.fill();ctx.lineWidth=(selected?3.4:u.elite?2.8:2)/state.camera.zoom;ctx.strokeStyle=u.elite?'#ffd166':color.stroke;ctx.stroke();ctx.shadowBlur=0;
      if(u.overdrive>0){ctx.beginPath();ctx.arc(p.x,p.y,r+5+Math.sin(state.simTime*10)*2,0,Math.PI*2);ctx.strokeStyle='rgba(255,209,102,.8)';ctx.lineWidth=2/state.camera.zoom;ctx.stroke();}
      ctx.font=`${u.type==='kirov'||u.type==='enemyTitan'?27:22}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(u.def.icon,p.x,p.y);ctx.restore();
      if((u.type==='worker'||u.type==='enemyWorker')&&u.aiWorker){ctx.font='10px system-ui';ctx.fillText('🤖',p.x+r-2,p.y-r+2);}if(u.target){ctx.font='9px system-ui';ctx.fillText(u.team==='enemy'?'⚠️':'🎯',p.x-r+1,p.y-r+1);}if(u.elite){ctx.font='10px system-ui';ctx.fillText('⭐',p.x+r-1,p.y-r+1);}
      if(u.def.combat&&u.combatGlow>0){let interval=(u.def.interval||1)*(u.overdrive>0?.72:1);if(u.team==='enemy')interval*=difficultyConfig().attackInterval;const pct=clamp(u.attackTimer/interval,0,1);ctx.beginPath();ctx.arc(p.x,p.y,r+7,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);ctx.strokeStyle=u.team==='player'?'#ffd166':color.stroke;ctx.lineWidth=2.5/state.camera.zoom;ctx.stroke();}
      const show=state.showIntel||selected||u.combatGlow>0||u.hp<u.maxHp;if(show){drawWorldHealth(p.x-23,p.y+r+6,46,5,u.hp/u.maxHp,color.health);ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle=color.text;ctx.fillText((u.elite?'⭐':'')+u.def.name,p.x,p.y-r-7);}
      if(u.work?.building){const pct=u.work.progress/u.work.time;ctx.beginPath();ctx.arc(p.x,p.y,r+10,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);ctx.strokeStyle=color.health;ctx.lineWidth=3/state.camera.zoom;ctx.stroke();}
    }
  };
  drawMinimap=function(){
    const w=mini._cssW||190,h=mini._cssH||128,dpr=mini._dpr||1;mctx.setTransform(dpr,0,0,dpr,0,0);mctx.clearRect(0,0,w,h);mctx.fillStyle='#04101b';mctx.fillRect(0,0,w,h);
    const b=mapBounds(),pad=7,s=Math.min((w-pad*2)/(b.maxX-b.minX),(h-pad*2)/(b.maxY-b.minY)),mx=x=>pad+(x-b.minX)*s,my=y=>pad+(y-b.minY)*s;
    for(const t of tiles.values()){const p=axialToWorld(t.q,t.r);mctx.fillStyle=TERRAIN[t.terrain].fill;mctx.beginPath();mctx.arc(mx(p.x),my(p.y),Math.max(1.3,HEX*s*.45),0,Math.PI*2);mctx.fill();}
    for(const t of tiles.values())if(t.improvement){const p=axialToWorld(t.q,t.r),color=improvementColor(t.improvement);mctx.fillStyle=color.mini;mctx.fillRect(mx(p.x)-1.5,my(p.y)-1.5,3,3);}
    for(const c of state.cities)if(c.hp>0){const p=axialToWorld(c.q,c.r),color=factionColor(c);mctx.fillStyle=color.mini;mctx.fillRect(mx(p.x)-3,my(p.y)-3,6,6);}
    for(const u of state.units)if(u.hp>0){const p=unitDrawPos(u),color=factionColor(u);mctx.fillStyle=color.unitMini;mctx.beginPath();mctx.arc(mx(p.x),my(p.y),1.7,0,Math.PI*2);mctx.fill();}
    const tl=screenToWorld(0,0),br=screenToWorld(state.screen.w,state.screen.h);mctx.strokeStyle='rgba(255,255,255,.75)';mctx.lineWidth=1;mctx.strokeRect(mx(tl.x),my(tl.y),Math.max(2,(br.x-tl.x)*s),Math.max(2,(br.y-tl.y)*s));mini._mapTransform={b,pad,s,mx,my};
  };

  // ===== 声音挂钩 =====
  startResearch=function(id,fromAI=false){const ok=ORIGINAL.startResearch(id,fromAI);if(ok)gameAudio.sfx('research');return ok;};
  finishResearch=function(){ORIGINAL.finishResearch();gameAudio.sfx('researchDone',1.1);};
  queueProduct=function(city,id,count=1){
    const before=city?.queue.length||0;
    let result=0;
    if(city?.team==='player'&&UNIT_DEFS[id]?.enemy){
      if(!playerCanProduceUnit(id)||!hasProductUnlock(id))return;
      const def=productDef(id);if(!def)return;const target=Math.max(1,Math.floor(Number(count)||1));let added=0;
      for(let i=0;i<target;i++){const cost=deepCost(def.cost);if(!pay(cost)){if(!added)toast('资源不足，无法加入队列。','warn');break;}city.queue.push({qid:uid('q'),id,progress:0,time:def.time,cost});added++;}
      if(added){addLog(`🏠 ${city.name} 将「${def.name}」加入建造队列${added>1?` ×${added}`:''}。`);toast(`已排入队列：${def.icon} ${def.name}${added>1?` ×${added}`:''}`);renderPanels();}
      result=added;
    }else result=ORIGINAL.queueProduct(city,id,count)||0;
    if((city?.queue.length||0)>before)gameAudio.sfx('build');
    return result;
  };
  completeProduct=function(city,item){
    const before=state.units.length,id=item.id,def=productDef(id);
    if(city?.team==='player'&&UNIT_DEFS[id]?.enemy){
      const t=findSpawnTile(city,def),u=createUnit(id,'player',t.q,t.r,{faction:factionKey(city),aiOrder:''});state.units.push(u);burst(t.q,t.r,factionColor(u).glow,12,.75);toast(`${def.icon} ${def.name} 已完成部署！`,'good');addLog(`${def.icon} ${city.name} 完成了 ${def.name}。`,'good');state.score+=45;
    }else ORIGINAL.completeProduct(city,item);
    const made=state.units.slice(before).find(u=>u.team==='player');if(made){made.faction=factionKey(city);if(city.allyAI){made.allyAI=true;if(made.type==='worker'||made.type==='enemyWorker')made.aiWorker=true;}if((made.type==='worker'||made.type==='enemyWorker')&&!made.allyAI){made.aiWorker=selectedWorkerDefaultAI;if(made.aiWorker&&!made.work)chooseWorkerTask(made);}if(made.def.combat&&city.rallyPoint)setUnitRoute(made,city.rallyPoint.q,city.rallyPoint.r,false);}gameAudio.sfx(UNIT_DEFS[item.id]?'complete':'build',1.05);
  };
  finishWorkerBuild=function(unit){const job=unit?.work?{...unit.work}:null;ORIGINAL.finishWorkerBuild(unit);if(job){const t=tileAt(job.q,job.r);if(t?.improvement)t.improvement.faction=factionKey(unit);}gameAudio.sfx('build',.9);};
  foundCity=function(unit){const before=state.cities.length;ORIGINAL.foundCity(unit);const c=state.cities.length>before?state.cities[state.cities.length-1]:null;if(c)c.faction=factionKey(unit);};
  setUnitRoute=function(unit,q,r,announce=false){const ok=ORIGINAL.setUnitRoute(unit,q,r,announce);if(ok&&announce&&unit.team==='player'){unit.manualMove=true;unit.manualOverrideUntil=(state.simTime||0)+8;if(unit.type==='worker'||unit.type==='enemyWorker'){unit.work=null;unit.aiWorker=false;}gameAudio.sfx('move');}return ok;};
  updateMovement=function(unit,dt){const hadRoute=unit.route?.length>0;ORIGINAL.updateMovement(unit,dt);if(selectedSettlerAutoFound&&unit.team==='player'&&(unit.type==='settler'||unit.type==='enemySettler')&&hadRoute&&!unit.route.length&&unit.hp>0){const t=tileAt(unit.q,unit.r);if(t&&isLand(t)&&!cityAt(t.q,t.r)&&!state.cities.some(c=>c.hp>0&&hexDistance(c,t)<4))foundCity(unit);}};
  setLockedTarget=function(unit,target,manual=true){ORIGINAL.setLockedTarget(unit,target,manual);if(manual&&unit?.team==='player'){unit.manualMove=false;unit.manualOverrideUntil=0;gameAudio.sfx('lock');}};
  destroyTarget=function(target,attacker){ORIGINAL.destroyTarget(target,attacker);gameAudio.sfx(target.kind==='city'||target.obj?.def?.boss?'bomb':'shot',target.kind==='city'?1.25:.65);};
  endGame=function(win){ORIGINAL.endGame(win);gameAudio.sfx(win?'win':'loss',1.25);};
  clearHalfEnemies=function(){const before=state.units.filter(u=>u.team==='enemy').length;ORIGINAL.clearHalfEnemies();if(state.units.filter(u=>u.team==='enemy').length<before)gameAudio.sfx('bomb',1.15);};

  // ===== 难度选择、重开、启动与 WASD =====
  function restartWithSelectedConfig(started=false){const oldSpeed=state?.speed||1;state=freshState(started,selectedDifficulty,selectedMapMode,selectedLeftAI,selectedRightAI,selectedPlayerSide,selectedPlayerFaction);state.speed=oldSpeed;resizeCanvases();state.lastYield=calculateYield();state.logs=[];addLog('🏠 曙光城开始自然产生基础资源。','good');addLog(`${selectedMapMode==='random'?'🎲 随机地图':'⬡ 默认地图'} · ${factionLabel()} · ${sideLabel()} · ${1+selectedLeftAI}v${selectedRightAI} 对战配置已载入。`,'good');addLog(`${difficultyConfig().icon} 敌方文明按「${difficultyConfig().label}」规则开始独立发展。`,'warn');clampCamera();renderPanels();renderSettings();}
  function setDifficulty(key,announce=true){if(!AI_DIFFICULTIES[key])return;const old=state?.difficulty;selectedDifficulty=key;try{localStorage.setItem('starfireDifficulty',key);}catch{}if(state){if(!state.started)restartWithSelectedConfig(false);else{state.enemyAI.difficulty=key;state.enemyAI.waveTimer=Math.min(state.enemyAI.waveTimer,difficultyConfig(key).waveInterval);state.difficulty=key;applyDifficultyScales(state,false);}}renderSettings();renderPanels();if(announce&&old!==key){const cfg=difficultyConfig(key);toast(`${cfg.icon} 敌军 AI 已切换为「${cfg.label}」，立即生效。`,key==='hard'?'danger':key==='easy'?'good':'warn');addLog(`🎚️ 敌军 AI 难度切换为 ${cfg.label}。`,key==='hard'?'danger':'warn');gameAudio.sfx(key==='hard'?'alarm':'confirm');}}
  function setMapMode(mode,announce=true){if(mode!=='default'&&mode!=='random')return;const old=selectedMapMode;selectedMapMode=mode;try{localStorage.setItem('starfireMapMode',mode);}catch{}if(!state.started)restartWithSelectedConfig(false);renderSettings();if(announce&&old!==mode)toast(mode==='random'?'🎲 已选择随机地图。下一局会重新掷地图面积与地形。':'⬡ 已选择默认地图。','good');}
  function setPlayerFaction(faction,announce=true){faction=normalizePlayerFaction(faction);const old=selectedPlayerFaction;selectedPlayerFaction=faction;try{localStorage.setItem('starfirePlayerFaction',faction);}catch{}if(!state.started)restartWithSelectedConfig(false);renderSettings();if(announce&&old!==faction)toast(`玩家阵营已切换为${factionLabel(faction)}。`,'good');}
  function setPlayerSide(side,announce=true){if(side!=='left'&&side!=='right')return;const old=selectedPlayerSide;selectedPlayerSide=side;try{localStorage.setItem('starfirePlayerSide',side);}catch{}if(!state.started)restartWithSelectedConfig(false);renderSettings();if(announce&&old!==side)toast(`出生位置已切换为${sideLabel(side)}。`,'good');}
  function setSkirmishSlots(side,value,announce=true){const n=Number(value);if(side==='left')selectedLeftAI=clamp(Number.isFinite(n)?n:0,0,2);else selectedRightAI=clamp(Number.isFinite(n)?n:1,1,3);try{localStorage.setItem('starfireLeftAI',String(selectedLeftAI));localStorage.setItem('starfireRightAI',String(selectedRightAI));}catch{}if(!state.started)restartWithSelectedConfig(false);renderSettings();if(announce)toast(`对战配置：${1+selectedLeftAI}v${selectedRightAI}`,'good');}
  function setWorkerDefaultAI(value,announce=true){selectedWorkerDefaultAI=value==='on'||value===true;try{localStorage.setItem('starfireWorkerDefaultAI',selectedWorkerDefaultAI?'1':'0');}catch{}if(state&&!state.started)restartWithSelectedConfig(false);renderSettings();if(announce)toast(selectedWorkerDefaultAI?'新生产工人和开局工人将自动开启 AI。':'新生产工人和开局工人将保持手动模式。','good');}
  function setSettlerAutoFound(value,announce=true){selectedSettlerAutoFound=value==='on'||value===true;try{localStorage.setItem('starfireSettlerAutoFound',selectedSettlerAutoFound?'1':'0');}catch{}renderSettings();if(announce)toast(selectedSettlerAutoFound?'开拓者到达合适地块后会自动建城。':'开拓者将保持手动建城。','good');}
  beginGame=function(withTutorial=false){gameAudio.ensure();ORIGINAL.beginGame(withTutorial);state.enemyAI.waveTimer=difficultyConfig().initialWave;chooseEnemyResearch();renderSettings();gameAudio.sfx('confirm',1.1);addLog(`${difficultyConfig().icon} 敌军 AI：${difficultyConfig().label}，具备经济、科研、生产、扩张与波次进攻。`,'warn');};
  resetGame=function(started=true){if(tutorial.active)closeTutorial(false,true);const oldSpeed=state?.speed||1;state=freshState(started,selectedDifficulty,selectedMapMode,selectedLeftAI,selectedRightAI,selectedPlayerSide,selectedPlayerFaction);state.speed=oldSpeed;resizeCanvases();state.lastYield=calculateYield();state.logs=[];$('end').classList.add('hidden');if(started)$('intro').classList.add('hidden');else $('intro').classList.remove('hidden');renderPanels();clampCamera();renderSettings();if(started){chooseEnemyResearch();gameAudio.sfx('confirm');}addLog('🏠 曙光城开始自然产生基础资源。','good');addLog(`${selectedMapMode==='random'?'🎲 随机地图':'⬡ 默认地图'} · ${factionLabel()} · ${sideLabel()} · ${1+selectedLeftAI}v${selectedRightAI} 对战配置已载入。`,'good');addLog(`${difficultyConfig().icon} 敌方文明按「${difficultyConfig().label}」规则开始独立发展。`,'warn');canvas.focus();};
  updateCamera=function(dt){let dx=0,dy=0;if(state.keys.has('ArrowLeft')||state.keys.has('KeyA'))dx--;if(state.keys.has('ArrowRight')||state.keys.has('KeyD'))dx++;if(state.keys.has('ArrowUp')||state.keys.has('KeyW'))dy--;if(state.keys.has('ArrowDown')||state.keys.has('KeyS'))dy++;if(dx||dy){const len=Math.hypot(dx,dy),speed=480/state.camera.zoom;state.camera.x+=dx/len*speed*dt;state.camera.y+=dy/len*speed*dt;clampCamera();}};

  // ===== 教程补充：WASD、声音与真实敌军 AI =====
  const viewStep=TUTORIAL_STEPS.find(x=>x.check==='view');if(viewStep){viewStep.task='用 WASD/方向键移动视野，滚轮缩放，右键拖动地图，或按住空格查看全军情报。';viewStep.body=`使用 <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> 或 <span class="key">↑</span><span class="key">↓</span><span class="key">←</span><span class="key">→</span> 平移视野；没有选中己方单位时，也可以按住右键拖动地图。鼠标滚轮以指针位置为中心缩放；点击右下角战术雷达可快速跳转。<div class="keys"><span class="key">H</span> 打开上次生产基地 <span class="key">1-9/0</span> 城市生产快捷键 <span class="key">空格</span> 显示名称血条 <span class="key">P</span> 暂停/继续 <span class="key">F1</span> 打开教程</div>`;}
  TUTORIAL_STEPS.splice(TUTORIAL_STEPS.length-1,0,{icon:'⚙️',title:'开局设置与声音',subtitle:'对局开始前在首页定制地图、阵容和难度。',target:'#audioDock',place:'left',task:'调整一次音量或静音开关。',check:'settings',body:`地图模式、对战规模、敌军难度和新工人默认 AI 都在首页 <b>定制对局</b> 里设置，开局前就能决定本局是默认地图、随机地图、1v1 还是最多 3v3。<br><br>进入游戏后，左下角齿轮只负责游戏内设置，例如合成音乐、音效和音量。`,tip:'如果想改地图或 3v3 阵容，重新开始前先回到首页配置。'});
  tutorialTaskDone=function(step=TUTORIAL_STEPS[tutorial.step]){if(step?.check==='settings'){const done=!!tutorial.flags.settingsTouched;if(done){tutorial.flags.completed=tutorial.flags.completed||{};tutorial.flags.completed.settings=true;}return done;}return ORIGINAL.tutorialTaskDone(step);};
  demoTutorialStep=function(){const step=TUTORIAL_STEPS[tutorial.step];if(step?.check==='settings'){tutorial.flags.settingsTouched=true;gameAudio.setVolume(.78);renderSettings();toast('▶ 演示：已调整声音设置；下方敌军情报会实时显示其发展。','good');updateTutorialTask();requestAnimationFrame(placeTutorial);return;}ORIGINAL.demoTutorialStep();};
  const originalEnterTutorialStep=enterTutorialStep;
  enterTutorialStep=function(index){originalEnterTutorialStep(index);const step=TUTORIAL_STEPS[tutorial.step];if(step?.check==='settings'){setTimeout(()=>{window.toggleSettingsPanel?.(true);requestAnimationFrame(()=>{placeTutorial();setTimeout(placeTutorial,80);});},0);}};

  // ===== 事件绑定 =====
  document.addEventListener('pointerdown',()=>gameAudio.ensure(),{capture:true,once:true});
  document.addEventListener('click',e=>{if(e.target.closest('button,.tech,.product'))gameAudio.sfx('click',.7);});
  $('audioDockToggle')?.addEventListener('click',()=>{tutorial.flags.settingsTouched=true;void toggleAudioExplicit();updateTutorialTask();});
  $('audioDockVolume')?.addEventListener('input',e=>{tutorial.flags.settingsTouched=true;setAudioVolumeFromControl(e.target.value,false);updateTutorialTask();});
  $('audioDockVolume')?.addEventListener('change',e=>setAudioVolumeFromControl(e.target.value,true));
  $('difficultySelect').addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setDifficulty(e.target.value,true);updateTutorialTask();});
  $('mapModeSelect')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setMapMode(e.target.value,true);updateTutorialTask();});
  $('playerFactionSelect')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setPlayerFaction(e.target.value,true);updateTutorialTask();});
  $('playerSideSelect')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setPlayerSide(e.target.value,true);updateTutorialTask();});
  $('leftAISlots')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setSkirmishSlots('left',e.target.value,true);updateTutorialTask();});
  $('rightAISlots')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setSkirmishSlots('right',e.target.value,true);updateTutorialTask();});
  $('workerDefaultAI')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setWorkerDefaultAI(e.target.value,true);updateTutorialTask();});
  $('settlerAutoFound')?.addEventListener('change',e=>{tutorial.flags.settingsTouched=true;setSettlerAutoFound(e.target.value,true);updateTutorialTask();});
  document.querySelectorAll('[data-difficulty]').forEach(btn=>btn.addEventListener('click',()=>{tutorial.flags.settingsTouched=true;setDifficulty(btn.dataset.difficulty,true);updateTutorialTask();}));

  // 当前页面已由旧版先初始化一次；用增强版状态无缝替换。
  state=freshState(false,selectedDifficulty,selectedMapMode,selectedLeftAI,selectedRightAI,selectedPlayerSide,selectedPlayerFaction);resizeCanvases();state.lastYield=calculateYield();state.logs=[];addLog('🏠 曙光城开始自然产生基础资源。','good');addLog('⚙️ 首页定制对局可调整地图、阵营、对战和难度。');addLog(`${difficultyConfig().icon} 敌方文明将进行经济、科研、生产、扩张与波次进攻。`,'warn');renderPanels();clampCamera();renderSettings();updateAudioUI('声音待启动');

  window.__STARFIRE_DEBUG__={
    summary:()=>({simTime:state.simTime,difficulty:state.difficulty,gameOver:state.gameOver,playerCityHp:state.cities.find(c=>c.team==='player'&&c.capital)?.hp,enemyCityHp:state.cities.find(c=>c.team==='enemy'&&c.capital)?.hp,enemyResources:{...state.enemyAI.resources},enemyTechs:[...state.enemyAI.completed],enemyResearch:state.enemyAI.research?.id||null,enemyCities:state.cities.filter(c=>c.team==='enemy'&&c.hp>0).length,enemyImprovements:enemyImprovementCount(),enemyUnits:state.units.filter(u=>u.team==='enemy'&&u.hp>0).length,attacking:state.units.filter(u=>u.team==='enemy'&&u.aiOrder==='attack'&&u.hp>0).length,wave:state.enemyAI.waveNumber,plan:state.enemyAI.plan,adaptation:state.enemyAI.adaptation,lastStand:state.enemyAI.lastStand}),
    setDifficulty,setMapMode,setPlayerFaction,setPlayerSide,setSkirmishSlots,setWorkerDefaultAI,setSettlerAutoFound, allyQueueProduct, calculateAllyYield, updateEnemyStrategicAI, enemyCombatTypes:()=>availableEnemyCombatTypes(), factions:()=>JSON.parse(JSON.stringify(FACTION_COLORS)), setSpeed:v=>{state.speed=clamp(Number(v)||1,.1,10);}, fortifyPlayer:()=>{const c=state.cities.find(x=>x.team==='player'&&x.capital);c.maxHp=999999;c.hp=999999;}, audio:()=>({ready:gameAudio.ready,muted:gameAudio.muted,volume:gameAudio.volume,contextState:gameAudio.ctx?.state||'none',toneCount:gameAudio.toneCount,lastError:gameAudio.lastError,controls:{settings:!!$('audioDockVolume')}})
  };

})();

