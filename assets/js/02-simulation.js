"use strict";

// ===== 寻路、经济、科研、生产与工人自动化 =====
function findPath(unit,start,goal){
  if(start.q===goal.q&&start.r===goal.r)return [];
  const startKey=key(start.q,start.r),goalKey=key(goal.q,goal.r),open=[{q:start.q,r:start.r,g:0,f:hexDistance(start,goal)}];
  const came=new Map(),gScore=new Map([[startKey,0]]),closed=new Set();
  let guard=0;
  while(open.length&&guard++<1500){
    let best=0;for(let i=1;i<open.length;i++)if(open[i].f<open[best].f)best=i;
    const cur=open.splice(best,1)[0],ck=key(cur.q,cur.r);if(closed.has(ck))continue;closed.add(ck);
    if(ck===goalKey){
      const path=[];let k=goalKey;while(k!==startKey){const [q,r]=k.split(',').map(Number);path.push({q,r});k=came.get(k);if(!k)return [];}return path.reverse();
    }
    for(const [dq,dr] of DIRS){
      const nq=cur.q+dq,nr=cur.r+dr,nk=key(nq,nr),tile=tileAt(nq,nr);if(!tile||closed.has(nk))continue;
      let step=terrainCost(tile,unit);if(!Number.isFinite(step))continue;
      const occupying=state.units.some(u=>u.hp>0&&u.team===unit.team&&u.id!==unit.id&&u.q===nq&&u.r===nr);if(occupying)step+=.16;
      const tentative=cur.g+step;if(tentative<(gScore.get(nk)??Infinity)){
        came.set(nk,ck);gScore.set(nk,tentative);open.push({q:nq,r:nr,g:tentative,f:tentative+hexDistance({q:nq,r:nr},goal)*.94});
      }
    }
  }
  return [];
}
function setUnitRoute(unit,q,r,announce=false){
  const t=tileAt(q,r);if(!t)return false;
  if(announce&&unit.team==='player')unit.holdPosition=false;
  const path=findPath(unit,{q:unit.q,r:unit.r},{q,r});
  if(!path.length&&!(unit.q===q&&unit.r===r)){if(announce)toast('没有可通行的路线。','warn');return false;}
  unit.route=path;unit.moveProgress=0;unit.repathTimer=.25;
  if(announce&&path.length){addLog(`${unit.def.icon} ${unit.def.name} 已规划 ${path.length} 格路线。`);toast(`路线已规划：${path.length} 格`);}
  return true;
}
function unitDrawPos(unit){
  const a=axialToWorld(unit.q,unit.r),n=unit.route[0];if(!n)return a;const b=axialToWorld(n.q,n.r);return{x:lerp(a.x,b.x,unit.moveProgress),y:lerp(a.y,b.y,unit.moveProgress)};
}
function triggerRuin(unit,tile){
  if(unit.team!=='player'||!tile.ruin)return;tile.ruin=false;state.score+=120;
  const roll=Math.random();
  if(state.research&&roll<.38){state.research.progress=Math.min(state.research.time,state.research.progress+state.research.time*.48);toast('✨ 星火遗迹解析：当前科研推进 48%！','good');addLog('✨ 探索队从遗迹中恢复了失落科研数据。','good');}
  else{
    const reward=roll<.7?{science:24,gold:30}:{production:34,energy:22};for(const[k,v]of Object.entries(reward))state.resources[k]+=v;
    toast(`✨ 遗迹收获：${yieldText(reward)}`,'good');addLog(`✨ ${unit.def.name} 发现星火遗迹，文明获得额外资源。`,'good');
  }
  burst(tile.q,tile.r,'#c997ff',22,1.25);
}
function updateMovement(unit,dt){
  if(unit.hp<=0||unit.work?.building&&unit.q===unit.work.q&&unit.r===unit.work.r)return;
  const next=unit.route[0];if(!next)return;
  const tile=tileAt(next.q,next.r),cost=terrainCost(tile,unit);if(!Number.isFinite(cost)){unit.route=[];unit.moveProgress=0;return;}
  let speed=unit.def.move||1;if(unit.overdrive>0)speed*=1.7;if(unit.disrupted>0)speed*=.55;
  unit.moveProgress+=dt*speed/cost;
  while(unit.moveProgress>=1&&unit.route.length){
    unit.moveProgress-=1;const step=unit.route.shift();unit.q=step.q;unit.r=step.r;triggerRuin(unit,tileAt(unit.q,unit.r));
    if(unit.type==='knight'&&unit.target)unit.chargeReady=1.5;
    if(!unit.route.length){unit.moveProgress=0;break;}
  }
}
function improvementTech(type){return {lab:'mining',solar:'electricity',extractor:'combustion'}[type]||null;}
function improvementForTile(tile){
  if(!tile)return null;
  if(tile.resource==='wheat')return'farm';if(tile.resource==='iron')return'mine';if(tile.resource==='crystal')return'lab';if(tile.resource==='oil')return'extractor';if(tile.resource==='timber')return'lumber';if(tile.resource==='fish')return'harbor';
  if(tile.terrain==='forest')return'lumber';if(tile.terrain==='hills')return'mine';if(tile.terrain==='desert')return'solar';if(tile.terrain==='grass'||tile.terrain==='plains')return'farm';return null;
}
function tileYield(tile){
  const out={};if(!tile?.improvement||tile.improvement.team!=='player'||tile.improvement.owner==='ally')return out;
  const imp=IMPROVEMENTS[tile.improvement.type];for(const[k,v]of Object.entries(imp.yield||{}))out[k]=(out[k]||0)+v;
  if(tile.resource){for(const[k,v]of Object.entries(RESOURCE_DEFS[tile.resource].yield||{}))out[k]=(out[k]||0)+v;}
  return out;
}
function cityYield(city){
  if(city.team!=='player'||city.allyAI)return{};const y={food:1.5,production:1.4,science:1,gold:2,energy:0};
  if(city.capital)y.gold+=1;y.food+=Math.floor(city.population/5);
  if(hasBuilding(city,'granary'))y.food+=3;if(hasBuilding(city,'forge'))y.production+=2;if(hasBuilding(city,'academy'))y.science+=4;if(hasBuilding(city,'quantumRelay'))y.energy+=4;
  if(state.completed.has('agriculture'))y.food+=1;if(state.completed.has('singularity'))y.energy+=2;
  return y;
}
function calculateYield(){
  const total={food:0,production:0,science:0,gold:0,energy:0};
  for(const c of state.cities)if(c.hp>0&&!c.allyAI)for(const[k,v]of Object.entries(cityYield(c)))total[k]+=v;
  for(const t of tiles.values())for(const[k,v]of Object.entries(tileYield(t)))total[k]+=v;
  return total;
}
function resourcePulse(){
  const y=calculateYield();state.lastYield=y;for(const k of RESOURCE_KEYS)state.resources[k]+=y[k]||0;
  for(const c of state.cities){
    if(c.team!=='player'||c.hp<=0)continue;
    if(hasBuilding(c,'shieldDome')){c.maxShield=180;c.shield=Math.min(c.maxShield,c.shield+7);}
    if(hasBuilding(c,'quantumRelay')){
      for(const u of state.units)if(u.team==='player'&&hexDistance(u,c)<=2)u.hp=Math.min(u.maxHp,u.hp+8);
    }
    if(state.resources.food>90+c.population*14&&c.population<15){state.resources.food-=24+c.population*2;c.population++;floating(c.q,c.r,'人口 +1','#66e7a7',-20);}
  }
}
function startResearch(id,fromAI=false){
  const t=techById(id);if(!t||!availableTech(t)||state.resources.science<t.cost)return false;
  state.resources.science-=t.cost;state.research={id:t.id,progress:0,time:t.time};
  addLog(`${fromAI?'🤖':'🧠'} 开始研发「${t.name}」，预计 ${t.time.toFixed(1)} 秒。`,fromAI?'good':'');
  if(!fromAI)toast(`开始研发：${t.icon} ${t.name}`);
  renderPanels();return true;
}
function chooseAIResearch(){
  if(!state.aiTech||state.research)return;
  const options=TECHS.filter(availableTech).filter(t=>state.resources.science>=t.cost);
  if(!options.length)return;
  options.sort((a,b)=>a.era-b.era||a.cost-b.cost);startResearch(options[0].id,true);
}
function finishResearch(){
  const t=techById(state.research.id);state.completed.add(t.id);state.research=null;state.score+=180+t.era*70;
  let bonus='';if(buildingOwned('academy')){state.resources.energy+=10;bonus='，全息学院返还 ⚡10';}
  const oldEra=state.era;state.era=eraFromProgress();
  toast(`${t.icon} 科技完成：${t.name}${bonus}`,'good');addLog(`${t.icon} 「${t.name}」研发完成，解锁：${t.unlock.join('、')}。`,'good');
  burst(3,7,'#59dcff',18,1);
  if(state.era>oldEra){state.resources.gold+=35;state.resources.science+=18;toast(`${ERAS[state.era].icon} 文明迈入${ERAS[state.era].name}，获得时代红利！`,'good');addLog(`时代跃迁：${ERAS[state.era].name}。`,'good');}
  renderPanels();
}
function updateResearch(dt){
  if(!state.research){chooseAIResearch();return;}
  state.research.progress+=dt;if(state.research.progress>=state.research.time)finishResearch();
}
function queueProduct(city,id){
  if(!city||city.team!=='player'||!hasProductUnlock(id))return;
  const def=productDef(id);if(!def)return;
  if(BUILDING_DEFS[id]&&(city.buildings.includes(id)||city.queue.some(x=>x.id===id))){toast('该城市已拥有或正在建造此建筑。','warn');return;}
  if(city.queue.length>=7){toast('建造队列已满。','warn');return;}
  const cost=deepCost(def.cost);if(!pay(cost)){toast('资源不足，无法加入队列。','warn');return;}
  city.queue.push({qid:uid('q'),id,progress:0,time:def.time,cost});addLog(`🏠 ${city.name} 将「${def.name}」加入建造队列。`);toast(`已排入队列：${def.icon} ${def.name}`);renderPanels();
}
function cancelQueue(city,qid){
  const i=city.queue.findIndex(x=>x.qid===qid);if(i<0)return;const item=city.queue[i],def=productDef(item.id);refund(item.cost);city.queue.splice(i,1);
  toast(`已取消 ${def.name}，资源全额退回。`,'good');addLog(`↩️ ${city.name} 取消「${def.name}」，投入已返还。`,'good');renderPanels();
}
function spawnNearCity(city,type){
  const def=UNIT_DEFS[type],candidates=[tileAt(city.q,city.r),...hexNeighbors(city.q,city.r),...hexNeighbors(city.q+1,city.r)].filter(Boolean);
  let t=candidates.find(x=>def.flying||isLand(x));if(!t)t=tileAt(city.q,city.r);
  const u=createUnit(type,'player',t.q,t.r);state.units.push(u);burst(t.q,t.r,'#66e7a7',12,.75);return u;
}
function completeProduct(city,item){
  const id=item.id,def=productDef(id);
  if(isUnitProduct(id)){
    const u=spawnNearCity(city,id);toast(`${def.icon} ${def.name} 已完成部署！`,'good');addLog(`${def.icon} ${city.name} 完成了 ${def.name}。`,'good');state.score+=45;
    if(id==='worker')u.aiWorker=false;
  }else{
    city.buildings.push(id);if(id==='granary'){city.maxHp+=60;city.hp+=60;}if(id==='shieldDome'){city.maxShield=180;city.shield=180;}
    toast(`${def.icon} ${def.name} 建造完成！`,'good');addLog(`${def.icon} ${city.name} 建成 ${def.name}。`,'good');state.score+=85;burst(city.q,city.r,'#ffd166',18,1);
  }
}
function updateCities(dt){
  for(const c of state.cities){
    if(c.hp<=0)continue;c.flash=Math.max(0,c.flash-dt*2.5);
    if(c.team==='player'&&c.queue.length){
      const item=c.queue[0],def=productDef(item.id),prod=cityYield(c).production||0;let mult=1+Math.min(3.5,prod/6);if(hasBuilding(c,'forge'))mult*=1.25;if(item.id==='kirov'&&hasBuilding(c,'skyDock'))mult*=1.3;
      const invest=Math.min(state.resources.production||0,prod*dt*.75);if(invest>0){state.resources.production-=invest;item.progress+=invest*.08;}
      item.progress+=dt*mult;if(item.progress>=item.time){c.queue.shift();completeProduct(c,item);renderPanels();}
    }
    if(c.maxShield>0)c.shield=Math.min(c.maxShield,c.shield+dt*1.3);
  }
}
function foundCity(unit){
  const t=tileAt(unit.q,unit.r);if(!t||!isLand(t)||cityAt(t.q,t.r)){toast('此处无法建立城市。','warn');return;}
  const near=state.cities.some(c=>c.hp>0&&hexDistance(c,t)<4);if(near){toast('距离现有城市过近，至少需要 4 格。','warn');return;}
  const c=createCity('player',t.q,t.r,false,'新星城 '+(state.cities.filter(x=>x.team==='player').length));state.cities.push(c);state.units=state.units.filter(x=>x.id!==unit.id);state.selection={kind:'city',id:c.id};
  state.resources.gold+=20;toast('🏠 新城市建立，资源脉冲已增强！','good');addLog('🧭 开拓者建立了一座新城市。','good');burst(c.q,c.r,'#59dcff',24,1.2);renderPanels();
}
function canImproveTile(tile){
  if(!tile)return{ok:false,reason:'无效地块'};const city=cityAt(tile.q,tile.r);if(city?.capital)return{ok:false,reason:'主城地块禁止建设额外设施'};if(city)return{ok:false,reason:'城市中心不能叠加采集设施'};
  if(tile.improvement)return{ok:false,reason:'此处已有设施'};const type=improvementForTile(tile);if(!type)return{ok:false,reason:'此地形暂无可建设设施'};
  if(tile.terrain==='water')return{ok:false,reason:'工人无法进入水域'};const tech=improvementTech(type);if(!hasTech(tech))return{ok:false,reason:`需要科技：${techById(tech)?.name||tech}`};return{ok:true,type};
}
function assignWorkerBuild(unit,tile,manual=false){
  if((unit.type!=='worker'&&unit.type!=='enemyWorker')||unit.team!=='player')return false;
  if(unit.charges<=0){if(manual)toast('这个工人的建设次数已经用完。','warn');return false;}
  const check=canImproveTile(tile);if(!check.ok){if(manual)toast(check.reason,'warn');return false;}
  const reserved=state.units.some(u=>u.id!==unit.id&&u.work&&u.work.q===tile.q&&u.work.r===tile.r);if(reserved){if(manual)toast('已经有工人在处理这个地块。','warn');return false;}
  const path=findPath(unit,{q:unit.q,r:unit.r},tile);if(!path.length&&!(unit.q===tile.q&&unit.r===tile.r)){if(manual)toast('工人找不到去这个地块的可通行路线。','warn');return false;}
  unit.work={q:tile.q,r:tile.r,type:check.type,progress:0,time:IMPROVEMENTS[check.type].duration,building:false};unit.route=path;unit.moveProgress=0;
  if(manual){toast(`${IMPROVEMENTS[check.type].icon} 工人开始前往建设 ${IMPROVEMENTS[check.type].name}`);addLog(`👷 已派工人建设 ${IMPROVEMENTS[check.type].name}。`);}return true;
}
function chooseWorkerTask(unit){
  const candidates=[];
  for(const t of tiles.values()){
    const d=hexDistance(unit,t);if(d>7)continue;const check=canImproveTile(t);if(!check.ok)continue;
    if(state.units.some(u=>u.id!==unit.id&&u.work&&u.work.q===t.q&&u.work.r===t.r))continue;
    let score=(t.resource?42:7)-d*2.4;if(t.terrain==='forest'&&check.type==='lumber')score+=8;if(t.resource==='crystal')score+=7;
    candidates.push({t,score});
  }
  candidates.sort((a,b)=>b.score-a.score);
  for(const c of candidates.slice(0,18))if(assignWorkerBuild(unit,c.t,false))return true;return false;
}
function finishWorkerBuild(unit){
  const w=unit.work,t=tileAt(w.q,w.r);if(!t||t.improvement){unit.work=null;return;}
  const def=IMPROVEMENTS[w.type];t.improvement={type:w.type,team:'player',owner:unit.allyAI?'ally':'player',hp:def.hp,maxHp:def.hp};unit.charges--;unit.work=null;
  toast(`${def.icon} ${def.name} 完工，每脉冲 ${yieldText(tileYield(t))}`,'good');addLog(`${def.icon} 工人完成 ${def.name}，剩余 ${unit.charges} 次建设。`,'good');burst(t.q,t.r,'#66e7a7',15,.9);state.score+=30;
  if(unit.charges<=0){toast('👷 工人完成五项工程后光荣退役。');state.units=state.units.filter(u=>u.id!==unit.id);if(state.selection?.id===unit.id)state.selection={kind:'tile',q:t.q,r:t.r};}
  renderPanels();
}
function healNearby(unit,dt){
  const drone=unit.type==='repairDrone',radius=drone?2:(state.completed.has('automation')?2:1),rate=drone?10:4.2;let healed=false;
  for(const u of state.units)if(u.team===unit.team&&u.id!==unit.id&&u.hp>0&&u.hp<u.maxHp&&hexDistance(unit,u)<=radius){u.hp=Math.min(u.maxHp,u.hp+rate*dt);healed=true;}
  for(const c of state.cities)if(c.team===unit.team&&c.hp>0&&c.hp<c.maxHp&&hexDistance(unit,c)<=radius){c.hp=Math.min(c.maxHp,c.hp+rate*dt);healed=true;}
  for(const t of tiles.values())if(t.improvement?.team===unit.team&&t.improvement.hp<t.improvement.maxHp&&hexDistance(unit,t)<=radius){t.improvement.hp=Math.min(t.improvement.maxHp,t.improvement.hp+rate*dt);healed=true;}
  unit.repairFx=(unit.repairFx||0)-dt;if(healed&&unit.repairFx<=0){unit.repairFx=.45;const p=unitDrawPos(unit);state.effects.push({type:'repair',x:p.x,y:p.y,life:.42,max:.42});}
}
function updateWorkers(dt){
  for(const u of [...state.units]){
    if(u.hp<=0||u.team!=='player'||(u.type!=='worker'&&u.type!=='enemyWorker'&&u.type!=='repairDrone'))continue;healNearby(u,dt);
    if(u.type!=='worker'&&u.type!=='enemyWorker')continue;
    u.aiThink=(u.aiThink||0)-dt;
    if(u.work){
      const w=u.work,t=tileAt(w.q,w.r);if(!t||t.improvement){u.work=null;continue;}
      if(u.q===w.q&&u.r===w.r&&!u.route.length){w.building=true;const boost=state.completed.has('automation')?1.55:1;w.progress+=dt*boost;u.combatGlow=.25;
        u.buildFx=(u.buildFx||0)-dt;if(u.buildFx<=0){u.buildFx=.16;const p=axialToWorld(u.q,u.r);state.effects.push({type:'particle',x:p.x+(Math.random()-.5)*18,y:p.y-8,vx:(Math.random()-.5)*16,vy:-18-Math.random()*18,life:.45,max:.45,size:2.5,color:'#ffd166'});}
        if(w.progress>=w.time)finishWorkerBuild(u);
      }
    }else if(u.aiWorker&&u.aiThink<=0){u.aiThink=.75;if(!chooseWorkerTask(u))u.aiThink=1.8;}
  }
}

// ===== 目标锁定、细粒度战斗、创意兵种与敌方 AI =====
function refFor(kind,obj){
  if(kind==='unit'||kind==='city')return{kind,id:obj.id};
  if(kind==='improvement')return{kind,q:obj.q,r:obj.r};return null;
}
function resolveTarget(ref){
  if(!ref)return null;
  if(ref.kind==='unit'){const o=unitById(ref.id);return o?{kind:'unit',obj:o,q:o.q,r:o.r,team:o.team}:null;}
  if(ref.kind==='city'){const o=cityById(ref.id);return o?{kind:'city',obj:o,q:o.q,r:o.r,team:o.team}:null;}
  if(ref.kind==='improvement'){const t=tileAt(ref.q,ref.r);return t?.improvement&&t.improvement.hp>0?{kind:'improvement',obj:t.improvement,tile:t,q:t.q,r:t.r,team:t.improvement.team}:null;}
  return null;
}
function targetAt(q,r,attackerTeam){
  const foe=enemyOf(attackerTeam),u=state.units.find(x=>x.hp>0&&x.team===foe&&x.q===q&&x.r===r);if(u)return{kind:'unit',obj:u,q,r,team:u.team};
  const c=state.cities.find(x=>x.hp>0&&x.team===foe&&x.q===q&&x.r===r);if(c)return{kind:'city',obj:c,q,r,team:c.team};
  const t=tileAt(q,r);if(t?.improvement&&t.improvement.team===foe&&t.improvement.hp>0)return{kind:'improvement',obj:t.improvement,tile:t,q,r,team:foe};return null;
}
function setLockedTarget(unit,target,manual=true){
  if(!unit||!target||unit.team===target.team)return;unit.target=refFor(target.kind,target.kind==='improvement'?target.tile:target.obj);unit.manualTarget=manual;unit.route=[];unit.moveProgress=0;unit.repathTimer=0;
  if(manual&&unit.team==='player')unit.holdPosition=false;
  if(manual&&unit.team==='player'){toast(`🎯 ${unit.def.name} 已锁定 ${target.obj.def?.name||target.obj.name||IMPROVEMENTS[target.obj.type]?.name||'目标'}`);addLog(`🎯 ${unit.def.icon} ${unit.def.name} 锁定目标并开始追击。`);}
}
function allTargetsFor(team){
  const foe=enemyOf(team),out=[];
  for(const u of state.units)if(u.hp>0&&u.team===foe)out.push({kind:'unit',obj:u,q:u.q,r:u.r,team:foe});
  for(const c of state.cities)if(c.hp>0&&c.team===foe)out.push({kind:'city',obj:c,q:c.q,r:c.r,team:foe});
  if(team==='enemy')for(const t of tiles.values())if(t.improvement?.team===foe&&t.improvement.hp>0)out.push({kind:'improvement',obj:t.improvement,tile:t,q:t.q,r:t.r,team:foe});
  return out;
}
function autoAcquire(unit){
  const baseRange=unit.team==='player'?3:7,holdRange=unit.def?.range||1,range=unit.team==='player'&&unit.holdPosition?holdRange:baseRange,targets=allTargetsFor(unit.team).filter(t=>{
    const d=hexDistance(unit,t);if(d>range)return false;if(unit.team==='player'&&t.kind==='city'&&allTargetsFor(unit.team).some(x=>x.kind==='unit'&&hexDistance(unit,x)<=3))return false;return true;
  });
  targets.sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b)||(a.kind==='unit'?-1:1));
  if(targets[0])setLockedTarget(unit,targets[0],false);
  else if(unit.team==='enemy'){
    const capital=state.cities.find(c=>c.team==='player'&&c.capital&&c.hp>0);if(capital)setLockedTarget(unit,{kind:'city',obj:capital,q:capital.q,r:capital.r,team:'player'},false);
  }
}
function targetRange(target){
  if(target.kind==='unit')return target.obj.def.range||1;if(target.kind==='city')return 2;return 0;
}
function targetAttack(target){
  if(target.kind==='unit')return target.obj.def.attack||0;if(target.kind==='city')return target.team==='player'?21:10;return 0;
}
function targetArmor(target){
  if(target.kind==='unit')return target.obj.def.armor||0;if(target.kind==='city')return target.team==='player'?10:4;if(target.kind==='improvement')return 2;return 0;
}
function targetPosition(target){
  if(target.kind==='unit')return unitDrawPos(target.obj);return axialToWorld(target.q,target.r);
}
function formationMultiplier(unit){
  if(unit.team!=='player'||!unit.def.combat)return 1;const roles=new Set();
  for(const u of state.units)if(u.hp>0&&u.team==='player'&&u.def.combat&&hexDistance(unit,u)<=2)roles.add(u.def.role);
  return roles.size>=3?1.18:roles.size>=2?1.08:1;
}
function prismNetwork(unit){
  if(unit.type!=='prism')return[unit];const range=buildingOwned('prismMatrix')?4:3,all=state.units.filter(u=>u.hp>0&&u.team===unit.team&&u.type==='prism');
  const seen=new Set([unit.id]),queue=[unit],out=[unit];while(queue.length){const a=queue.shift();for(const b of all)if(!seen.has(b.id)&&hexDistance(a,b)<=range){seen.add(b.id);queue.push(b);out.push(b);}}return out;
}
function damageMultiplier(unit){
  let m=formationMultiplier(unit);if(unit.team==='player')m*=1.08;if(unit.overdrive>0)m*=1.45;if(state.completed.has('singularity')&&unit.team==='player')m*=1.2;
  if(unit.type==='knight'&&unit.chargeReady>0)m*=1.25;
  if(unit.type==='prism'){
    const n=prismNetwork(unit).length;if(n>=2)m*=Math.min(2.5,2+(n-2)*.25);if(buildingOwned('prismMatrix'))m*=1.15;
  }
  return m;
}
function applyDamage(target,amount,attacker=null){
  amount=Math.max(0,Math.round(amount));let hpDamage=amount;
  if(target.kind==='city'&&target.obj.shield>0){const absorbed=Math.min(target.obj.shield,hpDamage);target.obj.shield-=absorbed;hpDamage-=absorbed;if(absorbed>0)floating(target.q,target.r,`护盾 -${absorbed}`,'#59dcff',-34);}
  target.obj.hp-=hpDamage;target.obj.hp=Math.max(0,target.obj.hp);target.obj.flash=1;
  if(target.obj.hp<=0)destroyTarget(target,attacker);return hpDamage;
}
function destroyTarget(target,attacker){
  if(target.kind==='unit'){
    const u=target.obj;burst(u.q,u.r,u.team==='player'?'#59dcff':'#ff6d7e',18,1);addLog(`💥 ${u.def.name} 被摧毁。`,u.team==='player'?'danger':'good');
    if(state.selection?.kind==='unit'&&state.selection.id===u.id)state.selection=null;
    if(u.team==='enemy'){state.score+=65;state.resources.gold+=5;}
  }else if(target.kind==='improvement'){
    const def=IMPROVEMENTS[target.obj.type];target.tile.improvement=null;burst(target.q,target.r,'#ff9f6d',15,.8);addLog(`🔥 ${def.name} 被摧毁。`,'danger');
  }else if(target.kind==='city'){
    const c=target.obj;burst(c.q,c.r,c.team==='player'?'#59dcff':'#ff6d7e',45,1.7);addLog(`🏚️ ${c.name} 已陷落！`,c.team==='player'?'danger':'good');
    if(c.capital){
      if(c.team==='enemy')endGame(true);else endGame(false);
    }
  }
}
function beamEffect(from,to,color='#59dcff',life=.18,width=2){state.effects.push({type:'beam',x1:from.x,y1:from.y,x2:to.x,y2:to.y,color,life,max:life,width});}
function attackVisual(unit,target){
  const a=unitDrawPos(unit),b=targetPosition(target);
  if(unit.type==='prism'){
    const net=prismNetwork(unit);for(const p of net)if(p.id!==unit.id)beamEffect(unitDrawPos(p),a,'#8ee8ff',.3,2.2);beamEffect(a,b,'#d9fbff',.34,5.3);beamEffect(a,b,'#69c9ff',.45,2.2);burst(target.q,target.r,'#86e7ff',10,.7);
  }else if(unit.type==='quantumWalker'){
    beamEffect(a,b,'#c997ff',.32,4);state.effects.push({type:'ring',x:b.x,y:b.y,color:'#c997ff',life:.42,max:.42,r:10});
  }else if(unit.type==='kirov'){
    state.effects.push({type:'projectile',x:a.x,y:a.y-12,tx:b.x,ty:b.y,color:'#ffb06b',life:.36,max:.36,size:7});burst(target.q,target.r,'#ff9b63',22,1.3);
  }else if((unit.def.range||1)>1){
    state.effects.push({type:'projectile',x:a.x,y:a.y-8,tx:b.x,ty:b.y,color:unit.team==='player'?'#ffd166':'#ff7e8d',life:.22,max:.22,size:4});
  }else{
    beamEffect(a,b,unit.team==='player'?'#ffe29a':'#ff8b98',.12,3);burst(target.q,target.r,unit.team==='player'?'#ffd166':'#ff6d7e',6,.45);
  }
}
function splashAttack(unit,target,primaryDamage){
  if(unit.type==='kirov'){
    for(const other of allTargetsFor(unit.team)){
      if(other.kind==='improvement'||(other.kind===target.kind&&other.obj===target.obj)||hexDistance(other,target)>1)continue;
      const d=Math.max(1,Math.round(primaryDamage*.48-targetArmor(other)));const hp=applyDamage(other,d,unit);floating(other.q,other.r,`-${hp}`,'#ffb06b',-22);
    }
  }
  if(unit.type==='quantumWalker'){
    const candidates=allTargetsFor(unit.team).filter(o=>o.obj!==target.obj&&hexDistance(o,target)<=2).sort((a,b)=>hexDistance(a,target)-hexDistance(b,target));
    if(candidates[0]){const second=candidates[0],d=Math.max(1,Math.round(primaryDamage*.58-targetArmor(second)));const hp=applyDamage(second,d,unit);floating(second.q,second.r,`跃迁 -${hp}`,'#c997ff',-23);beamEffect(targetPosition(target),targetPosition(second),'#c997ff',.28,3);if(second.kind==='unit')second.obj.disrupted=1.1;}
  }
}
function performAttack(unit,target){
  if(!target||unit.hp<=0)return;let raw=unit.def.attack*(.9+Math.random()*.2)*damageMultiplier(unit);const tile=tileAt(target.q,target.r);
  if(target.kind==='unit'&&(tile?.terrain==='forest'||tile?.terrain==='hills'))raw*=.9;
  const damage=Math.max(1,Math.round(raw-targetArmor(target)*.72));
  const counterBase=targetAttack(target),dist=hexDistance(unit,target),canCounter=counterBase>0&&dist<=targetRange(target);
  let counter=canCounter?Math.max(0,Math.round(counterBase*(unit.def.range>1?.26:.42)*(0.88+Math.random()*.2)-(unit.def.armor||0)*.35)):0;
  if(unit.team==='player')counter=Math.round(counter*.78);if(state.tutorialActive&&unit.team==='player')counter=0;
  attackVisual(unit,target);const hpDamage=applyDamage(target,damage,unit);floating(target.q,target.r,`-${hpDamage}`,'#ff7a88',-27);
  // 同一次交火双方都显示结算数字；即使射程压制成功也明确显示 -0。
  const attackerTarget={kind:'unit',obj:unit,q:unit.q,r:unit.r,team:unit.team};const selfDamage=unit.hp>0?applyDamage(attackerTarget,counter,target.obj):0;floating(unit.q,unit.r,`-${selfDamage}`,'#ffd166',-39);
  splashAttack(unit,target,damage);unit.chargeReady=0;unit.combatGlow=1;state.score+=unit.team==='player'?Math.min(10,Math.round(hpDamage/8)):0;
}
function updateCombatUnit(unit,dt){
  if(!unit.def.combat||unit.hp<=0)return;
  let target=resolveTarget(unit.target);
  if(!target){unit.target=null;unit.manualTarget=false;unit.acquireTimer=(unit.acquireTimer||0)-dt;if(unit.acquireTimer<=0){unit.acquireTimer=unit.team==='player'?.28:.7;autoAcquire(unit);target=resolveTarget(unit.target);}}
  if(!target)return;
  const dist=hexDistance(unit,target),range=unit.def.range||1,interval=(unit.def.interval||1)*(unit.overdrive>0?.72:1)*(unit.disrupted>0?1.35:1);
  if(!unit.manualTarget&&unit.team==='player'&&dist>9){unit.target=null;unit.route=[];return;}
  if(dist<=range){
    unit.route=[];unit.moveProgress=0;unit.attackTimer+=dt;unit.combatGlow=1;unit.beamTick=(unit.beamTick||0)-dt;
    if(unit.beamTick<=0){unit.beamTick=.11;const a=unitDrawPos(unit),b=targetPosition(target);if(unit.type==='prism')beamEffect(a,b,'rgba(113,215,255,.45)',.12,1);else if(unit.def.range>1)state.effects.push({type:'spark',x:lerp(a.x,b.x,Math.random()),y:lerp(a.y,b.y,Math.random()),color:unit.team==='player'?'#ffd166':'#ff6d7e',life:.16,max:.16});}
    while(unit.attackTimer>=interval&&unit.hp>0&&resolveTarget(unit.target)){unit.attackTimer-=interval;performAttack(unit,resolveTarget(unit.target));}
  }else{
    if(unit.team==='player'&&unit.holdPosition){unit.target=null;unit.route=[];return;}
    unit.attackTimer=Math.min(unit.attackTimer,interval*.65);unit.repathTimer=(unit.repathTimer||0)-dt;
    if(unit.repathTimer<=0||!unit.route.length){unit.repathTimer=unit.team==='player'?.32:.65;setUnitRoute(unit,target.q,target.r,false);}
  }
}
function updateEnemySpawns(dt){
  if(state.tutorialActive)return;
  const base=state.cities.find(c=>c.team==='enemy'&&c.capital&&c.hp>0);if(!base)return;
  state.enemySpawnTimer+=dt;const enemies=state.units.filter(u=>u.team==='enemy'&&u.hp>0);
  if(state.enemySpawnTimer>=11.5&&enemies.length<13){state.enemySpawnTimer=0;const roll=Math.random(),type=roll<.52?'raider':roll<.8?'enemyArcher':'enemyBuggy';
    const t=[...hexNeighbors(base.q,base.r),tileAt(base.q,base.r)].find(x=>x&&isLand(x));const u=createUnit(type,'enemy',t.q,t.r);state.units.push(u);addLog(`⚠️ 灰烬要塞部署了 ${u.def.name}。`,'warn');burst(t.q,t.r,'#ff6d7e',10,.6);
  }
}
function cleanupDead(){
  state.units=state.units.filter(u=>u.hp>0);
  for(const u of state.units){if(u.target&&!resolveTarget(u.target)){u.target=null;u.manualTarget=false;}}
}
function clearHalfEnemies(){
  const list=state.units.filter(u=>u.team==='enemy'&&u.hp>0).sort(()=>Math.random()-.5),n=Math.ceil(list.length/2);if(!n){toast('当前没有敌军单位。','warn');return;}
  for(const u of list.slice(0,n)){u.hp=0;burst(u.q,u.r,'#c997ff',16,.9);}cleanupDead();toast(`🌀 战略指令 C：随机清除了 ${n} 个敌军！`,'good');addLog(`🌀 奇点脉冲抹除了 ${n} 个敌方单位。`,'good');state.score+=n*35;renderPanels();
}
function activateOverdrive(unit){
  if(!unit||unit.team!=='player'||!unit.def.combat)return;if(unit.overdrive>0){toast('该单位已经在短时强化中。','warn');return;}
  if(!pay({energy:25})){toast('需要 ⚡25 才能短时强化。','warn');return;}unit.overdrive=8;toast(`⚡ ${unit.def.name} 强化 8 秒：火力与移动提升！`,'good');addLog(`⚡ ${unit.def.name} 启动短时强化。`,'good');burst(unit.q,unit.r,'#59dcff',16,.8);renderPanels();
}
function endGame(win){
  if(state.gameOver)return;if(tutorial.active)closeTutorial(false,true);state.gameOver=true;state.paused=true;$('end').classList.remove('hidden');$('endKicker').textContent=win?'Civilization ascendant':'Civilization fallen';$('endTitle').textContent=win?'🌌 星火文明胜利':'🌑 曙光城陷落';
  $('endText').textContent=win?`你以实时指挥摧毁灰烬要塞，跨越 ${ERAS[state.era].name}，累计文明评分 ${fmt(state.score)}。`:`灰烬军团突破了主城防线。本局坚持 ${Math.floor(state.simTime)} 个战略秒，评分 ${fmt(state.score)}。`;
}
function updateUnitSystems(dt){
  for(const u of [...state.units]){
    u.overdrive=Math.max(0,u.overdrive-dt);u.disrupted=Math.max(0,u.disrupted-dt);u.chargeReady=Math.max(0,(u.chargeReady||0)-dt);u.combatGlow=Math.max(0,u.combatGlow-dt*1.6);
    // 新手教程期间开启停火保护：敌军不移动、不索敌、不攻击，玩家与经济系统仍可正常操作。
    if(state.tutorialActive&&u.team==='enemy')continue;
    updateCombatUnit(u,dt);updateMovement(u,dt);
  }
}
function simStep(dt){
  if(!state.started||state.paused||state.gameOver)return;state.simTime+=dt;state.pulseTimer+=dt;
  while(state.pulseTimer>=1){state.pulseTimer-=1;resourcePulse();}
  updateResearch(dt);updateCities(dt);updateWorkers(dt);updateUnitSystems(dt);updateEnemySpawns(dt);cleanupDead();
}

