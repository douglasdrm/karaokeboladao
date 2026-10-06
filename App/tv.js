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
        setup: document.getElementById('tvSetup'),
        loading: document.getElementById('tvLoading'),
        auth: document.getElementById('tvAuth'),
        connect: document.getElementById('tvConnect'),
        stage: document.getElementById('tvStage'),
        logout: document.getElementById('tvLogout'),
        authError: document.getElementById('tvAuthError'),
        roomError: document.getElementById('tvRoomError'),
        roomInput: document.getElementById('tvRoomCode'),
        identity: document.getElementById('tvIdentity'),
        video: document.getElementById('tvVideo'),
        idle: document.getElementById('tvIdle'),
        idleEyebrow: document.getElementById('tvIdleEyebrow'),
        idleTitle: document.getElementById('tvIdleTitle'),
        idleDescription: document.getElementById('tvIdleDescription'),
        nowPlaying: document.getElementById('tvNowPlaying'),
        connection: document.getElementById('tvConnection'),
        partyName: document.getElementById('tvPartyName'),
        roomLabel: document.getElementById('tvRoomLabel'),
        idleRoom: document.getElementById('tvIdleRoom'),
        qrCode: document.getElementById('tvQrCode'),
        djQrCode: document.getElementById('tvDjQrCode'),
        playbackLabel: document.getElementById('tvPlaybackLabel'),
        songTitle: document.getElementById('tvSongTitle'),
        singer: document.getElementById('tvSinger'),
        artist: document.getElementById('tvSongArtist'),
        queuePanel: document.getElementById('tvQueuePanel'),
        queue: document.getElementById('tvQueue'),
        score: document.getElementById('tvScore'),
        scoreValue: document.getElementById('tvScoreValue'),
        scoreSinger: document.getElementById('tvScoreSinger'),
        progress: document.querySelector('#tvProgress span'),
        startPlayback: document.getElementById('tvStartPlayback'),
        sound: document.getElementById('tvSound')
    };

    let currentUser = null;
    let currentRoom = '';
    let currentSongId = '';
    let currentNowPlaying = null;
    let soundEnabled = false;
    let scoreRevealTimer = null;
    let scoreHideTimer = null;
    let toolbarTimer = null;
    let authVersion = 0;
    let connectedAt = 0;
    const roomListeners = [];

    function showSetup(target) {
        elements.setup.hidden = false;
        elements.stage.hidden = true;
        [elements.loading, elements.auth, elements.connect].forEach((section) => {
            section.hidden = section !== target;
        });
    }

    function showError(element, message = '') {
        element.textContent = message;
        element.hidden = !message;
    }

    function normalizeRoom(value) {
        return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    }

    function parseQueue(value) {
        if (!value) return [];
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
        } catch (error) {
            console.warn('Fila inválida recebida pela TV.', error);
            return [];
        }
    }

    function listen(reference, event, handler) {
        reference.on(event, handler);
        roomListeners.push({ reference, event, handler });
    }

    function detachRoom() {
        roomListeners.splice(0).forEach(({ reference, event, handler }) => reference.off(event, handler));
        clearTimeout(scoreRevealTimer);
        clearTimeout(scoreHideTimer);
        currentRoom = '';
        currentSongId = '';
        currentNowPlaying = null;
        connectedAt = 0;
        elements.video.pause();
        elements.video.removeAttribute('src');
        elements.video.load();
    }

    function buildGuestUrl(code) {
        return new URL(`mobile.html?room=${encodeURIComponent(code)}`, window.location.href).href;
    }

    function buildDjControlUrl(code) {
        return new URL(`cabine-mobile.html?room=${encodeURIComponent(code)}&from=tv`, window.location.href).href;
    }

    function drawQr(container, text, size) {
        container.replaceChildren();
        new QRCode(container, {
            text,
            width: size,
            height: size,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    function renderQr(code) {
        try {
            drawQr(elements.qrCode, buildGuestUrl(code), 300);
            drawQr(elements.djQrCode, buildDjControlUrl(code), 170);
        } catch (error) {
            console.warn('Não foi possível criar os QR Codes da TV.', error);
        }
    }

    function renderQueue(items) {
        elements.queue.replaceChildren();
        const visible = items.slice(0, 4);
        visible.forEach((item, index) => {
            const row = document.createElement('li');
            const position = document.createElement('span');
            const singer = document.createElement('strong');
            const song = document.createElement('small');
            position.textContent = index === 0 ? 'NO PALCO' : `${index + 1}º`;
            singer.textContent = item.singer || 'Cantor';
            song.textContent = [item.title, item.artist].filter(Boolean).join(' · ') || 'Música';
            row.append(position, singer, song);
            elements.queue.append(row);
        });
        elements.queuePanel.hidden = visible.length < 2;
        if (!currentSongId) {
            const next = items[0];
            elements.idleEyebrow.textContent = next ? 'PREPARE O MICROFONE' : 'A FESTA ESTÁ ABERTA';
            elements.idleTitle.textContent = next ? (next.singer || 'Próximo cantor') : 'Escolha sua música';
            elements.idleDescription.textContent = next
                ? [next.title, next.artist].filter(Boolean).join(' · ')
                : 'Convidados usam o QR maior. O DJ usa o QR de controle com sua própria conta.';
        }
    }

    function updateProgress(value) {
        const current = Number(value?.time?.current);
        const total = Number(value?.time?.total);
        const percentage = Number.isFinite(current) && Number.isFinite(total) && total > 0
            ? Math.max(0, Math.min(100, current / total * 100))
            : 0;
        elements.progress.style.width = `${percentage}%`;
    }

    function syncVideoTime(value) {
        const target = Number(value?.time?.current);
        if (!Number.isFinite(target) || elements.video.readyState < 1) return;
        if (Math.abs(elements.video.currentTime - target) > 1.1) {
            try { elements.video.currentTime = target; } catch {}
        }
    }

    function requestPlayback() {
        elements.video.play().then(() => {
            elements.startPlayback.hidden = true;
        }).catch(() => {
            elements.startPlayback.textContent = '▶ Continuar apresentação';
            elements.startPlayback.hidden = false;
        });
    }

    function renderNowPlaying(value) {
        currentNowPlaying = value || {};
        const hasSong = Boolean(value?.songId && value?.title);
        const playing = hasSong && value.playing === true;
        const nextSongId = hasSong ? String(value.songId).padStart(5, '0') : '';

        elements.idle.hidden = hasSong;
        elements.nowPlaying.hidden = !hasSong;
        elements.stage.classList.toggle('is-playing', hasSong);
        elements.playbackLabel.textContent = playing ? 'TOCANDO AGORA' : 'PAUSADO';
        elements.songTitle.textContent = value?.title || 'Música';
        elements.singer.textContent = value?.singer || 'Cantor';
        elements.artist.textContent = value?.artist || '';
        updateProgress(value);

        if (!hasSong) {
            currentSongId = '';
            currentNowPlaying = null;
            elements.video.pause();
            elements.video.removeAttribute('src');
            elements.video.load();
            elements.startPlayback.hidden = true;
            return;
        }

        if (nextSongId !== currentSongId) {
            currentSongId = nextSongId;
            elements.video.src = `${CDN_BASE_URL}${nextSongId}.mp4`;
            elements.video.muted = !soundEnabled;
            elements.video.load();
            elements.video.addEventListener('loadedmetadata', () => {
                syncVideoTime(currentNowPlaying);
                if (currentNowPlaying?.playing === true) requestPlayback();
            }, { once: true });
        } else {
            syncVideoTime(value);
            if (playing && elements.video.paused) requestPlayback();
            if (!playing && !elements.video.paused) elements.video.pause();
        }
    }

    function renderScore(value) {
        const timestamp = Number(value?.timestamp);
        if (!value || !Number.isFinite(timestamp) || timestamp < connectedAt - 5000) return;
        clearTimeout(scoreRevealTimer);
        clearTimeout(scoreHideTimer);
        const reveal = () => {
            elements.scoreValue.textContent = String(Math.round(Number(value.score) || 0));
            elements.scoreSinger.textContent = value.singer || 'Cantor';
            elements.score.hidden = false;
            scoreHideTimer = setTimeout(() => { elements.score.hidden = true; }, 8000);
        };
        const wait = Math.max(0, Math.min(15000, Number(value.revealAt) - Date.now()));
        if (wait > 50) scoreRevealTimer = setTimeout(reveal, wait);
        else reveal();
    }

    function bindRoom(code, info) {
        detachRoom();
        currentRoom = code;
        connectedAt = Date.now();
        try { localStorage.setItem('lastTvRoom', code); } catch {}
        const url = new URL(window.location.href);
        url.searchParams.set('room', code);
        history.replaceState(null, '', `${url.pathname}${url.search}`);

        elements.partyName.textContent = info.name || 'Minha festa';
        elements.roomLabel.textContent = `SALA ${code}`;
        elements.idleRoom.textContent = `SALA ${code}`;
        elements.connection.textContent = 'CONECTADO';
        elements.connection.classList.remove('is-offline');
        renderQr(code);
        elements.setup.hidden = true;
        elements.stage.hidden = false;

        const base = db.ref(`salas/${code}`);
        listen(base.child('info'), 'value', (snapshot) => {
            const nextInfo = snapshot.val();
            if (!nextInfo || nextInfo.status === 'offline') {
                elements.connection.textContent = 'CABINE DESCONECTADA';
                elements.connection.classList.add('is-offline');
                elements.video.pause();
                return;
            }
            elements.partyName.textContent = nextInfo.name || 'Minha festa';
        });
        listen(base.child('queue_v13'), 'value', (snapshot) => renderQueue(parseQueue(snapshot.val())));
        listen(base.child('now_playing'), 'value', (snapshot) => renderNowPlaying(snapshot.val() || {}));
        listen(base.child('display_score'), 'value', (snapshot) => renderScore(snapshot.val()));
        listen(base.child('host_state/volume'), 'value', (snapshot) => {
            const volume = Number(snapshot.val());
            if (Number.isFinite(volume)) elements.video.volume = Math.max(0, Math.min(1, volume));
        });
    }

    async function connectRoom(value) {
        const code = normalizeRoom(value);
        showError(elements.roomError);
        if (code.length !== 5) {
            showError(elements.roomError, 'Digite o código completo de cinco caracteres.');
            return false;
        }
        const snapshot = await db.ref(`salas/${code}/info`).once('value');
        const info = snapshot.val();
        if (!info) {
            showError(elements.roomError, 'Sala não encontrada. Confira o código mostrado na Cabine PC.');
            return false;
        }
        if (info.hostId !== currentUser?.uid) {
            showError(elements.roomError, 'Esta festa pertence a outro DJ. Use a mesma conta da Cabine PC.');
            return false;
        }
        bindRoom(code, info);
        return true;
    }

    document.getElementById('tvGoogle').addEventListener('click', async (event) => {
        showError(elements.authError);
        event.currentTarget.disabled = true;
        try {
            await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
        } catch (error) {
            if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(error.code)) {
                const suffix = error.code ? ` (${error.code})` : '';
                showError(elements.authError, `Não foi possível entrar com Google${suffix}.`);
            }
        } finally {
            event.currentTarget.disabled = false;
        }
    });

    document.getElementById('tvEmailForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        showError(elements.authError);
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            await auth.signInWithEmailAndPassword(
                document.getElementById('tvEmail').value.trim(),
                document.getElementById('tvPassword').value
            );
        } catch {
            showError(elements.authError, 'E-mail ou senha inválidos.');
        } finally {
            button.disabled = false;
        }
    });

    document.getElementById('tvRoomForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        try { await connectRoom(elements.roomInput.value); }
        catch (error) {
            console.error('Falha ao conectar a TV:', error);
            showError(elements.roomError, 'Não foi possível consultar essa sala agora.');
        } finally { button.disabled = false; }
    });

    elements.roomInput.addEventListener('input', () => {
        elements.roomInput.value = normalizeRoom(elements.roomInput.value);
    });

    elements.logout.addEventListener('click', async () => {
        detachRoom();
        await auth.signOut();
    });

    document.getElementById('tvChangeRoom').addEventListener('click', () => {
        const previous = currentRoom;
        detachRoom();
        elements.roomInput.value = previous;
        showSetup(elements.connect);
        elements.roomInput.focus();
    });

    elements.sound.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        elements.video.muted = !soundEnabled;
        elements.sound.textContent = soundEnabled ? '🔊 Desativar som' : '🔇 Ativar som';
        if (!elements.video.paused) requestPlayback();
    });

    document.getElementById('tvFullscreen').addEventListener('click', async () => {
        try {
            if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
            else await document.exitFullscreen();
        } catch { alert('Use a opção de tela cheia do navegador.'); }
    });

    elements.startPlayback.addEventListener('click', requestPlayback);
    elements.video.addEventListener('timeupdate', () => {
        if (!elements.video.duration) return;
        elements.progress.style.width = `${Math.max(0, Math.min(100, elements.video.currentTime / elements.video.duration * 100))}%`;
    });
    elements.video.addEventListener('error', () => {
        elements.startPlayback.textContent = 'Vídeo indisponível nesta tela';
        elements.startPlayback.hidden = false;
    });

    function showToolbarTemporarily() {
        clearTimeout(toolbarTimer);
        elements.stage.classList.add('toolbar-visible');
        toolbarTimer = setTimeout(() => elements.stage.classList.remove('toolbar-visible'), 2500);
    }
    elements.stage.addEventListener('pointermove', showToolbarTemporarily);
    window.addEventListener('keydown', (event) => {
        showToolbarTemporarily();
        if (event.key.toLowerCase() === 'f') document.getElementById('tvFullscreen').click();
        if (event.key.toLowerCase() === 'm') elements.sound.click();
    });

    auth.onAuthStateChanged(async (user) => {
        const version = ++authVersion;
        currentUser = user;
        elements.logout.hidden = !user;
        if (!user) {
            detachRoom();
            showSetup(elements.auth);
            return;
        }
        elements.identity.textContent = `Conectado como ${user.displayName || user.email || 'DJ'}`;
        showSetup(elements.connect);
        const params = new URLSearchParams(window.location.search);
        const androidTv = params.get('display') === 'android-tv';
        if (androidTv) {
            document.querySelector('[data-device-title]').textContent = 'Android TV / TV Box';
            document.querySelector('[data-device-description]').textContent = 'Digite o código mostrado na Cabine PC para acompanhar a festa nesta tela.';
        }
        let savedRoom = params.get('room');
        if (!savedRoom) {
            try { savedRoom = localStorage.getItem('lastTvRoom'); } catch {}
        }
        if (savedRoom) {
            elements.roomInput.value = normalizeRoom(savedRoom);
            try {
                if (await connectRoom(savedRoom) && version === authVersion && currentUser) return;
            } catch (error) { console.warn('Sala anterior indisponível:', error); }
        }
        if (version === authVersion && currentUser) showSetup(elements.connect);
    });

    window.addEventListener('pagehide', () => {
        detachRoom();
        clearTimeout(toolbarTimer);
    });
})();
