(function () {
    'use strict';
    const { el, button, dialog, download } = PartyUI;
    let api, party, track, generation = 0, saveChain = Promise.resolve(), lastError = null;
    function base() {
        const user = api.user();
        if (!user) throw new Error('Entre na conta do DJ.');
        return api.db.ref(`users/${user.uid}/stats/partyTools`);
    }
    function save() {
        if (!party) return Promise.resolve();
        const snapshot = JSON.parse(JSON.stringify(party));
        const reference = base().child('sessions/' + snapshot.id);
        saveChain = saveChain.catch(() => {}).then(() => reference.set(snapshot)).then(() => { lastError = null; }).catch(error => {
            lastError = error;
            console.warn('Resumo ainda não sincronizado:', error);
            throw error;
        });
        // Every caller may await for user-visible actions; background hooks do not
        // stop playback if the network is unavailable.
        saveChain.catch(() => {});
        return saveChain;
    }
    function backgroundSave() { save().catch(() => {}); }
    function begin(name) {
        if (party) { party.endedAt = Date.now(); backgroundSave(); }
        party = { id: base().child('sessions').push().key, name, startedAt: Date.now(), songs: {} };
        track = null; generation++; backgroundSave();
    }
    async function playing(song, video) {
        const token = ++generation;
        if (party) {
            const previous = party.songs[track];
            if (previous?.status === 'playing') { previous.status = 'skipped'; previous.endedAt = Date.now(); }
            track = base().push().key;
            party.songs[track] = { id: String(song.id), title: song.title || '', artist: song.artist || '', singer: song.singer || 'Convidado', status: 'playing', startedAt: Date.now() };
            backgroundSave();
        }
        try {
            const snap = await base().child('preferences/' + PartyCore.preferenceKey(song)).once('value');
            const preference = snap.val();
            if (token !== generation || document.getElementById('mainVideo') !== video || !preference || !PartyCore.validPitch(preference.pitch)) return;
            api.setPitch(preference.pitch);
        } catch (error) { console.warn('Não foi possível carregar o tom salvo:', error); }
    }
    function complete(score, status = 'completed') {
        const item = party?.songs?.[track];
        if (!item || item.status !== 'playing') return;
        item.status = status; item.endedAt = Date.now();
        if (status === 'completed' && Number.isFinite(score)) item.score = score;
        backgroundSave();
    }
    async function preferences() {
        const song = api.song();
        if (!song || !document.getElementById('mainVideo')) { alert('Inicie uma música para salvar o tom dos cantores.'); return; }
        const userUid = api.user()?.uid;
        const reference = base().child('preferences/' + PartyCore.preferenceKey(song));
        const { body } = dialog('Tom preferido');
        body.append(el('h3', song.title), el('p', song.singer), el('p', 'Salvo na conta deste DJ para esta música e formação de cantores. Pedidos em grupo têm preferência própria.', 'party-muted'));
        const actions = el('div', undefined, 'party-actions');
        const message = el('p', '', 'party-muted');
        actions.append(button('Salvar o tom atual', async () => {
            if (api.user()?.uid !== userUid || api.song() !== song) throw new Error('A música ou a conta mudou. Abra novamente este painel.');
            const pitch = api.pitch();
            if (!PartyCore.validPitch(pitch)) throw new Error('Tom inválido.');
            await reference.set({ pitch, title: song.title || '', singer: song.singer || '', updatedAt: firebase.database.ServerValue.TIMESTAMP });
            message.textContent = 'Tom salvo. Será aplicado nos próximos pedidos desta música para estes cantores.';
        }), button('Esquecer preferência', async () => {
            await reference.remove(); message.textContent = 'Preferência removida. As próximas execuções começam no tom original.';
        }));
        body.append(actions, message);
    }
    function showSummary(value, current = false) {
        const { body } = dialog(current ? 'Resumo da festa atual' : 'Resumo da festa');
        const summary = PartyCore.summarize(value);
        body.append(el('h3', value.name), el('p', `${summary.completed.length} apresentações concluídas · ${summary.formations} formações diferentes`));
        body.append(el('p', `${summary.skipped} puladas · ${summary.failed} com erro. Uma dupla ou grupo conta como uma formação.`, 'party-muted'));
        if (lastError && current) body.append(el('p', 'O último salvamento falhou. Você pode baixar o resumo e tentar salvar novamente.', 'party-warning'));
        const actions = el('div', undefined, 'party-actions');
        actions.append(button('Baixar resumo', () => download(PartyCore.summaryText(value), 'resumo-da-festa.txt')),
            button('Compartilhar', async () => {
                const text = PartyCore.summaryText(value);
                if (navigator.share) { try { await navigator.share({title:value.name, text}); } catch (e) { if (e.name !== 'AbortError') throw e; } }
                else download(text, 'resumo-da-festa.txt');
            }));
        if (current) actions.append(button('Salvar agora', () => save()), button('Encerrar festa e sair', async () => {
            if (!confirm('Encerrar a festa e sair da cabine? A reprodução será interrompida.')) return;
            await end(); api.logout();
        }));
        body.append(actions, el('pre', PartyCore.summaryText(value)));
    }
    async function summaries() {
        const { body } = dialog('Festas e resumos');
        if (party) body.append(button('Ver festa atual', () => showSummary(JSON.parse(JSON.stringify(party)), true)));
        const list = el('div'); body.append(list); list.append(el('p', 'Carregando festas salvas…'));
        try {
            const snap = await base().child('sessions').limitToLast(30).once('value');
            list.replaceChildren();
            const items = Object.values(snap.val() || {}).sort((a,b) => b.startedAt-a.startedAt);
            if (!items.length) list.append(el('p', 'As festas aparecerão aqui a partir desta atualização.'));
            for (const item of items) {
                const card = el('div', undefined, 'party-card');
                card.append(el('strong', item.name), el('p', new Date(item.startedAt).toLocaleString('pt-BR'), 'party-muted'), button('Abrir resumo', () => showSummary(item)));
                list.append(card);
            }
        } catch (error) { list.replaceChildren(el('p', 'Não foi possível carregar as festas: ' + error.message)); }
    }
    async function end() {
        if (!party) return;
        complete(null, 'skipped'); party.endedAt = Date.now();
        let timer;
        try {
            await Promise.race([save(), new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Sem confirmação de salvamento. Baixe o resumo ou tente novamente.')), 5000);
            })]);
        } finally { clearTimeout(timer); }
    }
    window.PartyHost = {
        init(options) { api = options; document.getElementById('btnSongPreference').onclick = preferences; document.getElementById('btnPartySummary').onclick = summaries; },
        begin, playing, complete, end, toneEdited() { generation++; },
        invalidate() { generation++; }
    };
})();
