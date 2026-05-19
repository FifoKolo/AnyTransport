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

    function sortGroupedBids(activeBids, sortMode) {
        const mode = String(sortMode || 'newest').trim().toLowerCase();
        const sorted = Array.isArray(activeBids) ? activeBids.slice() : [];
        if (mode === 'lowest') {
            sorted.sort(function (a, b) {
                return (Number(a && a.amount) || 0) - (Number(b && b.amount) || 0);
            });
            return sorted;
        }
        if (mode === 'highest') {
            sorted.sort(function (a, b) {
                return (Number(b && b.amount) || 0) - (Number(a && a.amount) || 0);
            });
            return sorted;
        }
        if (mode === 'provider') {
            sorted.sort(function (a, b) {
                return getBidProviderLabel(a).localeCompare(getBidProviderLabel(b), undefined, { sensitivity: 'base' });
            });
            return sorted;
        }
        sorted.sort(function (a, b) {
            return new Date(b && b.createdAt || 0) - new Date(a && a.createdAt || 0);
        });
        return sorted;
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
            const status = escapeHtml(String(q.status || 'pending'));
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
                '<button type="button" class="btn btn-secondary btn-sm customer-open-form-messages-btn" data-quote-id="' + escapeHtml(String(q.id || '')) + '" data-form-id="' + escapeHtml(String(fid || '')) + '" style="display:inline-flex; align-items:center; margin-top:8px;">View grouped messages</button>',
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
                '<a class="btn btn-secondary btn-sm" href="' + openHref + '" onclick="if(window.setNavbarReturnUrl){setNavbarReturnUrl(window.location.href);}" style="display:inline-flex; align-items:center; margin-top:8px;">View message</a>',
                '</article>'
            ].join('');
        }).join('');
    }

    function renderMessageGroupsIndex(quotes, bids) {
        const el = document.getElementById('customer-messages-list');
        if (!el) return;
        const list = Array.isArray(quotes) ? quotes.slice() : [];
        if (!list.length) {
            el.innerHTML = '<p class="customer-empty">No forms yet. Submit a request to receive provider bids.</p>';
            return;
        }

        const rows = list.map(function (quote) {
            const quoteId = String(quote && quote.id || '').trim();
            if (!quoteId) return '';
            const activeBids = getActiveBidsForQuote(quoteId, bids);
            const latestBid = activeBids.length ? activeBids[0] : null;
            const formLabel = getQuoteLabel(quote);
            const summaryText = latestBid
                ? firstLine(latestBid.message, 150)
                : 'No bids yet for this form.';
            const latestWhen = latestBid ? formatWhen(latestBid.createdAt) : formatWhen(quote.submittedAt || quote.createdAt);
            return [
                '<article class="customer-msg-card customer-msg-card--in" style="margin-bottom:12px;">',
                '<div class="customer-msg-meta">Form ' + escapeHtml(formLabel) + ' · ' + escapeHtml(latestWhen) + '</div>',
                '<h4 class="customer-msg-title">' + escapeHtml(getServiceTitle(quote)) + '</h4>',
                '<p class="customer-msg-text">' + escapeHtml(summaryText) + '</p>',
                '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px;">',
                '<span class="customer-bid-count">' + activeBids.length + '</span>',
                '<button type="button" class="btn btn-secondary btn-sm customer-open-form-group-btn" data-quote-id="' + escapeHtml(quoteId) + '" data-form-id="' + escapeHtml(formLabel) + '">Open group</button>',
                '</div>',
                '</article>'
            ].join('');
        }).filter(Boolean);

        el.innerHTML = rows.length
            ? rows.join('')
            : '<p class="customer-empty">No grouped bid messages found yet.</p>';
    }

    function activateTab(tabName) {
        document.querySelectorAll('.customer-tab-btn').forEach(function (b) {
            b.classList.toggle('active', b.getAttribute('data-tab') === tabName);
        });
        document.querySelectorAll('.customer-tab-panel').forEach(function (p) {
            p.classList.toggle('active', p.getAttribute('data-panel') === tabName);
        });
    }

    function renderGroupedMessagesForQuote(userId, quoteId, formIdLabel, bids, sortMode) {
        const el = document.getElementById('customer-messages-list');
        if (!el) return;
        const qid = String(quoteId || '').trim();
        const formLabel = String(formIdLabel || '').trim() || '—';
        const activeSortMode = String(sortMode || 'newest').trim().toLowerCase();
        if (!qid) {
            el.innerHTML = '<p class="customer-empty">Unable to load grouped messages for this form.</p>';
            return;
        }
        const groupedBids = sortGroupedBids(getActiveBidsForQuote(qid, bids), activeSortMode);
        if (!groupedBids.length) {
            el.innerHTML = [
                '<article class="customer-msg-card customer-msg-card--in">',
                '<div class="customer-msg-meta">Form ' + escapeHtml(formLabel) + '</div>',
                '<h4 class="customer-msg-title">No bids yet</h4>',
                '<p class="customer-msg-text">This form has no active bids/messages yet.</p>',
                '<button type="button" class="btn btn-outline btn-sm customer-back-to-groups-btn" style="margin-top:8px;">Back to grouped forms</button>',
                '</article>'
            ].join('');
            return;
        }
        el.innerHTML = [
            '<article class="customer-msg-card customer-msg-card--in">',
            '<div class="customer-msg-meta">Grouped by form</div>',
            '<h4 class="customer-msg-title">Form ' + escapeHtml(formLabel) + ' · ' + groupedBids.length + ' bid' + (groupedBids.length === 1 ? '' : 's') + '</h4>',
            '<p class="customer-msg-text">All bid messages for this form are listed below.</p>',
            '<div style="margin-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">',
            '<label for="customer-group-sort-select" style="font-size:12px; color:#334155; font-weight:600;">Sort bids</label>',
            '<select id="customer-group-sort-select" class="form-input customer-group-sort-select" data-quote-id="' + escapeHtml(qid) + '" data-form-id="' + escapeHtml(formLabel) + '" style="max-width:240px;">',
            '<option value="newest"' + (activeSortMode === 'newest' ? ' selected' : '') + '>Newest bid</option>',
            '<option value="lowest"' + (activeSortMode === 'lowest' ? ' selected' : '') + '>Lowest bid</option>',
            '<option value="highest"' + (activeSortMode === 'highest' ? ' selected' : '') + '>Highest bid</option>',
            '<option value="provider"' + (activeSortMode === 'provider' ? ' selected' : '') + '>Provider name</option>',
            '</select>',
            '</div>',
            '<button type="button" class="btn btn-outline btn-sm customer-back-to-groups-btn" style="margin-top:8px;">Back to grouped forms</button>',
            '</article>',
            groupedBids.map(function (bid) {
                const incoming = String(bid && bid.providerId || '') !== String(userId || '');
                const providerLabel = escapeHtml(getBidProviderLabel(bid));
                const amount = Number(bid && bid.amount);
                const amountLabel = Number.isFinite(amount) ? ('€' + amount.toFixed(2)) : '—';
                const preview = escapeHtml(firstLine(bid && bid.message, 220) || 'No bid note provided.');
                const when = escapeHtml(formatWhen(bid && bid.createdAt));
                const dir = incoming ? 'In' : 'Out';
                const openHref = 'messages.html?quoteId=' + encodeURIComponent(qid)
                    + '&bidId=' + encodeURIComponent(String(bid && bid.id || ''))
                    + '&to=' + encodeURIComponent(String(bid && bid.providerId || ''));
                return [
                    '<article class="customer-msg-card customer-msg-card--' + (incoming ? 'in' : 'out') + '">',
                    '<div class="customer-msg-meta"><span class="customer-msg-dir">' + dir + '</span> · ' + when + ' · ' + escapeHtml(amountLabel) + '</div>',
                    '<h4 class="customer-msg-title">' + providerLabel + '</h4>',
                    '<p class="customer-msg-text">' + preview + '</p>',
                    '<a class="btn btn-secondary btn-sm" href="' + openHref + '" onclick="if(window.setNavbarReturnUrl){setNavbarReturnUrl(window.location.href);}" style="display:inline-flex; align-items:center; margin-top:8px;">Open chat</a>',
                    '</article>'
                ].join('');
            }).join('')
        ].join('');
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
        renderMessageGroupsIndex(quotes, bids);
        renderNavbarMessageBadge(user.id, messages);

        const quotesBody = document.getElementById('customer-quotes-body');
        if (quotesBody) {
            quotesBody.addEventListener('click', function (event) {
                const deleteBtn = event.target.closest('.customer-delete-quote-btn');
                if (deleteBtn) {
                    const quoteId = String(deleteBtn.getAttribute('data-quote-id') || '').trim();
                    deleteQuoteForUser(authRef, user, quoteId);
                    return;
                }

                const groupedBtn = event.target.closest('.customer-open-form-messages-btn');
                if (!groupedBtn) return;
                const quoteId = String(groupedBtn.getAttribute('data-quote-id') || '').trim();
                const formId = String(groupedBtn.getAttribute('data-form-id') || '').trim();
                const latestBids = loadAllBids();
                renderGroupedMessagesForQuote(user.id, quoteId, formId, latestBids, 'newest');
                activateTab('inbox');
                const incomingTs = getIncomingMessageTimestamps(user.id, loadMessagesForUser(user.id));
                const newest = incomingTs.length ? Math.max.apply(null, incomingTs) : 0;
                if (newest > 0) {
                    setLastSeenMessageTs(user.id, newest);
                }
                renderNavbarMessageBadge(user.id, loadMessagesForUser(user.id));
            });
        }

        const inboxList = document.getElementById('customer-messages-list');
        if (inboxList) {
            inboxList.addEventListener('click', function (event) {
                const backBtn = event.target.closest('.customer-back-to-groups-btn');
                if (backBtn) {
                    const latestQuotes = loadQuotesMerged(user.id, user.email || '');
                    const latestBids = loadAllBids();
                    renderMessageGroupsIndex(latestQuotes, latestBids);
                    return;
                }
                const openGroupBtn = event.target.closest('.customer-open-form-group-btn');
                if (!openGroupBtn) return;
                const quoteId = String(openGroupBtn.getAttribute('data-quote-id') || '').trim();
                const formId = String(openGroupBtn.getAttribute('data-form-id') || '').trim();
                const latestBids = loadAllBids();
                renderGroupedMessagesForQuote(user.id, quoteId, formId, latestBids, 'newest');
            });
            inboxList.addEventListener('change', function (event) {
                const sortSelect = event.target.closest('.customer-group-sort-select');
                if (!sortSelect) return;
                const quoteId = String(sortSelect.getAttribute('data-quote-id') || '').trim();
                const formId = String(sortSelect.getAttribute('data-form-id') || '').trim();
                const sortMode = String(sortSelect.value || 'newest').trim().toLowerCase();
                const latestBids = loadAllBids();
                renderGroupedMessagesForQuote(user.id, quoteId, formId, latestBids, sortMode);
            });
        }

        document.querySelectorAll('.customer-tab-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const tab = btn.getAttribute('data-tab');
                activateTab(tab);
                if (tab === 'inbox') {
                    const latestQuotes = loadQuotesMerged(user.id, user.email || '');
                    const latestBids = loadAllBids();
                    const latestMessages = loadMessagesForUser(user.id);
                    renderMessageGroupsIndex(latestQuotes, latestBids);
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
