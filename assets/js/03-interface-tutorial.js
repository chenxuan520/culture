"use strict";

// ===== 信息面板、研发树、建造队列与交互命令 =====
function healthBar(hp,max,color=''){const pct=clamp(hp/max*100,0,100);return `<div class="health"><div class="progress"><div class="fill" style="width:${pct}%;${color?`background:${color}`:''}"></div></div><span>${Math.ceil(hp)} / ${max}</span></div>`;}
function stat(label,value){return `<div class="stat"><small>${label}</small><b>${value}</b></div>`;}
function badge(text,cls=''){return `<span class="badge ${cls}">${text}</span>`;}
function targetName(ref){const t=resolveTarget(ref);if(!t)return'无';return t.kind==='unit'?`${t.obj.def.icon} ${t.obj.def.name}`:t.kind==='city'?`${t.obj.capital?'🏠':'🏙️'} ${t.obj.name}`:`${IMPROVEMENTS[t.obj.type].icon} ${IMPROVEMENTS[t.obj.type].name}`;}
function renderTop(){
  for(const k of RESOURCE_KEYS){$(k).textContent=fmt(state.resources[k]);$('g'+k[0].toUpperCase()+k.slice(1)).textContent='+'+fmt(state.lastYield[k]||0);}
  $('speed').value=state.speed;$('speedText').textContent=state.speed.toFixed(1)+'×';$('pause').textContent=state.paused?'▶ 继续':'⏸ 暂停';
  $('pulseFill').style.width=(state.pulseTimer*100).toFixed(1)+'%';$('pulseTime').textContent=(1-state.pulseTimer).toFixed(1)+' 秒';
  const sec=Math.floor(state.simTime),m=String(Math.floor(sec/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');$('clock').textContent=`${m}:${s} · ${state.paused?'模拟暂停':state.speed.toFixed(1)+'× 实时运行'}`;
  mapArea.classList.toggle('paused',state.started&&state.paused&&!state.gameOver);
}
function renderResearchPanel(){
  $('eraName').textContent=`${ERAS[state.era].icon} ${ERAS[state.era].name}`;$('aiTech').checked=state.aiTech;
  if(state.research){const t=techById(state.research.id),pct=state.research.progress/state.research.time*100;$('research').innerHTML=`<div class="row"><b>${t.icon} 正在研发：${t.name}</b><span class="small muted">${Math.max(0,t.time-state.research.progress).toFixed(1)}s</span></div><p class="desc">${t.desc}</p><div class="progress"><div class="fill" style="width:${pct}%"></div></div>`;}
  else $('research').innerHTML=`<div class="row"><b>📭 研发槽空闲</b><span class="small muted">点击科技</span></div><p class="desc">${state.aiTech?'AI 助理会在科研资源足够时自动选择下一项科技。':'AI 已关闭，请手动选择可用科技。'}</p>`;
  let html='';for(let e=0;e<ERAS.length;e++){
    const list=TECHS.filter(t=>t.era===e);html+=`<div class="era"><div class="eraLabel">${ERAS[e].icon} ${ERAS[e].name}</div>`;
    for(const t of list){const done=state.completed.has(t.id),active=state.research?.id===t.id,avail=availableTech(t),funded=state.resources.science>=t.cost;
      const pre=t.pre.length?t.pre.map(x=>techById(x).name).join(' / '):'无前置';let cls=done?'done':active?'active':avail?'available':'';
      html+=`<button class="tech ${cls}" data-tech="${t.id}" ${done||active||!avail||!funded?'disabled':''}><div class="techHead"><b>${done?'✅':active?'⚙️':t.icon} ${t.name}</b><span>${done?'完成':active?'进行中':`🔬${t.cost}`}</span></div><p>${t.desc}</p><div class="techMeta"><i>⏱ ${t.time.toFixed(1)}s</i><i>前置：${pre}</i></div></button>`;
    }html+='</div>';
  }$('techTree').innerHTML=html;$('aiTechNote').textContent=state.aiTech?'资源允许时自动完成整棵科技树。':'已切换为手动科研模式。';
}
function renderUnitSelection(u){
  const formation=formationMultiplier(u),net=u.type==='prism'?prismNetwork(u).length:0,locked=resolveTarget(u.target);
  let badges='';if(u.team==='player')badges+=badge('己方单位','good');else badges+=badge('敌方单位','danger');
  if(u.route.length)badges+=badge(`路线 ${u.route.length} 格`,'cyan');if(locked)badges+=badge(`🎯 锁定：${targetName(u.target)}`,'danger');if(u.combatGlow>0)badges+=badge('⚔️ 交战周期中','warn');
  if(formation>1)badges+=badge(`混编加成 ×${formation.toFixed(2)}`,'good');if(net>=2)badges+=badge(`光棱组网 ${net} 辆`,'cyan');if(u.overdrive>0)badges+=badge(`⚡ 强化 ${u.overdrive.toFixed(1)}s`,'warn');
  if(u.holdPosition)badges+=badge('🛡️ 驻守当前格','warn');
  if(u.type==='worker')badges+=badge(`建设次数 ${u.charges}/5`,u.charges>1?'good':'warn');
  let html=`<div class="card"><div class="hero"><div class="heroIcon">${u.def.icon}</div><div><h2>${u.name}</h2><p>${u.def.desc||'灰烬军团作战单位。'}</p>${healthBar(u.hp,u.maxHp)}</div></div><div class="badges">${badges}</div><div class="stats">${stat('攻击',u.def.attack||0)}${stat('射程',(u.def.range||0)+' 格')}${stat('移动',u.def.move.toFixed(2)+' 格/s')}${stat('攻击周期',(u.def.interval||0).toFixed(2)+'s')}</div>`;
  if(u.work){const imp=IMPROVEMENTS[u.work.type],pct=u.work.progress/u.work.time*100;html+=`<div class="sub">当前工程 <span>${u.work.building?'建设中':'前往工地'}</span></div><div class="queueItem"><div class="qIcon">${imp.icon}</div><div><b>${imp.name}</b><small>目标 ${u.work.q},${u.work.r}</small><div class="progress"><div class="fill" style="width:${pct}%"></div></div></div><span class="small muted">${Math.max(0,u.work.time-u.work.progress).toFixed(1)}s</span></div>`;}
  if(u.team==='player'){
    if(u.type==='worker')html+=`<div class="switchRow" data-worker-ai-row><div><b>🤖 工人 AI 模式</b><p>自动寻找附近未开发资源，并按地形连续建设。</p></div><label class="toggle"><input type="checkbox" data-worker-ai ${u.aiWorker?'checked':''}><span></span></label></div>`;
    html+=`<div class="sub">单位命令 <span>右键地图规划路线</span></div><div class="actions">`;
    if(u.type==='worker'){const here=tileAt(u.q,u.r),check=canImproveTile(here);html+=`<button class="action ${check.ok?'good':'blocked'}" data-action="build-here" ${check.ok?'':`data-blocked="${check.reason}" aria-disabled="true"`}>${check.ok?`🏗️ 建设${IMPROVEMENTS[check.type].name}`:`🏗️ 不能建设：${check.reason}`}</button>`;}
    if(u.type==='settler')html+=`<button class="action good full" data-action="found-city">🏠 在当前地块建立城市</button>`;
    if(u.def.combat)html+=`<button class="action warn" data-action="overdrive">⚡ 短时强化（消耗25能量）</button>`;
    if(u.def.combat)html+=`<button class="action" data-action="toggle-hold">${u.holdPosition?'🟢 恢复自动索敌':'🛡️ 驻守当前格'}</button>`;
    html+=`<button class="action" data-action="stop-unit">⏹ 停止并解除锁定</button><button class="action" data-action="center-selection">🎯 镜头居中</button></div>`;
  }else html+=`<div class="desc" style="margin-top:10px">选择己方战斗单位后右键此单位，可建立持续追击锁定。</div>`;
  html+='</div>';return html;
}
function productAvailability(city,id){
  const d=productDef(id);if(!hasTech(d.tech))return{ok:false,reason:`需要 ${techById(d.tech)?.name}`};
  if(BUILDING_DEFS[id]&&(city.buildings.includes(id)||city.queue.some(x=>x.id===id)))return{ok:false,reason:'已拥有/已排队'};
  if(!canAfford(d.cost))return{ok:false,reason:'资源不足'};if(city.queue.length>=7)return{ok:false,reason:'队列已满'};return{ok:true,reason:'可生产'};
}
function renderCitySelection(c){
  const icon=c.team==='player'?(c.capital?'🏠':'🏙️'):'🏰',y=cityYield(c);let tags=badge(c.capital?'首都核心':'区域城市',c.team==='player'?'good':'danger');
  for(const b of c.buildings)tags+=badge(`${BUILDING_DEFS[b].icon} ${BUILDING_DEFS[b].name}`,'cyan');if(c.shield>0)tags+=badge(`🫧 护盾 ${Math.ceil(c.shield)}/${c.maxShield}`,'cyan');
  if(c.rallyPoint)tags+=badge(`🎌 集结 ${c.rallyPoint.q},${c.rallyPoint.r}`,'cyan');
  let html=`<div class="card"><div class="hero"><div class="heroIcon">${icon}</div><div><h2>${c.name}</h2><p>${c.team==='player'?'城市会自然产生基础资源，并同时维护独立建造队列。':'灰烬军团的核心堡垒，防御与生产能力均弱于玩家。'}</p>${healthBar(c.hp,c.maxHp)}${c.maxShield?healthBar(c.shield,c.maxShield,'linear-gradient(90deg,#7c73ff,#59dcff)'):''}</div></div><div class="badges">${tags}</div><div class="stats">${stat('人口',c.population)}${stat('队列',c.queue.length+'/7')}${stat('基础产出',yieldText(y))}${stat('坐标',`${c.q}, ${c.r}`)}</div>`;
  if(c.team==='player'){
    html+=`<div class="sub">集结点 <span>${c.rallyPoint?`战斗单位完成后前往 ${c.rallyPoint.q},${c.rallyPoint.r}`:'选中城市后右键地图设置'}</span></div><div class="actions"><button class="action ${c.rallyPoint?'':'blocked'} full" data-action="clear-rally" ${c.rallyPoint?'':'data-blocked="当前城市还没有集结点" aria-disabled="true"'}>🎌 清除集结点</button></div>`;
    html+=`<div class="sub">建造队列 <span>取消后资源全额退回</span></div><div class="queue">`;
    if(!c.queue.length)html+=`<div class="empty">队列为空。下方点击多个项目可连续排队。</div>`;
    c.queue.forEach((item,i)=>{const d=productDef(item.id),pct=item.progress/item.time*100;html+=`<div class="queueItem"><div class="qIcon">${d.icon}</div><div><b>${i===0?'▶ ':''}${d.name}</b><small>${i===0?`${Math.max(0,item.time-item.progress).toFixed(1)} 秒后完成`:'等待前项完成'} · ${costText(item.cost)}</small><div class="progress"><div class="fill" style="width:${i===0?pct:0}%"></div></div></div><button class="miniBtn" data-cancel="${item.qid}">取消</button></div>`;});
    html+=`</div><div class="sub">可生产项目 <span>单位和城市建筑都在这里排队</span></div><p class="desc">城市建筑不是工人去地图上建；直接点击下方标着“建筑”的项目，它会进入本城队列，完成后立刻生效。</p><div class="products">`;
    for(const [idx,id] of PRODUCT_IDS.entries()){const d=productDef(id),av=productAvailability(c,id),isBuilding=!!BUILDING_DEFS[id],hot=idx<10?['1','2','3','4','5','6','7','8','9','0'][idx]:'';html+=`<button class="product" data-product="${id}" ${av.ok?'':'disabled'}><div class="pIcon">${d.icon}</div><div><b>${hot?`[${hot}] `:''}${d.name} ${isBuilding?'· 建筑':'· 单位'}</b><p>${d.desc}</p><span class="small ${av.ok?'muted':'danger'}">${hot?`快捷键 ${hot} · `:''}${av.reason}</span></div><div class="cost"><span>⏱ ${d.time.toFixed(1)}s</span><span>${costText(d.cost)}</span></div></button>`;}
    html+=`</div>`;
  }else html+=`<div class="sub">攻击提示 <span>敌方能力弱化</span></div><p class="desc">锁定灰烬要塞后，远程单位会在射程外自动停下并持续开火；近战单位会追至相邻格。</p>`;
  html+='</div>';return html;
}
function renderTileSelection(t){
  const terrain=TERRAIN[t.terrain],res=t.resource?RESOURCE_DEFS[t.resource]:null,imp=t.improvement?IMPROVEMENTS[t.improvement.type]:null,city=cityAt(t.q,t.r),y=tileYield(t),check=canImproveTile(t);
  const workerJob=state.units.find(u=>u.team==='player'&&u.type==='worker'&&u.work&&u.work.q===t.q&&u.work.r===t.r);
  const displayYield=imp?y:res?res.yield:{};
  let tags=badge(`${terrain.icon} ${terrain.name}`,'cyan');if(res)tags+=badge(`${res.icon} ${res.name}`,'warn');if(imp)tags+=badge(`${imp.icon} 已开发`,'good');if(t.ruin)tags+=badge('✨ 星火遗迹','warn');if(city?.capital)tags+=badge('主城禁建额外设施','danger');
  const status=imp?'已建成：下方产出已经计入每次资源脉冲':workerJob?`${workerJob.work.building?'建设中':'工人前往中'}：${Math.max(0,workerJob.work.time-workerJob.work.progress).toFixed(1)} 秒左右完成`:res?'未建成：先派工人开发，完成后才会产出':'普通地块：可按地形建设基础设施';
  let html=`<div class="card"><div class="hero"><div class="heroIcon">${imp?.icon||res?.icon||terrain.icon}</div><div><h2>${imp?.name||res?.name||terrain.name}地块</h2><p>六边形坐标 ${t.q}, ${t.r}。${imp?imp.desc:res?'尚未开发的战略资源，可派工人自动建设。':'可根据地形部署对应采集设施。'}</p>${t.improvement?healthBar(t.improvement.hp,t.improvement.maxHp):''}</div></div><div class="badges">${tags}</div><div class="sub">建设状态 <span>${status}</span></div>${workerJob?`<div class="progress"><div class="fill" style="width:${workerJob.work.progress/workerJob.work.time*100}%"></div></div>`:''}<div class="sub">${imp?'实际每脉冲产出':'潜在每脉冲产出'} <span>${imp?yieldText(y):res?`${yieldText(displayYield)}（未计入）`:'未计入收入'}</span></div><div class="yields">`;
  for(const k of RESOURCE_KEYS)html+=`<div class="yield">${RESOURCE_META[k].icon} ${RESOURCE_META[k].name} <b>+${displayYield[k]||0}</b></div>`;html+=`</div>`;
  if(res&&!imp)html+=`<p class="desc">潜在产出：${yieldText(res.yield)}。当前还没有设施，所以这些数字尚未加入资源收入。</p>`;
  if(imp)html+=`<p class="desc">设施已建成：当前地块每次资源脉冲实际贡献 ${yieldText(y)}。顶部资源卡的绿色数字已经包含这部分收入。</p>`;
  html+=`<div class="sub">地块操作 <span>${check.ok?`建议：${IMPROVEMENTS[check.type].name}`:check.reason}</span></div><div class="actions">`;
  if(!t.improvement&&!city){const blockedReason=workerJob?'已经有工人在处理这个地块':check.reason,canDispatch=check.ok&&!workerJob;html+=`<button class="action ${canDispatch?'good':'blocked'} full" data-action="dispatch-worker" ${canDispatch?'':`data-blocked="${blockedReason}" aria-disabled="true"`}>👷 派最近工人开发</button>`;}
  if(t.improvement)html+=`<button class="action danger" data-action="destroy-improvement">💥 手工拆除设施</button>`;
  if(t.resource)html+=`<button class="action danger" data-action="destroy-resource">🗑️ 摧毁战略资源</button>`;
  html+=`<button class="action" data-action="center-selection">🎯 镜头居中</button></div></div>`;return html;
}
function renderSelection(){
  const obj=selectedObject();if(!obj){$('selKind').textContent='等待选择';$('selection').innerHTML='<div class="card empty">点击城市、单位或资源地块查看详情。<br>选择己方单位后，右键地图下达持续路线命令。</div>';return;}
  if(state.selection.kind==='unit'){$('selKind').textContent=obj.team==='player'?'己方单位':'敌方目标';$('selection').innerHTML=renderUnitSelection(obj);}
  else if(state.selection.kind==='units'){const units=state.selection.ids.map(unitById).filter(Boolean),combat=units.filter(u=>u.def.combat).length,workers=units.filter(u=>u.type==='worker').length;$('selKind').textContent='多选编队';$('selection').innerHTML=`<div class="card"><div class="hero"><div class="heroIcon">⬚</div><div><h2>${units.length} 个己方单位</h2><p>右键地图让整队移动；右键敌人让可战斗单位攻击；按 A 会对当前鼠标指向执行同样命令。</p></div></div><div class="stats">${stat('战斗单位',combat)}${stat('工人',workers)}${stat('路线中',units.filter(u=>u.route.length).length)}${stat('锁定目标',units.filter(u=>u.target).length)}</div><div class="actions"><button class="action" data-action="stop-unit">⏹ 停止整队</button></div></div>`;}
  else if(state.selection.kind==='city'){$('selKind').textContent=obj.team==='player'?'城市管理':'敌方要塞';$('selection').innerHTML=renderCitySelection(obj);}
  else{$('selKind').textContent=obj.improvement?'资源设施':'地图地块';$('selection').innerHTML=renderTileSelection(obj);}
}
function renderGlobal(){
  const ours=state.units.filter(u=>u.team==='player').length,enemies=state.units.filter(u=>u.team==='enemy').length,cities=state.cities.filter(c=>c.team==='player'&&c.hp>0).length;
  $('global').innerHTML=`<div class="row"><b>🌌 文明总览</b><span class="small muted">评分 ${fmt(state.score)}</span></div><div class="globalGrid" style="margin-top:8px"><div><b>${ours}</b><span>己方单位</span></div><div><b>${enemies}</b><span>敌军单位</span></div><div><b>${cities}</b><span>城市</span></div><div><b>${state.completed.size}/${TECHS.length}</b><span>科技</span></div><div><b>${state.speed.toFixed(1)}×</b><span>模拟倍率</span></div><div><b>${ERAS[state.era].icon}</b><span>${ERAS[state.era].name}</span></div></div><p class="desc"><b style="color:var(--cyan)">核心系统：</b>资源遗迹、兵种配合、光棱组网、短时强化、量子跃迁、城市护盾都会影响实时战局。</p>`;
}
function renderLogs(){$('logList').innerHTML=state.logs.map(l=>`<div class="logLine ${l.type}"><b>${String(Math.floor(l.time)).padStart(3,'0')}s</b> · ${l.text}</div>`).join('')||'<div class="logLine">文明纪事等待第一条记录……</div>';}
function renderPanels(){renderTop();renderResearchPanel();renderSelection();renderGlobal();renderLogs();}

function centerOn(q,r){const p=axialToWorld(q,r);state.camera.x=p.x;state.camera.y=p.y;}
function stopUnit(u){u.route=[];u.moveProgress=0;u.target=null;u.manualTarget=false;if(u.type==='worker')u.work=null;toast(`${u.def.name} 已停止当前命令。`);renderPanels();}
function toggleHoldPosition(u){if(!u?.def?.combat||u.team!=='player')return;u.holdPosition=!u.holdPosition;if(u.holdPosition){u.route=[];u.moveProgress=0;u.target=null;u.manualTarget=false;toast(`${u.def.name} 将驻守当前格，不再主动追击。`,'good');}else toast(`${u.def.name} 恢复自动索敌。`,'good');renderPanels();}
function dispatchNearestWorker(tile){
  const workers=state.units.filter(u=>u.team==='player'&&u.type==='worker'&&u.charges>0&&!u.work).sort((a,b)=>hexDistance(a,tile)-hexDistance(b,tile));
  for(const u of workers)if(assignWorkerBuild(u,tile,true)){state.selection={kind:'unit',id:u.id};renderPanels();return;}
  toast(workers.length?'没有工人能走到这个地块。':'没有空闲且有建设次数的工人。','warn');
}
function demolishImprovement(tile){if(!tile.improvement)return;const n=IMPROVEMENTS[tile.improvement.type].name;tile.improvement=null;toast(`已手工拆除 ${n}。`,'warn');addLog(`💥 玩家拆除了 ${n}。`,'warn');renderPanels();}
function destroyResource(tile){if(!tile.resource)return;const n=RESOURCE_DEFS[tile.resource].name;tile.resource=null;toast(`战略资源「${n}」已被永久摧毁。`,'danger');addLog(`🗑️ 玩家永久清除了 ${n}。`,'danger');renderPanels();}

$('techTree').addEventListener('click',e=>{const b=e.target.closest('[data-tech]');if(b){if(tutorial.active)tutorial.flags.researchChoiceTouched=true;startResearch(b.dataset.tech,false);}});
$('aiTech').addEventListener('change',e=>{if(tutorial.active)tutorial.flags.researchChoiceTouched=true;state.aiTech=e.target.checked;if(state.aiTech)chooseAIResearch();renderPanels();toast(state.aiTech?'🤖 AI 科研助理已开启。':'AI 科研助理已关闭。');});
$('selection').addEventListener('change',e=>{
  if(!e.target.matches('[data-worker-ai]'))return;const u=selectedObject();if(u?.type!=='worker')return;
  u.aiWorker=e.target.checked;if(u.aiWorker&&!u.work)chooseWorkerTask(u);toast(u.aiWorker?'🤖 工人 AI 已开启。':'工人 AI 已关闭。');renderPanels();
});
$('selection').addEventListener('click',e=>{
  const workerRow=e.target.closest('[data-worker-ai-row]');if(workerRow&&!e.target.closest('.toggle')){const input=workerRow.querySelector('[data-worker-ai]');if(input){input.checked=!input.checked;input.dispatchEvent(new Event('change',{bubbles:true}));}return;}
  const product=e.target.closest('[data-product]');if(product){const c=selectedObject();if(c?.allyAI){toast('盟友城市使用自己的资源和队列，不能用你的资源手动下单。','warn');return;}if(c)queueProduct(c,product.dataset.product);return;}
  const cancel=e.target.closest('[data-cancel]');if(cancel){const c=selectedObject();if(c)cancelQueue(c,cancel.dataset.cancel);return;}
  const action=e.target.closest('[data-action]');if(!action)return;if(action.dataset.blocked){toast(action.dataset.blocked,'warn');return;}const obj=selectedObject(),a=action.dataset.action;
  if(a==='toggle-worker-ai'&&obj?.type==='worker'){obj.aiWorker=!obj.aiWorker;if(obj.aiWorker&&!obj.work)chooseWorkerTask(obj);toast(obj.aiWorker?'🤖 工人 AI 已开启。':'工人 AI 已关闭。');renderPanels();}
  else if(a==='build-here'&&obj?.type==='worker')assignWorkerBuild(obj,tileAt(obj.q,obj.r),true);
  else if(a==='found-city'&&obj?.type==='settler')foundCity(obj);
  else if(a==='overdrive'&&obj?.def?.combat)activateOverdrive(obj);
  else if(a==='toggle-hold'&&obj?.def?.combat)toggleHoldPosition(obj);
  else if(a==='stop-unit'&&state.selection?.kind==='units'){for(const u of state.selection.ids.map(unitById).filter(Boolean))stopUnit(u);renderPanels();}
  else if(a==='stop-unit'&&obj?.def)stopUnit(obj);
  else if(a==='clear-rally'&&obj?.team==='player'){obj.rallyPoint=null;toast('已清除城市集结点。','good');renderPanels();}
  else if(a==='center-selection'){if(obj?.q!==undefined)centerOn(obj.q,obj.r);}
  else if(a==='dispatch-worker'&&obj?.q!==undefined)dispatchNearestWorker(obj);
  else if(a==='destroy-improvement'&&obj?.q!==undefined)demolishImprovement(obj);
  else if(a==='destroy-resource'&&obj?.q!==undefined)destroyResource(obj);
});


// ===== 可选新手教程：高亮、练习检测与停火保护 =====
const tutorial={active:false,step:0,fromIntro:false,flags:{},checkTimer:0};
const TUTORIAL_STEPS=[
  {icon:'🎓',title:'欢迎来到星火纪元',subtitle:'先记住一个核心循环，其他系统会自然串起来。',target:null,place:'center',body:`你的目标是发展文明，并最终摧毁地图右侧的 <em>灰烬要塞</em>。玩法核心只有五步：<div class="loop"><span>🏠 城市产资源</span><span>🔬 研发科技</span><span>🏭 排队生产</span><span>🧭 指挥单位</span><span>⚔️ 摧毁要塞</span></div><br>教程期间会开启 <b>新手停火保护</b>：敌军不会推进或增援，但你的资源、建造、科研和移动仍照常运行。`,tip:'所有练习都可以跳过；教程结束后敌军才恢复行动。'},
  {icon:'🌾',title:'资源与战略脉冲',subtitle:'拥有城市，就会持续获得基础收入。',target:'.resources',place:'below',body:`顶部五种资源分别是：<b>食物</b>用于人口与开拓，<b>生产</b>用于单位和建筑，<b>科研</b>用于科技，<b>金币</b>用于综合建设，<b>能量</b>用于高级单位、护盾和短时强化。<br><br>每经过 <em>1 个模拟秒</em>，城市和已开发设施会结算一次产出；资源卡下方的绿色数字就是每次脉冲的增加量。`,tip:'城市本身会自然产出资源，所以即使暂时不操作，文明也会成长。'},
  {icon:'🏠',title:'管理城市与建造队列',subtitle:'主城是你生产军队和特殊建筑的核心。',target:'#selection',place:'left',select:'city',task:'在右侧“可生产项目”中点击任意单位或建筑，把它加入建造队列。',check:'queue',body:`我已经替你选中了主城 <b>曙光城</b>。右侧面板上方显示生命、人口和产出；中间是 <em>建造队列</em>；下方是可生产项目。<br><br><b>城市建筑也在这里建</b>，不是派工人去地图上建。点击标着“建筑”的项目，它会进入城市队列，完成后加成自动生效。你可以连续加入多个项目，它们会按顺序完成。点击队列项目右侧的“取消”，会 <b>全额退回资源</b>。`,tip:'前期推荐先造一个作战单位或工人。主城所在格不能再叠加采集设施。'},
  {icon:'🧠',title:'研发树与 AI 助理',subtitle:'科技会解锁兵种、建筑和新的时代。',target:'#techScroll',place:'right',select:'tech',task:'点击一项可用科技开始研发，或者勾选“AI 科研助理”让它自动选择。',check:'research',body:`左侧是完整研发树。发亮且资源足够的科技可以手动点击；每项科技都有前置条件和数秒研发时间。<br><br>不想逐项管理时，勾选 <b>🤖 AI 科研助理</b>，它会在科研资源允许时自动推进整棵科技树。`,tip:'教程开局默认暂时关闭科研 AI，方便你看清选择过程；直接开始游戏时仍默认开启。'},
  {icon:'🧭',title:'选择单位并规划路线',subtitle:'单位不是拖动操作，先选中再下命令。',target:'#game',place:'inside-right',select:'warrior',task:'左键确认选中近卫军，再在地图远处的可通行地块点一次右键，看到持续显示的虚线路线。',check:'route',body:`我已经选中并居中了你的近卫军。地图上 <b>左键</b>点选城市、单位或资源地块；也可以 <b>按住左键拖框</b>一次选中多个己方单位。选中己方单位后，在远处空地 <em>右键</em>，系统会用六边形寻路规划完整路线。<br><br><b>鼠标靠近地图边缘会自动滚动视野。</b> 单位会按固定时钟周期逐格前进，虚线会一直保留到抵达目的地。`,tip:'水域和山脉通常不可通行；基洛夫飞艇等飞行单位可以无视地形。'},
  {icon:'🎯',title:'锁敌、追击与驻守',subtitle:'战斗单位可自动作战，也可以固定守一个格子。',target:'.mission',place:'below',select:'warrior',body:`己方战斗单位周围 <em>3 格</em>内出现敌人时，默认会自动锁定并攻击。你也可以先选中己方作战单位，再对敌军 <b>右键</b>：单位会显示 🎯 标记，持续追赶，并在合适射程停下开火。<br><br>如果你想让部队站在当前格子不要主动追击，点右侧 <b>驻守当前格</b>。驻守后单位仍会攻击自己射程内的敌人，但不会追出当前格；你手动右键移动或右键敌人时，会自动取消驻守。`,tip:'多个不同职责的兵种靠近会有兵种配合加成；多辆光棱坦克靠近会获得组网加成。'},
  {icon:'👷',title:'工人 AI 与资源开发',subtitle:'工人会因地制宜自动建设，最多完成五项工程。',target:'#selection',place:'left',select:'worker',task:'在右侧面板勾选“工人 AI 模式”。',check:'workerAI',body:`我已经选中了工人。开启右侧的 <b>工人 AI 模式</b>后，它会自动寻找附近未开发资源，并按地形建设农场、矿山、实验站、萃取井或永续伐木场。<br><br>每名工人有 <em>5 次建设次数</em>，完成第五项工程后退役。工人靠近受伤的友军、城市或设施时还会自动维修。`,tip:'也可以直接点击一个资源地块，再使用“派最近工人开发”进行手动指派。'},
  {icon:'⏱️',title:'时间倍率与暂停',subtitle:'这里控制的是整个模拟世界，而不只是动画速度。',target:'.topControls',place:'below',task:'拖动倍率滑块，或者点击暂停/继续按钮试一次。',check:'speed',body:`顶部滑块可从 <b>0.1×</b> 调到 <b>10×</b>。它会同时影响资源脉冲、生产、科研、移动、维修和战斗。<br><br>点击“暂停”或按 <span class="key">P</span> 可以冻结模拟；暂停时仍可查看面板、选择单位和预先下达路线。`,tip:'需要精细指挥时用 0.5×—1×；等待生产和科研时可升到 5×—10×。'},
  {icon:'🗺️',title:'视野、缩放与快捷键',subtitle:'地图会在鼠标靠近边缘时自动滚动。',target:'.mapBottom',place:'above',task:'把鼠标移到地图边缘滚动视野、按 WASD 或方向键移动视野，或按住空格查看全军名称与血条。',check:'view',body:`鼠标靠近地图边缘会自动平移视野；也可使用 <span class="key">W</span><span class="key">A</span><span class="key">S</span><span class="key">D</span> 或 <span class="key">↑</span><span class="key">↓</span><span class="key">←</span><span class="key">→</span> 平移。鼠标滚轮以指针位置为中心缩放；点击右下角战术雷达可快速跳转。<div class="keys"><span class="key">A</span> 对鼠标指向执行移动/攻击 <span class="key">G</span> 打开上次生产基地 <span class="key">1-9/0</span> 城市生产快捷键 <span class="key">空格</span> 显示名称血条 <span class="key">P</span> 暂停/继续 <span class="key">F1</span> 打开教程</div>`,tip:'左键拖框现在用于框选单位，不再拖动地图。'},
  {icon:'🌌',title:'准备建立你的文明',subtitle:'教程结束，新手停火保护即将解除。',target:'.mission',place:'below',body:`现在你已经掌握完整流程：<b>看资源 → 选科技 → 城市排队 → 工人开发 → 单位寻路 → 锁敌作战</b>。<br><br>最终目标是摧毁 <em>灰烬要塞</em>。推荐路线：先发展生产与科研，再解锁主战坦克、光棱坦克或基洛夫飞艇，组成兵种配合部队向地图右侧推进。`,tip:'完成教程会获得一次性新手补给。之后可按 F1 重新查看教程，或按 ? 打开详细帮助。'}
];
function tutorialSelected(type){
  if(type==='city')return state.cities.find(c=>c.team==='player'&&c.capital&&c.hp>0);
  if(type==='worker')return state.units.find(u=>u.team==='player'&&u.type==='worker'&&u.hp>0);
  if(type==='warrior')return state.units.find(u=>u.team==='player'&&u.def.combat&&u.hp>0);
  return null;
}
function tutorialTaskDone(step=TUTORIAL_STEPS[tutorial.step]){
  if(!step?.check)return false;tutorial.flags.completed=tutorial.flags.completed||{};if(tutorial.flags.completed[step.check])return true;let done=false;
  if(step.check==='queue')done=state.cities.some(c=>c.team==='player'&&c.queue.length>0);
  else if(step.check==='research')done=!!state.research||state.completed.size>0||state.aiTech;
  else if(step.check==='route')done=state.units.some(u=>u.team==='player'&&u.route.length>0);
  else if(step.check==='workerAI')done=state.units.some(u=>u.team==='player'&&u.type==='worker'&&u.aiWorker);
  else if(step.check==='speed')done=!!(tutorial.flags.speedTouched||tutorial.flags.pauseTouched||Math.abs(state.speed-1)>.001);
  else if(step.check==='view')done=!!tutorial.flags.viewAction;
  if(done)tutorial.flags.completed[step.check]=true;return done;
}
function updateTutorialTask(){
  if(!tutorial.active)return;const step=TUTORIAL_STEPS[tutorial.step],box=$('tutorialTask');
  if(!step.task){box.classList.add('hidden');return;}box.classList.remove('hidden');const done=tutorialTaskDone(step);box.classList.toggle('done',done);$('tutorialTaskIcon').textContent=done?'✓':'○';$('tutorialTaskText').textContent=done?`已完成：${step.task}`:step.task;
}
function tutorialTarget(step){try{return step.target?document.querySelector(step.target):null;}catch{return null;}}
function placeTutorial(){
  if(!tutorial.active)return;const step=TUTORIAL_STEPS[tutorial.step],card=$('tutorialCard'),spot=$('tutorialSpotlight'),target=tutorialTarget(step),vw=window.innerWidth,vh=window.innerHeight,margin=13,gap=16;
  if(!target){spot.className='tutorialSpotlight center';spot.style.left='50%';spot.style.top='50%';spot.style.width='0';spot.style.height='0';const cr=card.getBoundingClientRect();card.style.left=Math.round((vw-cr.width)/2)+'px';card.style.top=Math.round((vh-cr.height)/2)+'px';return;}
  const r=target.getBoundingClientRect();if(r.width<4||r.height<4){requestAnimationFrame(placeTutorial);return;}const pad=7;spot.className='tutorialSpotlight';spot.style.left=Math.round(r.left-pad)+'px';spot.style.top=Math.round(r.top-pad)+'px';spot.style.width=Math.round(r.width+pad*2)+'px';spot.style.height=Math.round(r.height+pad*2)+'px';spot.style.borderRadius=(r.height<70?'13px':'17px');
  const cr=card.getBoundingClientRect(),cw=cr.width,ch=cr.height;let left,top;
  const centerY=()=>r.top+(r.height-ch)/2,centerX=()=>r.left+(r.width-cw)/2;
  switch(step.place){
    case'right':left=r.right+gap;top=centerY();break;
    case'left':left=r.left-cw-gap;top=centerY();break;
    case'above':left=centerX();top=r.top-ch-gap;break;
    case'below':left=centerX();top=r.bottom+gap;break;
    case'inside-right':left=r.right-cw-24;top=r.top+105;break;
    case'inside-left':left=r.left+24;top=r.top+105;break;
    default:left=r.right+gap;top=centerY();
  }
  if(left<margin||left+cw>vw-margin){if(r.right+gap+cw<=vw-margin)left=r.right+gap;else if(r.left-gap-cw>=margin)left=r.left-gap-cw;else left=Math.min(vw-margin-cw,Math.max(margin,centerX()));}
  if(top<margin||top+ch>vh-margin){if(r.bottom+gap+ch<=vh-margin)top=r.bottom+gap;else if(r.top-gap-ch>=margin)top=r.top-gap-ch;else top=Math.min(vh-margin-ch,Math.max(margin,r.top+18));}
  card.style.left=Math.round(clamp(left,margin,Math.max(margin,vw-cw-margin)))+'px';card.style.top=Math.round(clamp(top,margin,Math.max(margin,vh-ch-margin)))+'px';
}
function tutorialDemoGoal(unit){
  const preferred=[[8,7],[8,6],[7,8],[7,6],[9,7],[6,5]];
  for(const [q,r] of preferred){const t=tileAt(q,r);if(!t||!Number.isFinite(terrainCost(t,unit)))continue;const path=findPath(unit,{q:unit.q,r:unit.r},{q,r});if(path.length)return t;}
  for(const t of tiles.values())if(isLand(t)&&hexDistance(unit,t)>=3&&hexDistance(unit,t)<=6&&findPath(unit,{q:unit.q,r:unit.r},t).length)return t;
  return null;
}
function demoTutorialStep(){
  if(!tutorial.active)return;const i=tutorial.step;
  if(i===1){state.speed=2;state.paused=false;tutorial.flags.speedTouched=true;toast('▶ 演示：时间调为 2×，观察资源按脉冲增长。','good');}
  else if(i===2){const city=tutorialSelected('city');if(city){state.selection={kind:'city',id:city.id};if(!city.queue.length)queueProduct(city,'worker');else toast('▶ 城市队列已有项目，正在实时生产。','good');}}
  else if(i===3){tutorial.flags.researchChoiceTouched=true;state.aiTech=true;if(!state.research)chooseAIResearch();toast('▶ 演示：AI 科研助理已开启并选择科技。','good');}
  else if(i===4){const unit=tutorialSelected('warrior'),goal=unit&&tutorialDemoGoal(unit);if(unit&&goal){state.selection={kind:'unit',id:unit.id};unit.target=null;unit.manualTarget=false;setUnitRoute(unit,goal.q,goal.r,true);toast('▶ 演示：虚线路线会保留到单位抵达。','good');}}
  else if(i===5){const unit=tutorialSelected('warrior'),targets=unit?allTargetsFor('player').sort((a,b)=>hexDistance(unit,a)-hexDistance(unit,b)):[];if(unit&&targets[0]){state.selection={kind:'unit',id:unit.id};setLockedTarget(unit,targets[0],true);toast('▶ 演示：单位已锁定敌军，会自动追到射程内。','good');}}
  else if(i===6){const worker=tutorialSelected('worker');if(worker){state.selection={kind:'unit',id:worker.id};worker.aiWorker=true;if(!worker.work)chooseWorkerTask(worker);toast(worker.work?'▶ 演示：工人 AI 已找到工程并开始前往。':'▶ 演示：工人 AI 已开启，等待科技或可用地块。','good');}}
  else if(i===7){state.speed=3;state.paused=false;tutorial.flags.speedTouched=true;toast('▶ 演示：模拟已恢复并切换到 3×。','good');}
  else if(i===8){tutorial.flags.viewAction=true;state.showIntel=true;state.camera.zoom=clamp(state.camera.zoom*1.18,.48,1.85);clearTimeout(tutorial.flags.intelTimer);tutorial.flags.intelTimer=setTimeout(()=>{state.showIntel=false;},2200);toast('▶ 演示：全军名称与血条显示 2 秒，并放大视野。','good');}
  renderPanels();updateTutorialTask();requestAnimationFrame(placeTutorial);
}
function enterTutorialStep(index){
  tutorial.step=clamp(index,0,TUTORIAL_STEPS.length-1);const step=TUTORIAL_STEPS[tutorial.step];
  if(step.select==='tech')$('techScroll').scrollTop=0;
  const obj=tutorialSelected(step.select);if(obj){state.selection={kind:obj.def?'unit':'city',id:obj.id};centerOn(obj.q,obj.r);$('rightScroll').scrollTop=0;}
  renderPanels();$('tutorialStepLabel').textContent=`新手教程 ${tutorial.step+1} / ${TUTORIAL_STEPS.length}`;$('tutorialProgressBar').style.width=((tutorial.step+1)/TUTORIAL_STEPS.length*100).toFixed(0)+'%';$('tutorialIcon').textContent=step.icon;$('tutorialTitle').textContent=step.title;$('tutorialSubtitle').textContent=step.subtitle;$('tutorialBody').innerHTML=step.body;$('tutorialTip').textContent='💡 '+step.tip;$('tutorialPrev').disabled=tutorial.step===0;$('tutorialDemo').style.visibility=(tutorial.step===0||tutorial.step===TUTORIAL_STEPS.length-1)?'hidden':'visible';$('tutorialNext').textContent=tutorial.step===TUTORIAL_STEPS.length-1?'完成教程':'下一步';$('tutorialNext').classList.toggle('finish',tutorial.step===TUTORIAL_STEPS.length-1);updateTutorialTask();requestAnimationFrame(()=>{placeTutorial();setTimeout(placeTutorial,80);});
}
function openTutorial(fromIntro=false){
  if(!state.started||state.gameOver)return;tutorial.active=true;tutorial.fromIntro=fromIntro;tutorial.flags={completed:{}};tutorial.checkTimer=0;state.tutorialActive=true;$('tutorial').classList.remove('hidden');enterTutorialStep(0);toast('🛡️ 新手停火保护已开启。','good');addLog('🎓 新手教程启动，敌军暂时停火。','good');canvas.focus();
}
function closeTutorial(completed=false,silent=false){
  if(!tutorial.active)return;const restoreIntroAI=tutorial.fromIntro&&!tutorial.flags.researchChoiceTouched;tutorial.active=false;state.tutorialActive=false;$('tutorial').classList.add('hidden');$('tutorialSpotlight').className='tutorialSpotlight center';clearTimeout(tutorial.flags.intelTimer);state.showIntel=false;if(restoreIntroAI)state.aiTech=true;tutorial.fromIntro=false;
  if(completed){if(!state.tutorialRewarded){state.tutorialRewarded=true;state.resources.production+=35;state.resources.science+=20;state.resources.gold+=45;state.resources.energy+=15;addLog('🎁 完成教程：获得新手文明补给。','good');if(!silent)toast('🎁 教程完成：⚙️35 🔬20 🪙45 ⚡15','good');}else if(!silent)toast('🎓 教程复习完成，新手保护已解除。','good');}
  else if(!silent)toast('已退出教程，新手保护解除。','warn');
  if(state.aiTech&&!state.research)chooseAIResearch();renderPanels();canvas.focus();
}
function beginGame(withTutorial=false){
  state.started=true;state.paused=false;$('intro').classList.add('hidden');state.lastYield=calculateYield();if(withTutorial)state.aiTech=false;addLog('🌌 实时文明模拟启动。','good');if(!withTutorial)chooseAIResearch();renderPanels();canvas.focus();if(withTutorial)openTutorial(true);
}

