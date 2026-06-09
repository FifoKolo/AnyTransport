(function () {
    function getTokenFromUrl() {
        try {
            return String(new URLSearchParams(window.location.search).get('token') || '').trim();
        } catch (_e) {
            return '';
        }
    }

    function showStatus(message, isError) {
        const el = document.getElementById('reset-status');
        if (!el) return;
        el.textContent = message;
        el.hidden = !message;
        el.classList.toggle('reset-status--error', !!isError);
        el.classList.toggle('reset-status--ok', !isError);
    }

    function setFormEnabled(enabled) {
        const form = document.getElementById('reset-password-form');
        const btn = document.getElementById('reset-submit-btn');
        if (form) {
            Array.prototype.forEach.call(form.querySelectorAll('input, button'), function (node) {
                node.disabled = !enabled;
            });
        }
        if (btn) btn.disabled = !enabled;
    }

    function getProviderPasswordRequirementError(password) {
        if (window.anytransportApi && typeof window.anytransportApi.getProviderPasswordRequirementError === 'function') {
            return window.anytransportApi.getProviderPasswordRequirementError(password);
        }
        const value = String(password || '');
        if (value.length < 6) {
            return 'Password must be at least 6 characters.';
        }
        return '';
    }

    function init() {
        const token = getTokenFromUrl();
        const form = document.getElementById('reset-password-form');
        const intro = document.getElementById('reset-intro');
        let resetIsProvider = false;

        if (!token) {
            if (intro) intro.textContent = 'This reset link is missing or invalid.';
            setFormEnabled(false);
            showStatus('Request a new password reset link from the login page.', true);
            return;
        }

        if (!window.anytransportApi || typeof window.anytransportApi.validatePasswordResetToken !== 'function') {
            showStatus('Password reset is not available right now. Please try again later.', true);
            setFormEnabled(false);
            return;
        }

        try {
            const validateResp = window.anytransportApi.validatePasswordResetToken(token);
            resetIsProvider = !!(validateResp && validateResp.isProvider);
            if (resetIsProvider && intro) {
                intro.textContent = 'Choose a new provider password. It must be at least 6 characters long.';
            }
        } catch (error) {
            if (intro) intro.textContent = 'Unable to use this reset link.';
            setFormEnabled(false);
            showStatus(error && error.message ? error.message : 'This reset link is invalid or has expired.', true);
            return;
        }

        if (!form) return;

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            const password = String(document.getElementById('reset-password')?.value || '');
            const confirm = String(document.getElementById('reset-password-confirm')?.value || '');

            if (resetIsProvider) {
                const providerPasswordError = getProviderPasswordRequirementError(password);
                if (providerPasswordError) {
                    showStatus(providerPasswordError, true);
                    return;
                }
            } else if (password.length < 6) {
                showStatus('Password must be at least 6 characters.', true);
                return;
            }
            if (password !== confirm) {
                showStatus('Passwords do not match.', true);
                return;
            }

            if (!window.anytransportApi || typeof window.anytransportApi.resetPassword !== 'function') {
                showStatus('Password reset is not available right now.', true);
                return;
            }

            const btn = document.getElementById('reset-submit-btn');
            if (btn) btn.disabled = true;
            showStatus('Updating your password…', false);

            try {
                const resp = window.anytransportApi.resetPassword(token, password);
                setFormEnabled(false);
                showStatus((resp && resp.message) || 'Your password has been updated. You can log in now.', false);
                if (intro) intro.textContent = 'Password updated successfully.';
                const loginLink = document.getElementById('reset-back-login');
                if (loginLink) {
                    loginLink.textContent = 'Log in now';
                    loginLink.className = 'btn btn-primary';
                }
            } catch (error) {
                if (btn) btn.disabled = false;
                showStatus(error && error.message ? error.message : 'Unable to reset password.', true);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
