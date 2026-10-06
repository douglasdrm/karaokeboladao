(() => {
    'use strict';
    const firebaseConfig = {
        apiKey: 'AIzaSyCnZ8hoE3NGNx2t490Yw12AxlCqVjSguig', authDomain: 'karaoke-party-online.firebaseapp.com',
        databaseURL: 'https://karaoke-party-online-default-rtdb.firebaseio.com', projectId: 'karaoke-party-online',
        storageBucket: 'karaoke-party-online.firebasestorage.app', messagingSenderId: '1059879567957',
        appId: '1:1059879567957:web:d4cb88563b39fe08934adc'
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const functions = firebase.functions();
    const params = new URLSearchParams(location.search);
    const pairing = { pairId: String(params.get('id') || '').toUpperCase(), secret: params.get('secret') || '' };
    const sections = ['pairLoading','pairAuth','pairApprove','pairWaiting','pairInvalid'].map(id => document.getElementById(id));
    let approved = false;
    let pollTimer = null;

    const show = target => sections.forEach(section => { section.hidden = section.id !== target; });
    const error = (id, message = '') => { const el = document.getElementById(id); el.textContent = message; el.hidden = !message; };

    async function validatePairing() {
        if (!pairing.pairId || !pairing.secret) { show('pairInvalid'); return false; }
        try {
            const result = await functions.httpsCallable('getTvPairing')(pairing);
            if (result.data?.status === 'ready' && result.data.roomCode) {
                location.replace(`cabine-mobile.html?room=${encodeURIComponent(result.data.roomCode)}`);
                return false;
            }
            return true;
        } catch { show('pairInvalid'); return false; }
    }

    function pollRoom() {
        clearInterval(pollTimer);
        pollTimer = setInterval(async () => {
            try {
                const result = await functions.httpsCallable('getTvPairing')(pairing);
                if (result.data?.status !== 'ready' || !result.data.roomCode) return;
                clearInterval(pollTimer);
                location.replace(`cabine-mobile.html?room=${encodeURIComponent(result.data.roomCode)}`);
            } catch { clearInterval(pollTimer); show('pairInvalid'); }
        }, 1500);
    }

    document.getElementById('pairGoogle').addEventListener('click', async event => {
        event.currentTarget.disabled = true;
        error('pairAuthError');
        try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); }
        catch (err) { if (err.code !== 'auth/popup-closed-by-user') error('pairAuthError', `Não foi possível entrar com Google${err.code ? ` (${err.code})` : ''}.`); }
        finally { event.currentTarget.disabled = false; }
    });
    document.getElementById('pairEmailForm').addEventListener('submit', async event => {
        event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; error('pairAuthError');
        try { await auth.signInWithEmailAndPassword(document.getElementById('pairEmail').value.trim(), document.getElementById('pairPassword').value); }
        catch { error('pairAuthError', 'E-mail ou senha inválidos.'); }
        finally { button.disabled = false; }
    });
    document.getElementById('pairApproveForm').addEventListener('submit', async event => {
        event.preventDefault(); const button = event.currentTarget.querySelector('button'); button.disabled = true; error('pairApproveError');
        try {
            await functions.httpsCallable('approveTvPairing')({ ...pairing, partyName: document.getElementById('pairPartyName').value.trim() });
            approved = true; show('pairWaiting'); pollRoom();
        } catch (err) { error('pairApproveError', err.message || 'Não foi possível autorizar esta TV.'); button.disabled = false; }
    });
    document.getElementById('pairLogout').addEventListener('click', () => auth.signOut());

    auth.onAuthStateChanged(async user => {
        if (approved) return;
        if (!await validatePairing()) return;
        if (!user) { show('pairAuth'); return; }
        document.getElementById('pairIdentity').textContent = `Conectado como ${user.displayName || user.email || 'DJ'}.`;
        try { document.getElementById('pairPartyName').value = localStorage.getItem('lastStandalonePartyName') || ''; } catch {}
        show('pairApprove');
    });
})();
