(function (global) {
    'use strict';

    var panelState = {
        section: 'operations',
        userQuery: '',
        userRole: 'all',
        expandedUserId: '',
        expandedThreadKey: '',
        messageQuery: '',
        messageRoomThreadKey: '',
        revealedPasswords: {}
    };

    var depsRef = null;
    var shellReady = false;
    var INLINE_MESSAGE_PREVIEW_LIMIT = 4;

    function escapeHtml(value) {
        return String(value || '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function escapeAttr(value) {
        return String(value || '').replace(/"/g, '&quot;');
    }

    function firstText() {
        for (var i = 0; i < arguments.length; i += 1) {
            var v = arguments[i];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
                return String(v).trim();
            }
        }
        return '';
    }

    function formatWhen(value) {
        if (!value) return '—';
        try {
            var d = new Date(value);
            if (Number.isNaN(d.getTime())) return '—';
            return d.toLocaleString();
        } catch (_e) {
            return '—';
        }
    }

    function userDisplayName(user) {
        if (!user) return 'Unknown user';
        return firstText(user.businessName, user.name, user.nickname, user.username, user.email, user.id);
    }

    function userRoleLabel(user) {
        var role = String(user && user.role || '').trim().toLowerCase();
        if (role === 'admin') return 'Admin';
        if (role === 'provider') return 'Provider';
        return 'Customer';
    }

    function isProviderUser(user) {
        return String(user && user.role || '').trim().toLowerCase() === 'provider';
    }

    function isUserBanned(user) {
        return String(user && user.accountStatus || '').trim().toLowerCase() === 'banned';
    }

    function isProviderVerified(user) {
        if (!isProviderUser(user)) return false;
        var status = String(user.identityReviewStatus || '').trim().toLowerCase();
        return status === 'approved' && !!user.verified;
    }

    function userStatusBadges(user) {
        var badges = [];
        if (isUserBanned(user)) {
            badges.push('<span class="admin-user-badge admin-user-badge--banned">Banned</span>');
        }
        if (isProviderUser(user)) {
            if (isProviderVerified(user)) {
                badges.push('<span class="admin-user-badge admin-user-badge--verified">Verified' + (user.adminVerificationBypass ? ' (test)' : '') + '</span>');
            } else {
                badges.push('<span class="admin-user-badge admin-user-badge--pending">Not verified</span>');
            }
        }
        return badges.length ? '<div class="admin-user-badges">' + badges.join('') + '</div>' : '';
    }

    function buildUserModerationActions(user) {
        var id = String(user && user.id || '').trim();
        if (!id) return '';
        var role = String(user.role || '').trim().toLowerCase();
        if (role === 'admin') {
            return '<p class="admin-user-moderation-note">Admin accounts cannot be moderated here.</p>';
        }

        var parts = ['<div class="admin-user-moderation">', '<h4>Account controls</h4>'];
        if (isProviderUser(user)) {
            if (!isProviderVerified(user)) {
                parts.push('<button type="button" class="btn btn-primary btn-sm" data-admin-moderate="' + escapeAttr(id) + '" data-admin-action="verify_test">Verify for testing (skip Stripe)</button>');
            } else {
                parts.push('<button type="button" class="btn btn-outline btn-sm" data-admin-moderate="' + escapeAttr(id) + '" data-admin-action="unverify">Remove verification</button>');
            }
        }
        if (isUserBanned(user)) {
            parts.push('<button type="button" class="btn btn-outline btn-sm" data-admin-moderate="' + escapeAttr(id) + '" data-admin-action="unban">Unban user</button>');
        } else {
            parts.push('<button type="button" class="btn btn-danger btn-sm" data-admin-moderate="' + escapeAttr(id) + '" data-admin-action="ban">Ban user</button>');
        }
        parts.push('</div>');
        return parts.join('');
    }

    function buildUserPasswordControls(user) {
        var id = String(user && user.id || '').trim();
        if (!id) return '';
        var role = String(user.role || '').trim().toLowerCase();
        if (role === 'admin') {
            return '';
        }

        var revealed = panelState.revealedPasswords[id];
        var displayText = revealed !== undefined
            ? (revealed === '' ? '(no password set)' : revealed)
            : 'Hidden — click Show to view';
        var revealLabel = revealed !== undefined ? 'Hide password' : 'Show password';

        return [
            '<div class="admin-user-password">',
            '  <h4>Password</h4>',
            '  <div class="admin-user-password-row">',
            '    <code class="admin-user-password-display" data-admin-password-display="' + escapeAttr(id) + '">' + escapeHtml(displayText) + '</code>',
            '    <button type="button" class="btn btn-outline btn-sm" data-admin-password-reveal="' + escapeAttr(id) + '">' + revealLabel + '</button>',
            '  </div>',
            '  <div class="admin-user-password-row">',
            '    <input type="password" class="form-input admin-user-password-input" data-admin-password-input="' + escapeAttr(id) + '" placeholder="At least 6 characters" minlength="6" autocomplete="new-password">',
            '    <button type="button" class="btn btn-primary btn-sm" data-admin-password-set="' + escapeAttr(id) + '">Set password</button>',
            '  </div>',
            '  <p class="admin-user-password-status" data-admin-password-status="' + escapeAttr(id) + '" aria-live="polite"></p>',
            '</div>'
        ].join('');
    }

    function setUserPasswordStatus(userId, message, isError) {
        var mount = document.getElementById('admin-users-content');
        if (!mount) return;
        var statusEl = mount.querySelector('[data-admin-password-status="' + userId + '"]');
        if (!statusEl) return;
        statusEl.textContent = String(message || '');
        statusEl.classList.toggle('is-error', !!isError);
    }

    function updateUserPasswordDisplay(userId) {
        var mount = document.getElementById('admin-users-content');
        if (!mount) return;
        var displayEl = mount.querySelector('[data-admin-password-display="' + userId + '"]');
        var revealBtn = mount.querySelector('[data-admin-password-reveal="' + userId + '"]');
        if (!displayEl) return;
        var revealed = panelState.revealedPasswords[userId];
        if (revealed === undefined) {
            displayEl.textContent = 'Hidden — click Show to view';
            if (revealBtn) revealBtn.textContent = 'Show password';
            return;
        }
        displayEl.textContent = revealed === '' ? '(no password set)' : revealed;
        if (revealBtn) revealBtn.textContent = 'Hide password';
    }

    function toggleAdminUserPasswordReveal(userId) {
        if (!window.anytransportApi || typeof window.anytransportApi.getAdminUserPassword !== 'function') {
            setUserPasswordStatus(userId, 'Password lookup is not available right now.', true);
            return;
        }

        if (panelState.revealedPasswords[userId] !== undefined) {
            delete panelState.revealedPasswords[userId];
            updateUserPasswordDisplay(userId);
            setUserPasswordStatus(userId, '', false);
            return;
        }

        var revealBtn = document.querySelector('[data-admin-password-reveal="' + userId + '"]');
        if (revealBtn) revealBtn.disabled = true;
        setUserPasswordStatus(userId, 'Loading password…', false);

        Promise.resolve(window.anytransportApi.getAdminUserPassword(userId)).then(function (resp) {
            panelState.revealedPasswords[userId] = resp && resp.hasPassword
                ? String(resp.password || '')
                : '';
            updateUserPasswordDisplay(userId);
            setUserPasswordStatus(userId, '', false);
        }).catch(function (err) {
            setUserPasswordStatus(userId, err && err.message ? err.message : 'Unable to load password.', true);
        }).finally(function () {
            if (revealBtn) revealBtn.disabled = false;
        });
    }

    function setAdminUserPassword(userId) {
        var mount = document.getElementById('admin-users-content');
        if (!mount) return;
        var input = mount.querySelector('[data-admin-password-input="' + userId + '"]');
        var password = String(input && input.value || '').trim();
        if (!password) {
            setUserPasswordStatus(userId, 'Enter a new password first.', true);
            return;
        }
        var targetUser = null;
        if (depsRef && typeof depsRef.getAllUsers === 'function') {
            (depsRef.getAllUsers() || []).some(function (user) {
                if (user && String(user.id || '') === String(userId)) {
                    targetUser = user;
                    return true;
                }
                return false;
            });
        }
        if (targetUser && isProviderUser(targetUser)) {
            var providerPasswordError = '';
            if (window.anytransportApi && typeof window.anytransportApi.getProviderPasswordRequirementError === 'function') {
                providerPasswordError = window.anytransportApi.getProviderPasswordRequirementError(password);
            } else if (password.length < 6) {
                providerPasswordError = 'Password must be at least 6 characters.';
            }
            if (providerPasswordError) {
                setUserPasswordStatus(userId, providerPasswordError, true);
                return;
            }
        } else if (password.length < 6) {
            setUserPasswordStatus(userId, 'Password must be at least 6 characters.', true);
            return;
        }
        if (!window.confirm('Set a new password for this user? They will be signed out on other devices.')) {
            return;
        }
        if (!window.anytransportApi || typeof window.anytransportApi.setAdminUserPassword !== 'function') {
            setUserPasswordStatus(userId, 'Password updates are not available right now.', true);
            return;
        }

        var setBtn = mount.querySelector('[data-admin-password-set="' + userId + '"]');
        if (setBtn) setBtn.disabled = true;
        setUserPasswordStatus(userId, 'Saving password…', false);

        Promise.resolve(window.anytransportApi.setAdminUserPassword(userId, password)).then(function (resp) {
            if (input) input.value = '';
            panelState.revealedPasswords[userId] = password;
            updateUserPasswordDisplay(userId);
            setUserPasswordStatus(userId, (resp && resp.message) ? resp.message : 'Password updated.', false);
        }).catch(function (err) {
            setUserPasswordStatus(userId, err && err.message ? err.message : 'Unable to update password.', true);
        }).finally(function () {
            if (setBtn) setBtn.disabled = false;
        });
    }

    function runUserModeration(userId, action) {
        if (!window.anytransportApi || typeof window.anytransportApi.moderateUser !== 'function') {
            alert('Account moderation is not available right now.');
            return Promise.reject(new Error('moderation unavailable'));
        }

        var notes = '';
        if (action === 'ban') {
            notes = String(window.prompt('Reason for banning this user (required):', '') || '').trim();
            if (!notes) {
                return Promise.resolve(false);
            }
            if (!window.confirm('Ban this user? They will be signed out and unable to log in until unbanned.')) {
                return Promise.resolve(false);
            }
        } else if (action === 'verify_test') {
            if (!window.confirm('Verify this provider for testing? This skips Stripe verification and grants full provider access.')) {
                return Promise.resolve(false);
            }
            notes = 'Verified by admin for testing (Stripe bypass).';
        } else if (action === 'unverify') {
            if (!window.confirm('Remove verification from this provider? They will lose marketplace access until verified again.')) {
                return Promise.resolve(false);
            }
            notes = 'Verification removed by admin.';
        } else if (action === 'unban') {
            if (!window.confirm('Unban this user and restore account access?')) {
                return Promise.resolve(false);
            }
        }

        return Promise.resolve(window.anytransportApi.moderateUser(userId, action, notes)).then(function (updated) {
            if (!updated || !updated.id) {
                throw new Error('Unable to update this account.');
            }
            try {
                if (window.auth && window.auth.getUser && String(window.auth.getUser().id) === String(updated.id)) {
                    if (typeof window.auth.mergeUserIntoLocalCache === 'function') {
                        window.auth.mergeUserIntoLocalCache(updated);
                    }
                    window.auth.currentUser = Object.assign({}, window.auth.getUser(), updated);
                    if (typeof window.auth.setStoredCurrentUser === 'function') {
                        window.auth.setStoredCurrentUser(window.auth.currentUser);
                    }
                }
            } catch (_sessionError) {
                /* ignore */
            }
            if (depsRef && typeof depsRef.invalidateAdminCache === 'function') {
                depsRef.invalidateAdminCache();
            }
            if (depsRef && typeof depsRef.renderOperations === 'function') {
                depsRef.renderOperations(true);
            }
            renderUsersPanel();
            var actionLabels = {
                verify_test: 'Provider verified for testing.',
                unverify: 'Provider verification removed.',
                ban: 'User banned.',
                unban: 'User unbanned.'
            };
            alert(actionLabels[action] || 'Account updated.');
            return true;
        }).catch(function (err) {
            alert(err && err.message ? err.message : 'Unable to update this account.');
            return false;
        });
    }

    var userModerationBound = false;
    function ensureUserModerationActions() {
        if (userModerationBound) return;
        userModerationBound = true;
        document.addEventListener('click', function (event) {
            var mount = document.getElementById('admin-users-content');
            if (!mount) return;

            var moderateBtn = event.target.closest('[data-admin-moderate]');
            if (moderateBtn && mount.contains(moderateBtn)) {
                event.preventDefault();
                var userId = moderateBtn.getAttribute('data-admin-moderate') || '';
                var action = moderateBtn.getAttribute('data-admin-action') || '';
                if (!userId || !action) return;
                runUserModeration(userId, action);
                return;
            }

            var revealBtn = event.target.closest('[data-admin-password-reveal]');
            if (revealBtn && mount.contains(revealBtn)) {
                event.preventDefault();
                var revealUserId = revealBtn.getAttribute('data-admin-password-reveal') || '';
                if (!revealUserId) return;
                toggleAdminUserPasswordReveal(revealUserId);
                return;
            }

            var setBtn = event.target.closest('[data-admin-password-set]');
            if (setBtn && mount.contains(setBtn)) {
                event.preventDefault();
                var setUserId = setBtn.getAttribute('data-admin-password-set') || '';
                if (!setUserId) return;
                setAdminUserPassword(setUserId);
            }
        });
    }

    function sectionFromHash() {
        var hash = String(global.location.hash || '').replace(/^#/, '').trim().toLowerCase();
        if (hash === 'admin-section-editor' || hash === 'admin-editor') return 'editor';
        if (hash === 'admin-section-messages' || hash === 'admin-messages') return 'messages';
        if (hash === 'admin-section-users' || hash === 'admin-users') return 'users';
        return 'operations';
    }

    function hashForSection(section) {
        if (section === 'editor') return '#admin-section-editor';
        if (section === 'messages') return '#admin-section-messages';
        if (section === 'users') return '#admin-section-users';
        return '#verification-review';
    }

    function quoteBelongsToUser(quote, user) {
        if (!quote || !user) return false;
        var uid = String(user.id || '').trim();
        var email = String(user.email || '').trim().toLowerCase();
        var ownerId = String(quote.userId || quote.createdBy || '').trim();
        if (uid && ownerId && uid === ownerId) return true;
        var quoteEmail = String(quote.customerEmail || '').trim().toLowerCase();
        return !!(email && quoteEmail && email === quoteEmail);
    }

    function buildUserDirectory(allUsers, allQuotes, allMessages) {
        var map = {};
        (allUsers || []).forEach(function (user) {
            var id = String(user.id || '').trim();
            if (!id) return;
            map[id] = {
                user: user,
                quotes: [],
                messages: [],
                threads: {}
            };
        });

        (allQuotes || []).forEach(function (quote) {
            Object.keys(map).forEach(function (userId) {
                if (quoteBelongsToUser(quote, map[userId].user)) {
                    map[userId].quotes.push(quote);
                }
            });
        });

        (allMessages || []).forEach(function (message) {
            var from = String(message.fromUserId || '').trim();
            var to = String(message.toUserId || '').trim();
            [from, to].forEach(function (userId) {
                if (!userId || !map[userId]) return;
                map[userId].messages.push(message);
                var peerId = userId === from ? to : from;
                if (!peerId) return;
                var threadKey = [userId, peerId].sort().join('::');
                if (!map[userId].threads[threadKey]) {
                    map[userId].threads[threadKey] = { peerId: peerId, messages: [] };
                }
                map[userId].threads[threadKey].messages.push(message);
            });
        });

        return map;
    }

    function conversationKey(a, b) {
        return [String(a || ''), String(b || '')].sort().join('::');
    }

    function buildAllThreads(allMessages, allUsers) {
        var usersById = {};
        (allUsers || []).forEach(function (u) {
            if (u && u.id) usersById[String(u.id)] = u;
        });
        var threads = {};
        (allMessages || []).forEach(function (message) {
            var from = String(message.fromUserId || '').trim();
            var to = String(message.toUserId || '').trim();
            if (!from || !to) return;
            var key = conversationKey(from, to);
            if (!threads[key]) {
                threads[key] = {
                    key: key,
                    participantA: from,
                    participantB: to,
                    messages: [],
                    latestAt: ''
                };
            }
            threads[key].messages.push(message);
            var ts = String(message.createdAt || '');
            if (!threads[key].latestAt || ts > threads[key].latestAt) {
                threads[key].latestAt = ts;
            }
        });
        return Object.keys(threads).map(function (key) {
            var thread = threads[key];
            thread.messages.sort(function (a, b) {
                return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
            });
            return thread;
        }).sort(function (a, b) {
            return String(b.latestAt || '').localeCompare(String(a.latestAt || ''));
        });
    }

    function renderPrimaryNav(active) {
        var sections = [
            { id: 'operations', label: 'Operations' },
            { id: 'editor', label: 'Website editor' },
            { id: 'messages', label: 'Messages' },
            { id: 'users', label: 'Users' }
        ];
        return '<nav class="admin-primary-nav" aria-label="Admin sections">' +
            sections.map(function (entry) {
                var isActive = entry.id === active;
                return '<button type="button" class="admin-primary-nav-btn' + (isActive ? ' active' : '') + '" data-admin-primary-section="' + entry.id + '" aria-current="' + (isActive ? 'page' : 'false') + '">' + escapeHtml(entry.label) + '</button>';
            }).join('') +
            '</nav>';
    }

    function renderShell(activeSection) {
        var root = document.getElementById('admin-panel-root');
        if (!root) return;
        root.innerHTML = [
            renderPrimaryNav(activeSection),
            '<div class="admin-panel-panels">',
            '  <section id="admin-panel-operations" class="admin-panel-section"' + (activeSection === 'operations' ? '' : ' hidden') + '>',
            '    <div id="admin-operations-content" class="provider-listings"></div>',
            '  </section>',
            '  <section id="admin-panel-editor" class="admin-panel-section"' + (activeSection === 'editor' ? '' : ' hidden') + '>',
            '    <h3 class="admin-panel-section-title">Website editor</h3>',
            '    <p class="muted-text">Manage navbar links, footer links, and page sections with the visual builder.</p>',
            '    <div id="admin-site-content-editor"></div>',
            '  </section>',
            '  <section id="admin-panel-messages" class="admin-panel-section"' + (activeSection === 'messages' ? '' : ' hidden') + '>',
            '    <div id="admin-messages-content"></div>',
            '  </section>',
            '  <section id="admin-panel-users" class="admin-panel-section"' + (activeSection === 'users' ? '' : ' hidden') + '>',
            '    <div id="admin-users-content"></div>',
            '  </section>',
            '</div>'
        ].join('');
        shellReady = true;
        wirePrimaryNav();
    }

    function wirePrimaryNav() {
        var root = document.getElementById('admin-panel-root');
        if (!root) return;
        root.querySelectorAll('[data-admin-primary-section]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var section = btn.getAttribute('data-admin-primary-section') || 'operations';
                switchSection(section, true);
            });
        });
    }

    function togglePanelVisibility(activeSection) {
        ['operations', 'editor', 'messages', 'users'].forEach(function (name) {
            var panel = document.getElementById('admin-panel-' + name);
            if (panel) panel.hidden = name !== activeSection;
        });
        var root = document.getElementById('admin-panel-root');
        if (root) {
            root.querySelectorAll('[data-admin-primary-section]').forEach(function (btn) {
                var active = btn.getAttribute('data-admin-primary-section') === activeSection;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-current', active ? 'page' : 'false');
            });
        }
    }

    function renderMessageLine(message, usersById) {
        var sender = userDisplayName(usersById[message.fromUserId]);
        var body = firstText(message.text, message.title, '');
        var title = firstText(message.title, '');
        var bodyHtml = escapeHtml(body);
        if (title && title !== body) {
            bodyHtml = '<strong>' + escapeHtml(title) + '</strong>' + (body ? '<br>' + escapeHtml(body) : '');
        }
        return '<div class="admin-message-line">' +
            '<div class="admin-message-meta">' + escapeHtml(sender) + ' · ' + escapeHtml(formatWhen(message.createdAt)) + '</div>' +
            '<div class="admin-message-body">' + bodyHtml + '</div>' +
            '</div>';
    }

    function ensureMessageRoomModal() {
        var existing = document.getElementById('admin-message-room-modal');
        if (existing) {
            return existing;
        }
        var modal = document.createElement('div');
        modal.id = 'admin-message-room-modal';
        modal.className = 'admin-message-room-modal';
        modal.hidden = true;
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'admin-message-room-title');
        modal.innerHTML = [
            '<div class="admin-message-room-backdrop" data-admin-close-room></div>',
            '<div class="admin-message-room-panel">',
            '  <header class="admin-message-room-header">',
            '    <div>',
            '      <h3 id="admin-message-room-title" class="admin-message-room-title"></h3>',
            '      <p id="admin-message-room-subtitle" class="admin-message-room-subtitle"></p>',
            '    </div>',
            '    <button type="button" class="btn btn-outline admin-message-room-close" data-admin-close-room aria-label="Close conversation">Close</button>',
            '  </header>',
            '  <div id="admin-message-room-thread" class="admin-message-room-thread"></div>',
            '</div>'
        ].join('');
        document.body.appendChild(modal);
        modal.addEventListener('click', function (event) {
            if (event.target.closest('[data-admin-close-room]')) {
                closeMessageRoom();
            }
        });
        document.addEventListener('keydown', function (event) {
            if (event.key === 'Escape' && panelState.messageRoomThreadKey) {
                closeMessageRoom();
            }
        });
        return modal;
    }

    function closeMessageRoom() {
        panelState.messageRoomThreadKey = '';
        var modal = document.getElementById('admin-message-room-modal');
        if (modal) {
            modal.hidden = true;
        }
    }

    function openMessageRoom(threadKey, threads, usersById) {
        var thread = null;
        for (var i = 0; i < threads.length; i += 1) {
            if (threads[i].key === threadKey) {
                thread = threads[i];
                break;
            }
        }
        if (!thread) {
            return;
        }

        panelState.messageRoomThreadKey = threadKey;
        var modal = ensureMessageRoomModal();
        var userA = usersById[thread.participantA];
        var userB = usersById[thread.participantB];
        var titleEl = modal.querySelector('#admin-message-room-title');
        var subtitleEl = modal.querySelector('#admin-message-room-subtitle');
        var threadEl = modal.querySelector('#admin-message-room-thread');

        if (titleEl) {
            titleEl.textContent = userDisplayName(userA) + ' ↔ ' + userDisplayName(userB);
        }
        if (subtitleEl) {
            subtitleEl.textContent = thread.messages.length + ' message(s) · Last activity ' + formatWhen(thread.latestAt);
        }
        if (threadEl) {
            threadEl.innerHTML = thread.messages.map(function (message) {
                return renderMessageLine(message, usersById);
            }).join('');
            threadEl.scrollTop = threadEl.scrollHeight;
        }
        modal.hidden = false;
        var closeBtn = modal.querySelector('.admin-message-room-close');
        if (closeBtn) {
            closeBtn.focus();
        }
    }

    function wireMessageRoomActions(mount, threads, usersById) {
        if (!mount) {
            return;
        }
        mount.querySelectorAll('[data-admin-open-room]').forEach(function (btn) {
            btn.addEventListener('click', function (event) {
                event.preventDefault();
                event.stopPropagation();
                var key = btn.getAttribute('data-admin-open-room') || '';
                openMessageRoom(key, threads, usersById);
            });
        });
    }

    function renderMessagesPanel() {
        var mount = document.getElementById('admin-messages-content');
        if (!mount || !depsRef) return;

        var allUsers = depsRef.getAllUsers ? depsRef.getAllUsers() : [];
        var allMessages = depsRef.getAllMessages ? depsRef.getAllMessages() : [];
        var usersById = {};
        allUsers.forEach(function (u) {
            if (u && u.id) usersById[String(u.id)] = u;
        });

        var query = String(panelState.messageQuery || '').trim().toLowerCase();
        var threads = buildAllThreads(allMessages, allUsers).filter(function (thread) {
            if (!query) return true;
            var names = [thread.participantA, thread.participantB].map(function (id) {
                return userDisplayName(usersById[id]).toLowerCase();
            }).join(' ');
            var preview = thread.messages.map(function (m) { return String(m.text || m.title || ''); }).join(' ').toLowerCase();
            return names.indexOf(query) >= 0 || preview.indexOf(query) >= 0;
        });

        var listHtml = threads.length ? threads.map(function (thread) {
            var userA = usersById[thread.participantA];
            var userB = usersById[thread.participantB];
            var label = escapeHtml(userDisplayName(userA)) + ' ↔ ' + escapeHtml(userDisplayName(userB));
            var preview = escapeHtml(firstText(thread.messages[thread.messages.length - 1] && thread.messages[thread.messages.length - 1].text, thread.messages[thread.messages.length - 1] && thread.messages[thread.messages.length - 1].title, 'No text'));
            var expanded = panelState.expandedThreadKey === thread.key;
            var totalMessages = thread.messages.length;
            var isLongThread = totalMessages > INLINE_MESSAGE_PREVIEW_LIMIT;
            var previewMessages = expanded ? thread.messages.slice(0, INLINE_MESSAGE_PREVIEW_LIMIT) : [];
            var messagesHtml = previewMessages.map(function (m) {
                return renderMessageLine(m, usersById);
            }).join('');
            var inlineBody = expanded ? [
                '<div class="admin-thread-body">',
                messagesHtml,
                isLongThread ? [
                    '<div class="admin-thread-more">',
                    '  <p class="admin-thread-more-note">Showing ' + INLINE_MESSAGE_PREVIEW_LIMIT + ' of ' + totalMessages + ' messages.</p>',
                    '  <button type="button" class="btn btn-primary btn-sm" data-admin-open-room="' + escapeAttr(thread.key) + '">View full conversation</button>',
                    '</div>'
                ].join('') : '',
                '</div>'
            ].join('') : '';
            var roomButton = isLongThread ? [
                '<div class="admin-thread-actions">',
                '  <button type="button" class="btn btn-outline btn-sm" data-admin-open-room="' + escapeAttr(thread.key) + '">Open conversation (' + totalMessages + ' messages)</button>',
                '</div>'
            ].join('') : '';
            return [
                '<article class="admin-thread-card">',
                '  <button type="button" class="admin-thread-toggle" data-admin-thread-key="' + escapeAttr(thread.key) + '">',
                '    <div class="admin-thread-title">' + label + '</div>',
                '    <div class="admin-thread-preview">' + preview + '</div>',
                '    <div class="admin-thread-meta">' + totalMessages + ' message(s) · Last ' + escapeHtml(formatWhen(thread.latestAt)) + '</div>',
                '  </button>',
                roomButton,
                inlineBody,
                '</article>'
            ].join('');
        }).join('') : '<div class="empty-inventory">No platform messages yet.</div>';

        mount.innerHTML = [
            '<div class="admin-section-toolbar">',
            '  <h3 class="admin-panel-section-title" style="margin:0;">All customer &amp; provider messages</h3>',
            '  <input type="search" class="form-input admin-messages-search" placeholder="Search by name or message text" value="' + escapeAttr(panelState.messageQuery) + '">',
            '</div>',
            '<p class="muted-text">Read-only view of every conversation on the platform. Expand a thread for a quick preview, or open the conversation room for the full exchange.</p>',
            '<div class="admin-thread-list">' + listHtml + '</div>'
        ].join('');

        mount.querySelector('.admin-messages-search').addEventListener('input', function (e) {
            panelState.messageQuery = String(e.target.value || '');
            renderMessagesPanel();
        });
        mount.querySelectorAll('[data-admin-thread-key]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var key = btn.getAttribute('data-admin-thread-key') || '';
                panelState.expandedThreadKey = panelState.expandedThreadKey === key ? '' : key;
                renderMessagesPanel();
            });
        });
        wireMessageRoomActions(mount, threads, usersById);
        if (panelState.messageRoomThreadKey) {
            openMessageRoom(panelState.messageRoomThreadKey, threads, usersById);
        }
    }

    function renderUsersPanel() {
        var mount = document.getElementById('admin-users-content');
        if (!mount || !depsRef) return;

        var allUsers = depsRef.getAllUsers ? depsRef.getAllUsers() : [];
        var allQuotes = depsRef.getAllQuotes ? depsRef.getAllQuotes() : [];
        var allMessages = depsRef.getAllMessages ? depsRef.getAllMessages() : [];
        var directory = buildUserDirectory(allUsers, allQuotes, allMessages);
        var usersById = {};
        allUsers.forEach(function (u) {
            if (u && u.id) usersById[String(u.id)] = u;
        });

        var query = String(panelState.userQuery || '').trim().toLowerCase();
        var roleFilter = String(panelState.userRole || 'all');

        var rows = allUsers.filter(function (user) {
            var role = String(user.role || '').trim().toLowerCase();
            if (roleFilter === 'provider' && role !== 'provider') return false;
            if (roleFilter === 'customer' && (role === 'provider' || role === 'admin')) return false;
            if (roleFilter === 'admin' && role !== 'admin') return false;
            if (!query) return true;
            var hay = [
                userDisplayName(user),
                user.email,
                user.username,
                user.city,
                user.location
            ].join(' ').toLowerCase();
            return hay.indexOf(query) >= 0;
        }).sort(function (a, b) {
            return userDisplayName(a).localeCompare(userDisplayName(b));
        });

        var listHtml = rows.length ? rows.map(function (user) {
            var id = String(user.id || '');
            var entry = directory[id] || { quotes: [], messages: [], threads: {} };
            var expanded = panelState.expandedUserId === id;
            var profileBtn = isProviderUser(user)
                ? '<a class="btn btn-outline btn-sm" href="provider-profile.html?userId=' + encodeURIComponent(id) + '" target="_blank" rel="noopener">View provider profile</a>'
                : '';

            var quotesHtml = entry.quotes.length ? entry.quotes.slice().sort(function (a, b) {
                return String(b.submittedAt || b.createdAt || '').localeCompare(String(a.submittedAt || a.createdAt || ''));
            }).map(function (quote) {
                var formId = firstText(quote.formId, quote.id, '—');
                var quoteId = String(quote.id || '').trim();
                return '<li class="admin-user-detail-item">' +
                    '<strong>Listing #' + escapeHtml(formId) + '</strong> · ' + escapeHtml(formatWhen(quote.submittedAt || quote.createdAt)) +
                    (quoteId ? ' · <a href="listing-details.html?id=' + encodeURIComponent(formId) + '" target="_blank" rel="noopener">Open</a>' : '') +
                    '</li>';
            }).join('') : '<li class="admin-user-detail-empty">No listings linked to this account.</li>';

            var threadKeys = Object.keys(entry.threads || {});
            var messagesHtml = threadKeys.length ? threadKeys.map(function (key) {
                var thread = entry.threads[key];
                var peer = usersById[thread.peerId];
                var latest = thread.messages[thread.messages.length - 1];
                return '<li class="admin-user-detail-item">' +
                    '<strong>' + escapeHtml(userDisplayName(peer)) + '</strong> · ' + thread.messages.length + ' message(s)' +
                    '<div class="admin-user-detail-sub">' + escapeHtml(firstText(latest && latest.text, latest && latest.title, '')) + '</div>' +
                    '</li>';
            }).join('') : '<li class="admin-user-detail-empty">No messages for this account.</li>';

            return [
                '<article class="admin-user-card' + (isUserBanned(user) ? ' admin-user-card--banned' : '') + '">',
                '  <div class="admin-user-card-head">',
                '    <div>',
                '      <div class="admin-user-name">' + escapeHtml(userDisplayName(user)) + '</div>',
                '      <div class="admin-user-meta">' + escapeHtml(firstText(user.email, 'No email')) + ' · ' + escapeHtml(userRoleLabel(user)) + '</div>',
                userStatusBadges(user),
                (isUserBanned(user) && user.banReason ? '<div class="admin-user-ban-reason">Ban reason: ' + escapeHtml(user.banReason) + '</div>' : ''),
                '    </div>',
                '    <div class="admin-user-stats">',
                '      <span>' + entry.quotes.length + ' listing(s)</span>',
                '      <span>' + entry.messages.length + ' message(s)</span>',
                '    </div>',
                '  </div>',
                '  <div class="admin-user-card-actions">',
                '    <button type="button" class="btn btn-outline btn-sm" data-admin-expand-user="' + escapeAttr(id) + '">' + (expanded ? 'Hide details' : 'Show listings &amp; messages') + '</button>',
                profileBtn,
                buildUserModerationActions(user),
                buildUserPasswordControls(user),
                '  </div>',
                expanded ? [
                    '  <div class="admin-user-detail-grid">',
                    '    <div><h4>Listings / forms</h4><ul>' + quotesHtml + '</ul></div>',
                    '    <div><h4>Messages</h4><ul>' + messagesHtml + '</ul></div>',
                    '  </div>'
                ].join('') : '',
                '</article>'
            ].join('');
        }).join('') : '<div class="empty-inventory">No users match your filters.</div>';

        mount.innerHTML = [
            '<div class="admin-section-toolbar">',
            '  <h3 class="admin-panel-section-title" style="margin:0;">Customers &amp; providers</h3>',
            '  <div class="admin-user-filters">',
            '    <select class="form-input admin-user-role-filter">',
            '      <option value="all"' + (roleFilter === 'all' ? ' selected' : '') + '>All roles</option>',
            '      <option value="customer"' + (roleFilter === 'customer' ? ' selected' : '') + '>Customers</option>',
            '      <option value="provider"' + (roleFilter === 'provider' ? ' selected' : '') + '>Providers</option>',
            '      <option value="admin"' + (roleFilter === 'admin' ? ' selected' : '') + '>Admins</option>',
            '    </select>',
            '    <input type="search" class="form-input admin-users-search" placeholder="Search name or email" value="' + escapeAttr(panelState.userQuery) + '">',
            '  </div>',
            '</div>',
            '<p class="muted-text">Browse every account, view or reset passwords, see listings and message activity, and open provider profiles.</p>',
            '<div class="admin-user-list">' + listHtml + '</div>'
        ].join('');

        var roleSelect = mount.querySelector('.admin-user-role-filter');
        if (roleSelect) {
            roleSelect.addEventListener('change', function () {
                panelState.userRole = String(roleSelect.value || 'all');
                renderUsersPanel();
            });
        }
        var searchInput = mount.querySelector('.admin-users-search');
        if (searchInput) {
            searchInput.addEventListener('input', function () {
                panelState.userQuery = String(searchInput.value || '');
                renderUsersPanel();
            });
        }
        mount.querySelectorAll('[data-admin-expand-user]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var id = btn.getAttribute('data-admin-expand-user') || '';
                panelState.expandedUserId = panelState.expandedUserId === id ? '' : id;
                renderUsersPanel();
            });
        });
    }

    function switchSection(section, updateHash) {
        section = section || 'operations';
        panelState.section = section;
        if (!shellReady) {
            renderShell(section);
        }
        togglePanelVisibility(section);
        if (updateHash && global.history && typeof global.history.replaceState === 'function') {
            global.history.replaceState(null, '', hashForSection(section));
        }
        if (!depsRef) return;
        if (section === 'operations' && typeof depsRef.renderOperations === 'function') {
            depsRef.renderOperations();
        }
        if (section === 'editor' && typeof depsRef.ensureSiteContentAdmin === 'function') {
            depsRef.ensureSiteContentAdmin(true);
        }
        if (section === 'messages') {
            renderMessagesPanel();
        }
        if (section === 'users') {
            renderUsersPanel();
        }
    }

    function init(deps) {
        depsRef = deps || null;
        ensureUserModerationActions();
        var section = sectionFromHash();
        renderShell(section);
        switchSection(section, false);
    }

    function applyHash() {
        switchSection(sectionFromHash(), false);
    }

    function getActiveSection() {
        return panelState.section;
    }

    global.anytransportAdminPanel = {
        init: init,
        applyHash: applyHash,
        switchSection: switchSection,
        getActiveSection: getActiveSection,
        renderMessagesPanel: renderMessagesPanel,
        renderUsersPanel: renderUsersPanel
    };
})(typeof window !== 'undefined' ? window : this);
