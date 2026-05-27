(function () {
    'use strict';

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
            var d = new Date(iso);
            if (Number.isNaN(d.getTime())) return String(iso);
            return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        } catch (_e) {
            return String(iso);
        }
    }

    function firstText() {
        for (var i = 0; i < arguments.length; i += 1) {
            var v = arguments[i];
            if (v != null && String(v).trim() !== '') return String(v);
        }
        return '';
    }

    var WARN_EMAIL = 'Email addresses are not allowed. Keep all communication on AnyTransport.';
    var WARN_PHONE = 'Phone numbers are not allowed. Do not share contact details in messages.';
    var WARN_LINK = 'Links are not allowed in messages.';
    var WARN_CONTACT_APP = 'External contact apps are not allowed. Keep all communication on AnyTransport.';
    var WARN_CONTACT_PHRASE = 'Contact details are not allowed. Keep all communication on AnyTransport.';

    var NUMBER_WORD = '(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|o)';
    var SPELLED_NUMBER_RUN = new RegExp(
        '(?:(?:\\b' + NUMBER_WORD + '\\b|\\d)(?:\\s*[,.\-–—/]?\\s*)?){5,}(?:\\b' + NUMBER_WORD + '\\b|\\d)',
        'gi'
    );

    var CONTACT_CHECKS = [
        { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, warning: WARN_EMAIL },
        { pattern: /\d{5,}/, warning: WARN_PHONE },
        { pattern: /(?:\+?\d[\d\s().\-–—_\/]{4,}\d)/, warning: WARN_PHONE },
        { pattern: /(?:https?:\/\/|www\.)\S+/i, warning: WARN_LINK },
        {
            pattern: /\b(?:whatsapp|telegram|viber|wechat|snapchat|instagram|facebook|messenger|discord|skype|signal|tiktok|insta|snap|my contact|contact me|my number|your number|reach me|call me|text me|dm me|phone me|email me|message me on|add me on|hit me up|get in touch|reach out)\b/i,
            warning: WARN_CONTACT_APP
        }
    ];

    function pushPatternMatches(value, matches, pattern, warning) {
        var flags = pattern.flags.indexOf('g') >= 0 ? pattern.flags : pattern.flags + 'g';
        var re = new RegExp(pattern.source, flags);
        var match;
        while ((match = re.exec(value)) !== null) {
            matches.push({
                start: match.index,
                end: match.index + match[0].length,
                warning: warning
            });
            if (match[0].length === 0) {
                re.lastIndex += 1;
            }
        }
    }

    function findDigitClusterMatches(text) {
        var value = String(text == null ? '' : text);
        var found = [];
        var re = /[\d][\d\s.\-_|/\\()\u2013\u2014+]{2,}[\d]|[\d]{5,}/g;
        var match;
        while ((match = re.exec(value)) !== null) {
            if (match[0].replace(/\D/g, '').length >= 5) {
                found.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    warning: WARN_PHONE
                });
            }
        }
        return found;
    }

    function findSpelledNumberMatches(text) {
        var value = String(text == null ? '' : text);
        var found = [];
        var re = new RegExp(SPELLED_NUMBER_RUN.source, 'gi');
        var match;
        while ((match = re.exec(value)) !== null) {
            var tokens = match[0].match(/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|o)\b|\d/gi) || [];
            if (tokens.length >= 5) {
                found.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    warning: WARN_PHONE
                });
            }
        }
        return found;
    }

    function mergeContactMatches(matches) {
        if (!matches.length) return [];
        matches.sort(function (a, b) {
            return a.start - b.start || a.end - b.end;
        });
        var merged = [];
        matches.forEach(function (entry) {
            var last = merged[merged.length - 1];
            if (!last || entry.start > last.end) {
                merged.push({ start: entry.start, end: entry.end, warning: entry.warning });
                return;
            }
            if (entry.end > last.end) {
                last.end = entry.end;
            }
        });
        return merged;
    }

    function findContactMatches(text) {
        var value = String(text == null ? '' : text);
        if (!value) return [];
        var matches = [];
        for (var i = 0; i < CONTACT_CHECKS.length; i += 1) {
            pushPatternMatches(value, matches, CONTACT_CHECKS[i].pattern, CONTACT_CHECKS[i].warning);
        }
        findDigitClusterMatches(value).forEach(function (entry) { matches.push(entry); });
        findSpelledNumberMatches(value).forEach(function (entry) { matches.push(entry); });
        return mergeContactMatches(matches);
    }

    function getContactDetailsWarning(text) {
        var value = String(text == null ? '' : text);
        if (!value.trim()) return '';
        var matches = findContactMatches(value);
        if (!matches.length) return '';
        for (var i = 0; i < CONTACT_CHECKS.length; i += 1) {
            if (CONTACT_CHECKS[i].pattern.test(value)) return CONTACT_CHECKS[i].warning;
        }
        if (findDigitClusterMatches(value).length || findSpelledNumberMatches(value).length) {
            return WARN_PHONE;
        }
        return WARN_CONTACT_PHRASE;
    }

    function containsContactDetails(text) {
        return !!getContactDetailsWarning(text);
    }

    function buildHighlightedMarkup(text, matches) {
        var value = String(text == null ? '' : text);
        if (!value) return '';
        if (!matches || !matches.length) {
            return escapeHtml(value);
        }
        var html = '';
        var cursor = 0;
        matches.forEach(function (match) {
            html += escapeHtml(value.slice(cursor, match.start));
            html += '<mark class="messages-flagged-text">' +
                escapeHtml(value.slice(match.start, match.end)) +
                '</mark>';
            cursor = match.end;
        });
        html += escapeHtml(value.slice(cursor));
        return html;
    }

    function unwrapHighlightContainer(inputEl) {
        if (!inputEl) return;
        var wrap = inputEl.closest('.messages-input-highlight-wrap, .messages-inline-highlight');
        if (!wrap || !wrap.parentNode) return;
        wrap.parentNode.insertBefore(inputEl, wrap);
        wrap.remove();
        delete inputEl.dataset.messagesHighlightReady;
        delete inputEl.dataset.inlineHighlightReady;
        inputEl.classList.remove('messages-input--highlighted', 'messages-input--mirrored');
    }

    function copyMirrorStyles(fromEl, toEl) {
        var computed = window.getComputedStyle(fromEl);
        [
            'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
            'wordSpacing', 'textIndent', 'textTransform', 'paddingTop', 'paddingRight',
            'paddingBottom', 'paddingLeft', 'borderTopWidth', 'borderRightWidth',
            'borderBottomWidth', 'borderLeftWidth', 'boxSizing'
        ].forEach(function (prop) {
            toEl.style[prop] = computed[prop];
        });
        toEl.style.width = fromEl.clientWidth + 'px';
    }

    function ensureInlineHighlight(inputEl) {
        if (!inputEl) return null;
        var existing = inputEl.closest('.messages-inline-highlight');
        if (existing) return existing;

        var wrap = document.createElement('div');
        wrap.className = 'messages-inline-highlight';

        var backdrop = document.createElement('div');
        backdrop.className = 'messages-inline-backdrop';

        var content = document.createElement('div');
        content.className = 'messages-inline-backdrop-content';
        backdrop.appendChild(content);

        inputEl.parentNode.insertBefore(wrap, inputEl);
        wrap.appendChild(backdrop);
        wrap.appendChild(inputEl);

        inputEl.dataset.inlineHighlightReady = '1';
        inputEl.addEventListener('scroll', function () {
            backdrop.scrollTop = inputEl.scrollTop;
            backdrop.scrollLeft = inputEl.scrollLeft;
        });

        if (typeof ResizeObserver === 'function') {
            var resizeObserver = new ResizeObserver(function () {
                syncInlineHighlight(inputEl);
            });
            resizeObserver.observe(inputEl);
            inputEl._messagesResizeObserver = resizeObserver;
        }

        return wrap;
    }

    function syncInlineHighlight(inputEl) {
        if (!inputEl) return;
        ensureInlineHighlight(inputEl);
        var wrap = inputEl.closest('.messages-inline-highlight');
        if (!wrap) return;

        var content = wrap.querySelector('.messages-inline-backdrop-content');
        if (!content) return;

        var matches = findContactMatches(inputEl.value);
        var hasMatches = matches.length > 0;
        wrap.classList.toggle('messages-inline-highlight--active', hasMatches);
        inputEl.classList.toggle('messages-input--mirrored', hasMatches);

        if (!hasMatches) {
            content.innerHTML = '';
            if (inputEl.hasAttribute('data-spellcheck-off')) {
                inputEl.setAttribute('spellcheck', inputEl.getAttribute('data-spellcheck-off'));
                inputEl.removeAttribute('data-spellcheck-off');
            }
            return;
        }

        if (!inputEl.hasAttribute('data-spellcheck-off')) {
            inputEl.setAttribute('data-spellcheck-off', inputEl.getAttribute('spellcheck') || 'true');
            inputEl.setAttribute('spellcheck', 'false');
        }

        copyMirrorStyles(inputEl, content);
        content.innerHTML = buildHighlightedMarkup(inputEl.value, matches) +
            (inputEl.tagName === 'TEXTAREA' ? '\n' : '');

        var backdrop = wrap.querySelector('.messages-inline-backdrop');
        if (backdrop) {
            backdrop.scrollTop = inputEl.scrollTop;
            backdrop.scrollLeft = inputEl.scrollLeft;
        }
    }

    function setComposerContactWarning(statusEl, titleInput, textInput, warningText) {
        var hasWarning = !!warningText;

        if (statusEl) {
            statusEl.textContent = warningText || '';
            statusEl.classList.toggle('messages-status--warning', hasWarning);
            statusEl.classList.toggle('messages-status--ok', !hasWarning && statusEl.textContent === 'Message sent.');
        }

        if (titleInput) {
            var titleHasIssue = hasWarning && !!getContactDetailsWarning(titleInput.value);
            titleInput.classList.toggle('messages-input--warning', titleHasIssue);
            titleInput.setAttribute('aria-invalid', titleHasIssue ? 'true' : 'false');
            syncInlineHighlight(titleInput);
        }

        if (textInput) {
            var textHasIssue = hasWarning && !!getContactDetailsWarning(textInput.value);
            textInput.classList.toggle('messages-input--warning', textHasIssue);
            textInput.setAttribute('aria-invalid', textHasIssue ? 'true' : 'false');
            syncInlineHighlight(textInput);
        }
    }

    function bindContactWarnings(titleInput, textInput, statusEl) {
        [titleInput, textInput].forEach(function (el) {
            if (el) unwrapHighlightContainer(el);
        });

        function refreshContactWarning() {
            var warning = getContactDetailsWarning(titleInput && titleInput.value) ||
                getContactDetailsWarning(textInput && textInput.value);
            setComposerContactWarning(statusEl, titleInput, textInput, warning);
        }

        [titleInput, textInput].forEach(function (el) {
            if (!el) return;
            el.addEventListener('input', refreshContactWarning);
            el.addEventListener('paste', function () {
                setTimeout(refreshContactWarning, 0);
            });
        });
        refreshContactWarning();
    }

    function getAllBids() {
        if (!window.anytransportApi || typeof window.anytransportApi.getBids !== 'function') return [];
        try {
            return window.anytransportApi.getBids('') || [];
        } catch (_e) {
            return [];
        }
    }

    function resolveUserName(userId) {
        if (!userId) return '';
        if (!window.anytransportApi || typeof window.anytransportApi.getUserById !== 'function') return String(userId);
        try {
            var user = window.anytransportApi.getUserById(String(userId));
            if (!user) return String(userId);
            return firstText(user.businessName, user.name, user.nickname, user.username, user.email, user.id);
        } catch (_e) {
            return String(userId);
        }
    }

    function resolveQuoteOwnerId(quote) {
        if (!quote || typeof quote !== 'object') return '';
        return String(firstText(quote.userId, quote.createdBy, '') || '').trim();
    }

    function isBidListingNotification(message) {
        return /^New bid on listing/i.test(String(message && message.title || '').trim());
    }

    function resolveConversationPeerFromBid(me, bid) {
        if (!bid || typeof bid !== 'object') return '';
        var providerId = String(bid.providerId || '').trim();
        var meId = String(me && me.id || '').trim();
        if (!providerId || !meId) return providerId;
        if (meId === providerId) {
            var quote = loadQuoteContext(String(bid.quoteId || '').trim());
            return resolveQuoteOwnerId(quote);
        }
        return providerId;
    }

    function correctSelfConversationPeer(me, toUserId, bidId, quoteId) {
        var meId = String(me && me.id || '').trim();
        var peerId = String(toUserId || '').trim();
        if (!meId || peerId !== meId) return peerId;

        if (bidId) {
            var bid = getAllBids().find(function (b) { return String(b.id || '') === bidId; }) || null;
            var fromBid = resolveConversationPeerFromBid(me, bid);
            if (fromBid && fromBid !== meId) return fromBid;
        }

        if (quoteId) {
            var quote = loadQuoteContext(quoteId);
            var ownerId = resolveQuoteOwnerId(quote);
            if (ownerId && ownerId !== meId) return ownerId;
        }

        return peerId;
    }

    function isCustomerUser(user) {
        if (!user || typeof user !== 'object') return false;
        const role = String(user.role || '').trim().toLowerCase();
        if (role === 'customer') return true;
        if (Array.isArray(user.roles) && user.roles.some(function (r) {
            return String(r || '').trim().toLowerCase() === 'customer';
        })) {
            return true;
        }
        return !role || role === 'user';
    }

    function isQuoteFormComplete(quote) {
        return !!(quote && quote.customerFormComplete);
    }

    function getMessagesQuoteIdFromUrl(fallback) {
        try {
            return String(new URLSearchParams(window.location.search || '').get('quoteId') || fallback || '').trim();
        } catch (_e) {
            return String(fallback || '').trim();
        }
    }

    function setMessagesQuoteIdInUrl(quoteId) {
        var id = String(quoteId || '').trim();
        if (!id) return;
        try {
            var url = new URL(window.location.href);
            url.searchParams.set('quoteId', id);
            window.history.replaceState({}, document.title, url.pathname + url.search);
        } catch (_urlErr) {
            /* ignore */
        }
    }

    function refreshMessagesQuoteContext(me, toUserId, quoteId) {
        quoteId = setupLinkFormSelector(me, toUserId, quoteId);
        setupConversationToolbar(me, toUserId, quoteId);
        var subtitleEl = document.getElementById('messages-subtitle');
        if (subtitleEl) {
            var quote = quoteId ? loadQuoteContext(quoteId) : null;
            var formHint = quote && quote.formId ? (' (Form #' + quote.formId + ')') : (quoteId ? '' : '');
            subtitleEl.textContent = 'Conversation with ' + resolveUserName(toUserId) + formHint;
        }
    }

    function loadQuoteContext(quoteId) {
        if (!quoteId || !window.anytransportApi) return null;
        if (typeof window.anytransportApi.getQuote === 'function') {
            try {
                return window.anytransportApi.getQuote(quoteId);
            } catch (_e) {
                return null;
            }
        }
        return null;
    }

    function loadCustomerQuotes(me) {
        var quotes = [];
        if (me && window.anytransportApi && typeof window.anytransportApi.getQuotes === 'function') {
            try {
                quotes = window.anytransportApi.getQuotes(me.id) || [];
            } catch (_e) {
                quotes = [];
            }
        }
        if (!quotes.length) {
            try {
                var raw = localStorage.getItem('anytransport_quote_requests');
                var parsed = raw ? JSON.parse(raw) : [];
                quotes = Array.isArray(parsed) ? parsed : [];
            } catch (_e2) {
                quotes = [];
            }
        }
        return quotes.filter(function (q) {
            return q && String(q.id || '').trim();
        });
    }

    function quoteHasBidFromProvider(quote, providerId, bids) {
        var qid = String(quote && quote.id || '').trim();
        var pid = String(providerId || '').trim();
        if (!qid || !pid) return false;
        return (bids || []).some(function (b) {
            return String(b.quoteId || '').trim() === qid && String(b.providerId || '').trim() === pid;
        });
    }

    function setupLinkFormSelector(me, toUserId, quoteId) {
        var wrap = document.getElementById('messages-link-form-wrap');
        var select = document.getElementById('messages-link-form-select');
        if (!wrap || !select) {
            return String(quoteId || '').trim();
        }

        if (!isCustomerUser(me)) {
            wrap.style.display = 'none';
            return String(quoteId || '').trim();
        }

        var quotes = loadCustomerQuotes(me);
        var activeQuotes = quotes.filter(function (q) {
            return !isQuoteFormComplete(q);
        });
        var bids = getAllBids();
        var pid = String(toUserId || '').trim();
        var resolvedQuoteId = String(quoteId || '').trim();
        var currentQuote = resolvedQuoteId ? quotes.find(function (q) {
            return String(q.id || '').trim() === resolvedQuoteId;
        }) : null;

        if (currentQuote && isQuoteFormComplete(currentQuote)) {
            wrap.style.display = 'none';
            return resolvedQuoteId;
        }

        if (!activeQuotes.length) {
            wrap.style.display = '';
            select.innerHTML = '<option value="">' + (quotes.length
                ? 'All request forms are marked complete'
                : 'No request forms yet — create one under Forms') + '</option>';
            select.disabled = true;
            return resolvedQuoteId && currentQuote && !isQuoteFormComplete(currentQuote) ? resolvedQuoteId : '';
        }

        select.disabled = false;
        var options = activeQuotes.map(function (q) {
            var fid = String(q.formId || q.id || '').trim();
            var label = (fid ? 'Form #' + fid : 'Request') + ' — ' + firstText(q.itemType, q.itemDescription, 'Transport');
            if (quoteHasBidFromProvider(q, pid, bids)) {
                label += ' · provider bid';
            }
            return {
                id: String(q.id || '').trim(),
                label: label,
                hasBid: quoteHasBidFromProvider(q, pid, bids)
            };
        });
        options.sort(function (a, b) {
            return (b.hasBid ? 1 : 0) - (a.hasBid ? 1 : 0);
        });

        select.innerHTML = ['<option value="">Choose a request form to link…</option>']
            .concat(options.map(function (o) {
                return '<option value="' + escapeHtml(o.id) + '">' + escapeHtml(o.label) + '</option>';
            }))
            .join('');
        wrap.style.display = '';

        if (!resolvedQuoteId) {
            var withBids = options.filter(function (o) { return o.hasBid; });
            if (withBids.length === 1) {
                resolvedQuoteId = withBids[0].id;
            }
        }
        if (resolvedQuoteId) {
            select.value = resolvedQuoteId;
        }

        if (!select.dataset.bound) {
            select.dataset.bound = '1';
            select.addEventListener('change', function () {
                var chosen = String(select.value || '').trim();
                if (!chosen) return;
                try {
                    var url = new URL(window.location.href);
                    url.searchParams.set('quoteId', chosen);
                    window.location.href = url.pathname + url.search;
                } catch (_urlErr) {
                    window.location.search = '?to=' + encodeURIComponent(pid) + '&quoteId=' + encodeURIComponent(chosen);
                }
            });
        }

        return resolvedQuoteId;
    }

    function setToolbarControlVisible(el, visible) {
        if (!el) return;
        if (visible) {
            el.hidden = false;
            el.style.removeProperty('display');
        } else {
            el.hidden = true;
            el.style.display = 'none';
        }
    }

    function ensureRevertCompleteButton() {
        var actions = document.querySelector('.messages-context-actions');
        var btn = document.getElementById('messages-revert-complete-btn');
        if (btn || !actions) {
            return btn;
        }
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'messages-revert-complete-btn';
        btn.className = 'messages-toolbar-btn messages-toolbar-btn--outline';
        btn.textContent = 'Revert complete status';
        btn.hidden = true;
        var reviewBtn = document.getElementById('messages-leave-review-btn');
        if (reviewBtn) {
            actions.insertBefore(btn, reviewBtn);
        } else {
            actions.appendChild(btn);
        }
        return btn;
    }

    function setupConversationToolbar(me, toUserId, quoteId) {
        var toolbar = document.getElementById('messages-context-toolbar');
        if (!toolbar || !toUserId) return;

        var profileBtn = document.getElementById('messages-view-profile-btn');
        var completeBtn = document.getElementById('messages-mark-complete-btn');
        var completeBadge = document.getElementById('messages-form-complete-badge');
        var revertBtn = ensureRevertCompleteButton();
        var reviewBtn = document.getElementById('messages-leave-review-btn');
        var summaryEl = document.getElementById('messages-context-summary');

        toolbar.style.display = '';
        if (profileBtn) {
            profileBtn.href = 'provider-profile.html?userId=' + encodeURIComponent(toUserId);
        }

        if (!isCustomerUser(me)) {
            var linkWrapProvider = document.getElementById('messages-link-form-wrap');
            if (linkWrapProvider) linkWrapProvider.style.display = 'none';
            if (summaryEl) {
                summaryEl.textContent = 'You are chatting with ' + resolveUserName(toUserId) + '. Continue the conversation below.';
            }
            setToolbarControlVisible(profileBtn, false);
            setToolbarControlVisible(completeBtn, false);
            setToolbarControlVisible(completeBadge, false);
            setToolbarControlVisible(revertBtn, false);
            setToolbarControlVisible(reviewBtn, false);
            return;
        }

        quoteId = setupLinkFormSelector(me, toUserId, quoteId);

        if (!quoteId) {
            if (summaryEl) {
                summaryEl.textContent = 'Choose which active request form this conversation is about. Completed forms are hidden from this list.';
            }
            setToolbarControlVisible(completeBtn, false);
            setToolbarControlVisible(completeBadge, false);
            setToolbarControlVisible(revertBtn, false);
            setToolbarControlVisible(reviewBtn, false);
            return;
        }

        var quote = loadQuoteContext(quoteId);
        var formLabel = quote && quote.formId ? ('Form #' + quote.formId) : 'your request';
        var formComplete = isQuoteFormComplete(quote);

        if (summaryEl) {
            summaryEl.textContent = formComplete
                ? formLabel + ' is marked complete. You can still chat below, or revert the status if that was a mistake.'
                : 'Actions for ' + formLabel + ' with ' + resolveUserName(toUserId) + '.';
        }

        if (completeBtn) {
            setToolbarControlVisible(completeBtn, !formComplete);
            completeBtn.disabled = false;
            completeBtn.textContent = 'Mark form complete';
            if (!completeBtn.dataset.bound) {
                completeBtn.dataset.bound = '1';
                completeBtn.addEventListener('click', function () {
                    if (!window.anytransportApi || typeof window.anytransportApi.markQuoteFormComplete !== 'function') {
                        alert('Unable to mark the form complete right now.');
                        return;
                    }
                    if (!window.confirm('Mark this request form as complete? It will be removed from your active forms list. You can revert this later, which will also remove any review you left for this form.')) {
                        return;
                    }
                    completeBtn.disabled = true;
                    try {
                        var updated = window.anytransportApi.markQuoteFormComplete(quoteId);
                        if (!updated) throw new Error('No response');
                        var activeQuoteId = String((updated && updated.id) || quoteId || '').trim();
                        setMessagesQuoteIdInUrl(activeQuoteId);
                        refreshMessagesQuoteContext(me, toUserId, activeQuoteId);
                    } catch (err) {
                        completeBtn.disabled = false;
                        alert((err && err.message) ? err.message : 'Could not mark the form complete.');
                    }
                });
            }
        }
        if (completeBadge) {
            setToolbarControlVisible(completeBadge, formComplete);
            if (formComplete) {
                completeBadge.textContent = 'Form marked complete';
            }
        }
        var existingReview = null;
        if (formComplete && window.anytransportApi && typeof window.anytransportApi.listProviderReviews === 'function') {
            try {
                var reviewPayload = window.anytransportApi.listProviderReviews(toUserId, quoteId);
                existingReview = reviewPayload && reviewPayload.existingReview ? reviewPayload.existingReview : null;
            } catch (_e) {
                existingReview = null;
            }
        }

        if (revertBtn) {
            setToolbarControlVisible(revertBtn, formComplete);
            revertBtn.disabled = false;
            if (formComplete && !revertBtn.dataset.bound) {
                revertBtn.dataset.bound = '1';
                revertBtn.addEventListener('click', function () {
                    if (!window.anytransportApi || typeof window.anytransportApi.revertQuoteFormComplete !== 'function') {
                        alert('Unable to revert the complete status right now.');
                        return;
                    }
                    var activeQuoteId = String(quoteId || '').trim();
                    try {
                        var params = new URLSearchParams(window.location.search || '');
                        activeQuoteId = String(params.get('quoteId') || activeQuoteId).trim();
                    } catch (_p) {}
                    var reviewNow = null;
                    if (window.anytransportApi && typeof window.anytransportApi.listProviderReviews === 'function') {
                        try {
                            var payload = window.anytransportApi.listProviderReviews(toUserId, activeQuoteId);
                            reviewNow = payload && payload.existingReview ? payload.existingReview : null;
                        } catch (_r) {
                            reviewNow = null;
                        }
                    }
                    var revertMsg = reviewNow
                        ? 'Reopen this request form? Your ' + String(reviewNow.rating || '') + '-star review for this provider will be removed, and the form will return to your active list.'
                        : 'Reopen this request form? It will appear in your active forms list again.';
                    if (!window.confirm(revertMsg)) {
                        return;
                    }
                    revertBtn.disabled = true;
                    try {
                        var reopened = window.anytransportApi.revertQuoteFormComplete(activeQuoteId);
                        if (!reopened) throw new Error('No response');
                        try {
                            var url = new URL(window.location.href);
                            url.searchParams.set('quoteId', activeQuoteId);
                            window.location.replace(url.pathname + url.search);
                        } catch (_e) {
                            setupConversationToolbar(me, toUserId, activeQuoteId);
                        }
                    } catch (err) {
                        revertBtn.disabled = false;
                        alert((err && err.message) ? err.message : 'Could not revert the complete status.');
                    }
                });
            }
        }

        if (reviewBtn) {
            if (!formComplete) {
                setToolbarControlVisible(reviewBtn, false);
            } else if (existingReview) {
                setToolbarControlVisible(reviewBtn, false);
                if (completeBadge) {
                    completeBadge.textContent = 'Form complete · Review submitted (' + String(existingReview.rating || '') + '★)';
                }
            } else {
                setToolbarControlVisible(reviewBtn, true);
                if (!reviewBtn.dataset.bound) {
                    reviewBtn.dataset.bound = '1';
                    reviewBtn.addEventListener('click', function () {
                        var activeQuoteId = getMessagesQuoteIdFromUrl(quoteId);
                        openReviewModal(me, toUserId, activeQuoteId, function () {
                            refreshMessagesQuoteContext(me, toUserId, activeQuoteId);
                        });
                    });
                }
            }
        }
    }

    function openReviewModal(me, providerId, quoteId, onDone) {
        var modal = document.getElementById('messages-review-modal');
        if (!modal) return;
        var selectedRating = 0;
        var statusEl = document.getElementById('messages-review-status');
        var textEl = document.getElementById('messages-review-text');
        var starsWrap = document.getElementById('messages-review-stars');

        function setRating(rating) {
            selectedRating = rating;
            if (!starsWrap) return;
            starsWrap.querySelectorAll('button[data-rating]').forEach(function (btn) {
                var val = parseInt(btn.getAttribute('data-rating') || '0', 10);
                btn.classList.toggle('is-selected', val <= rating);
            });
        }

        if (starsWrap && !starsWrap.dataset.bound) {
            starsWrap.dataset.bound = '1';
            starsWrap.querySelectorAll('button[data-rating]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    setRating(parseInt(btn.getAttribute('data-rating') || '0', 10));
                });
            });
        }

        setRating(0);
        if (textEl) textEl.value = '';
        if (statusEl) statusEl.textContent = '';
        modal.hidden = false;
        modal.classList.add('is-open');

        var cancelBtn = document.getElementById('messages-review-cancel');
        var submitBtn = document.getElementById('messages-review-submit');

        function closeModal() {
            modal.classList.remove('is-open');
            modal.hidden = true;
        }

        if (cancelBtn && !cancelBtn.dataset.bound) {
            cancelBtn.dataset.bound = '1';
            cancelBtn.addEventListener('click', closeModal);
        }
        modal.addEventListener('click', function (evt) {
            if (evt.target === modal) closeModal();
        });

        if (submitBtn) {
            submitBtn.onclick = function () {
                if (selectedRating < 1 || selectedRating > 5) {
                    if (statusEl) statusEl.textContent = 'Choose a star rating (1–5).';
                    return;
                }
                if (!window.anytransportApi || typeof window.anytransportApi.saveProviderReview !== 'function') {
                    if (statusEl) statusEl.textContent = 'Reviews are unavailable right now.';
                    return;
                }
                submitBtn.disabled = true;
                if (statusEl) statusEl.textContent = 'Saving…';
                try {
                    window.anytransportApi.saveProviderReview(
                        providerId,
                        quoteId,
                        selectedRating,
                        textEl ? textEl.value : ''
                    );
                    closeModal();
                    if (typeof onDone === 'function') onDone();
                } catch (err) {
                    submitBtn.disabled = false;
                    if (statusEl) statusEl.textContent = (err && err.message) ? err.message : 'Could not save review.';
                }
            };
        }
    }

    function renderThread(currentUserId, messages) {
        var threadEl = document.getElementById('messages-thread');
        if (!threadEl) return;

        if (!Array.isArray(messages) || !messages.length) {
            threadEl.innerHTML = '<p class="messages-empty">No messages yet. Start the conversation below.</p>';
            return;
        }

        var rows = messages.slice().sort(function (a, b) {
            return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        }).map(function (m) {
            if (isBidListingNotification(m)) {
                var viewerIsCustomer = String(m.toUserId || '') === String(currentUserId);
                var providerName = resolveUserName(m.fromUserId);
                var noticeLabel = viewerIsCustomer
                    ? (providerName + ' placed a bid')
                    : 'Your bid notification';
                var noticeBody = firstText(m.text, '');
                return [
                    '<article class="msg-row msg-row--system">',
                    '<div class="msg-bubble msg-bubble--system">',
                    '<span class="msg-meta">' + escapeHtml(noticeLabel + ' · ' + formatWhen(m.createdAt)) + '</span>',
                    '<p class="msg-text">' + escapeHtml(noticeBody) + '</p>',
                    '</div>',
                    '</article>'
                ].join('');
            }

            var isOut = String(m.fromUserId || '') === String(currentUserId);
            var senderName = isOut ? 'You' : resolveUserName(m.fromUserId);
            var subjectLine = firstText(m.title, '');
            var metaParts = [senderName];
            if (subjectLine && subjectLine.toLowerCase() !== 'message' && subjectLine.toLowerCase() !== String(senderName || '').toLowerCase()) {
                metaParts.push(subjectLine);
            }
            metaParts.push(formatWhen(m.createdAt));
            var body = firstText(m.text, '');
            return [
                '<article class="msg-row ' + (isOut ? 'msg-row--out' : 'msg-row--in') + '">',
                '<div class="msg-bubble">',
                '<span class="msg-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>',
                '<p class="msg-text">' + escapeHtml(body) + '</p>',
                '</div>',
                '</article>'
            ].join('');
        }).join('');

        threadEl.innerHTML = rows;
        threadEl.scrollTop = threadEl.scrollHeight;
    }

    function init() {
        if (!window.auth || typeof window.auth.isLoggedIn !== 'function' || !window.auth.isLoggedIn()) {
            window.location.href = 'index.html';
            return;
        }

        var me = window.auth.getUser();
        if (!me || !me.id) {
            window.location.href = 'index.html';
            return;
        }

        if (window.auth.isProvider && window.auth.isProvider()
            && window.auth.isProviderPendingReview && window.auth.isProviderPendingReview(me)) {
            var profileHref = (typeof window.auth.resolveHubNavHref === 'function'
                ? window.auth.resolveHubNavHref('provider-profile.html?userId=' + encodeURIComponent(String(me.id)))
                : ('provider-profile.html?userId=' + encodeURIComponent(String(me.id))));
            window.location.replace(profileHref);
            return;
        }

        var params = new URLSearchParams(window.location.search || '');
        var toUserId = String(params.get('to') || '').trim();
        var bidId = String(params.get('bidId') || '').trim();
        var quoteId = String(params.get('quoteId') || '').trim();
        var replyToken = String(params.get('reply') || '').trim();

        if (!toUserId && replyToken && window.anytransportApi && typeof window.anytransportApi.resolveMessageReplyToken === 'function') {
            try {
                var replyContext = window.anytransportApi.resolveMessageReplyToken(replyToken);
                if (replyContext) {
                    toUserId = String(replyContext.toUserId || '').trim();
                    if (!bidId) bidId = String(replyContext.bidId || '').trim();
                    if (!quoteId) quoteId = String(replyContext.quoteId || '').trim();
                }
            } catch (_e) {
                var statusFromReply = document.getElementById('messages-status');
                if (statusFromReply) statusFromReply.textContent = 'That email link is invalid or has expired.';
            }
        }

        if (!toUserId && bidId) {
            var allBids = getAllBids();
            var seedBid = allBids.find(function (b) { return String(b.id || '') === bidId; }) || null;
            if (seedBid) toUserId = resolveConversationPeerFromBid(me, seedBid);
        }

        toUserId = correctSelfConversationPeer(me, toUserId, bidId, quoteId);

        if (toUserId && String(toUserId) === String(me.id)) {
            var selfChatStatus = document.getElementById('messages-status');
            if (selfChatStatus) {
                selfChatStatus.textContent = 'This chat link points to your own account. Open the thread from your dashboard messages list instead.';
            }
            var selfThreadEl = document.getElementById('messages-thread');
            if (selfThreadEl) {
                selfThreadEl.innerHTML = '<p class="messages-empty">Cannot message yourself. Use Dashboard → Messages and open a customer conversation.</p>';
            }
            return;
        }

        if (!toUserId) {
            var statusEl = document.getElementById('messages-status');
            if (statusEl) statusEl.textContent = 'Select a message thread from your profile.';
            var threadEl = document.getElementById('messages-thread');
            if (threadEl) threadEl.innerHTML = '<p class="messages-empty">No chat selected yet. Open a thread from your profile messages.</p>';
            return;
        }

        refreshMessagesQuoteContext(me, toUserId, quoteId);
        quoteId = getMessagesQuoteIdFromUrl(quoteId);

        var bidContextEl = document.getElementById('messages-bid-context');
        var bidTextEl = document.getElementById('messages-bid-text');
        var seedMessageText = '';
        if (bidId) {
            var bids = getAllBids();
            var contextBid = bids.find(function (b) { return String(b.id || '') === bidId; }) || null;
            if (contextBid) {
                seedMessageText = firstText(contextBid.message, contextBid.comment, '');
                if (bidContextEl && bidTextEl && seedMessageText) {
                    bidContextEl.style.display = '';
                    bidTextEl.textContent = seedMessageText;
                }
            }
        }

        var titleInput = document.getElementById('messages-title');
        var textInput = document.getElementById('messages-text');
        if (textInput && seedMessageText) textInput.value = seedMessageText;

        var conversation = [];
        if (window.anytransportApi && typeof window.anytransportApi.getConversation === 'function') {
            try {
                conversation = window.anytransportApi.getConversation(me.id, toUserId) || [];
            } catch (_e) {
                conversation = [];
            }
        }
        renderThread(me.id, conversation);

        try {
            var incomingTs = (conversation || [])
                .filter(function (m) { return String(m && m.toUserId || '') === String(me.id); })
                .map(function (m) { return new Date(m && m.createdAt || 0).getTime() || 0; })
                .filter(function (ts) { return ts > 0; });
            if (incomingTs.length) {
                var newest = Math.max.apply(null, incomingTs);
                localStorage.setItem('anytransport_customer_msg_seen_ts_' + String(me.id), String(newest));
                if (window.auth && typeof window.auth.initAuth === 'function') {
                    window.auth.initAuth();
                }
            }
        } catch (_seenErr) {}

        var form = document.getElementById('messages-form');
        var status = document.getElementById('messages-status');
        if (!form) return;

        bindContactWarnings(titleInput, textInput, status);

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var text = String(textInput && textInput.value || '').trim();
            var title = String(titleInput && titleInput.value || '').trim();
            if (!text) {
                setComposerContactWarning(status, titleInput, textInput, '');
                if (status) {
                    status.textContent = 'Write a message before sending.';
                    status.classList.remove('messages-status--warning');
                }
                return;
            }
            var contactWarning = getContactDetailsWarning(text) || getContactDetailsWarning(title);
            if (contactWarning) {
                setComposerContactWarning(status, titleInput, textInput, contactWarning);
                return;
            }

            if (!window.anytransportApi || typeof window.anytransportApi.sendMessage !== 'function') {
                if (status) status.textContent = 'Messaging is unavailable right now.';
                return;
            }

            try {
                var sent = window.anytransportApi.sendMessage(me.id, toUserId, text, title || 'Message');
                if (!sent) throw new Error('No response from API');
                if (textInput) textInput.value = '';
                setComposerContactWarning(status, titleInput, textInput, '');
                if (status) {
                    status.textContent = 'Message sent.';
                    status.classList.add('messages-status--ok');
                    status.classList.remove('messages-status--warning');
                }
                conversation.push(sent);
                renderThread(me.id, conversation);
            } catch (_e) {
                if (status) status.textContent = 'Failed to send message. Please try again.';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
