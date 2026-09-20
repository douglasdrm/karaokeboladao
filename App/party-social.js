(function(root){
 'use strict';
 const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const button=(text,fn)=>{const b=el('button',text,'challenge-btn');b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){alert(e.message||'Não foi possível concluir.');}finally{b.disabled=false;}};return b;};
 const name=u=>SocialCore.clean(u?.customName||u?.name||u?.displayName);
 function modal(title,onClose){
  const d=el('dialog',undefined,'challenge-dialog social-dialog'),body=el('div');
  d.append(button('Fechar',()=>d.close()),el('h2',title),body);
  d.addEventListener('close',()=>{onClose?.();d.remove();});(document.fullscreenElement||document.body).append(d);d.showModal();return {d,body};
 }
 function dock(api){
  const box=el('div',undefined,'social-dock');let selectedRoom,reference,rows=[];
  box.append(button('🏆 Participação na festa',()=>{
   let field='points';const {d,body}=modal('🏆 Participação na festa');
   const options=el('select');options.setAttribute('aria-label','Ranking');
   for(const [value,title] of [['points','Pontuação geral'],['songs','🎤 Rei/Rainha do Karaokê'],['launched','⚔️ Desafiador'],['challenges','🥊 Corajoso'],['groups','👥 Parceiro de Palco'],['recruits','📣 Recrutador'],['receivedVotes','❤️ Queridinho da Galera'],['streak','🔥 Incendiário'],['audios','🎙️ Locutor']]){const o=el('option',title);o.value=value;options.append(o);}
   const list=el('ol',undefined,'social-ranking');
   const render=()=>{list.replaceChildren();const order=rows.filter(p=>p[field]>0).slice().sort((a,b)=>b[field]-a[field]||a.name.localeCompare(b.name,'pt-BR'));
    if(!order.length)list.append(el('p','Os pontos aparecem ao concluir as apresentações.'));
    for(const p of order){const row=el('li');row.append(el('strong',p.name),el('span',p[field]+(field==='points'?' pontos':'')));list.append(row);}
   };
   options.onchange=()=>{field=options.value;render();};body.append(options,list,el('p','Solo +10 · dupla +8 por pessoa · grupo +6 por pessoa. Desafio concluído +10 extra; desafio lançado +5. A partir da segunda participação consecutiva +3 extra. Convite confirmado +5. Cada voto recebido +2; cinco votantes diferentes na apresentação dão +5 extra. Recado aprovado pelo DJ +3.','challenge-muted'),el('p','Somente participantes com login. Não há pontos por apresentações puladas nem voto na própria formação. Convites pontuam uma vez por convidado na festa; desafios cancelados perdem seus pontos. Incendiário mostra a maior sequência de apresentações consecutivas. Empates têm a mesma pontuação.','challenge-muted'));
   render();const t=setInterval(render,2000);d.addEventListener('close',()=>clearInterval(t));
  }));
  const audioButton=button(api.host?'🎙 Recados de áudio':'🎙 Enviar recado de áudio',()=>api.host?host.showAudio():record(api));if(api.host)audioButton.classList.add('social-audio-host');box.append(audioButton);
  const invites=button('📣 Chamadas para cantar',()=>showInvites(api));box.append(invites);
  api.mount().prepend(box);
  let inviteRef;
  function sync(){const room=api.room();box.hidden=!room||!api.user();if(room===selectedRoom)return;reference?.off();inviteRef?.off();selectedRoom=room;rows=[];if(!room)return;reference=api.db.ref(`salas/${room}/participation`);reference.on('value',s=>{rows=Object.values(s.val()?.people||{});});inviteRef=api.db.ref(`salas/${room}/socialInvites`);inviteRef.on('value',s=>{const count=Object.values(s.val()||{}).filter(i=>i.targetUid===api.user()?.uid&&i.status==='pending').length;invites.textContent=count?'📣 Você tem '+count+' convite(s) para cantar':'📣 Chamadas para cantar';});}
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
  let stream,recorder,timer,blob,url,closed=false,started=0,duration=0;
  const release=()=>{clearTimeout(timer);stream?.getTracks().forEach(t=>t.stop());stream=null;};
  const {d,body}=modal('🎙 Recado para a festa',()=>{closed=true;if(recorder?.state==='recording')recorder.stop();release();if(url)URL.revokeObjectURL(url);});
  const status=el('p','Grave até 15 segundos. Você pode chamar alguém para cantar!');
  const preview=el('audio');preview.controls=true;preview.hidden=true;
  const send=button('Enviar recado',async()=>{
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
  });send.disabled=true;
  const stop=button('Parar gravação',()=>{if(recorder?.state==='recording')recorder.stop();});stop.hidden=true;
  const start=button('● Gravar recado',async()=>{
   if(blob){blob=null;send.disabled=true;preview.hidden=true;if(url)URL.revokeObjectURL(url);}
   status.textContent='Autorize o microfone para gravar.';
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(closed){release();return;}
   const type=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
   try{recorder=new MediaRecorder(stream,{...(type?{mimeType:type}:{}),audioBitsPerSecond:48000});}catch(e){release();throw e;}
   const chunks=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=()=>{release();status.textContent='Não foi possível gravar. Tente novamente.';};
   recorder.onstop=()=>{duration=Math.min(15,(Date.now()-started)/1000);release();if(closed)return;blob=new Blob(chunks,{type:recorder.mimeType});url=URL.createObjectURL(blob);preview.src=url;preview.hidden=false;start.hidden=false;stop.hidden=true;send.disabled=!blob.size;status.textContent='Ouça antes de enviar. A liberação segue a configuração do DJ; a reprodução ocorre somente no intervalo.';};
   started=Date.now();try{recorder.start();}catch(e){release();throw e;}
   start.hidden=true;stop.hidden=false;status.textContent='🔴 Gravando… a gravação para automaticamente em 15 segundos.';
   timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},15000);
  });
  body.append(status,start,stop,preview,send,el('p','O microfone é usado apenas enquanto você grava. O áudio será liberado automaticamente ou pelo DJ, conforme a configuração da festa, e não altera a fila de cantores.','challenge-muted'));
  root.addEventListener('pagehide',()=>{closed=true;release();},{once:true});
 }
 let api,room=null,audioRef,challengeRef,clips={},chain=Promise.resolve(),active=null,renderAudio=null;
 const host={
  init(options){api=options;dock({...api,host:true});},
  begin(){const next=api.room();if(next===room)return;this.stopAudio();audioRef?.off();challengeRef?.off();room=next;clips={};if(!room)return;audioRef=api.db.ref(`salas/${room}/audioClips`);audioRef.on('value',s=>{clips=s.val()||{};const b=document.querySelector('.social-audio-host');if(b)b.textContent='🎙 Recados de áudio ('+Object.keys(clips).length+')';renderAudio?.();});challengeRef=api.db.ref(`salas/${room}/challengeState/items`);challengeRef.on('value',s=>root.PartyHost?.challenges(s.val()));},
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
   else if(Object.values(list).some(c=>c.uid===req.singerUid)){ok=false;message='Você já tem um recado aguardando. Aguarde o DJ.';}
   else if(Object.keys(list).length>=20){ok=false;message='A fila de recados está cheia. Aguarde um intervalo.';}
   const changes={['pedidos/'+key]:null,['audioReceipts/'+key]:{ok,message,at:Date.now()}};
   if(ok)changes['audioClips/'+key]={uid:req.singerUid,name:name(member),audio:req.audio,duration:req.duration,status:automatic?'approved':'pending',at:Date.now()};
   await base.update(changes);
   if(ok&&automatic)root.PartyHost?.activity('audio_'+key,{type:'audio',uid:req.singerUid,name:name(member)});
  }).catch(e=>console.warn('Recado pendente:',e));},
  showAudio(){
   const {d,body}=modal('🎙 Recados da festa');
   const render=()=>{body.replaceChildren(el('p','A liberação dos novos recados pode ser automática ou manual, nas configurações de áudio. Você pode ouvir, aprovar pendentes ou descartar. Um recado liberado toca por intervalo, antes da chamada do próximo cantor. Até 15 segundos.','challenge-muted'));
    body.append(button('Parar áudio atual',()=>this.stopAudio(true)));
    const entries=Object.entries(clips).sort((a,b)=>a[1].at-b[1].at);
    if(!entries.length)body.append(el('p','Nenhum recado aguardando.'));
    for(const [id,c] of entries){const card=el('div',undefined,'challenge-card');card.append(el('strong',c.name),el('p',c.status==='approved'?'Aprovado para o próximo intervalo':'Aguardando aprovação'));
     card.append(button('Ouvir agora (somente no intervalo)',()=>{if(api.busy()||active)throw Error('Aguarde o intervalo entre músicas.');this.play(c,null,false);}));
     if(c.status!=='approved')card.append(button('Aprovar',async()=>{await api.db.ref(`salas/${room}/audioClips/${id}/status`).set('approved');root.PartyHost?.activity('audio_'+id,{type:'audio',uid:c.uid,name:c.name});}));
     else card.append(button('Reproduzir agora (no intervalo)',()=>{if(api.busy()||active)throw Error('Aguarde o intervalo.');this.play(c,id,false);}));
     card.append(button('Descartar',()=>api.db.ref(`salas/${room}/audioClips/${id}`).remove()));body.append(card);
    }
   };renderAudio=render;render();d.addEventListener('close',()=>{if(renderAudio===render)renderAudio=null;});
  },
  beforeNext(proceed){
   if(active){active.proceed=proceed;return true;}
   const entry=Object.entries(clips).filter(([,c])=>c.status==='approved').sort((a,b)=>a[1].at-b[1].at)[0];
   if(!entry)return false;this.play(entry[1],entry[0],true,proceed);return true;
  },
  play(clip,id,transition,proceed){
   if(active)return;
   api.pauseAmbient();
   const audio=new Audio(clip.audio),token={audio,proceed,timer:null,transition};active=token;audio.volume=.8;
   const clipRef=id?api.db.ref(`salas/${room}/audioClips/${id}`):null;
   token.clipRef=clipRef;token.consume=!!id;
   const finish=()=>{if(active!==token)return;if(id){delete clips[id];clipRef.remove().catch(console.warn);}this.stopAudio(true);};
   const failed=()=>{if(active!==token)return;token.consume=false;if(id){clip.status='pending';clips[id]=clip;clipRef.child('status').set('pending').catch(console.warn);}this.stopAudio(true);};
   audio.onended=finish;audio.onerror=failed;token.timer=setTimeout(finish,15000);
   if(id)delete clips[id];
   audio.play().catch(failed);
  },
  stopAudio(continuePlayback=false){
   const token=active;if(!token)return;active=null;clearTimeout(token.timer);token.audio.onended=null;token.audio.onerror=null;token.audio.pause();token.audio.removeAttribute('src');
   if(token.consume)token.clipRef.remove().catch(console.warn);
   if(continuePlayback){if(token.proceed)token.proceed();else if(!api.busy())api.resumeAmbient();}
  },
  end(){this.stopAudio();audioRef?.off();challengeRef?.off();clips={};room=null;}
 };
 root.SocialHost=host;root.SocialMobile={init:dock};
})(window);
