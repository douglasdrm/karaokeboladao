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

    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.database();

    const elements = {
        loading: document.getElementById('mobileDjLoading'),
        auth: document.getElementById('mobileDjAuth'),
        connect: document.getElementById('mobileDjConnect'),
        dashboard: document.getElementById('mobileDjDashboard'),
        logout: document.getElementById('mobileDjLogout'),
        authError: document.getElementById('mobileDjAuthError'),
        roomError: document.getElementById('mobileDjRoomError'),
        roomInput: document.getElementById('mobileDjRoomCode'),
        identity: document.getElementById('mobileDjIdentity'),
        partyName: document.getElementById('mobileDjPartyName'),
        roomLabel: document.getElementById('mobileDjRoomLabel'),
        audienceCount: document.getElementById('mobileDjAudienceCount'),
        connection: document.getElementById('mobileDjConnection'),
        playbackDot: document.getElementById('mobileDjPlaybackDot'),
        playbackLabel: document.getElementById('mobileDjPlaybackLabel'),
        nowTitle: document.getElementById('mobileNowTitle'),
        nowMeta: document.getElementById('mobileNowMeta'),
        playIcon: document.getElementById('mobileDjPlayIcon'),
        playLabel: document.getElementById('mobileDjPlayLabel'),
        volume: document.getElementById('mobileDjVolume'),
        volumeValue: document.getElementById('mobileDjVolumeValue'),
        toneNote: document.getElementById('mobileDjToneNote'),
        queue: document.getElementById('mobileDjQueue'),
        queueCount: document.getElementById('mobileDjQueueCount'),
        catalogCount: document.getElementById('mobileDjCatalogCount'),
        catalogStatus: document.getElementById('mobileDjCatalogStatus'),
        songSearch: document.getElementById('mobileDjSongSearch'),
        songResults: document.getElementById('mobileDjSongResults'),
        songSheet: document.getElementById('mobileDjSongSheet'),
        selectedTitle: document.getElementById('mobileDjSelectedTitle'),
        selectedArtist: document.getElementById('mobileDjSelectedArtist'),
        singerName: document.getElementById('mobileDjSingerName'),
        addNext: document.getElementById('mobileDjAddNext'),
        singerLink: document.getElementById('mobileDjSingerLink'),
        dockSingerLink: document.getElementById('mobileDjDockSingerLink'),
        dockTitle: document.getElementById('mobileDjDockTitle'),
        dockPlayIcon: document.getElementById('mobileDjDockPlayIcon'),
        feedback: document.getElementById('mobileDjFeedback')
    };

    let currentUser = null;
    let currentRoom = '';
    let currentNowPlaying = null;
    let currentQueue = [];
    let hostConnected = false;
    let networkConnected = true;
    let currentRoomMode = '';
    let feedbackTimer = null;
    let authStateVersion = 0;
    let catalog = [];
    let selectedSong = null;
    let catalogPromise = null;
    let controllerPresenceRef = null;
    let controllerConnectionRef = null;
    let controllerConnectionHandler = null;
    const roomListeners = [];

    function showOnly(target) {
        [elements.loading, elements.auth, elements.connect, elements.dashboard].forEach((section) => {
            const isVisible = section === target;
            section.hidden = !isVisible;
            section.setAttribute('aria-hidden', String(!isVisible));

            // Alguns navegadores móveis permitem que uma regra `display` da página
            // prevaleça durante a troca de estado. O estilo inline garante que uma
            // tela antiga (principalmente o login) não continue sobre a atual.
            if (isVisible) section.style.removeProperty('display');
            else section.style.setProperty('display', 'none', 'important');
        });
    }

    function showError(element, message = '') {
        element.textContent = message;
        element.hidden = !message;
    }

    function roomCode(value) {
        return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    }

    function setFeedback(message, isError = false) {
        clearTimeout(feedbackTimer);
        elements.feedback.textContent = message;
        elements.feedback.classList.toggle('is-error', isError);
        elements.feedback.classList.add('is-visible');
        feedbackTimer = setTimeout(() => elements.feedback.classList.remove('is-visible'), 2600);
    }

    function detachRoom() {
        if (controllerConnectionRef && controllerConnectionHandler) controllerConnectionRef.off('value', controllerConnectionHandler);
        controllerConnectionRef = controllerConnectionHandler = null;
        if (controllerPresenceRef) {
            controllerPresenceRef.onDisconnect().cancel().catch(() => {});
            controllerPresenceRef.remove().catch(() => {});
            controllerPresenceRef = null;
        }
        roomListeners.splice(0).forEach(({ reference, event, handler }) => reference.off(event, handler));
        currentRoom = '';
        currentNowPlaying = null;
        currentQueue = [];
        setHostConnected(false);
    }

    function startControllerPresence(code) {
        const connectionId = `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        controllerPresenceRef = db.ref(`salas/${code}/dj_controllers/${currentUser.uid}/${connectionId}`);
        controllerConnectionRef = db.ref('.info/connected');
        controllerConnectionHandler = (snapshot) => {
            networkConnected = snapshot.val() === true;
            setHostConnected(hostConnected);
            if (!networkConnected || !controllerPresenceRef) return;
            controllerPresenceRef.onDisconnect().remove().then(() => controllerPresenceRef.set({
                connectedAt: firebase.database.ServerValue.TIMESTAMP,
                name: currentUser.displayName || currentUser.email || 'DJ'
            })).catch(console.warn);
            db.ref(`salas/${code}/info`).once('value').then(snapshot => applyRoomInfo(snapshot.val())).catch(console.warn);
        };
        controllerConnectionRef.on('value', controllerConnectionHandler);
    }

    function listen(reference, event, handler) {
        reference.on(event, handler);
        roomListeners.push({ reference, event, handler });
    }

    function parseQueue(value) {
        if (!value) return [];
        try {
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            return Array.isArray(parsed) ? parsed : Object.values(parsed || {});
        } catch (error) {
            console.warn('Fila inválida recebida da Cabine PC.', error);
            return [];
        }
    }

    function setHostConnected(connected) {
        hostConnected = connected;
        const available = connected && networkConnected;
        elements.dashboard.classList.toggle('is-host-offline', !available);
        document.querySelectorAll('[data-host-command], [data-queue-action], [data-catalog-action]').forEach((control) => {
            control.disabled = !available || control.dataset.queueUnavailable === 'true' || control.dataset.roomUnavailable === 'true';
        });
        elements.volume.disabled = !available;
        renderConnectionStatus();
    }

    function renderConnectionStatus() {
        if (!networkConnected) {
            elements.connection.textContent = 'CELULAR SEM INTERNET · RECONECTANDO';
            elements.connection.classList.add('is-offline');
            return;
        }
        if (!hostConnected) {
            elements.connection.textContent = 'CABINE DESCONECTADA · AGUARDANDO';
            elements.connection.classList.add('is-offline');
            return;
        }
        elements.connection.textContent = currentRoomMode === 'tv-standalone' ? 'CONECTADO À CABINE NA TV' : 'CONECTADO À CABINE PC';
        elements.connection.classList.remove('is-offline');
    }

    function applyRoomInfo(info) {
        currentRoomMode = info?.mode || '';
        const connected = Boolean(info && info.status !== 'offline');
        setHostConnected(connected);
        if (!connected) return;
        setRoomMode(currentRoomMode);
        elements.partyName.textContent = info.name || 'Minha festa';
    }

    function setRoomMode(mode) {
        const standaloneTv = mode === 'tv-standalone';
        elements.dashboard.classList.toggle('is-standalone-tv', standaloneTv);
        elements.toneNote.hidden = !standaloneTv;
        document.querySelectorAll('[data-host-command^="tone_"]').forEach((button) => {
            button.disabled = standaloneTv || !hostConnected;
            button.dataset.roomUnavailable = String(standaloneTv);
        });
    }

    function normalizeText(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function processCatalog(items) {
        catalog = (Array.isArray(items) ? items : []).map((item) => ({
            id: String(item.codigo ?? item.id ?? '').padStart(5, '0'),
            artist: item.artista ?? item.artist ?? 'Artista não informado',
            title: item.titulo ?? item.title ?? 'Música sem título',
            lyrics: item.inicioletra ?? item.lyrics ?? '',
            estilo: item.estilo || 'Pop',
            idioma: item.idioma || 'BRA'
        })).filter((item) => item.id !== '00000' && item.title);
        elements.catalogCount.textContent = `${catalog.length} músicas`;
        elements.catalogStatus.hidden = catalog.length > 0;
        renderCatalogResults(catalog.slice(0, 12));
    }

    async function loadCatalog() {
        if (catalog.length) return catalog;
        if (catalogPromise) return catalogPromise;
        elements.catalogStatus.hidden = false;
        elements.catalogStatus.textContent = 'Sincronizando o catálogo da festa…';
        catalogPromise = (async () => {
            try {
                const configSnapshot = await db.ref('config/catalog').once('value');
                const config = configSnapshot.val() || {};
                if (config.mode === 'fragmented' && Number(config.totalChunks) > 0) {
                    const reads = Array.from({ length: Number(config.totalChunks) }, (_, index) =>
                        db.ref(`catalog_chunks/part_${index}`).once('value').then((snapshot) => snapshot.val() || [])
                    );
                    processCatalog((await Promise.all(reads)).flat());
                } else if (config.url && firebase.storage) {
                    const blob = await firebase.storage().ref('songs.json').getBlob();
                    const data = JSON.parse(await blob.text());
                    processCatalog(data.musicas || []);
                } else {
                    const response = await fetch('songs.json');
                    if (!response.ok) throw new Error(`Catálogo local indisponível (${response.status})`);
                    const data = await response.json();
                    processCatalog(data.musicas || []);
                }
            } catch (error) {
                console.error('Falha ao carregar o catálogo da Cabine móvel:', error);
                elements.catalogCount.textContent = 'Indisponível';
                elements.catalogStatus.hidden = false;
                elements.catalogStatus.textContent = 'Não foi possível carregar o catálogo agora.';
            } finally {
                catalogPromise = null;
            }
            return catalog;
        })();
        return catalogPromise;
    }

    function renderCatalogResults(items) {
        elements.songResults.replaceChildren();
        if (!items.length) {
            elements.catalogStatus.hidden = false;
            elements.catalogStatus.textContent = catalog.length ? 'Nenhuma música encontrada.' : 'Sincronizando o catálogo da festa…';
            return;
        }
        elements.catalogStatus.hidden = true;
        items.forEach((song) => {
            const row = document.createElement('li');
            const copy = document.createElement('div');
            const title = document.createElement('strong');
            const artist = document.createElement('span');
            const code = document.createElement('small');
            const add = document.createElement('button');
            title.textContent = song.title;
            artist.textContent = song.artist;
            code.textContent = `CÓDIGO ${song.id}`;
            copy.append(title, artist, code);
            add.type = 'button';
            add.dataset.catalogSong = song.id;
            add.dataset.catalogAction = 'select';
            add.textContent = 'Adicionar';
            add.disabled = !hostConnected;
            row.append(copy, add);
            elements.songResults.append(row);
        });
    }

    function openSongSheet(song) {
        selectedSong = song;
        elements.selectedTitle.textContent = song.title;
        elements.selectedArtist.textContent = `${song.artist} · Código ${song.id}`;
        elements.singerName.value = currentUser?.displayName || '';
        elements.songSheet.hidden = false;
        document.body.classList.add('has-mobile-sheet');
        setTimeout(() => elements.singerName.focus(), 60);
    }

    function closeSongSheet() {
        selectedSong = null;
        elements.songSheet.hidden = true;
        document.body.classList.remove('has-mobile-sheet');
    }

    async function addSelectedSong(playNext) {
        const singer = elements.singerName.value.trim();
        if (!selectedSong || !singer) {
            elements.singerName.focus();
            return;
        }
        const sent = await sendCommand('queue_add', {
            songId: selectedSong.id,
            singer,
            playNext
        }, playNext ? 'Música enviada para a próxima posição.' : 'Música adicionada à fila.');
        if (sent) closeSongSheet();
    }

    function queueCommandPayload(item, index) {
        return {
            index,
            itemTime: String(item?.time || '')
        };
    }

    function renderQueue(items) {
        currentQueue = items;
        elements.queue.replaceChildren();
        elements.queueCount.textContent = `${items.length} ${items.length === 1 ? 'música' : 'músicas'}`;
        if (!items.length) {
            const empty = document.createElement('li');
            empty.className = 'empty-mobile-queue';
            empty.textContent = 'A fila está vazia.';
            elements.queue.append(empty);
            return;
        }

        items.forEach((item, index) => {
            const row = document.createElement('li');
            if (index === 0) row.classList.add('is-current');
            const position = document.createElement('span');
            position.className = 'mobile-queue-position';
            position.textContent = index === 0 ? 'NO PALCO' : String(index + 1).padStart(2, '0');
            const copy = document.createElement('div');
            copy.className = 'mobile-queue-copy';
            const singer = document.createElement('strong');
            singer.textContent = item.singer || 'Cantor';
            const song = document.createElement('span');
            song.textContent = [item.title, item.artist].filter(Boolean).join(' · ') || 'Música';
            copy.append(singer, song);
            row.append(position, copy);
            if (index > 0) {
                const actions = document.createElement('div');
                actions.className = 'mobile-queue-actions';
                const controls = [
                    ['next', 'Próxima', 'Colocar como próxima música', index === 1],
                    ['up', '↑', 'Subir na fila', index === 1],
                    ['down', '↓', 'Descer na fila', index === items.length - 1],
                    ['remove', '×', 'Remover da fila', false]
                ];
                controls.forEach(([action, label, ariaLabel, unavailable]) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.dataset.queueAction = action;
                    button.dataset.queueIndex = String(index);
                    button.dataset.queueUnavailable = String(unavailable);
                    button.textContent = label;
                    button.setAttribute('aria-label', `${ariaLabel}: ${item.singer || 'Cantor'} — ${item.title || 'Música'}`);
                    button.disabled = unavailable || !hostConnected;
                    if (action === 'remove') button.className = 'queue-remove-action';
                    if (action === 'next') button.className = 'queue-next-action';
                    actions.append(button);
                });
                row.append(actions);
            }
            elements.queue.append(row);
        });
    }

    function renderNowPlaying(value) {
        currentNowPlaying = value || null;
        const playing = value?.playing === true;
        const hasSong = Boolean(value?.title);
        elements.playbackDot.classList.toggle('is-playing', playing);
        elements.playbackLabel.textContent = playing ? 'TOCANDO AGORA' : (hasSong ? 'PAUSADO' : 'AGUARDANDO');
        elements.nowTitle.textContent = hasSong ? value.title : 'Nenhuma música no palco';
        elements.nowMeta.textContent = hasSong
            ? [value.artist, value.singer].filter(Boolean).join(' · ')
            : 'A fila aparecerá aqui quando a festa começar.';
        elements.playIcon.textContent = playing ? 'Ⅱ' : '▶';
        elements.playLabel.textContent = playing ? 'Pausar' : (hasSong ? 'Continuar' : 'Iniciar');
        elements.dockTitle.textContent = hasSong ? value.title : 'Nenhuma música no palco';
        elements.dockPlayIcon.textContent = playing ? 'Ⅱ' : '▶';
    }

    async function sendCommand(action, payload = {}, successMessage = 'Comando enviado para a Cabine.') {
        if (!currentRoom || !currentUser) return false;
        if (!hostConnected || !networkConnected) {
            setFeedback(networkConnected ? 'A Cabine está desconectada.' : 'O celular está sem internet.', true);
            return false;
        }
        try {
            await db.ref(`salas/${currentRoom}/host_commands`).push().set({
                action,
                payload,
                senderUid: currentUser.uid,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            });
            setFeedback(successMessage);
            return true;
        } catch (error) {
            console.error('Falha ao enviar comando:', error);
            setFeedback('Não foi possível controlar a Cabine.', true);
            return false;
        }
    }

    function bindRoom(code) {
        detachRoom();
        currentRoom = code;
        startControllerPresence(code);
        try { localStorage.setItem('lastDjRemoteRoom', code); } catch {}
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set('room', code);
        history.replaceState(null, '', `${nextUrl.pathname}${nextUrl.search}`);

        elements.roomLabel.textContent = `Sala ${code}`;
        const singerUrl = `mobile.html?room=${encodeURIComponent(code)}&from=dj`;
        elements.singerLink.href = singerUrl;
        elements.dockSingerLink.href = singerUrl;

        const base = db.ref(`salas/${code}`);
        listen(base.child('info'), 'value', (snapshot) => {
            applyRoomInfo(snapshot.val());
        });
        listen(base.child('queue_v13'), 'value', (snapshot) => renderQueue(parseQueue(snapshot.val())));
        listen(base.child('now_playing'), 'value', (snapshot) => renderNowPlaying(snapshot.val()));
        listen(base.child('host_state'), 'value', (snapshot) => {
            const state = snapshot.val() || {};
            const volume = Number(state.volume);
            if (Number.isFinite(volume) && document.activeElement !== elements.volume) {
                elements.volume.value = String(Math.max(0, Math.min(1, volume)));
                elements.volumeValue.textContent = `${Math.round(Number(elements.volume.value) * 100)}%`;
            }
        });
        listen(base.child('active_users'), 'value', (snapshot) => {
            const count = snapshot.numChildren();
            elements.audienceCount.textContent = `${count} ${count === 1 ? 'pessoa' : 'pessoas'}`;
        });
        showOnly(elements.dashboard);
    }

    async function connectRoom(code) {
        const normalized = roomCode(code);
        showError(elements.roomError);
        if (normalized.length !== 5) {
            showError(elements.roomError, 'Digite o código completo de cinco caracteres.');
            return false;
        }

        const snapshot = await db.ref(`salas/${normalized}/info`).once('value');
        const info = snapshot.val();
        if (!info) {
            showError(elements.roomError, 'Sala não encontrada. Confirme o código exibido na Cabine PC.');
            return false;
        }
        if (info.status === 'offline') {
            showError(elements.roomError, 'A Cabine PC desta sala está desconectada.');
            return false;
        }
        if (info.hostId !== currentUser?.uid) {
            showError(elements.roomError, 'Esta sala pertence a outro DJ. Entre com a conta usada para abrir a festa.');
            return false;
        }
        bindRoom(normalized);
        return true;
    }

    document.getElementById('mobileDjGoogle').addEventListener('click', async (event) => {
        showError(elements.authError);
        const button = event.currentTarget;
        button.disabled = true;
        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const credential = await auth.signInWithPopup(provider);
            if (credential.user) showOnly(elements.connect);
        } catch (error) {
            console.warn('Login Google da Cabine móvel recusado:', error.code);
            if (error.code === 'auth/popup-blocked') {
                showError(elements.authError, 'O navegador bloqueou a janela do Google. Permita pop-ups para este site e tente novamente (auth/popup-blocked).');
            } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                const errorCode = error.code ? ` (${error.code})` : '';
                showError(elements.authError, `Não foi possível entrar com Google${errorCode}.`);
            }
        } finally {
            button.disabled = false;
        }
    });

    document.getElementById('mobileDjEmailForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        showError(elements.authError);
        const button = event.currentTarget.querySelector('[type="submit"]');
        button.disabled = true;
        try {
            const credential = await auth.signInWithEmailAndPassword(
                document.getElementById('mobileDjEmail').value.trim(),
                document.getElementById('mobileDjPassword').value
            );
            // Não espera a leitura da sala para retirar o formulário de login.
            if (credential.user) showOnly(elements.connect);
        } catch (error) {
            console.warn('Login da Cabine móvel recusado:', error.code);
            showError(elements.authError, 'E-mail ou senha inválidos.');
        } finally {
            button.disabled = false;
        }
    });

    document.getElementById('mobileDjRoomForm').addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await connectRoom(elements.roomInput.value);
        } catch (error) {
            console.error('Erro ao conectar à sala:', error);
            showError(elements.roomError, 'Não foi possível consultar essa sala agora.');
        }
    });

    elements.roomInput.addEventListener('input', () => {
        elements.roomInput.value = roomCode(elements.roomInput.value);
    });

    document.getElementById('mobileDjChangeRoom').addEventListener('click', () => {
        const previous = currentRoom;
        detachRoom();
        elements.roomInput.value = previous;
        showOnly(elements.connect);
        elements.roomInput.focus();
    });

    elements.logout.addEventListener('click', async () => {
        detachRoom();
        await auth.signOut();
    });

    document.querySelectorAll('[data-host-command]').forEach((button) => {
        button.addEventListener('click', () => sendCommand(button.dataset.hostCommand));
    });

    let catalogSearchTimer = null;
    elements.songSearch.addEventListener('input', () => {
        clearTimeout(catalogSearchTimer);
        catalogSearchTimer = setTimeout(() => {
            const term = normalizeText(elements.songSearch.value);
            if (term.length < 2) {
                renderCatalogResults(catalog.slice(0, 12));
                return;
            }
            const matches = catalog.filter((song) =>
                normalizeText(song.id).includes(term) ||
                normalizeText(song.title).includes(term) ||
                normalizeText(song.artist).includes(term) ||
                normalizeText(song.lyrics).includes(term)
            ).slice(0, 30);
            renderCatalogResults(matches);
        }, 100);
    });

    elements.songResults.addEventListener('click', (event) => {
        const button = event.target.closest('[data-catalog-song]');
        if (!button || button.disabled) return;
        const song = catalog.find((item) => item.id === button.dataset.catalogSong);
        if (song) openSongSheet(song);
    });

    document.querySelectorAll('[data-close-song-sheet]').forEach((button) => {
        button.addEventListener('click', closeSongSheet);
    });

    document.getElementById('mobileDjUseMyName').addEventListener('click', () => {
        elements.singerName.value = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'DJ';
        elements.singerName.focus();
    });

    document.getElementById('mobileDjAddSongForm').addEventListener('submit', (event) => {
        event.preventDefault();
        addSelectedSong(false);
    });

    elements.addNext.addEventListener('click', () => addSelectedSong(true));

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !elements.songSheet.hidden) closeSongSheet();
    });

    elements.queue.addEventListener('click', (event) => {
        const button = event.target.closest('[data-queue-action]');
        if (!button || button.disabled) return;
        const index = Number(button.dataset.queueIndex);
        const item = currentQueue[index];
        if (!item || index <= 0) return;
        const payload = queueCommandPayload(item, index);
        switch (button.dataset.queueAction) {
            case 'next':
                sendCommand('queue_next', payload, 'Pedido enviado para a próxima posição.');
                break;
            case 'up':
                sendCommand('queue_move', { ...payload, direction: -1 }, 'Pedido movido para cima.');
                break;
            case 'down':
                sendCommand('queue_move', { ...payload, direction: 1 }, 'Pedido movido para baixo.');
                break;
            case 'remove':
                if (window.confirm(`Remover ${item.singer || 'Cantor'} — ${item.title || 'Música'} da fila?`)) {
                    sendCommand('queue_remove', payload, 'Pedido removido da fila.');
                }
                break;
        }
    });

    let volumeTimer = null;
    elements.volume.addEventListener('input', () => {
        const value = Number(elements.volume.value);
        elements.volumeValue.textContent = `${Math.round(value * 100)}%`;
        clearTimeout(volumeTimer);
        volumeTimer = setTimeout(() => sendCommand('volume', { value }), 120);
    });

    auth.onAuthStateChanged(async (user) => {
        const stateVersion = ++authStateVersion;
        currentUser = user;
        elements.logout.hidden = !user;
        if (!user) {
            detachRoom();
            showOnly(elements.auth);
            return;
        }

        elements.identity.textContent = `Conectado como ${user.displayName || user.email || 'DJ'}`;
        loadCatalog();
        // A autenticação já terminou. Mostra a próxima etapa imediatamente e
        // restaura uma sala anterior em segundo plano.
        showOnly(elements.connect);
        const params = new URLSearchParams(window.location.search);
        let savedRoom = params.get('room');
        if (!savedRoom) {
            try { savedRoom = localStorage.getItem('lastDjRemoteRoom'); } catch {}
        }
        if (savedRoom) {
            elements.roomInput.value = roomCode(savedRoom);
            try {
                if (await connectRoom(savedRoom) && stateVersion === authStateVersion && currentUser) return;
            } catch (error) {
                console.warn('Sala anterior indisponível:', error);
            }
        }
        if (stateVersion === authStateVersion && currentUser) showOnly(elements.connect);
    });

    window.addEventListener('pagehide', detachRoom);
})();
