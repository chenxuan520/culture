"use strict";

// ===== v3：鼠标/触控拖拽地图；开场隐藏游戏内声音设置 =====
(() => {
  const dragState={pointerId:null,startX:0,startY:0,cameraX:0,cameraY:0,moved:false,suppressUntil:0};
  const threshold=5;

  function beginMapDrag(e){
    if(!state?.started||state.gameOver||!e.isPrimary||(e.button!==0&&e.button!==1))return;
    dragState.pointerId=e.pointerId;
    dragState.startX=e.clientX;dragState.startY=e.clientY;
    dragState.cameraX=state.camera.x;dragState.cameraY=state.camera.y;
    dragState.moved=false;
    try{canvas.setPointerCapture(e.pointerId);}catch{}
    if(e.button===1)e.preventDefault();
  }
  function moveMapDrag(e){
    if(dragState.pointerId!==e.pointerId)return;
    const dx=e.clientX-dragState.startX,dy=e.clientY-dragState.startY;
    if(!dragState.moved&&Math.hypot(dx,dy)<threshold)return;
    if(!dragState.moved){
      dragState.moved=true;
      canvas.classList.add('isMapDragging');
      const tip=$('tooltip');if(tip)tip.style.display='none';
      if(tutorial?.active){tutorial.flags.viewAction=true;updateTutorialTask();}
    }
    state.camera.x=dragState.cameraX-dx/state.camera.zoom;
    state.camera.y=dragState.cameraY-dy/state.camera.zoom;
    clampCamera();
    e.preventDefault();e.stopImmediatePropagation();
  }
  function finishMapDrag(e){
    if(dragState.pointerId!==e.pointerId)return;
    if(dragState.moved)dragState.suppressUntil=performance.now()+350;
    dragState.pointerId=null;dragState.moved=false;
    canvas.classList.remove('isMapDragging');
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

  const settingsLayer=$('settingsLayer'),settingsGear=$('settingsGear'),settingsClose=$('settingsClose');
  function toggleSettings(open){
    if(!settingsLayer)return;
    settingsLayer.classList.toggle('hidden',!open);
    settingsGear?.classList.toggle('active',!!open);
  }
  settingsGear?.addEventListener('click',()=>toggleSettings(settingsLayer.classList.contains('hidden')));
  settingsClose?.addEventListener('click',()=>toggleSettings(false));
  document.addEventListener('click',e=>{
    if(!settingsLayer||settingsLayer.classList.contains('hidden'))return;
    if(settingsLayer.contains(e.target)||settingsGear?.contains(e.target))return;
    toggleSettings(false);
  });
  window.addEventListener('keydown',e=>{if(e.key==='Escape')toggleSettings(false);});

  // Small test hook used only for local verification; harmless during normal play.
  if(window.__STARFIRE_DEBUG__){
    window.__STARFIRE_DEBUG__.camera=()=>({...state.camera});
    window.__STARFIRE_DEBUG__.dragState=()=>({active:dragState.pointerId!==null,suppressUntil:dragState.suppressUntil});
  }
})();
