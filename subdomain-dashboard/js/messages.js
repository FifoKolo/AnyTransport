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

    var CONTACT_CHECKS = [
        {
            pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
            warning: 'Email addresses are not allowed. Keep all communication on AnyTransport.'
        },
        {
            pattern: /\d{5,}/,
            warning: 'Phone numbers are not allowed. Do not share contact details in messages.'
        },
        {
            pattern: /(?:\+?\d[\d\s().-]{6,}\d)/,
            warning: 'Phone numbers are not allowed. Do not share contact details in messages.'
        },
        {
            pattern: /(?:https?:\/\/|www\.)\S+/i,
            warning: 'Links are not allowed in messages.'
        },
        {
            pattern: /\b(?:whatsapp|telegram|viber|wechat|snapchat|instagram|facebook|messenger|discord|skype|call me|text me|dm me|message me on)\b/i,
            warning: 'External contact apps are not allowed. Keep all communication on AnyTransport.'
        }
    ];

    function findContactMatches(text) {
        var value = String(text == null ? '' : text);
        if (!value) return [];
        var matches = [];
        for (var i = 0; i < CONTACT_CHECKS.length; i += 1) {
            var check = CONTACT_CHECKS[i];
            var pattern = check.pattern;
            var flags = pattern.flags.indexOf('g') >= 0 ? pattern.flags : pattern.flags + 'g';
            var re = new RegExp(pattern.source, flags);
            var match;
            while ((match = re.exec(value)) !== null) {
                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    warning: check.warning
                });
                if (match[0].length === 0) {
                    re.lastIndex += 1;
                }
            }
        }
        if (!matches.length) return [];
        matches.sort(function (a, b) {
            return a.start - b.start || a.end - b.end;
        });
        var merged = [];
        matches.forEach(function (entry) {
            var last = merged[merged.length - 1];
            if (!last || entry.start > last.end) {
                merged.push({ start: entry.start, end: entry.end });
                return;
            }
            if (entry.end > last.end) {
                last.end = entry.end;
            }
        });
        return merged;
    }

    function getContactDetailsWarning(text) {
        var value = String(text == null ? '' : text);
        if (!value.trim()) return '';
        for (var i = 0; i < CONTACT_CHECKS.length; i += 1) {
            if (CONTACT_CHECKS[i].pattern.test(value)) return CONTACT_CHECKS[i].warning;
        }
        return '';
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

    function ensureInputHighlightLayer(inputEl) {
        if (!inputEl || inputEl.dataset.messagesHighlightReady === '1') {
            return inputEl && inputEl.closest('.messages-input-highlight-wrap');
        }
        var wrap = document.createElement('div');
        wrap.className = 'messages-input-highlight-wrap';
        inputEl.parentNode.insertBefore(wrap, inputEl);
        wrap.appendChild(inputEl);

        var backdrop = document.createElement('div');
        backdrop.className = 'messages-input-highlight-backdrop';
        backdrop.setAttribute('aria-hidden', 'true');

        var content = document.createElement('div');
        content.className = 'messages-input-highlight-content';
        backdrop.appendChild(content);
        wrap.insertBefore(backdrop, inputEl);

        inputEl.classList.add('messages-input--highlighted');
        inputEl.dataset.messagesHighlightReady = '1';

        inputEl.addEventListener('scroll', function () {
            backdrop.scrollTop = inputEl.scrollTop;
            backdrop.scrollLeft = inputEl.scrollLeft;
        });

        return wrap;
    }

    function syncInputHighlightLayer(inputEl) {
        if (!inputEl || inputEl.dataset.messagesHighlightReady !== '1') return;
        var wrap = inputEl.closest('.messages-input-highlight-wrap');
        if (!wrap) return;
        var backdrop = wrap.querySelector('.messages-input-highlight-backdrop');
        var content = wrap.querySelector('.messages-input-highlight-content');
        if (!backdrop || !content) return;

        var matches = findContactMatches(inputEl.value);
        var hasMatches = matches.length > 0;
        wrap.classList.toggle('messages-input-highlight-wrap--active', hasMatches);
        content.innerHTML = buildHighlightedMarkup(inputEl.value, matches) + (inputEl.tagName === 'TEXTAREA' ? '\n' : '');
        backdrop.scrollTop = inputEl.scrollTop;
        backdrop.scrollLeft = inputEl.scrollLeft;
    }

    function setComposerContactWarning(statusEl, titleInput, textInput, warningText) {
        var hasWarning = !!warningText;
        if (statusEl) {
            statusEl.textContent = warningText || '';
            statusEl.classList.toggle('messages-status--warning', hasWarning);
            statusEl.classList.toggle('messages-status--ok', !hasWarning && statusEl.textContent === 'Message sent.');
        }
        [titleInput, textInput].forEach(function (el) {
            if (!el) return;
            ensureInputHighlightLayer(el);
            var fieldWarning = getContactDetailsWarning(el.value);
            var fieldHasIssue = hasWarning && !!fieldWarning;
            el.classList.toggle('messages-input--warning', fieldHasIssue);
            el.setAttribute('aria-invalid', fieldHasIssue ? 'true' : 'false');
            syncInputHighlightLayer(el);
        });
    }

    function bindContactWarnings(titleInput, textInput, statusEl) {
        [titleInput, textInput].forEach(function (el) {
            if (el) ensureInputHighlightLayer(el);
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
            var isOut = String(m.fromUserId || '') === String(currentUserId);
            var title = firstText(m.title, 'Message');
            var body = firstText(m.text, '');
            return [
                '<article class="msg-row ' + (isOut ? 'msg-row--out' : 'msg-row--in') + '">',
                '<div class="msg-bubble">',
                '<span class="msg-meta">' + escapeHtml(title) + ' · ' + escapeHtml(formatWhen(m.createdAt)) + '</span>',
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
            if (seedBid) toUserId = String(seedBid.providerId || '');
        }

        if (!toUserId) {
            var statusEl = document.getElementById('messages-status');
            if (statusEl) statusEl.textContent = 'Select a message thread from your profile.';
            var threadEl = document.getElementById('messages-thread');
            if (threadEl) threadEl.innerHTML = '<p class="messages-empty">No chat selected yet. Open a thread from your profile messages.</p>';
            return;
        }

        var subtitleEl = document.getElementById('messages-subtitle');
        if (subtitleEl) {
            subtitleEl.textContent = 'Conversation with ' + resolveUserName(toUserId) + (quoteId ? (' for quote ' + quoteId) : '');
        }

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
