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
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    const elements = {
        setup: document.getElementById('tvSetup'), loading: document.getElementById('tvLoading'),
        auth: document.getElementById('tvAuth'), connect: document.getElementById('tvConnect'),
        stage: document.getElementById('tvStage'), logout: document.getElementById('tvLogout'),
        authError: document.getElementById('tvAuthError'), roomError: document.getElementById('tvRoomError'),
        partyInput: document.getElementById('tvPartyInput'), identity: document.getElementById('tvIdentity'),
        video: document.getElementById('tvVideo'), idle: document.getElementById('tvIdle'),
        idleEyebrow: document.getElementById('tvIdleEyebrow'), idleTitle: document.getElementById('tvIdleTitle'),
        idleDescription: document.getElementById('tvIdleDescription'), nowPlaying: document.getElementById('tvNowPlaying'),
        connection: document.getElementById('tvConnection'), partyName: document.getElementById('tvPartyName'),
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
    let roomRef = null;
    let queue = [];
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
    }

    async function playCurrent() {
        if (!queue.length || !roomRef) {
            currentSongId = '';
            elements.idle.hidden = false;
            elements.nowPlaying.hidden = true;
            elements.stage.classList.remove('is-playing');
            await roomRef?.child('now_playing').set({ playing: false });
            renderQueue();
            return;
        }
        const current = queue[0];
        currentSongId = String(current.id).padStart(5, '0');
        elements.idle.hidden = true;
        elements.nowPlaying.hidden = false;
        elements.stage.classList.add('is-playing');
        elements.playbackLabel.textContent = 'TOCANDO AGORA';
        elements.songTitle.textContent = current.title;
        elements.singer.textContent = current.singer;
        elements.artist.textContent = current.artist;
        elements.progress.style.width = '0%';
        renderQueue();
        await roomRef.child('now_playing').set({
            title: current.title, artist: current.artist, singer: current.singer,
            songId: currentSongId, playing: true, pitch: 1,
            requesterUid: current.requesterUid || current.singerUid || null,
            time: { current: 0, total: 0 }
        });
        suppressVideoEvents = true;
        elements.video.src = `${CDN_BASE_URL}${currentSongId}.mp4`;
        elements.video.volume = volume;
        elements.video.muted = !soundEnabled;
        elements.video.load();
        suppressVideoEvents = false;
        requestPlayback();
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
        const song = catalog.find(item => item.id === String(request.id || '').padStart(5, '0'));
        if (!song || !request.singer) return;
        await enqueue(song, request.singer, false, {
            singerUid: request.singerUid || null,
            requesterUid: request.requesterUid || request.singerUid || null,
            time: Number(request.timestamp) || Date.now()
        });
        snapshot.ref.update({ processed: true }).catch(() => {});
    }

    function stopRoomListeners() {
        if (commandQuery && commandHandler) commandQuery.off('child_added', commandHandler);
        if (requestRef && requestHandler) requestRef.off('child_added', requestHandler);
        commandQuery = commandHandler = requestRef = requestHandler = null;
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

    async function createParty(name) {
        showError(elements.roomError);
        await loadCatalog();
        if (!catalog.length) throw new Error('O catálogo não pôde ser carregado.');
        currentRoom = await generateRoomCode();
        roomRef = db.ref(`salas/${currentRoom}`);
        queue = [];
        currentSongId = '';
        await roomRef.set({
            info: {
                name, hostId: currentUser.uid, hostName: currentUser.displayName || currentUser.email || 'DJ',
                hostPhoto: currentUser.photoURL || '', status: 'online', mode: 'tv-standalone',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            },
            queue_v13: '[]',
            host_state: { playing: false, volume, pitch: 1, toneAvailable: false, updatedAt: firebase.database.ServerValue.TIMESTAMP }
        });
        roomRef.onDisconnect().remove();
        try { localStorage.setItem('lastStandalonePartyName', name); } catch {}
        elements.partyName.textContent = name;
        elements.roomLabel.textContent = `SALA ${currentRoom}`;
        elements.idleRoom.textContent = `SALA ${currentRoom}`;
        elements.connection.textContent = 'TV COMANDA';
        renderQr();
        renderQueue();
        startRoomListeners();
        elements.setup.hidden = true;
        elements.stage.hidden = false;
        elements.sound.textContent = '🔊 Desativar som';
    }

    async function endParty() {
        stopRoomListeners();
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
        roomRef = null;
        queue = [];
        currentSongId = '';
        showSetup(elements.connect);
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
        showToolbar();
        if (event.key.toLowerCase() === 'f') document.getElementById('tvFullscreen').click();
        if (event.key.toLowerCase() === 'm') elements.sound.click();
    });

    auth.onAuthStateChanged(user => {
        currentUser = user;
        elements.logout.hidden = !user;
        if (!user) { showSetup(elements.auth); return; }
        elements.identity.textContent = `Conectado como ${user.displayName || user.email || 'DJ'}`;
        try { elements.partyInput.value = localStorage.getItem('lastStandalonePartyName') || ''; } catch {}
        showSetup(elements.connect);
        loadCatalog().catch(error => console.warn('Catálogo ainda não disponível:', error));
    });
})();
