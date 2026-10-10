(function () {
    'use strict';

    let noticeLayer;
    let noticeMessage;
    let noticeButton;

    function closeNotice() {
        if (!noticeLayer || noticeLayer.hidden) return;
        noticeLayer.hidden = true;
        document.body.style.overflow = noticeLayer.dataset.previousOverflow || '';
    }

    function ensureNotice() {
        if (noticeLayer) return;
        noticeLayer = document.createElement('div');
        noticeLayer.className = 'kp-notice-layer';
        noticeLayer.hidden = true;
        noticeLayer.setAttribute('role', 'dialog');
        noticeLayer.setAttribute('aria-modal', 'true');
        noticeLayer.setAttribute('aria-labelledby', 'kpNoticeTitle');
        noticeLayer.innerHTML = '<section class="kp-notice"><span class="kp-notice-icon"><i class="fas fa-info"></i></span><h2 id="kpNoticeTitle">Atenção</h2><p></p><button type="button">Entendi</button></section>';
        noticeMessage = noticeLayer.querySelector('p');
        noticeButton = noticeLayer.querySelector('button');
        noticeButton.addEventListener('click', closeNotice);
        noticeLayer.addEventListener('click', function (event) {
            if (event.target === noticeLayer) closeNotice();
        });
        document.body.appendChild(noticeLayer);
    }

    window.alert = function (message) {
        ensureNotice();
        noticeMessage.textContent = String(message == null ? '' : message).replace(/^([❌⚠️]\s*)+/, '');
        noticeLayer.dataset.previousOverflow = document.body.style.overflow;
        noticeLayer.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function () { noticeButton.focus(); });
    };

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (noticeLayer && !noticeLayer.hidden) return closeNotice();
            const dialog = document.querySelector('dialog[open]');
            if (dialog) return dialog.close();
            const visibleOverlay = Array.from(document.querySelectorAll('.mobile-modal-overlay')).reverse().find(function (item) {
                return getComputedStyle(item).display !== 'none';
            });
            if (visibleOverlay) {
                const closeControl = visibleOverlay.querySelector('.mobile-icon-close, .btn-modal-close, .btn-cancel, .btn-va-close');
                if (closeControl) closeControl.click();
            }
        }
    });

    const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isIosSafari = isIos && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
    let deferredInstallPrompt = null;
    let installCard = null;

    function dismissInstallCard() {
        installCard?.remove();
        installCard = null;
        try { sessionStorage.setItem('kpInstallDismissed', '1'); } catch (error) { /* armazenamento opcional */ }
    }

    function installWasDismissed() {
        try { return sessionStorage.getItem('kpInstallDismissed') === '1'; } catch (error) { return false; }
    }

    function showInstallCard(mode) {
        if (isStandalone() || installCard || installWasDismissed()) return;

        installCard = document.createElement('aside');
        installCard.className = 'kp-install-card';
        installCard.setAttribute('role', 'region');
        installCard.setAttribute('aria-label', 'Instalar Karaoke Party');

        const copy = document.createElement('div');
        copy.className = 'kp-install-copy';
        const title = document.createElement('strong');
        title.textContent = mode === 'android' ? 'Instale o Karaoke Party' : 'Adicione à Tela de Início';
        const instructions = document.createElement('p');
        instructions.textContent = mode === 'android'
            ? 'Abra o app mais rápido e em tela cheia no seu celular.'
            : isIosSafari
                ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
                : 'Abra esta página no Safari. Depois toque em Compartilhar e em “Adicionar à Tela de Início”.';
        copy.append(title, instructions);

        const actions = document.createElement('div');
        actions.className = 'kp-install-actions';
        if (mode === 'android') {
            const install = document.createElement('button');
            install.type = 'button';
            install.className = 'kp-install-confirm';
            install.textContent = 'Instalar';
            install.addEventListener('click', async () => {
                if (!deferredInstallPrompt) return;
                install.disabled = true;
                deferredInstallPrompt.prompt();
                const choice = await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
                if (choice.outcome === 'accepted') dismissInstallCard();
                else install.disabled = false;
            });
            actions.append(install);
        }
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'kp-install-dismiss';
        dismiss.textContent = mode === 'android' ? 'Agora não' : 'Entendi';
        dismiss.addEventListener('click', dismissInstallCard);
        actions.append(dismiss);

        installCard.append(copy, actions);
        document.body.appendChild(installCard);
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        showInstallCard('android');
    });

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
        dismissInstallCard();
    });

    if (isIos && !isStandalone()) {
        window.addEventListener('DOMContentLoaded', function () { showInstallCard('ios'); }, { once: true });
    }
})();
