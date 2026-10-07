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
})();
