(() => {
 'use strict';
 const stage=document.getElementById('audienceStage'),status=document.getElementById('audienceStatus');
 let hideTimer,observer,observedDocument,scheduled=false,vibeSignature='',vibeUntil=0;
 const mirrors=new WeakMap(),videoSources=new WeakMap();
 const allowed=['#player','.qr-fullscreen-box','#topInfoBox','#djFooter','#screensaver','#publicScoreDisplay','.challenge-screen-bar','#reactionContainer','.applause-overlay'];
 const frame=document.createElement('main');frame.id='playerContainer';stage.append(frame);
 function showToolbar(){document.body.classList.remove('toolbar-hidden');clearTimeout(hideTimer);hideTimer=setTimeout(()=>document.body.classList.add('toolbar-hidden'),2200);}
 document.addEventListener('pointermove',e=>{if(e.clientY<64)showToolbar();});document.addEventListener('keydown',e=>{if(e.key==='Tab')showToolbar();});showToolbar();
 document.getElementById('audienceFullscreen').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{alert('Use a opção de tela cheia do navegador nesta janela.');}};
 function disconnected(message){stage.querySelectorAll('video').forEach(v=>v.pause());status.textContent=message;status.hidden=false;}

 function reconcile(parent,nodes){
  let cursor=parent.firstChild;
  for(const node of nodes){
   if(node!==cursor)parent.insertBefore(node,cursor);
   cursor=node.nextSibling;
  }
  while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
 }
 function mirror(original,root=false){
  if(original.nodeType===3){
   let copy=mirrors.get(original);
   if(!copy){copy=document.createTextNode(original.data);mirrors.set(original,copy);}
   if(copy.data!==original.data)copy.data=original.data;
   return copy;
  }
  if(original.nodeType!==1)return null;
  const tag=original.tagName;
  if(['SCRIPT','STYLE','LINK','META','OBJECT','EMBED','AUDIO','INPUT','SELECT','TEXTAREA'].includes(tag)||(!root&&tag==='BUTTON'))return null;
  let copy=mirrors.get(original);
  if(!copy){
   copy=tag==='IFRAME'?document.createElement('div'):document.importNode(original,false);
   mirrors.set(original,copy);
  }
  if(tag==='IFRAME'){copy.className='audience-ambient';copy.textContent='KARAOKE PARTY';return copy;}
  const attrs=new Map([...original.attributes].filter(a=>!/^on/i.test(a.name)&&!['srcdoc','autofocus','autoplay'].includes(a.name)&&!(tag==='VIDEO'&&a.name==='src')).map(a=>[a.name,a.value]));
  for(const a of [...copy.attributes])if(!attrs.has(a.name)&&a.name!=='data-display-video'&&!(tag==='VIDEO'&&a.name==='src'))copy.removeAttribute(a.name);
  for(const [name,value] of attrs)if(copy.getAttribute(name)!==value)copy.setAttribute(name,value);
  if(tag==='VIDEO'){copy.dataset.displayVideo='true';videoSources.set(copy,original);copy.muted=true;copy.defaultMuted=true;copy.volume=0;copy.playsInline=true;copy.controls=false;return copy;}
  if(tag==='CANVAS'){try{copy.getContext('2d').drawImage(original,0,0);}catch{}return copy;}
  reconcile(copy,[...original.childNodes].map(n=>mirror(n)).filter(Boolean));
  return copy;
 }
 function tick(){
  try{
   if(!window.opener||window.opener.closed){disconnected('A cabine foi fechada. Abra a Segunda tela novamente pela cabine do DJ.');return;}
   if(window.opener.location.origin!==location.origin)return;
   const source=window.opener.document,container=source.getElementById('playerContainer'),dashboard=source.getElementById('main_wrapper');
   if(!container||!dashboard||window.opener.getComputedStyle(dashboard).display==='none'){disconnected('Aguardando o DJ iniciar a cabine…');return;}
   if(observedDocument!==source){
    if(observer)observer.disconnect();
    observedDocument=source;
    observer=new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;tick();});}});
    observer.observe(source.body,{subtree:true,childList:true,characterData:true,attributes:true});
   }
   const roots=allowed.flatMap(selector=>[...(selector==='#reactionContainer'?source:container).querySelectorAll(selector)]);
   // A root can already belong to another public root; never move it twice.
   const topRoots=roots.filter(n=>!roots.some(other=>other!==n&&other.contains(n)));
   reconcile(frame,topRoots.map(n=>mirror(n,true)).filter(Boolean));
   const vibe=source.getElementById('publicScoreDisplay');
   const signature=vibe&&vibe.style.display!=='none'?[vibe.querySelector('#publicScoreVal')?.textContent,vibe.querySelector('#likeCount')?.textContent,vibe.querySelector('#dislikeCount')?.textContent].join('|'):'';
   if(signature!==vibeSignature){vibeSignature=signature;vibeUntil=signature?Date.now()+1500:0;}
   stage.classList.toggle('vibe-active',Boolean(signature)&&Date.now()<vibeUntil);
   stage.querySelectorAll('video[data-display-video]').forEach(v=>{
    const original=videoSources.get(v);if(!original)return;
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
 const timer=setInterval(tick,100);tick();
 window.addEventListener('pagehide',()=>{clearInterval(timer);clearTimeout(hideTimer);if(observer)observer.disconnect();stage.querySelectorAll('video').forEach(v=>v.pause());});
})();

