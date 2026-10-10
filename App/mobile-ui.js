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
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isIosSafari = isIos && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
    let deferredInstallPrompt = null;
    let installCard = null;

    function dismissInstallCard() {
        installCard?.remove();
        installCard = null;
    }

    function androidInstallInstructions() {
        if (/SamsungBrowser/i.test(navigator.userAgent)) {
            return 'No Samsung Internet, abra o menu e procure “Adicionar página a” → “Tela inicial”. Se aparecer “Instalar aplicativo”, prefira essa opção para abrir em modo app.';
        }
        if (/Firefox/i.test(navigator.userAgent)) {
            return 'No Firefox, abra o menu ⋮ e procure “Instalar”. Se houver apenas “Adicionar à tela inicial”, será criado um atalho que continua abrindo no navegador.';
        }
        return 'Abra o menu ⋮ do navegador. “Instalar app” cria o aplicativo em modo independente; “Adicionar à tela inicial” cria apenas um atalho quando a instalação não estiver disponível.';
    }

    function renderInstallCard(mode) {
        if (isStandalone()) {
            installCard?.remove();
            installCard = null;
            return;
        }

        if (!installCard) {
            installCard = document.createElement('aside');
            installCard.className = 'kp-install-card';
            installCard.setAttribute('role', 'region');
            installCard.setAttribute('aria-label', 'Instalar Karaoke Party');
            document.body.appendChild(installCard);
        }
        installCard.replaceChildren();

        const copy = document.createElement('div');
        copy.className = 'kp-install-copy';
        const title = document.createElement('strong');
        title.textContent = mode === 'native' ? 'Instale o Karaoke Party' : mode === 'android-help' ? 'Adicione o Karaoke Party ao celular' : 'Adicione à Tela de Início';
        const instructions = document.createElement('p');
        instructions.textContent = mode === 'native'
            ? 'Abra o app mais rápido e em tela cheia no seu celular.'
            : mode === 'android-help'
                ? 'A instalação nativa não está disponível agora, mas você ainda pode instalar pelo menu ou criar um atalho.'
            : isIosSafari
                ? 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.'
                : 'Abra esta página no Safari. Depois toque em Compartilhar e em “Adicionar à Tela de Início”.';
        copy.append(title, instructions);

        const details = document.createElement('p');
        details.className = 'kp-install-steps';
        details.hidden = true;
        details.textContent = mode === 'android-help'
            ? androidInstallInstructions()
            : isIosSafari
                ? 'O ícone será criado na Tela de Início e abrirá o Karaoke Party sem a barra normal do Safari.'
                : 'Navegadores alternativos do iPhone não oferecem o mesmo fluxo. Copie ou reabra o endereço no Safari para continuar.';
        if (mode !== 'native') copy.append(details);

        const actions = document.createElement('div');
        actions.className = 'kp-install-actions';
        if (mode === 'native') {
            const install = document.createElement('button');
            install.type = 'button';
            install.className = 'kp-install-confirm';
            install.textContent = 'Instalar aplicativo';
            install.addEventListener('click', async () => {
                if (!deferredInstallPrompt) return;
                install.disabled = true;
                deferredInstallPrompt.prompt();
                const choice = await deferredInstallPrompt.userChoice;
                deferredInstallPrompt = null;
                if (choice.outcome === 'accepted') dismissInstallCard();
                else renderInstallCard('android-help');
            });
            actions.append(install);
        } else {
            const help = document.createElement('button');
            help.type = 'button';
            help.className = 'kp-install-help';
            help.textContent = mode === 'android-help' ? 'Como instalar' : 'Ver instruções';
            help.setAttribute('aria-expanded', 'false');
            help.addEventListener('click', () => {
                details.hidden = !details.hidden;
                help.setAttribute('aria-expanded', String(!details.hidden));
            });
            actions.append(help);
        }
        const dismiss = document.createElement('button');
        dismiss.type = 'button';
        dismiss.className = 'kp-install-dismiss';
        dismiss.textContent = mode === 'native' || mode === 'android-help' ? 'Agora não' : 'Entendi';
        dismiss.addEventListener('click', dismissInstallCard);
        actions.append(dismiss);

        installCard.append(copy, actions);
    }

    window.addEventListener('beforeinstallprompt', function (event) {
        event.preventDefault();
        deferredInstallPrompt = event;
        renderInstallCard('native');
    });

    window.addEventListener('appinstalled', function () {
        deferredInstallPrompt = null;
        dismissInstallCard();
    });

    if ((isAndroid || isIos) && !isStandalone()) {
        window.addEventListener('DOMContentLoaded', function () {
            if (deferredInstallPrompt) renderInstallCard('native');
            else renderInstallCard(isAndroid ? 'android-help' : 'ios-help');
        }, { once: true });
    }
})();
