// Shared Notification System
(function () {
    const NOTIFICATIONS_STORAGE_KEY = 'anytransport_notifications';

    // Make functions globally available
    window.notificationSystem = {
        getUserNotificationsKey: function (user) {
            if (!user || !user.id) return null;
            return NOTIFICATIONS_STORAGE_KEY + '_' + String(user.id).trim();
        },

        getNotifications: function (user) {
            const key = this.getUserNotificationsKey(user);
            if (!key) return [];

            if (window.anytransportApi && typeof window.anytransportApi.getNotifications === 'function') {
                try {
                    return window.anytransportApi.getNotifications(user.id);
                } catch (_error) {
                    return [];
                }
            }

            try {
                const stored = JSON.parse(localStorage.getItem(key) || '[]');
                return Array.isArray(stored) ? stored : [];
            } catch (_error) {
                return [];
            }
        },

        addNotification: function (user, type, title, message, data) {
            if (!user || !user.id) return false;
            const key = this.getUserNotificationsKey(user);
            if (!key) return false;

            const notification = {
                id: 'notif-' + Date.now(),
                type: type,
                title: title,
                message: message,
                data: data || {},
                read: false,
                createdAt: new Date().toISOString()
            };

            if (window.anytransportApi && typeof window.anytransportApi.addNotification === 'function') {
                try {
                    const saved = window.anytransportApi.addNotification(user.id, notification);
                    this.updateNotificationUI();
                    return !!saved;
                } catch (_error) {
                    return false;
                }
            }

            let notifications = this.getNotifications(user);

            notifications.unshift(notification);

            // Keep only last 50 notifications
            if (notifications.length > 50) {
                notifications = notifications.slice(0, 50);
            }

            try {
                localStorage.setItem(key, JSON.stringify(notifications));
                this.updateNotificationUI();
                return true;
            } catch (_error) {
                return false;
            }
        },

        markNotificationAsRead: function (user, notificationId) {
            if (!user || !user.id) return false;
            const key = this.getUserNotificationsKey(user);
            if (!key) return false;

            if (window.anytransportApi && typeof window.anytransportApi.markNotificationAsRead === 'function') {
                try {
                    const result = window.anytransportApi.markNotificationAsRead(user.id, notificationId);
                    this.updateNotificationUI();
                    return !!result;
                } catch (_error) {
                    return false;
                }
            }

            let notifications = this.getNotifications(user);
            const notif = notifications.find(function (n) {
                return String(n.id || '') === String(notificationId || '');
            });

            if (!notif) return false;

            notif.read = true;
            try {
                localStorage.setItem(key, JSON.stringify(notifications));
                this.updateNotificationUI();
                return true;
            } catch (_error) {
                return false;
            }
        },

        clearAllNotifications: function (user) {
            if (!user || !user.id) return false;
            const key = this.getUserNotificationsKey(user);
            if (!key) return false;

            if (window.anytransportApi && typeof window.anytransportApi.clearNotifications === 'function') {
                try {
                    const result = window.anytransportApi.clearNotifications(user.id);
                    this.updateNotificationUI();
                    return !!result;
                } catch (_error) {
                    return false;
                }
            }

            try {
                localStorage.removeItem(key);
                this.updateNotificationUI();
                return true;
            } catch (_error) {
                return false;
            }
        },

        getTimeAgo: function (isoString) {
            if (!isoString) return 'Just now';
            const date = new Date(isoString);
            const now = new Date();
            const seconds = Math.floor((now - date) / 1000);

            if (seconds < 60) return 'Just now';
            if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
            if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
            return Math.floor(seconds / 86400) + 'd ago';
        },

        escapeHtml: function (text) {
            if (!text) return '';
            var map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return String(text).replace(/[&<>"']/g, function (m) { return map[m]; });
        },

        updateNotificationUI: function () {
            // Get active user from global scope or localStorage
            var user = null;
            if (typeof getActiveUser === 'function') {
                user = getActiveUser();
            } else {
                try {
                    user = JSON.parse(localStorage.getItem('anytransport_user') || 'null');
                } catch (_e) {
                    return;
                }
            }

            if (!user) return;

            var notifications = this.getNotifications(user);
            var unreadCount = notifications.filter(function (n) { return !n.read; }).length;

            var badgeEl = document.getElementById('notification-badge');
            var listEl = document.getElementById('notification-list');
            var self = this;

            if (badgeEl) {
                if (unreadCount > 0) {
                    badgeEl.textContent = String(unreadCount > 99 ? '99+' : unreadCount);
                    badgeEl.style.display = 'flex';
                } else {
                    badgeEl.style.display = 'none';
                }
            }

            if (listEl) {
                if (notifications.length === 0) {
                    listEl.innerHTML = '<div class="notification-empty">No notifications yet</div>';
                } else {
                    listEl.innerHTML = notifications.map(function (notif) {
                        var timeAgo = self.getTimeAgo(notif.createdAt);
                        var icon = notif.type === 'quote-accepted' ? '✓' : '📋';
                        var typeClass = notif.type === 'quote-accepted' ? 'quote-accepted' : 'quote-added';
                        var quoteId = (notif.data && notif.data.quoteId) ? String(notif.data.quoteId) : '';
                        var dataAttr = quoteId ? ' data-quote-id="' + self.escapeHtml(quoteId) + '"' : '';
                        var clickableClass = quoteId ? ' notification-clickable' : '';

                        return '<div class="notification-item ' + (notif.read ? '' : 'unread') + ' ' + typeClass + clickableClass + '" data-notification-id="' + self.escapeHtml(notif.id) + '"' + dataAttr + ' style="' + (quoteId ? 'cursor: pointer;' : '') + '">' +
                            '<div class="notification-item-icon">' + icon + '</div>' +
                            '<div class="notification-item-content">' +
                                '<p class="notification-item-title">' + self.escapeHtml(notif.title) + '</p>' +
                                '<p class="notification-item-message">' + self.escapeHtml(notif.message) + '</p>' +
                                '<p class="notification-item-time">' + timeAgo + '</p>' +
                            '</div>' +
                        '</div>';
                    }).join('');

                    // Attach click handlers to notification items
                    var notificationItems = listEl.querySelectorAll('.notification-item');
                    notificationItems.forEach(function (item) {
                        item.addEventListener('click', function (e) {
                            e.stopPropagation();
                            var notificationId = item.getAttribute('data-notification-id');
                            var quoteId = item.getAttribute('data-quote-id');
                            
                            if (quoteId) {
                                // Mark as read
                                if (user && typeof user.id !== 'undefined') {
                                    self.markNotificationAsRead(user, notificationId);
                                }
                                // Navigate to listing-details page with quoteId
                                window.location.href = 'listing-details.html?quoteId=' + encodeURIComponent(quoteId);
                            }
                        });
                    });
                }
            }
        },

        initBell: function () {
            var bellBtn = document.getElementById('notification-bell');
            var dropdown = document.getElementById('notification-dropdown');
            var closeBtn = document.getElementById('notification-close');
            var self = this;

            // Debug logging
            console.log('initBell called:', {
                bellBtn: !!bellBtn,
                dropdown: !!dropdown,
                closeBtn: !!closeBtn
            });

            if (!bellBtn || !dropdown) {
                console.warn('Notification bell elements not found');
                return;
            }

            // Prevent multiple listeners by using a flag
            if (dropdown.hasAttribute('data-listeners-attached')) {
                console.log('Listeners already attached, skipping');
                this.updateNotificationUI();
                return;
            }

            // Mark that listeners are attached
            dropdown.setAttribute('data-listeners-attached', 'true');

            // Use a single passive event listener for outside clicks
            var outsideClickHandler = function (evt) {
                if (!dropdown || !bellBtn) return;
                
                // Check if click is outside the bell and dropdown
                var isClickInside = dropdown.contains(evt.target) || bellBtn.contains(evt.target);
                
                if (!isClickInside && dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                    console.log('Outside click detected, closing dropdown');
                }
            };

            // Bell button click - toggle dropdown (non-passive for preventDefault)
            bellBtn.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var isVisible = dropdown.style.display === 'block';
                dropdown.style.display = isVisible ? 'none' : 'block';
                console.log('Bell clicked, dropdown now:', dropdown.style.display);
            }, false);

            // Close button click
            if (closeBtn) {
                closeBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    dropdown.style.display = 'none';
                    console.log('Close button clicked');
                }, false);
            }

            // Close dropdown when clicking outside (passive for performance)
            document.addEventListener('click', outsideClickHandler, { passive: true, capture: false });

            // Allow clicks inside dropdown to not close it
            dropdown.addEventListener('click', function (e) {
                e.stopPropagation();
            }, false);

            console.log('Notification bell initialized successfully');
            this.updateNotificationUI();
        }
    };
})();
