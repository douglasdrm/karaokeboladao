(() => {
    'use strict';

    const firebaseConfig = {
        apiKey: 'AIzaSyCnZ8hoE3NGNx2t490Yw12AxlCqVjSguig',
        authDomain: 'karaoke-party-online.firebaseapp.com',
        databaseURL: 'https://karaoke-party-online-default-rtdb.firebaseio.com',
        projectId: 'karaoke-party-online',
        storageBucket: 'karaoke-party-online.firebasestorage.app',
        messagingSenderId: '1059879567957',
        appId: '1:1059879567957:web:d4cb88563b39fe08934adc'
    };
    const CDN_BASE_URL = 'https://media.unodev.com.br/file/karaoke-midia/Musicas/';
    const SESSION_KEY = 'karaokeStandaloneTvSession';
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    const elements = {
        setup: document.getElementById('tvSetup'), loading: document.getElementById('tvLoading'),
        auth: document.getElementById('tvAuth'), connect: document.getElementById('tvConnect'),
        stage: document.getElementById('tvStage'), logout: document.getElementById('tvLogout'),
        authError: document.getElementById('tvAuthError'), roomError: document.getElementById('tvRoomError'),
        partyInput: document.getElementById('tvPartyInput'), identity: document.getElementById('tvIdentity'),
        resumeCard: document.getElementById('tvResumeCard'), resumeName: document.getElementById('tvResumeName'),
        resumeMeta: document.getElementById('tvResumeMeta'), newPartyDivider: document.getElementById('tvNewPartyDivider'),
        video: document.getElementById('tvVideo'), idle: document.getElementById('tvIdle'),
        idleEyebrow: document.getElementById('tvIdleEyebrow'), idleTitle: document.getElementById('tvIdleTitle'),
        idleDescription: document.getElementById('tvIdleDescription'), nowPlaying: document.getElementById('tvNowPlaying'),
        connection: document.getElementById('tvConnection'), partyName: document.getElementById('tvPartyName'),
        controllerStatus: document.getElementById('tvControllerStatus'), showAccess: document.getElementById('tvShowAccess'),
        roomLabel: document.getElementById('tvRoomLabel'), idleRoom: document.getElementById('tvIdleRoom'),
        qrCode: document.getElementById('tvQrCode'), djQrCode: document.getElementById('tvDjQrCode'),
        playbackLabel: document.getElementById('tvPlaybackLabel'), songTitle: document.getElementById('tvSongTitle'),
        singer: document.getElementById('tvSinger'), artist: document.getElementById('tvSongArtist'),
        queuePanel: document.getElementById('tvQueuePanel'), queue: document.getElementById('tvQueue'),
        score: document.getElementById('tvScore'), progress: document.querySelector('#tvProgress span'),
        startPlayback: document.getElementById('tvStartPlayback'), sound: document.getElementById('tvSound')
    };

    let currentUser = null;
    let currentRoom = '';
    let currentPartyName = '';
    let roomRef = null;
    let queue = [];
    let processedRequestKeys = new Set();
    let catalog = [];
    let currentSongId = '';
    let soundEnabled = true;
    let volume = .7;
    let commandQuery = null;
    let commandHandler = null;
    let requestRef = null;
    let requestHandler = null;
    let toolbarTimer = null;
    let lastTimePublish = 0;
    let suppressVideoEvents = false;
    let connectionRef = null;
    let connectionHandler = null;
    let controllerRef = null;
    let controllerHandler = null;
    let wakeLock = null;

    function readSession() {
        try {
            const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
            if (!value || !value.code || !value.uid || Date.now() - Number(value.updatedAt || 0) > 24 * 60 * 60 * 1000) return null;
            return value;
        } catch { return null; }
    }

    function saveSession(patch = {}) {
        if (!currentUser || !currentRoom) return;
        const state = {
            uid: currentUser.uid,
            code: currentRoom,
            name: currentPartyName || 'Minha festa',
            queue,
            processedRequestKeys: [...processedRequestKeys],
            currentSongId,
            currentTime: Number(elements.video.currentTime) || 0,
            wasPlaying: Boolean(currentSongId && !elements.video.paused),
            volume,
            updatedAt: Date.now(),
            ...patch
        };
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(state)); } catch {}
    }

    function clearSession() {
        try { localStorage.removeItem(SESSION_KEY); } catch {}
        elements.resumeCard.hidden = true;
        elements.newPartyDivider.hidden = true;
    }

    function refreshResumeCard() {
        const session = readSession();
        const canResume = Boolean(session && currentUser && session.uid === currentUser.uid);
        elements.resumeCard.hidden = !canResume;
        elements.newPartyDivider.hidden = !canResume;
        if (!canResume) return;
        elements.resumeName.textContent = session.name || 'Minha festa';
        elements.resumeMeta.textContent = `Sala ${session.code} · ${Array.isArray(session.queue) ? session.queue.length : 0} músicas`;
    }

    function parseQueue(value) {
        if (!value) return [];
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
        } catch { return []; }
    }

    function showSetup(target) {
        elements.setup.hidden = false;
        elements.stage.hidden = true;
        [elements.loading, elements.auth, elements.connect].forEach(section => { section.hidden = section !== target; });
    }

    function showError(element, message = '') {
        element.textContent = message;
        element.hidden = !message;
    }

    function normalizeSong(raw) {
        const id = String(raw?.codigo ?? raw?.id ?? '').padStart(5, '0');
        if (id === '00000') return null;
        return {
            id,
            title: raw?.titulo ?? raw?.title ?? 'Música sem título',
            artist: raw?.artista ?? raw?.artist ?? 'Artista não informado',
            lyrics: raw?.inicioletra ?? raw?.lyrics ?? '',
            estilo: raw?.estilo || 'Pop', idioma: raw?.idioma || 'BRA'
        };
    }

    async function loadCatalog() {
        if (catalog.length) return;
        const config = (await db.ref('config/catalog').once('value')).val() || {};
        let songs = [];
        if (config.mode === 'fragmented' && Number(config.totalChunks) > 0) {
            const reads = Array.from({ length: Number(config.totalChunks) }, (_, index) =>
                db.ref(`catalog_chunks/part_${index}`).once('value').then(snapshot => snapshot.val() || [])
            );
            songs = (await Promise.all(reads)).flat();
        } else if (config.url && firebase.storage) {
            const blob = await firebase.storage().ref('songs.json').getBlob();
            songs = (JSON.parse(await blob.text()).musicas || []);
        } else {
            const response = await fetch('songs.json');
            if (!response.ok) throw new Error('Catálogo indisponível');
            songs = (await response.json()).musicas || [];
        }
        catalog = songs.map(normalizeSong).filter(Boolean);
    }

    function buildUrl(page, code, extra = '') {
        return new URL(`${page}?room=${encodeURIComponent(code)}${extra}`, window.location.href).href;
    }

    function drawQr(container, text, size) {
        container.replaceChildren();
        new QRCode(container, { text, width: size, height: size, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
    }

    function renderQr() {
        drawQr(elements.qrCode, buildUrl('mobile.html', currentRoom), 300);
        drawQr(elements.djQrCode, buildUrl('cabine-mobile.html', currentRoom, '&from=tv-standalone'), 170);
    }

    function renderQueue() {
        elements.queue.replaceChildren();
        queue.slice(0, 4).forEach((item, index) => {
            const row = document.createElement('li');
            const position = document.createElement('span');
            const singer = document.createElement('strong');
            const song = document.createElement('small');
            position.textContent = index === 0 ? (currentSongId ? 'NO PALCO' : 'PRÓXIMO') : `${index + 1}º`;
            singer.textContent = item.singer || 'Cantor';
            song.textContent = [item.title, item.artist].filter(Boolean).join(' · ');
            row.append(position, singer, song);
            elements.queue.append(row);
        });
        elements.queuePanel.hidden = queue.length < 2;
        if (!currentSongId) {
            const next = queue[0];
            elements.idleEyebrow.textContent = next ? 'PREPARE O MICROFONE' : 'A FESTA ESTÁ ABERTA';
            elements.idleTitle.textContent = next ? (next.singer || 'Próximo cantor') : 'Escolha sua música';
            elements.idleDescription.textContent = next
                ? [next.title, next.artist].filter(Boolean).join(' · ')
                : 'Convidados usam o QR maior. O DJ usa o QR de controle com sua própria conta.';
        }
    }

    async function publishQueue() {
        renderQueue();
        if (roomRef) await roomRef.child('queue_v13').set(JSON.stringify(queue));
        saveSession();
    }

    function rebalanceQueue() {
        const current = currentSongId ? queue[0] : null;
        const waiting = current ? queue.slice(1) : [...queue];
        const counts = {};
        if (current) counts[String(current.singer || '').toUpperCase()] = 1;
        waiting.sort((a, b) => Number(a.time) - Number(b.time));
        waiting.forEach(item => {
            const name = String(item.singer || 'CONVIDADO').trim().toUpperCase();
            item.singer = name;
            counts[name] = (counts[name] || 0) + 1;
            item.round = counts[name];
        });
        waiting.sort((a, b) => a.round - b.round || Number(a.time) - Number(b.time));
        queue = current ? [current, ...waiting] : waiting;
    }

    async function enqueue(song, singer, playNext = false, extra = {}) {
        const entry = { ...song, ...extra, singer: String(singer || 'Convidado').trim().toUpperCase(), time: Number(extra.time) || Date.now() };
        const wasEmpty = queue.length === 0;
        if (playNext && currentSongId) queue.splice(1, 0, entry);
        else { queue.push(entry); rebalanceQueue(); }
        await publishQueue();
        if (wasEmpty && !currentSongId) playCurrent();
    }

    async function publishPlaying(playing) {
        if (!roomRef || !currentSongId) return;
        await roomRef.child('now_playing/playing').set(playing);
        await roomRef.child('host_state').update({ playing, updatedAt: firebase.database.ServerValue.TIMESTAMP });
        elements.playbackLabel.textContent = playing ? 'TOCANDO AGORA' : 'PAUSADO';
        saveSession({ wasPlaying: playing });
    }

    async function playCurrent({ resumeAt = 0, autoplay = true } = {}) {
        if (!queue.length || !roomRef) {
            currentSongId = '';
            elements.idle.hidden = false;
            elements.nowPlaying.hidden = true;
            elements.stage.classList.remove('is-playing');
            await roomRef?.child('now_playing').set({ playing: false });
            renderQueue();
            saveSession({ currentSongId: '', currentTime: 0, wasPlaying: false });
            return;
        }
        const current = queue[0];
        currentSongId = String(current.id).padStart(5, '0');
        elements.idle.hidden = true;
        elements.nowPlaying.hidden = false;
        elements.stage.classList.add('is-playing');
        elements.playbackLabel.textContent = autoplay ? 'TOCANDO AGORA' : 'PAUSADO';
        elements.songTitle.textContent = current.title;
        elements.singer.textContent = current.singer;
        elements.artist.textContent = current.artist;
        elements.progress.style.width = '0%';
        renderQueue();
        await roomRef.child('now_playing').set({
            title: current.title, artist: current.artist, singer: current.singer,
            songId: currentSongId, playing: autoplay, pitch: 1,
            requesterUid: current.requesterUid || current.singerUid || null,
            time: { current: resumeAt, total: 0 }
        });
        suppressVideoEvents = true;
        elements.video.src = `${CDN_BASE_URL}${currentSongId}.mp4`;
        elements.video.volume = volume;
        elements.video.muted = !soundEnabled;
        elements.video.load();
        suppressVideoEvents = false;
        if (resumeAt > 0) {
            elements.video.addEventListener('loadedmetadata', () => {
                try { elements.video.currentTime = Math.min(resumeAt, Math.max(0, elements.video.duration - 1)); } catch {}
                if (autoplay) requestPlayback();
            }, { once: true });
        } else if (autoplay) requestPlayback();
        if (!autoplay) elements.startPlayback.hidden = false;
        saveSession({ currentSongId, currentTime: resumeAt, wasPlaying: autoplay });
    }

    async function finishCurrent() {
        if (!currentSongId) return;
        queue.shift();
        currentSongId = '';
        await publishQueue();
        await playCurrent();
    }

    function requestPlayback() {
        elements.video.play().then(() => {
            elements.startPlayback.hidden = true;
            publishPlaying(true).catch(console.warn);
        }).catch(() => {
            elements.startPlayback.textContent = '▶ Iniciar apresentação';
            elements.startPlayback.hidden = false;
            publishPlaying(false).catch(console.warn);
        });
    }

    function findQueueIndex(payload) {
        const itemTime = String(payload?.itemTime || '');
        if (itemTime) return queue.findIndex(item => String(item.time || '') === itemTime);
        const index = Number(payload?.index);
        return Number.isInteger(index) && index >= 0 && index < queue.length ? index : -1;
    }

    async function handleCommand(snapshot) {
        const command = snapshot.val() || {};
        try {
            if (command.senderUid !== currentUser?.uid) return;
            const payload = command.payload || {};
            switch (command.action) {
                case 'play_pause':
                    if (!currentSongId) {
                        if (queue.length) await playCurrent();
                        break;
                    }
                    if (elements.video.paused) requestPlayback();
                    else { elements.video.pause(); await publishPlaying(false); }
                    break;
                case 'restart': elements.video.currentTime = 0; break;
                case 'skip': await finishCurrent(); break;
                case 'volume':
                    if (!Number.isFinite(Number(payload.value))) break;
                    volume = Math.max(0, Math.min(1, Number(payload.value)));
                    elements.video.volume = volume;
                    await roomRef.child('host_state').update({ volume, updatedAt: firebase.database.ServerValue.TIMESTAMP });
                    saveSession();
                    break;
                case 'queue_add': {
                    const song = catalog.find(item => item.id === String(payload.songId || '').padStart(5, '0'));
                    if (song && String(payload.singer || '').trim()) await enqueue(song, payload.singer, payload.playNext === true);
                    break;
                }
                case 'queue_move': {
                    const index = findQueueIndex(payload);
                    const target = index + Number(payload.direction);
                    if (index > 0 && target > 0 && target < queue.length) {
                        [queue[index], queue[target]] = [queue[target], queue[index]];
                        await publishQueue();
                    }
                    break;
                }
                case 'queue_next': {
                    const index = findQueueIndex(payload);
                    if (index > 1) { const [item] = queue.splice(index, 1); queue.splice(1, 0, item); await publishQueue(); }
                    break;
                }
                case 'queue_remove': {
                    const index = findQueueIndex(payload);
                    if (index > 0) { queue.splice(index, 1); await publishQueue(); }
                    break;
                }
            }
        } catch (error) {
            console.error('Falha ao executar comando na TV:', error);
        } finally {
            snapshot.ref.remove().catch(console.warn);
        }
    }

    async function handleRequest(snapshot) {
        const request = snapshot.val() || {};
        if (request.processed || request.kind) return;
        if (processedRequestKeys.has(snapshot.key) || queue.some(item => item.requestKey === snapshot.key)) return;
        const song = catalog.find(item => item.id === String(request.id || '').padStart(5, '0'));
        if (!song || !request.singer) return;
        await enqueue(song, request.singer, false, {
            singerUid: request.singerUid || null,
            requesterUid: request.requesterUid || request.singerUid || null,
            requestKey: snapshot.key,
            time: Number(request.timestamp) || Date.now()
        });
        processedRequestKeys.add(snapshot.key);
        saveSession();
        snapshot.ref.update({ processed: true }).catch(() => {});
    }

    function stopRoomListeners() {
        if (commandQuery && commandHandler) commandQuery.off('child_added', commandHandler);
        if (requestRef && requestHandler) requestRef.off('child_added', requestHandler);
        commandQuery = commandHandler = requestRef = requestHandler = null;
        if (connectionRef && connectionHandler) connectionRef.off('value', connectionHandler);
        if (controllerRef && controllerHandler) controllerRef.off('value', controllerHandler);
        connectionRef = connectionHandler = controllerRef = controllerHandler = null;
    }

    function startRoomListeners() {
        const startedAt = Date.now() - 5000;
        commandQuery = roomRef.child('host_commands').limitToLast(20);
        commandHandler = snapshot => {
            const value = snapshot.val() || {};
            if (Number(value.createdAt) >= startedAt) handleCommand(snapshot);
        };
        commandQuery.on('child_added', commandHandler);
        requestRef = roomRef.child('pedidos');
        requestHandler = snapshot => handleRequest(snapshot).catch(console.error);
        requestRef.on('child_added', requestHandler);
        connectionRef = db.ref('.info/connected');
        connectionHandler = snapshot => {
            const online = snapshot.val() === true;
            elements.connection.textContent = online ? 'TV ONLINE' : 'TV SEM INTERNET';
            elements.connection.classList.toggle('is-offline', !online);
            elements.stage.classList.toggle('is-offline', !online);
            if (online && roomRef) {
                roomRef.child('info').update({
                    status: 'online',
                    reconnectedAt: firebase.database.ServerValue.TIMESTAMP
                }).then(() => armDisconnectState()).catch(error => console.warn('Não foi possível restaurar a presença da TV.', error));
            }
        };
        connectionRef.on('value', connectionHandler);
        controllerRef = roomRef.child(`dj_controllers/${currentUser.uid}`);
        controllerHandler = snapshot => {
            const connected = snapshot.numChildren() > 0;
            elements.controllerStatus.textContent = connected ? 'CELULAR DO DJ CONECTADO' : 'AGUARDANDO CELULAR DO DJ';
            elements.controllerStatus.classList.toggle('is-connected', connected);
        };
        controllerRef.on('value', controllerHandler);
    }

    async function generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ2346789';
        for (let attempt = 0; attempt < 8; attempt++) {
            let code = '';
            for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
            if (!(await db.ref(`salas/${code}/info`).once('value')).exists()) return code;
        }
        throw new Error('Não foi possível gerar uma sala livre.');
    }

    function roomInfo(name) {
        return {
            name,
            hostId: currentUser.uid,
            hostName: currentUser.displayName || currentUser.email || 'DJ',
            hostPhoto: currentUser.photoURL || '',
            status: 'online',
            mode: 'tv-standalone',
            timestamp: firebase.database.ServerValue.TIMESTAMP
        };
    }

    function showPartyStage(name) {
        currentPartyName = name;
        elements.partyName.textContent = name;
        elements.roomLabel.textContent = `SALA ${currentRoom}`;
        elements.idleRoom.textContent = `SALA ${currentRoom}`;
        elements.connection.textContent = 'TV ONLINE';
        elements.controllerStatus.textContent = 'AGUARDANDO CELULAR DO DJ';
        elements.controllerStatus.classList.remove('is-connected');
        renderQr();
        renderQueue();
        elements.setup.hidden = true;
        elements.stage.hidden = false;
        elements.sound.textContent = soundEnabled ? '🔊 Desativar som' : '🔇 Ativar som';
        requestWakeLock();
    }

    async function requestWakeLock() {
        if (!('wakeLock' in navigator) || document.visibilityState !== 'visible' || wakeLock) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; }, { once: true });
        } catch (error) { console.info('A TV não permitiu manter a tela ativa.', error); }
    }

    function toggleAccess(force) {
        const show = typeof force === 'boolean' ? force : !elements.stage.classList.contains('show-access');
        elements.stage.classList.toggle('show-access', show);
        elements.idle.hidden = show ? false : Boolean(currentSongId);
        elements.showAccess.textContent = show ? '✕ Fechar QR Codes' : '▦ Mostrar QR Codes';
        showToolbar();
    }

    function armDisconnectState() {
        return roomRef.child('info').onDisconnect().update({
            status: 'offline',
            disconnectedAt: firebase.database.ServerValue.TIMESTAMP
        });
    }

    async function createParty(name) {
        showError(elements.roomError);
        await loadCatalog();
        if (!catalog.length) throw new Error('O catálogo não pôde ser carregado.');
        const previousSession = readSession();
        if (previousSession?.uid === currentUser.uid) {
            const previousRef = db.ref(`salas/${previousSession.code}`);
            const previousInfo = (await previousRef.child('info').once('value')).val();
            if (previousInfo?.hostId === currentUser.uid) await previousRef.remove().catch(() => {});
        }
        clearSession();
        currentRoom = await generateRoomCode();
        roomRef = db.ref(`salas/${currentRoom}`);
        queue = [];
        processedRequestKeys = new Set();
        currentSongId = '';
        await roomRef.set({
            info: roomInfo(name),
            queue_v13: '[]',
            host_state: { playing: false, volume, pitch: 1, toneAvailable: false, updatedAt: firebase.database.ServerValue.TIMESTAMP }
        });
        await armDisconnectState();
        try { localStorage.setItem('lastStandalonePartyName', name); } catch {}
        showPartyStage(name);
        saveSession({ currentSongId: '', currentTime: 0, wasPlaying: false });
        startRoomListeners();
    }

    async function resumeParty() {
        const session = readSession();
        if (!session || session.uid !== currentUser?.uid) throw new Error('A festa anterior não está mais disponível.');
        await loadCatalog();
        currentRoom = session.code;
        currentPartyName = session.name || 'Minha festa';
        roomRef = db.ref(`salas/${currentRoom}`);
        const snapshot = await roomRef.once('value');
        const remote = snapshot.val();
        if (remote?.info?.hostId && remote.info.hostId !== currentUser.uid) throw new Error('O código anterior agora pertence a outra festa.');
        queue = remote ? parseQueue(remote.queue_v13) : (Array.isArray(session.queue) ? session.queue : []);
        processedRequestKeys = new Set(Array.isArray(session.processedRequestKeys) ? session.processedRequestKeys : []);
        queue.forEach(item => { if (item.requestKey) processedRequestKeys.add(item.requestKey); });
        volume = Math.max(0, Math.min(1, Number(remote?.host_state?.volume ?? session.volume ?? .7)));
        const remoteSongId = String(remote?.now_playing?.songId || '');
        const savedSongId = String(session.currentSongId || '');
        const candidateSongId = remoteSongId || savedSongId;
        const hasCurrent = Boolean(queue[0] && String(queue[0].id).padStart(5, '0') === candidateSongId.padStart(5, '0'));
        const resumeAt = Number(remote?.now_playing?.time?.current ?? session.currentTime) || 0;
        const wasPlaying = remote?.now_playing?.playing ?? session.wasPlaying ?? false;
        currentSongId = '';
        await roomRef.update({
            info: roomInfo(currentPartyName),
            queue_v13: JSON.stringify(queue),
            host_state: { playing: Boolean(hasCurrent && wasPlaying), volume, pitch: 1, toneAvailable: false, updatedAt: firebase.database.ServerValue.TIMESTAMP }
        });
        await armDisconnectState();
        showPartyStage(currentPartyName);
        if (hasCurrent) await playCurrent({ resumeAt, autoplay: Boolean(wasPlaying) });
        else if (queue.length) await playCurrent({ autoplay: false });
        else saveSession({ currentSongId: '', currentTime: 0, wasPlaying: false });
        startRoomListeners();
    }

    async function endParty() {
        stopRoomListeners();
        elements.stage.classList.remove('show-access', 'toolbar-visible');
        elements.showAccess.textContent = '▦ Mostrar QR Codes';
        if (wakeLock) await wakeLock.release().catch(() => {});
        wakeLock = null;
        suppressVideoEvents = true;
        elements.video.pause();
        elements.video.removeAttribute('src');
        elements.video.load();
        suppressVideoEvents = false;
        if (roomRef) {
            await roomRef.onDisconnect().cancel().catch(() => {});
            await roomRef.remove().catch(console.warn);
        }
        currentRoom = '';
        currentPartyName = '';
        roomRef = null;
        queue = [];
        processedRequestKeys = new Set();
        currentSongId = '';
        clearSession();
        showSetup(elements.connect);
    }

    async function forgetSavedParty() {
        const session = readSession();
        if (session?.uid === currentUser?.uid) {
            const savedRef = db.ref(`salas/${session.code}`);
            const info = (await savedRef.child('info').once('value')).val();
            if (info?.hostId === currentUser.uid) await savedRef.remove().catch(() => {});
        }
        clearSession();
    }

    document.getElementById('tvGoogle').addEventListener('click', async event => {
        showError(elements.authError);
        event.currentTarget.disabled = true;
        try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
        catch (error) {
            if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
                showError(elements.authError, `Não foi possível entrar com Google${error.code ? ` (${error.code})` : ''}.`);
            }
        } finally { event.currentTarget.disabled = false; }
    });

    document.getElementById('tvEmailForm').addEventListener('submit', async event => {
        event.preventDefault();
        showError(elements.authError);
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        try { await auth.signInWithEmailAndPassword(document.getElementById('tvEmail').value.trim(), document.getElementById('tvPassword').value); }
        catch { showError(elements.authError, 'E-mail ou senha inválidos.'); }
        finally { button.disabled = false; }
    });

    document.getElementById('tvRoomForm').addEventListener('submit', async event => {
        event.preventDefault();
        const name = elements.partyInput.value.trim();
        if (!name) return;
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        button.textContent = 'Abrindo festa…';
        try { await createParty(name); }
        catch (error) { console.error(error); showError(elements.roomError, error.message || 'Não foi possível abrir a festa nesta TV.'); }
        finally { button.disabled = false; button.textContent = 'Abrir festa na TV'; }
    });

    document.getElementById('tvResumeParty').addEventListener('click', async event => {
        const button = event.currentTarget;
        showError(elements.roomError);
        button.disabled = true;
        button.textContent = 'Retomando…';
        try { await resumeParty(); }
        catch (error) {
            console.error(error);
            showError(elements.roomError, error.message || 'Não foi possível retomar a festa.');
        } finally { button.disabled = false; button.textContent = 'Retomar'; }
    });

    document.getElementById('tvForgetParty').addEventListener('click', () => forgetSavedParty().catch(console.warn));

    elements.logout.addEventListener('click', async () => { if (roomRef) await endParty(); await auth.signOut(); });
    document.getElementById('tvChangeRoom').addEventListener('click', async () => {
        if (window.confirm('Encerrar esta festa e remover a sala?')) await endParty();
    });
    elements.sound.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        elements.video.muted = !soundEnabled;
        elements.sound.textContent = soundEnabled ? '🔊 Desativar som' : '🔇 Ativar som';
        if (soundEnabled && currentSongId && elements.video.paused) requestPlayback();
    });
    document.getElementById('tvFullscreen').addEventListener('click', async () => {
        try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen(); }
        catch { alert('Use a opção de tela cheia do navegador.'); }
    });
    elements.showAccess.addEventListener('click', () => toggleAccess());
    elements.startPlayback.addEventListener('click', requestPlayback);
    elements.video.addEventListener('play', () => { if (!suppressVideoEvents) publishPlaying(true).catch(console.warn); });
    elements.video.addEventListener('pause', () => { if (!suppressVideoEvents && currentSongId && !elements.video.ended) publishPlaying(false).catch(console.warn); });
    elements.video.addEventListener('ended', () => finishCurrent().catch(console.error));
    elements.video.addEventListener('timeupdate', () => {
        const total = Number(elements.video.duration) || 0;
        const current = Number(elements.video.currentTime) || 0;
        elements.progress.style.width = `${total ? current / total * 100 : 0}%`;
        if (roomRef && currentSongId && Date.now() - lastTimePublish > 1000) {
            lastTimePublish = Date.now();
            roomRef.child('now_playing/time').set({ current, total }).catch(() => {});
            saveSession({ currentTime: current });
        }
    });
    elements.video.addEventListener('error', () => {
        elements.startPlayback.textContent = 'Vídeo indisponível · pular pelo celular';
        elements.startPlayback.hidden = false;
    });
    function showToolbar() {
        clearTimeout(toolbarTimer);
        elements.stage.classList.add('toolbar-visible');
        toolbarTimer = setTimeout(() => elements.stage.classList.remove('toolbar-visible'), 2500);
    }
    elements.stage.addEventListener('pointermove', showToolbar);
    window.addEventListener('keydown', event => {
        const key = event.key.toLowerCase();
        const stageVisible = !elements.stage.hidden;
        if (stageVisible) showToolbar();
        if (stageVisible && key === 'f') document.getElementById('tvFullscreen').click();
        if (stageVisible && key === 'm') elements.sound.click();
        if (stageVisible && key === 'q') elements.showAccess.click();
        if ((event.key === 'Escape' || event.key === 'BrowserBack') && elements.stage.classList.contains('show-access')) {
            event.preventDefault();
            toggleAccess(false);
            elements.showAccess.focus();
            return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
        const focusable = [...document.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')]
            .filter(node => !node.closest('[hidden]') && node.getClientRects().length);
        if (!focusable.length) return;
        event.preventDefault();
        const current = focusable.indexOf(document.activeElement);
        const step = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        focusable[(current + step + focusable.length) % focusable.length].focus();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !elements.stage.hidden) requestWakeLock();
    });

    auth.onAuthStateChanged(user => {
        currentUser = user;
        elements.logout.hidden = !user;
        if (!user) { showSetup(elements.auth); return; }
        elements.identity.textContent = `Conectado como ${user.displayName || user.email || 'DJ'}`;
        try { elements.partyInput.value = localStorage.getItem('lastStandalonePartyName') || ''; } catch {}
        showSetup(elements.connect);
        refreshResumeCard();
        loadCatalog().catch(error => console.warn('Catálogo ainda não disponível:', error));
    });
})();
