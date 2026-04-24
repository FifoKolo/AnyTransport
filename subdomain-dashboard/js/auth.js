// Authentication Management
window.anytransportApi = window.anytransportApi || (function () {
    const API_URL = resolveApiUrl();

    function getApiCandidates() {
        const configured = String(window.ANYTRANSPORT_API_URL || '').trim();
        const candidates = [];
        if (configured) {
            candidates.push(configured);
        }

        candidates.push('/api/index.php', '/api-external.php', 'api/index.php');

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
                return candidates[i];
            }
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
        xhr.open(method, buildUrl(action, params), false);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'application/json');

        if (method !== 'GET') {
            xhr.setRequestHeader('Content-Type', 'application/json');
        }

        xhr.send(method === 'GET' ? null : JSON.stringify(payload || {}));
        return parseResponse(xhr);
    }

    return {
        getCurrentUser: function () {
            try {
                const response = request('auth.me', 'GET');
                return response && response.user ? response.user : null;
            } catch (_error) {
                return null;
            }
        },
        login: function (email, password) {
            return request('auth.login', 'POST', { email: email, password: password });
        },
        signup: function (formData) {
            return request('auth.signup', 'POST', { formData: formData || {} });
        },
        logout: function () {
            return request('auth.logout', 'POST', {});
        },
        getUsers: function () {
            const response = request('users.list', 'GET');
            return Array.isArray(response.users) ? response.users : [];
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
            const response = request('quotes.list', 'GET', null, userId ? { userId: userId } : {});
            return Array.isArray(response.quotes) ? response.quotes : [];
        },
        saveQuote: function (quote) {
            const response = request('quotes.create', 'POST', { quote: quote || {} });
            return response.quote || quote || null;
        },
        getBids: function (quoteId) {
            const response = request('bids.list', 'GET', null, { quoteId: quoteId });
            return Array.isArray(response.bids) ? response.bids : [];
        },
        saveBid: function (bid) {
            const response = request('bids.create', 'POST', { bid: bid || {} });
            return response.bid || bid || null;
        },
        replaceAllBids: function (bids) {
            const response = request('bids.replaceAll', 'POST', { bids: Array.isArray(bids) ? bids : [] });
            return Array.isArray(response.bids) ? response.bids : [];
        },
        getSavedMessages: function (userId) {
            const response = request('messages.list', 'GET', null, { userId: userId });
            return Array.isArray(response.messages) ? response.messages : [];
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
            this.updateUserDisplay();
        } else {
            if (authMenu) authMenu.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }
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

        if (this.isUsernameTaken(normalizedUser.username, targetId)) {
            throw new Error('That username is already in use. Please choose another one.');
        }

        if (window.anytransportApi) {
            const savedUser = window.anytransportApi.saveUser(normalizedUser);
            if (savedUser && savedUser.id) {
                this.currentUser = this.normalizeUserRecord(savedUser, users);
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
                    window.anytransportApi.replaceUsers(normalizedCachedUsers);
                    return normalizedCachedUsers;
                }
            } catch (_error) {
                // Fall back to local storage below.
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
                window.anytransportApi.replaceUsers(Array.isArray(users) ? users : []);
                return;
            } catch (_error) {
                // Fall back to local storage if the API is unavailable.
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

    // Check if user is provider
    isProvider() {
        const roles = this.currentUser?.roles || [this.currentUser?.role];
        return roles.includes('provider');
    }

    // Check if user is customer
    isCustomer() {
        const roles = this.currentUser?.roles || [this.currentUser?.role];
        return roles.includes('customer');
    }
}

// Initialize auth manager
const auth = new AuthManager();

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

// Handle Login Form Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = this.querySelector('input[type="email"]').value;
        const password = this.querySelector('input[type="password"]').value;

        if (email && password) {
            auth.login(email, password);
            closeLoginModal();
            
            // Check if we're redirecting after form submission
            const pendingQuote = sessionStorage.getItem('pending_quote_submission') || localStorage.getItem('pending_quote_submission');
            if (pendingQuote) {
                sessionStorage.removeItem('pending_quote_submission');
                localStorage.removeItem('pending_quote_submission');
                showConfirmationModal();
            } else {
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
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const nameInput = this.querySelector('input[name="name"]');
        const emailInput = this.querySelector('#signup-email');
        const emailConfirmInput = this.querySelector('#signup-email-confirm');
        const contactInput = this.querySelector('#signup-contact');
        const passwordInput = this.querySelector('#signup-password');
        const passwordConfirmInput = this.querySelector('#signup-password-confirm');
        const roleInput = this.querySelector('#signup-role');
        const usernameInput = this.querySelector('input[name="username"]');
        
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
                auth.signup(formData);
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
            const rolePath = auth.isProvider && auth.isProvider() ? '#provider-board' : '#my-quotes';
            const target = formIdText ? ('dashboard.html?newFormId=' + encodeURIComponent(formIdText) + rolePath) : ('dashboard.html' + rolePath);
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
