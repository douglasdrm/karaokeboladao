(() => {
 'use strict';
 const stage=document.getElementById('audienceStage'),status=document.getElementById('audienceStatus');
 let markup='',hideTimer;
 const allowed=['#player','.qr-fullscreen-box','#topInfoBox','#djFooter','#screensaver','#publicScoreDisplay','.challenge-screen-bar'];
 function showToolbar(){document.body.classList.remove('toolbar-hidden');clearTimeout(hideTimer);hideTimer=setTimeout(()=>document.body.classList.add('toolbar-hidden'),4000);}
 document.addEventListener('pointermove',showToolbar);document.addEventListener('keydown',showToolbar);showToolbar();
 document.getElementById('audienceFullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{alert('Use a opção de tela cheia do navegador nesta janela.');}};
 function disconnected(message){stage.querySelectorAll('video').forEach(v=>v.pause());status.textContent=message;status.hidden=false;}
 function tick(){
  try{
   if(!window.opener||window.opener.closed){disconnected('A cabine foi fechada. Abra a Segunda tela novamente pela cabine do DJ.');return;}
   if(window.opener.location.origin!==location.origin)return;
   const source=window.opener.document,container=source.getElementById('playerContainer'),dashboard=source.getElementById('main_wrapper');
   if(!container||!dashboard||window.opener.getComputedStyle(dashboard).display==='none'){disconnected('Aguardando o DJ iniciar a cabine…');return;}
   const frame=document.createElement('main');frame.id='playerContainer';const sourceVideos=[];
   for(const selector of allowed){
    const original=container.querySelector(selector);if(!original)continue;
    const clone=original.cloneNode(true);
    const originals=[...original.querySelectorAll('video')];
    [...clone.querySelectorAll('video')].forEach((v,i)=>{const marker=document.createElement('div');marker.dataset.displayVideo=String(sourceVideos.length);sourceVideos.push(originals[i]);v.replaceWith(marker);});
    clone.querySelectorAll('iframe').forEach(v=>{const placeholder=document.createElement('div');placeholder.className='audience-ambient';placeholder.textContent='KARAOKE PARTY';v.replaceWith(placeholder);});
    clone.querySelectorAll('script,style,link,meta,object,embed,audio,canvas,input,select,textarea').forEach(e=>e.remove());
    for(const e of [clone,...clone.querySelectorAll('*')])for(const attr of [...e.attributes])if(/^on/i.test(attr.name)||['srcdoc','autofocus'].includes(attr.name))e.removeAttribute(attr.name);
    // The stage has no DJ actions; only the separate toolbar is interactive.
    clone.querySelectorAll('button').forEach(e=>e.remove());frame.append(clone);
   }
   const next=frame.outerHTML;
   if(next!==markup){const videos=[...stage.querySelectorAll('video[data-display-video]')];stage.replaceChildren(frame);stage.querySelectorAll('[data-display-video]').forEach(marker=>{const i=Number(marker.dataset.displayVideo),v=videos.find(v=>Number(v.dataset.displayVideo)===i)||document.createElement('video');v.dataset.displayVideo=String(i);v.muted=true;v.defaultMuted=true;v.playsInline=true;v.controls=false;marker.replaceWith(v);});markup=next;}
   stage.querySelectorAll('video[data-display-video]').forEach(v=>{
    const original=sourceVideos[Number(v.dataset.displayVideo)];if(!original)return;
    const url=original.currentSrc||original.src;
    if(original.srcObject){if(v.srcObject!==original.srcObject)v.srcObject=original.srcObject;}
    else if(url&&v.getAttribute('src')!==url){v.srcObject=null;v.src=url;}
    v.muted=true;v.volume=0;v.playbackRate=original.playbackRate;
    if(v.readyState>=1&&Number.isFinite(original.currentTime)&&Math.abs(v.currentTime-original.currentTime)>.35){try{v.currentTime=original.currentTime;}catch{}}
    if(original.paused||original.ended){if(!v.paused)v.pause();}else if(v.paused)v.play().catch(()=>{});
   });
   status.hidden=true;
  }catch{disconnected('Aguardando conexão com a cabine…');}
 }
 const timer=setInterval(tick,200);tick();window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(hideTimer);stage.querySelectorAll('video').forEach(v=>v.pause());});
})();
