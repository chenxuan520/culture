"use strict";

// ===== 鼠标、键盘、缩放、暂停、重开与统一实时主循环 =====
function hitTest(x,y){
  for(let i=state.units.length-1;i>=0;i--){const u=state.units[i];if(u.hp<=0)continue;const p=worldToScreen(unitDrawPos(u));if(Math.hypot(p.x-x,p.y-y)<25)return{kind:'unit',obj:u};}
  for(let i=state.cities.length-1;i>=0;i--){const c=state.cities[i];if(c.hp<=0)continue;const p=worldToScreen(axialToWorld(c.q,c.r));if(Math.hypot(p.x-x,p.y-y)<35)return{kind:'city',obj:c};}
  const t=screenToTile(x,y);return t?{kind:t.improvement?'improvement':'tile',obj:t}:null;
}
function tooltipHTML(hit){
  if(!hit)return'';
  if(hit.kind==='unit'){const u=hit.obj;return `<b>${u.def.icon} ${u.def.name}</b><br><span>${u.team==='player'?'己方':'敌方'} · ${u.def.role} · 生命 ${Math.ceil(u.hp)}/${u.maxHp}<br>${u.route.length?`规划路线剩余 ${u.route.length} 格`:u.target?`已锁定 ${targetName(u.target)}`:'等待命令'}</span>`;}
  if(hit.kind==='city'){const c=hit.obj;return `<b>${c.team==='player'?(c.capital?'🏠':'🏙️'):'🏰'} ${c.name}</b><br><span>生命 ${Math.ceil(c.hp)}/${c.maxHp}${c.maxShield?` · 护盾 ${Math.ceil(c.shield)}/${c.maxShield}`:''}<br>${c.team==='player'?`自然产出 ${yieldText(cityYield(c))}`:'灰烬军团首要战略目标'}</span>`;}
  const t=hit.obj,res=t.resource?RESOURCE_DEFS[t.resource]:null,imp=t.improvement?IMPROVEMENTS[t.improvement.type]:null;
  return `<b>${imp?.icon||res?.icon||TERRAIN[t.terrain].icon} ${imp?.name||res?.name||TERRAIN[t.terrain].name}</b><br><span>坐标 ${t.q}, ${t.r} · ${TERRAIN[t.terrain].name}<br>${imp?`每脉冲 ${yieldText(tileYield(t))}`:res?`潜在产出 ${yieldText(res.yield)}`:'普通地块'}${t.ruin?'<br>✨ 未探索的星火遗迹':''}</span>`;
}
function showTooltip(x,y,hit){
  const tip=$('tooltip');if(!hit){tip.style.display='none';return;}tip.innerHTML=tooltipHTML(hit);tip.style.display='block';
  const maxX=state.screen.w-260,maxY=state.screen.h-110;tip.style.left=clamp(x+16,6,maxX)+'px';tip.style.top=clamp(y+16,6,maxY)+'px';
}
function selectedPlayerUnits(){
  if(state.selection?.kind==='unit'){const u=unitById(state.selection.id);return u&&u.team==='player'?[u]:[];}
  if(state.selection?.kind==='units')return state.selection.ids.map(unitById).filter(u=>u&&u.team==='player');
  return [];
}
function selectHit(hit){
  if(!hit)return;
  if(hit.kind==='unit')state.selection={kind:'unit',id:hit.obj.id};
  else if(hit.kind==='city'){state.selection={kind:'city',id:hit.obj.id};if(hit.obj.team==='player'&&!hit.obj.allyAI)state.lastProductionCityId=hit.obj.id;}
  else state.selection={kind:hit.kind,q:hit.obj.q,r:hit.obj.r};
  renderPanels();
}
function openProductionBase(){
  const c=cityById(state.lastProductionCityId)||state.cities.find(x=>x.team==='player'&&x.capital&&x.hp>0)||state.cities.find(x=>x.team==='player'&&!x.allyAI&&x.hp>0);
  if(!c){toast('没有可用的生产基地。','warn');return;}
  state.selection={kind:'city',id:c.id};state.lastProductionCityId=c.id;centerOn(c.q,c.r);renderPanels();toast(`已打开生产基地：${c.name}`,'good');
}
function issueCommandAt(x,y){
  const hit=hitTest(x,y),selectedCity=state.selection?.kind==='city'?cityById(state.selection.id):null;
  if(selectedCity?.team==='player'){
    const t=screenToTile(x,y);if(!t)return;
    if(!Number.isFinite(terrainCost(t,{def:{}}))){toast('集结点必须设置在陆地可通行地块。','warn');return;}
    selectedCity.rallyPoint={q:t.q,r:t.r};toast(`🎌 ${selectedCity.name} 集结点设为 ${t.q},${t.r}`,'good');renderPanels();return;
  }
  const units=selectedPlayerUnits();
  if(!units.length){toast('请先选择己方单位。','warn');return;}
  if(hit&&(hit.kind==='unit'||hit.kind==='city')&&hit.obj.team==='enemy'){
    let count=0;for(const u of units)if(u.def.combat){setLockedTarget(u,{kind:hit.kind,obj:hit.obj,q:hit.obj.q,r:hit.obj.r,team:'enemy'},units.length===1);count++;}
    if(!count)toast('选中的单位不能攻击；请选择作战单位。','warn');else{toast(`已下达攻击命令：${count} 个单位`);renderPanels();}return;
  }
  if(hit?.kind==='improvement'&&hit.obj.improvement?.team==='enemy'){
    let count=0;for(const u of units)if(u.def.combat){setLockedTarget(u,{kind:'improvement',obj:hit.obj.improvement,tile:hit.obj,q:hit.obj.q,r:hit.obj.r,team:'enemy'},units.length===1);count++;}
    if(!count)toast('选中的单位不能攻击设施；请选择作战单位。','warn');else{toast(`已下达攻击设施命令：${count} 个单位`);renderPanels();}return;
  }
  const t=screenToTile(x,y);if(!t)return;
  let moved=0;for(const u of units){u.target=null;u.manualTarget=false;if(u.type==='worker')u.work=null;if(setUnitRoute(u,t.q,t.r,units.length===1))moved++;}
  if(units.length>1)toast(moved?`已下达移动命令：${moved} 个单位`:'没有可通行的路线。',moved?'':'warn');renderPanels();
}
canvas.addEventListener('pointermove',e=>{
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,t=screenToTile(x,y),hit=hitTest(x,y);state.hovered=t?{q:t.q,r:t.r}:null;state.pointer={x,y};showTooltip(x,y,hit);
});
canvas.addEventListener('pointerleave',()=>{state.hovered=null;$('tooltip').style.display='none';});
canvas.addEventListener('click',e=>{
  const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,hit=hitTest(x,y);canvas.focus();
  const selectedCity=state.selection?.kind==='city'?cityById(state.selection.id):null,units=selectedPlayerUnits();
  if(units.length&&!(hit?.obj?.team==='player')){issueCommandAt(x,y);return;}
  if(selectedCity?.team==='player'&&!selectedCity.allyAI&&(!hit||hit.kind==='tile')){issueCommandAt(x,y);return;}
  selectHit(hit);
});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();state.selection=null;renderPanels();toast('已取消当前选择。');
});
canvas.addEventListener('wheel',e=>{
  e.preventDefault();if(tutorial.active)tutorial.flags.viewAction=true;const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,before=screenToWorld(x,y),old=state.camera.zoom;
  state.camera.zoom=clamp(old*Math.exp(-e.deltaY*.0012),.48,1.85);state.camera.x=before.x-(x-state.screen.w/2)/state.camera.zoom;state.camera.y=before.y-(y-state.screen.h/2)/state.camera.zoom;clampCamera();
},{passive:false});
mini.addEventListener('click',e=>{
  const tr=mini._mapTransform;if(!tr)return;const r=mini.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;state.camera.x=(x-tr.pad)/tr.s+tr.b.minX;state.camera.y=(y-tr.pad)/tr.s+tr.b.minY;clampCamera();
});
function togglePause(){if(!state.started||state.gameOver)return;if(tutorial.active)tutorial.flags.pauseTouched=true;state.paused=!state.paused;toast(state.paused?'⏸ 模拟已暂停。':'▶ 模拟继续运行。');renderTop();updateTutorialTask();}
window.addEventListener('keydown',e=>{
  const k=e.key;if(k==='F1'){e.preventDefault();if(state.started&&!state.gameOver&&!tutorial.active)openTutorial(false);return;}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(k))e.preventDefault();
  if(k==='Escape'){e.preventDefault();if(tutorial.active)closeTutorial(false);else togglePause();return;}
  const tag=e.target?.tagName?.toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return;
  if(k===' '){state.showIntel=true;if(tutorial.active)tutorial.flags.viewAction=true;return;}if(k.startsWith('Arrow')){state.keys.add(k);if(tutorial.active)tutorial.flags.viewAction=true;return;}
  if((k==='g'||k==='G')&&!e.repeat&&state.started&&!state.gameOver){e.preventDefault();openProductionBase();return;}
  if((k==='a'||k==='A')&&!e.repeat&&state.pointer&&state.started&&!state.gameOver){e.preventDefault();issueCommandAt(state.pointer.x,state.pointer.y);return;}
  const hotkeys=['1','2','3','4','5','6','7','8','9','0'];const hotIndex=hotkeys.indexOf(k);
  if(hotIndex>=0&&state.selection?.kind==='city'&&state.started&&!state.gameOver){const c=cityById(state.selection.id);if(c&&!c.allyAI&&c.team==='player'){e.preventDefault();const id=PRODUCT_IDS[hotIndex];if(id)queueProduct(c,id);return;}}
  if((k==='p'||k==='P')&&!e.repeat)togglePause();if((k==='c'||k==='C')&&!e.repeat&&state.started&&!state.gameOver)clearHalfEnemies();
});
window.addEventListener('keyup',e=>{state.keys.delete(e.key);if(e.key===' ')state.showIntel=false;});
window.addEventListener('blur',()=>{state.keys.clear();state.showIntel=false;});
function updateCamera(dt){
  let dx=0,dy=0;if(state.keys.has('ArrowLeft'))dx--;if(state.keys.has('ArrowRight'))dx++;if(state.keys.has('ArrowUp'))dy--;if(state.keys.has('ArrowDown'))dy++;
  if(state.started&&!state.gameOver&&state.pointer){const edge=28;if(state.pointer.x<edge)dx--;else if(state.pointer.x>state.screen.w-edge)dx++;if(state.pointer.y<edge)dy--;else if(state.pointer.y>state.screen.h-edge)dy++;}
  if(dx||dy){const len=Math.hypot(dx,dy),speed=480/state.camera.zoom;state.camera.x+=dx/len*speed*dt;state.camera.y+=dy/len*speed*dt;clampCamera();}
}
function resetGame(started=true){
  if(tutorial.active)closeTutorial(false,true);const oldSpeed=state?.speed||1;state=freshState(started);state.speed=oldSpeed;resizeCanvases();state.lastYield=calculateYield();state.logs=[];addLog('🏠 曙光城开始自然产生基础资源。','good');addLog('🤖 AI 科研助理已在线，等待可用项目。','good');addLog('🎯 灰烬军团正在向主城推进。','warn');
  $('end').classList.add('hidden');if(started)$('intro').classList.add('hidden');else $('intro').classList.remove('hidden');renderPanels();clampCamera();canvas.focus();
}
$('start').addEventListener('click',()=>beginGame(false));
$('startTutorial').addEventListener('click',()=>beginGame(true));
$('tutorialSkip').addEventListener('click',()=>closeTutorial(false));
$('tutorialDemo').addEventListener('click',demoTutorialStep);
$('tutorialPrev').addEventListener('click',()=>enterTutorialStep(tutorial.step-1));
$('tutorialNext').addEventListener('click',()=>{if(tutorial.step>=TUTORIAL_STEPS.length-1)closeTutorial(true);else enterTutorialStep(tutorial.step+1);});
$('restart').addEventListener('click',()=>{resetGame(true);toast('↻ 世界已重置，新的文明开始。','good');});
$('endRestart').addEventListener('click',()=>resetGame(true));
$('pause').addEventListener('click',togglePause);
$('speed').addEventListener('input',e=>{if(tutorial.active)tutorial.flags.speedTouched=true;state.speed=clamp(Number(e.target.value)||1,.1,10);$('speedText').textContent=state.speed.toFixed(1)+'×';updateTutorialTask();});
window.addEventListener('resize',()=>{resizeCanvases();clampCamera();if(tutorial.active)requestAnimationFrame(placeTutorial);});
document.addEventListener('pointerdown',e=>{
  if(e.target.closest('button,input,select,label,.switchRow,.tech,.product,.settingsPanel,.helpPanel,.tutorialCard'))state.uiHoldUntil=performance.now()+450;
},true);

function frame(now){
  const realDt=Math.min(.065,Math.max(0,(now-state.lastFrame)/1000));state.lastFrame=now;updateCamera(realDt);
  if(state.started&&!state.paused&&!state.gameOver){state.acc+=realDt*state.speed;let steps=0;while(state.acc>=FIXED_STEP&&steps++<120){simStep(FIXED_STEP);state.acc-=FIXED_STEP;}if(steps>=120)state.acc=0;updateEffects(realDt*Math.min(2.5,Math.max(.22,state.speed)));}
  drawMap();drawMinimap();renderTop();state.uiTimer+=realDt;if(state.uiTimer>=.18&&performance.now()>(state.uiHoldUntil||0)){state.uiTimer=0;renderResearchPanel();renderSelection();renderGlobal();renderLogs();}
  if(tutorial.active){tutorial.checkTimer+=realDt;if(tutorial.checkTimer>=.16){tutorial.checkTimer=0;updateTutorialTask();placeTutorial();}}
  requestAnimationFrame(frame);
}

resizeCanvases();state.lastYield=calculateYield();addLog('🏠 曙光城开始自然产生基础资源。','good');addLog('⬡ 选中单位后左键可规划完整六边形路线，右键取消选择。');addLog('⚠️ 灰烬军团能力较弱，但会持续增援。','warn');renderPanels();clampCamera();requestAnimationFrame(frame);
