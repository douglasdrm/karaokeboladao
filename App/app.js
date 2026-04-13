(function () {

    // XANDU-OKÊ Next Gen - app.js (Clean Build)

    "use strict";

    // ─── State ───────────────────────────────────────────────────────────────────

    let catalog = [];

    let queue = [];

    let currentCode = "";

    let isPlaying = false;

    let currentAudio = null;

    let maxVolume = 0;

    let audioContext = null, analyzer = null, dataArray = null;

    let pitchShifter = null;

    let audioSource = null;

    let currentPitch = 1.0;

    let controlsTimeout = null;

    let idleTimeout = null;

    let screensaverImages = [];

    let screensaverIndex = 0;

    let screensaverInterval = null;

    let forcedScore = null; // Flag para nota 100 discreta (tecla ',')

    let ytPlayer = null;         // Referência global ao YouTube IFrame (não usado diretamente)

    let ytAmbientPlayer = null;  // Player de música ambiente (YouTube API)

    let isAmbientPlaying = false;

    let ambientLastTime = 0;

    let ambientLastIndex = 0;

    let isDestroyingAmbient = false;

    let currentVotes = {}; // Armazena votos por usuário da música atual (v9)

    // ─── Cloud Media Settings ─────────────────────────────────────────────────────

    // Coloque aqui o endereço raiz onde suas MP4 ficarão hospedadas (R2, B2, S3, etc)

    // Exemplo: "https://media.unodev.com.br/Musicas/" - Não deixe de incluir a "/" no final.

    // Deixe vazio ("") para buscar localmente na hospedagem atual.

    const CDN_BASE_URL = "https://f005.backblazeb2.com/file/karaoke-midia/Musicas/";

    // ─── Settings State ───────────────────────────────────────────────────────────

    let settings = {

        autoFullscreen: false,

        ambientUrl: "",

        screensaverTimeout: 30000,

        enableScore: true,

        scoreMode: 'mic',

        minRandomScore: 75,

        difficulty: 'normal'

    };

    let trialUsedMs = 0;

    let trialTimer = null;

    const TRIAL_LIMIT_MS = 1800000; // 30 Minutos

    // ─── SaaS Room Auth & Firebase Config ──────────────────────────────────────────

    const firebaseConfig = {

        apiKey: "AIzaSyCnZ8hoE3NGNx2t490Yw12AxlCqVjSguig",

        authDomain: "karaoke-party-online.firebaseapp.com",

        databaseURL: "https://karaoke-party-online-default-rtdb.firebaseio.com",

        projectId: "karaoke-party-online",

        storageBucket: "karaoke-party-online.firebasestorage.app",

        messagingSenderId: "1059879567957",

        appId: "1:1059879567957:web:d4cb88563b39fe08934adc"

    };

    firebase.initializeApp(firebaseConfig);

    const db = firebase.database();

    const auth = firebase.auth();

    const googleProvider = new firebase.auth.GoogleAuthProvider();

    let currentRoomCode = null;

    let currentRoomName = "Festa do DJ";

    let hostUser = null;

    let isPremium = false; // Novo: Status VIP

    let subscriptionData = null; // Novo: Detalhes da assinatura (expiração, plano)

    let activeUsers = {};

    let recentSingers = JSON.parse(localStorage.getItem('recentSingers') || '[]');

    // ─── Sound Banks ──────────────────────────────────────────────────────────────

    const sounds = {

        suspense: "../SFX/Dando_nota.mp3",

        low: "../SFX/Nota_baixa.mp3",

        med: "../SFX/Nota_media.mp3",

        high: "../SFX/Nota_alta.mp3",

        max: "../SFX/Nota_maxima.mp3"

    };

    const scorePhrases = {

        low: [

            "A nota pode ter sido baixa, mas o seu carisma conquistou o público!",

            "Nota baixa? Isso é só para dar um toque de mistério à sua performance!",

            "Quem precisa de notas altas quando se tem tanto charme não palco?",

            "A próxima música vai ser melhor... se você cantar em playback!"

        ],

        med1: [

            "Você não desafinou, apenas explorou novas notas musicais!",

            "Você está mantendo o mistério, guardando o melhor para o final!",

            "A próxima música vai ser melhor... porque você já aqueceu a voz!",

            "Seu talento é como um diamante em bruto, pronto para polir!"

        ],

        med2: [

            "Não foi um 'Zerou a vida', mas você está evoluindo!",

            "Seu talento é como vinho: melhora a cada nota não karaokê!",

            "Essa música é tão difícil que até o cantor original desafina!",

            "Cê tá cantando tão bem que até o cachorro tá latindo junto!"

        ],

        high: [

            "Arrasou não karaokê, cantou que nem o Roberto Carlos! Mancando.",

            "Você arrasou! Tá saindo da jaula o monstro!",

            "Arrebentou! Quase que o Chacrinha voltou só pra te dar um troféu!",

            "Nota 10? Treina mais um pouquinho e você deixa o Pavarotti não chinelo!",

            "Arrasou, com esta voz vc vai longe! Vai chegar em Japeri!",

            "Cantou como um canarinho. Cuidado! Vão querer te engaiolar!"

        ],

        max: [

            "Nota máxima, hein? Só para os 'mitos' do karaokê!",

            "Nota máxima? Só posso dizer: 'é verdade esse bilete'!",

            "Canta muito! É o famoso 'quem sabe faz ao vivo'!",

            "Que performance! Já pode largar o emprego e virar cantor profissional!",

            "Sua voz é tão boa que até o microfone ficou emocionado!",

            "A galera tá tão impressada que até esqueceu de filmar!"

        ]

    };

    // ─── DOM Refs (after DOMContentLoaded) ───────────────────────────────────────

    let songSearch, songList, queueList, playerArea;

    let topInfoTitle, topInfoArtist, topInfoBox;

    let codeEntryOverlay, codeDisplay, codeSongInfo;

    let modal;

    // ─── Init ─────────────────────────────────────────────────────────────────────

    document.addEventListener("DOMContentLoaded", () => {

        songSearch = document.getElementById('songSearch');

        songList = document.getElementById('songList');

        queueList = document.getElementById('queueList');

        playerArea = document.getElementById('player');

        topInfoTitle = document.getElementById('topInfoTitle');

        topInfoArtist = document.getElementById('topInfoArtist');

        topInfoBox = document.getElementById('topInfoBox');

        codeEntryOverlay = document.getElementById('codeEntryOverlay');

        codeDisplay = document.getElementById('codeDisplay');

        codeSongInfo = document.getElementById('codeSongInfo');

        modal = document.getElementById('customModal');

        // Carregar catálogo

        if (songList) songList.innerHTML = "<div style='padding:20px; color:var(--accent-primary);'>Carregando catálogo...</div>";

        fetch('songs.json')

            .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })

            .then(data => {

                catalog = data.musicas.map(m => ({

                    id: String(m.codigo).padStart(5, '0'),

                    artist: m.artista,

                    title: m.titulo,

                    lyrics: m.inicioletra

                }));

                renderSongs(catalog.slice(0, 50));

                initSearchUI();

            })

            .catch(err => {

                console.error("Erro ao carregar catálogo:", err);

                if (songList) songList.innerHTML = "<div style='color:red;padding:20px;'>ERRO: songs.json não encontrado</div>";

            });

        // Autenticação do Host (Firebase)

        initHostAuth();

        // Botão de Play Principal (Barra Inferior)

        const btnPlay = document.querySelector('.btn-play');

        if (btnPlay) {

            btnPlay.onclick = () => {

                if (queue.length > 0 && !isPlaying) {

                    playNext();

                } else {

                    togglePlay();

                }

            };

        }

        // Monitoramento de Inatividade e Comandos
        const resetAllTimers = () => { resetIdleTimer(); showControlsUI(); };
        window.addEventListener('mousemove', resetAllTimers);
        window.addEventListener('mousedown', resetAllTimers);
        window.addEventListener('touchstart', resetAllTimers);
        window.addEventListener('keydown', (e) => { 
            resetAllTimers(); 
            handleHotkey(e); 
        });


        resetIdleTimer();

        // Handler de Upload de Fotos (Settings)

        const photoInput = document.getElementById('setPhotosInput');

        if (photoInput) {

            photoInput.onchange = handlePhotoUpload;

        }

        // Initial Load

        loadSettings();

        loadScreensaverImages(); // Carrega fotos salvas

        initSettingsUI();

        initAmbientPlayer();

        // Auto-Fullscreen Trigger (Clique na Tela)

        document.addEventListener('click', () => {

            if (settings.autoFullscreen && !document.fullscreenElement && !document.webkitFullscreenElement) {

                const container = document.getElementById('playerContainer');

                if (container) {

                    (container.requestFullscreen || container.webkitRequestFullscreen).call(container).catch(() => { });

                }

            }

        }, { once: false });

        initMobileTabs();
    });

    // ─── Host Authentication Logic ────────────────────────────────────────────────

    window.openHostLogin = () => {

        document.getElementById('hostAuthOverlay').style.display = 'flex';

        document.getElementById('hostAuthOverlay').style.opacity = '1';

    };

    window.closeHostLogin = () => {

        const overlay = document.getElementById('hostAuthOverlay');

        overlay.style.opacity = '0';

        setTimeout(() => overlay.style.display = 'none', 300);

    };

    function initHostAuth() {

        const overlay = document.getElementById('hostAuthOverlay');

        const btnGoogle = document.getElementById('btnHostLogin');

        auth.onAuthStateChanged((user) => {

            if (user) {
                try {
                    hostUser = user;
                    overlay.style.opacity = '0';
                    setTimeout(() => overlay.style.display = 'none', 500);

                    const wrapper = document.getElementById('main_wrapper');
                    if (wrapper) { wrapper.style.display = 'grid'; window.scrollTo(0, 0); }

                    // Gravação segura no Banco de Dados
                    const safeName = user.displayName || (user.email ? user.email.split('@')[0] : "DJ");
                    db.ref('users/' + user.uid).update({
                        name: safeName,
                        email: user.email || "sem-email",
                        photo: user.photoURL || '',
                        isHost: true,
                        lastLogin: firebase.database.ServerValue.TIMESTAMP
                    }).catch(err => console.warn("Erro ao atualizar perfil do Host:", err));

                    checkSubscriptionStatus(user.uid);
                    if (user.email === 'douglasdrm@gmail.com') { 
                        const adminBtn = document.getElementById('adminMenuBtn'); 
                        if (adminBtn) adminBtn.style.display = 'block'; 
                    }

                    checkSubscriptionAndStartRoom();
                } catch (e) {
                    console.error("Erro crítico na inicialização do Host:", e);
                    alert("Ocorreu um erro ao entrar. Verifique o console ou tente novamente.");
                }
            } else {


                hostUser = null;

                isPremium = false;

                overlay.style.display = 'flex';

                overlay.style.opacity = '1';

                document.getElementById('main_wrapper').style.display = 'none';

            }

        });

        if (btnGoogle) {
            btnGoogle.onclick = () => {
                auth.signInWithPopup(googleProvider).catch(err => {
                    console.error("Erro no Login Popup:", err);
                    if (err.code === 'auth/popup-closed-by-user') {
                        alert("O login foi cancelado. Por favor, mantenha o popup aberto até o final.");
                    } else {
                        // Fallback para redirect se o popup for bloqueado agressivamente
                        auth.signInWithRedirect(googleProvider);
                    }
                });
            };
        }


    }

    let isHostSignUpMode = false;

    window.toggleHostAuthMode = function() {

        isHostSignUpMode = !isHostSignUpMode;

        const btnSubmit = document.getElementById('btnHostAuthSubmit');

        const switchArea = document.getElementById('hostAuthSwitch');

        if (isHostSignUpMode) {

            btnSubmit.innerText = "SOLICITAR ACESSO / CRIAR";

            switchArea.innerHTML = 'Já tem uma conta de DJ? <span onclick="toggleHostAuthMode()">Fazer Login na Cabine</span>';

        } else {

            btnSubmit.innerText = "ENTRAR NA CABINE";

            switchArea.innerHTML = 'Novo na plataforma? <span onclick="toggleHostAuthMode()">Solicitar Acesso / Criar Conta</span>';

        }

    }

    window.handleHostEmailAuth = function() {

        const email = document.getElementById('hostAuthEmail').value.trim();

        const pass = document.getElementById('hostAuthPassword').value;

        if (!email || !pass) { alert("Preencha e-mail e senha!"); return; }

        if (isHostSignUpMode) {
            auth.createUserWithEmailAndPassword(email, pass)
                .catch(err => {
                    let msg = "Erro ao criar conta: " + err.message;
                    if (err.code === 'auth/email-already-in-use') msg = "Este e-mail já está sendo usado por outro DJ.";
                    if (err.code === 'auth/invalid-email') msg = "E-mail inválido. Verifique o formato.";
                    if (err.code === 'auth/weak-password') msg = "Escolha uma senha mais forte (mínimo 6 caracteres).";
                    alert(msg);
                });
        } else {
            auth.signInWithEmailAndPassword(email, pass)
                .catch(err => {
                    let msg = "Erro ao entrar na cabine: " + err.message;
                    if (err.code === 'auth/user-not-found') msg = "Usuário não cadastrado. Verifique o e-mail ou crie uma conta.";
                    if (err.code === 'auth/wrong-password') msg = "Senha incorreta. Tente novamente ou use 'Esqueci a Senha'.";
                    if (err.code === 'auth/invalid-email') msg = "E-mail inválido. Verifique o formato.";
                    if (err.code === 'auth/user-disabled') msg = "Seu acesso à cabine foi desativado. Contate o administrador.";
                    alert(msg);
                });
        }

    }

    window.hostForgotPassword = function() {

        const email = document.getElementById('hostAuthEmail').value.trim();

        if (!email) { alert("Digite seu e-mail de DJ para receber o link."); return; }

        auth.sendPasswordResetEmail(email)

            .then(() => alert("Link de redefinição enviado ao seu e-mail!"))

            .catch(err => alert("Erro: " + err.message));

    }

    async function checkSubscriptionAndStartRoom() {

        // Busca status da assinatura E tempo de trial não Firebase

        db.ref('users/' + hostUser.uid).once('value', (snap) => {

            const userData = snap.val() || {};
            
            // 0. VERIFICAÇÃO DE BANIMENTO
            if (userData.isBanned) {
                alert("ACESSO NEGADO: Sua conta foi suspensa por violação dos termos de uso.");
                logoutHost();
                return;
            }

            const sub = userData.subscription;
            trialUsedMs = userData.trialUsedMs || 0;
            const hasWhatsapp = !!userData.whatsapp;

            // 1. Se tiver assinatura ativa (via checkSubscriptionStatus global ou local check)

            if (isPremium || (sub && (sub.active === true || sub.status === 'active') && sub.expiresAt > Date.now())) {

                isPremium = true;

                subscriptionData = sub;

                openStartRoomModal(false, hasWhatsapp); // VIP: Sem Trial

            }

            // 2. Se não tiver assinatura, verifica o Trial

            else {

                if (trialUsedMs >= TRIAL_LIMIT_MS) {

                    // TRIAL ESGOTADO

                    document.getElementById('trialExpiredModal').style.display = 'flex';

                    const btnCancel = document.getElementById('modalCancel');

                    if (btnCancel) btnCancel.style.display = 'none';

                } else {

                    // AINDA TEM TRIAL - Avisa e entra

                    openStartRoomModal(true);

                }

                // Se for novo sem sub, cria o registro inicial

                if (!sub) {

                    db.ref('users/' + hostUser.uid + '/subscription').set({

                        active: false,

                        status: 'trial',

                        plan: 'Free Trial',

                        requestDate: firebase.database.ServerValue.TIMESTAMP

                    });

                }

            }

        });

    }

    function openStartRoomModal(isTrial = false, hasWhatsapp = false) {
        const rawName = hostUser.displayName || hostUser.email.split('@')[0] || "DJ";
        const firstName = rawName.split(' ')[0].toUpperCase();
        const title = isTrial ? "MODO DEGUSTAÇÃO (30 MINUTOS)" : `BEM-VINDO AO COMANDO, ${firstName}`;
        const subText = isTrial ? "<p style='color:#ffaa00; font-size:0.8rem; margin-bottom:10px;'>Você ainda possui tempo de teste gratuito. Aproveite!</p>" : "";

        let modalHTML = `
            ${subText}
            <div style="margin-bottom:15px; text-align:left;">Dê um nome para a sua sala de hoje:</div>
            <input type="text" id="newRoomName" placeholder="Ex: Aniversário do Douglas" autofocus style="width:100%; padding:15px; border-radius:15px; background:rgba(255,255,255,0.05); border:1px solid var(--accent-primary); color:white; text-align:center; margin-bottom:20px;">
        `;

        if (!hasWhatsapp) {
            modalHTML += `
                <div style="margin-bottom:15px; text-align:left;">Confirme seu WhatsApp (Lead):</div>
                <input type="tel" id="newRoomWhatsapp" placeholder="(00) 00000-0000" maxlength="15" oninput="handlePhoneInput(this)" style="width:100%; padding:15px; border-radius:15px; background:rgba(255,255,255,0.05); border:1px solid var(--accent-primary); color:white; text-align:center;">
                <p style="font-size:0.65rem; opacity:0.5; margin-top:8px;">Obrigatório para iniciar a sala.</p>
            `;
        }

        showModal(title, modalHTML, () => {
            const name = document.getElementById('newRoomName').value;
            const waInput = document.getElementById('newRoomWhatsapp');
            const whatsapp = waInput ? waInput.value : null;

            if (!hasWhatsapp && (!whatsapp || whatsapp.replace(/\D/g, '').length < 10)) {
                alert("Por favor, informe um WhatsApp válido para continuar.");
                checkSubscriptionAndStartRoom(); // Reabre o processo
                return;
            }

            const rawName = hostUser.displayName || hostUser.email.split('@')[0] || "DJ";
            currentRoomName = name || "Festa de " + rawName.split(' ')[0];

            if (whatsapp) {
                db.ref('users/' + hostUser.uid + '/whatsapp').set(whatsapp);
            }

            if (isTrial) startTrialCountdown();
            startRoom(currentRoomName);
        });
    }

    let hasAlerted5Min = false;

    function startTrialCountdown() {

        if (isPremium) {

            console.log("🎤 Usuário Premium detectado. Ignorando Trial Timer.");

            return;

        }

        console.log("â ³ Iniciando contador de Trial...");

        const banner = document.getElementById('trialTimerBanner');

        const timeText = document.getElementById('trialTimeRemaining');

        if (banner) banner.style.display = 'flex';

        if (trialTimer) clearInterval(trialTimer);

        trialTimer = setInterval(() => {

            trialUsedMs += 5000;

            const remaining = Math.max(0, TRIAL_LIMIT_MS - trialUsedMs);

            const mins = Math.floor(remaining / 60000);

            const secs = Math.floor((remaining % 60000) / 1000);

            const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;

            if (timeText) {

                timeText.innerText = timeStr;

                // Alerta discreto aos 5 minutos

                if (mins === 5 && secs <= 5 && !hasAlerted5Min) {

                    hasAlerted5Min = true;

                    showToast("Atenção: Seu tempo de teste gratuito vence em 5 minutos!");

                    banner.style.animation = "pulse-warning 1s infinite";

                    banner.style.borderColor = "#ffaa00";

                }

                // Alerta crítico ao 1 minuto

                if (mins === 1 && secs <= 5) {

                    banner.style.animation = "pulse-danger 0.5s infinite";

                    banner.style.borderColor = "#ff4444";

                }

            }

            if (trialUsedMs % 30000 === 0 || remaining <= 0) {

                db.ref('users/' + hostUser.uid + '/trialUsedMs').set(trialUsedMs);

            }

            if (remaining <= 0) {

                clearInterval(trialTimer);

                document.getElementById('trialExpiredModal').style.display = 'flex';

                if (typeof stopSong === 'function') stopSong();

            }

        }, 5000);

    }

    function startRoom(name) {

        // Remove sala anterior deste host (se existir) para não acumular

        if (currentRoomCode) {

            db.ref('salas/' + currentRoomCode).remove();

            db.ref(`salas/${currentRoomCode}/active_users`).off(); // Desliga listener anterior

        }

        // Zera sugestões de nomes de cantores da festa anterior

        activeUsers = {};

        recentSingers = [];

        localStorage.removeItem('recentSingers');

        // Gera código de sala único (v13)

        // Usamos 5 caracteres aleatórios para evitar conflitos entre diferentes festas.

        currentRoomCode = Math.random().toString(36).substr(2, 5).toUpperCase();

        localStorage.setItem('lastRoomCode', currentRoomCode);

        // Salva info da sala não Firebase

        db.ref('salas/' + currentRoomCode + '/info').set({

            name: name,

            hostId: hostUser.uid,

            hostName: hostUser.displayName,

            hostPhoto: hostUser.photoURL || '',

            timestamp: firebase.database.ServerValue.TIMESTAMP

        });

        // Remove sala ao fechar a janela

        db.ref('salas/' + currentRoomCode).onDisconnect().remove();

        // Atualiza UI — nome elegante, código bem legível (v13)

        const roomBadge = document.getElementById('hostRoomCode');

        if (roomBadge) {

            roomBadge.innerHTML = `

            <div style="font-size:0.9rem; font-weight:900; color:var(--accent-primary); line-height:1.2;">

                ${name.toUpperCase()}

            </div>

            <div style="font-size:0.7rem; letter-spacing:1px; font-weight:600; margin-top:4px; color:#fff; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;">

                CÓDIGO: <span style="color:var(--accent-primary); background:rgba(0,0,0,0.3); padding:0 6px; border-radius:4px;">${currentRoomCode}</span>

            </div>`;

        }

        console.log(`🚀 [v12] Sala aberta: [${currentRoomCode}] enviando para salas/${currentRoomCode}/queue_sync`);

        // Gera QR Code

        updateQrCodes();

        // Começa a escutar pedidos e usuários

        startMobilePolling();

        startActiveUsersListener();

        // Solicita acesso ao microfone (Host)

        if (typeof startMic === 'function') {

            startMic();

        }

        // SINCRONIA INICIAL (v11)

        renderQueue();

        // Tour do Host: inicia AQUI, após sala criada e dashboard visível

        if (typeof startHostTour === 'function') {

            setTimeout(() => startHostTour(), 800);

        }

    }

    function startActiveUsersListener() {

        if (!currentRoomCode) return;

        db.ref(`salas/${currentRoomCode}/active_users`).on('value', snap => {

            activeUsers = snap.val() || {};

            console.log("Usuários ativos atualizados:", activeUsers);

        });

        // Sincronização de Progresso (Tempo do vídeo)

        setInterval(() => {

            const v = document.getElementById('mainVideo');

            if (v && isPlaying) {

                db.ref(`salas/${currentRoomCode}/now_playing/time`).set({

                    current: v.currentTime,

                    total: v.duration

                });

            }

        }, 2000);

    }

    function updateQrCodes() {

        let pathStr = window.location.pathname;

        if (pathStr.endsWith('index.html')) {

            pathStr = pathStr.substring(0, pathStr.lastIndexOf('/') + 1);

        } else if (!pathStr.endsWith('/')) {

            pathStr += '/';

        }

        const mobileUrl = window.location.origin + pathStr + 'mobile.html?room=' + currentRoomCode;

        console.log("URL Mobile:", mobileUrl);

        // QR Code da sidebar

        const qrSidebar = document.getElementById('qrcode');

        if (qrSidebar && typeof QRCode !== 'undefined') {

            try { qrSidebar.innerHTML = ''; new QRCode(qrSidebar, { text: mobileUrl, width: 128, height: 128, colorDark: "#000000", colorLight: "#ffffff" }); } catch (e) { }

        }

        // QR Code de tela cheia (canto inferior direito)

        const qrFs = document.getElementById('qrcode-fs');

        if (qrFs && typeof QRCode !== 'undefined') {

            try { qrFs.innerHTML = ''; new QRCode(qrFs, { text: mobileUrl, width: 90, height: 90, colorDark: "#000000", colorLight: "#ffffff" }); } catch (e) { }

        }

    }

    function logoutHost() {

        if (currentRoomCode) {

            // Opcional: remover sala ao sair? Melhor manter se for um refresh acidental.

            // Mas podemos marcar como offline.

            db.ref('salas/' + currentRoomCode + '/info/status').set('offline');

        }

        auth.signOut().then(() => {

            window.location.reload();

        });

    }

    // ─── Helpers ──────────────────────────────────────────────────────────────────

    function normalizeStr(str) {

        return str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";

    }

    // ─── Settings Logic ──────────────────────────────────────────────────────────

    function loadSettings() {

        const saved = localStorage.getItem('karaokeSettings');

        if (saved) {

            try {

                settings = { ...settings, ...jsonParseSafe(saved) };

            } catch (e) { }

        }

    }

    function jsonParseSafe(str) {

        try { return JSON.parse(str); } catch (e) { return {}; }

    }

    function initSettingsUI() {

        const btnSettings = document.getElementById('btnSettings');

        const modalSettings = document.getElementById('settingsModal');

        const btnClose = document.getElementById('settingsClose');

        const btnSave = document.getElementById('settingsSave');

        if (btnSettings) btnSettings.onclick = openSettings;

        if (btnClose) btnClose.onclick = () => modalSettings.style.display = 'none';

        if (btnSave) btnSave.onclick = saveSettings;

        // Fechar ao clicar fora

        window.addEventListener('click', (e) => {

            if (e.target === modalSettings) modalSettings.style.display = 'none';

        });

    }

    function openSettings() {

        const modal = document.getElementById('settingsModal');

        if (!modal) return;

        document.getElementById('setAutoFullscreen').checked = settings.autoFullscreen || false;

        document.getElementById('setAmbientUrl').value = settings.ambientUrl || "";

        document.getElementById('setScreensaverTime').value = settings.screensaverTimeout || 30000;

        // Nãovas Configurações

        document.getElementById('setEnableScore').checked = settings.enableScore !== false;

        if (settings.scoreMode === 'random') document.getElementById('modeRandom').checked = true;

        else document.getElementById('modeMic').checked = true;

        document.getElementById('setMinRandomScore').value = settings.minRandomScore || 75;

        const diffRadio = modal.querySelector(`input[name="difficulty"][value="${settings.difficulty || 'normal'}"]`);

        if (diffRadio) diffRadio.checked = true;

        renderPhotoPreviews(); // Mostra fotos salvas

        modal.style.display = 'flex';

        // Inicia monitoramento do Mic para calibração

        startCalibMic();

    }

    let calibInterval = null;

    function startCalibMic() {

        const bar = document.getElementById('calibBar');

        const valText = document.getElementById('calibvolVal');

        if (!bar || !valText) return;

        if (calibInterval) clearInterval(calibInterval);

        calibInterval = setInterval(() => {

            if (!analyzer || document.getElementById('settingsModal').style.display === 'none') {

                clearInterval(calibInterval);

                return;

            }

            analyzer.getByteFrequencyData(dataArray);

            const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;

            const percentage = Math.min(100, (avg / 140) * 100);

            bar.style.width = percentage + '%';

            valText.innerText = Math.floor(avg);

        }, 50);

    }

    async function saveSettings() {

        const autoFs = document.getElementById('setAutoFullscreen').checked;

        const ambient = document.getElementById('setAmbientUrl').value;

        const ssTimeout = parseInt(document.getElementById('setScreensaverTime').value);

        const enableScore = document.getElementById('setEnableScore').checked;

        const scoreMode = document.querySelector('input[name="scoreMode"]:checked').value;

        const minRandom = parseInt(document.getElementById('setMinRandomScore').value);

        const difficulty = document.querySelector('input[name="difficulty"]:checked').value;

        settings = {

            ...settings,

            autoFullscreen: autoFs,

            ambientUrl: ambient,

            screensaverTimeout: ssTimeout,

            enableScore,

            scoreMode,

            minRandomScore: minRandom,

            difficulty

        };

        localStorage.setItem('karaokeSettings', JSON.stringify(settings));

        document.getElementById('settingsModal').style.display = 'none';

        showToast("Configurações salvas com sucesso!");

        resetIdleTimer(); // Recalcula inatividade

        if (!isPlaying) checkAmbientMusic();

    }

    // ─── Fullscreen & Screensaver Implementation ──────────────────────────────────

    function toggleFullscreen() {

        const container = document.getElementById('playerContainer');

        if (!container) return;

        if (!document.fullscreenElement) {

            if (container.requestFullscreen) {

                container.requestFullscreen().catch(err => console.warn(err));

            } else if (container.webkitRequestFullscreen) {

                container.webkitRequestFullscreen();

            }

        } else {

            if (document.exitFullscreen) document.exitFullscreen();

        }

    }

    function resetIdleTimer() {

        stopScreensaver(); // Esconde se estiver ativo

        clearTimeout(idleTimeout);

        // Se timeout for 0, nunca ativa

        if (settings.screensaverTimeout === 0) return;

        // Não ativa se estiver tocando música ou mexendo não player

        if (isPlaying) return;

        idleTimeout = setTimeout(startScreensaver, settings.screensaverTimeout);
    }

    // NOVA FUNÇÃO: Reseta temporizador de controles (Visibilidade)
    function showControlsUI() {
        const wrapper = document.querySelector('.compact-controls-wrapper');
        if (wrapper) {
            wrapper.classList.remove('autohide');
            // Reinicia o autohide se estiver tocando (Apenas PC)
            if (isPlaying && window.innerWidth > 900) {
                if (window.controlsTimeout) clearTimeout(window.controlsTimeout);
                window.controlsTimeout = setTimeout(() => {
                    if (isPlaying) {
                        const w = document.querySelector('.compact-controls-wrapper');
                        if (w) w.classList.add('autohide');
                    }
                }, 3000);
            }
        }
    }


    function startScreensaver() {

        if (isPlaying || settings.screensaverTimeout === 0 || screensaverImages.length === 0) return;

        const layer = document.getElementById('screensaver');

        if (!layer) return;

        layer.innerHTML = "";

        layer.style.display = "flex";

        layer.style.opacity = "1";

        // Prepara imagens não layer

        screensaverImages.forEach((src, idx) => {

            const img = document.createElement('img');

            img.src = src;

            img.className = `ss-img ${idx === 0 ? 'active' : ''}`;

            layer.appendChild(img);

        });

        screensaverIndex = 0;

        clearInterval(screensaverInterval);

        screensaverInterval = setInterval(() => {

            const imgs = layer.querySelectorAll('.ss-img');

            if (imgs.length < 2) return;

            imgs[screensaverIndex].classList.remove('active');

            screensaverIndex = (screensaverIndex + 1) % imgs.length;

            imgs[screensaverIndex].classList.add('active');

        }, 6000); // Troca a cada 6 segundos

    }

    function stopScreensaver() {

        const layer = document.getElementById('screensaver');

        if (layer && layer.style.display !== 'none') {

            layer.style.opacity = "0";

            setTimeout(() => { layer.style.display = "none"; layer.innerHTML = ""; }, 500);

        }

        clearInterval(screensaverInterval);

    }

    // ─── Photo Management ─────────────────────────────────────────────────────────

    function handlePhotoUpload(e) {

        const files = Array.from(e.target.files);

        let loaded = 0;

        files.forEach(file => {

            const reader = new FileReader();

            reader.onload = (ev) => {

                screensaverImages.push(ev.target.result);

                loaded++;

                if (loaded === files.length) {

                    saveScreensaverImages();

                    renderPhotoPreviews();

                }

            };

            reader.readAsDataURL(file);

        });

        e.target.value = ""; // limpa para re-upload

    }

    function saveScreensaverImages() {

        // Tenta salvar, mas limita se o localStorage estiver cheio (~5MB)

        try {

            localStorage.setItem('karaokeScreensaverPhotos', JSON.stringify(screensaverImages));

        } catch (e) {

            alert("O limite de armazenamento de fotos foi atingido! Tente usar fotos menãores ou remover algumas.");

            screensaverImages.pop(); // Remove a última que causou erro

        }

    }

    function loadScreensaverImages() {

        const saved = localStorage.getItem('karaokeScreensaverPhotos');

        if (saved) {

            try {

                screensaverImages = JSON.parse(saved);

            } catch (e) { screensaverImages = []; }

        }

    }

    function renderPhotoPreviews() {

        const grid = document.getElementById('photoPreviewGrid');

        if (!grid) return;

        grid.innerHTML = "";

        screensaverImages.forEach((src, idx) => {

            const div = document.createElement('div');

            div.className = "photo-preview-item";

            div.innerHTML = `

            <img src="${src}">

            <div class="photo-remove" onclick="removePhoto(${idx})">×</div>

        `;

            grid.appendChild(div);

        });

    }

    function removePhoto(idx) {

        screensaverImages.splice(idx, 1);

        saveScreensaverImages();

        renderPhotoPreviews();

    }

    function playSfx(key) {

        if (currentAudio) { currentAudio.pause(); currentAudio = null; }

        currentAudio = new Audio(sounds[key]);

        currentAudio.play().catch(e => console.warn("Erro SFX:", e));

    }

    function formatTime(seconds) {

        if (isNaN(seconds)) return "00:00";

        const m = Math.floor(seconds / 60);

        const s = Math.floor(seconds % 60);

        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

    }

    // ─── Render ───────────────────────────────────────────────────────────────────

    function renderSongs(songs) {

        if (!songList) return;

        songList.innerHTML = '';

        songs.forEach(song => {

            const div = document.createElement('div');

            div.className = 'song-item';

            div.innerHTML = `

            <div class="song-info">

                <strong>${song.artist}</strong>

                <span>${song.title}</span>${song.lyrics ? ` <span class="lyrics-preview">${song.lyrics}</span>` : ''}

            </div>

            <div class="song-actions">

                <button class="btn-song-play" onclick="event.stopPropagation(); addToQueue('${song.id}', true)" title="Tocar agora"><i class="fas fa-play"></i></button>

                <button class="btn-song-queue" onclick="event.stopPropagation(); addToQueue('${song.id}', false)" title="Adicionar à fila"><i class="fas fa-plus"></i></button>

            </div>

        `;

            songList.appendChild(div);

        });

    }

    function renderQueue() {

        if (!queueList) return;

        queueList.innerHTML = '';

        // Sincroniza fila usando o método infalível do JSON String (v13)

        // Como o 'Now Playing' funciona, vamos usar a mesma lógica de enviar um único dado atômico.

        if (currentRoomCode) {

            const queuePayload = JSON.stringify(queue);

            db.ref(`salas/${currentRoomCode}/queue_v13`).set(queuePayload)

                .catch(err => console.error("â Œ [v13] Erro de sinc:", err));

        }

        queue.forEach((item, index) => {

            const div = document.createElement('div');

            div.className = 'queue-item';

            div.innerHTML = `

            <div class="rank">${index + 1}</div>

            <div class="info">

                <div class="name">${item.singer}</div>

                <div class="song">${item.title}</div>

            </div>

            <div class="queue-actions">

                ${index > 1 ? `<i class="fas fa-chevron-up" onclick="moveQueue(${index}, -1)"></i>` : ''}

                ${index > 0 && index < queue.length - 1 ? `<i class="fas fa-chevron-down" onclick="moveQueue(${index}, 1)"></i>` : ''}

                <i class="fas fa-trash trash-btn" onclick="removeFromQueue(${index})"></i>

            </div>

        `;

            queueList.appendChild(div);

        });

        updateFullscreenQueue();

    }

    // ─── Search & Shuffle UI ──────────────────────────────────────────────────────

    function initSearchUI() {

        if (songSearch) {

            songSearch.addEventListener('input', (e) => {

                const term = normalizeStr(e.target.value);

                if (term.length < 2) { renderSongs(catalog.slice(0, 50)); return; }

                const filtered = catalog.filter(s =>

                    (s.id && s.id.includes(term)) ||

                    normalizeStr(s.title).includes(term) ||

                    normalizeStr(s.artist).includes(term) ||

                    normalizeStr(s.lyrics).includes(term)

                ).slice(0, 100);

                renderSongs(filtered);

            });

        }

        const btnShuffle = document.getElementById('btnShuffle');

        if (btnShuffle) {

            btnShuffle.onclick = () => {

                if (catalog.length < 3) return;

                const shuffled = [...catalog].sort(() => 0.5 - Math.random());

                renderSongs(shuffled.slice(0, 5));

            };

        }

        const btnHelp = document.getElementById('btnHelp');

        if (btnHelp) {

            btnHelp.onclick = () => {

                const legend = document.getElementById('hotkeyLegend');

                if (legend) legend.style.display = legend.style.display === 'block' ? 'none' : 'block';

            };

        }

        // Play button

        const btnPlay = document.querySelector('.btn-play');

        if (btnPlay) btnPlay.onclick = togglePlay;

    }

    // ─── Queue Management ─────────────────────────────────────────────────────────

    function addToQueue(id, playNow = false) {

        const song = catalog.find(s => s.id === id);

        if (!song) return;

        // Prepara chips: Usuários Logados + Recentes

        const chipsData = [];

        // 1. Logados

        Object.values(activeUsers).forEach(u => {

            chipsData.push({ name: u.name, photo: u.photo, type: 'active' });

        });

        // 2. Recentes (que não estejam já nos logados)

        recentSingers.forEach(name => {

            if (!chipsData.find(c => c.name === name)) {

                chipsData.push({ name: name, type: 'recent' });

            }

        });

        if (isPlaying) {

            showCompactSingerInput(song, playNow);

        } else {

            showModal(`CANTOR PARA: ${song.title}`, `

            <div class="modal-artist">${song.artist}</div>

            <div class="user-chips-container" id="modalChips"></div>

            <input type="text" id="singerName" placeholder="Seu Nome / Mesa" autofocus>

        `, (name) => {

                const finalName = (name && name.trim()) ? name.trim() : 'Cantor Surpresa';

                // Salva nos recentes se for manual e não "Surpresa"

                if (finalName !== 'Cantor Surpresa' && !Object.values(activeUsers).find(u => u.name === finalName)) {

                    updateRecentSingers(finalName);

                }

                enqueue({ ...song, singer: finalName, time: Date.now() }, playNow);

            }, chipsData);

        }

    }

    function updateRecentSingers(name) {

        recentSingers = recentSingers.filter(n => n !== name);

        recentSingers.unshift(name);

        recentSingers = recentSingers.slice(0, 10);

        localStorage.setItem('recentSingers', JSON.stringify(recentSingers));

    }

    function showCompactSingerInput(song, playNow) {

        document.getElementById('compactSingerForm')?.remove();

        const form = document.createElement('div');

        form.id = 'compactSingerForm';

        form.className = 'compact-singer-form';

        // Prepara chips: Logados + Recentes

        const chipsData = [];

        Object.values(activeUsers).forEach(u => chipsData.push({ name: u.name, photo: u.photo, type: 'active' }));

        recentSingers.forEach(name => { if (!chipsData.find(c => c.name === name)) chipsData.push({ name: name, type: 'recent' }); });

        form.innerHTML = `

        <div class="csf-inner">

            <span class="csf-label">PARA: <strong>${song.title}</strong></span>

            <input type="text" id="compactSingerName" class="csf-input" placeholder="Nome..." autofocus autocomplete="off">

            <div id="compactChips"></div>

            <button class="csf-btn" onclick="confirmCompactSinger('${song.id}', ${playNow})"><i class="fas fa-plus"></i></button>

            <button class="csf-close-text" onclick="document.getElementById('compactSingerForm').remove()">×</button>

        </div>

    `;

        document.getElementById('playerContainer').appendChild(form);

        // Renderiza chips não modo compacto (horizontal mini)

        const cc = form.querySelector('#compactChips');

        if (cc) {

            chipsData.slice(0, 4).forEach(c => {

                const el = document.createElement('div');

                el.className = `user-chip mini ${c.type}`;

                el.innerHTML = `${c.name}`;

                el.onclick = () => { document.getElementById('compactSingerName').value = c.name; document.getElementById('compactSingerName').focus(); };

                cc.appendChild(el);

            });

        }

        setTimeout(() => document.getElementById('compactSingerName')?.focus(), 100);

        document.getElementById('compactSingerName').onkeydown = (e) => {

            if (e.key === 'Enter') confirmCompactSinger(song.id, playNow);

            if (e.key === 'Escape') form.remove();

        };

    }

    function confirmCompactSinger(id, playNow) {

        const input = document.getElementById('compactSingerName');

        const name = (input && input.value.trim()) ? input.value.trim() : 'Cantor Surpresa';

        const song = catalog.find(s => s.id === id);

        if (song) {

            // Registra o cantor manual como usuário ativo na sala para o Mobile ver

            if (currentRoomCode) {

                db.ref(`salas/${currentRoomCode}/active_users/${btoa(encodeURIComponent(name)).replace(/=/g, '')}`).set({

                    name: name,

                    photo: '',

                    type: 'local',

                    timestamp: firebase.database.ServerValue.TIMESTAMP

                });

            }

            if (name !== 'Cantor Surpresa' && !Object.values(activeUsers).find(u => u.name === name)) {

                updateRecentSingers(name);

            }

            enqueue({ ...song, singer: name, time: Date.now() }, playNow);

        }

        document.getElementById('compactSingerForm')?.remove();

    }

    function rebalanceQueue() {

        if (queue.length <= 1) return;

        // 1. Isolar quem está não palco (Índice 0)

        let currentSong = isPlaying ? queue[0] : null;

        let restOfQueue = isPlaying ? queue.slice(1) : [...queue];

        // 2. FORÇAR conversão para número e normalizar nomes

        restOfQueue.forEach(item => {

            item.time = Number(item.time) || Date.now();

            item.singer = String(item.singer || "CONVIDADO").trim().toUpperCase();

        });

        // 3. PRIMEIRO: Ordenar estritamente por tempo de pedido (quem chegou antes)

        // Isso evita que o PUSH do DJ ou do Mobile flutue para o topo

        restOfQueue.sort((a, b) => a.time - b.time);

        // 4. MAPEAR Rodadas (Singer Count)

        const singerCount = {};

        if (currentSong) {

            const stageSinger = String(currentSong.singer || "CONVIDADO").trim().toUpperCase();

            singerCount[stageSinger] = 1;

        }

        // 5. ATRIBUIR Rodadas baseadas na ordem de chegada

        restOfQueue = restOfQueue.map((item) => {

            const name = item.singer;

            singerCount[name] = (singerCount[name] || 0) + 1;

            item.round = singerCount[name];

            return item;

        });

        // 6. ORDENAÇÃO FINAL: 

        // Prioridade 1: Round (quem tem menos músicas cantando/na fila)

        // Prioridade 2: Time (quem pediu primeiro dentro daquela rodada)

        restOfQueue.sort((a, b) => {

            if (a.round !== b.round) return a.round - b.round;

            return a.time - b.time;

        });

        // 7. Aplicar de volta à fila global e renderizar

        const finalQueue = currentSong ? [currentSong, ...restOfQueue] : restOfQueue;

        queue.splice(0, queue.length, ...finalQueue);

    }

    function enqueue(entry, playNow) {

        entry.singer = (entry.singer || "Convidado").trim().toUpperCase();

        // Se o entry já tem time (veio do Mobile), usa ele. 

        // Se não tem (DJ adicionou), gera agora garantindo que seja o maior da fila.

        if (!entry.time) {

            let maxTime = queue.reduce((max, item) => Math.max(max, Number(item.time) || 0), 0);

            entry.time = Math.max(Date.now(), maxTime + 1);

        } else {

            entry.time = Number(entry.time);

        }

        if (queue.length === 0 && !isPlaying) {

            queue.push(entry);

            renderQueue();

            playNext();

            return;

        }

        if (playNow && isPlaying) {

            // Tocar agora: Insere na posição 1 e mantém o tempo original para não ser reordenado pra baixo

            queue.splice(1, 0, entry);

        } else {

            queue.push(entry);

            rebalanceQueue();

        }

        renderQueue();

    }

    function moveQueue(index, dir) {

        if (index <= 0 || index >= queue.length) return;

        const t = index + dir;

        if (t <= 0 || t >= queue.length) return;

        [queue[index], queue[t]] = [queue[t], queue[index]];

        renderQueue();

    }

    function removeFromQueue(idx) {

        if (idx === 0) { showScore(); } else { queue.splice(idx, 1); renderQueue(); }

    }

    // ─── Player ───────────────────────────────────────────────────────────────────

    function skipSong() {
        if (queue.length === 0) return;
        const video = document.getElementById('mainVideo');
        if (video) { video.onended = null; video.pause(); }
        if (typeof audioSource !== 'undefined' && audioSource) { audioSource.disconnect(); audioSource = null; }
        queue.shift();
        syncQueue();
        renderQueue();
        playNext();
    }

    function playNext() {
        try {

            if (queue.length === 0) return;

            const current = queue[0];

            // Auto-expandir player no mobile ao começar música
            if (window.innerWidth <= 900) {
                toggleMobilePlayer(true);
            }

            // Debug Visual

            updateDebugInfo(`â ¯ï¸  Iniciando: ${current.id} (${current.title})`);

            // Referências DOM

            if (!playerArea) playerArea = document.getElementById('player');

            if (!topInfoTitle) topInfoTitle = document.getElementById('topInfoTitle');

            if (!topInfoArtist) topInfoArtist = document.getElementById('topInfoArtist');

            if (!topInfoBox) topInfoBox = document.getElementById('topInfoBox');

            isPlaying = true;

            stopAmbientMusic(); // Garante silêncio ambiente ao começar o show

            forcedScore = null;

            // v14: Auto-Fullscreen on Play

            if (settings.autoFullscreen && !document.fullscreenElement) {

                const container = document.getElementById('playerContainer');

                if (container) {

                    (container.requestFullscreen || container.webkitRequestFullscreen)?.call(container).catch(() => { });

                }

            }

            // Atualiza UI de topo

            if (topInfoTitle) topInfoTitle.innerText = current.title;

            if (topInfoArtist) topInfoArtist.innerText = `${current.artist} — ${current.singer.toUpperCase()}`;

            if (topInfoBox) topInfoBox.style.display = 'block';

            // Sincroniza Firebase

            if (currentRoomCode) {

                db.ref('salas/' + currentRoomCode + '/now_playing').set({

                    title: current.title, artist: current.artist, singer: current.singer, playing: true

                });

                // Limpa votos anteriores e ouve novos

                currentVotes = {};

                db.ref('salas/' + currentRoomCode + '/now_playing/votes').on('value', snap => {

                    currentVotes = snap.val() || {};

                    updatePublicScoreUI();

                });

            }

            // Gera URL do Backblaze

            const videoId = String(current.id).padStart(5, '0');

            const baseUrl = CDN_BASE_URL || (window.location.origin + "/Musicas/");

            const videoUrl = baseUrl + videoId + ".mp4";

            updateDebugInfo(`🎤“¡ Carregando: ${videoId}.mp4`);

            // Injeta HTML do Vídeo

            playerArea.innerHTML = `

            <div class="video-overlay-banner">

                <div class="banner-left"><img src="../Assets/logo.png" alt="Logo"></div>

                <div class="banner-right"><span>A MELHOR<br>EXPERIÊNCIA<br>DE KARAOKÊ</span></div>

            </div>

            <div class="vu-meter-container"><div id="vuBar" class="vu-meter-bar"></div></div>

            <div id="micBadge" class="mic-active-badge">MIC ATIVO</div>

            <video id="mainVideo" width="100%" height="100%" autoplay playsinline crossorigin="anonymous">

                <source src="${videoUrl}" type="video/mp4">

            </video>

            <div class="progress-time-display" id="progressTime">00:00 / 00:00</div>

            <div class="progress-container" id="progressContainer"><div class="progress-bar-inner" id="progressBar"></div></div>

        `;

            const video = document.getElementById('mainVideo');

            if (video) {

                video.onplaying = () => updateDebugInfo(`âœ… TOCANDO: ${videoId}.mp4`);

                video.onerror = () => {

                    updateDebugInfo(`â Œ ERRO CDN: ${videoId}.mp4 (404 ou CORS)`);

                    setTimeout(showScore, 3000);

                };

                video.ontimeupdate = () => {

                    const prog = document.getElementById('progressBar');

                    const time = document.getElementById('progressTime');

                    if (prog) prog.style.width = (video.currentTime / video.duration * 100) + '%';

                    if (time) time.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;

                };

                video.onended = () => showScore();

                // Ativa processamento de udio para Pitch Shifting

                setupAudioNãodes(video);

            }

        } catch (err) {

            updateDebugInfo(`🎤’¥ ERRO SCRIPT: ${err.message}`);

            console.error("Erro em playNext:", err);

        }

    }

    // ─── Audio Routing & Pitch Shifting ──────────────────────────────────────────

    function setupAudioNãodes(video) {

        if (!audioContext) {

            audioContext = new (window.AudioContext || window.webkitAudioContext)();

        }

        if (audioSource) {

            audioSource.disconnect();

        }

        audioSource = audioContext.createMediaElementSource(video);

        // Pitch Shifter Implementation (Jungle algorithm style)

        pitchShifter = createPitchShifter(audioContext);

        pitchShifter.setPitchOffset(currentPitch);

        audioSource.connect(pitchShifter.input);

        pitchShifter.output.connect(audioContext.destination);

    }

    function createPitchShifter(context) {

        const delayTime = 0.100; // 100ms is smoother for voice

        const input = context.createGain();

        const output = context.createGain();

        const delay1 = context.createDelay(0.2);

        const delay2 = context.createDelay(0.2);

        const g1 = context.createGain();

        const g2 = context.createGain();

        input.connect(delay1);

        input.connect(delay2);

        delay1.connect(g1);

        delay2.connect(g2);

        g1.connect(output);

        g2.connect(output);

        // Buffers for modulation (pre-calculated for perfect phase)

        const bufferLen = context.sampleRate; // 1 second

        const ramp1 = context.createBuffer(1, bufferLen, context.sampleRate);

        const ramp2 = context.createBuffer(1, bufferLen, context.sampleRate);

        const fade1Buf = context.createBuffer(1, bufferLen, context.sampleRate);

        const fade2Buf = context.createBuffer(1, bufferLen, context.sampleRate);

        const r1 = ramp1.getChannelData(0);

        const r2 = ramp2.getChannelData(0);

        const f1 = fade1Buf.getChannelData(0);

        const f2 = fade2Buf.getChannelData(0);

        for (let i = 0; i < bufferLen; i++) {

            const x1 = i / bufferLen;

            const x2 = (x1 + 0.5) % 1.0; // 180 degrees shift

            r1[i] = x1;

            r2[i] = x2;

            // Equal power crossfade

            f1[i] = Math.sqrt(0.5 * (1.0 + Math.cos(2.0 * Math.PI * x1 + Math.PI)));

            f2[i] = Math.sqrt(0.5 * (1.0 + Math.cos(2.0 * Math.PI * x2 + Math.PI)));

        }

        const mod1 = context.createBufferSource();

        const mod2 = context.createBufferSource();

        const fade1 = context.createBufferSource();

        const fade2 = context.createBufferSource();

        mod1.buffer = ramp1;

        mod2.buffer = ramp2;

        fade1.buffer = fade1Buf;

        fade2.buffer = fade2Buf;

        mod1.loop = mod2.loop = fade1.loop = fade2.loop = true;

        const modGain1 = context.createGain();

        const modGain2 = context.createGain();

        const offsetNãode = context.createConstantSource();

        offsetNãode.start();

        mod1.connect(modGain1);

        mod2.connect(modGain2);

        modGain1.connect(delay1.delayTime);

        modGain2.connect(delay2.delayTime);

        offsetNãode.connect(delay1.delayTime);

        offsetNãode.connect(delay2.delayTime);

        fade1.connect(g1.gain);

        fade2.connect(g2.gain);

        mod1.start();

        mod2.start();

        fade1.start();

        fade2.start();

        return {

            input,

            output,

            setPitchOffset: (pitch) => {

                const shift = 1.0 - pitch;

                if (shift > 0) {

                    modGain1.gain.setTargetAtTime(delayTime, context.currentTime, 0.01);

                    modGain2.gain.setTargetAtTime(delayTime, context.currentTime, 0.01);

                    offsetNãode.offset.setTargetAtTime(0, context.currentTime, 0.01);

                } else {

                    modGain1.gain.setTargetAtTime(-delayTime, context.currentTime, 0.01);

                    modGain2.gain.setTargetAtTime(-delayTime, context.currentTime, 0.01);

                    offsetNãode.offset.setTargetAtTime(delayTime, context.currentTime, 0.01);

                }

                const modRate = Math.abs(shift) / delayTime;

                const t = context.currentTime;

                mod1.playbackRate.setTargetAtTime(modRate, t, 0.01);

                mod2.playbackRate.setTargetAtTime(modRate, t, 0.01);

                fade1.playbackRate.setTargetAtTime(modRate, t, 0.01);

                fade2.playbackRate.setTargetAtTime(modRate, t, 0.01);

            }

        };

    }

    // ─── Scoring ──────────────────────────────────────────────────────────────────

    function showScore(forceScore = null) {

        const video = document.getElementById('mainVideo');

        if (video) { video.onended = null; video.pause(); }

        // Don't close audioContext entirely if we want to reuse it, 

        // but we can suspend or disconnect nãodes

        if (audioSource) { audioSource.disconnect(); audioSource = null; }

        pitchShifter = null;

        currentPitch = 1.0; // Reset pitch for next song

        const singer = queue[0]?.singer || "Convidado";

        // NOVO SISTEMA DE PONTUAÇÃO (v15 - CONFIGURÁVEL)

        let finalScore;
        let base = 80; // Valor padrão para evitar ReferenceError fora do modo mic

        if (typeof forcedScore === 'number') {

            finalScore = forcedScore;

        } else if (typeof forceScore === 'number') {

            finalScore = forceScore;

        } else if (settings.enableScore === false) {

            finalScore = 0;

        } else {

            if (settings.scoreMode === 'random') {

                // MODO ALEATÓRIO: Respeita o mínimo configurado

                const min = settings.minRandomScore || 75;

                finalScore = min + Math.floor(Math.random() * (101 - min));

            } else {

                // MODO MICROFONE: Base generosa recalibrada + Volume Sensível
                base = 70 + Math.floor(Math.random() * 10);

                // Fatores de Dificuldade (Sensibilidade)

                const diffFactors = {

                    'super_easy': 1.6,

                    'very_easy': 1.3,

                    'easy': 1.15,

                    'normal': 1.0,

                    'hard': 0.8

                };

                const factor = diffFactors[settings.difficulty || 'normal'];

                // Bônus de Volume: normalizado para aprox 140 de média não mic

                let volBonus = Math.floor(((maxVolume * factor) / 140) * 20);

                finalScore = base + volBonus;

            }

            // --- COMPOSIÇÃO COM VOTOS DA GALERA (30% de influência) ---

            const voteEntries = Object.values(currentVotes);

            if (voteEntries.length > 0) {

                const avgVote = voteEntries.reduce((a, b) => a + (b.stars || 0), 0) / voteEntries.length;

                const publicBonus = (avgVote / 5) * 100; // Converte 1-5 para 0-100

                // Composição: 70% Sistema, 30% Galera
                finalScore = Math.round((finalScore * 0.7) + (publicBonus * 0.3));
                if (isNaN(finalScore)) finalScore = Math.floor(base); 
            }

            // Garantia final: Se por qualquer motivo finalScore for NaN ou undefined, usa a base
            if (isNaN(finalScore) || finalScore === undefined) finalScore = Math.floor(base || 80);


            // Se a nota for >= 94, chance de virar 100 (Efeito 'Mito')

            if (finalScore >= 94) {

                const jackpot = Math.random() < 0.2;

                finalScore = jackpot ? 100 : (96 + Math.floor(Math.random() * 3));

            }

        }

        finalScore = Math.max(0, Math.min(100, finalScore));

        maxVolume = 0;

        const scoreStr = finalScore.toString().padStart(2, '0');

        playerArea.innerHTML = `

        <div class="suspense-layer">

            <div class="suspense-text">DANDO NOTA...</div>

            <div class="score-number" id="tickerScore">__</div>

            <div class="score-phrase">Segura o coração, ${singer.toUpperCase()}!</div>

        </div>

    `;

        playSfx('suspense');

        const tickerEl = document.getElementById('tickerScore');

        const ticker = setInterval(() => {

            if (tickerEl) tickerEl.innerText = Math.floor(Math.random() * 100).toString().padStart(2, '0');

        }, 60);

        // After 11s: reveal score

        setTimeout(() => {

            clearInterval(ticker);

            if (!tickerEl) return;

            tickerEl.innerText = scoreStr[0] + Math.floor(Math.random() * 10);

            setTimeout(() => {

                if (!tickerEl) return;

                tickerEl.innerText = scoreStr;

                tickerEl.classList.add('reveal-pulse');

                let cat = "med1", sfxKey = "med";

                if (finalScore >= 100) { cat = "max"; sfxKey = "max"; }

                else if (finalScore >= 90) { cat = "high"; sfxKey = "high"; }

                else if (finalScore >= 75) { cat = "med2"; }

                else if (finalScore < 60) { cat = "low"; sfxKey = "low"; }

                const phrase = scorePhrases[cat][Math.floor(Math.random() * scorePhrases[cat].length)];

                playerArea.innerHTML = `

                <div class="score-overlay">

                    <div class="score-label">NOTA FINAL</div>

                    <div class="score-number score-big">${finalScore}</div>

                    <div class="score-phrase">"${phrase}"</div>

                    <div class="score-singer">⭐ ARRASOU, ${singer.toUpperCase()}! 🎤</div>

                </div>

            `;

                playSfx(sfxKey);

                setTimeout(() => finishSong(), 8000);

            }, 1500);

        }, 11000);

    }

    function finishSong() {

        isPlaying = false;

        queue.shift(); // Remove a música que terminou

        // Pré-atualiza o topInfoBox com a próxima música ANTES de renderizar

        // para evitar que ele apareça com info desatualizada quando queue.length=1

        if (queue.length > 0 && topInfoTitle && topInfoArtist) {

            topInfoTitle.innerText = queue[0].title;

            topInfoArtist.innerText = `${queue[0].artist} — ${queue[0].singer.toUpperCase()}`;

        }

        renderQueue(); // Atualiza lista lateral (já chama updateFullscreenQueue internamente)

        document.getElementById('compactSingerForm')?.remove();

        document.querySelector('.compact-controls-wrapper')?.classList.remove('autohide'); // Show on finish

        if (queue.length > 0) {

            playNext();

        } else {

            if (topInfoBox) topInfoBox.style.display = 'none';

            playerArea.innerHTML = '<div class="placeholder-msg">PRONTO PARA O PRÓXIMO SHOW!</div>';

            // Avisa Firebase que nada está tocando

            if (currentRoomCode) {

                db.ref('salas/' + currentRoomCode + '/now_playing').set({ playing: false });

            }

            checkAmbientMusic(); // Verifica se deve tocar música ambiente

        }

        // Limpa listener de votos para a próxima música

        if (currentRoomCode) {

            db.ref('salas/' + currentRoomCode + '/now_playing/votes').off();

            db.ref('salas/' + currentRoomCode + '/now_playing/votes').remove(); // Reseta votos não DB

        }

    }

    function updatePublicScoreUI() {

        const el = document.getElementById('publicScoreDisplay');

        const val = document.getElementById('publicScoreVal');

        const bar = document.getElementById('vibeBarInner');

        if (!el || !val || !bar) return;

        const entries = Object.values(currentVotes);

        const count = entries.length;

        if (count === 0) {

            el.style.display = 'none';

            return;

        }

        // Cálculo Robusto de Média (v11)

        const sum = entries.reduce((a, b) => a + (b.stars || 0), 0);

        const avg = sum / count;

        const percent = (avg / 5) * 100;

        // Atualiza Texto: Média + Contagem de Votos

        val.innerHTML = `${avg.toFixed(1)} <span style="font-size:0.6rem; opacity:0.6; font-weight:400; margin-left:5px;">(${count} ${count === 1 ? 'voto' : 'votos'})</span>`;

        bar.style.width = percent + '%';

        // Cores dinâmicas (v11)

        if (avg < 2.5) bar.style.background = '#00f2ff';

        else if (avg < 4.0) bar.style.background = 'linear-gradient(90deg, #facc15, #fb923c)';

        else bar.style.background = 'linear-gradient(90deg, #d946ef, #ff0080)';

        el.style.display = 'flex';

        // Força visibilidade caso o display esteja em block por algum erro anterior

        if (el.style.display !== 'flex') el.style.setProperty('display', 'flex', 'important');

    }

    // ─── Ambient Music (YouTube) ──────────────────────────────────────────────────

    function initAmbientPlayer() {

        // Carrega API do YouTube

        const tag = document.createElement('script');

        tag.src = "https://www.youtube.com/iframe_api";

        const firstScriptTag = document.getElementsByTagName('script')[0];

        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {

            // O player será criado sob demanda não checkAmbientMusic

            if (!isPlaying) checkAmbientMusic();

        };

    }

    // stopAmbientMusic usa ytAmbientPlayer (declarado não topo do arquivo)

    function stopAmbientMusic() {

        if (!ytAmbientPlayer) return;

        try {

            isDestroyingAmbient = true;

            ambientLastTime = ytAmbientPlayer.getCurrentTime() || 0;

            const idx = ytAmbientPlayer.getPlaylistIndex ? ytAmbientPlayer.getPlaylistIndex() : -1;

            if (idx >= 0) ambientLastIndex = idx;

            ytAmbientPlayer.stopVideo();

            ytAmbientPlayer.destroy();

        } catch (e) { console.warn('stopAmbientMusic erro:', e); }

        finally {

            ytAmbientPlayer = null;

            isAmbientPlaying = false;

            setTimeout(() => { isDestroyingAmbient = false; }, 500);

        }

    }

    function extractYoutubeInfo(url) {

        if (!url) return { videoId: null, playlistId: null };

        let videoId = null;

        let playlistId = null;

        // Extrair Video ID

        const vRegExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;

        const vMatch = url.match(vRegExp);

        if (vMatch && vMatch[2].length === 11) videoId = vMatch[2];

        // Extrair Playlist ID

        const pRegExp = /[?&]list=([^#\&\?]+)/;

        const pMatch = url.match(pRegExp);

        if (pMatch) playlistId = pMatch[1];

        return { videoId, playlistId };

    }

    function checkAmbientMusic() {
        console.log("🎸 Verificando Música Ambiente... Tocando:", isPlaying, "Fila:", queue.length);
        if (isPlaying || queue.length > 0) return;

        const url = settings.ambientUrl ? settings.ambientUrl.trim() : "";

        // Se não há URL configurada, mostra uma tela bonita de espera

        if (!url) {

            playerArea.innerHTML = `

            <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column; background: radial-gradient(circle at center, rgba(45,67,216,0.3) 0%, var(--bg-dark) 70%); color:white;">

                <h2 style="font-weight:900; letter-spacing:15px; margin-bottom:15px; font-size:3rem; text-shadow: 0 0 30px var(--accent-primary);">KARAOKE PARTY</h2>

                <div class="placeholder-msg" style="color:var(--text-main); font-weight:300;">PRONTO PARA O PRÓXIMO SHOW!</div>

            </div>

        `;

            return;

        }

        const info = extractYoutubeInfo(url);

        const videoId = info.videoId;

        const playlistId = info.playlistId;

        if (!videoId && !playlistId) return; // URL inválida

        playerArea.innerHTML = `

        <div id="ambientContainer" style="width:100%; height:100%; position:relative;">

            <div id="ytAmbient"></div>

            <div style="position:absolute; top:0; left:0; width:100%; height:100%; background:transparent; display:flex; align-items:center; justify-content:center; flex-direction:column; color:white; pointer-events:none;">

                <h2 style="font-weight:900; letter-spacing:10px; margin-bottom:10px; opacity:0.3;">MÚSICA AMBIENTE</h2>

                <div class="placeholder-msg">AGUARDANDO PRÓXIMO SHOW...</div>

            </div>

        </div>

    `;

        setTimeout(() => {

            if (typeof YT !== 'undefined' && YT.Player) {

                const playerConfig = {

                    height: '100%',

                    width: '100%',

                    playerVars: {

                        'autoplay': 1,

                        'controls': 0,

                        'mute': 0,

                        'start': Math.floor(ambientLastTime),

                        'index': Math.floor(ambientLastIndex)

                    },

                    events: {

                        'onReady': (event) => {

                            event.target.playVideo();

                            event.target.setVolume(35);

                        }

                    }

                };

                // Se for uma playlist, configura para tocar a lista

                if (playlistId) {

                    playerConfig.playerVars.listType = 'playlist';

                    playerConfig.playerVars.list = playlistId;

                    // Se o usuário já avançou na playlist (index > 0), NÃO passamos o videoId,

                    // caso contrário o YouTube força o início naquele vídeo e ignãora o index salvo.

                    if (videoId && ambientLastIndex === 0) {

                        playerConfig.videoId = videoId;

                    }

                } else {

                    // Vídeo único

                    playerConfig.videoId = videoId;

                    playerConfig.playerVars.loop = 1;

                    playerConfig.playerVars.playlist = videoId;

                }

                ytAmbientPlayer = new YT.Player('ytAmbient', playerConfig);

                isAmbientPlaying = true;

            }

        }, 500);

    }

    // ─── Som SFX ──────────────────────────────────────────────────────────────────

    async function startMic() {

        try {

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            audioContext = new (window.AudioContext || window.webkitAudioContext)();

            const source = audioContext.createMediaStreamSource(stream);

            analyzer = audioContext.createAnalyser();

            analyzer.fftSize = 256;

            source.connect(analyzer);

            dataArray = new Uint8Array(analyzer.frequencyBinCount);

            const check = () => {

                if (!analyzer) return;

                analyzer.getByteFrequencyData(dataArray);

                const avg = dataArray.reduce((p, c) => p + c, 0) / dataArray.length;

                if (avg > maxVolume) maxVolume = avg;

                // Atualiza feedback visual do microfone (Barra Vertical v5)

                const bar = document.getElementById('vuBar');

                const badge = document.getElementById('micBadge');

                if (bar) {

                    // normalizado para a altura de 180px (CSS)

                    const percentage = Math.min(100, (avg / 140) * 100);

                    bar.style.height = percentage + '%';

                }

                if (badge) {

                    badge.style.display = avg > 8 ? 'block' : 'none';

                }

                requestAnimationFrame(check);

            };

            check();

        } catch (e) { console.warn("Mic indisponível."); }

    }

    // ─── Controlás ─────────────────────────────────────────────────────────────────

    function togglePlay() {

        const v = document.getElementById('mainVideo');

        if (!v) return;

        // Garante que o udio seja retomado (Browsers exigem interação)

        if (audioContext && audioContext.state === 'suspended') {

            audioContext.resume();

        }

        if (v.paused) { v.play(); const i = document.querySelector('.btn-play i'); if (i) i.className = 'fas fa-pause'; }

        else { v.pause(); const i = document.querySelector('.btn-play i'); if (i) i.className = 'fas fa-play'; }

    }

    function restartSong() {

        const v = document.getElementById('mainVideo');

        if (v) v.currentTime = 0;

    }

    function setVideoVolume(val) {

        const v = document.getElementById('mainVideo');

        if (v) v.volume = val;

        const r = document.getElementById('volRange');

        if (r) r.value = val;

    }

    function changeVolume(delta) {

        const v = document.getElementById('mainVideo');

        if (v) setVideoVolume(Math.max(0, Math.min(1, v.volume + delta)));

        resetControlásTimer();

    }

    function changeTone(delta) {

        const v = document.getElementById('mainVideo');

        if (!v) return;

        // Increment pitch factor. Range 0.7 to 1.3 (Security margin)

        // Roughly 0.059 per semitone for better precision

        currentPitch = Math.max(0.7, Math.min(1.3, currentPitch + delta));

        if (pitchShifter) {

            pitchShifter.setPitchOffset(currentPitch);

        }

        // Ensure video playback speed remains normal

        v.playbackRate = 1.0;

        v.preservesPitch = true;

        // Feedback visual 1: Label na barra de controles

        const display = document.querySelector('.tone-control .control-label');

        if (display) {

            const semitones = Math.round((currentPitch - 1.0) / 0.059);

            display.innerText = `TOM: ${semitones > 0 ? '+' : ''}${semitones}`;

        }

        // Feedback visual 2: Toast de aviso (ajuda em modo tela cheia)

        if (typeof showToast === 'function') {

            const semitones = Math.round((currentPitch - 1.0) / 0.059);

            showToast(`TOM: ${semitones > 0 ? '+' : ''}${semitones}`);

        }

        resetControlásTimer();

    }

    function resetControlásTimer() {

        const wrapper = document.querySelector('.compact-controls-wrapper');

        if (!wrapper) return;

        // Show controls and hide screensaver

        wrapper.classList.remove('autohide');

        stopScreensaver();

        // Clear existing timeout

        if (controlsTimeout) clearTimeout(controlsTimeout);

        if (idleTimeout) clearTimeout(idleTimeout);

        // If playing, set timeout to hide controls (ONLY if NOT mobile)

        const isMobile = window.innerWidth <= 900;

        if (isPlaying && !isMobile) {

            controlsTimeout = setTimeout(() => {

                if (isPlaying) {

                    const isInputActive = document.activeElement && (document.activeElement.tagName === 'INPUT');

                    const isModalOpen = modal && modal.style.display === 'flex';

                    if (!isInputActive && !isModalOpen) {

                        wrapper.classList.add('autohide');

                    }

                }

            }, 3000);

        } else if (isPlaying && isMobile) {

            // Não mobile, removemos a classe autohide caso ainda esteja lá

            wrapper.classList.remove('autohide');

        } else {

            // If NOT playing, set timeout for screensaver

            if (settings.screensaverTimeout > 0) {

                idleTimeout = setTimeout(() => {

                    if (!isPlaying) startScreensaver();

                }, settings.screensaverTimeout);

            }

        }

    }

    // (Funções de Screensaver e Fullscreen movidas para a seção de Implementação acima)

    // ─── Fullscreen & Video State ────────────────────────────────────────────────

    // Função toggleFullscreen unificada implementada acima.

    // ─── Hotkeys ──────────────────────────────────────────────────────────────────

    function handleHotkey(e) {

        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

        if (e.key >= '0' && e.key <= '9') {

            if (currentCode.length < 5) { currentCode += e.key; updateCodeOverlay(); }

            return;

        }

        if (e.key === 'Backspace' && currentCode.length > 0) { currentCode = currentCode.slice(0, -1); updateCodeOverlay(); return; }

        if (e.key === 'Escape' && currentCode.length > 0) { currentCode = ""; if (codeEntryOverlay) codeEntryOverlay.style.display = 'none'; return; }

        if (e.key === 'Enter' && currentCode.length > 0) {

            const song = catalog.find(s => s.id === currentCode.padStart(5, '0'));

            if (song) { addToQueue(song.id); currentCode = ""; if (codeEntryOverlay) codeEntryOverlay.style.display = 'none'; }

            return;

        }

        switch (e.key) {

            case ' ': e.preventDefault(); togglePlay(); break;

            case 'Delete': e.preventDefault(); showScore(); break;

            case ',': // Hidden hotkey: apenas agenda a nota 100 (discreto)

                forcedScore = 100;

                break;

            case '+': case '=': changeVolume(0.1); break;

            case '-': case '_': changeVolume(-0.1); break;

            case '[': changeTone(-0.05); break;

            case ']': changeTone(0.05); break;

            case 'Home': restartSong(); break;

            case 'PageDown': skipSong(); break;

            case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;

        }

    }

    function updateCodeOverlay() {

        if (!codeEntryOverlay || !codeDisplay || !codeSongInfo) return;

        if (currentCode.length > 0) {

            codeEntryOverlay.style.display = 'block';

            codeDisplay.innerText = currentCode.padEnd(5, '_').split('').join(' ');

            const song = catalog.find(s => s.id === currentCode.padStart(5, '0'));

            codeSongInfo.innerText = song ? `${song.artist} - ${song.title}` : (currentCode.length === 5 ? "CÓDIGO INVÁLIDO" : "");

        } else {

            codeEntryOverlay.style.display = 'none';

        }

    }

    // ─── Modal ────────────────────────────────────────────────────────────────────

    function showModal(title, body, onConfirm, chips = []) {

        if (!modal) return;

        document.getElementById('modalTitle').innerText = title;

        document.getElementById('modalBody').innerHTML = body;

        modal.style.display = 'flex';

        // Renderiza chips se houver

        const chipsContainer = document.getElementById('modalChips');

        if (chipsContainer && chips.length > 0) {

            chips.forEach(c => {

                const el = document.createElement('div');

                el.className = `user-chip ${c.type}`;

                el.innerHTML = `

                ${c.photo ? `<img src="${c.photo}">` : (c.type === 'active' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-history"></i>')}

                <span>${c.name}</span>

            `;

                el.onclick = () => {

                    const input = document.getElementById('singerName');

                    if (input) {

                        input.value = c.name;

                        input.focus();

                    }

                };

                chipsContainer.appendChild(el);

            });

        }

        // Foca não primeiro input disponível não modal

        setTimeout(() => {

            const inp = modal.querySelector('input[type="text"]');

            if (inp) inp.focus();

        }, 100);

        const closeAndClean = () => {
            modal.style.display = 'none';
            window.removeEventListener('keydown', handler);
        };

        document.getElementById('modalConfirm').onclick = () => {
            const inp = modal.querySelector('input[type="text"]');
            onConfirm(inp ? inp.value : '');
            closeAndClean();
        };

        document.getElementById('modalCancel').onclick = () => {
            closeAndClean();
        };

        const handler = (e) => {
            if (e.key === 'Enter') { document.getElementById('modalConfirm').click(); }
            if (e.key === 'Escape') { document.getElementById('modalCancel').click(); }
        };

        window.addEventListener('keydown', handler);

    }

    // ─── Fullscreen Queue ──────────────────────────────────────────────────────────

    function updateFullscreenQueue() {

        const box = document.getElementById('fsQueueOverlay');

        const topInfo = document.getElementById('topInfoBox');

        if (!box || queue.length <= 1) {

            if (box) box.style.display = 'none';

            if (topInfo && isPlaying) topInfo.style.display = 'block';

            return;

        }

        box.style.display = 'flex';

        if (topInfo) topInfo.style.display = 'none';

        const current = queue[0];

        const nexts = queue.slice(1, 4);

        // Layout compacto: título  · artista em uma linha, cantor embaixo

        let html = `<div class="fs-col fs-col-current">

        <div class="fs-col-label">CANTANDO AGORA</div>

        <div class="fs-col-main"><span class="fs-col-title">${current.title}</span><span class="fs-col-sep">  · </span><span class="fs-col-artist">${current.artist}</span></div>

        <div class="fs-col-singer">🎤 ${current.singer}</div>

    </div>`;

        if (nexts.length > 0) {

            html += `<div class="fs-divider-v"></div>`;

            nexts.forEach((item, i) => {

                html += `<div class="fs-col fs-col-next">

                <div class="fs-col-label">#${i + 2}</div>

                <div class="fs-col-main"><span class="fs-col-title">${item.title}</span><span class="fs-col-sep">  · </span><span class="fs-col-artist">${item.artist}</span></div>

                <div class="fs-col-singer">${item.singer}</div>

            </div>`;

            });

        }

        box.innerHTML = html;

    }

    // ─── Mobile Poláling (Firebase Sync) ──────────────────────────────────────────

    function startMobilePolling() {

        if (!currentRoomCode) return;

        const requestsRef = db.ref('salas/' + currentRoomCode + '/pedidos');

        // Desativa listener anterior para evitar duplicatas (vazamento de memória)

        requestsRef.off('child_added');

        // Escuta novos pedidos

        requestsRef.on('child_added', (snapshot) => {

            const req = snapshot.val();

            if (req && !req.processed) {

                const song = catalog.find(s => s.id === req.id);

                if (song) {

                    // Usamos o timestamp do Firebase, mas garantimos que ele seja tratado como número

                    const mobileTime = Number(req.timestamp);

                    enqueue({

                        ...song,

                        singer: req.singer,

                        time: mobileTime

                    }, false);

                    showToast(`🔔 ${req.singer} pediu: ${song.title}`);

                    requestsRef.child(snapshot.key).update({ processed: true });

                }

            }

        });

        // Limpeza periódica de pedidos processados (opcional, para não pesar o DB)

        // Aqui poderíamos adicionar uma lógica de delete após X minutos.

    }

    // ─── Toast ────────────────────────────────────────────────────────────────────

    function showToast(msg) {

        const toast = document.createElement('div');

        toast.style.cssText = `position:fixed;bottom:30px;right:30px;background:linear-gradient(135deg,var(--accent-primary),var(--accent-secondary));color:white;padding:15px 25px;border-radius:12px;font-weight:700;font-size:0.95rem;box-shadow:0 10px 30px rgba(217,70,239,0.5);z-index:99999;transition:all 0.5s;opacity:0;transform:translateX(100px);`;

        toast.innerHTML = `<i class="fas fa-mobile-alt" style="margin-right:10px;"></i> ${msg}`;

        (document.fullscreenElement || document.body).appendChild(toast);

        setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 50);

        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100px)'; setTimeout(() => toast.remove(), 500); }, 4000);

    }

    // ─── Debug (console-only em produção) ────────────────────────────────────────

    function updateDebugInfo(msg) {

        console.log('[KARAOKE]', msg);

    }

    /* --- SUBSCRIPTION LOGIC (PREMIUM) --- */

    function checkSubscriptionStatus(uid) {

        if (!uid) return;

        db.ref('users/' + uid + '/subscription').on('value', (snapshot) => {

            const sub = snapshot.val();

            if (sub && sub.active && sub.expiresAt > Date.now()) {

                isPremium = true;

                subscriptionData = sub;

                if (trialTimer) clearInterval(trialTimer);

                const banner = document.getElementById('trialTimerBanner');

                if (banner) banner.style.display = 'none';

                showToast("💎 PLANO ATIVO!");

            } else {

                isPremium = false;

                subscriptionData = null;

            }

        });

    }

    /* --- EXPORTAÇÃO CONTROLADA (SEGURANÇA) --- */

    window.openHostLogin = typeof openHostLogin !== 'undefined' ? openHostLogin : null;

    window.closeHostLogin = typeof closeHostLogin !== 'undefined' ? closeHostLogin : null;

    window.handleHostEmailAuth = typeof handleHostEmailAuth !== 'undefined' ? handleHostEmailAuth : null;

    window.hostForgotPassword = typeof hostForgotPassword !== 'undefined' ? hostForgotPassword : null;

    window.toggleHostAuthMode = typeof toggleHostAuthMode !== 'undefined' ? toggleHostAuthMode : null;

    window.restartSong = typeof restartSong !== 'undefined' ? restartSong : null;

    window.changeTone = typeof changeTone !== 'undefined' ? changeTone : null;

    window.changeVolume = typeof changeVolume !== 'undefined' ? changeVolume : null;

    window.setVideoVolume = typeof setVideoVolume !== 'undefined' ? setVideoVolume : null;

    window.toggleFullscreen = typeof toggleFullscreen !== 'undefined' ? toggleFullscreen : null;

    window.showScore = typeof showScore !== 'undefined' ? showScore : null;

    window.logoutHost = typeof logoutHost !== 'undefined' ? logoutHost : null;

    window.startHostTour = typeof startHostTour !== 'undefined' ? startHostTour : null;

    window.removePhoto = typeof removePhoto !== 'undefined' ? removePhoto : null;

    window.handlePhotoUpload = typeof handlePhotoUpload !== 'undefined' ? handlePhotoUpload : null;

    window.togglePlay = typeof togglePlay !== 'undefined' ? togglePlay : null;

    window.addToQueue = typeof addToQueue !== 'undefined' ? addToQueue : null;

    window.confirmCompactSinger = typeof confirmCompactSinger !== 'undefined' ? confirmCompactSinger : null;

    // ─── Mobile Logic (v4.0) ──────────────────────────────────────────────────

    function initMobileTabs() {
        if (window.innerWidth > 900) return;
        // Garante que o catálogo seja a aba inicial
        switchMobileTab('catalog');
    }

    function switchMobileTab(tab) {
        const catalogTab = document.getElementById('tab-catalog');
        const queueTab = document.getElementById('tab-queue');
        const btnCat = document.getElementById('btn-tab-catalog');
        const btnQue = document.getElementById('btn-tab-queue');

        if (!catalogTab || !queueTab) return;

        if (tab === 'catalog') {
            catalogTab.classList.add('active-tab');
            queueTab.classList.remove('active-tab');
            if (btnCat) btnCat.classList.add('active');
            if (btnQue) btnQue.classList.remove('active');
        } else {
            catalogTab.classList.remove('active-tab');
            queueTab.classList.add('active-tab');
            if (btnCat) btnCat.classList.remove('active');
            if (btnQue) btnQue.classList.add('active');
        }
    }

    function toggleMobilePlayer(expand) {
        const playerContainer = document.getElementById('playerContainer');
        if (!playerContainer) return;

        if (expand) {
            playerContainer.classList.add('expanded');
        } else {
            playerContainer.classList.remove('expanded');
        }
    }

    // Exposure
    window.switchMobileTab = switchMobileTab;
    window.toggleMobilePlayer = toggleMobilePlayer;

    window.handlePhoneInput = function(el) {
        let v = el.value.replace(/\D/g, '');
        if (v.length > 11) v = v.substring(0, 11);
        let val = '';
        if (v.length > 0) val = '(' + v.substring(0, 2);
        if (v.length > 2) val += ') ' + v.substring(2, 7);
        if (v.length > 7) val += '-' + v.substring(7, 11);
        el.value = val;
    }

    window.moveQueue = typeof moveQueue !== 'undefined' ? moveQueue : null;
    window.removeFromQueue = typeof removeFromQueue !== 'undefined' ? removeFromQueue : null;
    window.playNext = typeof playNext !== 'undefined' ? playNext : null;

})();



