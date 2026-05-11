/* global anytransportApi */
(function () {
    'use strict';

    function isAtDebug() {
        try {
            return typeof window.anytransportIsDebug === 'function' && window.anytransportIsDebug();
        } catch (_e) {
            return false;
        }
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatWhen(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_e) {
            return String(iso);
        }
    }

    function firstLine(text, max) {
        const t = String(text || '').trim().replace(/\s+/g, ' ');
        if (!t) return '';
        return t.length > max ? t.slice(0, max) + '…' : t;
    }

    function getQuoteLabel(q) {
        return String(q.formId || q.id || '').trim() || '—';
    }

    function getServiceTitle(q) {
        return firstLine(q.itemDescription || q.itemType || q.title || 'Transport request', 80);
    }

    function getFromTo(q) {
        const a = [q.pickupCity, q.pickupPostcode].filter(Boolean).join(', ');
        const b = [q.deliveryCity, q.deliveryPostcode].filter(Boolean).join(', ');
        if (!a && !b) return '—';
        return (a || '—') + ' → ' + (b || '—');
    }

    function countBidsForQuote(quoteId, bids) {
        const id = String(quoteId || '').trim();
        if (!id || !Array.isArray(bids)) return 0;
        return bids.filter(function (b) {
            return String(b.quoteId || '') === id && String(b.status || 'active') === 'active';
        }).length;
    }

    function getNewestActiveBidForQuote(quoteId, bids) {
        const id = String(quoteId || '').trim();
        if (!id || !Array.isArray(bids)) return null;
        const active = bids.filter(function (b) {
            return String(b.quoteId || '') === id && String(b.status || 'active') === 'active';
        });
        if (!active.length) return null;
        active.sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
        return active[0];
    }

    function getActiveBidsForQuote(quoteId, bids) {
        const id = String(quoteId || '').trim();
        if (!id || !Array.isArray(bids)) return [];
        return bids.filter(function (b) {
            return String(b.quoteId || '') === id && String(b.status || 'active') === 'active';
        }).sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });
    }

    function getBidProviderLabel(bid) {
        if (!bid || typeof bid !== 'object') return 'Provider';
        return firstLine(
            bid.providerName
            || bid.providerUsername
            || bid.providerNickname
            || bid.providerEmail
            || bid.providerId
            || 'Provider',
            80
        );
    }

    function createFormMessageThreadsMarkup(quoteId, activeBids) {
        const qid = String(quoteId || '').trim();
        if (!qid) return '';
        if (!Array.isArray(activeBids) || !activeBids.length) {
            return '<div class="customer-form-msg-empty" style="margin-top:8px; color:#64748b; font-size:12px;">No bid messages yet for this form.</div>';
        }
        return [
            '<div class="customer-form-msg-threads" style="margin-top:10px; display:flex; flex-direction:column; gap:8px;">',
            activeBids.map(function (bid) {
                const amount = Number(bid && bid.amount);
                const amountLabel = Number.isFinite(amount) ? ('€' + amount.toFixed(2)) : '—';
                const providerLabel = escapeHtml(getBidProviderLabel(bid));
                const bidMessage = escapeHtml(firstLine(bid && bid.message, 160) || 'No bid note provided.');
                const bidWhen = escapeHtml(formatWhen(bid && bid.createdAt));
                const toUserId = String((bid && bid.providerId) || '').trim();
                const bidId = String((bid && bid.id) || '').trim();
                const openHref = 'messages.html?quoteId=' + encodeURIComponent(qid)
                    + '&bidId=' + encodeURIComponent(bidId)
                    + '&to=' + encodeURIComponent(toUserId);
                return [
                    '<div class="customer-form-msg-thread" style="padding:8px; border:1px solid #e2e8f0; border-radius:8px; background:#fff;">',
                    '<div style="display:flex; gap:8px; align-items:center; justify-content:space-between; flex-wrap:wrap;">',
                    '<strong style="font-size:12px; color:#0f172a;">' + providerLabel + '</strong>',
                    '<span style="font-size:12px; color:#475569;">' + escapeHtml(amountLabel) + ' · ' + bidWhen + '</span>',
                    '</div>',
                    '<div style="font-size:12px; color:#334155; margin-top:4px;">' + bidMessage + '</div>',
                    '<a class="btn btn-secondary btn-sm" href="' + openHref + '" style="display:inline-flex; align-items:center; margin-top:8px;">Open chat</a>',
                    '</div>'
                ].join('');
            }).join(''),
            '</div>'
        ].join('');
    }

    function loadAllBids() {
        if (!window.anytransportApi || typeof window.anytransportApi.getBids !== 'function') {
            return [];
        }
        try {
            return window.anytransportApi.getBids('') || [];
        } catch (e) {
            if (isAtDebug()) {
                console.debug('[AnyTransport] customer-dashboard loadAllBids', e);
            }
            return [];
        }
    }

    var LISTING_STORAGE_KEY = 'anytransport_quote_requests';

    function quoteBelongsToUser(q, userId, userEmail) {
        var uid = String(userId || '').trim();
        var owner = String((q && (q.userId || q.createdBy)) || '').trim();
        if (owner && uid && owner === uid) {
            return true;
        }
        var a = String(userEmail || '').trim().toLowerCase();
        var b = String((q && q.customerEmail) || '').trim().toLowerCase();
        if (a && b && a === b) {
            return true;
        }
        return false;
    }

    /** Merge server quotes with localStorage fallback (create-job saves locally when API save fails). */
    function loadQuotesMerged(userId, userEmail) {
        var apiQuotes = [];
        if (window.anytransportApi && typeof window.anytransportApi.getQuotes === 'function') {
            try {
                apiQuotes = window.anytransportApi.getQuotes() || [];
            } catch (e) {
                if (isAtDebug()) {
                    console.debug('[AnyTransport] customer-dashboard getQuotes (using local merge if any)', e);
                }
                apiQuotes = [];
            }
        }

        var localQuotes = [];
        try {
            var raw = localStorage.getItem(LISTING_STORAGE_KEY);
            var parsed = JSON.parse(raw || '[]');
            if (Array.isArray(parsed)) {
                localQuotes = parsed.filter(function (q) {
                    return quoteBelongsToUser(q, userId, userEmail);
                });
            }
        } catch (_e) {
            localQuotes = [];
        }

        var byId = new Map();
        apiQuotes.forEach(function (q) {
            if (q && q.id) {
                byId.set(String(q.id), q);
            }
        });
        localQuotes.forEach(function (q) {
            if (q && q.id) {
                var id = String(q.id);
                if (!byId.has(id)) {
                    byId.set(id, q);
                }
            }
        });
        return Array.from(byId.values());
    }

    function renderQuotes(quotes, bids, highlightFormId) {
        const el = document.getElementById('customer-quotes-body');
        if (!el) return;

        if (!quotes.length) {
            el.innerHTML = '<tr><td colspan="6" class="customer-empty-cell">You have not submitted any request forms yet. <a href="index.html#services">Create a request</a>.</td></tr>';
            return;
        }

        const sorted = quotes.slice().sort(function (a, b) {
            return new Date(b.submittedAt || b.updatedAt || b.createdAt || 0) - new Date(a.submittedAt || a.updatedAt || a.createdAt || 0);
        });

        el.innerHTML = sorted.map(function (q) {
            const fid = getQuoteLabel(q);
            const isHi = highlightFormId && String(q.formId || '').trim() === highlightFormId;
            const bidN = countBidsForQuote(q.id, bids);
            const activeBids = getActiveBidsForQuote(q.id, bids);
            const status = escapeHtml(String(q.status || 'pending'));
            const messagesAction = createFormMessageThreadsMarkup(q.id, activeBids);
            return [
                '<tr class="customer-quote-row' + (isHi ? ' customer-quote-row--highlight' : '') + '" data-form-id="' + escapeHtml(String(q.formId || '')) + '">',
                '<td><strong>' + escapeHtml(fid) + '</strong></td>',
                '<td>' + formatWhen(q.submittedAt || q.createdAt) + '</td>',
                '<td>' + escapeHtml(getServiceTitle(q)) + '</td>',
                '<td class="customer-from-to">' + escapeHtml(getFromTo(q)) + '</td>',
                '<td><span class="customer-status customer-status--' + status.toLowerCase().replace(/\s+/g, '-') + '">' + status + '</span></td>',
                '<td class="customer-actions">',
                '<span class="customer-bid-count">' + bidN + '</span>',
                '<a class="btn btn-outline btn-sm" href="listing-details.html?quoteId=' + encodeURIComponent(q.id) + '">View</a> ',
                '<a class="btn btn-primary btn-sm" href="create-job.html?editQuote=' + encodeURIComponent(q.id) + '">Edit</a> ',
                '<button type="button" class="btn btn-danger btn-sm customer-delete-quote-btn" data-quote-id="' + escapeHtml(String(q.id || '')) + '">Delete</button> ',
                messagesAction,
                '</td></tr>'
            ].join('');
        }).join('');
    }

    function deleteQuoteForUser(authRef, user, quoteId) {
        const id = String(quoteId || '').trim();
        if (!id) return false;
        if (!confirm('Delete this request form? This cannot be undone.')) return false;

        try {
            if (window.anytransportApi && typeof window.anytransportApi.deleteQuote === 'function') {
                window.anytransportApi.deleteQuote(id);
            } else {
                const raw = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
                const filtered = Array.isArray(raw) ? raw.filter(function (q) {
                    return String(q && q.id || '') !== id;
                }) : [];
                localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify(filtered));
            }
        } catch (error) {
            alert(error && error.message ? error.message : 'Unable to delete this form right now.');
            return false;
        }

        const quotes = loadQuotesMerged(user.id, user.email || '');
        const bids = loadAllBids();
        renderQuotes(quotes, bids, '');
        return true;
    }

    function renderMessages(userId, messages) {
        const el = document.getElementById('customer-messages-list');
        if (!el) return;

        const mine = (messages || []).filter(function (m) {
            return String(m.fromUserId || '') === String(userId) || String(m.toUserId || '') === String(userId);
        });

        mine.sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        });

        if (!mine.length) {
            el.innerHTML = '<p class="customer-empty">No messages yet. When providers respond to your listings, they appear here.</p>';
            return;
        }

        el.innerHTML = mine.map(function (m) {
            const incoming = String(m.toUserId || '') === String(userId);
            const otherUserId = incoming ? String(m.fromUserId || '') : String(m.toUserId || '');
            const title = escapeHtml(m.title || 'Message');
            const preview = escapeHtml(firstLine(m.text, 220));
            const when = formatWhen(m.createdAt);
            const dir = incoming ? 'In' : 'Out';
            const openHref = 'messages.html?to=' + encodeURIComponent(otherUserId);
            return [
                '<article class="customer-msg-card customer-msg-card--' + (incoming ? 'in' : 'out') + '">',
                '<div class="customer-msg-meta"><span class="customer-msg-dir">' + dir + '</span> · ' + escapeHtml(when) + '</div>',
                '<h4 class="customer-msg-title">' + title + '</h4>',
                '<p class="customer-msg-text">' + preview + '</p>',
                '<a class="btn btn-secondary btn-sm" href="' + openHref + '" style="display:inline-flex; align-items:center; margin-top:8px;">View message</a>',
                '</article>'
            ].join('');
        }).join('');
    }

    function getIncomingMessageTimestamps(userId, messages) {
        return (messages || [])
            .filter(function (m) {
                return String(m && m.toUserId || '') === String(userId || '');
            })
            .map(function (m) {
                return new Date(m && m.createdAt || 0).getTime() || 0;
            })
            .filter(function (ts) { return ts > 0; });
    }

    function getMessageSeenStorageKey(userId) {
        return 'anytransport_customer_msg_seen_ts_' + String(userId || '').trim();
    }

    function getLastSeenMessageTs(userId) {
        try {
            return Number(localStorage.getItem(getMessageSeenStorageKey(userId)) || 0) || 0;
        } catch (_e) {
            return 0;
        }
    }

    function setLastSeenMessageTs(userId, ts) {
        try {
            localStorage.setItem(getMessageSeenStorageKey(userId), String(Number(ts || 0) || 0));
        } catch (_e) {}
    }

    function renderNavbarMessageBadge(userId, messages) {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        const incomingTs = getIncomingMessageTimestamps(userId, messages);
        const lastSeenTs = getLastSeenMessageTs(userId);
        const unread = incomingTs.filter(function (ts) { return ts > lastSeenTs; }).length;
        if (unread > 0) {
            badge.style.display = 'inline-flex';
            badge.textContent = unread > 99 ? '99+' : String(unread);
        } else {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
    }

    function loadMessagesForUser(userId) {
        if (!window.anytransportApi || typeof window.anytransportApi.getSavedMessages !== 'function') {
            return [];
        }
        try {
            return window.anytransportApi.getSavedMessages(userId) || [];
        } catch (_e) {
            return [];
        }
    }

    function setSettingsStatus(message, isError) {
        const statusEl = document.getElementById('customer-settings-status');
        if (!statusEl) return;
        statusEl.textContent = String(message || '');
        statusEl.style.color = isError ? '#b42318' : '#166534';
    }

    function wireAccountSettings(authRef, user) {
        const form = document.getElementById('customer-account-form');
        if (!form) return;

        const nameInput = document.getElementById('customer-settings-name');
        const usernameInput = document.getElementById('customer-settings-username');
        const emailInput = document.getElementById('customer-settings-email');
        const currentPasswordInput = document.getElementById('customer-settings-current-password');
        const newPasswordInput = document.getElementById('customer-settings-new-password');
        const confirmPasswordInput = document.getElementById('customer-settings-confirm-password');

        if (nameInput) nameInput.value = String(user.name || '');
        if (usernameInput) usernameInput.value = String(user.username || user.nickname || '');
        if (emailInput) emailInput.value = String(user.email || '');

        form.addEventListener('submit', function (event) {
            event.preventDefault();
            setSettingsStatus('', false);

            if (!window.anytransportApi || typeof window.anytransportApi.updateAccountSettings !== 'function') {
                setSettingsStatus('Account updates are not available right now. Please try again later.', true);
                return;
            }

            const name = String(nameInput && nameInput.value || '').trim();
            const username = String(usernameInput && usernameInput.value || '').trim();
            const email = String(emailInput && emailInput.value || '').trim();
            const currentPassword = String(currentPasswordInput && currentPasswordInput.value || '');
            const newPassword = String(newPasswordInput && newPasswordInput.value || '');
            const confirmNewPassword = String(confirmPasswordInput && confirmPasswordInput.value || '');

            if (!name || !username || !email) {
                setSettingsStatus('Name, username, and email are required.', true);
                return;
            }

            if (newPassword && newPassword !== confirmNewPassword) {
                setSettingsStatus('New password and confirmation do not match.', true);
                return;
            }

            try {
                const updatedUser = window.anytransportApi.updateAccountSettings({
                    name: name,
                    username: username,
                    email: email,
                    currentPassword: currentPassword,
                    newPassword: newPassword
                });
                if (!updatedUser || !updatedUser.id) {
                    setSettingsStatus('Unable to save your settings right now.', true);
                    return;
                }

                authRef.currentUser = updatedUser;
                localStorage.setItem('anytransport_user', JSON.stringify(updatedUser));
                if (typeof authRef.initAuth === 'function') {
                    authRef.initAuth();
                }

                const nameEl = document.getElementById('customer-user-name');
                if (nameEl) {
                    nameEl.textContent = updatedUser.username || updatedUser.name || updatedUser.email || 'Customer';
                }

                if (currentPasswordInput) currentPasswordInput.value = '';
                if (newPasswordInput) newPasswordInput.value = '';
                if (confirmPasswordInput) confirmPasswordInput.value = '';
                setSettingsStatus('Your account settings have been updated.', false);
            } catch (error) {
                setSettingsStatus(error && error.message ? error.message : 'Unable to save settings.', true);
            }
        });
    }

    function init() {
        var authRef = window.auth;
        if (!authRef || typeof authRef.isLoggedIn !== 'function' || !authRef.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }

        const user = authRef.getUser();
        if (!user || !user.id) {
            window.location.href = 'index.html';
            return;
        }

        const nameEl = document.getElementById('customer-user-name');
        if (nameEl) {
            nameEl.textContent = user.username || user.name || user.email || 'Customer';
        }

        var pdLink = document.getElementById('provider-dashboard-link');
        var showProviderDashNav = false;
        try {
            showProviderDashNav = typeof authRef.isProvider === 'function' && authRef.isProvider();
            if (!showProviderDashNav && typeof authRef.isAdmin === 'function') {
                showProviderDashNav = authRef.isAdmin();
            }
        } catch (_e) {}
        if (pdLink && !showProviderDashNav) {
            pdLink.style.display = 'none';
        }

        let highlightFormId = '';
        try {
            highlightFormId = String(new URLSearchParams(window.location.search || '').get('highlightForm') || '').trim();
        } catch (_e) {
            highlightFormId = '';
        }

        const quotes = loadQuotesMerged(user.id, user.email || '');

        const bids = loadAllBids();
        renderQuotes(quotes, bids, highlightFormId);

        let messages = loadMessagesForUser(user.id);
        renderMessages(user.id, messages);
        renderNavbarMessageBadge(user.id, messages);
        wireAccountSettings(authRef, user);

        const quotesBody = document.getElementById('customer-quotes-body');
        if (quotesBody) {
            quotesBody.addEventListener('click', function (event) {
                const deleteBtn = event.target.closest('.customer-delete-quote-btn');
                if (!deleteBtn) return;
                const quoteId = String(deleteBtn.getAttribute('data-quote-id') || '').trim();
                deleteQuoteForUser(authRef, user, quoteId);
            });
        }

        document.querySelectorAll('.customer-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const tab = btn.getAttribute('data-tab');
                document.querySelectorAll('.customer-tab-btn').forEach(function (b) {
                    b.classList.toggle('active', b === btn);
                });
                document.querySelectorAll('.customer-tab-panel').forEach(function (p) {
                    p.classList.toggle('active', p.getAttribute('data-panel') === tab);
                });
                if (tab === 'messages') {
                    const latestMessages = loadMessagesForUser(user.id);
                    renderMessages(user.id, latestMessages);
                    const incomingTs = getIncomingMessageTimestamps(user.id, latestMessages);
                    const newest = incomingTs.length ? Math.max.apply(null, incomingTs) : 0;
                    if (newest > 0) {
                        setLastSeenMessageTs(user.id, newest);
                    }
                    renderNavbarMessageBadge(user.id, latestMessages);
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
