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
            const newestBid = getNewestActiveBidForQuote(q.id, bids);
            const status = escapeHtml(String(q.status || 'pending'));
            const messagesAction = newestBid
                ? '<a class="btn btn-outline btn-sm" href="messages.html?quoteId=' + encodeURIComponent(q.id) + '&bidId=' + encodeURIComponent(newestBid.id || '') + '&to=' + encodeURIComponent(newestBid.providerId || '') + '">Messages</a>'
                : '<span class="btn btn-outline btn-sm" style="opacity:.5; pointer-events:none;">Messages</span>';
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
                '<a class="btn btn-outline btn-sm" href="' + openHref + '">Open chatroom</a>',
                '</article>'
            ].join('');
        }).join('');
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
                    renderMessages(user.id, loadMessagesForUser(user.id));
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
