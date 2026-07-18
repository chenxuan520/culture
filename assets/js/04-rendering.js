"use strict";

// ===== Canvas 渲染：地形、路线、锁定、光棱组网、粒子与小地图 =====
function resizeCanvases(){
  const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);state.screen={w:Math.max(1,rect.width),h:Math.max(1,rect.height),dpr};
  canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);
  const mr=mini.getBoundingClientRect();mini.width=Math.round(Math.max(1,mr.width)*dpr);mini.height=Math.round(Math.max(1,mr.height)*dpr);mini._cssW=Math.max(1,mr.width);mini._cssH=Math.max(1,mr.height);mini._dpr=dpr;
}
function worldToScreen(p){return{x:(p.x-state.camera.x)*state.camera.zoom+state.screen.w/2,y:(p.y-state.camera.y)*state.camera.zoom+state.screen.h/2};}
function screenToWorld(x,y){return{x:(x-state.screen.w/2)/state.camera.zoom+state.camera.x,y:(y-state.screen.h/2)/state.camera.zoom+state.camera.y};}
function screenToTile(x,y){const w=screenToWorld(x,y),a=worldToAxial(w.x,w.y);return tileAt(a.q,a.r)||null;}
function hexPath(c,x,y,size=HEX){c.beginPath();for(let i=0;i<6;i++){const a=(-90+i*60)*Math.PI/180,px=x+Math.cos(a)*size,py=y+Math.sin(a)*size;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();}
function rgba(hex,a){
  if(hex.startsWith('rgba'))return hex;let h=hex.replace('#','');if(h.length===3)h=h.split('').map(x=>x+x).join('');const n=parseInt(h,16);return`rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;
}
function drawTerrain(){
  for(const t of tiles.values()){
    const p=axialToWorld(t.q,t.r),meta=TERRAIN[t.terrain];hexPath(ctx,p.x,p.y,HEX-1);ctx.fillStyle=meta.fill;ctx.fill();ctx.lineWidth=1/state.camera.zoom;ctx.strokeStyle=meta.edge;ctx.stroke();
    const n=t.decor;
    if(t.terrain==='water'){
      ctx.strokeStyle='rgba(113,206,255,.17)';ctx.lineWidth=1.2/state.camera.zoom;ctx.beginPath();ctx.arc(p.x+(n-.5)*16,p.y+6,12,Math.PI*.15,Math.PI*.85);ctx.stroke();
    }else if(t.terrain==='forest'||t.terrain==='mountain'){
      ctx.globalAlpha=.25;ctx.font=`${17}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(meta.icon,p.x+(n-.5)*17,p.y+7);ctx.globalAlpha=1;
    }else{
      ctx.fillStyle='rgba(255,255,255,.035)';ctx.beginPath();ctx.arc(p.x+(n-.5)*25,p.y+(hashNoise(t.q,t.r,13)-.5)*28,2.2,0,Math.PI*2);ctx.fill();
    }
    if(state.hovered?.q===t.q&&state.hovered?.r===t.r){hexPath(ctx,p.x,p.y,HEX-3);ctx.fillStyle='rgba(255,255,255,.08)';ctx.fill();ctx.lineWidth=2/state.camera.zoom;ctx.strokeStyle='rgba(255,255,255,.52)';ctx.stroke();}
    if(state.selection&&(state.selection.kind==='tile'||state.selection.kind==='improvement')&&state.selection.q===t.q&&state.selection.r===t.r){hexPath(ctx,p.x,p.y,HEX-4);ctx.lineWidth=3/state.camera.zoom;ctx.strokeStyle='#ffd166';ctx.stroke();}
  }
}
function drawRoutes(){
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const u of state.units){
    if(u.team!=='player'||!u.route.length)continue;const selected=state.selection?.kind==='unit'&&state.selection.id===u.id,p=unitDrawPos(u);
    ctx.beginPath();ctx.moveTo(p.x,p.y);for(const step of u.route){const q=axialToWorld(step.q,step.r);ctx.lineTo(q.x,q.y);}ctx.setLineDash([selected?10:7,selected?7:6]);ctx.lineDashOffset=-state.simTime*18;ctx.lineWidth=(selected?3.2:2)/state.camera.zoom;ctx.strokeStyle=selected?'rgba(255,209,102,.95)':'rgba(89,220,255,.57)';ctx.stroke();ctx.setLineDash([]);
    const end=u.route[u.route.length-1],ep=axialToWorld(end.q,end.r);ctx.beginPath();ctx.arc(ep.x,ep.y,9+Math.sin(state.simTime*5)*2,0,Math.PI*2);ctx.lineWidth=2/state.camera.zoom;ctx.strokeStyle=selected?'#ffd166':'#59dcff';ctx.stroke();ctx.font='12px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=selected?'#ffe7a2':'#bff5ff';ctx.fillText('◎',ep.x,ep.y);
  }
}
function drawResourcesAndImprovements(){
  for(const t of tiles.values()){
    if(!t.resource&&!t.improvement&&!t.ruin)continue;const p=axialToWorld(t.q,t.r);
    if(t.ruin){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(state.simTime*.2);ctx.shadowBlur=14;ctx.shadowColor='#c997ff';ctx.font='21px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✨',0,0);ctx.restore();}
    if(t.resource){ctx.beginPath();ctx.arc(p.x-13,p.y-10,12,0,Math.PI*2);ctx.fillStyle='rgba(3,10,18,.72)';ctx.fill();ctx.strokeStyle='rgba(255,209,102,.55)';ctx.lineWidth=1/state.camera.zoom;ctx.stroke();ctx.font='16px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(RESOURCE_DEFS[t.resource].icon,p.x-13,p.y-10);}
    if(t.improvement){
      const imp=IMPROVEMENTS[t.improvement.type];ctx.save();ctx.shadowBlur=state.selection?.q===t.q&&state.selection?.r===t.r?14:5;ctx.shadowColor=t.improvement.team==='player'?'#66e7a7':'#ff6d7e';ctx.beginPath();ctx.arc(p.x+5,p.y+5,17,0,Math.PI*2);ctx.fillStyle='rgba(6,19,28,.9)';ctx.fill();ctx.lineWidth=2/state.camera.zoom;ctx.strokeStyle=t.improvement.team==='player'?'#66e7a7':'#ff6d7e';ctx.stroke();ctx.shadowBlur=0;ctx.font='21px system-ui';ctx.fillText(imp.icon,p.x+5,p.y+5);ctx.restore();
      const y=tileYield(t);ctx.font='bold 8px system-ui';ctx.textAlign='center';ctx.fillStyle='#bff7d7';ctx.fillText(yieldText(y),p.x,p.y+29);
      if(t.improvement.hp<t.improvement.maxHp){drawWorldHealth(p.x-20,p.y+33,40,4,t.improvement.hp/t.improvement.maxHp,'#66e7a7');}
    }
  }
}
function drawWorldHealth(x,y,w,h,pct,color='#66e7a7'){
  ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(x,y,w,h);ctx.fillStyle=color;ctx.fillRect(x+1,y+1,(w-2)*clamp(pct,0,1),h-2);
}
function drawCities(){
  for(const c of state.cities){if(c.hp<=0)continue;const p=axialToWorld(c.q,c.r),player=c.team==='player',selected=state.selection?.kind==='city'&&state.selection.id===c.id;
    ctx.save();ctx.shadowBlur=selected?24:10;ctx.shadowColor=player?'#59dcff':'#ff6d7e';ctx.beginPath();ctx.arc(p.x,p.y,31,0,Math.PI*2);ctx.fillStyle=player?'rgba(16,65,86,.96)':'rgba(79,27,38,.96)';ctx.fill();ctx.lineWidth=(selected?4:2.5)/state.camera.zoom;ctx.strokeStyle=player?'#71e2ff':'#ff7889';ctx.stroke();
    ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?27:34,xx=p.x+Math.cos(a)*r,yy=p.y+Math.sin(a)*r;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.closePath();ctx.lineWidth=1.2/state.camera.zoom;ctx.strokeStyle=player?'rgba(173,241,255,.55)':'rgba(255,174,184,.5)';ctx.stroke();ctx.shadowBlur=0;
    if(c.flash>0){ctx.beginPath();ctx.arc(p.x,p.y,36+c.flash*7,0,Math.PI*2);ctx.strokeStyle=`rgba(255,255,255,${c.flash*.7})`;ctx.lineWidth=3/state.camera.zoom;ctx.stroke();}
    ctx.font=`${c.capital?31:27}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(player?(c.capital?'🏠':'🏙️'):'🏰',p.x,p.y-2);ctx.restore();
    if(c.shield>0){ctx.beginPath();ctx.arc(p.x,p.y,39,0,Math.PI*2);ctx.strokeStyle='rgba(89,220,255,.55)';ctx.lineWidth=2.2/state.camera.zoom;ctx.setLineDash([5,4]);ctx.lineDashOffset=-state.simTime*12;ctx.stroke();ctx.setLineDash([]);}
    drawWorldHealth(p.x-30,p.y+38,60,6,c.hp/c.maxHp,player?'#66e7a7':'#ff6d7e');
    ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='#edf8ff';ctx.fillText(c.name,p.x,p.y-38);
    if(c.team==='player'&&c.queue.length){const item=c.queue[0],d=productDef(item.id);ctx.font='13px system-ui';ctx.fillText(`${d.icon} ${Math.max(0,item.time-item.progress).toFixed(1)}s`,p.x,p.y+57);}
  }
}
function unitStackOffset(unit){
  const same=state.units.filter(u=>u.hp>0&&u.q===unit.q&&u.r===unit.r&&u.team===unit.team),i=same.findIndex(u=>u.id===unit.id);if(same.length<=1||unit.route.length)return{x:0,y:0};const a=i/same.length*Math.PI*2;return{x:Math.cos(a)*9,y:Math.sin(a)*7};
}
function drawPrismNetworks(){
  const prisms=state.units.filter(u=>u.hp>0&&u.team==='player'&&u.type==='prism'),range=buildingOwned('prismMatrix')?4:3;ctx.save();ctx.globalCompositeOperation='lighter';
  for(let i=0;i<prisms.length;i++)for(let j=i+1;j<prisms.length;j++)if(hexDistance(prisms[i],prisms[j])<=range){const a=unitDrawPos(prisms[i]),b=unitDrawPos(prisms[j]),pulse=.28+Math.sin(state.simTime*8+i+j)*.12;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=`rgba(104,218,255,${pulse})`;ctx.lineWidth=2/state.camera.zoom;ctx.setLineDash([4,5]);ctx.lineDashOffset=-state.simTime*20;ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();
}
function drawTargetLocks(){
  for(const u of state.units){const t=resolveTarget(u.target);if(!t||u.team!=='player')continue;const a=unitDrawPos(u),b=targetPosition(t),selected=state.selection?.id===u.id;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.setLineDash([4,7]);ctx.lineDashOffset=state.simTime*13;ctx.lineWidth=(selected?2.2:1.25)/state.camera.zoom;ctx.strokeStyle=selected?'rgba(255,109,126,.9)':'rgba(255,109,126,.42)';ctx.stroke();ctx.setLineDash([]);
    ctx.beginPath();ctx.arc(b.x,b.y,22+Math.sin(state.simTime*7)*2,0,Math.PI*2);ctx.strokeStyle=selected?'#ff6d7e':'rgba(255,109,126,.55)';ctx.lineWidth=1.7/state.camera.zoom;ctx.stroke();ctx.font='13px system-ui';ctx.textAlign='center';ctx.fillStyle='#ffb2bb';ctx.fillText('🎯',b.x,b.y-28);
  }
}
function drawActiveCombat(){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const u of state.units){const t=resolveTarget(u.target);if(!t||u.combatGlow<=0||hexDistance(u,t)>(u.def.range||1))continue;const a=unitDrawPos(u),b=targetPosition(t),pulse=.08+.17*(.5+.5*Math.sin(performance.now()/75+u.id.length));
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=u.type==='prism'?`rgba(98,220,255,${pulse*2.3})`:u.type==='quantumWalker'?`rgba(201,151,255,${pulse*2})`:u.team==='player'?`rgba(255,209,102,${pulse})`:`rgba(255,109,126,${pulse})`;ctx.lineWidth=(u.type==='prism'?3:1.4)/state.camera.zoom;ctx.stroke();
  }ctx.restore();
}
function drawUnits(){
  for(const u of state.units){if(u.hp<=0)continue;let p=unitDrawPos(u),off=unitStackOffset(u);p={x:p.x+off.x,y:p.y+off.y};const player=u.team==='player',selected=state.selection?.kind==='unit'&&state.selection.id===u.id,r=u.type==='kirov'?23:18;
    ctx.save();ctx.shadowBlur=selected?23:u.combatGlow>0?15:6;ctx.shadowColor=player?'#59dcff':'#ff6d7e';ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=player?'rgba(12,49,72,.96)':'rgba(73,22,35,.96)';ctx.fill();ctx.lineWidth=(selected?3.4:2)/state.camera.zoom;ctx.strokeStyle=player?'#72e4ff':'#ff7587';ctx.stroke();ctx.shadowBlur=0;
    if(u.overdrive>0){ctx.beginPath();ctx.arc(p.x,p.y,r+5+Math.sin(state.simTime*10)*2,0,Math.PI*2);ctx.strokeStyle='rgba(255,209,102,.8)';ctx.lineWidth=2/state.camera.zoom;ctx.stroke();}
    ctx.font=`${u.type==='kirov'?27:22}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(u.def.icon,p.x,p.y);ctx.restore();
    if(u.type==='worker'&&u.aiWorker){ctx.font='10px system-ui';ctx.fillText('🤖',p.x+r-2,p.y-r+2);}if(u.target){ctx.font='9px system-ui';ctx.fillText('🎯',p.x-r+1,p.y-r+1);}
    if(u.def.combat&&u.combatGlow>0){const interval=(u.def.interval||1)*(u.overdrive>0?.72:1),pct=clamp(u.attackTimer/interval,0,1);ctx.beginPath();ctx.arc(p.x,p.y,r+7,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);ctx.strokeStyle=player?'#ffd166':'#ff6d7e';ctx.lineWidth=2.5/state.camera.zoom;ctx.stroke();}
    const show=state.showIntel||selected||u.combatGlow>0||u.hp<u.maxHp;if(show){drawWorldHealth(p.x-23,p.y+r+6,46,5,u.hp/u.maxHp,player?'#66e7a7':'#ff6d7e');ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='#f0f9ff';ctx.fillText(u.def.name,p.x,p.y-r-7);}
    if(u.work?.building){const pct=u.work.progress/u.work.time;ctx.beginPath();ctx.arc(p.x,p.y,r+10,-Math.PI/2,-Math.PI/2+pct*Math.PI*2);ctx.strokeStyle='#66e7a7';ctx.lineWidth=3/state.camera.zoom;ctx.stroke();}
  }
}
function drawEffects(){
  for(const e of state.effects){const alpha=clamp(e.life/(e.max||1),0,1);ctx.save();ctx.globalAlpha=alpha;
    if(e.type==='beam'){ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.moveTo(e.x1,e.y1);ctx.lineTo(e.x2,e.y2);ctx.strokeStyle=e.color;ctx.lineWidth=e.width/state.camera.zoom;ctx.shadowBlur=10;ctx.shadowColor=e.color;ctx.stroke();}
    else if(e.type==='particle'){ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(e.x,e.y,e.size,0,Math.PI*2);ctx.fillStyle=e.color;ctx.fill();}
    else if(e.type==='projectile'){const t=1-e.life/e.max,x=lerp(e.x,e.tx,t),y=lerp(e.y,e.ty,t)-Math.sin(t*Math.PI)*28;ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(x,y,e.size,0,Math.PI*2);ctx.fillStyle=e.color;ctx.shadowBlur=12;ctx.shadowColor=e.color;ctx.fill();}
    else if(e.type==='float'){const p=axialToWorld(e.q,e.r),t=1-e.life/e.max;ctx.font='bold 14px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=e.color;ctx.shadowBlur=7;ctx.shadowColor='rgba(0,0,0,.8)';ctx.fillText(e.text,p.x,p.y-28+(e.offset||0)-t*30);}
    else if(e.type==='ring'){const t=1-e.life/e.max;ctx.beginPath();ctx.arc(e.x,e.y,e.r+t*28,0,Math.PI*2);ctx.strokeStyle=e.color;ctx.lineWidth=3/state.camera.zoom;ctx.stroke();}
    else if(e.type==='repair'){const t=1-e.life/e.max;ctx.font='16px system-ui';ctx.textAlign='center';ctx.fillStyle='#66e7a7';ctx.fillText('✚',e.x,e.y-10-t*22);ctx.beginPath();ctx.arc(e.x,e.y,12+t*18,0,Math.PI*2);ctx.strokeStyle='#66e7a7';ctx.stroke();}
    else if(e.type==='spark'){ctx.globalCompositeOperation='lighter';ctx.beginPath();ctx.arc(e.x,e.y,2.5,0,Math.PI*2);ctx.fillStyle=e.color;ctx.fill();}
    ctx.restore();
  }
}
function updateEffects(dt){
  for(const e of state.effects){e.life-=dt;if(e.type==='particle'){e.x+=e.vx*dt;e.y+=e.vy*dt;e.vy+=34*dt;}}
  state.effects=state.effects.filter(e=>e.life>0);if(state.effects.length>650)state.effects.splice(0,state.effects.length-650);
}
function drawMap(){
  const {w,h,dpr}=state.screen;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const bg=ctx.createRadialGradient(w*.5,h*.35,30,w*.5,h*.5,Math.max(w,h));bg.addColorStop(0,'#10283a');bg.addColorStop(1,'#040b13');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(w/2,h/2);ctx.scale(state.camera.zoom,state.camera.zoom);ctx.translate(-state.camera.x,-state.camera.y);
  drawTerrain();drawRoutes();drawResourcesAndImprovements();drawPrismNetworks();drawCities();drawTargetLocks();drawActiveCombat();drawUnits();drawEffects();ctx.restore();
  if(state.showIntel){ctx.save();ctx.fillStyle='rgba(3,11,21,.55)';ctx.fillRect(0,0,w,25);ctx.fillStyle='#d9f7ff';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText('空格情报层：显示全地图单位名称与生命值',w/2,16);ctx.restore();}
}
function mapBounds(){const a=axialToWorld(0,0),b=axialToWorld(mapWidth()-1,mapHeight()-1);return{minX:a.x-HEX,maxX:b.x+HEX,minY:a.y-HEX,maxY:b.y+HEX};}
function clampCamera(){
  const b=mapBounds(),margin=120,halfW=state.screen.w/(2*state.camera.zoom),halfH=state.screen.h/(2*state.camera.zoom),minX=b.minX-margin,maxX=b.maxX+margin,minY=b.minY-margin,maxY=b.maxY+margin;
  state.camera.x=minX+halfW>maxX-halfW?(minX+maxX)/2:clamp(state.camera.x,minX+halfW,maxX-halfW);
  state.camera.y=minY+halfH>maxY-halfH?(minY+maxY)/2:clamp(state.camera.y,minY+halfH,maxY-halfH);
}
function drawMinimap(){
  const w=mini._cssW||190,h=mini._cssH||128,dpr=mini._dpr||1;mctx.setTransform(dpr,0,0,dpr,0,0);mctx.clearRect(0,0,w,h);mctx.fillStyle='#04101b';mctx.fillRect(0,0,w,h);
  const b=mapBounds(),pad=7,s=Math.min((w-pad*2)/(b.maxX-b.minX),(h-pad*2)/(b.maxY-b.minY));const mx=x=>pad+(x-b.minX)*s,my=y=>pad+(y-b.minY)*s;
  for(const t of tiles.values()){const p=axialToWorld(t.q,t.r);mctx.fillStyle=TERRAIN[t.terrain].fill;mctx.beginPath();mctx.arc(mx(p.x),my(p.y),Math.max(1.3,HEX*s*.45),0,Math.PI*2);mctx.fill();}
  for(const t of tiles.values())if(t.improvement?.team==='player'){const p=axialToWorld(t.q,t.r);mctx.fillStyle='#66e7a7';mctx.fillRect(mx(p.x)-1,my(p.y)-1,2,2);}
  for(const c of state.cities)if(c.hp>0){const p=axialToWorld(c.q,c.r);mctx.fillStyle=c.team==='player'?'#59dcff':'#ff6d7e';mctx.fillRect(mx(p.x)-3,my(p.y)-3,6,6);}
  for(const u of state.units)if(u.hp>0){const p=unitDrawPos(u);mctx.fillStyle=u.team==='player'?'#b5efff':'#ff8d9b';mctx.beginPath();mctx.arc(mx(p.x),my(p.y),1.7,0,Math.PI*2);mctx.fill();}
  const tl=screenToWorld(0,0),br=screenToWorld(state.screen.w,state.screen.h);mctx.strokeStyle='rgba(255,255,255,.75)';mctx.lineWidth=1;mctx.strokeRect(mx(tl.x),my(tl.y),Math.max(2,(br.x-tl.x)*s),Math.max(2,(br.y-tl.y)*s));
  mini._mapTransform={b,pad,s,mx,my};
}

