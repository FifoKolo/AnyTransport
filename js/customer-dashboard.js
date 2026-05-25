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

    function parseBudgetAmount(value) {
        const n = parseFloat(String(value == null ? '' : value).replace(/,/g, ''));
        return Number.isFinite(n) && n >= 0 ? n : null;
    }

    function formatEuro(amount) {
        const n = parseBudgetAmount(amount);
        if (n == null) return '';
        return '€' + Math.round(n).toLocaleString('en-IE');
    }

    function formatCustomerBudgetLabel(q) {
        if (!q || typeof q !== 'object') return '';
        const mode = String(q.customerBudgetMode || '').trim();
        const min = parseBudgetAmount(q.customerBudgetMin);
        const max = parseBudgetAmount(q.customerBudgetMax);
        if (mode === 'flexible') return 'Flexible / open to quotes';
        if (mode === 'up_to' && max != null) return 'Up to ' + formatEuro(max);
        if (mode === 'range' && min != null && max != null) {
            if (Math.abs(min - max) < 0.01) return formatEuro(min);
            return formatEuro(min) + ' – ' + formatEuro(max);
        }
        if (max != null) return 'Up to ' + formatEuro(max);
        if (min != null) return 'From ' + formatEuro(min);
        return '';
    }

    function isSubdomainDashboardPath() {
        try {
            return String(window.location.pathname || '').indexOf('subdomain-dashboard') >= 0;
        } catch (_e) {
            return false;
        }
    }

    function getListingDetailsPage() {
        return isSubdomainDashboardPath() ? '../listing-details.html' : 'listing-details.html';
    }

    function getCreateJobPage() {
        return isSubdomainDashboardPath() ? '../create-job.html' : 'create-job.html';
    }

    function getListingViewHref(q) {
        const base = getListingDetailsPage();
        const id = String(q && q.id || '').trim();
        const formId = String(q && q.formId || '').trim();
        if (id) {
            return base + '?quoteId=' + encodeURIComponent(id);
        }
        if (formId) {
            return base + '?id=' + encodeURIComponent(formId);
        }
        return '';
    }

    function buildBudgetFieldsFromModal() {
        const mode = String(document.getElementById('customer-budget-edit-mode')?.value || '').trim();
        const fields = {
            customerBudgetMode: mode,
            customerBudgetMin: null,
            customerBudgetMax: null
        };
        if (mode === 'up_to') {
            const maxVal = parseBudgetAmount(document.getElementById('customer-budget-edit-max-only')?.value);
            if (maxVal != null) fields.customerBudgetMax = maxVal;
        } else if (mode === 'range') {
            const minVal = parseBudgetAmount(document.getElementById('customer-budget-edit-min')?.value);
            const maxVal = parseBudgetAmount(document.getElementById('customer-budget-edit-max')?.value);
            if (minVal != null) fields.customerBudgetMin = minVal;
            if (maxVal != null) fields.customerBudgetMax = maxVal;
        }
        return fields;
    }

    function syncBudgetModalPanels() {
        const mode = String(document.getElementById('customer-budget-edit-mode')?.value || '').trim();
        document.querySelectorAll('.customer-budget-mode-btn').forEach(function (btn) {
            const active = String(btn.getAttribute('data-mode') || '') === mode;
            btn.classList.toggle('is-active', active);
        });
        const upTo = document.getElementById('customer-budget-edit-up-to');
        const range = document.getElementById('customer-budget-edit-range');
        if (upTo) upTo.hidden = mode !== 'up_to';
        if (range) range.hidden = mode !== 'range';
    }

    function fillBudgetModalFromQuote(q) {
        const mode = String(q && q.customerBudgetMode || '').trim();
        const modeEl = document.getElementById('customer-budget-edit-mode');
        if (modeEl) modeEl.value = mode;
        const maxOnly = document.getElementById('customer-budget-edit-max-only');
        const minInput = document.getElementById('customer-budget-edit-min');
        const maxInput = document.getElementById('customer-budget-edit-max');
        if (mode === 'up_to') {
            const max = parseBudgetAmount(q.customerBudgetMax ?? q.customerBudgetMin);
            if (maxOnly && max != null) maxOnly.value = String(Math.round(max));
        } else if (mode === 'range') {
            const min = parseBudgetAmount(q.customerBudgetMin);
            const max = parseBudgetAmount(q.customerBudgetMax);
            if (minInput && min != null) minInput.value = String(Math.round(min));
            if (maxInput && max != null) maxInput.value = String(Math.round(max));
        } else {
            if (maxOnly) maxOnly.value = '';
            if (minInput) minInput.value = '';
            if (maxInput) maxInput.value = '';
        }
        syncBudgetModalPanels();
    }

    let budgetEditQuoteId = '';

    function openBudgetModal(q) {
        const modal = document.getElementById('customer-budget-modal');
        if (!modal || !q) return;
        budgetEditQuoteId = String(q.id || '').trim();
        if (!budgetEditQuoteId) {
            alert('This form cannot be updated (missing ID).');
            return;
        }
        const label = document.getElementById('customer-budget-form-label');
        if (label) {
            label.textContent = 'Form #' + getQuoteLabel(q);
        }
        const status = document.getElementById('customer-budget-save-status');
        if (status) {
            status.textContent = '';
            status.classList.remove('is-error');
        }
        fillBudgetModalFromQuote(q);
        modal.hidden = false;
        modal.classList.add('is-open');
    }

    function closeBudgetModal() {
        const modal = document.getElementById('customer-budget-modal');
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.hidden = true;
        budgetEditQuoteId = '';
    }

    function saveBudgetForQuote(authRef, user, quoteId, budgetFields, highlightFormId) {
        const id = String(quoteId || '').trim();
        if (!id) return false;

        let quote = null;
        if (window.anytransportApi && typeof window.anytransportApi.getQuote === 'function') {
            try {
                quote = window.anytransportApi.getQuote(id);
            } catch (_e) {
                quote = null;
            }
        }
        if (!quote) {
            const merged = loadQuotesMerged(user.id, user.email || '');
            quote = merged.find(function (entry) {
                return String(entry && entry.id || '') === id;
            }) || null;
        }
        if (!quote) {
            alert('Request form not found.');
            return false;
        }

        const payload = Object.assign({}, quote, budgetFields, { id: id });
        try {
            if (window.anytransportApi && typeof window.anytransportApi.saveQuote === 'function') {
                window.anytransportApi.saveQuote(payload);
            } else {
                const raw = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
                const list = Array.isArray(raw) ? raw.slice() : [];
                const idx = list.findIndex(function (entry) {
                    return String(entry && entry.id || '') === id;
                });
                if (idx >= 0) {
                    list[idx] = Object.assign({}, list[idx], budgetFields);
                } else {
                    list.push(payload);
                }
                localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify(list));
            }
        } catch (error) {
            alert(error && error.message ? error.message : 'Unable to save budget.');
            return false;
        }

        const quotes = loadQuotesMerged(user.id, user.email || '');
        const bids = loadAllBids();
        renderQuotes(quotes, bids, highlightFormId);
        return true;
    }

    function wireBudgetModal(authRef, user, highlightFormId) {
        const modal = document.getElementById('customer-budget-modal');
        if (!modal || modal.dataset.wired === '1') return;
        modal.dataset.wired = '1';

        document.querySelectorAll('.customer-budget-mode-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const modeEl = document.getElementById('customer-budget-edit-mode');
                if (modeEl) modeEl.value = String(btn.getAttribute('data-mode') || '');
                syncBudgetModalPanels();
            });
        });

        const cancelBtn = document.getElementById('customer-budget-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', closeBudgetModal);

        modal.addEventListener('click', function (event) {
            if (event.target === modal) closeBudgetModal();
        });

        const saveBtn = document.getElementById('customer-budget-save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', function () {
                const status = document.getElementById('customer-budget-save-status');
                const fields = buildBudgetFieldsFromModal();
                const mode = fields.customerBudgetMode;
                if (mode === 'up_to' && fields.customerBudgetMax == null) {
                    if (status) {
                        status.textContent = 'Enter a maximum budget amount.';
                        status.classList.add('is-error');
                    }
                    return;
                }
                if (mode === 'range' && (fields.customerBudgetMin == null || fields.customerBudgetMax == null)) {
                    if (status) {
                        status.textContent = 'Enter both minimum and maximum for a range.';
                        status.classList.add('is-error');
                    }
                    return;
                }
                saveBtn.disabled = true;
                if (status) {
                    status.textContent = 'Saving…';
                    status.classList.remove('is-error');
                }
                const ok = saveBudgetForQuote(authRef, user, budgetEditQuoteId, fields, highlightFormId);
                saveBtn.disabled = false;
                if (ok) {
                    closeBudgetModal();
                } else if (status) {
                    status.textContent = 'Save failed.';
                    status.classList.add('is-error');
                }
            });
        }
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
            el.innerHTML = '<tr><td colspan="7" class="customer-empty-cell">You have not submitted any request forms yet. <a href="index.html#services">Create a request</a>.</td></tr>';
            return;
        }

        const sorted = quotes.slice().sort(function (a, b) {
            return new Date(b.submittedAt || b.updatedAt || b.createdAt || 0) - new Date(a.submittedAt || a.updatedAt || a.createdAt || 0);
        });

        el.innerHTML = sorted.map(function (q) {
            const fid = getQuoteLabel(q);
            const quoteId = String(q.id || '').trim();
            const isHi = highlightFormId && String(q.formId || '').trim() === highlightFormId;
            const bidN = countBidsForQuote(q.id, bids);
            const status = escapeHtml(String(q.status || 'pending'));
            const budgetLabel = formatCustomerBudgetLabel(q) || 'Not set';
            const viewHref = getListingViewHref(q);
            const viewListingBtn = viewHref
                ? '<a class="btn btn-sm customer-view-listing-btn" href="' + escapeHtml(viewHref) + '" onclick="if(window.setNavbarReturnUrl){setNavbarReturnUrl(window.location.href);}">View listing</a>'
                : '';
            const editQuoteHref = quoteId
                ? getCreateJobPage() + '?editQuote=' + encodeURIComponent(quoteId)
                : '';
            return [
                '<tr class="customer-quote-row' + (isHi ? ' customer-quote-row--highlight' : '') + '" data-form-id="' + escapeHtml(String(q.formId || '')) + '" data-quote-id="' + escapeHtml(quoteId) + '">',
                '<td><strong>' + escapeHtml(fid) + '</strong></td>',
                '<td>' + formatWhen(q.submittedAt || q.createdAt) + '</td>',
                '<td>' + escapeHtml(getServiceTitle(q)) + '</td>',
                '<td class="customer-from-to">' + escapeHtml(getFromTo(q)) + '</td>',
                '<td class="customer-budget-cell">',
                '<div class="customer-budget-cell-actions">',
                '<span>' + escapeHtml(budgetLabel) + '</span>',
                (quoteId ? '<button type="button" class="btn btn-outline btn-sm customer-edit-budget-btn" data-quote-id="' + escapeHtml(quoteId) + '">Edit budget</button>' : ''),
                '</div>',
                '</td>',
                '<td><span class="customer-status customer-status--' + status.toLowerCase().replace(/\s+/g, '-') + '">' + status + '</span></td>',
                '<td class="customer-actions">',
                '<div class="customer-actions-row">',
                '<span class="customer-bid-count" title="Active bids">' + bidN + '</span>',
                viewListingBtn,
                (editQuoteHref ? '<a class="btn btn-primary btn-sm" href="' + escapeHtml(editQuoteHref) + '">Edit</a>' : ''),
                (quoteId ? '<button type="button" class="btn btn-danger btn-sm customer-delete-quote-btn" data-quote-id="' + escapeHtml(quoteId) + '">Delete</button>' : ''),
                '</div>',
                '<div class="customer-actions-row">',
                (quoteId ? '<button type="button" class="btn btn-secondary btn-sm customer-open-form-messages-btn" data-quote-id="' + escapeHtml(quoteId) + '" data-form-id="' + escapeHtml(String(fid || '')) + '">View grouped messages</button>' : ''),
                '</div>',
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
                '<div class="customer-msg-actions"><a class="btn btn-secondary btn-sm" href="' + openHref + '" onclick="if(window.setNavbarReturnUrl){setNavbarReturnUrl(window.location.href);}">View message</a></div>',
                '</article>'
            ].join('');
        }).join('');
    }

    function resolvePeerDisplayName(peerId) {
        const id = String(peerId || '').trim();
        if (!id) return 'User';
        if (!window.anytransportApi || typeof window.anytransportApi.getUserById !== 'function') {
            return id;
        }
        try {
            const u = window.anytransportApi.getUserById(id);
            if (!u) return 'User';
            return firstLine(u.businessName || u.username || u.name || u.nickname || u.email || 'User', 80);
        } catch (_e) {
            return id;
        }
    }

    function buildPeerThreads(userId, messages) {
        const uid = String(userId || '').trim();
        const lastSeenTs = getLastSeenMessageTs(uid);
        const threads = {};

        (messages || []).forEach(function (m) {
            const from = String(m && m.fromUserId || '').trim();
            const to = String(m && m.toUserId || '').trim();
            if (from !== uid && to !== uid) return;
            const incoming = to === uid;
            const peerId = incoming ? from : to;
            if (!peerId || peerId.indexOf('external:') === 0) return;

            if (!threads[peerId]) {
                threads[peerId] = {
                    peerId: peerId,
                    messages: [],
                    unreadCount: 0,
                    latestAt: 0,
                    latestMessage: null,
                    latestIncoming: false
                };
            }
            const thread = threads[peerId];
            thread.messages.push(m);
            const ts = new Date(m && m.createdAt || 0).getTime() || 0;
            if (incoming && ts > lastSeenTs) {
                thread.unreadCount += 1;
            }
            if (ts >= thread.latestAt) {
                thread.latestAt = ts;
                thread.latestMessage = m;
                thread.latestIncoming = incoming;
            }
        });

        return Object.keys(threads).map(function (key) {
            return threads[key];
        }).sort(function (a, b) {
            return b.latestAt - a.latestAt;
        });
    }

    function buildConversationCardHtml(thread, options) {
        const opts = options || {};
        const peerName = escapeHtml(resolvePeerDisplayName(thread.peerId));
        const latest = thread.latestMessage || {};
        const preview = escapeHtml(firstLine(latest.text, 200) || 'No message text yet');
        const when = escapeHtml(formatWhen(latest.createdAt));
        const dir = thread.latestIncoming ? 'In' : 'Out';
        const openHref = 'messages.html?to=' + encodeURIComponent(String(thread.peerId || ''));
        const unreadBadge = thread.unreadCount > 0
            ? ('<span class="customer-msg-unread-badge">' + (thread.unreadCount > 99 ? '99+' : String(thread.unreadCount)) + ' new</span>')
            : '';
        const cardClass = 'customer-msg-card customer-msg-card--' + (thread.latestIncoming ? 'in' : 'out')
            + (thread.unreadCount > 0 ? ' customer-msg-card--unread' : '');
        const sourceHint = opts.sourceHint ? (' · ' + escapeHtml(opts.sourceHint)) : '';

        return [
            '<article class="' + cardClass + '">',
            '<div class="customer-msg-meta"><span class="customer-msg-dir">' + dir + '</span> · ' + when + sourceHint + unreadBadge + '</div>',
            '<h4 class="customer-msg-title">' + peerName + '</h4>',
            '<p class="customer-msg-text">' + preview + '</p>',
            '<div class="customer-msg-actions">',
            '<a class="btn btn-primary btn-sm" href="' + escapeHtml(openHref) + '" onclick="if(window.setNavbarReturnUrl){setNavbarReturnUrl(window.location.href);}">Open chat</a>',
            '</div>',
            '</article>'
        ].join('');
    }

    function renderFormMessageGroupsHtml(quotes, bids) {
        const list = Array.isArray(quotes) ? quotes.slice() : [];
        if (!list.length) {
            return '<p class="customer-empty">No forms yet. Submit a request to receive provider bids.</p>';
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
                '<div class="customer-msg-actions">',
                '<span class="customer-bid-count" title="Active bids">' + activeBids.length + '</span>',
                '<button type="button" class="btn btn-secondary btn-sm customer-open-form-group-btn" data-quote-id="' + escapeHtml(quoteId) + '" data-form-id="' + escapeHtml(formLabel) + '">Open group</button>',
                '</div>',
                '</article>'
            ].join('');
        }).filter(Boolean);

        return rows.length
            ? rows.join('')
            : '<p class="customer-empty">No grouped bid messages found yet.</p>';
    }

    const INBOX_FILTER_KEY = 'anytransport_inbox_filter';
    let inboxViewCache = null;

    function getInboxFilter() {
        try {
            const value = String(sessionStorage.getItem(INBOX_FILTER_KEY) || '').trim().toLowerCase();
            if (value === 'unread' || value === 'direct' || value === 'listings' || value === 'all') {
                return value;
            }
        } catch (_e) {}
        return 'all';
    }

    function setInboxFilter(filter) {
        const value = String(filter || 'all').trim().toLowerCase();
        try {
            sessionStorage.setItem(INBOX_FILTER_KEY, value);
        } catch (_e) {}
    }

    function setInboxFiltersVisible(visible) {
        const nav = document.getElementById('customer-inbox-filters');
        if (nav) {
            nav.style.display = visible ? 'flex' : 'none';
        }
    }

    function getInboxCounts(userId, quotes, bids, messages) {
        const threads = buildPeerThreads(userId, messages);
        const quoteList = Array.isArray(quotes) ? quotes : [];
        const unreadThreadCount = threads.filter(function (t) { return t.unreadCount > 0; }).length;
        const listingsWithBids = quoteList.filter(function (q) {
            return getActiveBidsForQuote(String(q && q.id || '').trim(), bids).length > 0;
        }).length;
        return {
            all: threads.length + quoteList.length,
            unread: unreadThreadCount,
            direct: threads.length,
            listings: quoteList.length,
            listingsWithBids: listingsWithBids
        };
    }

    function renderInboxFilterNav(counts, activeFilter) {
        const nav = document.getElementById('customer-inbox-filters');
        if (!nav) return;
        const filter = String(activeFilter || 'all').toLowerCase();
        const items = [
            { id: 'all', label: 'All', count: counts.all },
            { id: 'unread', label: 'Unread', count: counts.unread },
            { id: 'direct', label: 'Direct', count: counts.direct },
            { id: 'listings', label: 'Listings', count: counts.listings }
        ];
        nav.innerHTML = items.map(function (item) {
            const isActive = item.id === filter;
            const countLabel = item.count > 99 ? '99+' : String(item.count);
            return '<button type="button" class="customer-inbox-filter-btn' + (isActive ? ' active' : '') + '" data-inbox-filter="' + item.id + '" role="tab" aria-selected="' + (isActive ? 'true' : 'false') + '">'
                + escapeHtml(item.label)
                + '<span class="customer-inbox-filter-count">' + escapeHtml(countLabel) + '</span>'
                + '</button>';
        }).join('');
        nav.querySelectorAll('.customer-inbox-filter-btn').forEach(function (btn) {
            btn.addEventListener('click', function () {
                const next = String(btn.getAttribute('data-inbox-filter') || 'all').toLowerCase();
                setInboxFilter(next);
                if (inboxViewCache) {
                    renderCustomerInbox(
                        inboxViewCache.userId,
                        inboxViewCache.quotes,
                        inboxViewCache.bids,
                        inboxViewCache.messages,
                        next
                    );
                }
            });
        });
    }

    function renderUnreadSectionHtml(unreadThreads) {
        if (!unreadThreads.length) return '';
        return [
            '<section class="customer-messages-section" aria-labelledby="customer-unread-heading">',
            '<h3 id="customer-unread-heading" class="customer-messages-section-title">New &amp; unread',
            ' <span class="customer-msg-unread-badge">' + (unreadThreads.length > 99 ? '99+' : String(unreadThreads.length)) + '</span></h3>',
            '<p class="customer-messages-section-hint">Open these chats to clear the unread badge.</p>',
            unreadThreads.map(function (thread) {
                return buildConversationCardHtml(thread, { sourceHint: 'Direct' });
            }).join(''),
            '</section>'
        ].join('');
    }

    function renderDirectSectionHtml(threads, options) {
        const opts = options || {};
        if (!threads.length) {
            return opts.allowEmpty
                ? '<p class="customer-empty">No direct chats yet. Use <strong>Find providers on map</strong> and tap <strong>Message</strong>.</p>'
                : '';
        }
        const header = opts.showHeader === false ? '' : [
            '<section class="customer-messages-section" aria-labelledby="customer-direct-heading">',
            '<h3 id="customer-direct-heading" class="customer-messages-section-title">Direct conversations</h3>',
            '<p class="customer-messages-section-hint">Chats from Find providers or a provider profile — not tied to a listing bid.</p>'
        ].join('');
        const body = threads.map(function (thread) {
            return buildConversationCardHtml(thread, { sourceHint: 'Direct' });
        }).join('');
        const footer = opts.showHeader === false ? '' : '</section>';
        return header + body + footer;
    }

    function renderListingsSectionHtml(quotes, bids, options) {
        const opts = options || {};
        const inner = renderFormMessageGroupsHtml(quotes, bids);
        const header = opts.showHeader === false ? '' : [
            '<section class="customer-messages-section" aria-labelledby="customer-forms-heading">',
            '<h3 id="customer-forms-heading" class="customer-messages-section-title">Messages on your listings</h3>',
            '<p class="customer-messages-section-hint">Provider bids on each request form. Open a group to read and reply per bid.</p>'
        ].join('');
        const footer = opts.showHeader === false ? '' : '</section>';
        return header + inner + footer;
    }

    function buildInboxContentHtml(filter, userId, quotes, bids, messages) {
        const activeFilter = String(filter || 'all').toLowerCase();
        const threads = buildPeerThreads(userId, messages);
        const unreadThreads = threads.filter(function (t) { return t.unreadCount > 0; });
        const parts = [];

        if (activeFilter === 'unread') {
            if (unreadThreads.length) {
                parts.push(renderUnreadSectionHtml(unreadThreads));
            } else {
                parts.push('<p class="customer-empty">No unread messages. You are all caught up.</p>');
            }
            return parts.join('');
        }

        if (activeFilter === 'direct') {
            parts.push(renderDirectSectionHtml(threads, { allowEmpty: true, showHeader: false }));
            return parts.join('');
        }

        if (activeFilter === 'listings') {
            parts.push(renderListingsSectionHtml(quotes, bids, { showHeader: false }));
            return parts.join('');
        }

        if (unreadThreads.length) {
            parts.push(renderUnreadSectionHtml(unreadThreads));
        }
        parts.push(renderDirectSectionHtml(threads, { allowEmpty: true }));
        parts.push(renderListingsSectionHtml(quotes, bids));
        return parts.join('');
    }

    function renderCustomerInbox(userId, quotes, bids, messages, filterOverride) {
        const el = document.getElementById('customer-messages-list');
        if (!el) return;

        inboxViewCache = {
            userId: userId,
            quotes: quotes,
            bids: bids,
            messages: messages
        };

        const activeFilter = filterOverride || getInboxFilter();
        const counts = getInboxCounts(userId, quotes, bids, messages);

        setInboxFiltersVisible(true);
        renderInboxFilterNav(counts, activeFilter);
        el.innerHTML = buildInboxContentHtml(activeFilter, userId, quotes, bids, messages);
        renderNavbarMessageBadge(userId, messages);
    }

    function renderMessageGroupsIndex(quotes, bids, userId, messages) {
        if (userId) {
            renderCustomerInbox(userId, quotes, bids, messages || loadMessagesForUser(userId));
            return;
        }
        const el = document.getElementById('customer-messages-list');
        if (!el) return;
        el.innerHTML = renderFormMessageGroupsHtml(quotes, bids);
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
        setInboxFiltersVisible(false);
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
                '<div class="customer-msg-actions"><button type="button" class="btn btn-outline btn-sm customer-back-to-groups-btn">Back to grouped forms</button></div>',
                '</article>'
            ].join('');
            return;
        }
        el.innerHTML = [
            '<article class="customer-msg-card customer-msg-card--in">',
            '<div class="customer-msg-meta">Grouped by form</div>',
            '<h4 class="customer-msg-title">Form ' + escapeHtml(formLabel) + ' · ' + groupedBids.length + ' bid' + (groupedBids.length === 1 ? '' : 's') + '</h4>',
            '<p class="customer-msg-text">All bid messages for this form are listed below.</p>',
            '<div class="customer-msg-actions customer-msg-toolbar">',
            '<label for="customer-group-sort-select" style="font-size:12px; color:#334155; font-weight:600;">Sort bids</label>',
            '<select id="customer-group-sort-select" class="form-input customer-group-sort-select" data-quote-id="' + escapeHtml(qid) + '" data-form-id="' + escapeHtml(formLabel) + '" style="max-width:240px;">',
            '<option value="newest"' + (activeSortMode === 'newest' ? ' selected' : '') + '>Newest bid</option>',
            '<option value="lowest"' + (activeSortMode === 'lowest' ? ' selected' : '') + '>Lowest bid</option>',
            '<option value="highest"' + (activeSortMode === 'highest' ? ' selected' : '') + '>Highest bid</option>',
            '<option value="provider"' + (activeSortMode === 'provider' ? ' selected' : '') + '>Provider name</option>',
            '</select>',
            '</div>',
            '<div class="customer-msg-actions"><button type="button" class="btn btn-outline btn-sm customer-back-to-groups-btn">Back to grouped forms</button></div>',
            '</article>',
            groupedBids.map(function (bid) {
                const incoming = String(bid && bid.providerId || '') !== String(userId || '');
                const providerLabel = escapeHtml(getBidProviderLabel(bid));
                const amount = Number(bid && bid.amount);
                const amountLabel = Number.isFinite(amount) ? ('€' + amount.toFixed(2)) : '—';
                const preview = escapeHtml(firstLine(bid && bid.message, 220) || 'No bid note provided.');
                const when = escapeHtml(formatWhen(bid && bid.createdAt));
                const dir = incoming ? 'In' : 'Out';
                const providerId = String(bid && bid.providerId || '').trim();
                const openHref = 'messages.html?quoteId=' + encodeURIComponent(qid)
                    + '&bidId=' + encodeURIComponent(String(bid && bid.id || ''))
                    + '&to=' + encodeURIComponent(providerId);
                const profileHref = providerId
                    ? ('provider-profile.html?userId=' + encodeURIComponent(providerId))
                    : '';
                return [
                    '<article class="customer-msg-card customer-msg-card--' + (incoming ? 'in' : 'out') + '">',
                    '<div class="customer-msg-meta"><span class="customer-msg-dir">' + dir + '</span> · ' + when + ' · ' + escapeHtml(amountLabel) + '</div>',
                    '<h4 class="customer-msg-title">' + providerLabel + '</h4>',
                    '<p class="customer-msg-text">' + preview + '</p>',
                    '<div class="customer-msg-actions">',
                    profileHref ? ('<a class="btn btn-outline btn-sm" href="' + profileHref + '">View profile</a>') : '',
                    '<a class="btn btn-secondary btn-sm" href="' + openHref + '" onclick="if(window.setNavbarReturnUrl){setNavbarReturnUrl(window.location.href);}">Open chat</a>',
                    '</div>',
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

                if (typeof authRef.mergeUserIntoLocalCache === 'function') {
                    authRef.mergeUserIntoLocalCache(updatedUser);
                }
                authRef.currentUser = updatedUser;
                if (typeof authRef.setStoredCurrentUser === 'function') {
                    authRef.setStoredCurrentUser(updatedUser);
                } else {
                    localStorage.setItem('anytransport_user', JSON.stringify(updatedUser));
                }
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
        var providerBoardBtn = document.getElementById('customer-open-provider-board-btn');
        var showProviderDashNav = false;
        try {
            if (typeof authRef.refreshSessionUserFromServer === 'function') {
                authRef.refreshSessionUserFromServer();
            }
            showProviderDashNav = typeof authRef.isProvider === 'function' && authRef.isProvider();
            if (!showProviderDashNav && typeof authRef.isAdmin === 'function') {
                showProviderDashNav = authRef.isAdmin();
            }
        } catch (_e) {}
        if (pdLink && !showProviderDashNav) {
            pdLink.style.display = 'none';
        }
        if (providerBoardBtn) {
            providerBoardBtn.style.display = showProviderDashNav ? '' : 'none';
            if (showProviderDashNav && typeof authRef.resolveHubNavHref === 'function') {
                providerBoardBtn.href = authRef.resolveHubNavHref('dashboard.html') + '#provider-board';
            }
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
        wireBudgetModal(authRef, user, highlightFormId);

        let messages = loadMessagesForUser(user.id);
        renderCustomerInbox(user.id, quotes, bids, messages);
        wireAccountSettings(authRef, user);

        let initialTab = 'forms';
        try {
            const tabParam = String(new URLSearchParams(window.location.search || '').get('tab') || '').trim().toLowerCase();
            const hashTab = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase();
            const tabKey = tabParam || hashTab;
            if (tabKey === 'settings' || tabKey === 'account') {
                initialTab = 'settings';
            } else if (tabKey === 'inbox' || tabKey === 'messages') {
                initialTab = 'inbox';
            } else if (tabKey === 'forms' || tabKey === 'listings') {
                initialTab = 'forms';
            }
        } catch (_tabErr) {
            initialTab = 'forms';
        }
        activateTab(initialTab);
        if (initialTab === 'inbox') {
            const latestQuotes = loadQuotesMerged(user.id, user.email || '');
            const latestBids = loadAllBids();
            const latestMessages = loadMessagesForUser(user.id);
            renderCustomerInbox(user.id, latestQuotes, latestBids, latestMessages);
        }

        const quotesBody = document.getElementById('customer-quotes-body');
        if (quotesBody) {
            quotesBody.addEventListener('click', function (event) {
                const budgetBtn = event.target.closest('.customer-edit-budget-btn');
                if (budgetBtn) {
                    const quoteId = String(budgetBtn.getAttribute('data-quote-id') || '').trim();
                    const latestQuotes = loadQuotesMerged(user.id, user.email || '');
                    const target = latestQuotes.find(function (entry) {
                        return String(entry && entry.id || '') === quoteId;
                    });
                    if (target) openBudgetModal(target);
                    return;
                }

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
                const latestQuotes = loadQuotesMerged(user.id, user.email || '');
                const latestBids = loadAllBids();
                renderGroupedMessagesForQuote(user.id, quoteId, formId, latestBids, 'newest');
                activateTab('inbox');
            });
        }

        const inboxList = document.getElementById('customer-messages-list');
        if (inboxList) {
            inboxList.addEventListener('click', function (event) {
                const backBtn = event.target.closest('.customer-back-to-groups-btn');
                if (backBtn) {
                    const latestQuotes = loadQuotesMerged(user.id, user.email || '');
                    const latestBids = loadAllBids();
                    const latestMessages = loadMessagesForUser(user.id);
                    renderCustomerInbox(user.id, latestQuotes, latestBids, latestMessages);
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
                try {
                    const nextUrl = new URL(window.location.href);
                    if (tab === 'forms') {
                        nextUrl.searchParams.set('tab', 'forms');
                    } else if (tab === 'settings') {
                        nextUrl.searchParams.set('tab', 'settings');
                    } else if (tab === 'inbox') {
                        nextUrl.searchParams.set('tab', 'messages');
                    }
                    window.history.replaceState({}, '', nextUrl.pathname + nextUrl.search);
                } catch (_urlErr) {}
                if (tab === 'inbox') {
                    const latestQuotes = loadQuotesMerged(user.id, user.email || '');
                    const latestBids = loadAllBids();
                    const latestMessages = loadMessagesForUser(user.id);
                    renderCustomerInbox(user.id, latestQuotes, latestBids, latestMessages);
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
