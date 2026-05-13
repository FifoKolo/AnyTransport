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

    function containsContactDetails(text) {
        var value = String(text == null ? '' : text).trim();
        if (!value) return false;
        var checks = [
            /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
            /(?:\+?\d[\d\s().-]{6,}\d)/,
            /(?:https?:\/\/|www\.)\S+/i,
            /\b(?:whatsapp|telegram|viber|wechat|snapchat|instagram|facebook|messenger|discord|skype|call me|text me)\b/i
        ];
        return checks.some(function (pattern) { return pattern.test(value); });
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

        form.addEventListener('submit', function (event) {
            event.preventDefault();

            var text = String(textInput && textInput.value || '').trim();
            var title = String(titleInput && titleInput.value || '').trim();
            if (!text) {
                if (status) status.textContent = 'Write a message before sending.';
                return;
            }
            if (containsContactDetails(text) || containsContactDetails(title)) {
                if (status) status.textContent = 'Contact details are not allowed in customer/provider messages.';
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
                if (status) status.textContent = 'Message sent.';
                conversation.push(sent);
                renderThread(me.id, conversation);
            } catch (_e) {
                if (status) status.textContent = 'Failed to send message. Please try again.';
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
