/** Diagnostics: `?at_debug=1` (session), `localStorage.setItem('anytransport_debug','1')`, or `window.ANYTRANSPORT_DEBUG = true`. */
(function () {
    window.anytransportIsDebug = function anytransportIsDebug() {
        try {
            if (window.ANYTRANSPORT_DEBUG === true) return true;
            if (String(window.ANYTRANSPORT_DEBUG || '') === '1') return true;
            if (typeof localStorage !== 'undefined' && localStorage.getItem('anytransport_debug') === '1') return true;
            if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('anytransport_debug') === '1') return true;
            return new URLSearchParams(window.location.search || '').get('at_debug') === '1';
        } catch (_e) {
            return false;
        }
    };
    try {
        if (new URLSearchParams(window.location.search || '').get('at_debug') === '1' && typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('anytransport_debug', '1');
        }
    } catch (_e) {}
    if (window.anytransportIsDebug()) {
        try {
            console.info(
                '[AnyTransport] Verbose client debug on. Set localStorage anytransport_debug=1, or ANYTRANSPORT_DEBUG, or use ?at_debug=1 on the URL.'
            );
        } catch (_e) {}
    }
})();

// Global page loader for slow refresh/navigation.
(function initAnyTransportGlobalPageLoader() {
    const STYLE_ID = 'anytransport-global-loader-style';
    const ROOT_ID = 'anytransport-global-loader';

    function ensureStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = [
            '#' + ROOT_ID + '{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.84);backdrop-filter:blur(2px);z-index:99999;opacity:0;visibility:hidden;transition:opacity .18s ease,visibility .18s ease;}',
            '#' + ROOT_ID + '.is-visible{opacity:1;visibility:visible;}',
            '#' + ROOT_ID + ' .anytransport-loader-ring{width:58px;height:58px;border-radius:999px;border:5px solid rgba(37,99,235,.22);border-top-color:#2563eb;animation:anytransportLoaderSpin .8s linear infinite;}',
            '@keyframes anytransportLoaderSpin{to{transform:rotate(360deg);}}'
        ].join('');
        document.head.appendChild(style);
    }

    function ensureRoot() {
        let root = document.getElementById(ROOT_ID);
        if (root) return root;
        root = document.createElement('div');
        root.id = ROOT_ID;
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '<div class="anytransport-loader-ring"></div>';
        document.body.appendChild(root);
        return root;
    }

    function setVisible(visible) {
        if (!document.body) return;
        ensureStyle();
        const root = ensureRoot();
        root.classList.toggle('is-visible', !!visible);
    }

    function hideWhenReady() {
        if (document.readyState === 'complete') {
            setVisible(false);
            return;
        }
        setVisible(true);
        window.addEventListener('load', function () {
            setVisible(false);
        }, { once: true });
    }

    window.anytransportShowPageLoader = function anytransportShowPageLoader() {
        setVisible(true);
    };
    window.anytransportHidePageLoader = function anytransportHidePageLoader() {
        setVisible(false);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hideWhenReady, { once: true });
    } else {
        hideWhenReady();
    }

    window.addEventListener('beforeunload', function () {
        setVisible(true);
    });
    window.addEventListener('pageshow', function () {
        setVisible(false);
    });
})();

// Authentication Management
window.anytransportApi = window.anytransportApi || (function () {
    const API_URL = resolveApiUrl();
    const TAB_SESSION_KEY = 'anytransport_session_token';
    window.ANYTRANSPORT_API_URL = API_URL;

    function getApiCandidates() {
        const configured = String(window.ANYTRANSPORT_API_URL || '').trim();
        const candidates = [];
        if (configured) {
            candidates.push(configured);
        }

        candidates.push('/api/index.php', '../api/index.php', '/api-external.php', 'api/index.php');

        const seen = new Set();
        return candidates.filter((candidate) => {
            if (!candidate || seen.has(candidate)) return false;
            seen.add(candidate);
            return true;
        });
    }

    function buildActionUrl(baseUrl, action, params) {
        const query = new URLSearchParams();
        query.set('action', action);
        if (params && typeof params === 'object') {
            Object.keys(params).forEach((key) => {
                const value = params[key];
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, String(value));
                }
            });
        }

        return baseUrl + (baseUrl.indexOf('?') >= 0 ? '&' : '?') + query.toString();
    }

    function isApiReachable(baseUrl) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', buildActionUrl(baseUrl, 'auth.me'), false);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.send(null);

            if (xhr.status < 200 || xhr.status >= 300) {
                return false;
            }

            const text = String(xhr.responseText || '').trim();
            if (!text || text.charAt(0) !== '{') {
                return false;
            }

            const payload = JSON.parse(text);
            return !!(payload && typeof payload === 'object');
        } catch (_error) {
            return false;
        }
    }

    function resolveApiUrl() {
        const candidates = getApiCandidates();
        for (let i = 0; i < candidates.length; i += 1) {
            if (isApiReachable(candidates[i])) {
                console.info('[AnyTransport API] Resolved to:', candidates[i]);
                return candidates[i];
            }
        }
        console.warn('[AnyTransport API] No candidate reached. Tried:', candidates);
        return '';
    }

    if (!API_URL) {
        console.warn('[AnyTransport API] No reachable API endpoint found.');
        return null;
    }

    function buildUrl(action, params) {
        return buildActionUrl(API_URL, action, params);
    }

    function parseResponse(xhr) {
        const text = String(xhr.responseText || '').trim();
        let payload = null;

        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (_error) {
                payload = { ok: false, error: text };
            }
        }

        if (xhr.status < 200 || xhr.status >= 300) {
            const message = payload && payload.error ? payload.error : ('Request failed with status ' + xhr.status);
            throw new Error(message);
        }

        if (payload && payload.ok === false) {
            throw new Error(payload.error || 'API request failed');
        }

        return payload || { ok: true };
    }

    function request(action, method, payload, params) {
        const xhr = new XMLHttpRequest();
        const url = buildUrl(action, params);
        const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
        const normalizedMethod = String(method || 'GET').toUpperCase();
        const heavyGetActions = {
            'quotes.list': true,
            'quotes.get': true,
            'identity.review.queue': true,
            'providers.search': true,
            'reports.list': true
        };
        const shouldShowLoaderForThisRequest =
            normalizedMethod !== 'GET' || !!heavyGetActions[String(action || '')];
        const shouldToggleLoader =
            action !== 'auth.me' &&
            action !== 'notifications.list' &&
            shouldShowLoaderForThisRequest &&
            typeof window.anytransportShowPageLoader === 'function' &&
            typeof window.anytransportHidePageLoader === 'function';
        let loaderDelayTimer = null;
        if (shouldToggleLoader) {
            loaderDelayTimer = window.setTimeout(function () {
                window.anytransportShowPageLoader();
            }, 200);
        }
        xhr.open(method, url, false);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');

        if (method !== 'GET') {
            xhr.setRequestHeader('Content-Type', 'application/json');
        }
        const sessionToken = getTabSessionToken();
        if (sessionToken) {
            xhr.setRequestHeader('X-Anytransport-Session', sessionToken);
        }

        try {
            xhr.send(method === 'GET' ? null : JSON.stringify(payload || {}));
        } catch (sendErr) {
            console.warn('[AnyTransport API]', action, method, 'send failed', sendErr && sendErr.message ? sendErr.message : sendErr);
            throw sendErr;
        }

        try {
            const result = parseResponse(xhr);
            if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                const ms = typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
                const keyHint =
                    payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.keys(payload) : [];
                console.debug('[AnyTransport API] ok', action, method, 'HTTP', xhr.status, ms + 'ms', keyHint.length ? { bodyKeys: keyHint } : '');
            }
            return result;
        } catch (err) {
            const snippet = String(xhr.responseText || '').trim().slice(0, 280);
            console.warn(
                '[AnyTransport API]',
                action,
                method,
                'HTTP',
                xhr.status,
                err && err.message ? err.message : err,
                snippet ? '| body:' + snippet : ''
            );
            if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                const keys =
                    payload && typeof payload === 'object' && !Array.isArray(payload) ? Object.keys(payload) : [];
                console.debug('[AnyTransport API] failed detail', {
                    action,
                    method,
                    url,
                    params: params || {},
                    postKeys: keys
                });
            }
            throw err;
        } finally {
            if (shouldToggleLoader) {
                if (loaderDelayTimer !== null) {
                    window.clearTimeout(loaderDelayTimer);
                }
                window.anytransportHidePageLoader();
            }
        }
    }

    function getTabSessionToken() {
        try {
            return typeof sessionStorage !== 'undefined' ? String(sessionStorage.getItem(TAB_SESSION_KEY) || '').trim() : '';
        } catch (_e) {
            return '';
        }
    }

    function setTabSessionToken(token) {
        const value = String(token || '').trim();
        try {
            if (typeof sessionStorage === 'undefined') return;
            if (value) sessionStorage.setItem(TAB_SESSION_KEY, value);
            else sessionStorage.removeItem(TAB_SESSION_KEY);
        } catch (_e) {}
    }

    return {
        isDebug: function () {
            return window.anytransportIsDebug && window.anytransportIsDebug();
        },
        getCurrentUser: function () {
            try {
                const response = request('auth.me', 'GET');
                return response && response.user ? response.user : null;
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getCurrentUser (auth.me) — no session or error', err);
                }
                return null;
            }
        },
        login: function (email, password) {
            const response = request('auth.login', 'POST', { email: email, password: password });
            if (response && response.sessionToken) {
                setTabSessionToken(response.sessionToken);
            }
            return response;
        },
        signup: function (formData) {
            const response = request('auth.signup', 'POST', { formData: formData || {} });
            if (response && response.sessionToken) {
                setTabSessionToken(response.sessionToken);
            }
            return response;
        },
        identityPhotosUpload: function (userId, photos) {
            return request('identity.photos.upload', 'POST', { userId: userId, photos: Array.isArray(photos) ? photos : [] });
        },
        startProviderStripeOnboarding: function (returnPath) {
            return request('stripe.provider.onboarding', 'POST', { returnPath: returnPath || 'dashboard.html' });
        },
        sendProviderStripeVerificationEmail: function (returnPath) {
            return request('stripe.provider.verification.email', 'POST', { returnPath: returnPath || 'dashboard.html' });
        },
        logout: function () {
            const response = request('auth.logout', 'POST', {});
            setTabSessionToken('');
            return response;
        },
        getUsers: function () {
            try {
                const response = request('users.list', 'GET');
                return Array.isArray(response.users) ? response.users : [];
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getUsers — empty (common if 401 / not admin list)', err);
                }
                return [];
            }
        },
        getUserById: function (userId) {
            const id = String(userId || '').trim();
            if (!id) {
                return null;
            }
            try {
                const response = request('users.get', 'GET', null, { id: id });
                return response && response.user ? response.user : null;
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getUserById failed', id, err);
                }
                return null;
            }
        },
        getIdentityReviewQueue: function () {
            const response = request('identity.review.queue', 'GET');
            return Array.isArray(response.providers) ? response.providers : [];
        },
        updateIdentityReview: function (providerId, status, notes) {
            return request('identity.review.update', 'POST', {
                providerId: providerId,
                status: status,
                notes: notes || ''
            });
        },
        replaceUsers: function (users) {
            const response = request('users.replaceAll', 'POST', { users: Array.isArray(users) ? users : [] });
            return Array.isArray(response.users) ? response.users : [];
        },
        saveUser: function (user) {
            const response = request('users.upsert', 'POST', { user: user || {} });
            return response.user || user || null;
        },
        updateAccountSettings: function (payload) {
            const response = request('users.account.update', 'POST', payload || {});
            return response.user || null;
        },
        getQuotes: function (userId, options) {
            try {
                const params = {};
                if (userId) {
                    params.userId = userId;
                }
                if (options && typeof options === 'object' && options.scope) {
                    params.scope = String(options.scope);
                }
                const response = request('quotes.list', 'GET', null, params);
                return Array.isArray(response.quotes) ? response.quotes : [];
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getQuotes — empty (often 401 / session)', err);
                }
                return [];
            }
        },
        getQuote: function (quoteId) {
            const id = String(quoteId || '').trim();
            if (!id) {
                return null;
            }
            try {
                const response = request('quotes.get', 'GET', null, { id: id });
                return response && response.quote ? response.quote : null;
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getQuote failed', id, err);
                }
                return null;
            }
        },
        getQuoteByFormId: function (formId) {
            const id = String(formId || '').trim();
            if (!id) {
                return null;
            }
            try {
                const response = request('quotes.get', 'GET', null, { formId: id });
                return response && response.quote ? response.quote : null;
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getQuoteByFormId failed', id, err);
                }
                return null;
            }
        },
        searchProviders: function (lat, lng, options) {
            const opts = options && typeof options === 'object' ? options : {};
            const response = request('providers.search', 'GET', null, {
                lat: String(lat),
                lng: String(lng),
                maxKm: opts.maxKm != null ? String(opts.maxKm) : '100',
                category: opts.category ? String(opts.category) : ''
            });
            return Array.isArray(response.providers) ? response.providers : [];
        },
        inviteProviderToQuote: function (quoteId, providerId, searchContext) {
            const ctx = searchContext && typeof searchContext === 'object' ? searchContext : {};
            return request('invites.create', 'POST', {
                quoteId: quoteId ? String(quoteId) : '',
                providerId: providerId ? String(providerId) : '',
                lat: ctx.lat != null ? ctx.lat : 0,
                lng: ctx.lng != null ? ctx.lng : 0,
                maxKm: ctx.maxKm != null ? ctx.maxKm : 100
            });
        },
        markQuoteFormComplete: function (quoteId) {
            const response = request('quotes.markComplete', 'POST', {
                quoteId: quoteId ? String(quoteId) : ''
            });
            return response && response.quote ? response.quote : null;
        },
        revertQuoteFormComplete: function (quoteId) {
            const response = request('quotes.revertComplete', 'POST', {
                quoteId: quoteId ? String(quoteId) : ''
            });
            return response && response.quote ? response.quote : null;
        },
        saveProviderReview: function (providerId, quoteId, rating, text) {
            const response = request('reviews.create', 'POST', {
                providerId: providerId ? String(providerId) : '',
                quoteId: quoteId ? String(quoteId) : '',
                rating: Number(rating) || 0,
                text: text ? String(text) : ''
            });
            return response || null;
        },
        listProviderReviews: function (providerId, quoteId) {
            const params = { providerId: providerId ? String(providerId) : '' };
            if (quoteId) {
                params.quoteId = String(quoteId);
            }
            return request('reviews.list', 'GET', null, params);
        },
        getProviderPublicProfile: function (providerId) {
            const id = String(providerId || '').trim();
            if (!id) {
                return null;
            }
            return request('providers.publicProfile', 'GET', null, { providerId: id });
        },
        saveQuote: function (quote, options) {
            const payload = { quote: quote || {} };
            const opts = options && typeof options === 'object' ? options : {};
            if (opts.ownerEmail) {
                payload.ownerEmail = String(opts.ownerEmail);
            }
            if (opts.ownerUserId) {
                payload.ownerUserId = String(opts.ownerUserId);
            }
            const response = request('quotes.create', 'POST', payload);
            return response.quote || quote || null;
        },
        duplicateQuoteAsAdmin: function (sourceQuoteId, options) {
            const opts = options && typeof options === 'object' ? options : {};
            return request('quotes.admin.duplicate', 'POST', {
                sourceQuoteId: sourceQuoteId ? String(sourceQuoteId) : '',
                ownerEmail: opts.ownerEmail ? String(opts.ownerEmail) : '',
                ownerUserId: opts.ownerUserId ? String(opts.ownerUserId) : ''
            });
        },
        deleteQuote: function (quoteId, options) {
            const payload = { quoteId: quoteId ? String(quoteId) : '' };
            if (options && typeof options === 'object' && options.reason) {
                payload.reason = String(options.reason);
            }
            return request('quotes.delete', 'POST', payload);
        },
        notifyQuoteOwner: function (quoteId, reason) {
            return request('quotes.admin.notify', 'POST', { quoteId: quoteId ? String(quoteId) : '', reason: reason || '' });
        },
        uploadQuoteMedia: function (dataUrl, quoteId) {
            const response = request('quotes.uploadMedia', 'POST', {
                dataUrl: dataUrl || '',
                quoteId: quoteId ? String(quoteId) : ''
            });
            return response.media || null;
        },
        getBids: function (quoteId) {
            const response = request('bids.list', 'GET', null, { quoteId: quoteId });
            return Array.isArray(response.bids) ? response.bids : [];
        },
        saveBid: function (bid) {
            const response = request('bids.create', 'POST', { bid: bid || {} });
            return response.bid || bid || null;
        },
        getAutoBidEvents: function (quoteId) {
            try {
                const params = quoteId ? { quoteId: String(quoteId) } : {};
                const response = request('autobid.events.list', 'GET', null, params);
                return Array.isArray(response.events) ? response.events : [];
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getAutoBidEvents failed', err);
                }
                return [];
            }
        },
        createFormReport: function (payload) {
            const response = request('reports.create', 'POST', payload || {});
            return response.report || null;
        },
        getFormReports: function (status) {
            const response = request('reports.list', 'GET', null, status ? { status: status } : {});
            return Array.isArray(response.reports) ? response.reports : [];
        },
        updateFormReport: function (reportId, status) {
            const response = request('reports.update', 'POST', {
                reportId: reportId ? String(reportId) : '',
                status: status ? String(status) : ''
            });
            return response.report || null;
        },
        sendMessage: function (fromUserId, toUserId, text, title) {
            const message = { fromUserId: fromUserId, toUserId: toUserId, text: text, title: title };
            const response = request('messages.save', 'POST', { message: message });
            return response.message || null;
        },
        getConversation: function (participantA, participantB) {
            try {
                const response = request('messages.list', 'GET', null, { participantA: participantA, participantB: participantB });
                return Array.isArray(response.messages) ? response.messages : [];
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getConversation failed', { participantA, participantB }, err);
                }
                return [];
            }
        },
        resolveMessageReplyToken: function (token) {
            const cleanToken = String(token || '').trim();
            if (!cleanToken) return null;
            const response = request('messages.replyContext', 'GET', null, { token: cleanToken });
            return response && response.context ? response.context : null;
        },
        replaceAllBids: function (bids) {
            const response = request('bids.replaceAll', 'POST', { bids: Array.isArray(bids) ? bids : [] });
            return Array.isArray(response.bids) ? response.bids : [];
        },
        getSavedMessages: function (userId) {
            try {
                const response = request('messages.list', 'GET', null, { userId: userId });
                return Array.isArray(response.messages) ? response.messages : [];
            } catch (err) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport API] getSavedMessages failed', userId, err);
                }
                return [];
            }
        },
        saveSavedMessage: function (userId, message) {
            const response = request('messages.save', 'POST', { userId: userId, message: message || {} });
            return response.message || message || null;
        },
        deleteSavedMessage: function (userId, messageId) {
            return request('messages.delete', 'POST', { userId: userId, messageId: messageId });
        },
        getNotifications: function (userId) {
            const response = request('notifications.list', 'GET', null, { userId: userId });
            return Array.isArray(response.notifications) ? response.notifications : [];
        },
        addNotification: function (userId, notification) {
            const response = request('notifications.add', 'POST', { userId: userId, notification: notification || {} });
            return response.notification || notification || null;
        },
        markNotificationAsRead: function (userId, notificationId) {
            return request('notifications.read', 'POST', { userId: userId, notificationId: notificationId });
        },
        clearNotifications: function (userId) {
            return request('notifications.clear', 'POST', { userId: userId });
        }
    };
})();

class AuthManager {
    constructor() {
        this.usersStorageKey = 'anytransport_users';
        this.currentUserStorageKey = 'anytransport_user';
        this.currentUser = this.loadUser();
        this.migrateStoredUsers();
        this.initAuth();
    }

    // Small UI helper to show a transient message (non-blocking)
    static showTransientMessage(text, duration = 4000) {
        try {
            const id = 'anytransport-transient-message';
            let node = document.getElementById(id);
            if (!node) {
                node = document.createElement('div');
                node.id = id;
                node.style.position = 'fixed';
                node.style.right = '16px';
                node.style.top = '16px';
                node.style.zIndex = '9999';
                document.body.appendChild(node);
            }
            const msg = document.createElement('div');
            msg.textContent = text;
            msg.style.background = '#0ea5e9';
            msg.style.color = '#fff';
            msg.style.padding = '10px 12px';
            msg.style.borderRadius = '8px';
            msg.style.boxShadow = '0 4px 12px rgba(2,6,23,0.08)';
            msg.style.marginTop = '8px';
            node.appendChild(msg);
            setTimeout(() => {
                try { msg.remove(); } catch (_e) {}
            }, duration);
        } catch (_e) {}
    }

    normalizeUsername(value) {
        return String(value || '').trim().toLowerCase();
    }

    getUsernameCandidate(user) {
        return String(
            user?.username ||
            user?.nickname ||
            user?.displayName ||
            user?.handle ||
            user?.name ||
            user?.email ||
            'User'
        ).trim();
    }

    makeUniqueUsername(baseUsername, users, excludeUserId = null) {
        const existingUsers = Array.isArray(users) ? users : [];
        const sanitizedBase = String(baseUsername || 'User')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '') || 'User';

        let candidate = sanitizedBase;
        let suffix = 1;

        while (existingUsers.some((entry) => {
            if (excludeUserId && entry.id === excludeUserId) return false;
            return this.normalizeUsername(entry.username) === this.normalizeUsername(candidate);
        })) {
            candidate = sanitizedBase + suffix;
            suffix += 1;
        }

        return candidate;
    }

    normalizeUserRecord(user, users = []) {
        const normalized = { ...user };
        const fallbackUsername = this.getUsernameCandidate(normalized);
        const bootstrapAdmin = String(normalized.email || '').trim().toLowerCase() === 'admin@example.com' || String(normalized.username || '').trim().toLowerCase() === 'admin';

        if (bootstrapAdmin && !normalized.role) {
            normalized.role = 'admin';
        }

        if (bootstrapAdmin && !Array.isArray(normalized.roles)) {
            normalized.roles = ['admin'];
        }

        if (!normalized.username) {
            normalized.username = this.makeUniqueUsername(fallbackUsername, users, normalized.id || null);
        }

        if (!normalized.nickname) {
            normalized.nickname = normalized.username;
        }

        const roleKeysEarly = (Array.isArray(normalized.roles) ? normalized.roles : [normalized.role])
            .map((r) => String(r || '').trim().toLowerCase())
            .filter((r) => r !== '');
        const isProviderAccount = roleKeysEarly.includes('provider')
            || String(normalized.role || '').trim().toLowerCase() === 'provider';

        if (isProviderAccount && String(normalized.role || '').trim().toLowerCase() !== 'provider') {
            normalized.role = 'provider';
        }

        if (!normalized.identityReviewStatus) {
            normalized.identityReviewStatus = isProviderAccount ? 'pending_review' : 'not_required';
        }

        if (!Array.isArray(normalized.identityPhotos)) {
            normalized.identityPhotos = [];
        }

        if (!normalized.identityReviewSubmittedAt) {
            normalized.identityReviewSubmittedAt = '';
        }

        if (!normalized.identityReviewedAt) {
            normalized.identityReviewedAt = '';
        }

        if (!normalized.identityReviewedBy) {
            normalized.identityReviewedBy = '';
        }

        const roleKey = String(normalized.role || 'customer').trim().toLowerCase();
        if (!Array.isArray(normalized.roles) || !normalized.roles.length) {
            normalized.roles = roleKey === 'admin' ? ['admin'] : [roleKey || 'customer'];
        } else if (roleKey && !normalized.roles.some((r) => String(r || '').trim().toLowerCase() === roleKey)) {
            normalized.roles = normalized.roles.concat([roleKey]);
        }

        return normalized;
    }

    setStoredCurrentUser(user) {
        const serialized = JSON.stringify(user);
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(this.currentUserStorageKey, serialized);
            }
        } catch (_e) {}
        try {
            localStorage.setItem(this.currentUserStorageKey, serialized);
        } catch (_e) {}
    }

    clearStoredCurrentUser() {
        try {
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(this.currentUserStorageKey);
            }
        } catch (_e) {}
        try {
            localStorage.removeItem(this.currentUserStorageKey);
        } catch (_e) {}
    }

    getStoredCurrentUserRaw() {
        try {
            if (typeof sessionStorage !== 'undefined') {
                const tabScoped = sessionStorage.getItem(this.currentUserStorageKey);
                if (tabScoped) return tabScoped;
            }
        } catch (_e) {}
        try {
            return localStorage.getItem(this.currentUserStorageKey);
        } catch (_e) {
            return null;
        }
    }

    migrateStoredUsers() {
        const migratedKey = 'anytransport_users_migrated_username';
        if (localStorage.getItem(migratedKey) === 'true') {
            return;
        }

        const users = this.loadUsers();
        let changed = false;

        const migratedUsers = users.map((user) => {
            const normalizedUser = { ...user };
            if (!normalizedUser.username && normalizedUser.nickname) {
                normalizedUser.username = this.makeUniqueUsername(normalizedUser.nickname, users, normalizedUser.id || null);
                changed = true;
            }

            if (!normalizedUser.nickname && normalizedUser.username) {
                normalizedUser.nickname = normalizedUser.username;
                changed = true;
            }

            return normalizedUser;
        });

        if (changed) {
            this.saveUsers(migratedUsers);
        }

        if (this.currentUser) {
            this.currentUser = this.normalizeUserRecord(this.currentUser, migratedUsers);
            this.setStoredCurrentUser(this.currentUser);
        }

        localStorage.setItem(migratedKey, 'true');
    }

    isUsernameTaken(username, excludeUserId = null) {
        const normalizedUsername = this.normalizeUsername(username);
        if (!normalizedUsername) return false;

        return this.loadUsers().some((entry) => {
            if (excludeUserId && entry.id === excludeUserId) return false;
            return this.normalizeUsername(entry.username) === normalizedUsername;
        });
    }

    // Initialize authentication UI based on login state
    initAuth() {
        const authMenu = document.getElementById('auth-menu');
        const userMenu = document.getElementById('user-menu');

        if (this.currentUser) {
            if (authMenu) authMenu.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            this.refreshSessionUserFromServer();
            this.ensureNavbarAvatarDropdown();
            this.ensureNavbarHubNav();
            this.updateUserDisplay();
            this.wireNavbarDropdown();
            this.scheduleSyncNavigationForRole();
        } else {
            if (authMenu) authMenu.style.display = 'flex';
            if (authMenu) {
                authMenu.innerHTML = [
                    '<button class="btn btn-outline" type="button" onclick="openLoginModal()">Login</button>',
                    '<button class="btn btn-primary" type="button" onclick="openSignupModal(\'customer\')" style="margin-left: 8px;">Sign Up</button>'
                ].join('');
            }
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    isCustomer() {
        if (this.isAdmin()) {
            return false;
        }
        const roles = this.getNormalizedRoles();
        if (roles.includes('customer')) {
            return true;
        }
        if (String(this.currentUser && this.currentUser.role || '').trim().toLowerCase() === 'customer') {
            return true;
        }
        // Providers can also post and manage their own transport requests.
        if (this.isProvider()) {
            return true;
        }
        return false;
    }

    resolveHubNavHref(relativePath) {
        const path = String(relativePath || '').trim();
        if (!path) {
            return path;
        }
        const inSubdomain = String(window.location.pathname || '').indexOf('subdomain-dashboard') >= 0;
        if (!inSubdomain) {
            return path;
        }
        const file = path.split('?')[0].split('#')[0];
        const parentPages = {
            'find-providers.html': true,
            'provider-profile.html': true,
            'create-job.html': true,
            'index.html': true
        };
        if (parentPages[file]) {
            return '../' + path;
        }
        return path;
    }

    /**
     * Account links (Dashboard, Forms, etc.) live in the profile avatar dropdown.
     */
    scheduleSyncNavigationForRole() {
        const run = () => this.syncNavigationForRole();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    }

    ensureNavbarProfileMenu() {
        const userMenu = document.getElementById('user-menu');
        if (!userMenu) {
            return;
        }

        const hub = document.getElementById('navbar-hub-nav');
        if (hub) {
            hub.style.display = 'none';
            hub.setAttribute('aria-hidden', 'true');
        }

        let dropdownRoot = userMenu.querySelector('#navbar-avatar-dropdown');
        if (!dropdownRoot) {
            this.ensureNavbarAvatarDropdown();
            dropdownRoot = userMenu.querySelector('#navbar-avatar-dropdown');
        }
        if (!dropdownRoot) {
            return;
        }

        let menu = dropdownRoot.querySelector('.dropdown-menu');
        if (!menu) {
            return;
        }

        const profileMenuVersion = '4';
        const hasLegacyMenu = !!menu.querySelector(
            '.at-nav-provider-dashboard, #navbar-profile-link, .at-nav-my-requests, a[href="customer-dashboard.html"]:not([href*="?"])'
        ) || !menu.querySelector('.at-nav-hub-listings');
        if (menu.dataset.profileMenuVersion !== profileMenuVersion || hasLegacyMenu) {
            menu.innerHTML = [
                '<a href="dashboard.html" class="nav-item navbar-hub-link at-nav-hub-dashboard" id="navbar-hub-dashboard-link" role="menuitem">Provider dashboard</a>',
                '<a href="customer-dashboard.html?tab=forms&my-requests=1" class="nav-item navbar-hub-link at-nav-hub-forms" id="navbar-hub-forms-link" role="menuitem">Active listings</a>',
                '<a href="customer-dashboard.html?tab=forms" class="nav-item navbar-hub-link at-nav-hub-listings" id="navbar-hub-listings-link" role="menuitem">My Listings</a>',
                '<a href="customer-dashboard.html?tab=settings" class="nav-item navbar-hub-link at-nav-hub-settings" id="navbar-hub-settings-link" role="menuitem">Profile settings</a>',
                '<a href="messages.html" class="nav-item navbar-hub-link at-nav-hub-messages" id="navbar-hub-messages-link" role="menuitem">Messages</a>',
                '<a href="find-providers.html" class="nav-item navbar-hub-link at-nav-find-providers" id="navbar-find-providers-link" role="menuitem">Find providers</a>'
            ].join('');
            menu.dataset.profileMenuReady = '1';
            menu.dataset.profileMenuVersion = profileMenuVersion;
        }
    }

    ensureNavbarHubNav() {
        this.ensureNavbarProfileMenu();
    }

    syncNavigationForRole() {
        if (!this.currentUser) {
            const hub = document.getElementById('navbar-hub-nav');
            if (hub) {
                hub.style.display = 'none';
            }
            return;
        }

        this.ensureNavbarProfileMenu();

        const allowProviderDash = this.isProvider() || this.isAdmin();
        const allowCustomerHub = this.isCustomer();
        const uid = this.currentUser.id ? String(this.currentUser.id) : '';

        const dashboardHref = this.resolveHubNavHref('dashboard.html');
        const requestFormsHref = this.resolveHubNavHref('customer-dashboard.html?tab=forms&my-requests=1');
        const listingsHref = this.resolveHubNavHref('customer-dashboard.html?tab=forms');
        const settingsHref = allowProviderDash
            ? this.resolveHubNavHref('provider-profile.html?userId=' + encodeURIComponent(uid))
            : this.resolveHubNavHref('customer-dashboard.html?tab=settings');
        const messagesHref = this.resolveHubNavHref('messages.html');
        const findProvidersHref = this.resolveHubNavHref('find-providers.html');

        document.querySelectorAll('.at-nav-hub-dashboard, #navbar-hub-dashboard-link').forEach((el) => {
            el.href = dashboardHref;
            el.style.display = allowProviderDash ? '' : 'none';
        });
        document.querySelectorAll('.at-nav-hub-forms, #navbar-hub-forms-link').forEach((el) => {
            el.href = requestFormsHref;
            el.style.display = allowCustomerHub ? '' : 'none';
        });
        document.querySelectorAll('.at-nav-hub-listings, #navbar-hub-listings-link').forEach((el) => {
            el.href = listingsHref;
            el.style.display = allowCustomerHub ? '' : 'none';
        });
        document.querySelectorAll('.at-nav-hub-settings, #navbar-hub-settings-link').forEach((el) => {
            el.href = settingsHref;
            el.style.display = '';
        });
        const allowMessages = this.canProviderAccessMessages();
        document.querySelectorAll('.at-nav-hub-messages, #navbar-hub-messages-link').forEach((el) => {
            el.href = messagesHref;
            el.style.display = allowMessages ? '' : 'none';
            if (!allowMessages) {
                el.setAttribute('aria-hidden', 'true');
            } else {
                el.removeAttribute('aria-hidden');
            }
        });
        document.querySelectorAll('.at-nav-find-providers, #navbar-find-providers-link').forEach((el) => {
            el.href = findProvidersHref;
            el.style.display = allowCustomerHub ? '' : 'none';
        });

        document.querySelectorAll('.at-nav-provider-dashboard, .at-nav-my-requests, #navbar-profile-link, #provider-dashboard-link').forEach((el) => {
            el.style.display = 'none';
        });

        const avatarLink = document.getElementById('navbar-avatar-home-link');
        if (avatarLink) {
            avatarLink.href = allowProviderDash ? dashboardHref + '#provider-board' : listingsHref;
        }

        const path = String(window.location.pathname || '').toLowerCase();
        const search = String(window.location.search || '').toLowerCase();
        const tab = (() => {
            try {
                return String(new URLSearchParams(window.location.search || '').get('tab') || '').trim().toLowerCase();
            } catch (_e) {
                return '';
            }
        })();

        document.querySelectorAll('.navbar-hub-link, #navbar-avatar-dropdown .dropdown-menu .nav-item').forEach((link) => {
            link.classList.remove('is-active');
        });

        if (/dashboard\.html$/i.test(path)) {
            document.querySelectorAll('.at-nav-hub-dashboard').forEach((el) => el.classList.add('is-active'));
        } else if (/customer-dashboard\.html$/i.test(path)) {
            if (tab === 'settings') {
                document.querySelectorAll('.at-nav-hub-settings').forEach((el) => el.classList.add('is-active'));
            } else if (tab === 'inbox' || tab === 'messages') {
                document.querySelectorAll('.at-nav-hub-messages').forEach((el) => el.classList.add('is-active'));
            } else if (search.indexOf('my-requests=1') >= 0) {
                document.querySelectorAll('.at-nav-hub-forms').forEach((el) => el.classList.add('is-active'));
            } else {
                document.querySelectorAll('.at-nav-hub-listings').forEach((el) => el.classList.add('is-active'));
            }
        } else if (/messages\.html$/i.test(path)) {
            document.querySelectorAll('.at-nav-hub-messages').forEach((el) => el.classList.add('is-active'));
        } else if (/provider-profile\.html$/i.test(path)) {
            document.querySelectorAll('.at-nav-hub-settings').forEach((el) => el.classList.add('is-active'));
        } else if (/find-providers\.html$/i.test(path)) {
            document.querySelectorAll('.at-nav-find-providers').forEach((el) => el.classList.add('is-active'));
        }
    }

    ensureNavbarAvatarDropdown() {
        const userMenu = document.getElementById('user-menu');
        if (!userMenu || userMenu.querySelector('#navbar-avatar-dropdown')) return;

        const legacyAvatarLink = userMenu.querySelector('a[href="dashboard.html"]');
        if (!legacyAvatarLink) return;

        const dropdown = document.createElement('div');
        dropdown.className = 'nav-dropdown';
        dropdown.id = 'navbar-avatar-dropdown';
        dropdown.style.display = 'inline-block';
        dropdown.innerHTML = [
            '<button type="button" class="nav-toggle" aria-haspopup="true" aria-expanded="false">',
            '  <div class="navbar-avatar" id="navbar-user-avatar">U</div>',
            '</button>',
            '<div class="dropdown-menu" role="menu" aria-label="User menu" data-profile-menu-ready="1">',
            '  <a href="dashboard.html" class="nav-item navbar-hub-link at-nav-hub-dashboard" id="navbar-hub-dashboard-link" role="menuitem">Provider dashboard</a>',
            '  <a href="customer-dashboard.html?tab=forms&my-requests=1" class="nav-item navbar-hub-link at-nav-hub-forms" id="navbar-hub-forms-link" role="menuitem">Active listings</a>',
            '  <a href="customer-dashboard.html?tab=forms" class="nav-item navbar-hub-link at-nav-hub-listings" id="navbar-hub-listings-link" role="menuitem">My Listings</a>',
            '  <a href="customer-dashboard.html?tab=settings" class="nav-item navbar-hub-link at-nav-hub-settings" id="navbar-hub-settings-link" role="menuitem">Profile settings</a>',
            '  <a href="messages.html" class="nav-item navbar-hub-link at-nav-hub-messages" id="navbar-hub-messages-link" role="menuitem">Messages</a>',
            '  <a href="find-providers.html" class="nav-item navbar-hub-link at-nav-find-providers" id="navbar-find-providers-link" role="menuitem">Find providers</a>',
            '</div>'
        ].join('');

        legacyAvatarLink.replaceWith(dropdown);
    }

    wireNavbarDropdown() {
        if (this._navbarDropdownWired) return;
        this._navbarDropdownWired = true;

        document.addEventListener('click', (event) => {
            const toggle = event.target.closest('.nav-dropdown .nav-toggle');
            if (toggle) {
                event.preventDefault();
                event.stopPropagation();
                const dropdown = toggle.closest('.nav-dropdown');
                if (!dropdown) return;
                const isOpen = dropdown.classList.toggle('open');
                toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
                return;
            }

            if (!event.target.closest('.nav-dropdown')) {
                document.querySelectorAll('.nav-dropdown.open').forEach((node) => {
                    node.classList.remove('open');
                    const button = node.querySelector('.nav-toggle');
                    if (button) button.setAttribute('aria-expanded', 'false');
                });
            }
        });
    }

    // Update user display in navbar
    updateUserDisplay() {
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const navbarUserName = document.getElementById('navbar-user-name');
        const navbarUserAvatar = document.getElementById('navbar-user-avatar');
        const displayName = this.currentUser?.username || this.currentUser?.nickname || this.currentUser?.displayName || this.currentUser?.name || 'User';

        if (userName) userName.textContent = displayName;
        if (userEmail) userEmail.textContent = this.currentUser.email || '';
        if (navbarUserName) navbarUserName.textContent = displayName || 'Profile';
        if (navbarUserAvatar && displayName) {
            navbarUserAvatar.textContent = displayName.charAt(0).toUpperCase();
        }
        this.syncNavigationForRole();
    }

    // Login user
    login(email, password) {
        let user;
        if (window.anytransportApi) {
            const response = window.anytransportApi.login(email, password);
            user = response && response.user ? this.normalizeUserRecord(response.user, this.loadUsers()) : null;
            if (!user) {
                throw new Error((response && response.error) || 'Unable to log in.');
            }
        } else {
            const users = this.loadUsers();
            const normalizedEmail = String(email || '').trim().toLowerCase();
            const existingUser = users.find((entry) => {
                return String(entry.email || '').trim().toLowerCase() === normalizedEmail
                    && String(entry.password || '') === String(password || '');
            });

            if (existingUser) {
                user = this.normalizeUserRecord(existingUser, users);
            } else {
                const derivedUsername = this.makeUniqueUsername(String(email || '').split('@')[0] || 'User', users);
                user = {
                    id: Math.random().toString(36).substr(2, 9),
                    email: String(email || '').trim(),
                    password: password,
                    name: String(email || '').split('@')[0] || 'User',
                    username: derivedUsername,
                    nickname: derivedUsername,
                    role: 'customer',
                    phone: '',
                    city: '',
                    createdAt: new Date().toISOString()
                };
                users.push(user);
                this.saveUsers(users);
            }
        }

        this.currentUser = user;
        this.saveUser(user);
        this.initAuth();
        return user;
    }

    // Sign up user
    signup(formData) {
        let user;
        let stripeVerification = null;
        if (window.anytransportApi) {
            const response = window.anytransportApi.signup(formData || {});
            user = response && response.user ? this.normalizeUserRecord(response.user, this.loadUsers()) : null;
            stripeVerification = response && response.stripeVerification ? response.stripeVerification : null;
            if (!user) {
                throw new Error((response && response.error) || 'Unable to create your account.');
            }
        } else {
            const users = this.loadUsers();
            const normalizedEmail = String(formData.email || '').trim().toLowerCase();
            const emailExists = users.some((entry) => String(entry.email || '').trim().toLowerCase() === normalizedEmail);
            if (emailExists) {
                throw new Error('An account with this email already exists. Please log in instead.');
            }

            const requestedUsername = String(formData.username || formData.nickname || formData.name || '').trim();
            if (!requestedUsername) {
                throw new Error('Please enter a username.');
            }

            if (this.isUsernameTaken(requestedUsername)) {
                throw new Error('That username is already in use. Please choose another one.');
            }

            user = {
                id: Math.random().toString(36).substr(2, 9),
                name: formData.name,
                username: requestedUsername,
                nickname: requestedUsername,
                email: formData.email,
                password: formData.password,
                phone: formData.contact || formData.phone || '',
                contact: formData.contact || formData.phone || '',
                city: formData.city || '',
                role: formData.role || 'customer',
                createdAt: new Date().toISOString()
            };

            users.push(user);
            this.saveUsers(users);
        }

        this.currentUser = user;
        this.saveUser(user);
        this.initAuth();
        return { user: user, stripeVerification: stripeVerification };
    }

    // Logout user
    logout() {
        this.currentUser = null;
        if (window.anytransportApi) {
            try {
                window.anytransportApi.logout();
            } catch (_error) {
                // Ignore logout sync failures.
            }
        }
        this.clearStoredCurrentUser();
        this.initAuth();
        window.location.href = 'index.html';
    }

    mergeUserIntoLocalCache(user) {
        const merged = this.normalizeUserRecord(user || {}, this.loadUsers());
        if (!merged || !merged.id) {
            return merged;
        }

        const users = this.loadUsers();
        const index = users.findIndex((entry) => entry && entry.id === merged.id);
        if (index >= 0) {
            users[index] = { ...users[index], ...merged };
        } else {
            users.push({ ...merged });
        }

        try {
            localStorage.setItem(this.usersStorageKey, JSON.stringify(users));
        } catch (_error) {}

        return merged;
    }

    // Save user to localStorage
    saveUser(user) {
        const users = this.loadUsers();
        const targetEmail = String(user.email || '').trim().toLowerCase();
        const targetId = user.id;
        const normalizedUser = this.normalizeUserRecord(user, users);

        // When a server API is available, let the server enforce username uniqueness
        // because the server has authoritative user data and may already contain
        // legitimate entries that cause false positives locally.
        if (!window.anytransportApi) {
            if (this.isUsernameTaken(normalizedUser.username, targetId)) {
                throw new Error('That username is already in use. Please choose another one.');
            }
        }

        if (window.anytransportApi) {
            const savedUser = window.anytransportApi.saveUser(normalizedUser);
            const merged = savedUser && savedUser.id
                ? this.normalizeUserRecord({ ...normalizedUser, ...savedUser }, users)
                : normalizedUser;
            this.mergeUserIntoLocalCache(merged);
            this.currentUser = merged;
            this.setStoredCurrentUser(merged);
            this.initAuth();
            return;
        }

        const index = users.findIndex((entry) => {
            if (targetId && entry.id === targetId) return true;
            return String(entry.email || '').trim().toLowerCase() === targetEmail;
        });

        if (index >= 0) {
            users[index] = { ...users[index], ...normalizedUser };
        } else {
            users.push({ ...normalizedUser });
        }

        this.saveUsers(users);
        this.currentUser = normalizedUser;
        this.setStoredCurrentUser(normalizedUser);
        this.initAuth();
    }

    // Load user from localStorage
    loadUser() {
        if (window.anytransportApi) {
            const serverUser = window.anytransportApi.getCurrentUser();
            if (serverUser && serverUser.id) {
                return this.normalizeUserRecord(serverUser, this.loadUsers());
            }
            // API is available but no valid server session: do not trust stale localStorage user.
            try {
                this.clearStoredCurrentUser();
            } catch (_e) {}
            return null;
        }

        const userData = this.getStoredCurrentUserRaw();
        if (!userData) return null;

        try {
            return this.normalizeUserRecord(JSON.parse(userData), this.loadUsers());
        } catch (_error) {
            return null;
        }
    }

    loadUsers() {
        if (window.anytransportApi) {
            try {
                const serverUsers = window.anytransportApi.getUsers();
                if (Array.isArray(serverUsers) && serverUsers.length > 0) {
                    const normalizedServerUsers = [];
                    serverUsers.forEach((user) => {
                        normalizedServerUsers.push(this.normalizeUserRecord(user, normalizedServerUsers));
                    });
                    return normalizedServerUsers;
                }

                const cachedRaw = JSON.parse(localStorage.getItem(this.usersStorageKey) || '[]');
                if (Array.isArray(cachedRaw) && cachedRaw.length > 0) {
                    const normalizedCachedUsers = [];
                    cachedRaw.forEach((user) => {
                        normalizedCachedUsers.push(this.normalizeUserRecord(user, normalizedCachedUsers));
                    });
                    if (this.isAdmin && this.isAdmin()) {
                        try {
                            window.anytransportApi.replaceUsers(normalizedCachedUsers);
                        } catch (e) {
                            if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                                console.debug('[AnyTransport] replaceUsers (cached migration) failed', e);
                            }
                        }
                    }
                    return normalizedCachedUsers;
                }
            } catch (error) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport] loadUsers server branch failed, using local fallback', error);
                }
            }
        }

        try {
            const raw = JSON.parse(localStorage.getItem(this.usersStorageKey) || '[]');
            if (!Array.isArray(raw)) return [];

            const users = [];
            raw.forEach((user) => {
                users.push(this.normalizeUserRecord(user, users));
            });
            return users;
        } catch (_error) {
            return [];
        }
    }

    saveUsers(users) {
        if (window.anytransportApi) {
            try {
                const list = Array.isArray(users) ? users : [];
                if (this.isAdmin && this.isAdmin()) {
                    window.anytransportApi.replaceUsers(list);
                    return;
                }
                const self =
                    this.currentUser && this.currentUser.id
                        ? list.find((u) => u && u.id === this.currentUser.id)
                        : null;
                if (self) {
                    window.anytransportApi.saveUser(self);
                }
                return;
            } catch (error) {
                if (window.anytransportIsDebug && window.anytransportIsDebug()) {
                    console.debug('[AnyTransport] saveUsers API path failed, writing localStorage only', error);
                }
            }
        }

        localStorage.setItem(this.usersStorageKey, JSON.stringify(users));
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getUser() {
        return this.currentUser;
    }

    getNormalizedRoles() {
        const user = this.currentUser || {};
        const rawRoles = Array.isArray(user.roles) ? user.roles : [user.role];
        return rawRoles
            .map((role) => String(role || '').trim().toLowerCase())
            .filter((role) => role !== '');
    }

    // Check if user is provider
    isProvider() {
        const user = this.currentUser;
        if (!user) {
            return false;
        }
        if (this.getNormalizedRoles().includes('provider')) {
            return true;
        }
        if (String(user.role || '').trim().toLowerCase() === 'provider') {
            return true;
        }
        const review = String(user.identityReviewStatus || '').trim().toLowerCase();
        return review === 'pending_review' || review === 'approved' || review === 'rejected';
    }

    resolveDefaultHomeHref() {
        if (this.isAdmin()) {
            return this.resolveHubNavHref('dashboard.html#verification-review');
        }
        if (this.isProvider()) {
            return this.resolveHubNavHref('dashboard.html#provider-board');
        }
        return this.resolveHubNavHref('customer-dashboard.html?tab=forms');
    }

    shouldRedirectProviderFromCustomerDashboard() {
        if (!this.isProvider() || this.isAdmin()) {
            return false;
        }
        try {
            const params = new URLSearchParams(window.location.search || '');
            return params.get('my-requests') !== '1';
        } catch (_e) {
            return true;
        }
    }

    guardProviderDashboardPage() {
        if (!this.isLoggedIn()) {
            return;
        }
        this.refreshSessionUserFromServer();
        if (this.isAdmin() || this.isProvider()) {
            return;
        }
        const target = this.resolveHubNavHref('customer-dashboard.html');
        const q = String(window.location.search || '');
        window.location.replace(target + q);
    }

    isProviderApproved(user) {
        const record = user || this.currentUser;
        if (!record) return false;
        const stripeComplete = String(record.stripeOnboardingStatus || '').trim().toLowerCase() === 'complete';
        const status = String(record.identityReviewStatus || '').trim().toLowerCase();
        if (status === 'approved' && stripeComplete) return true;
        const verified = record.verified;
        return stripeComplete && (verified === true || verified === 1 || verified === '1' || verified === 'true');
    }

    providerNeedsStripeVerification(user) {
        const record = user || this.currentUser;
        if (!record || !this.isProvider()) return false;
        const stripeStatus = String(record.stripeOnboardingStatus || '').trim().toLowerCase();
        return stripeStatus === '' || stripeStatus === 'not_started' || stripeStatus === 'pending';
    }

    providerNeedsAdminApproval(user) {
        const record = user || this.currentUser;
        if (!record || !this.isProvider()) return false;
        if (this.providerNeedsStripeVerification(record)) return false;
        return !this.isProviderApproved(record);
    }

    isProviderPendingReview(user) {
        const record = user || this.currentUser;
        if (!record) return false;
        if (!this.isProvider()) return false;
        if (this.isProviderApproved(record)) return false;
        const status = String(record.identityReviewStatus || '').trim().toLowerCase();
        if (status === 'rejected') return true;
        return status === '' || status === 'pending_review' || status === 'pending' || this.providerNeedsAdminApproval(record);
    }

    canProviderAccessMessages(user) {
        if (!this.isProvider()) return true;
        return !this.isProviderPendingReview(user);
    }

    refreshSessionUserFromServer() {
        if (!window.anytransportApi || typeof window.anytransportApi.getCurrentUser !== 'function') {
            return this.currentUser;
        }
        try {
            const serverUser = window.anytransportApi.getCurrentUser();
            if (serverUser && serverUser.id) {
                const merged = this.normalizeUserRecord(serverUser, this.loadUsers());
                this.mergeUserIntoLocalCache(merged);
                this.currentUser = merged;
                this.setStoredCurrentUser(merged);
            }
        } catch (_error) {
            // Keep existing session if refresh fails.
        }
        return this.currentUser;
    }

    isAdmin() {
        return this.getNormalizedRoles().includes('admin');
    }

    startProviderStripeOnboarding(returnPath) {
        if (!window.anytransportApi || typeof window.anytransportApi.startProviderStripeOnboarding !== 'function') {
            return { complete: true };
        }
        return window.anytransportApi.startProviderStripeOnboarding(returnPath);
    }
}

// Initialize auth manager
const auth = new AuthManager();
window.auth = auth;

// Modal Functions
function markCustomerQuoteAuthContext() {
    try {
        if (/create-job\.html/i.test(window.location.pathname || window.location.href || '')) {
            sessionStorage.setItem('anytransport_customer_quote_flow', '1');
        }
    } catch (_error) {
        // Ignore storage access issues.
    }
}

function getStoredAuthReturnUrl() {
    try {
        return String(sessionStorage.getItem('anytransport_auth_return_url') || '').trim();
    } catch (_error) {
        return '';
    }
}

function isCustomerQuoteAuthContext() {
    try {
        if (sessionStorage.getItem('anytransport_customer_quote_flow') === '1') {
            return true;
        }
    } catch (_error) {
        // Ignore storage access issues.
    }
    return /create-job\.html/i.test(getStoredAuthReturnUrl());
}

function clearCustomerQuoteAuthContext() {
    try {
        sessionStorage.removeItem('anytransport_customer_quote_flow');
    } catch (_error) {
        // Ignore storage access issues.
    }
}

/** Skip blocking Stripe Connect checks while finishing a listing on create-job. */
function shouldDeferProviderStripeOnboarding() {
    return isCustomerQuoteAuthContext();
}

function isSameDocumentUrl(a, b) {
    try {
        const left = new URL(String(a || ''), window.location.origin);
        const right = new URL(String(b || ''), window.location.origin);
        return left.origin === right.origin
            && left.pathname === right.pathname
            && left.search === right.search;
    } catch (_error) {
        return String(a || '').split('#')[0] === String(b || '').split('#')[0];
    }
}

function resumeAuthAfterLogin(currentUser) {
    const isAdmin = currentUser && (
        (Array.isArray(currentUser.roles) && currentUser.roles.includes('admin'))
        || String(currentUser.role || '').toLowerCase() === 'admin'
    );
    const pendingQuote = sessionStorage.getItem('pending_quote_submission') || localStorage.getItem('pending_quote_submission');
    const returnUrl = getStoredAuthReturnUrl();
    const inCustomerQuoteFlow = isCustomerQuoteAuthContext() || !!pendingQuote;

    if (pendingQuote) {
        sessionStorage.removeItem('pending_quote_submission');
        localStorage.removeItem('pending_quote_submission');
        clearCustomerQuoteAuthContext();
        sessionStorage.removeItem('anytransport_auth_return_url');
        if (typeof showConfirmationModal === 'function') {
            showConfirmationModal();
        }
        return true;
    }

    if (isAdmin) {
        clearCustomerQuoteAuthContext();
        sessionStorage.removeItem('anytransport_auth_return_url');
        window.location.href = auth.resolveHubNavHref('dashboard.html#verification-review');
        return true;
    }

    if (inCustomerQuoteFlow && returnUrl) {
        clearCustomerQuoteAuthContext();
        sessionStorage.removeItem('anytransport_auth_return_url');
        if (isSameDocumentUrl(window.location.href, returnUrl)) {
            if (typeof auth.syncNavigationForRole === 'function') {
                auth.syncNavigationForRole();
            }
            return true;
        }
        window.location.href = returnUrl;
        return true;
    }

    if (returnUrl) {
        clearCustomerQuoteAuthContext();
        sessionStorage.removeItem('anytransport_auth_return_url');
        window.location.href = returnUrl;
        return true;
    }

    return false;
}

function openLoginModal() {
    try {
        sessionStorage.setItem('anytransport_auth_return_url', window.location.href);
        markCustomerQuoteAuthContext();
    } catch (_error) {
        // Ignore storage access issues; auth flow still works with default redirect.
    }
    document.getElementById('login-modal').classList.add('show');
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.remove('show');
        // Hide notice when closing
        const notice = document.getElementById('login-modal-notice');
        if (notice) {
            notice.style.display = 'none';
        }
    }
}

function openSignupModal(role) {
    const modal = document.getElementById('signup-modal');
    if (!modal) {
        return;
    }

    const roleHidden = document.getElementById('signup-role');
    const title = document.getElementById('signup-modal-title');
    const modeNote = document.getElementById('signup-role-note');
    const identitySection = document.getElementById('provider-identity-section');
    const selectedRole = role === 'provider' ? 'provider' : 'customer';

    if (roleHidden) {
        roleHidden.value = selectedRole;
    }

    if (title) {
        title.textContent = selectedRole === 'provider' ? 'Transport Provider Sign Up' : 'Sign Up';
    }

    if (modeNote) {
        modeNote.textContent = selectedRole === 'provider'
            ? 'Provider account only'
            : 'Customer account signup';
    }

    if (identitySection) {
        identitySection.style.display = selectedRole === 'provider' ? 'block' : 'none';
    }

    const identityInputs = identitySection ? identitySection.querySelectorAll('input[name="identityPhotos"]') : [];
    identityInputs.forEach(function (input, index) {
        input.required = selectedRole === 'provider' && index === 0;
    });

    modal.setAttribute('data-signup-role', selectedRole);
    modal.classList.add('show');
}

function closeSignupModal() {
    const modal = document.getElementById('signup-modal');
    if (modal) {
        modal.classList.remove('show');
    }

    const roleHidden = document.getElementById('signup-role');
    const title = document.getElementById('signup-modal-title');
    const modeNote = document.getElementById('signup-role-note');
    const identitySection = document.getElementById('provider-identity-section');

    if (roleHidden) {
        roleHidden.value = 'customer';
    }

    if (title) {
        title.textContent = 'Sign Up';
    }

    if (modeNote) {
        modeNote.textContent = 'Customer account signup';
    }

    if (identitySection) {
        identitySection.style.display = 'none';
    }

    if (modal) {
        modal.setAttribute('data-signup-role', 'customer');
    }
}

function switchToSignup(role) {
    closeLoginModal();
    openSignupModal(role);
}

function switchToLogin() {
    closeSignupModal();
    openLoginModal();
}

function getProviderReturnPath() {
    const path = String(window.location.pathname || '/');
    if (/create-job\.html$/i.test(path)) {
        const search = String(window.location.search || '');
        const hash = String(window.location.hash || '');
        return path.replace(/^\//, '') + search + hash;
    }
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    return folder + 'dashboard.html';
}

function startProviderStripeOnboarding(user) {
    if (!user || String(user.role || '') !== 'provider') {
        return false;
    }
    if (shouldDeferProviderStripeOnboarding()) {
        return false;
    }

    try {
        const result = auth.startProviderStripeOnboarding(getProviderReturnPath());
        if (result && result.complete) {
            return false;
        }

        if (result && result.onboardingUrl) {
            window.location.href = result.onboardingUrl;
            return true;
        }

        try {
            AuthManager.showTransientMessage('Provider account created. Stripe onboarding is not available right now.');
        } catch (_e) {}
        return false;
    } catch (error) {
        const message = String(error && error.message ? error.message : '');
        const isStripeConfigIssue = /invalid api key|stripe is not configured|no such api key/i.test(message);
        if (isStripeConfigIssue) {
            try {
                AuthManager.showTransientMessage('Provider account created. Stripe setup is temporarily unavailable.');
            } catch (_e) {}
            return false;
        }
        alert('Unable to start Stripe verification right now. You can continue and try again later.');
        return false;
    }
    return false;
}

function getUserFromAuthResult(result) {
    if (!result || typeof result !== 'object') return null;
    if (result.user && typeof result.user === 'object') return result.user;
    return result;
}

// Handle Login Form Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = this.querySelector('input[type="email"]').value;
        const password = this.querySelector('input[type="password"]').value;

        if (email && password) {
            try {
                const loginResult = auth.login(email, password);
                let currentUser = getUserFromAuthResult(loginResult);

                if (currentUser && typeof auth.refreshSessionUserFromServer === 'function') {
                    currentUser = auth.refreshSessionUserFromServer() || currentUser;
                }

                closeLoginModal();

                if (resumeAuthAfterLogin(currentUser)) {
                    return;
                }

                if (currentUser && typeof auth.isProvider === 'function' && auth.isProvider() && !shouldDeferProviderStripeOnboarding()) {
                    window.location.href = auth.resolveDefaultHomeHref();
                    return;
                }
            } catch (error) {
                const message = error && error.message ? error.message : 'Unable to log in.';
                const notice = document.getElementById('login-modal-notice');
                if (notice) {
                    notice.textContent = message;
                    notice.style.display = 'block';
                } else {
                    alert(message);
                }
            }
        }
    });
}

const footerDriverLoginButton = document.querySelector('.footer-newsletter .btn-newsletter');
if (footerDriverLoginButton) {
    footerDriverLoginButton.addEventListener('click', function (event) {
        event.preventDefault();
        const footerBox = footerDriverLoginButton.closest('.footer-newsletter');
        const emailInput = footerBox ? footerBox.querySelector('input[type="email"]') : null;
        const passwordInput = footerBox ? footerBox.querySelector('input[type="password"]') : null;
        const email = String(emailInput && emailInput.value ? emailInput.value : '').trim();
        const password = String(passwordInput && passwordInput.value ? passwordInput.value : '');

        if (!email || !password) {
            alert('Please enter your email and password.');
            return;
        }

        try {
            const loginResult = auth.login(email, password);
            let currentUser = getUserFromAuthResult(loginResult);
            if (!currentUser) {
                alert('Unable to log in. Please try again.');
                return;
            }

            if (String(currentUser.role || '').toLowerCase() !== 'provider') {
                alert('This login is for transport providers. Please use the main login for customer accounts.');
                return;
            }

            if (typeof auth.refreshSessionUserFromServer === 'function') {
                currentUser = auth.refreshSessionUserFromServer() || currentUser;
            }
            window.location.href = 'dashboard.html#provider-board';
        } catch (error) {
            alert(error && error.message ? error.message : 'Unable to log in.');
        }
    });
}

// Handle Signup Form Submission
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const nameInput = this.querySelector('input[name="name"]');
        const emailInput = this.querySelector('#signup-email');
        const emailConfirmInput = this.querySelector('#signup-email-confirm');
        const contactInput = this.querySelector('#signup-contact');
        const passwordInput = this.querySelector('#signup-password');
        const passwordConfirmInput = this.querySelector('#signup-password-confirm');
        const roleInput = this.querySelector('#signup-role');
        const usernameInput = this.querySelector('input[name="username"]');
        const identityInputs = Array.from(this.querySelectorAll('input[name="identityPhotos"]'));

        const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
            reader.readAsDataURL(file);
        });

        const optimizeImageForUpload = async (file) => {
            const originalDataUrl = await readFileAsDataUrl(file);
            if (!/^image\//i.test(String(file && file.type || ''))) {
                return originalDataUrl;
            }

            try {
                const image = await new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('Unable to process image.'));
                    img.src = originalDataUrl;
                });

                const maxDimension = 1280;
                const scale = Math.min(1, maxDimension / Math.max(image.width || 1, image.height || 1));
                const width = Math.max(1, Math.round((image.width || 1) * scale));
                const height = Math.max(1, Math.round((image.height || 1) * scale));
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) return originalDataUrl;
                ctx.drawImage(image, 0, 0, width, height);

                const qualities = [0.82, 0.72, 0.62, 0.52];
                const maxChars = 900000;
                let candidate = originalDataUrl;
                for (const quality of qualities) {
                    const next = canvas.toDataURL('image/jpeg', quality);
                    candidate = next;
                    if (next.length <= maxChars) {
                        break;
                    }
                }
                return candidate.length < originalDataUrl.length ? candidate : originalDataUrl;
            } catch (_e) {
                return originalDataUrl;
            }
        };
        
        const formData = {
            name: nameInput.value,
            email: emailInput.value,
            emailConfirm: emailConfirmInput.value,
            contact: contactInput.value,
            password: passwordInput.value,
            confirmPassword: passwordConfirmInput.value,
            phone: contactInput.value,
            city: '',
            role: roleInput ? roleInput.value : 'customer',
            username: usernameInput ? usernameInput.value : '',
            nickname: usernameInput ? usernameInput.value : ''
        };

        let pendingIdentityPhotos = [];
        if (formData.role === 'provider') {
            const identityPhotos = [];
            for (const input of identityInputs) {
                const file = input && input.files && input.files[0] ? input.files[0] : null;
                if (!file) continue;
                if (file.size > 2 * 1024 * 1024) {
                    alert('Please keep each identity photo under 2MB.');
                    return;
                }
                const dataUrl = await optimizeImageForUpload(file);
                if (!dataUrl || dataUrl.length > 1200000) {
                    alert('One of your images is still too large after optimization. Please use a smaller image.');
                    return;
                }
                identityPhotos.push({
                    label: input.id || 'identity-photo',
                    name: file.name,
                    type: 'image/jpeg',
                    size: file.size,
                    dataUrl: dataUrl,
                    uploadedAt: new Date().toISOString()
                });
            }

            if (!identityPhotos.length) {
                alert('Please upload at least one ID photo (front) before signing up as a provider.');
                return;
            }

            pendingIdentityPhotos = identityPhotos;
            if (identityPhotos.length) {
                formData.identityPhotos = identityPhotos.map((entry) => ({
                    label: entry.label || 'identity-photo',
                    name: entry.name || entry.label || 'identity-photo',
                    type: entry.type || 'image/jpeg',
                    size: Number(entry.size || 0),
                    dataUrl: entry.dataUrl || '',
                    previewDataUrl: entry.dataUrl || '',
                    uploadedAt: entry.uploadedAt || new Date().toISOString()
                }));
            }
        }

        // Validate emails match
        if (formData.email !== formData.emailConfirm) {
            alert('Email addresses do not match. Please try again.');
            return;
        }

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match. Please try again.');
            return;
        }

        if (formData.name && formData.email && formData.password) {
            let currentUser = null;
            try {
                const signupResult = auth.signup(formData);
                currentUser = getUserFromAuthResult(signupResult);

                if (currentUser && String(currentUser.role || '') === 'provider') {
                    const stripeInfo = signupResult && signupResult.stripeVerification ? signupResult.stripeVerification : null;
                    const emailed = !!(stripeInfo && stripeInfo.emailed);
                    const stripeComplete = !!(stripeInfo && stripeInfo.complete);
                    let signupMessage = '';
                    if (stripeComplete && auth.isProviderApproved(currentUser)) {
                        signupMessage = 'Your provider account is verified. You can use the dashboard now.';
                    } else if (stripeComplete) {
                        signupMessage = 'Stripe verification received. Your ID photos are on file — an admin will review your account shortly.';
                    } else if (emailed) {
                        signupMessage = 'Account created. Your ID photos were sent to Stripe. Check your email (' + String(formData.email || '') + ') for the Stripe verification link.';
                    } else if (stripeInfo && stripeInfo.onboardingUrl) {
                        signupMessage = 'Account created. Stripe verification could not be emailed — use your dashboard to open the verification link.';
                    } else {
                        signupMessage = 'Account created. Stripe verification is not available right now; sign in to your dashboard to try again.';
                    }
                    try {
                        AuthManager.showTransientMessage(signupMessage);
                    } catch (_m) {
                        alert(signupMessage);
                    }
                }
            } catch (error) {
                alert(error && error.message ? error.message : 'Unable to sign up with this email.');
                return;
            }
            closeSignupModal();

            if (resumeAuthAfterLogin(currentUser)) {
                return;
            }

            if (currentUser && typeof auth.isProvider === 'function' && auth.isProvider() && !shouldDeferProviderStripeOnboarding()) {
                window.location.href = auth.resolveDefaultHomeHref();
                return;
            }
        } else {
            alert('Please fill in all required fields');
        }
    });
}

function initSignupRoleSelector() {
    const modal = document.getElementById('signup-modal');
    const roleHidden = document.getElementById('signup-role');
    if (!modal || !roleHidden) return;

    const roleButtons = Array.from(document.querySelectorAll('[data-signup-role]'));
    const title = document.getElementById('signup-modal-title');
    const modeNote = document.getElementById('signup-role-note');

    const applyRole = (value) => {
        const selected = value === 'provider' ? 'provider' : 'customer';
        roleHidden.value = selected;
        modal.setAttribute('data-signup-role', selected);

        if (title) {
            title.textContent = selected === 'provider' ? 'Transport Provider Sign Up' : 'Sign Up';
        }

        if (modeNote) {
            modeNote.textContent = selected === 'provider'
                ? 'Provider account only'
                : 'Customer account signup';
        }

        roleButtons.forEach((btn) => {
            const isActive = btn.getAttribute('data-signup-role') === selected;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    roleButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            applyRole(btn.getAttribute('data-signup-role') || 'customer');
        });
    });

    applyRole(modal.getAttribute('data-signup-role') || roleHidden.value || 'customer');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSignupRoleSelector, { once: true });
} else {
    initSignupRoleSelector();
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.logout();
    }
}

// Toggle password visibility
function togglePasswordVisibility(button) {
    const container = button.parentElement;
    const passwordInput = container.querySelector('input[type="password"], input[type="text"]');
    
    if (passwordInput) {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? 'Hide' : 'Show';
    }
}

// Close modals when clicking outside - track if mousedown started in content
let mouseDownInContent = false;

window.addEventListener('mousedown', function(event) {
    const modalContent = event.target.closest('.modal-content');
    mouseDownInContent = !!modalContent;
});

window.addEventListener('click', function(event) {
    // Only close if mousedown didn't start in modal content
    if (mouseDownInContent) {
        mouseDownInContent = false;
        return;
    }

    const loginModal = document.getElementById('login-modal');
    const signupModal = document.getElementById('signup-modal');
    const confirmationModal = document.getElementById('confirmation-modal');
    const jobDetailsModal = document.getElementById('job-details-modal');

    // Only close if clicking on the modal background itself, not content inside
    if (loginModal && event.target === loginModal) {
        closeLoginModal();
    }
    if (signupModal && event.target === signupModal) {
        closeSignupModal();
    }
    if (confirmationModal && event.target === confirmationModal) {
        closeConfirmationModal();
    }
    if (jobDetailsModal && event.target === jobDetailsModal) {
        closeJobDetails();
    }
});

// Protect pages that require authentication
function requireLogin() {
    if (!auth.isLoggedIn()) {
        alert('Please log in to access this page');
        window.location.href = 'index.html';
    }
}

// Run on page load for protected pages
if (document.body.classList.contains('protected')) {
    requireLogin();
}

function resolveMyListingsDashboardHref(formId) {
    const params = new URLSearchParams();
    params.set('tab', 'forms');
    params.set('my-requests', '1');
    const fid = String(formId || '').trim();
    if (fid) {
        params.set('highlightForm', fid);
    }
    const path = 'customer-dashboard.html?' + params.toString();
    if (typeof auth !== 'undefined' && auth && typeof auth.resolveHubNavHref === 'function') {
        return auth.resolveHubNavHref(path);
    }
    return path;
}

window.resolveMyListingsDashboardHref = resolveMyListingsDashboardHref;

// Confirmation Modal Functions
function showConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        const emailSpan = document.getElementById('confirmation-email');
        if (emailSpan) {
            const chosenEmail = String(window.anytransportQuoteContactEmail || '').trim();
            if (chosenEmail) {
                emailSpan.textContent = chosenEmail;
            } else if (auth.currentUser) {
                emailSpan.textContent = auth.currentUser.email;
            }
        }

        const formIdText = String(
            window.anytransportLastSubmittedFormId ||
            sessionStorage.getItem('pending_quote_form_id') ||
            localStorage.getItem('pending_quote_form_id') ||
            ''
        ).trim();
        const formIdLabel = document.getElementById('confirmation-form-id');
        if (formIdLabel) {
            if (formIdText) {
                formIdLabel.textContent = 'Listing ID: ' + formIdText;
                formIdLabel.style.display = 'block';
            } else {
                formIdLabel.textContent = '';
                formIdLabel.style.display = 'none';
            }
        }

        const dashboardBtn = document.getElementById('confirmation-view-dashboard-btn');
        if (dashboardBtn) {
            dashboardBtn.textContent = 'View my listings';
            const target = resolveMyListingsDashboardHref(formIdText);
            dashboardBtn.onclick = function () {
                window.location.href = target;
            };
        }

        modal.classList.add('show');
    }
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    window.anytransportQuoteContactEmail = '';
    window.anytransportLastSubmittedFormId = '';
}
