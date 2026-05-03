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

// Authentication Management
window.anytransportApi = window.anytransportApi || (function () {
    const API_URL = resolveApiUrl();
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
        if (window.anytransportIsDebug && window.anytransportIsDebug()) {
            console.warn('[AnyTransport API] No candidate reached. Tried:', candidates);
        }
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
        xhr.open(method, url, false);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');

        if (method !== 'GET') {
            xhr.setRequestHeader('Content-Type', 'application/json');
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
        }
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
            return request('auth.login', 'POST', { email: email, password: password });
        },
        signup: function (formData) {
            return request('auth.signup', 'POST', { formData: formData || {} });
        },
        identityPhotosUpload: function (userId, photos) {
            return request('identity.photos.upload', 'POST', { userId: userId, photos: Array.isArray(photos) ? photos : [] });
        },
        startProviderStripeOnboarding: function (returnPath) {
            return request('stripe.provider.onboarding', 'POST', { returnPath: returnPath || 'dashboard.html' });
        },
        logout: function () {
            return request('auth.logout', 'POST', {});
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
            const response = request('identity.review.update', 'POST', {
                providerId: providerId,
                status: status,
                notes: notes || ''
            });
            return response.provider || null;
        },
        replaceUsers: function (users) {
            const response = request('users.replaceAll', 'POST', { users: Array.isArray(users) ? users : [] });
            return Array.isArray(response.users) ? response.users : [];
        },
        saveUser: function (user) {
            const response = request('users.upsert', 'POST', { user: user || {} });
            return response.user || user || null;
        },
        getQuotes: function (userId) {
            try {
                const response = request('quotes.list', 'GET', null, userId ? { userId: userId } : {});
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
        saveQuote: function (quote) {
            const response = request('quotes.create', 'POST', { quote: quote || {} });
            return response.quote || quote || null;
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

        return normalized;
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
            localStorage.setItem('anytransport_user', JSON.stringify(this.currentUser));
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
            this.ensureNavbarAvatarDropdown();
            this.updateUserDisplay();
            this.wireNavbarDropdown();
            this.scheduleSyncNavigationForRole();
        } else {
            if (authMenu) authMenu.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    scheduleSyncNavigationForRole() {
        const run = () => this.syncNavigationForRole();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', run, { once: true });
        } else {
            run();
        }
    }

    syncNavigationForRole() {
        if (!this.currentUser) return;
        const allowProviderDash = this.isProvider() || this.isAdmin();

        document.querySelectorAll('.at-nav-provider-dashboard').forEach((el) => {
            el.style.display = allowProviderDash ? '' : 'none';
        });
        document.querySelectorAll('.at-nav-my-requests').forEach((el) => {
            el.style.display = allowProviderDash ? '' : 'none';
        });

        document.querySelectorAll('#navbar-profile-link').forEach((profileLink) => {
            if (allowProviderDash) {
                const uid = this.currentUser.id ? String(this.currentUser.id) : '';
                profileLink.href = 'provider-profile.html?userId=' + encodeURIComponent(uid);
                profileLink.textContent = 'Profile';
            } else {
                profileLink.href = 'customer-dashboard.html';
                profileLink.textContent = 'Profile';
            }
        });

        document.querySelectorAll('#provider-dashboard-link').forEach((el) => {
            el.style.display = allowProviderDash ? '' : 'none';
        });

        const avatarLink = document.getElementById('navbar-avatar-home-link');
        if (avatarLink) {
            avatarLink.href = allowProviderDash ? 'dashboard.html#provider-board' : 'customer-dashboard.html';
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
            '<div class="dropdown-menu" role="menu" aria-label="User menu">',
            '  <a href="customer-dashboard.html" class="nav-item at-nav-my-requests">My requests</a>',
            '  <a href="dashboard.html" class="nav-item at-nav-provider-dashboard">Dashboard</a>',
            '  <a id="navbar-profile-link" href="customer-dashboard.html" class="nav-item">Profile</a>',
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
        if (window.anytransportApi) {
            const response = window.anytransportApi.signup(formData || {});
            user = response && response.user ? this.normalizeUserRecord(response.user, this.loadUsers()) : null;
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
        return user;
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
        localStorage.removeItem('anytransport_user');
        this.initAuth();
        window.location.href = 'index.html';
    }

    // Save user to localStorage
    saveUser(user) {
        const users = this.loadUsers();
        const targetEmail = String(user.email || '').trim().toLowerCase();
        const targetId = user.id;
        const normalizedUser = this.normalizeUserRecord(user, users);

        // When a server API is available, let the server enforce username uniqueness
        // to avoid false-positives caused by duplicate entries in the store.
        if (!window.anytransportApi) {
            if (this.isUsernameTaken(normalizedUser.username, targetId)) {
                throw new Error('That username is already in use. Please choose another one.');
            }
        }

        if (window.anytransportApi) {
            // Avoid calling server users.upsert for users that already have an id
            // to prevent 409 conflicts. Only call API save for new users.
            if (!normalizedUser.id) {
                const savedUser = window.anytransportApi.saveUser(normalizedUser);
                if (savedUser && savedUser.id) {
                    this.currentUser = this.normalizeUserRecord(savedUser, users);
                    localStorage.setItem('anytransport_user', JSON.stringify(this.currentUser));
                    this.initAuth();
                    return;
                }
            } else {
                this.currentUser = normalizedUser;
                localStorage.setItem('anytransport_user', JSON.stringify(this.currentUser));
                this.initAuth();
                return;
            }
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
        localStorage.setItem('anytransport_user', JSON.stringify(normalizedUser));
        this.initAuth();
    }

    // Load user from localStorage
    loadUser() {
        if (window.anytransportApi) {
            const serverUser = window.anytransportApi.getCurrentUser();
            if (serverUser && serverUser.id) {
                return this.normalizeUserRecord(serverUser, this.loadUsers());
            }
        }

        const userData = localStorage.getItem('anytransport_user');
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
        return this.getNormalizedRoles().includes('provider');
    }

    // Check if user is customer
    isCustomer() {
        return this.getNormalizedRoles().includes('customer');
    }

    isAdmin() {
        return this.getNormalizedRoles().includes('admin');
    }
}

// Initialize auth manager
const auth = new AuthManager();
window.auth = auth;

// Modal Functions
function openLoginModal() {
    try {
        sessionStorage.setItem('anytransport_auth_return_url', window.location.href);
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

function openSignupModal() {
    document.getElementById('signup-modal').classList.add('show');
}

function closeSignupModal() {
    document.getElementById('signup-modal').classList.remove('show');
}

function switchToSignup() {
    closeLoginModal();
    openSignupModal();
}

function switchToLogin() {
    closeSignupModal();
    openLoginModal();
}

function getProviderReturnPath() {
    const path = String(window.location.pathname || '/');
    const folder = path.slice(0, path.lastIndexOf('/') + 1);
    return folder + 'dashboard.html';
}

function startProviderStripeOnboarding(user) {
    if (!user || String(user.role || '') !== 'provider') {
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

        alert('Stripe onboarding is not ready yet. Please try again or contact support.');
    } catch (error) {
        alert(error && error.message ? error.message : 'Unable to start Stripe verification.');
    }

    return true;
}

// Handle Login Form Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = this.querySelector('input[type="email"]').value;
        const password = this.querySelector('input[type="password"]').value;

        if (email && password) {
            const loginResult = auth.login(email, password);
            const currentUser = loginResult && loginResult.user ? loginResult.user : null;
            const isAdmin = currentUser && ((Array.isArray(currentUser.roles) && currentUser.roles.includes('admin')) || String(currentUser.role || '').toLowerCase() === 'admin');

            if (currentUser && String(currentUser.role || '') === 'provider') {
                if (startProviderStripeOnboarding(currentUser)) {
                    return;
                }
            }

            closeLoginModal();
            
            // Check if we're redirecting after form submission
            const pendingQuote = sessionStorage.getItem('pending_quote_submission') || localStorage.getItem('pending_quote_submission');
            if (pendingQuote) {
                sessionStorage.removeItem('pending_quote_submission');
                localStorage.removeItem('pending_quote_submission');
                showConfirmationModal();
            } else {
                if (isAdmin) {
                    sessionStorage.removeItem('anytransport_auth_return_url');
                    window.location.href = 'dashboard.html#verification-review';
                    return;
                }
                const returnUrl = sessionStorage.getItem('anytransport_auth_return_url');
                if (returnUrl) {
                    sessionStorage.removeItem('anytransport_auth_return_url');
                    window.location.href = returnUrl;
                    return;
                }
                // Stay on the current page so the landing page remains the default.
            }
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

        if (formData.role === 'provider') {
            const identityPhotos = [];
            for (const input of identityInputs) {
                const file = input && input.files && input.files[0] ? input.files[0] : null;
                if (!file) continue;
                if (file.size > 2 * 1024 * 1024) {
                    alert('Please keep each identity photo under 2MB.');
                    return;
                }
                const dataUrl = await readFileAsDataUrl(file);
                identityPhotos.push({
                    label: input.id || 'identity-photo',
                    name: file.name,
                    type: file.type || 'image/*',
                    size: file.size,
                    dataUrl: dataUrl,
                    uploadedAt: new Date().toISOString()
                });
            }

            if (!identityPhotos.length) {
                alert('Please upload at least one identity photo before signing up as a provider.');
                return;
            }

            formData.identityPhotos = identityPhotos;
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
            try {
                const signupResult = auth.signup(formData);
                const currentUser = signupResult && signupResult.user ? signupResult.user : null;

                if (currentUser && String(currentUser.role || '') === 'provider') {
                    // If the signup included identity photos, upload them to Stripe
                    try {
                        if (window.anytransportApi && typeof window.anytransportApi.identityPhotosUpload === 'function' && Array.isArray(formData.identityPhotos) && formData.identityPhotos.length) {
                            const photos = formData.identityPhotos.map((p) => p && p.dataUrl ? p.dataUrl : '').filter(Boolean);
                            if (photos.length) {
                                try {
                                    const uploadResp = window.anytransportApi.identityPhotosUpload(currentUser.id, photos);
                                    if (uploadResp && uploadResp.user) {
                                        currentUser = uploadResp.user;
                                        auth.currentUser = currentUser;
                                        localStorage.setItem('anytransport_user', JSON.stringify(currentUser));
                                    }
                                    if (uploadResp && Array.isArray(uploadResp.uploaded) && uploadResp.uploaded.length) {
                                        try {
                                            AuthManager.showTransientMessage('Identity photos uploaded successfully.');
                                        } catch (_m) {}
                                    }
                                } catch (_err) {
                                    // ignore upload errors for now; admin can still review later
                                }
                            }
                        }
                    } catch (_e) {}

                    if (startProviderStripeOnboarding(currentUser)) {
                        return;
                    }
                }
            } catch (error) {
                alert(error && error.message ? error.message : 'Unable to sign up with this email.');
                return;
            }
            closeSignupModal();
            
            // Check if we're redirecting after form submission
            const pendingQuote = sessionStorage.getItem('pending_quote_submission') || localStorage.getItem('pending_quote_submission');
            if (pendingQuote) {
                sessionStorage.removeItem('pending_quote_submission');
                localStorage.removeItem('pending_quote_submission');
                showConfirmationModal();
            } else {
                const isAdmin = currentUser && ((Array.isArray(currentUser.roles) && currentUser.roles.includes('admin')) || String(currentUser.role || '').toLowerCase() === 'admin');
                if (isAdmin) {
                    sessionStorage.removeItem('anytransport_auth_return_url');
                    window.location.href = 'dashboard.html#verification-review';
                    return;
                }
                const returnUrl = sessionStorage.getItem('anytransport_auth_return_url');
                if (returnUrl) {
                    sessionStorage.removeItem('anytransport_auth_return_url');
                    window.location.href = returnUrl;
                    return;
                }
                // Stay on the current page so users can choose when to open the dashboard.
            }
        } else {
            alert('Please fill in all required fields');
        }
    });
}

function initSignupRoleSelector() {
    const roleHidden = document.getElementById('signup-role');
    if (!roleHidden) return;

    const roleButtons = Array.from(document.querySelectorAll('[data-signup-role]'));
    if (!roleButtons.length) return;

    const applyRole = (value) => {
        const selected = value === 'provider' ? 'provider' : 'customer';
        roleHidden.value = selected;
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

    applyRole(roleHidden.value || 'customer');
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
                formIdLabel.textContent = 'Form ID: ' + formIdText;
                formIdLabel.style.display = 'block';
            } else {
                formIdLabel.textContent = '';
                formIdLabel.style.display = 'none';
            }
        }

        const dashboardBtn = document.getElementById('confirmation-view-dashboard-btn');
        if (dashboardBtn) {
            const useProviderBoard = (auth.isProvider && auth.isProvider()) || (auth.isAdmin && auth.isAdmin());
            if (useProviderBoard) {
                dashboardBtn.textContent = 'View provider dashboard';
                const rolePath = '#provider-board';
                const target = formIdText ? ('dashboard.html?newFormId=' + encodeURIComponent(formIdText) + rolePath) : ('dashboard.html' + rolePath);
                dashboardBtn.onclick = function () {
                    window.location.href = target;
                };
            } else {
                dashboardBtn.textContent = 'View my profile';
                const target = formIdText ? ('customer-dashboard.html?highlightForm=' + encodeURIComponent(formIdText)) : 'customer-dashboard.html';
                dashboardBtn.onclick = function () {
                    window.location.href = target;
                };
            }
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
