/**
 * Form alerts: compact inline validation notices + optional modal for rare cases.
 */
(function initFormAlert(global) {
    const MODAL_ID = 'app-alert-modal';
    const INLINE_SELECTOR = '.inline-validation-notice';
    let activeResolve = null;
    let activeInlineNotice = null;

    function getModal() {
        return document.getElementById(MODAL_ID);
    }

    function normalizeVariant(variant) {
        const value = String(variant || 'warning').trim().toLowerCase();
        if (value === 'error' || value === 'success' || value === 'info' || value === 'warning') {
            return value;
        }
        return 'warning';
    }

    function shortenValidationMessage(message) {
        let text = String(message || '').trim();
        if (!text) {
            return 'This field is required';
        }

        text = text
            .replace(/^Please fill in the required field:\s*/i, '')
            .replace(/^Please complete the required field:\s*/i, '')
            .replace(/^Please complete all required\s+/i, 'Please complete ');

        const scoped = text.match(/^[^:]+:\s*(.+)$/);
        if (scoped && scoped[1]) {
            const label = scoped[1].trim();
            if (/^required$/i.test(label)) {
                return 'This field is required';
            }
            return `${label} is required`;
        }

        if (!/\brequired\b/i.test(text)) {
            return `${text} is required`;
        }

        return text;
    }

    function clearInlineValidationNotice() {
        document.querySelectorAll(INLINE_SELECTOR).forEach((node) => node.remove());
        activeInlineNotice = null;
    }

    function findInlineNoticeMount(anchorEl) {
        if (!anchorEl || anchorEl.nodeType !== 1) {
            return null;
        }

        const formGroup = anchorEl.closest('.form-group');
        if (formGroup) {
            return { container: formGroup, position: 'after-label' };
        }

        const dimensionStack = anchorEl.closest('.dimension-field-stack');
        if (dimensionStack) {
            return { container: dimensionStack, position: 'after-label' };
        }

        const vehicleForm = anchorEl.closest('[data-vehicle-entry-form], [data-item-entry-form]');
        if (vehicleForm) {
            return { container: vehicleForm, position: 'after-title' };
        }

        if (anchorEl.id === 'pickup-floors-selector' || anchorEl.id === 'delivery-floors-selector') {
            const host = anchorEl.closest('#pickup-room-list, #delivery-room-list') || anchorEl.parentElement;
            return { container: host, position: 'prepend' };
        }

        if (anchorEl.id === 'confirm-pickup-floors-btn') {
            return { container: anchorEl.parentElement || anchorEl, position: 'before-anchor' };
        }

        const optionNav = anchorEl.classList?.contains('option-nav')
            ? anchorEl
            : anchorEl.closest('.option-nav');
        if (optionNav) {
            const navHost = optionNav.closest('.form-group') || optionNav.parentElement;
            if (navHost) {
                return { container: navHost, position: 'prepend' };
            }
        }

        const cardSection = anchorEl.closest('.card-section, .dimension-item, .map-step-card');
        if (cardSection) {
            return { container: cardSection, position: 'prepend' };
        }

        return anchorEl.parentElement
            ? { container: anchorEl.parentElement, position: 'prepend' }
            : null;
    }

    function mountInlineNotice(anchorEl, message, options) {
        const opts = options && typeof options === 'object' ? options : {};
        const mount = findInlineNoticeMount(anchorEl);
        if (!mount || !mount.container) {
            return null;
        }

        clearInlineValidationNotice();

        const variant = normalizeVariant(opts.variant);
        const text = shortenValidationMessage(message);

        const notice = document.createElement('div');
        notice.className = 'inline-validation-notice';
        notice.setAttribute('role', 'alert');
        notice.dataset.variant = variant;
        notice.innerHTML = `
            <span class="inline-validation-notice__icon" aria-hidden="true">!</span>
            <span class="inline-validation-notice__text"></span>
            <button type="button" class="inline-validation-notice__dismiss" aria-label="Dismiss notice">&times;</button>
        `;

        const textEl = notice.querySelector('.inline-validation-notice__text');
        if (textEl) {
            textEl.textContent = text;
        }

        const { container, position } = mount;

        if (position === 'after-label') {
            const label = container.querySelector('.form-label, .dimension-input-label');
            if (label) {
                label.insertAdjacentElement('afterend', notice);
            } else {
                container.prepend(notice);
            }
        } else if (position === 'after-title') {
            const title = container.querySelector('.custom-item-title');
            if (title) {
                title.insertAdjacentElement('afterend', notice);
            } else {
                container.prepend(notice);
            }
        } else if (position === 'before-anchor') {
            anchorEl.insertAdjacentElement('beforebegin', notice);
        } else {
            container.prepend(notice);
        }

        const dismissBtn = notice.querySelector('.inline-validation-notice__dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                notice.remove();
                if (activeInlineNotice === notice) {
                    activeInlineNotice = null;
                }
            });
        }

        activeInlineNotice = notice;
        return notice;
    }

    function showInlineValidationNotice(anchorEl, message, options) {
        const notice = mountInlineNotice(anchorEl, message, options);
        if (!notice && message) {
            const text = shortenValidationMessage(message);
            global.alert(text);
        }
        return notice;
    }

    function closeAppAlert() {
        const modal = getModal();
        if (!modal) {
            if (typeof activeResolve === 'function') {
                activeResolve();
                activeResolve = null;
            }
            return;
        }

        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('app-alert-open');

        if (typeof activeResolve === 'function') {
            const resolve = activeResolve;
            activeResolve = null;
            resolve();
        }
    }

    function showAppAlert(message, options) {
        const opts = options && typeof options === 'object' ? options : {};
        if (opts.preferInline !== false && opts.anchorEl) {
            showInlineValidationNotice(opts.anchorEl, message, opts);
            return Promise.resolve();
        }

        const text = String(message || '').trim();
        if (!text) {
            return Promise.resolve();
        }

        const modal = getModal();
        if (!modal) {
            global.alert(text);
            return Promise.resolve();
        }

        const variant = normalizeVariant(opts.variant);
        const title = String(opts.title || '').trim() || (
            variant === 'error' ? 'Something went wrong'
                : variant === 'success' ? 'Success'
                    : variant === 'info' ? 'Notice'
                        : 'Action required'
        );
        const confirmLabel = String(opts.confirmLabel || opts.confirmText || 'OK').trim() || 'OK';

        const titleEl = modal.querySelector('#app-alert-title');
        const messageEl = modal.querySelector('#app-alert-message');
        const iconEl = modal.querySelector('.app-alert-modal__icon');
        const okBtn = modal.querySelector('.app-alert-modal__ok');
        const panel = modal.querySelector('.app-alert-modal__panel');

        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = text;
        if (okBtn) okBtn.textContent = confirmLabel;

        modal.dataset.variant = variant;
        if (panel) {
            panel.dataset.variant = variant;
        }
        if (iconEl) {
            iconEl.dataset.variant = variant;
        }

        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('app-alert-open');

        return new Promise((resolve) => {
            if (typeof activeResolve === 'function') {
                activeResolve();
            }
            activeResolve = resolve;

            const onKeyDown = (event) => {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    closeAppAlert();
                }
            };

            const onBackdropClick = (event) => {
                if (event.target === modal) {
                    closeAppAlert();
                }
            };

            const cleanup = () => {
                document.removeEventListener('keydown', onKeyDown);
                modal.removeEventListener('click', onBackdropClick);
                if (okBtn) {
                    okBtn.removeEventListener('click', onOk);
                }
            };

            const onOk = () => {
                cleanup();
                closeAppAlert();
            };

            document.addEventListener('keydown', onKeyDown);
            modal.addEventListener('click', onBackdropClick);
            if (okBtn) {
                okBtn.addEventListener('click', onOk);
                setTimeout(() => {
                    try {
                        okBtn.focus({ preventScroll: true });
                    } catch (_error) {
                        okBtn.focus();
                    }
                }, 0);
            }
        });
    }

    global.showAppAlert = showAppAlert;
    global.closeAppAlert = closeAppAlert;
    global.showInlineValidationNotice = showInlineValidationNotice;
    global.clearInlineValidationNotice = clearInlineValidationNotice;
})(typeof window !== 'undefined' ? window : globalThis);
