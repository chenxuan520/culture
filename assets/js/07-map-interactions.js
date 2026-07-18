"use strict";

// ===== v4：框选单位、边缘滚屏；开场隐藏游戏内声音设置 =====
(() => {
  const dragState={pointerId:null,startX:0,startY:0,currentX:0,currentY:0,moved:false,suppressUntil:0};
  const threshold=5;

  function beginMapDrag(e){
    if(!state?.started||state.gameOver||!e.isPrimary||e.button!==0)return;
    dragState.pointerId=e.pointerId;
    dragState.startX=e.clientX;dragState.startY=e.clientY;
    dragState.currentX=e.clientX;dragState.currentY=e.clientY;
    dragState.moved=false;
    try{canvas.setPointerCapture(e.pointerId);}catch{}
  }
  function moveMapDrag(e){
    if(dragState.pointerId!==e.pointerId)return;
    dragState.currentX=e.clientX;dragState.currentY=e.clientY;
    const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;
    if(!dragState.moved&&Math.hypot(dx,dy)<threshold)return;
    if(!dragState.moved){
      dragState.moved=true;
      canvas.classList.add('isBoxSelecting');
      const tip=$('tooltip');if(tip)tip.style.display='none';
      if(tutorial?.active){tutorial.flags.viewAction=true;updateTutorialTask();}
    }
    e.preventDefault();e.stopImmediatePropagation();
  }
  function finishMapDrag(e){
    if(dragState.pointerId!==e.pointerId)return;
    if(dragState.moved){
      const r=canvas.getBoundingClientRect(),x1=Math.min(dragState.startX,dragState.currentX)-r.left,y1=Math.min(dragState.startY,dragState.currentY)-r.top,x2=Math.max(dragState.startX,dragState.currentX)-r.left,y2=Math.max(dragState.startY,dragState.currentY)-r.top;
      const ids=state.units.filter(u=>u.hp>0&&u.team==='player').filter(u=>{const p=worldToScreen(unitDrawPos(u));return p.x>=x1&&p.x<=x2&&p.y>=y1&&p.y<=y2;}).map(u=>u.id);
      if(ids.length){state.selection=ids.length===1?{kind:'unit',id:ids[0]}:{kind:'units',ids};renderPanels();toast(ids.length===1?'已选择 1 个单位':`已框选 ${ids.length} 个单位`,'good');}
      dragState.suppressUntil=performance.now()+350;
    }
    dragState.pointerId=null;dragState.moved=false;
    canvas.classList.remove('isBoxSelecting');
    try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch{}
  }
  canvas.addEventListener('pointerdown',beginMapDrag,true);
  canvas.addEventListener('pointermove',moveMapDrag,true);
  canvas.addEventListener('pointerup',finishMapDrag,true);
  canvas.addEventListener('pointercancel',finishMapDrag,true);
  canvas.addEventListener('lostpointercapture',e=>{if(dragState.pointerId===e.pointerId)finishMapDrag(e);},true);
  canvas.addEventListener('click',e=>{
    if(performance.now()<dragState.suppressUntil){
      dragState.suppressUntil=0;e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  canvas.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});

  const oldDrawMap=drawMap;
  drawMap=function(){
    oldDrawMap();
    if(!dragState.moved)return;
    const r=canvas.getBoundingClientRect(),dpr=state.screen.dpr||1,x=Math.min(dragState.startX,dragState.currentX)-r.left,y=Math.min(dragState.startY,dragState.currentY)-r.top,w=Math.abs(dragState.currentX-dragState.startX),h=Math.abs(dragState.currentY-dragState.startY);
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();ctx.fillStyle='rgba(89,220,255,.10)';ctx.strokeStyle='rgba(89,220,255,.85)';ctx.lineWidth=1.5;ctx.fillRect(x,y,w,h);ctx.strokeRect(x,y,w,h);ctx.restore();
  };

  const settingsLayer=$('settingsLayer'),settingsGear=$('settingsGear'),settingsClose=$('settingsClose');
  const helpLayer=$('helpLayer'),helpGear=$('helpGear'),helpClose=$('helpClose');
  function toggleSettings(open){
    if(!settingsLayer)return;
    settingsLayer.classList.toggle('hidden',!open);
    settingsGear?.classList.toggle('active',!!open);
    if(open)toggleHelp(false);
  }
  function toggleHelp(open){
    if(!helpLayer)return;
    helpLayer.classList.toggle('hidden',!open);
    helpGear?.classList.toggle('active',!!open);
    if(open)toggleSettings(false);
  }
  settingsGear?.addEventListener('click',()=>toggleSettings(settingsLayer.classList.contains('hidden')));
  settingsClose?.addEventListener('click',()=>toggleSettings(false));
  helpGear?.addEventListener('click',()=>toggleHelp(helpLayer.classList.contains('hidden')));
  helpClose?.addEventListener('click',()=>toggleHelp(false));
  document.addEventListener('click',e=>{
    if(settingsLayer&&!settingsLayer.classList.contains('hidden')&&!settingsLayer.contains(e.target)&&!settingsGear?.contains(e.target))toggleSettings(false);
    if(helpLayer&&!helpLayer.classList.contains('hidden')&&!helpLayer.contains(e.target)&&!helpGear?.contains(e.target))toggleHelp(false);
  });
  window.addEventListener('keydown',e=>{
    const tag=e.target?.tagName?.toLowerCase();
    if(e.key==='?'&&tag!=='input'&&tag!=='select'&&tag!=='textarea'){e.preventDefault();toggleHelp(true);return;}
    if(e.key==='Escape'){toggleSettings(false);toggleHelp(false);}
  });

  // Small test hook used only for local verification; harmless during normal play.
  if(window.__STARFIRE_DEBUG__){
    window.__STARFIRE_DEBUG__.camera=()=>({...state.camera});
    window.__STARFIRE_DEBUG__.dragState=()=>({active:dragState.pointerId!==null,suppressUntil:dragState.suppressUntil});
  }
  window.toggleSettingsPanel=toggleSettings;
  window.toggleHelpPanel=toggleHelp;
})();
