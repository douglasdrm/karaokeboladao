(function(root){
 'use strict';
 const AUDIO_MAX_SECONDS=8;
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,fn)=>{const b=el('button',text,'challenge-btn');b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){alert(e.message||'Não foi possível concluir.');}finally{b.disabled=false;}};return b;};
 const name=u=>SocialCore.clean(u?.customName||u?.name||u?.displayName);
 const interactionIcons={
  trophy:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H5v1a4 4 0 0 0 4 4m7-5h3v1a4 4 0 0 1-4 4M12 12v5m-4 3h8m-6-3h4"/></svg>',
  audio:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 10a6.5 6.5 0 0 0 13 0M12 16.5V21m-3 0h6m5-14v6M4 8v4"/></svg>',
  megaphone:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 10 12-5v14L4 14v-4Zm12-1 3-2v10l-3-2M7 15l1.5 5h4L11 16.5"/></svg>'
 };
 function decorate(b,icon,label){b.classList.add('interaction-chip');b.replaceChildren();const holder=el('span',undefined,'interaction-chip-icon');holder.innerHTML=interactionIcons[icon];const text=el('span',label,'interaction-chip-label');b.append(holder,text);return text;}
 function interactionMount(api){
  if(api.host){
   let panel=api.mount().querySelector('.host-interaction-panel');
   if(!panel){panel=el('section',undefined,'host-interaction-panel');panel.append(el('h4','INTERAÇÃO DA FESTA'),el('div',undefined,'host-interaction-actions'));api.mount().prepend(panel);}
   return panel.querySelector('.host-interaction-actions');
  }
  let shell=api.mount().querySelector('.interaction-section');
  if(!shell){shell=el('section',undefined,'interaction-section');shell.setAttribute('aria-label','Interação');shell.append(el('h2','INTERAÇÃO'),el('div',undefined,'interaction-track'));api.mount().prepend(shell);}
  return shell.querySelector('.interaction-track');
 }
 function modal(title,onClose){
  const d=el('dialog',undefined,'challenge-dialog social-dialog'),body=el('div');
  d.append(button('Fechar',()=>d.close()),el('h2',title),body);
  d.addEventListener('close',()=>{onClose?.();d.remove();});(document.fullscreenElement||document.body).append(d);d.showModal();return {d,body};
 }
 function hostCard(box,icon,title,render){
  const shell=el('section',undefined,'host-action-expandable'),details=el('div',undefined,'host-action-details');details.hidden=true;
  const toggle=el('button',undefined,'interaction-chip host-action-card');toggle.type='button';toggle.setAttribute('aria-expanded','false');
  const label=decorate(toggle,icon,title),count=el('span','0','interaction-count'),chevron=el('i',undefined,'fas fa-chevron-down interaction-chevron');count.hidden=true;toggle.append(count,chevron);
  toggle.onclick=async()=>{const opening=details.hidden;(box.closest('.host-interaction-actions')||box).querySelectorAll('.host-action-details').forEach(node=>{node.hidden=true;node.previousElementSibling?.setAttribute('aria-expanded','false');});details.hidden=!opening;toggle.setAttribute('aria-expanded',String(opening));if(opening)await render(details);};
  shell.append(toggle,details);box.append(shell);return {toggle,label,count,details,refresh:()=>!details.hidden&&render(details)};
 }
 function rankingContent(body,rows){
  let field='points';body.replaceChildren();const options=el('select');options.setAttribute('aria-label','Ranking');
  for(const [value,title] of [['points','Pontuação geral'],['songs','Rei/Rainha do Karaokê'],['launched','Desafiador'],['challenges','Corajoso'],['groups','Parceiro de Palco'],['recruits','Recrutador'],['receivedVotes','Queridinho da Galera'],['streak','Incendiário'],['audios','Locutor']]){const o=el('option',title);o.value=value;options.append(o);}
  const list=el('ol',undefined,'social-ranking');
  const render=()=>{list.replaceChildren();const order=rows().filter(p=>p[field]>0).slice().sort((a,b)=>b[field]-a[field]||a.name.localeCompare(b.name,'pt-BR'));if(!order.length)list.append(el('p','Os pontos aparecem ao concluir as apresentações.','challenge-muted'));for(const p of order){const row=el('li');row.append(el('strong',p.name),el('span',p[field]+(field==='points'?' pontos':'')));list.append(row);}};
  options.onchange=()=>{field=options.value;render();};body.append(options,list);render();
 }
 async function inviteContent(api,body){
  const room=api.room(),uid=api.user()?.uid;if(!room||!uid)return;body.replaceChildren();
  const select=el('select');select.setAttribute('aria-label','Pessoa para chamar');const members=(await api.db.ref(`salas/${room}/active_users`).once('value')).val()||{};
  for(const [id,u] of Object.entries(members)){if(id===uid||u.uid!==id)continue;const o=el('option',name(u));o.value=id;select.append(o);}
  const send=button('Enviar chamada',async()=>{if(!select.value)throw Error('Nenhuma outra pessoa com login está disponível.');await command(api,'invite',{targetUid:select.value});});if(!select.children.length){select.disabled=true;send.disabled=true;}
  body.append(el('p','Convide alguém; a pessoa confirma no celular e escolhe a música.','challenge-muted'),select,send);
  const values=(await api.db.ref(`salas/${room}/socialInvites`).once('value')).val()||{},list=el('div',undefined,'host-inline-list');
  for(const [id,i] of Object.entries(values)){if(i.targetUid!==uid&&i.uid!==uid)continue;const card=el('div',undefined,'host-inline-item');card.append(el('strong',`${i.name} → ${i.targetName}`),el('small',i.status==='accepted'?'Convite aceito':i.status==='declined'?'Convite encerrado':'Aguardando confirmação'));if(i.targetUid===uid&&i.status==='pending')card.append(button('Aceitar',()=>command(api,'inviteReply',{inviteId:id,accept:true})),button('Recusar',()=>command(api,'inviteReply',{inviteId:id,accept:false})));list.append(card);}
  if(!list.children.length)list.append(el('p','Nenhuma chamada nesta festa.','challenge-muted'));body.append(list);
 }
 function dock(api){
  const box=el('div',undefined,'social-dock');let selectedRoom,reference,inviteRef,rows=[];let rankingCard,audioCard,inviteCard;
  if(api.host){
   rankingCard=hostCard(box,'trophy','Participação na festa',body=>rankingContent(body,()=>rows));
   audioCard=hostCard(box,'audio','Recados de áudio',body=>host.showAudio(body));audioCard.toggle.classList.add('social-audio-host');host.audioView=audioCard;
   inviteCard=hostCard(box,'megaphone','Chamadas para cantar',body=>inviteContent(api,body));
  }else{
   const rankingButton=button('Participação na festa',()=>{const {body}=modal('🏆 Participação na festa');rankingContent(body,()=>rows);body.append(el('p','Solo +10 · dupla +8 por pessoa · grupo +6 por pessoa. Desafio concluído +10 extra; desafio lançado +5. Convite confirmado +5. Cada voto recebido +2. Recado aprovado pelo DJ +3.','challenge-muted'),el('p','Somente participantes com login. Não há pontos por apresentações puladas nem voto na própria formação.','challenge-muted'));});decorate(rankingButton,'trophy','Participação');box.append(rankingButton);
   const audioButton=button('Enviar recado de áudio',()=>record(api));decorate(audioButton,'audio','Recado de áudio');box.append(audioButton);
   const invites=button('Chamadas para cantar',()=>showInvites(api));decorate(invites,'megaphone','Chamadas');box.append(invites);
  }
  interactionMount(api).append(box);
  function sync(){const room=api.room();box.hidden=!room||!api.user();if(room===selectedRoom)return;reference?.off();inviteRef?.off();selectedRoom=room;rows=[];if(!room)return;reference=api.db.ref(`salas/${room}/participation`);reference.on('value',s=>{rows=Object.values(s.val()?.people||{});rankingCard?.refresh();});inviteRef=api.db.ref(`salas/${room}/socialInvites`);inviteRef.on('value',s=>{const count=Object.values(s.val()||{}).filter(i=>i.status==='pending').length;if(inviteCard){inviteCard.count.textContent=String(count);inviteCard.count.hidden=!count;inviteCard.refresh();}});}
  sync();const t=setInterval(sync,1000);root.addEventListener('pagehide',()=>{clearInterval(t);reference?.off();inviteRef?.off();});
 }
 async function command(api,action,extra){
  const user=api.user(),room=api.room();if(!user||!room)throw Error('Entre na conta e na sala.');
  const ref=api.db.ref(`salas/${room}/pedidos`).push();
  await ref.set({kind:'social',action,id:'social',singer:name(user),singerUid:user.uid,processed:false,timestamp:firebase.database.ServerValue.TIMESTAMP,...extra});
  const ack=api.db.ref(`salas/${room}/audioReceipts/${ref.key}`);
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ack.off();reject(Error('Aguarde a cabine. Confira o convite antes de tentar novamente.'));},20000);ack.on('value',s=>{if(!s.exists())return;ack.off();clearTimeout(timer);s.val().ok?resolve(s.val()):reject(Error(s.val().message));});});
 }
 async function showInvites(api){
  const room=api.room(),uid=api.user()?.uid;if(!room||!uid)return;
  const {d,body}=modal('📣 Chame alguém para cantar'),select=el('select');select.setAttribute('aria-label','Pessoa para chamar');
  const members=(await api.db.ref(`salas/${room}/active_users`).once('value')).val()||{};
  for(const [id,u] of Object.entries(members)){if(id===uid||u.uid!==id)continue;const o=el('option',name(u));o.value=id;select.append(o);}
  body.append(el('p','A pessoa confirma no próprio celular e escolhe a música no catálogo. O convite não coloca ninguém na fila.'),select,button('Enviar convite',async()=>{if(!select.value)throw Error('Nenhuma outra pessoa com login está disponível.');await command(api,'invite',{targetUid:select.value});select.disabled=true;}));
  const list=el('div');body.append(list);const ref=api.db.ref(`salas/${room}/socialInvites`);
  ref.on('value',s=>{list.replaceChildren();for(const [id,i] of Object.entries(s.val()||{})){if(i.targetUid!==uid&&i.uid!==uid)continue;const card=el('div',undefined,'challenge-card');card.append(el('p',`${i.name} chamou ${i.targetName} para cantar`),el('p',i.status==='accepted'?'Convite aceito! Escolha sua música no catálogo.':i.status==='declined'?'Convite encerrado.':'Aguardando confirmação.','challenge-muted'));
   if(i.targetUid===uid&&i.status==='pending')card.append(button('Eu vou cantar!',()=>command(api,'inviteReply',{inviteId:id,accept:true})),button('Agora não',()=>command(api,'inviteReply',{inviteId:id,accept:false})));list.append(card);
  }});d.addEventListener('close',()=>ref.off());
 }
 async function record(api){
  const user=api.user(),room=api.room();if(!user||!room)throw Error('Entre na sua conta e na sala.');
  if(!navigator.mediaDevices?.getUserMedia||!root.MediaRecorder)throw Error('Este navegador não oferece gravação de áudio. Use um navegador atualizado.');
  let stream,recorder,timer,clock,blob,url,closed=false,started=0,duration=0,holding=false,locked=false,cancelled=false,sendOnStop=false,releaseRequested=false,startPoint=null;
  const release=()=>{clearTimeout(timer);clearInterval(clock);stream?.getTracks().forEach(t=>t.stop());stream=null;};
  const {d,body}=modal('🎙 Recado para a festa',()=>{closed=true;if(recorder?.state==='recording')recorder.stop();release();if(url)URL.revokeObjectURL(url);});
  body.classList.add('voice-recorder-body');
  const status=el('p','Segure o microfone para gravar até 8 segundos.','voice-recorder-status');
  const recorderUi=el('div',undefined,'voice-recorder-ui'),time=el('span','0:00','voice-recorder-time'),wave=el('div',undefined,'voice-recorder-wave');
  for(let i=0;i<22;i++)wave.append(el('i'));
  recorderUi.append(time,wave);
  const preview=el('audio');preview.controls=true;preview.hidden=true;
  const sendRecording=async()=>{
   if(!blob||closed)return;if(api.room()!==room||api.user()?.uid!==user.uid)throw Error('A sala mudou. Grave novamente.');
   const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Falha ao ler a gravação.'));r.readAsDataURL(blob);});
   if(!SocialCore.validAudio({audio:data,duration}))throw Error('Gravação muito grande ou incompatível. Tente um recado mais curto.');
   const pending=api.db.ref(`salas/${room}/pedidos`).push();
   await pending.set({kind:'social',action:'audio',id:'audio',singer:name(user),singerUid:user.uid,processed:false,timestamp:firebase.database.ServerValue.TIMESTAMP,audio:data,duration});
   status.textContent='Enviado. Aguardando confirmação da cabine…';send.hidden=true;
   const ack=api.db.ref(`salas/${room}/audioReceipts/${pending.key}`);
   let timeout;const unsubscribe=()=>{ack.off();clearTimeout(timeout);};
   ack.on('value',s=>{if(!s.exists())return;status.textContent=s.val().message;unsubscribe();});
   timeout=setTimeout(()=>{status.textContent='Sem confirmação da cabine. Consulte o DJ antes de reenviar.';unsubscribe();},20000);
   d.addEventListener('close',unsubscribe);
  };
  const send=button('Enviar recado',sendRecording);send.disabled=true;send.hidden=true;
  const cancel=button('Cancelar',()=>{cancelled=true;sendOnStop=false;if(recorder?.state==='recording')recorder.stop();else reset();});cancel.classList.add('voice-cancel');cancel.hidden=true;
  const stop=button('Parar e revisar',()=>{sendOnStop=false;if(recorder?.state==='recording')recorder.stop();});stop.classList.add('voice-stop');stop.hidden=true;
  const start=el('button','Segure para gravar','challenge-btn voice-record');start.type='button';start.setAttribute('aria-label','Segure para gravar um recado de até 8 segundos');
  const reset=()=>{holding=false;locked=false;cancelled=false;sendOnStop=false;releaseRequested=false;startPoint=null;blob=null;duration=0;time.textContent='0:00';recorderUi.classList.remove('is-recording','is-locked');start.hidden=false;start.textContent='Segure para gravar';stop.hidden=true;cancel.hidden=true;send.hidden=true;send.disabled=true;preview.hidden=true;if(url){URL.revokeObjectURL(url);url=null;}status.textContent='Segure o microfone para gravar até 8 segundos.';};
  const begin=async()=>{
   if(recorder?.state==='recording'||holding)return;holding=true;locked=false;cancelled=false;sendOnStop=false;releaseRequested=false;
   if(blob){blob=null;send.disabled=true;preview.hidden=true;if(url)URL.revokeObjectURL(url);}
   status.textContent='Autorize o microfone e continue segurando.';
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(closed){release();return;}
   const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   try{recorder=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:48000});}catch(e){release();throw e;}
   const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>{release();reset();status.textContent='Não foi possível gravar. Tente novamente.';};
   recorder.onstop=async()=>{duration=Math.min(AUDIO_MAX_SECONDS,(Date.now()-started)/1000);release();recorderUi.classList.remove('is-recording','is-locked');holding=false;locked=false;time.textContent=`0:${String(Math.max(1,Math.round(duration))).padStart(2,'0')}`;if(closed)return;if(cancelled||!chunks.length){reset();status.textContent='Gravação cancelada.';return;}blob=new Blob(chunks,{type:recorder.mimeType});url=URL.createObjectURL(blob);preview.src=url;if(sendOnStop){start.hidden=true;stop.hidden=true;cancel.hidden=true;send.hidden=true;status.textContent='Enviando recado…';try{await sendRecording();}catch(e){preview.hidden=false;start.hidden=false;cancel.hidden=false;send.hidden=false;send.disabled=false;status.textContent=e.message||'Não foi possível enviar.';}return;}preview.hidden=false;start.hidden=false;stop.hidden=true;cancel.hidden=false;send.hidden=false;send.disabled=!blob.size;status.textContent='Ouça, envie ou grave novamente.';};
   started=Date.now();try{recorder.start();}catch(e){release();throw e;}
   start.hidden=false;start.textContent='Solte para enviar';cancel.hidden=false;recorderUi.classList.add('is-recording');status.textContent='Gravando… solte para enviar · arraste para a esquerda para cancelar · para cima para travar.';
   time.textContent='0:00';clock=setInterval(()=>{const elapsed=Math.min(AUDIO_MAX_SECONDS,(Date.now()-started)/1000);time.textContent=`0:${String(Math.floor(elapsed)).padStart(2,'0')}`;},200);
   timer=setTimeout(()=>{if(recorder.state==='recording'){sendOnStop=!locked;recorder.stop();}},AUDIO_MAX_SECONDS*1000);
   if(releaseRequested&&!locked){sendOnStop=true;recorder.stop();}
  };
  start.addEventListener('pointerdown',e=>{e.preventDefault();startPoint={x:e.clientX,y:e.clientY};start.setPointerCapture?.(e.pointerId);begin().catch(err=>{release();reset();status.textContent=err.message||'Não foi possível iniciar a gravação.';});});
  start.addEventListener('pointermove',e=>{if(!holding||!startPoint||locked)return;const dx=e.clientX-startPoint.x,dy=e.clientY-startPoint.y;if(dx<-70){cancelled=true;sendOnStop=false;if(recorder?.state==='recording')recorder.stop();}else if(dy<-70){locked=true;holding=false;start.hidden=true;recorderUi.classList.add('is-locked');stop.hidden=false;status.textContent='Gravação travada. Toque em parar para revisar.';}});
  const releasePointer=()=>{if(!holding||locked)return;holding=false;sendOnStop=!cancelled;if(recorder?.state==='recording')recorder.stop();else releaseRequested=true;};
  start.addEventListener('pointerup',releasePointer);start.addEventListener('pointercancel',()=>{cancelled=true;releasePointer();});
  start.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&recorder?.state!=='recording'){e.preventDefault();begin().then(()=>{locked=true;holding=false;start.hidden=true;recorderUi.classList.add('is-locked');stop.hidden=false;status.textContent='Gravação travada. Toque em parar para revisar.';}).catch(err=>{reset();status.textContent=err.message;});}});
  send.classList.add('voice-send');
  const controls=el('div',undefined,'voice-recorder-actions');controls.append(cancel,start,stop,send);
  body.append(status,recorderUi,controls,preview,el('p','Solte para enviar, arraste para a esquerda para cancelar ou para cima para travar e revisar.','challenge-muted'));
  root.addEventListener('pagehide',()=>{closed=true;release();},{once:true});
 }
 let api,room=null,audioRef,challengeRef,clips={},chain=Promise.resolve(),active=null,renderAudio=null,idleTimer=null;
 const host={
  init(options){api=options;dock({...api,host:true});},
  begin(){const next=api.room();if(next===room)return;this.stopAudio();audioRef?.off();challengeRef?.off();room=next;clips={};if(!room)return;audioRef=api.db.ref(`salas/${room}/audioClips`);audioRef.on('value',s=>{clips=s.val()||{};const total=Object.keys(clips).length;if(this.audioView){this.audioView.count.textContent=String(total);this.audioView.count.hidden=!total;this.audioView.refresh();}renderAudio?.();this.scheduleIdle();});challengeRef=api.db.ref(`salas/${room}/challengeState/items`);challengeRef.on('value',s=>root.PartyHost?.challenges(s.val()));},
  handle(req,key){const captured=room;if(!captured)return;chain=chain.catch(()=>{}).then(async()=>{
   const base=api.db.ref(`salas/${captured}`),receipt=base.child('audioReceipts/'+key);
   if((await receipt.once('value')).exists()){await base.child('pedidos/'+key).remove();return;}
   const member=(await base.child('active_users/'+req.singerUid).once('value')).val() || (req.singerUid===api.user()?.uid?api.user():null);
   if(req.action==='invite'||req.action==='inviteReply'){
    const all=(await base.child('socialInvites').once('value')).val()||{};let ok=false,message='Convite indisponível.',activity=null;const changes={['pedidos/'+key]:null};
    if(member&&Number.isFinite(req.timestamp)&&Math.abs(Date.now()-req.timestamp)<180000){
     if(req.action==='invite'){
      const target=typeof req.targetUid==='string'&&!/[.#$\[\]/]/.test(req.targetUid)?(await base.child('active_users/'+req.targetUid).once('value')).val():null;
      if(target?.uid===req.targetUid&&req.targetUid!==req.singerUid&&!Object.values(all).some(i=>(i.targetUid===req.targetUid&&i.status!=='declined')||(i.uid===req.singerUid&&i.status==='pending'))){ok=true;message='Convite enviado!';changes['socialInvites/'+key]={uid:req.singerUid,name:name(member),targetUid:req.targetUid,targetName:name(target),status:'pending'};}
      else message='Essa pessoa já recebeu um convite, ou você tem um convite aguardando.';
     }else{
      const invite=Object.hasOwn(all,req.inviteId)?all[req.inviteId]:null;
      if(invite?.targetUid===req.singerUid&&invite.status==='pending'){ok=true;message=req.accept?'Convite aceito! Escolha uma música no catálogo.':'Convite encerrado.';changes['socialInvites/'+req.inviteId+'/status']=req.accept?'accepted':'declined';
       if(req.accept)activity={type:'recruit',uid:invite.uid,name:invite.name,targetUid:invite.targetUid};
      }
     }
    }
    changes['audioReceipts/'+key]={ok,message,at:Date.now()};await base.update(changes);if(activity)root.PartyHost?.activity('invite_'+req.inviteId,activity);return;
   }
   const list=(await base.child('audioClips').once('value')).val()||{};
   const automatic=api.autoApproveAudio?.()===true;
   let message=automatic?'Recado liberado! Ele tocará em um próximo intervalo.':'Recado recebido! Aguarde a aprovação do DJ.',ok=true;
   if(!member||!Number.isFinite(req.timestamp)||Math.abs(Date.now()-req.timestamp)>180000||!SocialCore.validAudio(req)){ok=false;message='Recado inválido ou expirado. Grave novamente.';}
   else if(Object.keys(list).length>=20){ok=false;message='A fila de recados está cheia. Aguarde um intervalo.';}
   const changes={['pedidos/'+key]:null,['audioReceipts/'+key]:{ok,message,at:Date.now()}};
   if(ok)changes['audioClips/'+key]={uid:req.singerUid,name:name(member),photo:member.photo||'',audio:req.audio,duration:req.duration,status:automatic?'approved':'pending',at:req.timestamp};
   await base.update(changes);
   if(ok&&automatic)root.PartyHost?.activity('audio_'+key,{type:'audio',uid:req.singerUid,name:name(member)});
  }).catch(e=>console.warn('Recado pendente:',e));},
  showAudio(target){
   const body=target||modal('🎙 Recados da festa').body;
   const render=()=>{body.replaceChildren(el('p','Recados aprovados tocam em ordem nos intervalos e também quando não há música na fila.','challenge-muted'));
    if(active)body.append(button('Parar áudio atual',()=>this.stopAudio(true)));
    const entries=Object.entries(clips).sort((a,b)=>a[1].at-b[1].at);
    if(!entries.length)body.append(el('p','Nenhum recado aguardando.'));
    for(const [id,c] of entries){const card=el('div',undefined,'host-inline-item');card.append(el('strong',c.name),el('small',c.status==='approved'?'Aprovado · aguardando reprodução':'Aguardando aprovação'));
     card.append(button('Ouvir',()=>{if(api.busy()||active)throw Error('Aguarde o intervalo entre músicas.');this.play(c,null,false);}));
     if(c.status!=='approved')card.append(button('Aprovar',async()=>{await api.db.ref(`salas/${room}/audioClips/${id}/status`).set('approved');root.PartyHost?.activity('audio_'+id,{type:'audio',uid:c.uid,name:c.name});}));
     else card.append(button('Reproduzir',()=>{if(api.busy()||active)throw Error('Aguarde o intervalo.');this.play(c,id,false);}));
     card.append(button('Descartar',()=>api.db.ref(`salas/${room}/audioClips/${id}`).remove()));body.append(card);
    }
   };renderAudio=render;render();
  },
  scheduleIdle(){clearTimeout(idleTimer);idleTimer=setTimeout(()=>this.playIdle(),120);},
  playIdle(){if(!room||active||api.busy())return false;const entry=this.nextApproved();if(!entry){api.resumeAmbient();return false;}this.play(entry[1],entry[0],false);return true;},
  nextApproved(){return Object.entries(clips).filter(([,c])=>c.status==='approved').sort((a,b)=>(a[1].at||0)-(b[1].at||0))[0];},
  beforeNext(proceed){
   if(active){active.proceed=proceed;return true;}
   const entry=this.nextApproved();
   if(!entry)return false;this.play(entry[1],entry[0],true,proceed);return true;
  },
  play(clip,id,transition,proceed){
   if(active)return;
   api.pauseAmbient();
   const audio=new Audio(clip.audio),token={audio,proceed,timer:null,transition,overlay:this.showPlayback(clip)};active=token;audio.volume=.8;
   const clipRef=id?api.db.ref(`salas/${room}/audioClips/${id}`):null;
   token.clipRef=clipRef;token.consume=!!id;
   const finish=()=>{if(active!==token)return;if(id){delete clips[id];clipRef.remove().catch(console.warn);}this.stopAudio(true);};
   const failed=()=>{if(active!==token)return;token.consume=false;if(id){clip.status='pending';clips[id]=clip;clipRef.child('status').set('pending').catch(console.warn);}this.stopAudio(true);};
   audio.onended=finish;audio.onerror=failed;token.timer=setTimeout(finish,(AUDIO_MAX_SECONDS+1)*1000);
   if(id)delete clips[id];
   audio.play().catch(failed);
  },
  stopAudio(continuePlayback=false){
   const token=active;if(!token)return;active=null;clearTimeout(token.timer);token.audio.onended=null;token.audio.onerror=null;token.audio.pause();token.audio.removeAttribute('src');
   token.overlay?.remove();if(token.consume)token.clipRef.remove().catch(console.warn);
   if(continuePlayback){if(token.proceed)token.proceed();else this.scheduleIdle();}
  },
  showPlayback(clip){
   document.querySelector('.voice-playback-overlay')?.remove();
   const overlay=el('div',undefined,'voice-playback-overlay'),avatar=el('div',undefined,'voice-playback-avatar');
   if(clip.photo){const img=el('img');img.src=clip.photo;img.alt='';img.onerror=()=>{img.remove();avatar.textContent=(clip.name||'C')[0].toUpperCase();};avatar.append(img);}else avatar.textContent=(clip.name||'C')[0].toUpperCase();
   const copy=el('div',undefined,'voice-playback-copy');copy.append(el('span','RECADO DE VOZ','voice-playback-label'),el('strong',clip.name||'Participante'));
   const bars=el('div',undefined,'voice-playback-bars');for(let i=0;i<18;i++)bars.append(el('i'));
   overlay.append(avatar,copy,bars);document.getElementById('playerContainer')?.append(overlay);return overlay;
  },
  end(){clearTimeout(idleTimer);this.stopAudio();audioRef?.off();challengeRef?.off();clips={};room=null;}
 };
 root.SocialHost=host;root.SocialMobile={init:dock};
})(window);
