(function () {
    const LISTING_STORAGE_KEY = 'anytransport_quote_requests';
    const BID_STORAGE_KEY = 'anytransport_provider_bids';
    const SAVED_MESSAGES_STORAGE_KEY = 'anytransport_provider_saved_messages';
    const NOTIFICATIONS_STORAGE_KEY = 'anytransport_notifications';
    const ANYTRANSPORT_MAPBOX_TOKEN = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ';

    document.addEventListener('DOMContentLoaded', initListingDetailsPage);

    function initListingDetailsPage() {
        const listingRef = getListingRefFromUrl();
        const titleEl = document.getElementById('details-title');
        const subtitleEl = document.getElementById('details-subtitle');

        if (!listingRef) {
            titleEl.textContent = 'Listing not found';
            subtitleEl.textContent = 'Missing listing ID in URL.';
            renderMissingState('No listing was selected. Open a listing from the provider board.');
            return;
        }

        let quote = resolveListingByRef(getAllQuotes(), listingRef);
        if (!quote) {
            quote = resolveListingViaApi(listingRef);
        }
        if (!quote) {
            titleEl.textContent = 'Listing not found';
            subtitleEl.textContent = 'The selected listing does not exist in local storage.';
            renderMissingState('This listing may have been removed or not created on this browser yet.');
            return;
        }

        const quoteId = String((quote && quote.id) || '').trim();
        const listingId = getFormIdLabel(quote);

        titleEl.textContent = getQuoteTitle(quote);
        const transportSpaceLabel = getTransportSpaceDisplay(quote);
        subtitleEl.textContent = transportSpaceLabel
            ? ('Listing ' + listingId + ' • ' + transportSpaceLabel)
            : ('Listing ' + listingId + ' • Full listing details');

        const isAdmin = isAdminUser();
        const showQuoteTools = isTransportProviderUser();
        if (!showQuoteTools) {
            document.body.classList.add('listing-details--customer');
            applyCustomerListingChrome(isAdmin);
        }

        renderQuickInfo(quote);
        renderWatchToggle(quote);
        renderMap(quote);
        renderInventory(quote);
        renderMediaGallery(quote);
        renderServices(quote);
        if (showQuoteTools) {
            renderBidUserContext();
            renderSidebarQuickInfo(quote);
            renderProviderReportForm(quote);
        }
        renderBids(quoteId, quote);
        if (showQuoteTools) {
            initializeBidFormDefaults(quote);
            setupBidForm(quoteId, quote);
        }
        renderFormSections(quote);
        initNotificationBell();
    }

    function applyCustomerListingChrome(isAdmin) {
        var profileHref = isAdmin ? 'dashboard.html#verification-review' : 'customer-dashboard.html';
        var profileLabel = isAdmin ? 'Back to Admin Panel' : 'Back to Profile';
        document.querySelectorAll('.back-to-listings-btn, .details-hero .back-btn').forEach(function (el) {
            if (!el) return;
            el.textContent = profileLabel;
            el.setAttribute('href', profileHref);
        });
        var eyebrow = document.querySelector('.details-hero .eyebrow');
        if (eyebrow) {
            eyebrow.textContent = isAdmin ? 'Admin review' : 'Your request';
        }
    }

    function getActiveUser() {
        if (typeof auth !== 'undefined' && auth && typeof auth.getUser === 'function') {
            const authUser = auth.getUser();
            if (authUser && authUser.id) return authUser;
        }

        try {
            const stored = JSON.parse(localStorage.getItem('anytransport_user') || 'null');
            if (stored && stored.id) return stored;
        } catch (_error) {
            // Ignore invalid storage payload.
        }

        return null;
    }

    function isTransportProviderUser() {
        if (typeof auth !== 'undefined' && auth && typeof auth.isProvider === 'function') {
            try {
                return !!auth.isProvider();
            } catch (_error) {
                return false;
            }
        }

        const user = getActiveUser();
        const roles = user && Array.isArray(user.roles) ? user.roles : [user && user.role];
        return roles.some(function (role) {
            return String(role || '').trim().toLowerCase() === 'provider';
        });
    }

    function isAdminUser() {
        if (typeof auth !== 'undefined' && auth && typeof auth.isAdmin === 'function') {
            try {
                return !!auth.isAdmin();
            } catch (_error) {
                return false;
            }
        }
        const user = getActiveUser();
        const roles = user && Array.isArray(user.roles) ? user.roles : [user && user.role];
        return roles.some(function (role) {
            return String(role || '').trim().toLowerCase() === 'admin';
        });
    }

    function getProviderStorageKey(user) {
        if (!user || !user.id) return null;
        return SAVED_MESSAGES_STORAGE_KEY + '_' + String(user.id).trim();
    }

    function getSavedMessages(user) {
        const key = getProviderStorageKey(user);
        if (!key) return [];

        if (window.anytransportApi && typeof window.anytransportApi.getSavedMessages === 'function') {
            try {
                return window.anytransportApi.getSavedMessages(user.id);
            } catch (_error) {
                return [];
            }
        }

        try {
            const stored = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(stored) ? stored.filter(function (msg) {
                return String(msg && msg.text || '').trim().length > 0;
            }) : [];
        } catch (_error) {
            return [];
        }
    }

    function addSavedMessage(user, messageText, title) {
        if (!user || !user.id) return false;
        const key = getProviderStorageKey(user);
        if (!key) return false;

        const text = String(messageText || '').trim();
        if (!text) return false;

        let messages = getSavedMessages(user);

        // Check if message already exists (prevent duplicates)
        if (messages.some(function (msg) {
            return String(msg.text || '').trim() === text;
        })) {
            return false;
        }

        const msgTitle = String(title || '').trim() || text.substring(0, 50);

        const payload = {
            id: 'msg-' + Date.now(),
            text: text,
            title: msgTitle,
            createdAt: new Date().toISOString()
        };

        if (window.anytransportApi && typeof window.anytransportApi.saveSavedMessage === 'function') {
            try {
                return !!window.anytransportApi.saveSavedMessage(user.id, payload);
            } catch (_error) {
                return false;
            }
        }

        messages.unshift(payload);

        if (messages.length > 20) {
            messages = messages.slice(0, 20);
        }

        try {
            localStorage.setItem(key, JSON.stringify(messages));
            return true;
        } catch (_error) {
            return false;
        }
    }

    function deleteSavedMessage(user, messageId) {
        if (!user || !user.id) return false;
        const key = getProviderStorageKey(user);
        if (!key) return false;

        let messages = getSavedMessages(user);
        const filtered = messages.filter(function (msg) {
            return String(msg.id || '') !== String(messageId || '');
        });

        if (filtered.length === messages.length) {
            return false; // Message not found
        }

        if (window.anytransportApi && typeof window.anytransportApi.deleteSavedMessage === 'function') {
            try {
                return !!window.anytransportApi.deleteSavedMessage(user.id, messageId);
            } catch (_error) {
                return false;
            }
        }

        try {
            localStorage.setItem(key, JSON.stringify(filtered));
            return true;
        } catch (_error) {
            return false;
        }
    }

    function populateSavedMessagesDropdown() {
        const templateEl = document.getElementById('bid-template');
        if (!templateEl) return;

        const user = getActiveUser();
        if (!user) return;

        const savedMessages = getSavedMessages(user);
        const currentOptions = Array.from(templateEl.querySelectorAll('option'));
        const baseOptions = currentOptions.slice(0, 3); // Keep first 3 hardcoded options

        // Remove any existing saved message options
        currentOptions.slice(3).forEach(function (option) {
            option.remove();
        });

        if (savedMessages.length > 0) {
            // Add a separator (optgroup or just a disabled option)
            const separatorOption = document.createElement('option');
            separatorOption.disabled = true;
            separatorOption.textContent = '— Your Saved Messages —';
            templateEl.appendChild(separatorOption);

            // Add saved messages
            savedMessages.forEach(function (msg) {
                const option = document.createElement('option');
                option.value = msg.text;
                const displayTitle = msg.title || msg.text.substring(0, 50);
                option.textContent = displayTitle + (displayTitle.length > 50 ? '...' : '');
                option.title = msg.title || msg.text;
                option.dataset.saved = 'true';
                option.dataset.messageId = msg.id;
                templateEl.appendChild(option);
            });
        }
    }

    function updateSavedMessagesInfo() {
        const user = getActiveUser();
        if (!user) return;

        const savedMessages = getSavedMessages(user);
        const infoEl = document.getElementById('saved-messages-info');
        const countEl = document.getElementById('saved-messages-count');

        if (infoEl && countEl) {
            countEl.textContent = String(savedMessages.length);
            if (savedMessages.length > 0) {
                infoEl.style.display = 'flex';
            } else {
                infoEl.style.display = 'none';
            }
        }
    }

    function clearAllSavedMessages() {
        const user = getActiveUser();
        if (!user) {
            alert('You must be logged in to clear saved messages.');
            return;
        }

        const confirmed = confirm('Are you sure you want to delete all ' + getSavedMessages(user).length + ' saved messages? This cannot be undone.');
        if (!confirmed) return;

        const key = getProviderStorageKey(user);
        if (key) {
            if (window.anytransportApi && typeof window.anytransportApi.deleteSavedMessage === 'function') {
                try {
                    const savedMessages = getSavedMessages(user);
                    savedMessages.forEach(function (message) {
                        window.anytransportApi.deleteSavedMessage(user.id, message.id);
                    });
                    populateSavedMessagesDropdown();
                    updateSavedMessagesInfo();
                    alert('All saved messages have been cleared.');
                    return;
                } catch (_error) {
                    alert('Failed to clear saved messages. Please try again.');
                    return;
                }
            }

            try {
                localStorage.removeItem(key);
                populateSavedMessagesDropdown();
                updateSavedMessagesInfo();
                alert('All saved messages have been cleared.');
            } catch (_error) {
                alert('Failed to clear saved messages. Please try again.');
            }
        }
    }

    function renderBidUserContext() {
        const contextEl = document.getElementById('bid-user-context');
        if (!contextEl) return;

        const user = getActiveUser();
        if (!user) {
            contextEl.textContent = 'You are not signed in. Sign in to place bids from your provider profile.';
            return;
        }

        const displayName = firstText(user.username, user.nickname, user.name, user.email, 'Provider');
        contextEl.textContent = 'Bidding as: ' + displayName;
    }

    function renderSidebarQuickInfo(quote) {
        const root = document.getElementById('sidebar-quick-info');
        if (!root) return;

        const listingId = getFormIdLabel(quote);
        const distance = firstText(formatDistance(quote), 'Not provided');
        const moveDate = firstText(getMoveDate(quote), 'Not provided');
        const service = firstText(getServiceLabel(quote), 'Not provided');
        const transportSpace = getTransportSpaceDisplay(quote) || 'Not specified';

        root.innerHTML = [
            buildSidebarInfoRow('Listing ID', listingId),
            buildSidebarInfoRow('Transport space', transportSpace),
            buildSidebarInfoRow('Number of bids', '<span id="sidebar-bid-count">0</span>', true),
            buildSidebarInfoRow('Distance', distance),
            buildSidebarInfoRow('Pickup date', moveDate),
            buildSidebarInfoRow('Delivery date', moveDate),
            buildSidebarInfoRow('Service', service)
        ].join('');
    }

    function buildSidebarInfoRow(label, value, isHtml) {
        return '<div class="sidebar-info-row">' +
            '<span class="sidebar-info-label">' + escapeHtml(label) + '</span>' +
            '<span class="sidebar-info-value">' + (isHtml ? value : escapeHtml(value)) + '</span>' +
            '</div>';
    }

    function updateSidebarBidCount(count) {
        const countEl = document.getElementById('sidebar-bid-count');
        if (countEl) countEl.textContent = String(Number(count) || 0);

        const legacyCountEl = document.getElementById('legacy-bid-count');
        if (legacyCountEl) legacyCountEl.textContent = String(Number(count) || 0);
    }

    // Initialize Notification Bell (uses shared notification system from notifications.js)
    function initNotificationBell() {
        if (typeof window.notificationSystem === 'object' && window.notificationSystem.initBell) {
            window.notificationSystem.initBell();
        }
    }

    function initializeBidFormDefaults(quote) {
        const modeEl = document.getElementById('bid-expiry-mode');
        const customExpiryGroup = document.getElementById('bid-custom-expiry-group');
        const dateEl = document.getElementById('bid-expire-date');
        const timeEl = document.getElementById('bid-expire-time');
        const templateEl = document.getElementById('bid-template');
        const messageEl = document.getElementById('bid-message');
        const pickupDateEl = document.getElementById('bid-pickup-date');
        const deliveryDateEl = document.getElementById('bid-delivery-date');
        const defaultTemplate = 'Check availability 2';
        const defaultMessage = 'If you are happy with our quote and you don\'t have any questions, please accept our bid as soon as possible to avoid disappointment from being us not available on your preferred date and time as we are working on the first come first serve basis.';

        if (modeEl && !modeEl.value) {
            modeEl.value = 'listingEnds';
        }

        updateBidExpiryModeVisibility();

        if (dateEl && !dateEl.value) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateEl.value = formatBidDate(tomorrow);
        }

        if (timeEl && !timeEl.value) {
            timeEl.value = '23:59';
        }

        if (templateEl && !templateEl.value) {
            templateEl.value = defaultTemplate;
        }

        if (messageEl && !String(messageEl.value || '').trim()) {
            messageEl.value = defaultMessage;
        }

        const moveDate = firstText(getMoveDate(quote), 'Not provided');
        if (pickupDateEl) pickupDateEl.textContent = moveDate + ' (fixed)';
        if (deliveryDateEl) deliveryDateEl.textContent = moveDate + ' (fixed)';

        if (customExpiryGroup) {
            customExpiryGroup.hidden = !modeEl || modeEl.value !== 'custom';
        }

        updateAutoBidFieldsVisibility();
        preloadAutoBidSettings(quote);
    }

    function updateAutoBidFieldsVisibility() {
        const enabledEl = document.getElementById('bid-autobid-enabled');
        const fieldsEl = document.getElementById('bid-autobid-fields');
        if (!fieldsEl || !enabledEl) return;
        fieldsEl.hidden = !enabledEl.checked;
    }

    function preloadAutoBidSettings(quote) {
        const enabledEl = document.getElementById('bid-autobid-enabled');
        const incrementEl = document.getElementById('bid-autobid-increment');
        const floorEl = document.getElementById('bid-autobid-floor');
        if (!enabledEl || !quote) return;

        const user = getActiveUser();
        if (!user || !user.id) return;

        let myBid = null;
        if (window.anytransportApi && typeof window.anytransportApi.getBids === 'function') {
            try {
                const bids = window.anytransportApi.getBids(quote.id) || [];
                myBid = bids.find(function (bid) {
                    return String(bid && bid.providerId || '') === String(user.id) && String(bid.status || 'active') === 'active';
                }) || null;
            } catch (_error) {
                myBid = null;
            }
        }

        if (myBid) {
            enabledEl.checked = !!myBid.autoBidEnabled;
            if (incrementEl && myBid.autoBidIncrement) {
                incrementEl.value = String(myBid.autoBidIncrement);
            }
            if (floorEl && myBid.autoBidFloor) {
                floorEl.value = String(myBid.autoBidFloor);
            }
        } else {
            enabledEl.checked = false;
            if (incrementEl && !incrementEl.value) incrementEl.value = '5';
            if (floorEl) floorEl.value = '';
        }
        updateAutoBidFieldsVisibility();
    }

    function updateBidExpiryModeVisibility() {
        const modeEl = document.getElementById('bid-expiry-mode');
        const customExpiryGroup = document.getElementById('bid-custom-expiry-group');
        const dateEl = document.getElementById('bid-expire-date');
        const timeEl = document.getElementById('bid-expire-time');
        const isCustom = String(modeEl && modeEl.value || 'listingEnds') === 'custom';

        if (customExpiryGroup) customExpiryGroup.hidden = !isCustom;
        if (dateEl) dateEl.disabled = !isCustom;
        if (timeEl) timeEl.disabled = !isCustom;
    }

    function formatIsoDate(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const year = String(date.getFullYear());
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function formatBidDate(value) {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = String(date.getFullYear());
        return day + '/' + month + '/' + year;
    }

    function getListingRefFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const listingId = String(params.get('id') || '').trim();
        if (listingId) return { type: 'formId', value: listingId };

        const quoteId = String(params.get('quoteId') || '').trim();
        if (quoteId) return { type: 'quoteId', value: quoteId };

        return null;
    }

    function resolveListingByRef(quotes, listingRef) {
        if (!Array.isArray(quotes) || !listingRef) return null;
        const target = String(listingRef.value || '').trim();
        if (!target) return null;

        if (listingRef.type === 'formId') {
            return quotes.find((entry) => String((entry && entry.formId) || '').trim() === target)
                || quotes.find((entry) => String((entry && entry.id) || '').trim() === target)
                || null;
        }

        return quotes.find((entry) => String((entry && entry.id) || '').trim() === target) || null;
    }

    function getAllQuotes() {
        if (window.anytransportApi && typeof window.anytransportApi.getQuotes === 'function') {
            try {
                return window.anytransportApi.getQuotes();
            } catch (_error) {
                return [];
            }
        }

        try {
            const parsed = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function resolveListingViaApi(listingRef) {
        if (!listingRef || !window.anytransportApi) return null;
        try {
            if (listingRef.type === 'formId' && typeof window.anytransportApi.getQuoteByFormId === 'function') {
                const byFormId = window.anytransportApi.getQuoteByFormId(listingRef.value);
                if (byFormId) return byFormId;
            }
            if (typeof window.anytransportApi.getQuote === 'function') {
                const byQuoteId = window.anytransportApi.getQuote(listingRef.value);
                if (byQuoteId) return byQuoteId;
            }
        } catch (_error) {
            return null;
        }
        return null;
    }

    function renderProviderReportForm(quote) {
        const quotesSection = document.getElementById('bid-history');
        const quotesPanel = quotesSection ? quotesSection.closest('.legacy-bids-panel') : null;
        if (!quotesSection || !quotesPanel || !quote) return;
        if (document.querySelector('.provider-report-panel')) return;
        const quoteId = String((quote && quote.id) || '').trim();
        if (!quoteId) return;

        const wrapper = document.createElement('section');
        wrapper.className = 'provider-report-panel';
        wrapper.style.marginTop = '12px';
        wrapper.style.paddingTop = '12px';
        wrapper.style.borderTop = '1px solid #e2e8f0';
        wrapper.innerHTML = [
            '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">',
            '<button type="button" class="btn btn-danger provider-report-open">Report this listing</button>',
            '<span class="provider-report-status" style="font-size:13px; color:#64748b;"></span>',
            '</div>',
            '<div class="provider-report-modal" style="display:none; position:fixed; inset:0; z-index:1200;">',
            '<div class="provider-report-modal-backdrop" style="position:absolute; inset:0; background:rgba(15, 23, 42, 0.45);"></div>',
            '<div style="position:relative; max-width:520px; margin:8vh auto; background:#fff; border-radius:12px; border:1px solid #e2e8f0; box-shadow:0 20px 45px rgba(15, 23, 42, 0.25); padding:16px;">',
            '<h4 style="margin:0 0 8px;">Report this listing</h4>',
            '<p style="margin:0 0 10px; color:#64748b; font-size:13px;">If this listing looks suspicious (fake/scam/abuse), report it to admin.</p>',
            '<div style="display:grid; gap:8px;">',
            '<select class="form-input provider-report-reason">',
            '<option value="">Select reason</option>',
            '<option value="false_form">False or misleading listing</option>',
            '<option value="suspected_scam">Suspected scam</option>',
            '<option value="abusive_user">Abusive user behaviour</option>',
            '<option value="other">Other issue</option>',
            '</select>',
            '<textarea class="form-input provider-report-details" rows="4" maxlength="1000" placeholder="Add details (optional but helpful)"></textarea>',
            '<div style="display:flex; gap:8px; align-items:center; justify-content:flex-end; flex-wrap:wrap;">',
            '<button type="button" class="btn btn-outline provider-report-cancel">Cancel</button>',
            '<button type="button" class="btn btn-danger provider-report-submit">Send report</button>',
            '</div>',
            '</div>',
            '</div>',
            '</div>'
        ].join('');
        quotesPanel.insertAdjacentElement('afterend', wrapper);

        const openEl = wrapper.querySelector('.provider-report-open');
        const modalEl = wrapper.querySelector('.provider-report-modal');
        const backdropEl = wrapper.querySelector('.provider-report-modal-backdrop');
        const cancelEl = wrapper.querySelector('.provider-report-cancel');
        const reasonEl = wrapper.querySelector('.provider-report-reason');
        const detailsEl = wrapper.querySelector('.provider-report-details');
        const submitEl = wrapper.querySelector('.provider-report-submit');
        const statusEl = wrapper.querySelector('.provider-report-status');
        if (!submitEl || !modalEl || !openEl) return;

        function closeModal() {
            modalEl.style.display = 'none';
        }

        openEl.addEventListener('click', function () {
            modalEl.style.display = 'block';
            if (reasonEl) reasonEl.focus();
        });
        if (cancelEl) cancelEl.addEventListener('click', closeModal);
        if (backdropEl) backdropEl.addEventListener('click', closeModal);

        submitEl.addEventListener('click', function () {
            const reason = String(reasonEl && reasonEl.value || '').trim();
            const details = String(detailsEl && detailsEl.value || '').trim();
            if (!reason) {
                if (statusEl) statusEl.textContent = 'Pick a reason first.';
                return;
            }
            if (!window.anytransportApi || typeof window.anytransportApi.createFormReport !== 'function') {
                if (statusEl) statusEl.textContent = 'Reporting is unavailable right now.';
                return;
            }
            try {
                window.anytransportApi.createFormReport({ quoteId: quoteId, reason: reason, details: details });
                if (statusEl) statusEl.textContent = 'Report sent to admin.';
                if (reasonEl) reasonEl.value = '';
                if (detailsEl) detailsEl.value = '';
                closeModal();
            } catch (_error) {
                if (statusEl) statusEl.textContent = 'Failed to send report. Please try again.';
            }
        });
    }

    function getFormIdLabel(quote) {
        return firstText(quote && quote.formId, quote && quote.id, quote && quote.quoteId, quote && quote.requestId, 'Not provided');
    }

    function getTransportSpaceDisplay(quote) {
        const label = firstText(quote && quote.transportSpaceLabel, '');
        if (label) {
            return label;
        }
        const raw = String((quote && quote.transportSpace) || '').trim().toLowerCase();
        if (raw === 'dedicated') {
            return 'Dedicated Transport Space';
        }
        if (raw === 'shared') {
            return 'Shared Space';
        }
        return '';
    }

    function getWatchlistStorageKey(providerId) {
        return 'anytransport_provider_watchlist_' + String(providerId || 'guest').trim();
    }

    function getWatchedQuoteIds(providerId) {
        try {
            const parsed = JSON.parse(localStorage.getItem(getWatchlistStorageKey(providerId)) || '[]');
            return Array.isArray(parsed) ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
        } catch (_error) {
            return [];
        }
    }

    function saveWatchedQuoteIds(providerId, quoteIds) {
        const uniqueIds = Array.from(new Set((Array.isArray(quoteIds) ? quoteIds : []).map((entry) => String(entry || '').trim()).filter(Boolean)));
        localStorage.setItem(getWatchlistStorageKey(providerId), JSON.stringify(uniqueIds));
    }

    function renderWatchToggle(quote) {
        const button = document.getElementById('watch-toggle-btn');
        if (!button) return;

        const user = getActiveUser();
        const providerId = user && user.id ? String(user.id).trim() : '';
        const quoteId = String(getFormIdLabel(quote) || '').trim();
        if (!providerId || !quoteId) {
            button.textContent = 'Watch';
            button.disabled = true;
            return;
        }

        const syncLabel = () => {
            const watchedIds = getWatchedQuoteIds(providerId);
            const isWatched = watchedIds.includes(quoteId);
            button.textContent = isWatched ? 'Unwatch' : 'Watch';
            button.setAttribute('aria-pressed', isWatched ? 'true' : 'false');
        };

        syncLabel();

        button.onclick = function () {
            const watchedIds = getWatchedQuoteIds(providerId);
            const isWatched = watchedIds.includes(quoteId);

            if (isWatched) {
                saveWatchedQuoteIds(providerId, watchedIds.filter((entry) => entry !== quoteId));
            } else {
                watchedIds.push(quoteId);
                saveWatchedQuoteIds(providerId, watchedIds);
            }

            syncLabel();
        };
    }

    function renderMissingState(message) {
        const quick = document.getElementById('details-quick');
        const inventory = document.getElementById('details-inventory');
        const bids = document.getElementById('bid-history');
        const sections = document.getElementById('details-form-sections');

        if (quick) quick.innerHTML = '';
        if (inventory) inventory.innerHTML = '<div class="empty-inventory">' + escapeHtml(message) + '</div>';
        if (bids) bids.innerHTML = '<div class="empty-bids">No bids available.</div>';
        if (sections) sections.innerHTML = '<div class="form-section-card"><div class="form-field-value">' + escapeHtml(message) + '</div></div>';
    }

    function renderQuickInfo(quote) {
        const quick = document.getElementById('details-quick');
        if (!quick) return;

        const isProvider = isTransportProviderUser();
        const listingId = getFormIdLabel(quote);
        const collection = getPickupDisplayLabel(quote);
        const delivery = getDeliveryDisplayLabel(quote);
        const pickupLiftStatus = getPickupLiftStatus(quote);
        const deliveryLiftStatus = getDeliveryLiftStatus(quote);
        const pickupMovers = getPickupMoversValue(quote);
        const deliveryMovers = getDeliveryMoversValue(quote);
        const createdAt = quote.createdAt ? formatDateTime(quote.createdAt) : 'Not provided';
        const username = firstText(quote.customerUsername, quote.username, quote.customerName, 'Unknown');
        const distance = firstText(formatDistance(quote), 'Not provided');
        const duration = firstText(quote.routeDurationText, quote.routeDuration, quote.durationText, 'Not provided');
        const moveDate = getMoveDate(quote);
        const preferredTimeSummary = getPreferredTimeSummary(quote);
        const storageSummary = getStorageSummary(quote);
        const averageVolumeSummary = isProvider ? getAverageVolumeSummary(quote) : '';
        const transportSpaceSummary = getTransportSpaceDisplay(quote) || 'Not specified';
        const stats = [
            buildModernStat('Transport space', transportSpaceSummary, 'modern-stat-card--span-2 modern-stat-card--transport-space'),
            buildModernStat('Collection', collection, '', 'Lift: ' + pickupLiftStatus),
            buildModernStat('Delivery', delivery, '', 'Lift: ' + deliveryLiftStatus),
            buildModernStat('Distance', distance),
            buildModernStat('Time', duration),
            buildModernStat('Pickup date', moveDate),
            buildModernStat('Delivery date', moveDate),
            buildModernStat('Preferred time', preferredTimeSummary, 'modern-stat-card--span-2', '', 'M = Mandatory time, F = Flexible time'),
            buildModernStat('Pickup movers', pickupMovers),
            buildModernStat('Delivery movers', deliveryMovers),
            buildModernStat('Storage', storageSummary),
            buildModernStat('User', username)
        ];

        if (isProvider) {
            stats.push(buildModernStat('Estimated cubic metres', averageVolumeSummary, 'modern-stat-card--span-2 modern-stat-card--accent'));
        }

        quick.className = 'modern-overview';
        quick.innerHTML = [
            '<section class="modern-overview-main">',
            '<div class="modern-hero-row">',
            '<div class="modern-hero-content">',
            '<div class="modern-bid-count">',
            '<span>Current bids</span>',
            '<strong id="legacy-bid-count">0</strong>',
            '</div>',
            '<div class="modern-stat-grid modern-stat-grid-top">',
            stats.join(''),
            '</div>',
            '</div>',
            '<div class="modern-hero-map">',
            '<div class="modern-map-header">',
            '<span>Route preview</span>',
            '<span class="modern-map-meta">' + escapeHtml(distance + ' • ' + duration) + '</span>',
            '</div>',
            '<div id="details-map" class="modern-map"></div>',
            '<div class="modern-map-links">',
            '<button type="button" id="watch-toggle-btn" data-quote-id="' + escapeHtml(listingId) + '">Watch</button>',
            '</div>',
            '<button type="button" id="inventory-toggle-btn" class="inventory-open-btn" aria-expanded="false">View Inventory</button>',
            '<button type="button" id="media-toggle-btn" class="inventory-open-btn" aria-expanded="false" style="margin-top:10px;">Open Photos</button>',
            '<button type="button" id="services-toggle-btn" class="inventory-open-btn" aria-expanded="false" style="margin-top:10px;">Open Services</button>',
            '</div>',
            '</div>',
            '<section id="inventory-inline-panel" class="inventory-inline-panel" aria-hidden="true" hidden>',
            '<div class="inventory-inline-header">',
            '<h3>Inventory details</h3>',
            '</div>',
            '<div id="details-inventory" class="inventory-inline-content"></div>',
            '</section>',
            '<div id="services-modal" class="inventory-modal" aria-hidden="true">',
            '<div class="inventory-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="services-modal-title">',
            '<div id="services-drag-handle" class="inventory-modal-header" title="Drag to move">',
            '<h3 id="services-modal-title">Item Services</h3>',
            '<div class="inventory-window-actions">',
            '<button type="button" id="services-reset-btn" class="inventory-close-btn" aria-label="Reset services window position">Reset</button>',
            '<button type="button" id="services-close-btn" class="inventory-close-btn" aria-label="Close services">Close</button>',
            '</div>',
            '</div>',
            '<div id="details-services" class="inventory-modal-content"></div>',
            '<div class="inventory-resize-handle inventory-resize-nw" data-corner="nw" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-ne" data-corner="ne" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-sw" data-corner="sw" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-se" data-corner="se" aria-hidden="true"></div>',
            '</div>',
            '</div>',
            '<div id="media-modal" class="inventory-modal" aria-hidden="true">',
            '<div class="inventory-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="media-modal-title">',
            '<div id="media-drag-handle" class="inventory-modal-header" title="Drag to move">',
            '<h3 id="media-modal-title">Photos & Videos</h3>',
            '<div class="inventory-window-actions">',
            '<button type="button" id="media-reset-btn" class="inventory-close-btn" aria-label="Reset photos window position">Reset</button>',
            '<button type="button" id="media-close-btn" class="inventory-close-btn" aria-label="Close photos">Close</button>',
            '</div>',
            '</div>',
            '<div id="details-media" class="inventory-modal-content"></div>',
            '<div class="inventory-resize-handle inventory-resize-nw" data-corner="nw" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-ne" data-corner="ne" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-sw" data-corner="sw" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-se" data-corner="se" aria-hidden="true"></div>',
            '</div>',
            '</div>',
            '</section>'
        ].join('');
    }

    function buildModernStat(label, value, extraClass, subtext, hintText) {
        const className = ['modern-stat-card', extraClass].filter(Boolean).join(' ');
        const infoHtml = String(hintText || '').trim()
            ? '<span class="modern-stat-info" aria-label="' + escapeAttribute(hintText) + '" title="' + escapeAttribute(hintText) + '">i</span>'
            : '';
        const subtextHtml = String(subtext || '').trim()
            ? '<small class="modern-stat-subtext">' + escapeHtml(subtext) + '</small>'
            : '';
        return '<div class="' + className + '">' +
            '<span class="modern-stat-label">' + escapeHtml(label) + infoHtml + '</span>' +
            '<strong>' + escapeHtml(value) + '</strong>' +
            subtextHtml +
            '</div>';
    }

    function getPickupLiftStatus(quote) {
        return normalizeLiftValue(firstText(
            quote.pickupLiftAvailable,
            quote.pickupLift,
            quote.pickupLiftStatus,
            quote.servicePickupLift,
            quote['service-pickup-lift'],
            quote['pickup-lift-available'],
            quote['pickup-lift'],
            quote.formData && quote.formData['pickup-lift-available'],
            quote.stepData && quote.stepData['pickup-lift-available']
        ));
    }

    function getDeliveryLiftStatus(quote) {
        return normalizeLiftValue(firstText(
            quote.deliveryLiftAvailable,
            quote.deliveryLift,
            quote.deliveryLiftStatus,
            quote.serviceDeliveryLift,
            quote['service-delivery-lift'],
            quote['delivery-lift-available'],
            quote['delivery-lift'],
            quote.formData && quote.formData['delivery-lift-available'],
            quote.stepData && quote.stepData['delivery-lift-available']
        ));
    }

    function normalizeLiftValue(value) {
        const normalized = String(value || '').trim().toLowerCase();
        if (!normalized) return 'Not provided';
        if (normalized === 'yes' || normalized === 'y' || normalized === 'true' || normalized === 'available') {
            return 'Available';
        }
        if (normalized === 'no' || normalized === 'n' || normalized === 'false' || normalized === 'not available') {
            return 'Not available';
        }
        return String(value || '').trim();
    }

    function getAverageVolumeSummary(quote) {
        const summary = calculateAverageItemVolume(quote);
        if (!summary) return 'Not provided';
        return summary.totalVolume.toFixed(2) + ' m³ total (' + summary.averageVolume.toFixed(2) + ' m³/item avg)';
    }

    function calculateAverageItemVolume(quote) {
        const entries = collectVolumeItems(quote);
        if (!entries.length) return null;

        let totalVolume = 0;
        let totalQuantity = 0;

        entries.forEach(function (entry) {
            const quantity = Math.max(1, parseInt(String(entry.quantity || 1), 10) || 1);
            let volume = Number(entry.estimatedVolume) || 0;

            if (!(volume > 0)) {
                const width = parseDimensionValue(entry.width);
                const depth = parseDimensionValue(entry.depth);
                const height = parseDimensionValue(entry.height);
                if (!(width > 0 && depth > 0 && height > 0)) return;

                const unitMultiplier = getSizeUnitMultiplier(entry.sizeUnit);
                volume = width * depth * height * Math.pow(unitMultiplier, 3);
            }

            totalVolume += volume * quantity;
            totalQuantity += quantity;
        });

        if (!totalQuantity || totalVolume <= 0) return null;

        return {
            averageVolume: totalVolume / totalQuantity,
            totalVolume: totalVolume,
            totalQuantity: totalQuantity
        };
    }

    function collectVolumeItems(quote) {
        const entries = [];
        const sources = [
            quote && quote.customizedDraftItems,
            quote && quote.customizedItems,
            quote && quote.customizedItemsHidden,
            quote && quote.items,
            quote && quote.quoteData,
            quote && quote.stepData,
            quote && quote.formData
        ];

        sources.forEach(function (source) {
            collectVolumeItemsFromSource(source, entries, 0);
        });

        if (!entries.length) {
            collectHouseRemovalVolumeItems(quote, entries);
        }

        return entries;
    }

    function collectHouseRemovalVolumeItems(quote, entries) {
        const sources = [
            quote && quote.houseInventory,
            quote && quote.house_removal_inventory,
            quote && quote.houseRemovalInventory
        ];

        if (Array.isArray(quote && quote.floorBlocks)) {
            quote.floorBlocks.forEach(function (block) {
                if (block && block.houseInventory) {
                    sources.push(block.houseInventory);
                }
            });
        }

        sources.forEach(function (source) {
            if (!source || typeof source !== 'object') return;

            const flatQty = firstNonEmptyObject(source.items, source.itemQuantities);
            if (flatQty) {
                Object.keys(flatQty).forEach(function (itemName) {
                    const quantity = Math.max(0, parseInt(flatQty[itemName], 10) || 0);
                    if (quantity <= 0) return;
                    entries.push({
                        name: itemName,
                        quantity: quantity,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(itemName)
                    });
                });
            }

            if (source.subRoomQuantities && typeof source.subRoomQuantities === 'object') {
                Object.keys(source.subRoomQuantities).forEach(function (roomName) {
                    const roomMap = source.subRoomQuantities[roomName];
                    if (!roomMap || typeof roomMap !== 'object') return;
                    Object.keys(roomMap).forEach(function (itemName) {
                        const quantity = Math.max(0, parseInt(roomMap[itemName], 10) || 0);
                        if (quantity <= 0) return;
                        entries.push({
                            name: itemName,
                            quantity: quantity,
                            estimatedVolume: getHouseRemovalItemVolumeEstimate(itemName, roomName)
                        });
                    });
                });
            }

            if (typeof source.customItems === 'string') {
                source.customItems.split(/[;,\n]+/).forEach(function (part) {
                    const label = String(part || '').trim();
                    if (!label) return;
                    entries.push({
                        name: label,
                        quantity: 1,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(label)
                    });
                });
            }

            if (Array.isArray(source.customItems)) {
                source.customItems.forEach(function (itemName) {
                    const label = String(itemName || '').trim();
                    if (!label) return;
                    entries.push({
                        name: label,
                        quantity: 1,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(label)
                    });
                });
            }

            if (typeof source.extraItems === 'string') {
                source.extraItems.split(/[;,\n]+/).forEach(function (part) {
                    const label = String(part || '').trim();
                    if (!label) return;
                    entries.push({
                        name: label,
                        quantity: 1,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(label)
                    });
                });
            }
        });

        if (entries.length) return;

        const directSources = [
            quote,
            quote && quote.houseInventory,
            quote && quote.house_removal_inventory,
            quote && quote.houseRemovalInventory
        ];

        directSources.forEach(function (source) {
            if (!source || typeof source !== 'object') return;

            if (source.itemQuantities && typeof source.itemQuantities === 'object') {
                Object.keys(source.itemQuantities).forEach(function (itemName) {
                    const quantity = Math.max(0, parseInt(source.itemQuantities[itemName], 10) || 0);
                    if (quantity <= 0) return;
                    entries.push({
                        name: itemName,
                        quantity: quantity,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(itemName)
                    });
                });
            }

            if (source.multiFloorInventory && typeof source.multiFloorInventory === 'object') {
                Object.keys(source.multiFloorInventory).forEach(function (floorName) {
                    const floorItems = source.multiFloorInventory[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        const quantity = Math.max(0, parseInt(floorItems[itemName], 10) || 0);
                        if (quantity <= 0) return;
                        entries.push({
                            name: itemName,
                            quantity: quantity,
                            estimatedVolume: getHouseRemovalItemVolumeEstimate(itemName, floorName)
                        });
                    });
                });
            }

            if (typeof source.customItems === 'string') {
                source.customItems.split(/[;,\n]+/).forEach(function (part) {
                    const label = String(part || '').trim();
                    if (!label) return;
                    entries.push({
                        name: label,
                        quantity: 1,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(label)
                    });
                });
            }

            if (typeof source.extraItems === 'string') {
                source.extraItems.split(/[;,\n]+/).forEach(function (part) {
                    const label = String(part || '').trim();
                    if (!label) return;
                    entries.push({
                        name: label,
                        quantity: 1,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(label)
                    });
                });
            }

            if (Array.isArray(source.items)) {
                source.items.forEach(function (item) {
                    const label = String(item && (item.name || item.label || item.description) || '').trim();
                    const quantity = Math.max(0, parseInt(item && item.quantity, 10) || 0);
                    if (!label || quantity <= 0) return;
                    entries.push({
                        name: label,
                        quantity: quantity,
                        estimatedVolume: getHouseRemovalItemVolumeEstimate(label)
                    });
                });
            }
        });
    }

    function collectVolumeItemsFromSource(source, entries, depth) {
        if (!source || depth > 3) return;

        if (typeof source === 'string') {
            try {
                const parsed = JSON.parse(source);
                if (Array.isArray(parsed)) {
                    parsed.forEach(function (item) {
                        collectVolumeItemsFromSource(item, entries, depth + 1);
                    });
                }
            } catch (_error) {
                // Ignore malformed JSON payloads.
            }
            return;
        }

        if (Array.isArray(source)) {
            source.forEach(function (item) {
                collectVolumeItemsFromSource(item, entries, depth + 1);
            });
            return;
        }

        if (typeof source !== 'object') return;

        if (hasVolumeDimensions(source)) {
            entries.push(source);
            return;
        }

        ['customizedDraftItems', 'customizedItems', 'items', 'rows', 'data', 'quoteData', 'stepData', 'formData'].forEach(function (key) {
            if (source[key] !== undefined && source[key] !== null) {
                collectVolumeItemsFromSource(source[key], entries, depth + 1);
            }
        });
    }

    function hasVolumeDimensions(item) {
        if (!item || typeof item !== 'object') return false;
        return hasRenderableValue(item.width) && hasRenderableValue(item.depth) && hasRenderableValue(item.height);
    }

    function parseDimensionValue(value) {
        const normalized = String(value || '').trim().replace(',', '.');
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function getHouseRemovalItemVolumeEstimate(itemName, roomName) {
        const normalized = String(itemName || '').trim().toLowerCase();
        if (!normalized) return 0;

        if (/^small\s+boxes?$/.test(normalized)) return 0.08;
        if (/^medium\s+boxes?$/.test(normalized)) return 0.12;
        if (/^large\s+boxes?$/.test(normalized)) return 0.18;
        if (/^xl\s+boxes?$/.test(normalized) || /wardrobe\s+boxes?$/.test(normalized)) return 0.24;

        if (normalized.includes('2 seater sofa') || normalized.includes('two seater sofa')) return 1.8;
        if (normalized.includes('3 seater sofa')) return 2.3;
        if (normalized.includes('armchair')) return 0.6;
        if (normalized.includes('coffee table')) return 0.35;
        if (normalized.includes('dining table')) return 1.2;
        if (normalized.includes('dining chair')) return 0.15;
        if (normalized.includes('side table')) return 0.18;
        if (normalized.includes('book case') || normalized.includes('bookcase')) return 0.9;
        if (normalized.includes('wardrobe')) return 1.6;
        if (normalized.includes('chest of drawers') || normalized.includes('dresser')) return 1.1;
        if (normalized.includes('display unit') || normalized.includes('side board')) return 0.9;
        if (normalized.includes('desk')) return 1.0;
        if (normalized.includes('chair')) return 0.18;
        if (normalized.includes('pedestal')) return 0.2;
        if (normalized.includes('filing cabinet')) return 0.45;
        if (normalized.includes('desktop computer')) return 0.12;
        if (normalized.includes('photocopier')) return 0.95;
        if (normalized.includes('printer')) return 0.15;
        if (normalized.includes('board room table')) return 1.8;
        if (normalized.includes('crates')) return 0.35;
        if (normalized.includes('fridge freezer')) return 1.6;
        if (normalized.includes('fridge')) return 1.2;
        if (normalized.includes('tumble dryer')) return 0.6;
        if (normalized.includes('washing machine')) return 0.6;
        if (normalized.includes('oven')) return 0.7;
        if (normalized.includes('microwave')) return 0.08;
        if (normalized.includes('shelving unit')) return 0.8;
        if (normalized.includes('bin')) return 0.12;
        if (normalized.includes('vacuum cleaner')) return 0.12;
        if (normalized.includes('kingsize bed') || normalized.includes('king size bed')) return 2.0;
        if (normalized.includes('double bed')) return 1.6;
        if (normalized.includes('single bed')) return 1.2;
        if (normalized.includes('bedside tables')) return 0.18;
        if (normalized.includes('mirror')) return 0.12;
        if (normalized.includes('artwork')) return 0.1;
        if (normalized.includes('lamp')) return 0.05;
        if (normalized.includes('bath')) return 2.2;
        if (normalized.includes('sink')) return 0.55;
        if (normalized.includes('rug')) return 0.2;
        if (normalized.includes('bicycle') || normalized.includes('bike')) return 0.45;
        if (normalized.includes('suitcase')) return 0.14;
        if (normalized.includes('tool chest')) return 0.7;
        if (normalized.includes('workbench')) return 1.2;
        if (normalized.includes('lawn mower')) return 0.6;
        if (normalized.includes('barbecue')) return 0.7;
        if (normalized.includes('garden table')) return 0.9;
        if (normalized.includes('parasol')) return 0.25;
        if (normalized.includes('laundry basket')) return 0.15;
        if (normalized.includes('storage boxes')) return 0.3;
        if (normalized.includes('fish tank') || normalized.includes('aquarium')) return 0.25;
        if (normalized.includes('umbrella stand')) return 0.1;
        if (normalized.includes('storage bench')) return 0.45;

        const roomNormalized = String(roomName || '').trim().toLowerCase();
        if (roomNormalized === 'kitchen') return 0.35;
        if (roomNormalized === 'bathrooms') return 0.25;
        if (roomNormalized === 'living') return 0.6;
        if (roomNormalized === 'dining') return 0.7;
        if (roomNormalized === 'bedrooms') return 0.8;
        if (roomNormalized === 'hallway') return 0.2;
        if (roomNormalized === 'garden') return 0.5;
        if (roomNormalized === 'utility') return 0.4;
        if (roomNormalized === 'shed') return 0.4;
        if (roomNormalized === 'office') return 0.55;

        return 0.35;
    }

    function formatItemVolumeSummary(itemName, quantity) {
        const qty = Math.max(1, parseInt(String(quantity || 1), 10) || 1);
        const itemVolume = Number(getHouseRemovalItemVolumeEstimate(itemName));

        if (!(itemVolume > 0)) {
            return 'm³ not available';
        }

        const totalVolume = itemVolume * qty;
        if (qty > 1) {
            return totalVolume.toFixed(2) + ' m³ total (' + itemVolume.toFixed(2) + ' m³ each)';
        }

        return itemVolume.toFixed(2) + ' m³';
    }

    function getSizeUnitMultiplier(unit) {
        const normalized = String(unit || 'cm').trim().toLowerCase();
        if (normalized === 'm' || normalized === 'meter' || normalized === 'metre' || normalized === 'meters' || normalized === 'metres') return 1;
        if (normalized === 'mm') return 0.001;
        if (normalized === 'ft' || normalized === 'feet' || normalized === 'foot') return 0.3048;
        if (normalized === 'in' || normalized === 'inch' || normalized === 'inches') return 0.0254;
        return 0.01;
    }

    function createRouteMarkerElement(label, variant) {
        const element = document.createElement('div');
        element.className = 'route-marker route-marker--' + String(variant || '').trim();
        element.textContent = String(label || '').trim();
        return element;
    }

    async function renderMap(quote) {
        const mapEl = document.getElementById('details-map');
        if (!mapEl) return;

        if (!window.mapboxgl) {
            mapEl.innerHTML = '<div class="empty-inventory">Map unavailable.</div>';
            return;
        }

        if (!String(mapboxgl.accessToken || '').trim()) {
            mapboxgl.accessToken = ANYTRANSPORT_MAPBOX_TOKEN;
        }

        const pickupAddress = getPickupLabel(quote);
        const deliveryAddress = getDeliveryLabel(quote);

        let pickupCoord = resolveQuoteCoordinates(quote, 'pickup');
        let deliveryCoord = resolveQuoteCoordinates(quote, 'delivery');
        if (!pickupCoord) {
            pickupCoord = await geocodeAddress(pickupAddress);
        }
        if (!deliveryCoord) {
            deliveryCoord = await geocodeAddress(deliveryAddress);
        }

        const fallbackCenter = [-8.24389, 53.41291];
        const center = pickupCoord || deliveryCoord || fallbackCenter;

        const map = new mapboxgl.Map({
            container: 'details-map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: center,
            zoom: 6,
            scrollZoom: false
        });

        map.on('load', async function () {
            const bounds = new mapboxgl.LngLatBounds();

            if (pickupCoord) {
                new mapboxgl.Marker({ element: createRouteMarkerElement('A', 'pickup') })
                    .setLngLat(pickupCoord)
                    .setPopup(new mapboxgl.Popup({ offset: 22 }).setText('Pickup: ' + pickupAddress))
                    .addTo(map);
                bounds.extend(pickupCoord);
            }

            if (deliveryCoord) {
                new mapboxgl.Marker({ element: createRouteMarkerElement('B', 'delivery') })
                    .setLngLat(deliveryCoord)
                    .setPopup(new mapboxgl.Popup({ offset: 22 }).setText('Delivery: ' + deliveryAddress))
                    .addTo(map);
                bounds.extend(deliveryCoord);
            }

            if (pickupCoord && deliveryCoord) {
                let routeGeometry = parseStoredRouteGeometry(quote);
                if (!routeGeometry) {
                    routeGeometry = await fetchRouteGeometry(pickupCoord, deliveryCoord);
                }
                if (routeGeometry) {
                    drawRouteGeometry(map, routeGeometry);
                } else {
                    await drawRouteLine(map, pickupCoord, deliveryCoord);
                }
            }

            if (pickupCoord && deliveryCoord) {
                map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
            } else if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 60, maxZoom: 11 });
            }
        });
    }

    async function geocodeAddress(addressText) {
        const queries = buildGeocodeQueryVariants(addressText);
        if (!queries.length || !window.mapboxgl || !mapboxgl.accessToken) return null;

        for (let i = 0; i < queries.length; i += 1) {
            const result = await geocodeAddressQuery(queries[i]);
            if (result) return result;
        }
        return null;
    }

    function buildGeocodeQueryVariants(addressText) {
        const base = String(addressText || '').trim();
        if (!base || base.toLowerCase() === 'not provided') return [];
        const variants = [base];
        if (!/ireland|éire|\bie\b/i.test(base)) {
            variants.push(base + ', Ireland');
        }
        return variants;
    }

    async function geocodeAddressQuery(query) {
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
            encodeURIComponent(query) +
            '.json?access_token=' + encodeURIComponent(mapboxgl.accessToken) +
            '&limit=1&country=ie,gb&types=postcode,address,place,locality';

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const feature = Array.isArray(data && data.features) ? data.features[0] : null;
            const center = feature && Array.isArray(feature.center) ? feature.center : null;
            if (!center || center.length < 2) return null;
            return [Number(center[0]), Number(center[1])];
        } catch (_error) {
            return null;
        }
    }

    async function fetchRouteGeometry(fromCoord, toCoord) {
        const route = await fetchRouteDetails(fromCoord, toCoord);
        return route && route.geometry ? route.geometry : null;
    }

    async function drawRouteLine(map, fromCoord, toCoord) {
        if (!Array.isArray(fromCoord) || !Array.isArray(toCoord)) return;

        const coords = fromCoord[0] + ',' + fromCoord[1] + ';' + toCoord[0] + ',' + toCoord[1];
        const url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
            coords +
            '?access_token=' + encodeURIComponent(mapboxgl.accessToken) +
            '&geometries=geojson&overview=full';

        try {
            const response = await fetch(url);
            if (!response.ok) return;
            const data = await response.json();
            const route = Array.isArray(data && data.routes) ? data.routes[0] : null;
            if (!route || !route.geometry) return;
            drawRouteGeometry(map, route.geometry);
        } catch (_error) {
            // Route line is optional if directions API fails.
        }
    }

    function normalizeListingServiceType(quote) {
        return String(firstText(
            quote.itemType,
            quote.serviceType,
            quote.service,
            quote.selectedService,
            quote.itemDescription,
            ''
        ) || '').trim();
    }

    function isVehicleTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        if (!serviceType) return false;
        if (serviceType.includes('vehicle parts')) return false;
        return serviceType.includes('car/campervan')
            || serviceType.includes('car transport')
            || serviceType.includes('motorbike')
            || serviceType.includes('caravan')
            || serviceType.includes('trailer transport')
            || serviceType.includes('trailers & campervans')
            || serviceType === 'boats'
            || serviceType.includes('boat transport');
    }

    function isPianoTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return serviceType.includes('piano');
    }

    function isFreightTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return serviceType === 'freight' || serviceType.includes('freight');
    }

    function isIndustrialTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return serviceType === 'industrial' || serviceType.includes('industrial');
    }

    const INDUSTRIAL_WEIGHT_LABELS = {
        '1kg-500kg': '1kg - 500kg',
        '501kg-1000kg': '501kg - 1000kg',
        '1001kg-1500kg': '1001kg - 1500kg',
        '1501kg-2000kg': '1501kg-2000kg',
        '2001kg+': '2001kg+'
    };

    function formatIndustrialWeightLabel(weightValue) {
        const normalized = String(weightValue || '').trim();
        if (!normalized) return '';
        return INDUSTRIAL_WEIGHT_LABELS[normalized] || normalized;
    }

    function parseIndustrialFromQuote(quote) {
        let details = null;

        const rawJson = firstText(quote.industrialJson, quote.industrial_json, '');
        if (rawJson) {
            try {
                const parsed = JSON.parse(rawJson);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    details = parsed;
                }
            } catch (_error) {
                // Fall through to other payload shapes.
            }
        }

        if (!details && quote.industrialDetails) {
            if (typeof quote.industrialDetails === 'string') {
                const raw = quote.industrialDetails.trim();
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            details = parsed;
                        }
                    } catch (_error) {
                        details = { description: raw };
                    }
                }
            } else if (typeof quote.industrialDetails === 'object') {
                details = quote.industrialDetails;
            }
        }

        if (!details) {
            const description = firstText(
                quote.whatBeingTransported,
                quote.what_being_transported,
                quote['what-being-transported'],
                getQuoteFieldValue(quote, 'what-being-transported')
            );
            const weight = firstText(
                quote.industrialWeight,
                quote.industrial_weight,
                quote['industrial-weight-hidden'],
                getQuoteFieldValue(quote, 'industrial-weight-hidden')
            );
            if (description || weight) {
                details = {
                    description: description,
                    weight: weight,
                    weightLabel: formatIndustrialWeightLabel(weight)
                };
            }
        }

        if (!details) return null;

        if (!Array.isArray(details.media)) {
            const rawMedia = firstText(
                quote['industrial-media-hidden'],
                quote.industrialMediaHidden,
                getQuoteFieldValue(quote, 'industrial-media-hidden')
            );
            if (rawMedia) {
                try {
                    const parsedMedia = JSON.parse(rawMedia);
                    if (Array.isArray(parsedMedia)) {
                        details.media = parsedMedia;
                    }
                } catch (_error) {
                    details.media = [];
                }
            } else {
                details.media = [];
            }
        }

        details.description = String(details.description || '').trim();
        details.weight = String(details.weight || '').trim();
        details.weightLabel = String(details.weightLabel || '').trim() || formatIndustrialWeightLabel(details.weight);

        return details;
    }

    function buildIndustrialDetailRows(details) {
        const rows = [];
        const addRow = function (label, value) {
            const text = String(value || '').trim();
            if (!text) return;
            rows.push('<li><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(text) + '</li>');
        };

        addRow('Description', details && details.description);
        addRow('Weight range', details && (details.weightLabel || formatIndustrialWeightLabel(details.weight)));

        const mediaItems = Array.isArray(details && details.media) ? details.media : [];
        if (mediaItems.length) {
            const imageCount = mediaItems.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('image/');
            }).length;
            const videoCount = mediaItems.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('video/');
            }).length;
            const parts = [];
            if (imageCount > 0) parts.push(imageCount + ' photo' + (imageCount === 1 ? '' : 's'));
            if (videoCount > 0) parts.push(videoCount + ' video' + (videoCount === 1 ? '' : 's'));
            if (!parts.length) parts.push(mediaItems.length + ' file' + (mediaItems.length === 1 ? '' : 's'));
            addRow('Photos / videos', parts.join(', '));
        }

        return rows;
    }

    function collectIndustrialServiceInventory(quote) {
        const details = parseIndustrialFromQuote(quote);
        if (!details || (!details.description && !details.weight && !(details.media || []).length)) {
            return null;
        }

        let selectedPickupFloors = [];
        const rawPickupFloors = quote.selectedPickupFloors || quote.pickupFloors || quote.pickup_floors;
        if (Array.isArray(rawPickupFloors)) {
            selectedPickupFloors = rawPickupFloors;
        } else if (typeof rawPickupFloors === 'string' && rawPickupFloors.trim()) {
            try {
                const parsedFloors = JSON.parse(rawPickupFloors);
                if (Array.isArray(parsedFloors)) {
                    selectedPickupFloors = parsedFloors;
                }
            } catch (_error) {
                selectedPickupFloors = rawPickupFloors.split(',').map(function (entry) {
                    return String(entry || '').trim();
                }).filter(Boolean);
            }
        }

        selectedPickupFloors = selectedPickupFloors
            .map(function (floor) { return normalizeInventoryFloorKey(floor); })
            .filter(Boolean);

        const pickupFloor = selectedPickupFloors[0]
            || normalizeInventoryFloorKey(firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground'));

        const labelParts = [];
        if (details.description) {
            const shortDescription = details.description.length > 120
                ? details.description.slice(0, 117) + '...'
                : details.description;
            labelParts.push(shortDescription);
        }
        if (details.weightLabel) {
            labelParts.push('Weight: ' + details.weightLabel);
        }
        const label = 'Industrial item 1' + (labelParts.length ? ': ' + labelParts.join(' · ') : '');

        const pickupMap = {};
        pickupMap[pickupFloor] = {};
        pickupMap[pickupFloor][label] = 1;

        return {
            pickup: pickupMap,
            delivery: {}
        };
    }

    function renderIndustrialInventoryMarkup(quote) {
        const details = parseIndustrialFromQuote(quote);
        if (!details || (!details.description && !details.weight && !(details.media || []).length)) {
            return '<div class="empty-inventory">No industrial transport details were saved for this listing.</div>';
        }

        const rows = buildIndustrialDetailRows(details);
        const rowHtml = rows.length
            ? '<ul class="inventory-overview-floor-items vehicle-detail-list">' + rows.join('') + '</ul>'
            : '<div class="empty-inventory">No details recorded for this industrial item.</div>';

        const card = '<div class="inventory-overview-floor-block vehicle-detail-card">' +
            '<div class="inventory-overview-floor-title">Industrial item 1</div>' +
            rowHtml +
        '</div>';

        return '<div class="inventory-overview-grid inventory-overview-grid-vehicle">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Industrial Transport</h4>' +
                '<div class="vehicle-detail-grid">' + card + '</div>' +
            '</section>' +
        '</div>';
    }

    function isManPowerTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return serviceType.includes('man power') || serviceType.includes('manpower');
    }

    function parseManpowerFromQuote(quote) {
        let details = null;

        const rawJson = firstText(quote.manpowerJson, quote.manpower_json, '');
        if (rawJson) {
            try {
                const parsed = JSON.parse(rawJson);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                    details = parsed;
                }
            } catch (_error) {
                // Fall through to other payload shapes.
            }
        }

        if (!details && quote.manpowerDetails) {
            if (typeof quote.manpowerDetails === 'string') {
                const raw = quote.manpowerDetails.trim();
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            details = parsed;
                        }
                    } catch (_error) {
                        details = { description: raw };
                    }
                }
            } else if (typeof quote.manpowerDetails === 'object') {
                details = quote.manpowerDetails;
            }
        }

        if (!details) {
            const description = firstText(
                quote.manpowerJobDescription,
                quote['manpower-job-description'],
                getQuoteFieldValue(quote, 'manpower-job-description'),
                isManPowerTransportListing(quote) ? quote.itemDescription : '',
                isManPowerTransportListing(quote) ? quote.itemsSummary : ''
            );
            if (description) {
                details = { description: description };
            }
        }

        if (!details) return null;

        if (!Array.isArray(details.media)) {
            const rawMedia = firstText(
                quote['manpower-media-hidden'],
                quote.manpowerMediaHidden,
                getQuoteFieldValue(quote, 'manpower-media-hidden')
            );
            if (rawMedia) {
                try {
                    const parsedMedia = JSON.parse(rawMedia);
                    if (Array.isArray(parsedMedia)) {
                        details.media = parsedMedia;
                    }
                } catch (_error) {
                    details.media = [];
                }
            } else {
                details.media = [];
            }
        }

        details.description = String(details.description || '').trim();
        return details;
    }

    function buildManpowerDetailRows(details) {
        const rows = [];
        const addRow = function (label, value) {
            const text = String(value || '').trim();
            if (!text) return;
            rows.push('<li><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(text) + '</li>');
        };

        addRow('Description', details && details.description);

        const mediaItems = Array.isArray(details && details.media) ? details.media : [];
        if (mediaItems.length) {
            const imageCount = mediaItems.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('image/');
            }).length;
            const videoCount = mediaItems.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('video/');
            }).length;
            const parts = [];
            if (imageCount > 0) parts.push(imageCount + ' photo' + (imageCount === 1 ? '' : 's'));
            if (videoCount > 0) parts.push(videoCount + ' video' + (videoCount === 1 ? '' : 's'));
            if (!parts.length) parts.push(mediaItems.length + ' file' + (mediaItems.length === 1 ? '' : 's'));
            addRow('Photos / videos', parts.join(', '));
        }

        return rows;
    }

    function collectManpowerServiceInventory(quote) {
        const details = parseManpowerFromQuote(quote);
        if (!details || (!details.description && !(details.media || []).length)) {
            return null;
        }

        let selectedPickupFloors = [];
        const rawPickupFloors = quote.selectedPickupFloors || quote.pickupFloors || quote.pickup_floors;
        if (Array.isArray(rawPickupFloors)) {
            selectedPickupFloors = rawPickupFloors;
        } else if (typeof rawPickupFloors === 'string' && rawPickupFloors.trim()) {
            try {
                const parsedFloors = JSON.parse(rawPickupFloors);
                if (Array.isArray(parsedFloors)) {
                    selectedPickupFloors = parsedFloors;
                }
            } catch (_error) {
                selectedPickupFloors = rawPickupFloors.split(',').map(function (entry) {
                    return String(entry || '').trim();
                }).filter(Boolean);
            }
        }

        selectedPickupFloors = selectedPickupFloors
            .map(function (floor) { return normalizeInventoryFloorKey(floor); })
            .filter(Boolean);

        const pickupFloor = selectedPickupFloors[0]
            || normalizeInventoryFloorKey(firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground'));

        const labelParts = [];
        if (details.description) {
            const shortDescription = details.description.length > 120
                ? details.description.slice(0, 117) + '...'
                : details.description;
            labelParts.push(shortDescription);
        }
        const label = 'Job 1' + (labelParts.length ? ': ' + labelParts.join(' · ') : '');

        const pickupMap = {};
        pickupMap[pickupFloor] = {};
        pickupMap[pickupFloor][label] = 1;

        return {
            pickup: pickupMap,
            delivery: {}
        };
    }

    function renderManpowerInventoryMarkup(quote) {
        const details = parseManpowerFromQuote(quote);
        if (!details || (!details.description && !(details.media || []).length)) {
            return '<div class="empty-inventory">No man power job details were saved for this listing.</div>';
        }

        const rows = buildManpowerDetailRows(details);
        const rowHtml = rows.length
            ? '<ul class="inventory-overview-floor-items vehicle-detail-list">' + rows.join('') + '</ul>'
            : '<div class="empty-inventory">No details recorded for this job.</div>';

        const card = '<div class="inventory-overview-floor-block vehicle-detail-card">' +
            '<div class="inventory-overview-floor-title">Job 1</div>' +
            rowHtml +
        '</div>';

        return '<div class="inventory-overview-grid inventory-overview-grid-vehicle">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Man Power</h4>' +
                '<div class="vehicle-detail-grid">' + card + '</div>' +
            '</section>' +
        '</div>';
    }

    function isPetsTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return serviceType.includes('pet');
    }

    function parsePetsFromQuote(quote) {
        let pets = [];

        const pushParsedArray = function (value) {
            if (!Array.isArray(value)) return;
            value.forEach(function (entry) {
                if (entry && typeof entry === 'object') {
                    pets.push(entry);
                }
            });
        };

        const petDetails = quote.petDetails || quote.pet_details;
        if (petDetails) {
            if (typeof petDetails === 'string') {
                const raw = petDetails.trim();
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) {
                            pushParsedArray(parsed);
                        } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pets)) {
                            pushParsedArray(parsed.pets);
                        }
                    } catch (_error) {
                        // Ignore malformed JSON.
                    }
                }
            } else if (Array.isArray(petDetails)) {
                pushParsedArray(petDetails);
            } else if (typeof petDetails === 'object' && Array.isArray(petDetails.pets)) {
                pushParsedArray(petDetails.pets);
            }
        }

        if (!pets.length) {
            const rawJson = firstText(quote.petsJson, quote.pets_json, '');
            if (rawJson) {
                try {
                    const parsed = JSON.parse(rawJson);
                    if (Array.isArray(parsed)) {
                        pushParsedArray(parsed);
                    } else if (parsed && typeof parsed === 'object' && Array.isArray(parsed.pets)) {
                        pushParsedArray(parsed.pets);
                    }
                } catch (_error) {
                    // Ignore malformed JSON.
                }
            }
        }

        if (!pets.length && Array.isArray(quote.pets)) {
            pushParsedArray(quote.pets);
        }

        return pets;
    }

    function getPetDisplayTitle(pet, index) {
        const typeLabel = firstText(pet && pet.typeLabel, pet && pet.animalType, pet && pet.type, pet && pet.typeValue);
        const otherName = firstText(pet && pet.otherName, pet && pet.name);
        let title = typeLabel || ('Pet ' + (Number(index) + 1 || 1));
        if (otherName) {
            title += ': ' + otherName;
        }
        return title;
    }

    function buildPetDetailRows(pet) {
        const rows = [];
        const addRow = function (label, value) {
            const text = String(value || '').trim();
            if (!text) return;
            rows.push('<li><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(text) + '</li>');
        };

        const typeLabel = firstText(pet && pet.typeLabel, pet && pet.animalType, pet && pet.type, pet && pet.typeValue);
        addRow('Animal type', typeLabel);

        const otherName = firstText(pet && pet.otherName, pet && pet.name);
        if (otherName) {
            addRow('Name / description', otherName);
        }

        const tankLength = String(pet && pet.tankLength || '').trim();
        const tankWidth = String(pet && pet.tankWidth || '').trim();
        const tankHeight = String(pet && pet.tankHeight || '').trim();
        if (tankLength || tankWidth || tankHeight) {
            const unit = firstText(pet && pet.tankUnit, 'cm');
            const sizeParts = [tankLength, tankWidth, tankHeight].filter(Boolean);
            addRow('Tank / carrier size', sizeParts.join(' × ') + ' ' + unit);
        }

        const weightText = firstText(
            pet && pet.weightLabel,
            pet && pet.weightCustom,
            pet && pet.weightValue,
            pet && pet.weight
        );
        addRow('Weight', weightText);

        const ownerLift = firstText(pet && pet.ownerLiftLabel, pet && pet.ownerLiftValue, pet && pet.ownerLift);
        addRow('Owner can help with lift', ownerLift);

        const mediaItems = Array.isArray(pet && pet.media) ? pet.media : [];
        if (mediaItems.length) {
            const imageCount = mediaItems.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('image/');
            }).length;
            const videoCount = mediaItems.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('video/');
            }).length;
            const parts = [];
            if (imageCount > 0) parts.push(imageCount + ' photo' + (imageCount === 1 ? '' : 's'));
            if (videoCount > 0) parts.push(videoCount + ' video' + (videoCount === 1 ? '' : 's'));
            if (!parts.length) parts.push(mediaItems.length + ' file' + (mediaItems.length === 1 ? '' : 's'));
            addRow('Photos / videos', parts.join(', '));
        }

        return rows;
    }

    function collectPetsServiceInventory(quote) {
        const pets = parsePetsFromQuote(quote);
        if (!pets.length) return null;

        let selectedPickupFloors = [];
        const rawPickupFloors = quote.selectedPickupFloors || quote.pickupFloors || quote.pickup_floors;
        if (Array.isArray(rawPickupFloors)) {
            selectedPickupFloors = rawPickupFloors;
        } else if (typeof rawPickupFloors === 'string' && rawPickupFloors.trim()) {
            try {
                const parsedFloors = JSON.parse(rawPickupFloors);
                if (Array.isArray(parsedFloors)) {
                    selectedPickupFloors = parsedFloors;
                }
            } catch (_error) {
                selectedPickupFloors = rawPickupFloors.split(',').map(function (entry) {
                    return String(entry || '').trim();
                }).filter(Boolean);
            }
        }

        selectedPickupFloors = selectedPickupFloors
            .map(function (floor) { return normalizeInventoryFloorKey(floor); })
            .filter(Boolean);

        const pickupFloor = selectedPickupFloors[0]
            || normalizeInventoryFloorKey(firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground'));

        const pickupMap = {};
        pickupMap[pickupFloor] = {};
        pets.forEach(function (pet, index) {
            pickupMap[pickupFloor][getPetDisplayTitle(pet, index)] = 1;
        });

        return {
            pickup: pickupMap,
            delivery: {}
        };
    }

    function renderPetsInventoryMarkup(quote) {
        const pets = parsePetsFromQuote(quote);
        if (!pets.length) {
            return '<div class="empty-inventory">No pet transport details were saved for this listing.</div>';
        }

        const cards = pets.map(function (pet, index) {
            const title = getPetDisplayTitle(pet, index);
            const rows = buildPetDetailRows(pet);
            const rowHtml = rows.length
                ? '<ul class="inventory-overview-floor-items vehicle-detail-list">' + rows.join('') + '</ul>'
                : '<div class="empty-inventory">No details recorded for this pet.</div>';

            return '<div class="inventory-overview-floor-block vehicle-detail-card">' +
                '<div class="inventory-overview-floor-title">' + escapeHtml(title) + '</div>' +
                rowHtml +
            '</div>';
        }).join('');

        return '<div class="inventory-overview-grid inventory-overview-grid-vehicle">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Pet Transport</h4>' +
                '<div class="vehicle-detail-grid">' + cards + '</div>' +
            '</section>' +
        '</div>';
    }

    function getFreightCategoryLabel(unitCategory) {
        const normalized = String(unitCategory || '').trim().toLowerCase();
        if (normalized === 'pallet') return 'Pallet';
        if (normalized === 'container') return 'Container';
        if (normalized === 'other') return 'Other';
        return formatItemLabel(unitCategory);
    }

    function getFreightUnitCountNoun(unitCategory) {
        const normalized = String(unitCategory || '').trim().toLowerCase();
        if (normalized === 'pallet') return 'pallets';
        if (normalized === 'container') return 'containers';
        return 'units';
    }

    function getQuoteFieldValue(quote, fieldId) {
        if (!quote || typeof quote !== 'object') return '';
        const camelKey = String(fieldId || '').replace(/-([a-z])/g, function (_match, letter) {
            return letter.toUpperCase();
        });
        return firstText(
            quote[fieldId],
            quote[camelKey],
            quote.idState && quote.idState[fieldId] && quote.idState[fieldId].value,
            quote.formData && quote.formData[fieldId],
            quote.quoteData && quote.quoteData[fieldId],
            quote.stepData && quote.stepData[fieldId],
            ''
        );
    }

    function parseFreightUnitsFromQuote(quote) {
        const units = [];
        const pushUnit = function (unit) {
            if (!unit || typeof unit !== 'object') return;
            const unitCategory = String(unit.unitCategory || unit.category || '').trim();
            const description = String(unit.description || unit.cargo || '').trim();
            const unitType = String(unit.unitType || unit.type || '').trim();
            if (!unitCategory && !description && !unitType) return;
            units.push(unit);
        };

        const rawJson = firstText(quote.freightJson, quote.freight_json, '');
        if (rawJson) {
            try {
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed)) {
                    parsed.forEach(pushUnit);
                } else {
                    pushUnit(parsed);
                }
            } catch (_error) {
                // Fall through to other freight payload shapes.
            }
        }

        if (!units.length && quote.freightDetails) {
            if (Array.isArray(quote.freightDetails)) {
                quote.freightDetails.forEach(pushUnit);
            } else {
                pushUnit(quote.freightDetails);
            }
        }

        if (!units.length) {
            const unitCategory = getQuoteFieldValue(quote, 'freight3-unit-category');
            if (unitCategory) {
                pushUnit({
                    unitCategory: unitCategory,
                    unitType: getQuoteFieldValue(quote, 'freight3-unit-type'),
                    length: getQuoteFieldValue(quote, 'freight3-length'),
                    width: getQuoteFieldValue(quote, 'freight3-width'),
                    height: getQuoteFieldValue(quote, 'freight3-height'),
                    dimensionUnit: getQuoteFieldValue(quote, 'freight3-dimension-unit') || 'm',
                    unitWeight: getQuoteFieldValue(quote, 'freight3-unit-weight'),
                    weightUnit: getQuoteFieldValue(quote, 'freight3-weight-unit') || 'kg',
                    unitCount: getQuoteFieldValue(quote, 'freight3-unit-count'),
                    description: getQuoteFieldValue(quote, 'freight3-description'),
                    notes: getQuoteFieldValue(quote, 'freight3-notes')
                });
            }
        }

        if (!units.length) {
            const summaryText = firstText(
                quote.officeRemovalDescription,
                quote['office-removal-description'],
                quote.itemDescription,
                ''
            );
            const parsedFromSummary = parseFreightUnitsFromSummaryText(summaryText);
            parsedFromSummary.forEach(pushUnit);
        }

        return units;
    }

    function parseFreightUnitsFromSummaryText(summaryText) {
        const text = String(summaryText || '').trim();
        if (!text || !/unit category:/i.test(text)) return [];

        const unit = {};
        text.split('|').forEach(function (segment) {
            const part = String(segment || '').trim();
            const colonIndex = part.indexOf(':');
            if (colonIndex <= 0) return;
            const label = part.slice(0, colonIndex).trim().toLowerCase();
            const value = part.slice(colonIndex + 1).trim();
            if (!value) return;

            if (label === 'unit category') unit.unitCategory = value;
            else if (label === 'unit type') unit.unitType = value;
            else if (label === 'dimensions') {
                const match = value.match(/^(.+?)\s*x\s*(.+?)\s+([a-z]+)$/i);
                if (match) {
                    unit.length = match[1].trim();
                    unit.width = match[2].trim();
                    unit.dimensionUnit = match[3].trim();
                }
            } else if (label === 'height') {
                const match = value.match(/^(.+?)\s+([a-z]+)$/i);
                if (match) {
                    unit.height = match[1].trim();
                    if (!unit.dimensionUnit) unit.dimensionUnit = match[2].trim();
                } else {
                    unit.height = value;
                }
            } else if (label === 'weight per unit') {
                const match = value.match(/^(.+?)\s+([a-z]+)$/i);
                if (match) {
                    unit.unitWeight = match[1].trim();
                    unit.weightUnit = match[2].trim();
                } else {
                    unit.unitWeight = value;
                }
            } else if (label === 'quantity') {
                const match = value.match(/^(\d+)/);
                if (match) unit.unitCount = match[1];
            } else if (label === 'cargo') unit.description = value;
            else if (label === 'notes') unit.notes = value;
        });

        return Object.keys(unit).length ? [unit] : [];
    }

    function formatFreightListingLabel(unit, index) {
        const categoryLabel = getFreightCategoryLabel(unit && unit.unitCategory);
        const typeLabel = formatItemLabel(unit && unit.unitType);
        const description = String(unit && unit.description || '').trim();
        const detailParts = [];

        if (typeLabel) detailParts.push(typeLabel);
        if (description) detailParts.push('Cargo: ' + description);

        const specificLabel = detailParts.length
            ? categoryLabel + ' (' + detailParts.join(' · ') + ')'
            : categoryLabel;

        return 'Freight ' + (index + 1) + ': ' + specificLabel;
    }

    function buildFreightDetailRows(unit) {
        const rows = [];
        const addRow = function (label, value) {
            const text = String(value || '').trim();
            if (!text) return;
            rows.push('<li><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(text) + '</li>');
        };

        addRow('Category', getFreightCategoryLabel(unit && unit.unitCategory));
        addRow('Unit type', formatItemLabel(unit && unit.unitType));

        const length = String(unit && unit.length || '').trim();
        const width = String(unit && unit.width || '').trim();
        const dimensionUnit = String(unit && unit.dimensionUnit || 'm').trim() || 'm';
        if (length && width) {
            let dimensions = length + ' x ' + width + ' ' + dimensionUnit;
            const height = String(unit && unit.height || '').trim();
            if (height) dimensions += ' x ' + height + ' ' + dimensionUnit;
            addRow('Dimensions', dimensions);
        }

        const unitWeight = String(unit && unit.unitWeight || '').trim();
        if (unitWeight) {
            addRow('Weight per unit', unitWeight + ' ' + (String(unit && unit.weightUnit || 'kg').trim() || 'kg'));
        }

        const unitCount = Math.max(1, parseInt(unit && unit.unitCount, 10) || 1);
        addRow('Quantity', String(unitCount) + ' ' + getFreightUnitCountNoun(unit && unit.unitCategory));

        addRow('Cargo description', unit && unit.description);
        addRow('Access / loading notes', unit && unit.notes);

        return rows;
    }

    function collectFreightServiceInventory(quote) {
        const units = parseFreightUnitsFromQuote(quote);
        if (!units.length) return null;

        let selectedPickupFloors = [];
        const rawPickupFloors = quote.selectedPickupFloors || quote.pickupFloors || quote.pickup_floors;
        if (Array.isArray(rawPickupFloors)) {
            selectedPickupFloors = rawPickupFloors;
        } else if (typeof rawPickupFloors === 'string' && rawPickupFloors.trim()) {
            try {
                const parsedFloors = JSON.parse(rawPickupFloors);
                if (Array.isArray(parsedFloors)) {
                    selectedPickupFloors = parsedFloors;
                }
            } catch (_error) {
                selectedPickupFloors = rawPickupFloors.split(',').map(function (entry) {
                    return String(entry || '').trim();
                }).filter(Boolean);
            }
        }

        selectedPickupFloors = selectedPickupFloors
            .map(function (floor) { return normalizeInventoryFloorKey(floor); })
            .filter(Boolean);

        const pickupFloor = selectedPickupFloors[0]
            || normalizeInventoryFloorKey(firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground'));

        const pickupMap = {};
        if (!pickupMap[pickupFloor]) {
            pickupMap[pickupFloor] = {};
        }

        units.forEach(function (unit, index) {
            const label = formatFreightListingLabel(unit, index);
            const qty = Math.max(1, parseInt(unit && unit.unitCount, 10) || 1);
            pickupMap[pickupFloor][label] = (pickupMap[pickupFloor][label] || 0) + qty;
        });

        return {
            pickup: pickupMap,
            delivery: {}
        };
    }

    function renderFreightInventoryMarkup(quote, units) {
        const freightUnits = Array.isArray(units) ? units : parseFreightUnitsFromQuote(quote);
        if (!freightUnits.length) {
            return '<div class="empty-inventory">No freight units were saved for this listing.</div>';
        }

        const cards = freightUnits.map(function (unit, index) {
            const title = formatFreightListingLabel(unit, index);
            const rows = buildFreightDetailRows(unit);
            const rowHtml = rows.length
                ? '<ul class="inventory-overview-floor-items vehicle-detail-list">' + rows.join('') + '</ul>'
                : '<div class="empty-inventory">No details recorded for this freight unit.</div>';

            return '<div class="inventory-overview-floor-block vehicle-detail-card">' +
                '<div class="inventory-overview-floor-title">' + escapeHtml(title) + '</div>' +
                rowHtml +
            '</div>';
        }).join('');

        return '<div class="inventory-overview-grid inventory-overview-grid-vehicle">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Freight Units</h4>' +
                '<div class="vehicle-detail-grid">' + cards + '</div>' +
            '</section>' +
        '</div>';
    }

    function isClearanceTransportListing(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return serviceType === 'clearance' || serviceType.includes('clearance');
    }

    function formatClearanceWeightLabel(weightRange, weightUnit) {
        const range = String(weightRange || '').trim();
        if (!range) return '';
        const unit = String(weightUnit || 'kg').trim().toLowerCase() || 'kg';
        if (range === '100+') return '100+ ' + unit;
        return range.replace('-', '–') + ' ' + unit;
    }

    function parseClearanceSelectedItemsFromQuote(quote) {
        const items = [];
        const pushItems = function (source) {
            if (!source) return;
            let parsed = source;
            if (typeof source === 'string') {
                const raw = source.trim();
                if (!raw) return;
                try {
                    parsed = JSON.parse(raw);
                } catch (_error) {
                    raw.split(/[;,\n]+/).forEach(function (part) {
                        const label = String(part || '').trim();
                        if (label) items.push(label);
                    });
                    return;
                }
            }
            if (Array.isArray(parsed)) {
                parsed.forEach(function (entry) {
                    const label = String(entry || '').trim();
                    if (label) items.push(label);
                });
            }
        };

        pushItems(firstText(
            quote.clearanceSelectedItemsJson,
            quote.clearance_selected_items_json,
            quote.clearanceSelectedItems,
            quote.clearance_selected_items,
            ''
        ));
        if (!items.length) {
            pushItems(getQuoteFieldValue(quote, 'clearance-selected-items-hidden'));
        }

        if (!items.length) {
            const summaryText = firstText(
                quote.officeRemovalDescription,
                quote['office-removal-description'],
                quote.itemDescription,
                ''
            );
            const selectedMatch = summaryText.match(/selected inventory:\s*(.+)$/i);
            if (selectedMatch && selectedMatch[1]) {
                selectedMatch[1].split(',').forEach(function (part) {
                    const label = String(part || '').trim();
                    if (label) items.push(label);
                });
            }
        }

        const deduped = [];
        const seen = new Set();
        items.forEach(function (item) {
            const key = item.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            deduped.push(item);
        });
        return deduped;
    }

    function parseClearanceCardsFromQuote(quote) {
        const cards = [];
        const pushCard = function (card) {
            if (!card || typeof card !== 'object') return;
            const description = String(card.description || card.clearanceDescription || '').trim();
            const weight = String(card.weight || card.weightRange || '').trim();
            const recycling = String(card.recycling || '').trim();
            if (!description && !weight && !recycling) return;
            cards.push(card);
        };

        const rawJson = firstText(quote.clearanceJson, quote.clearance_json, '');
        if (rawJson) {
            try {
                const parsed = JSON.parse(rawJson);
                if (Array.isArray(parsed)) {
                    parsed.forEach(pushCard);
                } else {
                    pushCard(parsed);
                }
            } catch (_error) {
                // Fall through to summary parsing.
            }
        }

        if (!cards.length && Array.isArray(quote.clearanceCards)) {
            quote.clearanceCards.forEach(pushCard);
        }

        if (!cards.length) {
            const summaryText = firstText(
                quote.officeRemovalDescription,
                quote['office-removal-description'],
                quote.itemDescription,
                ''
            );
            if (summaryText) {
                summaryText.split(/\s*\|\|\s*/).forEach(function (segment) {
                    const part = String(segment || '').trim();
                    if (!part || /^selected inventory:/i.test(part)) return;
                    const itemMatch = part.match(/^item\s+(\d+)\s*:\s*(.+)$/i);
                    if (!itemMatch) return;
                    const details = itemMatch[2];
                    const card = { index: parseInt(itemMatch[1], 10) || cards.length + 1 };
                    details.split('|').forEach(function (piece) {
                        const pieceText = String(piece || '').trim();
                        const colonIndex = pieceText.indexOf(':');
                        if (colonIndex <= 0) return;
                        const label = pieceText.slice(0, colonIndex).trim().toLowerCase();
                        const value = pieceText.slice(colonIndex + 1).trim();
                        if (!value) return;
                        if (label === 'weight range') {
                            const weightMatch = value.match(/^(.+?)\s+(kg|lb)$/i);
                            if (weightMatch) {
                                card.weight = weightMatch[1].replace(/–/g, '-').trim();
                                card.weightUnit = weightMatch[2].toLowerCase();
                            } else {
                                card.weight = value.replace(/–/g, '-').trim();
                                card.weightUnit = 'kg';
                            }
                        } else if (label === 'clearance items') {
                            card.description = value;
                        } else if (label === 'recycling fee') {
                            card.recycling = /included/i.test(value) ? 'yes' : 'no';
                        } else if (label === 'notes') {
                            card.notes = value;
                        } else if (label === 'heavy items') {
                            card.heavyItems = value;
                        }
                    });
                    pushCard(card);
                });
            }
        }

        return cards;
    }

    function formatClearanceCardTitle(card, index) {
        const description = String(card && card.description || '').trim();
        const titleIndex = parseInt(card && card.index, 10) || (index + 1);
        if (description) {
            return 'Clearance ' + titleIndex + ': ' + description;
        }
        return 'Clearance ' + titleIndex;
    }

    function buildClearanceDetailRows(card) {
        const rows = [];
        const addRow = function (label, value) {
            const text = String(value || '').trim();
            if (!text) return;
            rows.push('<li><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(text) + '</li>');
        };

        addRow('Description', card && card.description);
        addRow('Weight range', formatClearanceWeightLabel(card && card.weight, card && card.weightUnit));
        const recycling = String(card && card.recycling || '').trim().toLowerCase();
        if (recycling === 'yes') {
            addRow('Recycling fee', 'Included');
        } else if (recycling === 'no') {
            addRow('Recycling fee', 'Not included');
        }
        addRow('Heavy items', card && card.heavyItems);
        addRow('Notes', card && card.notes);

        return rows;
    }

    function collectClearanceServiceInventory(quote) {
        const cards = parseClearanceCardsFromQuote(quote);
        const selectedItems = parseClearanceSelectedItemsFromQuote(quote);
        if (!cards.length && !selectedItems.length) {
            return null;
        }

        let selectedPickupFloors = [];
        const rawPickupFloors = quote.selectedPickupFloors || quote.pickupFloors || quote.pickup_floors;
        if (Array.isArray(rawPickupFloors)) {
            selectedPickupFloors = rawPickupFloors;
        } else if (typeof rawPickupFloors === 'string' && rawPickupFloors.trim()) {
            try {
                const parsedFloors = JSON.parse(rawPickupFloors);
                if (Array.isArray(parsedFloors)) {
                    selectedPickupFloors = parsedFloors;
                }
            } catch (_error) {
                selectedPickupFloors = rawPickupFloors.split(',').map(function (entry) {
                    return String(entry || '').trim();
                }).filter(Boolean);
            }
        }

        selectedPickupFloors = selectedPickupFloors
            .map(function (floor) { return normalizeInventoryFloorKey(floor); })
            .filter(Boolean);

        const pickupFloor = selectedPickupFloors[0]
            || normalizeInventoryFloorKey(firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground'));

        const pickupMap = {};
        if (!pickupMap[pickupFloor]) {
            pickupMap[pickupFloor] = {};
        }

        cards.forEach(function (card, index) {
            const label = formatClearanceCardTitle(card, index);
            pickupMap[pickupFloor][label] = 1;
        });

        selectedItems.forEach(function (itemName) {
            const label = formatItemLabel(itemName);
            if (!label) return;
            pickupMap[pickupFloor][label] = (pickupMap[pickupFloor][label] || 0) + 1;
        });

        return {
            pickup: pickupMap,
            delivery: {}
        };
    }

    function renderClearanceInventoryMarkup(quote) {
        const cards = parseClearanceCardsFromQuote(quote);
        const selectedItems = parseClearanceSelectedItemsFromQuote(quote);
        if (!cards.length && !selectedItems.length) {
            return '<div class="empty-inventory">No clearance items were saved for this listing.</div>';
        }

        let html = '<div class="inventory-overview-grid inventory-overview-grid-vehicle">';

        if (cards.length) {
            const cardBlocks = cards.map(function (card, index) {
                const title = formatClearanceCardTitle(card, index);
                const rows = buildClearanceDetailRows(card);
                const rowHtml = rows.length
                    ? '<ul class="inventory-overview-floor-items vehicle-detail-list">' + rows.join('') + '</ul>'
                    : '<div class="empty-inventory">No details recorded for this clearance item.</div>';
                return '<div class="inventory-overview-floor-block vehicle-detail-card">' +
                    '<div class="inventory-overview-floor-title">' + escapeHtml(title) + '</div>' +
                    rowHtml +
                '</div>';
            }).join('');

            html += '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Clearance Items</h4>' +
                '<div class="vehicle-detail-grid">' + cardBlocks + '</div>' +
            '</section>';
        }

        if (selectedItems.length) {
            const selectedRows = selectedItems.map(function (itemName) {
                return '<li><span class="inventory-overview-item-name">' + escapeHtml(formatItemLabel(itemName)) + '</span>' +
                    '<span class="inventory-overview-item-meta">x1</span></li>';
            }).join('');

            html += '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Selected House Inventory</h4>' +
                '<div class="inventory-overview-floor-block">' +
                    '<ul class="inventory-overview-floor-items">' + selectedRows + '</ul>' +
                '</div>' +
            '</section>';
        }

        html += '</div>';
        return html;
    }

    function parsePianosFromQuote(quote) {
        const raw = firstText(quote.pianosJson, quote.pianos_json, '');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    return parsed.filter(function (entry) { return entry && typeof entry === 'object'; });
                }
            } catch (_error) {
                // Fall through to legacy array field.
            }
        }

        if (Array.isArray(quote.pianos)) {
            return quote.pianos.filter(function (entry) { return entry && typeof entry === 'object'; });
        }

        return [];
    }

    function formatPianoListingLabel(piano, index) {
        const pianoTypeLabels = {
            'upright-spinet': 'Upright - Spinet',
            'upright-console': 'Upright - Console',
            'upright-studio': 'Upright - Studio',
            'upright-full': 'Upright - Full',
            'baby-grand': 'Baby Grand',
            'medium-grand': 'Medium Grand',
            'parlor-grand': 'Parlor / Living Grand',
            'concert-grand': 'Concert Grand',
            'digital': 'Digital Piano',
            'keyboard': 'Keyboard',
            'custom': 'Custom Piano',
            'unknown': "I don't know"
        };

        const pianoSizeLabels = {
            '145x60x100cm': '145 x 60 x 100 cm',
            '150x65x110cm': '150 x 65 x 110 cm',
            '150x65x120cm': '150 x 65 x 120 cm',
            '155x65x130cm': '155 x 65 x 130 cm',
            '155x150x102cm': '155 x 150 x 102 cm',
            '170x152x102cm': '170 x 152 x 102 cm',
            '190x152x102cm': '190 x 152 x 102 cm',
            '275x158x102cm': '275 x 158 x 102 cm',
            '140x40x90cm': '140 x 40 x 90 cm',
            '130x35x15cm': '130 x 35 x 15 cm'
        };

        const baseType = pianoTypeLabels[String(piano && piano.type || '').trim()] || 'Piano';
        let detailText = '';

        if (piano && (piano.isCustomSize || piano.isCustomType)) {
            const customDims = [piano.customLength, piano.customWidth, piano.customHeight]
                .map(function (v) { return String(v || '').trim(); })
                .filter(Boolean)
                .join(' x ');
            const customUnit = String(piano.customUnit || '').trim();
            const customDimsText = customDims ? customDims + (customUnit ? ' ' + customUnit : '') : '';
            const customName = String(piano.customName || '').trim();

            if (customName && customDimsText) {
                detailText = 'Model: ' + customName + ', Size: ' + customDimsText;
            } else if (customName) {
                detailText = 'Model: ' + customName;
            } else if (customDimsText) {
                detailText = 'Custom size: ' + customDimsText;
            } else {
                detailText = 'Custom size';
            }
        } else if (piano && String(piano.type || '').trim() === 'unknown') {
            const approxDims = [piano.lengthMeasurement, piano.widthMeasurement, piano.heightMeasurement]
                .map(function (v) { return String(v || '').trim(); })
                .filter(Boolean)
                .join(' x ');
            detailText = approxDims ? 'Approx size: ' + approxDims + ' cm' : 'Details from uploaded media';
        } else {
            const sizeLabel = pianoSizeLabels[String(piano && piano.size || '').trim()] || '';
            if (sizeLabel) {
                detailText = 'Size: ' + sizeLabel;
            }
        }

        const specificLabel = detailText ? baseType + ' (' + detailText + ')' : baseType;
        return 'Piano ' + (index + 1) + ': ' + specificLabel;
    }

    function collectPianoServiceInventory(quote) {
        const pianos = parsePianosFromQuote(quote);
        if (!pianos.length) {
            return null;
        }

        let selectedPickupFloors = [];
        const rawPickupFloors = quote.selectedPickupFloors || quote.pickupFloors || quote.pickup_floors;
        if (Array.isArray(rawPickupFloors)) {
            selectedPickupFloors = rawPickupFloors;
        } else if (typeof rawPickupFloors === 'string' && rawPickupFloors.trim()) {
            try {
                const parsedFloors = JSON.parse(rawPickupFloors);
                if (Array.isArray(parsedFloors)) {
                    selectedPickupFloors = parsedFloors;
                }
            } catch (_error) {
                selectedPickupFloors = rawPickupFloors.split(',').map(function (entry) {
                    return String(entry || '').trim();
                }).filter(Boolean);
            }
        }

        selectedPickupFloors = selectedPickupFloors
            .map(function (floor) { return normalizeInventoryFloorKey(floor); })
            .filter(Boolean);

        const pickupFloor = selectedPickupFloors[0]
            || normalizeInventoryFloorKey(firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground'));

        const pickupMap = {};
        if (!pickupMap[pickupFloor]) {
            pickupMap[pickupFloor] = {};
        }

        pianos.forEach(function (piano, index) {
            const label = formatPianoListingLabel(piano, index);
            pickupMap[pickupFloor][label] = 1;
        });

        return {
            pickup: pickupMap,
            delivery: {},
            isPiano: true
        };
    }

    function getVehicleListingKind(quote) {
        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        if (serviceType.includes('car/campervan') || serviceType.includes('car transport')) return 'car';
        if (serviceType.includes('motorbike')) return 'motorbike';
        if (serviceType.includes('boat')) return 'trailer';
        if (serviceType.includes('caravan') || serviceType.includes('trailer')) return 'trailer';
        return '';
    }

    function parseVehiclesJson(raw) {
        if (!raw) return [];
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
            try {
                const parsed = JSON.parse(raw);
                return Array.isArray(parsed) ? parsed : [];
            } catch (_error) {
                return [];
            }
        }
        return [];
    }

    function collectVehiclesFromQuote(quote) {
        const kind = getVehicleListingKind(quote);
        if (!kind) {
            return { kind: '', vehicles: [], baseLabel: 'Vehicle' };
        }

        const baseLabel = kind === 'car'
            ? 'Car/Campervan'
            : (kind === 'motorbike' ? 'Motorbike' : (normalizeListingServiceType(quote).toLowerCase().includes('boat') ? 'Boat' : 'Caravan/Trailer'));

        let raw = '';
        if (kind === 'car') {
            raw = firstText(quote.carVehiclesJson, quote.carJson, quote.car_json, quote.carDetails);
        } else if (kind === 'motorbike') {
            raw = firstText(quote.motorbikeVehiclesJson, quote.motorbikeJson, quote.motorbike_json, quote.motorbikeDetails);
        } else {
            raw = firstText(
                quote.trailerVehiclesJson,
                quote.trailerJson,
                quote.trailer_json,
                quote.trailerDetails,
                quote.campervanDetails
            );
        }

        let vehicles = parseVehiclesJson(raw);
        if (!vehicles.length && quote.vehicleDraftSnapshot && typeof quote.vehicleDraftSnapshot === 'object') {
            vehicles = parseVehiclesJson(quote.vehicleDraftSnapshot[kind]);
        }

        const serviceType = normalizeListingServiceType(quote).toLowerCase();
        return {
            kind: kind,
            vehicles: vehicles,
            baseLabel: baseLabel,
            isBoatService: serviceType === 'boats' || serviceType.includes('boat transport')
        };
    }

    const VEHICLE_OPTION_LABELS = {
        value: {
            '0-1000': '€0 - €1,000',
            '1000-2500': '€1,000 - €2,500',
            '2501-5000': '€2,501 - €5,000',
            '5001-10000': '€5,001 - €10,000',
            '10001-15000': '€10,001 - €15,000',
            '15001-20000': '€15,001 - €20,000',
            '20000+': '€20,000+'
        },
        weight: {
            'upto-1000': 'Up to 1000kg',
            '1001-1250': '1001-1250kg',
            '1251-1500': '1251-1500kg',
            '1501-1750': '1501-1750kg',
            '1751-2000': '1751-2000kg',
            '2001+': '2001kg+',
            custom: 'Other (approx.)'
        },
        length: {
            'upto-2500': 'Up to 2500mm',
            '2501-3000': '2501-3000mm',
            '3001-3500': '3001-3500mm',
            '3501-4000': '3501-4000mm',
            '4001-4500': '4001-4500mm',
            '4501+': '4501mm+',
            custom: 'Other (approx.)'
        },
        type: {
            car: 'Car',
            campervan: 'Campervan'
        },
        condition: {
            'brand-new': 'Brand New',
            used: 'Used',
            'used-non-runner': 'Non-runner'
        },
        method: {
            towed: 'Towed',
            driven: 'Driven',
            'open-transporter': 'Open Transporter',
            'enclosed-transport': 'Enclosed Transport'
        }
    };

    function formatVehicleDetailValue(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^(yes|no|true|false)$/i.test(raw)) {
            return raw.toLowerCase() === 'yes' || raw.toLowerCase() === 'true' ? 'Yes' : 'No';
        }
        if (VEHICLE_OPTION_LABELS.value[raw]
            || VEHICLE_OPTION_LABELS.weight[raw]
            || VEHICLE_OPTION_LABELS.length[raw]
            || VEHICLE_OPTION_LABELS.type[raw]
            || VEHICLE_OPTION_LABELS.condition[raw]
            || VEHICLE_OPTION_LABELS.method[raw]) {
            return VEHICLE_OPTION_LABELS.value[raw]
                || VEHICLE_OPTION_LABELS.weight[raw]
                || VEHICLE_OPTION_LABELS.length[raw]
                || VEHICLE_OPTION_LABELS.type[raw]
                || VEHICLE_OPTION_LABELS.condition[raw]
                || VEHICLE_OPTION_LABELS.method[raw];
        }
        return raw
            .replace(/_/g, ' ')
            .replace(/\b([a-z])/g, function (match) { return match.toUpperCase(); });
    }

    function formatVehicleFieldValue(fieldKind, value, vehicle) {
        const raw = String(value || '').trim();
        if (!raw) return '';

        const map = VEHICLE_OPTION_LABELS[fieldKind] || {};
        if (map[raw]) return map[raw];

        if (fieldKind === 'weight' && raw === 'custom') {
            const customValue = String(vehicle && vehicle.customWeight || '').trim();
            if (!customValue) return 'Other (approx.)';
            return 'Approx. ' + customValue + ' ' + String(vehicle.customWeightUnit || 'kg').trim();
        }

        if (fieldKind === 'length' && raw === 'custom') {
            const customValue = String(vehicle && vehicle.customLength || '').trim();
            if (!customValue) return 'Other (approx.)';
            return customValue + ' ' + String(vehicle.customLengthUnit || 'mm').trim();
        }

        return formatVehicleDetailValue(raw);
    }

    function formatFloorDisplayLabel(floorName) {
        const raw = String(floorName || '').trim();
        if (!raw) return '';
        if (/floor$/i.test(raw)) return raw;
        return raw + ' Floor';
    }

    function resolveVehiclePickupFloorLabel(quote, vehicle) {
        const vehicleFloors = Array.isArray(vehicle && vehicle.floors)
            ? vehicle.floors.map(function (floor) { return String(floor || '').trim(); }).filter(Boolean)
            : [];
        if (vehicleFloors.length) {
            return vehicleFloors.map(formatFloorDisplayLabel).join(', ');
        }

        const selectedPickup = quote.selectedPickupFloors;
        if (Array.isArray(selectedPickup) && selectedPickup.length) {
            return selectedPickup.map(formatFloorDisplayLabel).join(', ');
        }

        return formatFloorDisplayLabel(firstText(
            quote.pickupFloorSelect,
            quote.pickupFloor,
            quote.fromFloor,
            'Ground'
        ));
    }

    function resolveVehicleDeliveryFloorLabel(quote, vehicle, kind, index) {
        const deliveryFloors = new Set();

        if (Array.isArray(vehicle && vehicle.floors)) {
            vehicle.floors.forEach(function (floor) {
                const clean = String(floor || '').trim();
                if (clean) deliveryFloors.add(clean);
            });
        }

        const makeModel = String(vehicle && vehicle.makeModel || '').trim().toLowerCase();
        const vehicleId = vehicle && vehicle.id != null ? String(vehicle.id) : '';
        const vehiclePrefix = kind ? (kind + '::') : '';
        const labelPatterns = [];
        if (makeModel) {
            labelPatterns.push(makeModel);
            labelPatterns.push('campervan / car ' + String(index + 1) + ': ' + makeModel);
            labelPatterns.push('car ' + String(index + 1) + ': ' + makeModel);
        }
        if (vehicleId && vehiclePrefix) {
            labelPatterns.push(vehiclePrefix + vehicleId);
        }

        const assignments = firstObject(
            quote.itemFloorAssignments,
            quote.deliveryItemFloorAssignments,
            quote.deliveryFloorAssignments,
            quote.floorAssignments
        );

        if (assignments && typeof assignments === 'object') {
            Object.keys(assignments).forEach(function (assignmentKey) {
                const keyLower = String(assignmentKey || '').toLowerCase();
                const matchesVehicle = labelPatterns.some(function (pattern) {
                    return pattern && keyLower.includes(String(pattern).toLowerCase());
                });
                if (!matchesVehicle) return;

                const perFloor = assignments[assignmentKey];
                if (!perFloor || typeof perFloor !== 'object') return;
                Object.keys(perFloor).forEach(function (floorName) {
                    const qty = parseInt(perFloor[floorName], 10) || 0;
                    if (qty > 0 && floorName) deliveryFloors.add(floorName);
                });
            });
        }

        if (deliveryFloors.size) {
            return Array.from(deliveryFloors)
                .sort(compareFloorLabels)
                .map(formatFloorDisplayLabel)
                .join(', ');
        }

        const selectedDelivery = quote.selectedDeliveryFloors;
        if (Array.isArray(selectedDelivery) && selectedDelivery.length) {
            return selectedDelivery.map(formatFloorDisplayLabel).join(', ');
        }

        return formatFloorDisplayLabel(firstText(
            quote.deliveryFloorSelect,
            quote.deliveryFloor,
            quote.toFloor,
            ''
        )) || 'Not assigned';
    }

    function buildVehicleDetailRows(quote, vehicle, kind, index, baseLabel, isBoatService) {
        const rows = [];
        const addRow = function (label, value) {
            const text = String(value || '').trim();
            if (!text) return;
            rows.push('<li><strong>' + escapeHtml(label) + ':</strong> ' + escapeHtml(text) + '</li>');
        };

        const title = firstText(vehicle && vehicle.makeModel, baseLabel + ' ' + (index + 1));
        addRow('Make & model', title);
        addRow('Pickup floor', resolveVehiclePickupFloorLabel(quote, vehicle));
        addRow('Delivery floor', resolveVehicleDeliveryFloorLabel(quote, vehicle, kind, index));
        addRow('Year', vehicle && vehicle.year);
        addRow('Estimated value', formatVehicleFieldValue('value', vehicle && vehicle.value, vehicle));
        if (kind !== 'motorbike') {
            addRow('Vehicle type', formatVehicleFieldValue('type', vehicle && vehicle.type, vehicle));
        }
        addRow('Condition', formatVehicleFieldValue('condition', vehicle && vehicle.condition, vehicle));
        if (kind !== 'motorbike') {
            addRow('Transport method', formatVehicleFieldValue('method', vehicle && vehicle.method, vehicle));
        }
        addRow(isBoatService ? 'Seaworthy' : 'Roadworthy', formatVehicleDetailValue(vehicle && vehicle.roadworthy));
        if (kind !== 'trailer') {
            addRow('Insurance', formatVehicleDetailValue(vehicle && vehicle.insurance));
            addRow('Road tax', formatVehicleDetailValue(vehicle && vehicle.roadtax));
        }
        if (kind === 'trailer') {
            addRow('Recently tested', formatVehicleDetailValue(vehicle && vehicle.tested));
        }
        addRow('Weight', formatVehicleFieldValue('weight', vehicle && vehicle.weight, vehicle));
        addRow('Length', formatVehicleFieldValue('length', vehicle && vehicle.length, vehicle));

        const mediaLabel = (function () {
            const media = Array.isArray(vehicle && vehicle.media) ? vehicle.media : [];
            if (!media.length) return '';
            const photos = media.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('image/');
            }).length;
            const videos = media.filter(function (item) {
                return String(item && item.type || '').toLowerCase().startsWith('video/');
            }).length;
            const parts = [];
            if (photos > 0) parts.push(photos + ' photo' + (photos === 1 ? '' : 's'));
            if (videos > 0) parts.push(videos + ' video' + (videos === 1 ? '' : 's'));
            if (!parts.length) parts.push(media.length + ' file' + (media.length === 1 ? '' : 's'));
            return parts.join(', ');
        })();
        addRow('Photos / videos', mediaLabel);

        return rows;
    }

    function renderVehicleInventoryMarkup(quote, vehiclePayload) {
        const vehicles = vehiclePayload && Array.isArray(vehiclePayload.vehicles) ? vehiclePayload.vehicles : [];
        const baseLabel = firstText(vehiclePayload && vehiclePayload.baseLabel, 'Vehicle');
        const isBoatService = !!vehiclePayload && !!vehiclePayload.isBoatService;

        if (!vehicles.length) {
            return '<div class="empty-inventory">No vehicle details were saved for this listing.</div>';
        }

        const cards = vehicles.map(function (vehicle, index) {
            const title = firstText(vehicle && vehicle.makeModel, baseLabel + ' ' + (index + 1));
            const rows = buildVehicleDetailRows(quote, vehicle, vehiclePayload.kind, index, baseLabel, isBoatService);
            const rowHtml = rows.length
                ? '<ul class="inventory-overview-floor-items vehicle-detail-list">' + rows.join('') + '</ul>'
                : '<div class="empty-inventory">No details recorded for this vehicle.</div>';

            return '<div class="inventory-overview-floor-block vehicle-detail-card">' +
                '<div class="inventory-overview-floor-title">' + escapeHtml(title) + '</div>' +
                rowHtml +
            '</div>';
        }).join('');

        return '<div class="inventory-overview-grid inventory-overview-grid-vehicle">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Vehicle Details</h4>' +
                '<div class="vehicle-detail-grid">' + cards + '</div>' +
            '</section>' +
        '</div>';
    }

    function normalizeInventoryFloorKey(floorLabel) {
        const raw = String(floorLabel || '').trim();
        if (!raw) return 'Ground';
        return raw.replace(/\s+floor$/i, '').trim() || 'Ground';
    }

    function collectVehicleServiceInventory(quote) {
        const payload = collectVehiclesFromQuote(quote);
        if (!payload.vehicles.length) return null;

        const pickupMap = {};

        payload.vehicles.forEach(function (vehicle, index) {
            const label = firstText(vehicle && vehicle.makeModel, payload.baseLabel + ' ' + (index + 1));
            const pickupFloor = resolveVehiclePickupFloorLabel(quote, vehicle) || 'Ground Floor';

            pickupFloor.split(',').map(function (entry) { return entry.trim(); }).filter(Boolean).forEach(function (floorLabel) {
                const floorKey = normalizeInventoryFloorKey(floorLabel);
                if (!pickupMap[floorKey]) pickupMap[floorKey] = {};
                pickupMap[floorKey][label] = 1;
            });
        });

        return {
            pickup: pickupMap,
            delivery: {},
            isVehicle: true
        };
    }

    function renderInventory(quote) {
        const inventoryEl = document.getElementById('details-inventory');
        const toggleBtn = document.getElementById('inventory-toggle-btn');
        const panelEl = document.getElementById('inventory-inline-panel');
        if (!inventoryEl || !toggleBtn || !panelEl) return;
        let panelAnimationTimer = null;

        let inventoryHtml = '';
        if (isVehicleTransportListing(quote)) {
            inventoryHtml = renderVehicleInventoryMarkup(quote, collectVehiclesFromQuote(quote));
        } else if (isFreightTransportListing(quote)) {
            inventoryHtml = renderFreightInventoryMarkup(quote);
        } else if (isClearanceTransportListing(quote)) {
            inventoryHtml = renderClearanceInventoryMarkup(quote);
        } else if (isIndustrialTransportListing(quote)) {
            inventoryHtml = renderIndustrialInventoryMarkup(quote);
        } else if (isManPowerTransportListing(quote)) {
            inventoryHtml = renderManpowerInventoryMarkup(quote);
        } else if (isPetsTransportListing(quote)) {
            inventoryHtml = renderPetsInventoryMarkup(quote);
        } else {
            const overviewInventory = collectOverviewStyleInventory(quote);
            if (overviewInventory) {
                inventoryHtml = renderRoomSortedInventory(quote, overviewInventory);
            } else {
                const groups = collectInventoryGroups(quote);
                if (!groups.length) {
                    inventoryHtml = '<div class="empty-inventory">No items specified for this listing.</div>';
                } else {
                    inventoryHtml = groups.map(function (group) {
                    const roomBlocks = group.rooms.map(function (roomGroup) {
                        const itemsHtml = roomGroup.items.map(function (entry) {
                            const qtyLabel = Number(entry.qty) > 0 ? 'x' + String(entry.qty) + ' ' : '';
                            return '<li class="inventory-detail-item">' +
                                '<span class="inventory-detail-name">' + escapeHtml(qtyLabel + entry.item) + '</span>' +
                                '<span class="inventory-detail-delivery">Deliver: ' + escapeHtml(entry.deliveryFloor) + '</span>' +
                                '</li>';
                        }).join('');

                        return '<div class="inventory-room-group">' +
                            '<h5 class="inventory-room-title">Room: ' + escapeHtml(roomGroup.room) + '</h5>' +
                            '<ul class="inventory-detail-list">' + itemsHtml + '</ul>' +
                            '</div>';
                    }).join('');

                    return '<article class="inventory-floor-group">' +
                        '<h4 class="inventory-floor-title">Pickup floor: ' + escapeHtml(group.pickupFloor) + '</h4>' +
                        roomBlocks +
                        '</article>';
                    }).join('');
                }
            }
        }

        inventoryEl.innerHTML = inventoryHtml;

        closeInventoryPanel(true);
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = 'View Inventory';
        toggleBtn.onclick = toggleInventoryPanel;

        function toggleInventoryPanel() {
            if (panelEl.classList.contains('is-open')) {
                closeInventoryPanel();
                return;
            }

            openInventoryPanel();
        }

        function openInventoryPanel() {
            if (panelAnimationTimer) {
                clearTimeout(panelAnimationTimer);
                panelAnimationTimer = null;
            }

            panelEl.hidden = false;
            panelEl.classList.remove('is-closing');
            // Restart the opening animation when users re-open quickly.
            panelEl.classList.remove('is-open');
            panelEl.offsetHeight;
            panelEl.classList.add('is-open');
            panelEl.setAttribute('aria-hidden', 'false');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.textContent = 'Hide Inventory';
        }

        function closeInventoryPanel(immediate) {
            if (panelAnimationTimer) {
                clearTimeout(panelAnimationTimer);
                panelAnimationTimer = null;
            }

            panelEl.classList.remove('is-open');
            panelEl.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = 'View Inventory';

            if (immediate) {
                panelEl.classList.remove('is-closing');
                panelEl.hidden = true;
                return;
            }

            panelEl.hidden = false;
            panelEl.classList.add('is-closing');
            panelAnimationTimer = setTimeout(function () {
                panelEl.classList.remove('is-closing');
                panelEl.hidden = true;
                panelAnimationTimer = null;
            }, 240);
        }
    }

    function renderMediaGallery(quote) {
        const toggleBtn = document.getElementById('media-toggle-btn');
        const modalEl = document.getElementById('media-modal');
        const dialogEl = modalEl ? modalEl.querySelector('.inventory-modal-dialog') : null;
        const dragHandleEl = document.getElementById('media-drag-handle');
        const closeBtn = document.getElementById('media-close-btn');
        const resetBtn = document.getElementById('media-reset-btn');
        const mediaEl = document.getElementById('details-media');
        if (!toggleBtn || !modalEl || !dialogEl || !dragHandleEl || !closeBtn || !resetBtn || !mediaEl) return;

        const entries = collectMediaEntries(quote);
        if (!entries.length) {
            mediaEl.innerHTML = '<div class="empty-inventory">No photos or videos were provided for this listing.</div>';
        } else {
            mediaEl.innerHTML = entries.map(function (entry) {
                const hasPreview = !!String(entry.previewSrc || '').trim();
                const typeLabel = entry.mediaType === 'video' ? 'Video' : 'Photo';
                const noteText = firstText(entry.note, entry.itemName, entry.fileName, 'No note provided');
                const floorLabel = firstText(entry.floor, 'General');

                let mediaHtml = '<div class="listing-media-placeholder">Preview unavailable for this file in this view.</div>';
                if (hasPreview) {
                    if (entry.mediaType === 'video') {
                        mediaHtml = '<video class="listing-media-preview" controls playsinline src="' + escapeAttribute(entry.previewSrc) + '"></video>';
                    } else {
                        mediaHtml = '<img class="listing-media-preview" src="' + escapeAttribute(entry.previewSrc) + '" alt="' + escapeAttribute(typeLabel) + '" />';
                    }
                }

                return '<article class="listing-media-card">' +
                    '<div class="listing-media-top">' +
                        '<span class="listing-media-kind">' + escapeHtml(typeLabel) + '</span>' +
                        '<span class="listing-media-floor">' + escapeHtml(floorLabel) + '</span>' +
                    '</div>' +
                    '<div class="listing-media-frame">' + mediaHtml + '</div>' +
                    '<div class="listing-media-file">' + escapeHtml(firstText(entry.fileName, 'Attachment')) + '</div>' +
                    '<div class="listing-media-note-label">Note</div>' +
                    '<div class="listing-media-note">' + escapeHtml(noteText) + '</div>' +
                '</article>';
            }).join('');
        }

        closeMediaModal();
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = 'Open Photos';
        toggleBtn.onclick = toggleMediaModal;
        closeBtn.onclick = closeMediaModal;
        resetBtn.onclick = function () {
            setDefaultMediaWindowPosition();
        };

        enableInventoryWindowDrag(dialogEl, dragHandleEl);
        enableInventoryWindowCornerResize(dialogEl);

        modalEl.onclick = function (event) {
            if (event.target === modalEl) {
                closeMediaModal();
            }
        };

        if (modalEl._mediaEscapeHandler) {
            document.removeEventListener('keydown', modalEl._mediaEscapeHandler);
        }

        modalEl._mediaEscapeHandler = function (event) {
            if (event.key === 'Escape' && modalEl.classList.contains('is-open')) {
                closeMediaModal();
            }
        };

        document.addEventListener('keydown', modalEl._mediaEscapeHandler);

        function toggleMediaModal() {
            if (modalEl.classList.contains('is-open')) {
                closeMediaModal();
                return;
            }

            openMediaModal();
        }

        function openMediaModal() {
            modalEl.classList.add('is-open');
            modalEl.setAttribute('aria-hidden', 'false');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.textContent = 'Close Photos';
            if (dialogEl.dataset.userPositioned !== 'true') {
                setDefaultMediaWindowPosition();
            }
        }

        function closeMediaModal() {
            modalEl.classList.remove('is-open');
            modalEl.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = 'Open Photos';
        }

        function setDefaultMediaWindowPosition() {
            const margin = 20;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const preferredWidth = Math.min(980, Math.max(420, Math.floor(viewportWidth * 0.68)));
            const left = Math.max(margin, viewportWidth - preferredWidth - margin);
            const top = Math.max(96, Math.min(140, viewportHeight - 280));

            dialogEl.style.left = String(left) + 'px';
            dialogEl.style.top = String(top) + 'px';
            dialogEl.style.width = String(preferredWidth) + 'px';
            dialogEl.dataset.userPositioned = 'false';
        }
    }

    function renderServices(quote) {
        const toggleBtn = document.getElementById('services-toggle-btn');
        const modalEl = document.getElementById('services-modal');
        const dialogEl = modalEl ? modalEl.querySelector('.inventory-modal-dialog') : null;
        const dragHandleEl = document.getElementById('services-drag-handle');
        const closeBtn = document.getElementById('services-close-btn');
        const resetBtn = document.getElementById('services-reset-btn');
        const servicesEl = document.getElementById('details-services');
        if (!toggleBtn || !modalEl || !dialogEl || !dragHandleEl || !closeBtn || !resetBtn || !servicesEl) return;

        const isVehicleListing = isVehicleTransportListing(quote);
        const isPianoListing = isPianoTransportListing(quote);
        const isFreightListing = isFreightTransportListing(quote);
        const isClearanceListing = isClearanceTransportListing(quote);
        const isIndustrialListing = isIndustrialTransportListing(quote);
        const isManPowerListing = isManPowerTransportListing(quote);
        const isPetsListing = isPetsTransportListing(quote);
        let inventoryData = collectOverviewStyleInventory(quote);
        if (isVehicleListing) {
            inventoryData = collectVehicleServiceInventory(quote) || inventoryData;
        } else if (isPianoListing) {
            inventoryData = collectPianoServiceInventory(quote) || inventoryData;
        } else if (isFreightListing) {
            inventoryData = collectFreightServiceInventory(quote) || inventoryData;
        } else if (isClearanceListing) {
            inventoryData = collectClearanceServiceInventory(quote) || inventoryData;
        } else if (isIndustrialListing) {
            inventoryData = collectIndustrialServiceInventory(quote) || inventoryData;
        } else if (isManPowerListing) {
            inventoryData = collectManpowerServiceInventory(quote) || inventoryData;
        } else if (isPetsListing) {
            inventoryData = collectPetsServiceInventory(quote) || inventoryData;
        } else if (!inventoryData || !Object.keys(inventoryData.pickup || {}).length) {
            const vehicleInventory = collectVehicleServiceInventory(quote);
            if (vehicleInventory) {
                inventoryData = vehicleInventory;
            } else {
                const pianoInventory = collectPianoServiceInventory(quote);
                if (pianoInventory) {
                    inventoryData = pianoInventory;
                } else {
                    const freightInventory = collectFreightServiceInventory(quote);
                    if (freightInventory) {
                        inventoryData = freightInventory;
                    } else {
                        const clearanceInventory = collectClearanceServiceInventory(quote);
                        if (clearanceInventory) {
                            inventoryData = clearanceInventory;
                        } else {
                            const industrialInventory = collectIndustrialServiceInventory(quote);
                            if (industrialInventory) {
                                inventoryData = industrialInventory;
                            } else {
                                const manpowerInventory = collectManpowerServiceInventory(quote);
                                if (manpowerInventory) {
                                    inventoryData = manpowerInventory;
                                } else {
                                    const petsInventory = collectPetsServiceInventory(quote);
                                    if (petsInventory) {
                                        inventoryData = petsInventory;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        const services = buildServiceSelections(quote);

        modalEl._servicesInventoryData = inventoryData;
        modalEl._servicesData = services;
        modalEl._servicesFilteredTypes = new Set();

        function rerenderServices() {
            servicesEl.innerHTML = renderServicesMarkup(inventoryData, services, modalEl._servicesFilteredTypes);
            setupServiceFilterButtons(servicesEl, modalEl);
        }

        rerenderServices();

        closeServicesModal();
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = 'Open Services';
        toggleBtn.onclick = toggleServicesModal;
        closeBtn.onclick = closeServicesModal;
        resetBtn.onclick = function () {
            setDefaultServicesWindowPosition();
        };

        enableInventoryWindowDrag(dialogEl, dragHandleEl);
        enableInventoryWindowCornerResize(dialogEl);

        modalEl.onclick = function (event) {
            if (event.target === modalEl) {
                closeServicesModal();
            }
        };

        if (modalEl._servicesEscapeHandler) {
            document.removeEventListener('keydown', modalEl._servicesEscapeHandler);
        }

        modalEl._servicesEscapeHandler = function (event) {
            if (event.key === 'Escape' && modalEl.classList.contains('is-open')) {
                closeServicesModal();
            }
        };

        document.addEventListener('keydown', modalEl._servicesEscapeHandler);

        function toggleServicesModal() {
            if (modalEl.classList.contains('is-open')) {
                closeServicesModal();
                return;
            }

            openServicesModal();
        }

        function openServicesModal() {
            modalEl.classList.add('is-open');
            modalEl.setAttribute('aria-hidden', 'false');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.textContent = 'Close Services';
            if (dialogEl.dataset.userPositioned !== 'true') {
                setDefaultServicesWindowPosition();
            }
        }

        function closeServicesModal() {
            modalEl.classList.remove('is-open');
            modalEl.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = 'Open Services';
        }

        function setDefaultServicesWindowPosition() {
            const margin = 20;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const preferredWidth = Math.min(980, Math.max(420, Math.floor(viewportWidth * 0.68)));
            const left = Math.max(margin, viewportWidth - preferredWidth - margin);
            const top = Math.max(96, Math.min(140, viewportHeight - 280));

            dialogEl.style.left = String(left) + 'px';
            dialogEl.style.top = String(top) + 'px';
            dialogEl.style.width = String(preferredWidth) + 'px';
            dialogEl.dataset.userPositioned = 'false';
        }
    }

    function setupServiceFilterButtons(servicesEl, modalEl) {
        const buttons = servicesEl.querySelectorAll('.service-badge-filter');
        buttons.forEach(function (btn) {
            btn.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();

                const badgeType = btn.getAttribute('data-service-type');
                if (!badgeType) return;

                if (modalEl._servicesFilteredTypes.has(badgeType)) {
                    modalEl._servicesFilteredTypes.delete(badgeType);
                } else {
                    modalEl._servicesFilteredTypes.add(badgeType);
                }

                const servicesContent = document.getElementById('details-services');
                if (servicesContent) {
                    servicesContent.innerHTML = renderServicesMarkup(modalEl._servicesInventoryData, modalEl._servicesData, modalEl._servicesFilteredTypes);
                    setupServiceFilterButtons(servicesContent, modalEl);
                }
            };
        });
    }

    function buildServiceSelections(quote) {
        const packingItems = parseServiceSelectionMap(
            firstText(quote.servicePackingItems, quote.service_packing_items, quote['service-packing-items'], '')
        );
        const disassemblyItems = parseServiceSelectionMap(quote.serviceDisassemblyItems);
        const assembleItems = parseServiceSelectionMap(quote.serviceAssembleItems);
        const storageItems = parseServiceSelectionMap(quote.serviceStorageItems);

        const packingMode = String(quote.servicePackingMode || '').trim().toLowerCase();
        const isPackingYes = String(quote.servicePacking || '').trim().toLowerCase() === 'yes';
        const isPackingAll = isPackingYes && packingMode === 'all';

        return {
            isPackingAll: isPackingAll,
            packingQtyByItem: createPackingQtyMap(packingItems),
            disassemblyQtyByFloorItem: createFloorItemQtyMap(disassemblyItems),
            assembleQtyByFloorItem: createFloorItemQtyMap(assembleItems),
            storageQtyByFloorItem: createFloorItemQtyMap(storageItems),
            genericServiceLabels: collectGenericServiceLabels(quote),
            isVehicleListing: isVehicleTransportListing(quote),
            vehicleJobPacking: quote.servicePacking,
            vehicleJobDisassembly: quote.serviceDisassembly,
            vehicleJobAssemble: quote.serviceAssembleAtArrival,
            vehicleJobStorage: quote.serviceStorage,
            packingBoxProvider: firstText(quote.servicePackingBoxProvider, quote['service-packing-box-provider'], ''),
            isPartialPacking: isPackingYes && packingMode === 'selected'
        };
    }

    function collectGenericServiceLabels(quote) {
        const labels = [];
        const append = function (value) {
            const clean = String(value || '').trim();
            if (!clean) return;
            labels.push(clean);
        };
        const appendYesOnly = function (label, rawValue) {
            if (String(rawValue || '').trim().toLowerCase() !== 'yes') return;
            append(label);
        };
        const appendMovers = function (label, modeValue, countValue) {
            const mode = String(modeValue || '').trim().toLowerCase();
            if (mode === 'unsure') {
                append(label + ': Not sure yet');
                return;
            }
            const count = String(countValue || '').trim();
            if (count) append(label + ': ' + count);
        };

        appendYesOnly('Packing', quote.servicePacking);
        appendYesOnly('Disassembly', quote.serviceDisassembly);
        appendYesOnly('Assembly at arrival', quote.serviceAssembleAtArrival);
        appendYesOnly('Storage', quote.serviceStorage);

        const pickupMoversMode = String(quote.servicePickupMoversMode || '').trim().toLowerCase();
        const deliveryMoversMode = String(quote.serviceDeliveryMoversMode || '').trim().toLowerCase();
        if (pickupMoversMode === 'unsure') {
            appendMovers('Pickup movers', quote.servicePickupMoversMode, quote.servicePickupMovers);
        }
        if (deliveryMoversMode === 'unsure') {
            appendMovers('Delivery movers', quote.serviceDeliveryMoversMode, quote.serviceDeliveryMovers);
        }
        if (quote.servicePickupLoadingMethod) {
            append('Pickup loading: ' + formatVehicleDetailValue(quote.servicePickupLoadingMethod));
        }
        if (quote.serviceDeliveryLoadingMethod) {
            append('Delivery loading: ' + formatVehicleDetailValue(quote.serviceDeliveryLoadingMethod));
        }
        if (quote.serviceSpecialInstructions) {
            append('Special instructions: ' + String(quote.serviceSpecialInstructions).trim());
        }

        const listSources = [
            quote.additionalServices,
            quote.serviceSelections,
            quote.selectedServices,
            quote.additionalServiceList,
            quote.step6Selections,
            quote.services
        ];
        listSources.forEach(function (source) {
            if (Array.isArray(source)) {
                source.forEach(append);
                return;
            }
            if (source && typeof source === 'object') {
                Object.keys(source).forEach(function (key) {
                    const value = source[key];
                    if (value === true || String(value || '').toLowerCase() === 'yes') {
                        append(String(key || '').replace(/[_-]+/g, ' '));
                    } else {
                        append(value);
                    }
                });
                return;
            }
            append(source);
        });
        return Array.from(new Set(labels.map(function (entry) { return entry.toLowerCase(); }))).map(function (key) {
            return labels.find(function (entry) { return entry.toLowerCase() === key; }) || key;
        });
    }

    function renderRoomSortedInventory(quote, overviewInventory) {
        const entries = collectInventoryEntries(quote);

        const buildFloorRoomMap = function (sourceEntries, floorField) {
            const floorMap = new Map();

            sourceEntries.forEach(function (entry) {
                const rawFloor = entry && entry[floorField];
                if (floorField === 'deliveryFloor' && !String(rawFloor || '').trim()) {
                    return;
                }
                const floorName = firstText(rawFloor, floorField === 'deliveryFloor' ? 'Not provided' : 'Not provided');
                const roomName = firstText(entry && entry.room, 'General');
                const itemName = formatItemLabel(entry && entry.item);
                if (!itemName) return;

                const qtyValue = parseInt(entry && entry.qty, 10);
                const qty = Number.isFinite(qtyValue) && qtyValue > 0 ? qtyValue : 1;

                if (!floorMap.has(floorName)) {
                    floorMap.set(floorName, new Map());
                }

                const roomMap = floorMap.get(floorName);
                if (!roomMap.has(roomName)) {
                    roomMap.set(roomName, new Map());
                }

                const itemMap = roomMap.get(roomName);
                itemMap.set(itemName, (itemMap.get(itemName) || 0) + qty);
            });

            return floorMap;
        };

        const buildFloorRoomMapFromOverview = function (floorMapObject) {
            const floorMap = new Map();
            if (!floorMapObject || typeof floorMapObject !== 'object') return floorMap;

            Object.keys(floorMapObject).forEach(function (floorName) {
                const items = floorMapObject[floorName];
                if (!items || typeof items !== 'object') return;

                const roomMap = new Map();
                const itemMap = new Map();

                Object.keys(items).forEach(function (itemName) {
                    const qty = parseInt(items[itemName], 10) || 0;
                    if (qty <= 0) return;
                    itemMap.set(formatItemLabel(itemName), qty);
                });

                if (!itemMap.size) return;
                roomMap.set('General', itemMap);
                floorMap.set(firstText(floorName, 'Not provided'), roomMap);
            });

            return floorMap;
        };

        const pickupMap = overviewInventory && overviewInventory.pickup
            ? buildFloorRoomMapFromOverview(overviewInventory.pickup)
            : buildFloorRoomMap(entries, 'pickupFloor');
        const deliveryMap = overviewInventory && overviewInventory.delivery
            ? buildFloorRoomMapFromOverview(overviewInventory.delivery)
            : buildFloorRoomMap(entries, 'deliveryFloor');
        const storageMap = overviewInventory && overviewInventory.storage
            ? buildFloorRoomMapFromOverview(overviewInventory.storage)
            : buildFloorRoomMapFromOverview(collectStorageInventoryMap(quote));

        if (!pickupMap.size && !deliveryMap.size && !storageMap.size) {
            return '<div class="empty-inventory">No items specified for this listing.</div>';
        }

        const renderColumn = function (floorMap, emptyText) {
            const floorNames = getOrderedFloorNames(Array.from(floorMap.keys()));
            if (!floorNames.length) {
                return '<div class="empty-inventory">' + escapeHtml(emptyText) + '</div>';
            }

            return floorNames.map(function (floorName) {
                const roomMap = floorMap.get(floorName) || new Map();
                const roomNames = Array.from(roomMap.keys()).sort(function (a, b) {
                    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
                });

                const roomBlocks = roomNames.map(function (roomName) {
                    const itemMap = roomMap.get(roomName) || new Map();
                    const itemNames = Array.from(itemMap.keys()).sort(function (a, b) {
                        return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' });
                    });

                    const rows = itemNames.map(function (itemName) {
                        const qty = parseInt(itemMap.get(itemName), 10) || 0;
                        return '<li><span class="inventory-overview-item-name">' + escapeHtml(itemName) + '</span>' +
                            '<span class="inventory-overview-item-meta">x' + escapeHtml(String(qty)) + '</span></li>';
                    }).join('');

                    return '<section class="inventory-overview-room-block">' +
                        '<h5 class="inventory-overview-room-title">' + escapeHtml(roomName) + '</h5>' +
                        '<ul class="inventory-overview-floor-items">' + rows + '</ul>' +
                    '</section>';
                }).join('');

                return '<div class="inventory-overview-floor-block">' +
                    '<div class="inventory-overview-floor-title">' + escapeHtml(floorName) + ' Floor</div>' +
                    roomBlocks +
                '</div>';
            }).join('');
        };

        const gridClass = storageMap.size
            ? 'inventory-overview-grid inventory-overview-grid-compact inventory-overview-grid-has-storage'
            : 'inventory-overview-grid inventory-overview-grid-compact';

        return '<div class="' + gridClass + '">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Pickup Floor Inventory</h4>' +
                renderColumn(pickupMap, 'No pickup inventory selected yet.') +
            '</section>' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Delivery Floor Inventory</h4>' +
                renderColumn(deliveryMap, 'No delivery floor assignments yet.') +
            '</section>' +
            (storageMap.size
                ? '<section class="inventory-overview-column">' +
                    '<h4 class="inventory-overview-column-title">Storage Inventory</h4>' +
                    renderColumn(storageMap, 'No items selected for storage.') +
                '</section>'
                : '') +
        '</div>';
    }

    function renderServicesMarkup(inventoryData, services, filteredTypes) {
        const emptyTaggedMessage = '<div class="empty-inventory">No items with services selected for this listing.</div>';

        if (!inventoryData || !inventoryData.pickup || !Object.keys(inventoryData.pickup).length) {
            return emptyTaggedMessage;
        }

        const floorNames = getOrderedFloorNames(Object.keys(inventoryData.pickup || {}));
        if (!floorNames.length) {
            return '<div class="empty-inventory">No pickup inventory available for services.</div>';
        }

        const quantityContext = {
            remainingPackingQtyByItem: new Map(services.packingQtyByItem || [])
        };

        const isFiltered = filteredTypes && filteredTypes.size > 0;

        const badgeTypes = new Set();

        const floorBlocks = floorNames.map(function (floorName) {
            const floorItems = Object.entries(inventoryData.pickup[floorName] || {})
                .filter(function (entry) { return (parseInt(entry[1], 10) || 0) > 0; })
                .sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' }); });

            const rows = floorItems.map(function (entry) {
                const rawItemName = String(entry[0] || '').trim();
                const itemLabel = formatItemLabel(rawItemName);
                const qty = parseInt(entry[1], 10) || 0;
                const badges = getItemServiceBadges(floorName, itemLabel, qty, services, quantityContext, rawItemName);

                if (!badges.length) {
                    return '';
                }

                badges.forEach(function (badge) {
                    if (badge && badge.type) badgeTypes.add(badge.type);
                });

                if (isFiltered) {
                    const hasFilteredBadge = badges.some(function (badge) {
                        return filteredTypes.has(badge.type);
                    });
                    if (!hasFilteredBadge) return '';
                }

                const tagsHtml = badges.length
                    ? '<div class="services-item-tags">' + badges.map(renderServiceBadge).join('') + '</div>'
                    : '';

                return '<li class="services-item-row">' +
                    '<div class="services-item-main">' +
                        '<span class="services-item-name">' + escapeHtml(itemLabel) + '</span>' +
                        '<span class="services-item-qty">x' + escapeHtml(String(qty)) + '</span>' +
                    '</div>' +
                    tagsHtml +
                '</li>';
            }).filter(function (rowHtml) { return rowHtml; }).join('');

            if (!rows) return '';

            return '<section class="services-floor-block">' +
                '<h4 class="services-floor-title">' + escapeHtml(floorName) + ' Floor</h4>' +
                '<ul class="services-item-list">' + rows + '</ul>' +
            '</section>';
        }).join('');

        if (!floorBlocks) {
            return emptyTaggedMessage;
        }

        const legendTypes = Array.from(badgeTypes);
        const legend = legendTypes.length
            ? '<div class="services-legend">' + legendTypes.map(function (type) { return renderServiceBadgeFilter(type, filteredTypes); }).join('') + '</div>'
            : '';

        let packingMetaHtml = '';
        if (services && services.isPartialPacking && badgeTypes.has('packing')) {
            const provider = String(services.packingBoxProvider || '').trim();
            if (provider) {
                packingMetaHtml = '<p class="services-packing-meta">Partial packing · Materials: ' +
                    escapeHtml(formatVehicleDetailValue(provider)) + '</p>';
            } else {
                packingMetaHtml = '<p class="services-packing-meta">Partial packing selected</p>';
            }
        }

        return '<div class="services-modal-wrap">' + legend + packingMetaHtml + floorBlocks + '</div>';
    }

    function renderServiceBadgeFilter(badgeType, filteredTypes) {
        const configValue = { type: String(badgeType || '') };
        const type = String(configValue.type || '').trim();

        const map = {
            packing: { icon: '📦', label: 'Pack' },
            disassemble: { icon: '🛠', label: 'Disassemble' },
            assemble: { icon: '🔩', label: 'Assemble' },
            both: { icon: '🔁', label: 'Disassemble + Assemble' },
            storage: { icon: '🗄', label: 'Storage' }
        };

        const config = map[type];
        if (!config) return '';

        const isActive = filteredTypes && filteredTypes.has(type);
        const activeClass = isActive ? ' service-badge-active' : '';

        return '<button type="button" class="service-badge service-badge-filter service-badge-' + escapeAttribute(type) + activeClass + '" data-service-type="' + escapeAttribute(type) + '" aria-pressed="' + (isActive ? 'true' : 'false') + '">' +
            '<span class="service-badge-icon" aria-hidden="true">' + escapeHtml(config.icon) + '</span>' +
            '<span class="service-badge-text">' + escapeHtml(config.label) + '</span>' +
        '</button>';
    }

    function getItemServiceBadges(floorName, itemLabel, itemQty, services, quantityContext, rawItemName) {
        const qty = Math.max(0, parseInt(itemQty, 10) || 0);

        const normalizedFloor = normalizeServiceFloorName(floorName);
        const normalizedItem = normalizeServiceItemName(rawItemName || itemLabel);
        const floorKey = normalizedFloor + '||' + normalizedItem;

        const packingSelectedQty = resolvePackingSelectedQty(
            rawItemName || itemLabel,
            itemLabel,
            qty,
            services,
            quantityContext
        );
        const disassemblySelectedQty = getSelectedQtyFromMap(services.disassemblyQtyByFloorItem, floorKey);
        const assembleSelectedQty = getSelectedQtyFromMap(services.assembleQtyByFloorItem, floorKey);
        const storageSelectedQty = getSelectedQtyFromMap(services.storageQtyByFloorItem, floorKey);

        const badges = [];
        if (packingSelectedQty > 0) {
            badges.push(buildServiceBadgeDescriptor('packing', packingSelectedQty, qty));
        }

        if (disassemblySelectedQty > 0 && assembleSelectedQty > 0) {
            const bothSelectedQty = Math.min(disassemblySelectedQty, assembleSelectedQty);
            if (bothSelectedQty > 0) {
                badges.push(buildServiceBadgeDescriptor('both', bothSelectedQty, qty));
            }

            const disassemblyOnlyQty = Math.max(0, disassemblySelectedQty - bothSelectedQty);
            const assembleOnlyQty = Math.max(0, assembleSelectedQty - bothSelectedQty);

            if (disassemblyOnlyQty > 0) {
                badges.push(buildServiceBadgeDescriptor('disassemble', disassemblyOnlyQty, qty));
            }
            if (assembleOnlyQty > 0) {
                badges.push(buildServiceBadgeDescriptor('assemble', assembleOnlyQty, qty));
            }
        } else {
            if (disassemblySelectedQty > 0) {
                badges.push(buildServiceBadgeDescriptor('disassemble', disassemblySelectedQty, qty));
            }
            if (assembleSelectedQty > 0) {
                badges.push(buildServiceBadgeDescriptor('assemble', assembleSelectedQty, qty));
            }
        }

        if (storageSelectedQty > 0) {
            badges.push(buildServiceBadgeDescriptor('storage', storageSelectedQty, qty));
        }

        return badges;
    }

    function createPackingQtyMap(selectionMap) {
        const output = new Map();
        Object.entries(selectionMap || {}).forEach(function (entry) {
            const itemName = normalizeServiceItemName(entry[0]);
            const qty = Math.max(0, parseInt(entry[1], 10) || 0);
            if (!itemName || qty <= 0) return;
            output.set(itemName, (output.get(itemName) || 0) + qty);
        });
        return output;
    }

    function createFloorItemQtyMap(selectionMap) {
        const output = new Map();
        Object.entries(selectionMap || {}).forEach(function (entry) {
            const parsed = parseFloorItemKey(entry[0]);
            const qty = Math.max(0, parseInt(entry[1], 10) || 0);
            if (!parsed || qty <= 0) return;
            const floorKey = parsed.floor + '||' + parsed.itemName;
            output.set(floorKey, (output.get(floorKey) || 0) + qty);
        });
        return output;
    }

    function consumeQuantityAllocation(qtyMap, key, maxQty) {
        if (!qtyMap || typeof qtyMap.get !== 'function' || !key) return 0;
        const available = Math.max(0, parseInt(qtyMap.get(key), 10) || 0);
        if (available <= 0) return 0;
        const requested = Math.max(0, parseInt(maxQty, 10) || 0);
        const used = Math.min(available, requested);
        qtyMap.set(key, Math.max(0, available - used));
        return used;
    }

    function getSelectedQtyFromMap(qtyMap, key) {
        if (!qtyMap || typeof qtyMap.get !== 'function' || !key) return 0;
        return Math.max(0, parseInt(qtyMap.get(key), 10) || 0);
    }

    function buildServiceBadgeDescriptor(type, selectedQty, totalQty) {
        const selected = Math.max(0, parseInt(selectedQty, 10) || 0);
        const total = Math.max(0, parseInt(totalQty, 10) || 0);
        return {
            type: type,
            selectedQty: selected,
            totalQty: total,
            isPartial: total > 0 ? selected < total : false
        };
    }

    function parseServiceSelectionMap(raw) {
        if (!raw) return {};
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
            return parsed;
        } catch (_error) {
            return {};
        }
    }

    function parseFloorItemKey(key) {
        const parts = String(key || '').split('||');
        if (parts.length < 2) return null;
        const floor = normalizeServiceFloorName(parts[0]);
        const itemName = normalizeServiceItemName(parts.slice(1).join('||'));
        if (!floor || !itemName) return null;
        return { floor: floor, itemName: itemName };
    }

    function normalizeServiceFloorName(value) {
        return String(value || '').trim().toLowerCase();
    }

    function normalizeServiceItemName(value) {
        const raw = String(value || '').trim();
        const roomPrefixMatch = raw.match(/^([a-z\s]+)\s*-\s*(.+)$/i);
        const knownPrefixes = new Set([
            'hallway', 'shed', 'utility', 'living', 'dining', 'kitchen', 'office', 'bedrooms', 'bathrooms', 'garden', 'boxes'
        ]);

        let base = raw;
        if (roomPrefixMatch) {
            const prefix = String(roomPrefixMatch[1] || '').trim().toLowerCase();
            if (knownPrefixes.has(prefix)) {
                base = String(roomPrefixMatch[2] || '').trim();
            }
        }

        return base
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .toLowerCase();
    }

    function getPianoNumberFromLabel(value) {
        const match = String(value || '').match(/piano\s*(\d+)\s*:/i);
        return match ? parseInt(match[1], 10) : null;
    }

    function resolvePackingSelectedQty(rawItemName, itemLabel, itemQty, services, quantityContext) {
        const qty = Math.max(0, parseInt(itemQty, 10) || 0);
        if (!services || services.isPackingAll) {
            return qty;
        }

        const map = quantityContext && quantityContext.remainingPackingQtyByItem;
        if (!map || typeof map.get !== 'function') {
            return 0;
        }

        const candidateKeys = [];
        [rawItemName, itemLabel].forEach(function (value) {
            const normalized = normalizeServiceItemName(value);
            if (normalized && candidateKeys.indexOf(normalized) === -1) {
                candidateKeys.push(normalized);
            }
        });

        for (let i = 0; i < candidateKeys.length; i++) {
            const used = consumeQuantityAllocation(map, candidateKeys[i], qty);
            if (used > 0) {
                return used;
            }
        }

        const pianoNum = getPianoNumberFromLabel(rawItemName || itemLabel);
        if (!pianoNum) {
            return 0;
        }

        const prefix = 'piano ' + pianoNum + ':';
        const fuzzyKeys = Array.from(map.keys()).filter(function (key) {
            return String(key || '').startsWith(prefix) && (parseInt(map.get(key), 10) || 0) > 0;
        });

        for (let j = 0; j < fuzzyKeys.length; j++) {
            const used = consumeQuantityAllocation(map, fuzzyKeys[j], qty);
            if (used > 0) {
                return used;
            }
        }

        return 0;
    }

    function renderServiceBadge(badge) {
        const configValue = (typeof badge === 'string' || !badge)
            ? { type: String(badge || '') }
            : badge;
        const type = String(configValue.type || '').trim();

        const map = {
            packing: { icon: '📦', label: 'Pack' },
            disassemble: { icon: '🛠', label: 'Disassemble' },
            assemble: { icon: '🔩', label: 'Assemble' },
            both: { icon: '🔁', label: 'Disassemble + Assemble' },
            storage: { icon: '🗄', label: 'Storage' }
        };

        const config = map[type];
        if (!config) return '';

        const selectedQty = Math.max(0, parseInt(configValue.selectedQty, 10) || 0);
        const totalQty = Math.max(0, parseInt(configValue.totalQty, 10) || 0);
        const isPartial = !!configValue.isPartial;
        const suffix = (isPartial && totalQty > 0)
            ? ' (' + selectedQty + '/' + totalQty + ')'
            : '';

        return '<span class="service-badge service-badge-' + escapeAttribute(type) + (isPartial ? ' service-badge-partial' : '') + '">' +
            '<span class="service-badge-icon" aria-hidden="true">' + escapeHtml(config.icon) + '</span>' +
            '<span class="service-badge-text">' + escapeHtml(config.label + suffix) + '</span>' +
        '</span>';
    }

    function collectMediaEntries(quote) {
        const entries = [];
        const floorMedia = firstObject(quote.floorMediaItems, quote.floor_media_items);

        if (floorMedia && typeof floorMedia === 'object') {
            Object.keys(floorMedia).forEach(function (floorName) {
                const floorEntries = floorMedia[floorName];
                if (!Array.isArray(floorEntries)) return;

                floorEntries.forEach(function (entry) {
                    if (!entry || typeof entry !== 'object') return;
                    const mediaType = String(entry.mediaType || '').toLowerCase() === 'video' ? 'video' : 'photo';
                    const previewSrc = firstText(entry.previewDataUrl, entry.previewUrl, entry.mediaUrl, entry.dataUrl, '');
                    entries.push({
                        floor: floorName,
                        mediaType: mediaType,
                        previewSrc: previewSrc,
                        fileName: firstText(entry.fileName, entry.name, 'Attachment'),
                        note: firstText(entry.note, entry.notes, entry.itemName, ''),
                        itemName: firstText(entry.itemName, '')
                    });
                });
            });
        }

        const globalAttachments = Array.isArray(quote.mediaAttachments) ? quote.mediaAttachments : [];
        globalAttachments.forEach(function (entry) {
            if (!entry || typeof entry !== 'object') return;
            entries.push({
                floor: 'General',
                mediaType: String(entry.mediaType || '').toLowerCase() === 'video' ? 'video' : 'photo',
                previewSrc: firstText(entry.previewDataUrl, entry.previewUrl, entry.mediaUrl, entry.dataUrl, ''),
                fileName: firstText(entry.fileName, entry.name, 'Attachment'),
                note: firstText(entry.note, entry.notes, ''),
                itemName: ''
            });
        });

        const vehiclePayload = collectVehiclesFromQuote(quote);
        vehiclePayload.vehicles.forEach(function (vehicle, index) {
            const vehicleLabel = firstText(vehicle && vehicle.makeModel, vehiclePayload.baseLabel + ' ' + (index + 1));
            const mediaItems = Array.isArray(vehicle && vehicle.media) ? vehicle.media : [];
            mediaItems.forEach(function (item) {
                if (!item || typeof item !== 'object') return;
                const previewSrc = firstText(item.previewDataUrl, item.previewUrl, item.mediaUrl, item.dataUrl, '');
                if (!previewSrc) return;
                const mimeType = String(item.type || item.mimeType || '').toLowerCase();
                const mediaType = mimeType.startsWith('video') || String(item.mediaType || '').toLowerCase() === 'video'
                    ? 'video'
                    : 'photo';
                entries.push({
                    floor: vehicleLabel,
                    mediaType: mediaType,
                    previewSrc: previewSrc,
                    fileName: firstText(item.fileName, item.name, 'Attachment'),
                    note: firstText(item.note, item.notes, ''),
                    itemName: vehicleLabel
                });
            });
        });

        const industrialDetails = parseIndustrialFromQuote(quote);
        const industrialMedia = Array.isArray(industrialDetails && industrialDetails.media) ? industrialDetails.media : [];
        industrialMedia.forEach(function (item) {
            if (!item || typeof item !== 'object') return;
            const previewSrc = firstText(item.previewDataUrl, item.previewUrl, item.mediaUrl, item.dataUrl, '');
            if (!previewSrc) return;
            const mimeType = String(item.type || item.mimeType || '').toLowerCase();
            const mediaType = mimeType.startsWith('video') || String(item.mediaType || '').toLowerCase() === 'video'
                ? 'video'
                : 'photo';
            entries.push({
                floor: 'Industrial item 1',
                mediaType: mediaType,
                previewSrc: previewSrc,
                fileName: firstText(item.fileName, item.name, 'Attachment'),
                note: firstText(item.note, item.notes, industrialDetails && industrialDetails.description, ''),
                itemName: 'Industrial item 1'
            });
        });

        const manpowerDetails = parseManpowerFromQuote(quote);
        const manpowerMedia = Array.isArray(manpowerDetails && manpowerDetails.media) ? manpowerDetails.media : [];
        manpowerMedia.forEach(function (item) {
            if (!item || typeof item !== 'object') return;
            const previewSrc = firstText(item.previewDataUrl, item.previewUrl, item.mediaUrl, item.dataUrl, '');
            if (!previewSrc) return;
            const mimeType = String(item.type || item.mimeType || '').toLowerCase();
            const mediaType = mimeType.startsWith('video') || String(item.mediaType || '').toLowerCase() === 'video'
                ? 'video'
                : 'photo';
            entries.push({
                floor: 'Job 1',
                mediaType: mediaType,
                previewSrc: previewSrc,
                fileName: firstText(item.fileName, item.name, 'Attachment'),
                note: firstText(item.note, item.notes, manpowerDetails && manpowerDetails.description, ''),
                itemName: 'Job 1'
            });
        });

        parsePetsFromQuote(quote).forEach(function (pet, index) {
            const petLabel = getPetDisplayTitle(pet, index);
            const petMedia = Array.isArray(pet && pet.media) ? pet.media : [];
            petMedia.forEach(function (item) {
                if (!item || typeof item !== 'object') return;
                const previewSrc = firstText(item.previewDataUrl, item.previewUrl, item.mediaUrl, item.dataUrl, '');
                if (!previewSrc) return;
                const mimeType = String(item.type || item.mimeType || '').toLowerCase();
                const mediaType = mimeType.startsWith('video') || String(item.mediaType || '').toLowerCase() === 'video'
                    ? 'video'
                    : 'photo';
                entries.push({
                    floor: petLabel,
                    mediaType: mediaType,
                    previewSrc: previewSrc,
                    fileName: firstText(item.fileName, item.name, 'Attachment'),
                    note: firstText(item.note, item.notes, pet && pet.otherName, ''),
                    itemName: petLabel
                });
            });
        });

        return entries;
    }

    function parseStorageItemSelectionKey(key) {
        const parts = String(key || '').split('||');
        if (parts.length < 2) return null;
        const floor = String(parts[0] || '').trim();
        const itemName = formatItemLabel(parts.slice(1).join('||'));
        if (!floor || !itemName) return null;
        return { floor: floor, itemName: itemName };
    }

    function collectStorageInventoryMap(quote) {
        const storageMap = {};
        const storageEnabled = String(
            firstText(quote.serviceStorage, quote.service_storage, quote.storage)
        ).trim().toLowerCase() === 'yes';
        if (!storageEnabled) return storageMap;

        const selections = parseServiceSelectionMap(
            firstText(quote.serviceStorageItems, quote.service_storage_items)
        );

        Object.entries(selections).forEach(function (entry) {
            const parsed = parseStorageItemSelectionKey(entry[0]);
            const qty = Math.max(0, parseInt(entry[1], 10) || 0);
            if (!parsed || qty <= 0) return;
            const cleanFloor = firstText(parsed.floor, 'Ground').trim();
            if (!storageMap[cleanFloor]) storageMap[cleanFloor] = {};
            storageMap[cleanFloor][parsed.itemName] = (storageMap[cleanFloor][parsed.itemName] || 0) + qty;
        });

        return storageMap;
    }

    function collectOverviewStyleInventory(quote) {
        const pickupMap = {};
        const deliveryMap = {};

        const addToFloorMap = function (target, floor, itemName, qty) {
            const cleanFloor = firstText(floor, 'Ground').trim();
            const cleanItem = formatItemLabel(itemName);
            const cleanQty = parseInt(qty, 10) || 0;
            if (!cleanItem || cleanQty <= 0) return;
            if (!target[cleanFloor]) target[cleanFloor] = {};
            target[cleanFloor][cleanItem] = (target[cleanFloor][cleanItem] || 0) + cleanQty;
        };

        const mergeMultiFloorIntoPickup = function (source) {
            if (!source || typeof source !== 'object') return;
            Object.keys(source).forEach(function (floorName) {
                const floorItems = source[floorName];
                if (!floorItems || typeof floorItems !== 'object') return;
                Object.keys(floorItems).forEach(function (itemName) {
                    addToFloorMap(pickupMap, floorName, normalizeAssignmentItemKey(itemName), floorItems[itemName]);
                });
            });
        };

        mergeMultiFloorIntoPickup(firstObject(quote.multiFloorInventory, quote.multi_floor_inventory, quote.floorInventory));
        if (!Object.keys(pickupMap).length && quote.houseInventory && typeof quote.houseInventory === 'object') {
            mergeMultiFloorIntoPickup(quote.houseInventory.multiFloorInventory);
        }

        if (!Object.keys(pickupMap).length) {
            const pickupFloorFallback = firstText(quote.pickupFloorSelect, quote.pickupFloor, 'Ground');
            const flatQuantities = firstNonEmptyObject(
                quote.houseInventory && quote.houseInventory.itemQuantities,
                quote.itemQuantities
            );
            collectFlatInventoryItems(flatQuantities, function (item, qty) {
                addToFloorMap(pickupMap, pickupFloorFallback, item, qty);
            });
        }

        const assignments = firstObject(
            quote.itemFloorAssignments,
            quote.deliveryItemFloorAssignments,
            quote.deliveryFloorAssignments,
            quote.floorAssignments
        );

        if (assignments && typeof assignments === 'object') {
            Object.keys(assignments).forEach(function (itemKey) {
                const keyParts = getAssignmentKeyParts(itemKey);
                const baseName = keyParts.itemName;
                const perFloor = assignments[itemKey];
                if (!perFloor || typeof perFloor !== 'object' || !baseName) return;

                Object.keys(perFloor).forEach(function (deliveryFloor) {
                    addToFloorMap(deliveryMap, deliveryFloor, baseName, perFloor[deliveryFloor]);
                });
            });
        }

        populatePickupInventoryFallback(quote, pickupMap, deliveryMap, addToFloorMap);

        if (!Object.keys(pickupMap).length && isPianoTransportListing(quote)) {
            const pianoInventory = collectPianoServiceInventory(quote);
            if (pianoInventory && pianoInventory.pickup) {
                Object.keys(pianoInventory.pickup).forEach(function (floorName) {
                    const floorItems = pianoInventory.pickup[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                    });
                });
            }
        }

        if (!Object.keys(pickupMap).length && isFreightTransportListing(quote)) {
            const freightInventory = collectFreightServiceInventory(quote);
            if (freightInventory && freightInventory.pickup) {
                Object.keys(freightInventory.pickup).forEach(function (floorName) {
                    const floorItems = freightInventory.pickup[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                    });
                });
            }
        }

        if (!Object.keys(pickupMap).length && isClearanceTransportListing(quote)) {
            const clearanceInventory = collectClearanceServiceInventory(quote);
            if (clearanceInventory && clearanceInventory.pickup) {
                Object.keys(clearanceInventory.pickup).forEach(function (floorName) {
                    const floorItems = clearanceInventory.pickup[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                    });
                });
            }
        }

        if (!Object.keys(pickupMap).length && isIndustrialTransportListing(quote)) {
            const industrialInventory = collectIndustrialServiceInventory(quote);
            if (industrialInventory && industrialInventory.pickup) {
                Object.keys(industrialInventory.pickup).forEach(function (floorName) {
                    const floorItems = industrialInventory.pickup[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                    });
                });
            }
        }

        if (!Object.keys(pickupMap).length && isManPowerTransportListing(quote)) {
            const manpowerInventory = collectManpowerServiceInventory(quote);
            if (manpowerInventory && manpowerInventory.pickup) {
                Object.keys(manpowerInventory.pickup).forEach(function (floorName) {
                    const floorItems = manpowerInventory.pickup[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                    });
                });
            }
        }

        if (!Object.keys(pickupMap).length && isPetsTransportListing(quote)) {
            const petsInventory = collectPetsServiceInventory(quote);
            if (petsInventory && petsInventory.pickup) {
                Object.keys(petsInventory.pickup).forEach(function (floorName) {
                    const floorItems = petsInventory.pickup[floorName];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemName) {
                        addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                    });
                });
            }
        }

        const storageMap = collectStorageInventoryMap(quote);
        const hasPickup = Object.keys(pickupMap).length > 0;
        const hasDelivery = Object.keys(deliveryMap).length > 0;
        const hasStorage = Object.keys(storageMap).length > 0;
        if (!hasPickup && !hasDelivery && !hasStorage) return null;

        return {
            pickup: pickupMap,
            delivery: deliveryMap,
            storage: storageMap
        };
    }

    function renderOverviewStyleInventory(inventoryData) {
        const renderFloorBlocks = function (floorMap, emptyText) {
            const floorNames = getOrderedFloorNames(Object.keys(floorMap || {}));
            if (!floorNames.length) {
                return '<div class="empty-inventory">' + escapeHtml(emptyText) + '</div>';
            }

            return floorNames.map(function (floorName) {
                const items = Object.entries(floorMap[floorName] || {})
                    .filter(function (entry) { return (parseInt(entry[1], 10) || 0) > 0; })
                    .sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' }); });

                const rows = items.length
                    ? items.map(function (entry) {
                        const itemName = formatItemLabel(entry[0]);
                        const quantity = parseInt(entry[1], 10) || 0;
                        const volumeText = formatItemVolumeSummary(itemName, quantity);
                        return '<li><span class="inventory-overview-item-name">' + escapeHtml(itemName) + '</span>' +
                            '<span class="inventory-overview-item-meta">x' + escapeHtml(String(quantity)) + ' · ' + escapeHtml(volumeText) + '</span></li>';
                    }).join('')
                    : '<li>No items</li>';

                return '<div class="inventory-overview-floor-block">' +
                    '<div class="inventory-overview-floor-title">' + escapeHtml(floorName) + ' Floor</div>' +
                    '<ul class="inventory-overview-floor-items">' + rows + '</ul>' +
                    '</div>';
            }).join('');
        };

        const hasStorage = inventoryData.storage && Object.keys(inventoryData.storage).length > 0;
        const gridClass = hasStorage
            ? 'inventory-overview-grid inventory-overview-grid-has-storage'
            : 'inventory-overview-grid';

        return '<div class="' + gridClass + '">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Pickup Floor Inventory</h4>' +
                renderFloorBlocks(inventoryData.pickup, 'No pickup inventory selected yet.') +
            '</section>' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Delivery Floor Inventory</h4>' +
                renderFloorBlocks(inventoryData.delivery, 'No delivery floor assignments yet.') +
            '</section>' +
            (hasStorage
                ? '<section class="inventory-overview-column">' +
                    '<h4 class="inventory-overview-column-title">Storage Inventory</h4>' +
                    renderFloorBlocks(inventoryData.storage, 'No items selected for storage.') +
                '</section>'
                : '') +
        '</div>';
    }

    function getOrderedFloorNames(floorNames) {
        return (Array.isArray(floorNames) ? floorNames : [])
            .filter(Boolean)
            .sort(compareFloorLabels);
    }

    function enableInventoryWindowDrag(dialogEl, dragHandleEl) {
        if (!dialogEl || !dragHandleEl || dialogEl.dataset.dragEnabled === 'true') return;
        dialogEl.dataset.dragEnabled = 'true';

        let isDragging = false;
        let pointerOffsetX = 0;
        let pointerOffsetY = 0;

        dragHandleEl.addEventListener('mousedown', function (event) {
            if (event.target.closest('button')) return;
            isDragging = true;
            const rect = dialogEl.getBoundingClientRect();
            pointerOffsetX = event.clientX - rect.left;
            pointerOffsetY = event.clientY - rect.top;
            dialogEl.classList.add('is-dragging');
            event.preventDefault();
        });

        document.addEventListener('mousemove', function (event) {
            if (!isDragging) return;

            const margin = 8;
            const rect = dialogEl.getBoundingClientRect();
            const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
            const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
            const nextLeft = Math.min(Math.max(margin, event.clientX - pointerOffsetX), maxLeft);
            const nextTop = Math.min(Math.max(margin, event.clientY - pointerOffsetY), maxTop);

            dialogEl.style.left = String(nextLeft) + 'px';
            dialogEl.style.top = String(nextTop) + 'px';
            dialogEl.dataset.userPositioned = 'true';
        });

        document.addEventListener('mouseup', function () {
            if (!isDragging) return;
            isDragging = false;
            dialogEl.classList.remove('is-dragging');
        });
    }

    function enableInventoryWindowCornerResize(dialogEl) {
        if (!dialogEl || dialogEl.dataset.cornerResizeEnabled === 'true') return;
        dialogEl.dataset.cornerResizeEnabled = 'true';

        const handles = dialogEl.querySelectorAll('.inventory-resize-handle[data-corner]');
        if (!handles.length) return;

        const state = {
            active: false,
            corner: '',
            startX: 0,
            startY: 0,
            startLeft: 0,
            startTop: 0,
            startWidth: 0,
            startHeight: 0
        };

        handles.forEach(function (handle) {
            handle.addEventListener('mousedown', function (event) {
                const corner = handle.getAttribute('data-corner');
                if (!corner) return;
                const rect = dialogEl.getBoundingClientRect();
                state.active = true;
                state.corner = corner;
                state.startX = event.clientX;
                state.startY = event.clientY;
                state.startLeft = rect.left;
                state.startTop = rect.top;
                state.startWidth = rect.width;
                state.startHeight = rect.height;
                event.preventDefault();
            });
        });

        document.addEventListener('mousemove', function (event) {
            if (!state.active) return;

            const dx = event.clientX - state.startX;
            const dy = event.clientY - state.startY;
            const minWidth = 320;
            const minHeight = 280;
            const margin = 8;
            let nextLeft = state.startLeft;
            let nextTop = state.startTop;
            let nextWidth = state.startWidth;
            let nextHeight = state.startHeight;

            if (state.corner.indexOf('e') !== -1) {
                nextWidth = state.startWidth + dx;
            }
            if (state.corner.indexOf('s') !== -1) {
                nextHeight = state.startHeight + dy;
            }
            if (state.corner.indexOf('w') !== -1) {
                nextWidth = state.startWidth - dx;
                nextLeft = state.startLeft + dx;
            }
            if (state.corner.indexOf('n') !== -1) {
                nextHeight = state.startHeight - dy;
                nextTop = state.startTop + dy;
            }

            nextWidth = Math.max(minWidth, nextWidth);
            nextHeight = Math.max(minHeight, nextHeight);

            const maxWidth = Math.max(minWidth, window.innerWidth - margin * 2);
            const maxHeight = Math.max(minHeight, window.innerHeight - margin * 2);
            nextWidth = Math.min(maxWidth, nextWidth);
            nextHeight = Math.min(maxHeight, nextHeight);

            const maxLeft = window.innerWidth - nextWidth - margin;
            const maxTop = window.innerHeight - nextHeight - margin;
            nextLeft = Math.min(Math.max(margin, nextLeft), Math.max(margin, maxLeft));
            nextTop = Math.min(Math.max(margin, nextTop), Math.max(margin, maxTop));

            dialogEl.style.left = String(nextLeft) + 'px';
            dialogEl.style.top = String(nextTop) + 'px';
            dialogEl.style.width = String(nextWidth) + 'px';
            dialogEl.style.height = String(nextHeight) + 'px';
            dialogEl.dataset.userPositioned = 'true';
        });

        document.addEventListener('mouseup', function () {
            if (!state.active) return;
            state.active = false;
        });
    }

    function collectInventoryGroups(quote) {
        const entries = collectInventoryEntries(quote);
        if (!entries.length) return [];

        entries.sort(function (a, b) {
            const floorRankDiff = compareFloorLabels(a.pickupFloor, b.pickupFloor);
            if (floorRankDiff !== 0) return floorRankDiff;
            const roomDiff = a.room.localeCompare(b.room, undefined, { sensitivity: 'base' });
            if (roomDiff !== 0) return roomDiff;
            return a.item.localeCompare(b.item, undefined, { sensitivity: 'base' });
        });

        const floorMap = new Map();
        entries.forEach(function (entry) {
            const floorKey = entry.pickupFloor || 'Not provided';
            if (!floorMap.has(floorKey)) {
                floorMap.set(floorKey, { pickupFloor: floorKey, rooms: new Map() });
            }

            const floorBucket = floorMap.get(floorKey);
            const roomKey = entry.room || 'General';
            if (!floorBucket.rooms.has(roomKey)) {
                floorBucket.rooms.set(roomKey, { room: roomKey, items: [] });
            }

            floorBucket.rooms.get(roomKey).items.push({
                item: entry.item,
                qty: entry.qty,
                deliveryFloor: entry.deliveryFloor || 'Not provided'
            });
        });

        return Array.from(floorMap.values()).map(function (floorBucket) {
            const rooms = Array.from(floorBucket.rooms.values()).sort(function (a, b) {
                return a.room.localeCompare(b.room, undefined, { sensitivity: 'base' });
            });
            return {
                pickupFloor: floorBucket.pickupFloor,
                rooms: rooms
            };
        });
    }

    function collectInventoryEntries(quote) {
        const entries = [];

        function addEntry(room, itemName, qty, pickupFloor, deliveryFloor) {
            const cleanItem = formatItemLabel(itemName);
            if (!cleanItem) return;
            entries.push({
                room: firstText(room, 'General'),
                item: cleanItem,
                qty: Number(qty) > 0 ? Number(qty) : '',
                pickupFloor: firstText(pickupFloor, quote.pickupFloorSelect, quote.pickupFloor, 'Not provided'),
                deliveryFloor: firstText(deliveryFloor, quote.deliveryFloorSelect, quote.deliveryFloor, 'Not provided')
            });
        }

        const floorBlocks = Array.isArray(quote.floorBlocks) ? quote.floorBlocks : [];
        floorBlocks.forEach(function (block) {
            const pickupFloor = firstText(
                block && block.floor,
                block && block.pickupFloor,
                block && block.floorLabel,
                quote.pickupFloorSelect,
                quote.pickupFloor,
                quote.fromFloor
            );

            const houseInventory = block && block.houseInventory;
            if (houseInventory && typeof houseInventory === 'object') {
                const houseItems = firstNonEmptyObject(houseInventory.items, houseInventory.itemQuantities);
                collectFlatInventoryItems(houseItems, function (item, qty) {
                    addEntry('General', normalizeAssignmentItemKey(item), qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });

                collectNestedRoomItems(houseInventory.subRoomQuantities, function (room, item, qty) {
                    addEntry(room, normalizeAssignmentItemKey(item), qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });
            }

            const officeInventory = block && block.officeInventory;
            if (officeInventory && typeof officeInventory === 'object') {
                const officeItems = firstNonEmptyObject(officeInventory.items, officeInventory.itemQuantities, officeInventory.quantities);
                collectFlatInventoryItems(officeItems, function (item, qty) {
                    addEntry('Office', normalizeAssignmentItemKey(item), qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });

                collectNestedRoomItems(officeInventory.subRoomQuantities, function (room, item, qty) {
                    addEntry(room, normalizeAssignmentItemKey(item), qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });
            }
        });

        if (!entries.length) {
            const topLevelHouseInventory = firstObject(
                quote.houseInventory,
                quote.house_removal_inventory,
                quote.houseRemovalInventory
            );

            if (topLevelHouseInventory) {
                const flatHouseItems = firstNonEmptyObject(topLevelHouseInventory.items, topLevelHouseInventory.itemQuantities);
                collectFlatInventoryItems(flatHouseItems, function (item, qty) {
                    addEntry(
                        'General',
                        item,
                        qty,
                        resolvePickupFloorForItem(quote, item),
                        resolveDeliveryFloorForItem(quote, item)
                    );
                });

                collectNestedRoomItems(topLevelHouseInventory.subRoomQuantities, function (room, item, qty) {
                    addEntry(
                        room,
                        item,
                        qty,
                        resolvePickupFloorForItem(quote, item),
                        resolveDeliveryFloorForItem(quote, item)
                    );
                });

                collectCustomTextEntries(topLevelHouseInventory.customItems).forEach(function (customItem) {
                    addEntry('Custom items', customItem, '', quote.pickupFloorSelect, quote.deliveryFloorSelect);
                });

                collectCustomTextEntries(topLevelHouseInventory.extraItems).forEach(function (customItem) {
                    addEntry('Extra items', customItem, '', quote.pickupFloorSelect, quote.deliveryFloorSelect);
                });
            }
        }

        if (!entries.length) {
            const rootFlatQty = firstNonEmptyObject(
                quote.houseInventory && quote.houseInventory.itemQuantities,
                quote.itemQuantities
            );
            collectFlatInventoryItems(rootFlatQty, function (item, qty) {
                addEntry(
                    'General',
                    item,
                    qty,
                    resolvePickupFloorForItem(quote, item),
                    resolveDeliveryFloorForItem(quote, item)
                );
            });
        }

        if (!entries.length && Array.isArray(quote.items)) {
            quote.items.forEach(function (item) {
                addEntry(
                    'General',
                    item && item.name,
                    item && item.quantity,
                    resolvePickupFloorForItem(quote, item && item.name),
                    resolveDeliveryFloorForItem(quote, item && item.name)
                );
            });
        }

        collectCustomTextEntries(quote.customItems).forEach(function (customItem) {
            addEntry(
                'Custom items',
                customItem,
                '',
                quote.pickupFloorSelect,
                quote.deliveryFloorSelect
            );
        });

        if (!entries.length) {
            const multiFloorInventory = firstObject(
                quote.multiFloorInventory,
                quote.multi_floor_inventory,
                quote.houseInventory && quote.houseInventory.multiFloorInventory
            );
            if (multiFloorInventory && typeof multiFloorInventory === 'object') {
                Object.keys(multiFloorInventory).forEach(function (pickupFloor) {
                    const floorItems = multiFloorInventory[pickupFloor];
                    if (!floorItems || typeof floorItems !== 'object') return;
                    Object.keys(floorItems).forEach(function (itemKey) {
                        const qty = parseInt(floorItems[itemKey], 10) || 0;
                        if (qty <= 0) return;
                        const cleanItem = formatItemLabel(itemKey);
                        if (!cleanItem) return;
                        entries.push({
                            room: 'General',
                            item: cleanItem,
                            qty: qty,
                            pickupFloor: firstText(pickupFloor, quote.pickupFloorSelect, quote.pickupFloor, 'Ground'),
                            deliveryFloor: ''
                        });
                    });
                });
            }

            const assignments = firstObject(
                quote.itemFloorAssignments,
                quote.deliveryItemFloorAssignments,
                quote.deliveryFloorAssignments,
                quote.floorAssignments,
                quote.houseInventory && quote.houseInventory.itemFloorAssignments
            );
            if (assignments && typeof assignments === 'object') {
                Object.keys(assignments).forEach(function (assignmentKey) {
                    const keyParts = getAssignmentKeyParts(assignmentKey);
                    const itemName = keyParts.itemName;
                    if (!itemName) return;
                    const pickupFloor = firstText(
                        keyParts.sourceFloor,
                        resolvePickupFloorForItem(quote, itemName),
                        quote.pickupFloorSelect,
                        quote.pickupFloor,
                        'Ground'
                    );
                    const perFloor = assignments[assignmentKey];
                    if (!perFloor || typeof perFloor !== 'object') return;
                    Object.keys(perFloor).forEach(function (deliveryFloor) {
                        const qty = parseInt(perFloor[deliveryFloor], 10) || 0;
                        if (qty <= 0) return;
                        addEntry('General', itemName, qty, pickupFloor, deliveryFloor);
                    });
                });
            }
        }

        return entries;
    }

    function collectFlatInventoryItems(source, onItem) {
        if (!source || typeof source !== 'object') return;
        Object.keys(source).forEach(function (item) {
            const qty = Number(source[item]);
            if (Number.isFinite(qty) && qty > 0) {
                onItem(item, qty);
            }
        });
    }

    function collectNestedRoomItems(source, onItem) {
        if (!source || typeof source !== 'object') return;
        Object.keys(source).forEach(function (room) {
            const roomItems = source[room];
            if (!roomItems || typeof roomItems !== 'object') return;
            Object.keys(roomItems).forEach(function (item) {
                const qty = Number(roomItems[item]);
                if (Number.isFinite(qty) && qty > 0) {
                    onItem(room, item, qty);
                }
            });
        });
    }

    function collectCustomTextEntries(value) {
        const entries = [];
        if (typeof value === 'string' && value.trim()) {
            value
                .split(/[;,\n]+/)
                .map(function (part) { return part.trim(); })
                .filter(Boolean)
                .forEach(function (part) { entries.push(part); });
            return entries;
        }

        if (Array.isArray(value)) {
            value.forEach(function (item) {
                const label = firstText(item && item.name, item && item.description, item);
                if (label) entries.push(label);
            });
        }

        return entries;
    }

    function resolvePickupFloorForItem(quote, itemName) {
        const itemKey = String(itemName || '').trim().toLowerCase();
        const assignments = firstObject(
            quote.itemPickupFloorAssignments,
            quote.pickupItemFloorAssignments,
            quote.pickupFloorAssignments
        );
        if (assignments && itemKey) {
            if (assignments[itemKey]) {
                return firstText(assignments[itemKey]);
            }
            const matchKey = Object.keys(assignments).find(function (key) {
                return normalizeAssignmentItemKey(key).toLowerCase() === itemKey;
            });
            if (matchKey) {
                return firstText(assignments[matchKey]);
            }
        }
        return firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor);
    }

    function resolveDeliveryFloorForItem(quote, itemName) {
        const itemKey = String(itemName || '').trim().toLowerCase();
        const assignments = firstObject(
            quote.itemFloorAssignments,
            quote.deliveryItemFloorAssignments,
            quote.deliveryFloorAssignments,
            quote.floorAssignments
        );
        if (assignments && itemKey) {
            let assignment = assignments[itemKey];
            if (!assignment) {
                const matchKey = Object.keys(assignments).find(function (key) {
                    return normalizeAssignmentItemKey(key).toLowerCase() === itemKey;
                });
                if (matchKey) assignment = assignments[matchKey];
            }
            if (assignment) {
                if (assignment && typeof assignment === 'object') {
                    const firstFloor = Object.keys(assignment).find(function (floorKey) {
                        return Number(assignment[floorKey]) > 0;
                    });
                    if (firstFloor) return firstFloor;
                }
                return firstText(assignment);
            }
        }
        return firstText(quote.deliveryFloorSelect, quote.deliveryFloor, quote.dropoffFloor);
    }

    function firstObject() {
        for (let i = 0; i < arguments.length; i += 1) {
            const candidate = arguments[i];
            if (candidate && typeof candidate === 'object') return candidate;
        }
        return null;
    }

    /** Prefer plain objects that have at least one own key (avoids empty {} winning over populated maps). */
    function firstNonEmptyObject() {
        for (let i = 0; i < arguments.length; i += 1) {
            const candidate = arguments[i];
            if (candidate && typeof candidate === 'object' && Object.keys(candidate).length) {
                return candidate;
            }
        }
        return firstObject.apply(null, arguments);
    }

    function formatItemLabel(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        return text
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
    }

    function compareFloorLabels(a, b) {
        const rankA = getFloorRank(a);
        const rankB = getFloorRank(b);
        if (rankA !== rankB) return rankA - rankB;
        return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
    }

    function getFloorRank(label) {
        const normalized = String(label || '').trim().toLowerCase();
        if (!normalized) return 999;

        if (normalized.includes('basement')) return -1;
        if (normalized.includes('lower ground')) return 0;
        if (normalized.includes('ground')) return 1;
        if (normalized.includes('first')) return 2;
        if (normalized.includes('second')) return 3;
        if (normalized.includes('third')) return 4;
        if (normalized.includes('fourth')) return 5;
        if (normalized.includes('fifth')) return 6;

        const numericMatch = normalized.match(/(\d+)/);
        if (numericMatch) return Number(numericMatch[1]) + 1;
        return 998;
    }

    function collectInventoryItems(quote) {
        const items = [];
        const seen = new Set();

        function addItem(name, qty) {
            const cleanName = String(name || '').trim();
            if (!cleanName) return;
            const key = cleanName.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            items.push({ name: cleanName, qty: qty || '' });
        }

        if (quote.itemQuantities && typeof quote.itemQuantities === 'object') {
            Object.keys(quote.itemQuantities).forEach(function (key) {
                const qty = quote.itemQuantities[key];
                if (Number(qty) > 0) addItem(key, qty);
            });
        }

        if (Array.isArray(quote.floorBlocks)) {
            quote.floorBlocks.forEach(function (block) {
                const houseItems = block && block.houseInventory && block.houseInventory.items;
                if (houseItems && typeof houseItems === 'object') {
                    Object.keys(houseItems).forEach(function (key) {
                        const qty = houseItems[key];
                        if (Number(qty) > 0) addItem(key, qty);
                    });
                }

                const officeItems = block && block.officeInventory && block.officeInventory.items;
                if (officeItems && typeof officeItems === 'object') {
                    Object.keys(officeItems).forEach(function (key) {
                        const qty = officeItems[key];
                        if (Number(qty) > 0) addItem(key, qty);
                    });
                }
            });
        }

        if (typeof quote.customItems === 'string' && quote.customItems.trim()) {
            addItem(quote.customItems.trim(), '');
        }

        if (Array.isArray(quote.customItems)) {
            quote.customItems.forEach(function (item) {
                addItem(item && (item.name || item.description || 'Custom item'), item && item.quantity ? item.quantity : '');
            });
        }

        if (Array.isArray(quote.pianos)) {
            quote.pianos.forEach(function (piano) {
                addItem((piano && piano.type) || 'Piano', '');
            });
        }

        parsePetsFromQuote(quote).forEach(function (pet, index) {
            addItem(getPetDisplayTitle(pet, index), '');
        });

        return items;
    }

    function renderBids(quoteId, quote) {
        const historyEl = document.getElementById('bid-history');
        if (!historyEl) return;

        let allBids = [];
        if (window.anytransportApi && typeof window.anytransportApi.getBids === 'function') {
            try {
                allBids = window.anytransportApi.getBids(quoteId);
            } catch (_error) {
                allBids = [];
            }
        } else {
            try {
                const parsed = JSON.parse(localStorage.getItem(BID_STORAGE_KEY) || '[]');
                allBids = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                allBids = [];
            }
        }

        const quoteBids = allBids
            .filter(function (bid) {
                return String(bid.quoteId || '') === String(quoteId || '') && String(bid.status || 'active') === 'active';
            })
            .sort(function (a, b) {
                return Number(a.amount || 0) - Number(b.amount || 0);
            });

        const providerNameById = {};
        quoteBids.forEach(function (bid) {
            const providerId = String(bid && bid.providerId || '').trim();
            if (!providerId || providerNameById[providerId] || !window.anytransportApi || typeof window.anytransportApi.getUserById !== 'function') {
                return;
            }
            try {
                const provider = window.anytransportApi.getUserById(providerId);
                providerNameById[providerId] = firstText(provider && provider.username, provider && provider.nickname, provider && provider.name, '');
            } catch (_error) {
                providerNameById[providerId] = '';
            }
        });

        updateSidebarBidCount(quoteBids.length);

        const dateLabel = firstText(getMoveDate(quote), 'Not provided');

        if (!quoteBids.length) {
            historyEl.innerHTML = '<div class="empty-bids">No quotes yet. Be the first to quote.</div>';
            return;
        }

        historyEl.innerHTML = '<table class="legacy-bids-table legacy-bids-table-bottom"><thead><tr><th>Quoter</th><th>Amount</th><th>When</th><th>Dates</th><th>Expires</th><th>Comment</th><th></th></tr></thead><tbody>' +
            quoteBids.map(function (bid) {
                const bidder = firstText(
                    providerNameById[String(bid && bid.providerId || '').trim()],
                    bid.providerUsername,
                    bid.providerNickname,
                    bid.providerName,
                    bid.bidderName,
                    bid.username,
                    'Provider'
                );
                const when = bid.createdAt ? formatDateTime(bid.createdAt) : 'Unknown';
                const amount = Number(bid.amount || 0).toFixed(2);
                const expiry = getBidExpiryLabel(bid);
                const comment = getBidCommentLabel(bid);
                var providerId = firstText(bid.providerId, bid.bidderId, bid.provider || '');
                var profileLink = providerId ? ('<a class="legacy-bids-view-link" href="provider-profile.html?userId=' + encodeURIComponent(providerId) + '" target="_blank">View profile</a>') : '';
                return '<tr>' +
                    '<td class="legacy-bidder-cell"><span class="legacy-bidder-icon">+</span>' + escapeHtml(bidder) + '</td>' +
                    '<td>€' + amount + '</td>' +
                    '<td>' + escapeHtml(when) + '</td>' +
                    '<td><strong>P:</strong> ' + escapeHtml(dateLabel) + '<br><strong>D:</strong> ' + escapeHtml(dateLabel) + '</td>' +
                    '<td>' + escapeHtml(expiry) + '</td>' +
                    '<td class="legacy-bid-comment">' + escapeHtml(comment) + '</td>' +
                    '<td>' + profileLink + ' <button type="button" class="legacy-bids-view-btn">VIEW</button></td>' +
                    '</tr>';
            }).join('') +
            '</tbody></table>';
    }

    function setupBidForm(quoteId, quote) {
        const form = document.getElementById('bid-form');
        if (!form) return;

        const expiryModeEl = document.getElementById('bid-expiry-mode');
        const customExpiryGroup = document.getElementById('bid-custom-expiry-group');
        const templateEl = document.getElementById('bid-template');
        const messageEl = document.getElementById('bid-message');
        const dateEl = document.getElementById('bid-expire-date');
        const timeEl = document.getElementById('bid-expire-time');

        // Load saved messages into dropdown
        populateSavedMessagesDropdown();
        updateSavedMessagesInfo();

        // Attach clear saved messages button
        const clearBtn = document.getElementById('btn-clear-saved-messages');
        if (clearBtn) {
            clearBtn.addEventListener('click', function (evt) {
                evt.preventDefault();
                clearAllSavedMessages();
            });
        }

        // Handle save message checkbox toggle
        const saveCheckbox = document.getElementById('bid-save-template');
        const titleGroup = document.getElementById('save-message-title-group');
        if (saveCheckbox && titleGroup) {
            saveCheckbox.addEventListener('change', function () {
                if (this.checked) {
                    titleGroup.hidden = false;
                } else {
                    titleGroup.hidden = true;
                }
            });
        }

        if (expiryModeEl) {
            expiryModeEl.addEventListener('change', updateBidExpiryModeVisibility);
            updateBidExpiryModeVisibility();
        }

        if (templateEl && messageEl) {
            templateEl.addEventListener('change', function () {
                const selectedValue = String(templateEl.value || '').trim();
                // Always update textarea when a value is selected (including saved messages)
                if (selectedValue) {
                    messageEl.value = selectedValue;
                    // Clear the title input when user selects a message from dropdown
                    const titleInput = document.getElementById('bid-message-title');
                    if (titleInput) titleInput.value = '';
                }
            });
        }

        const autoBidEnabledEl = document.getElementById('bid-autobid-enabled');
        if (autoBidEnabledEl) {
            autoBidEnabledEl.addEventListener('change', updateAutoBidFieldsVisibility);
        }
        preloadAutoBidSettings(quote);

        form.addEventListener('submit', function (evt) {
            evt.preventDefault();

            const amountEl = document.getElementById('bid-amount');
            const expiryModeValue = String((expiryModeEl && expiryModeEl.value) || 'listingEnds').trim();
            const expireDateEl = document.getElementById('bid-expire-date');
            const expireTimeEl = document.getElementById('bid-expire-time');
            const amount = Number((amountEl && amountEl.value) || 0);

            if (!Number.isFinite(amount) || amount <= 0) {
                alert('Please enter a valid bid amount.');
                return;
            }

            const user = getActiveUser();
            if (!user || !user.id) {
                alert('Please log in to place a bid.');
                return;
            }

            const messageText = messageEl ? String(messageEl.value || '') : '';
            const autoBidEnabledElSubmit = document.getElementById('bid-autobid-enabled');
            const autoBidIncrementEl = document.getElementById('bid-autobid-increment');
            const autoBidFloorEl = document.getElementById('bid-autobid-floor');
            const autoBidEnabled = !!(autoBidEnabledElSubmit && autoBidEnabledElSubmit.checked);
            const autoBidIncrement = autoBidIncrementEl ? Number(autoBidIncrementEl.value) : 0;
            const autoBidFloor = autoBidFloorEl ? Number(autoBidFloorEl.value) : 0;

            if (autoBidEnabled) {
                if (!Number.isFinite(autoBidIncrement) || autoBidIncrement <= 0) {
                    alert('Enter a valid auto-bid increment (€).');
                    return;
                }
                if (!Number.isFinite(autoBidFloor) || autoBidFloor <= 0) {
                    alert('Enter your minimum auto-bid price (floor).');
                    return;
                }
                if (autoBidFloor >= amount) {
                    alert('Your auto-bid floor must be lower than your quote amount.');
                    return;
                }
            }

            const newBid = {
                id: 'bid-' + Date.now(),
                quoteId: quoteId,
                providerId: user.id,
                providerUsername: firstText(user.username, user.nickname, user.handle),
                providerNickname: firstText(user.username, user.nickname, user.handle),
                providerName: firstText(user.name, user.email, 'Provider'),
                providerEmail: firstText(user.email),
                amount: amount,
                message: messageText,
                messageTemplate: templateEl ? String(templateEl.value || '') : '',
                bidExpiryMode: expiryModeValue || 'listingEnds',
                bidExpiryDate: expiryModeValue === 'custom' && expireDateEl ? String(expireDateEl.value || '') : '',
                bidExpiryTime: expiryModeValue === 'custom' && expireTimeEl ? String(expireTimeEl.value || '') : '',
                autoBidEnabled: autoBidEnabled,
                autoBidIncrement: autoBidEnabled ? autoBidIncrement : 0,
                autoBidFloor: autoBidEnabled ? autoBidFloor : 0,
                bidSource: 'manual',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (!window.anytransportApi || typeof window.anytransportApi.saveBid !== 'function') {
                alert('Server storage is not available for bids yet. Please upload the API files to the Hetzner server first.');
                return;
            }

            try {
                window.anytransportApi.saveBid(newBid);
            } catch (error) {
                alert(error && error.message ? error.message : 'Unable to save your bid to the server.');
                return;
            }

            // Add notifications for bid submission
            const providerName = firstText(user.username, user.nickname, user.name, 'Provider');
            const quoterName = firstText(quote.customerName, quote.name, 'Customer');

            // Notification for provider (bid submitted)
            if (typeof window.notificationSystem === 'object' && window.notificationSystem.addNotification) {
                window.notificationSystem.addNotification(user, 'quote-added', 'Quote Submitted', 
                    'Your quote of €' + Number(amount).toFixed(2) + ' has been submitted for ' + (quote.title || 'a job'),
                    { quoteId: quoteId, bidAmount: amount, quoteName: quote.title }
                );
            }

            // Save message if checkbox is checked
            const saveTemplateCheckbox = document.getElementById('bid-save-template');
            if (saveTemplateCheckbox && saveTemplateCheckbox.checked && messageText.trim()) {
                const titleInput = document.getElementById('bid-message-title');
                const messageTitle = titleInput ? String(titleInput.value || '').trim() : '';
                const saved = addSavedMessage(user, messageText, messageTitle);
                if (saved) {
                    // Refresh dropdown with new saved message
                    populateSavedMessagesDropdown();
                    updateSavedMessagesInfo();
                    // Clear the title input after save
                    if (titleInput) titleInput.value = '';
                }
            }

            if (form) form.reset();
            initializeBidFormDefaults(quote);
            renderBids(quoteId, quote);
        });
    }

    function getBidExpiryLabel(bid) {
        const mode = String(bid && bid.bidExpiryMode || '').trim().toLowerCase();
        const date = firstText(bid && bid.bidExpiryDate, '');
        const time = firstText(bid && bid.bidExpiryTime, '');

        if (!mode && (date || time)) {
            return date + (time ? ' ' + time : '');
        }

        if (!mode || mode === 'listingends' || mode === 'listing ends' || mode === 'formends' || mode === 'form ends') {
            return 'When listing ends';
        }
        if (!date && !time) return 'When listing ends';
        return date + (time ? ' ' + time : '');
    }

    function getBidCommentLabel(bid) {
        const message = firstText(
            bid && bid.message,
            bid && bid.bidMessage,
            bid && bid.comment,
            bid && bid.notes,
            ''
        );
        return message || 'No comment';
    }

    function renderFormSections(quote) {
        const root = document.getElementById('details-form-sections');
        if (!root) return;

        const fields = [
            ['Pickup property type', getPropertyPickupType(quote)],
            ['Delivery property type', getPropertyDeliveryType(quote)],
            ['Service', getServiceLabel(quote)],
            ['Distance', formatDistance(quote)],
            ['Time', firstText(quote.routeDurationText, quote.routeDuration, quote.durationText, 'Not provided')],
            ['Pickup time', getPickupTime(quote), true],
            ['Delivery time', getDeliveryTime(quote), true],
            ['Date', getMoveDate(quote)],
            ['Movers', getMoversRequired(quote)],
            ['Special instructions', firstText(quote.serviceSpecialInstructions, quote.instructions, quote.notes, 'None')],
            ['Status', firstText(quote.status, 'pending') || 'pending']
        ];

        root.innerHTML = '<section class="form-section-card compact-form-section">' +
            '<h3 class="form-section-title">Key Details</h3>' +
            '<div class="compact-details-table">' + fields.map(function (pair) {
                const isHtml = pair[2] === true;
                return '<div class="compact-detail-row"><span class="compact-detail-label">' + escapeHtml(pair[0]) + ':</span><span class="compact-detail-value">' + (isHtml ? pair[1] : escapeHtml(pair[1])) + '</span></div>';
            }).join('') + '</div>' +
            '</section>';
    }

    function renderRouteSectionCard(quote, rowsHtml) {
        const mapHtml = '<div id="inline-route-map" class="inline-route-map"></div>';
        const routeDetailsHtml = '<div id="inline-route-details" class="inline-route-details"><div class="inline-route-empty">Loading detailed route...</div></div>';
        return '<div class="route-section-layout">' +
            '<div class="route-map-panel">' + mapHtml + routeDetailsHtml + '</div>' +
            '<div class="route-metrics-panel">' +
                '<div class="form-section-fields route-metrics-fields">' + rowsHtml + '</div>' +
            '</div>' +
        '</div>';
    }

    function initInlineRouteMap(quote) {
        const mapEl = document.getElementById('inline-route-map');
        if (!mapEl || !window.mapboxgl) return;

        const pickupAddress = getPickupLabel(quote);
        const deliveryAddress = getDeliveryLabel(quote);

        if (!String(mapboxgl.accessToken || '').trim()) {
            mapboxgl.accessToken = ANYTRANSPORT_MAPBOX_TOKEN;
        }

        const pickupCoordPromise = resolveQuoteCoordinates(quote, 'pickup')
            ? Promise.resolve(resolveQuoteCoordinates(quote, 'pickup'))
            : geocodeAddress(pickupAddress);
        const deliveryCoordPromise = resolveQuoteCoordinates(quote, 'delivery')
            ? Promise.resolve(resolveQuoteCoordinates(quote, 'delivery'))
            : geocodeAddress(deliveryAddress);

        pickupCoordPromise.then(function (pickupCoord) {
            return deliveryCoordPromise.then(function (deliveryCoord) {
                const fallbackCenter = [-8.24389, 53.41291];
                const center = pickupCoord || deliveryCoord || fallbackCenter;

                const map = new mapboxgl.Map({
                    container: 'inline-route-map',
                    style: 'mapbox://styles/mapbox/streets-v12',
                    center: center,
                    zoom: 6,
                    scrollZoom: false,
                    dragPan: false
                });

                map.on('load', function () {
                    const bounds = new mapboxgl.LngLatBounds();

                    if (pickupCoord) {
                        new mapboxgl.Marker({ element: createRouteMarkerElement('A', 'pickup') }).setLngLat(pickupCoord).addTo(map);
                        bounds.extend(pickupCoord);
                    }

                    if (deliveryCoord) {
                        new mapboxgl.Marker({ element: createRouteMarkerElement('B', 'delivery') }).setLngLat(deliveryCoord).addTo(map);
                        bounds.extend(deliveryCoord);
                    }

                    if (pickupCoord && deliveryCoord) {
                        const storedGeometry = parseStoredRouteGeometry(quote);
                        if (storedGeometry) {
                            drawRouteGeometry(map, storedGeometry);
                        }
                        fetchRouteDetails(pickupCoord, deliveryCoord).then(function (routeDetails) {
                            renderInlineRouteDetails(routeDetails, pickupAddress, deliveryAddress);
                            if (routeDetails && routeDetails.geometry) {
                                drawRouteGeometry(map, routeDetails.geometry);
                            }
                        });
                        map.fitBounds(bounds, { padding: 30, maxZoom: 12 });
                    } else if (!bounds.isEmpty()) {
                        map.fitBounds(bounds, { padding: 30, maxZoom: 11 });
                        renderInlineRouteDetails(null, pickupAddress, deliveryAddress);
                    }
                });
            });
        });
    }

    async function fetchRouteDetails(fromCoord, toCoord) {
        if (!Array.isArray(fromCoord) || !Array.isArray(toCoord) || !window.mapboxgl || !mapboxgl.accessToken) return null;

        const coords = fromCoord[0] + ',' + fromCoord[1] + ';' + toCoord[0] + ',' + toCoord[1];
        const url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
            coords +
            '?access_token=' + encodeURIComponent(mapboxgl.accessToken) +
            '&geometries=geojson&overview=full&steps=true&language=en';

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const route = Array.isArray(data && data.routes) ? data.routes[0] : null;
            return route || null;
        } catch (_error) {
            return null;
        }
    }

    function renderInlineRouteDetails(route, pickupAddress, deliveryAddress) {
        const detailsEl = document.getElementById('inline-route-details');
        if (!detailsEl) return;

        const fromText = firstText(pickupAddress, 'Pickup');
        const toText = firstText(deliveryAddress, 'Delivery');

        if (!route) {
            detailsEl.innerHTML = [
                '<div class="route-details-summary">',
                '<div><strong>From:</strong> ' + escapeHtml(fromText) + '</div>',
                '<div><strong>To:</strong> ' + escapeHtml(toText) + '</div>',
                '</div>',
                '<div class="inline-route-empty">Estimated drive is unavailable for this listing.</div>'
            ].join('');
            return;
        }

        const distanceKm = Number(route.distance || 0) / 1000;
        const durationMin = Math.round(Number(route.duration || 0) / 60);
        detailsEl.innerHTML = [
            '<div class="route-details-summary">',
            '<div><strong>From:</strong> ' + escapeHtml(fromText) + '</div>',
            '<div><strong>To:</strong> ' + escapeHtml(toText) + '</div>',
            '<div><strong>Estimated drive:</strong> ' + escapeHtml(distanceKm.toFixed(1) + ' km • ' + durationMin + ' min') + '</div>',
            '</div>'
        ].join('');
    }

    function drawRouteGeometry(map, geometry) {
        if (!map || !geometry) return;

        const sourceId = 'details-route-source';
        const layerId = 'details-route-layer';

        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry: geometry,
                properties: {}
            }
        });

        map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: {
                'line-join': 'round',
                'line-cap': 'round'
            },
            paint: {
                'line-color': '#2f8ed8',
                'line-width': 5,
                'line-opacity': 0.85
            }
        });
    }

    function countAttachments(attachments) {
        if (!Array.isArray(attachments)) return '0';
        return String(attachments.length);
    }

    function getAllUsers() {
        try {
            const parsed = JSON.parse(localStorage.getItem('anytransport_users') || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_error) {
            return [];
        }
    }

    function resolveSubmitterProfile(quote) {
        const users = getAllUsers();
        const ownerId = String(firstText(quote.userId, quote.createdBy, quote.customerId) || '').trim();
        const ownerEmail = String(firstText(quote.email, quote.customerEmail) || '').trim().toLowerCase();

        if (ownerId) {
            const byId = users.find(function (user) {
                return String((user && user.id) || '').trim() === ownerId;
            });
            if (byId) return byId;
        }

        if (ownerEmail) {
            const byEmail = users.find(function (user) {
                return String((user && user.email) || '').trim().toLowerCase() === ownerEmail;
            });
            if (byEmail) return byEmail;
        }

        return null;
    }

    function joinList(value) {
        if (Array.isArray(value)) return value.join(', ');
        return firstText(value);
    }

    function getStepSixServicesLabel(quote) {
        const selected = [];

        const directSources = [
            quote.serviceSelections,
            quote.selectedServices,
            quote.additionalServices,
            quote.additionalServiceList,
            quote.step6Selections,
            quote.services
        ];

        directSources.forEach(function (source) {
            if (Array.isArray(source)) {
                source.forEach(function (entry) {
                    const text = firstText(entry);
                    if (text) selected.push(prettyLabel(text));
                });
                return;
            }

            if (source && typeof source === 'object') {
                Object.keys(source).forEach(function (key) {
                    const value = source[key];
                    if (isTruthyServiceValue(value)) {
                        selected.push(prettyLabel(key));
                    }
                });
                return;
            }

            const text = firstText(source);
            if (text) selected.push(prettyLabel(text));
        });

        const stepSixFlags = [
            ['Packing service', firstText(quote.servicePacking, quote['service-packing'], quote.packingService, quote.packingRequired)],
            ['Storage service', firstText(quote.serviceStorage, quote['service-storage'], quote.storage)],
            ['Disassembly service', firstText(quote.serviceDisassembly, quote['service-disassembly'], quote.disassembly)],
            ['Assembly at arrival', firstText(quote.serviceAssembleAtArrival, quote['service-assemble-at-arrival'], quote.reassembly)]
        ];

        stepSixFlags.forEach(function (pair) {
            if (isTruthyServiceValue(pair[1])) {
                selected.push(pair[0]);
            }
        });

        const deduped = [];
        const seen = new Set();
        selected.forEach(function (entry) {
            const clean = String(entry || '').trim();
            if (!clean) return;
            const key = clean.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            deduped.push(clean);
        });

        return deduped.length ? deduped.join(', ') : 'Not provided';
    }

    function getPropertyDeliveryType(quote) {
        const raw = firstText(
            quote.deliveryPropertyType,
            quote['delivery-property-type'],
            quote.deliveryLocationType,
            quote['delivery-location-type'],
            quote.deliveryType,
            quote.summaryDeliveryType,
            quote['summary-delivery-type']
        );
        if (!raw) return 'Not provided';
        return prettyLabel(raw);
    }

    function getPropertyPickupType(quote) {
        const raw = firstText(
            quote.pickupPropertyType,
            quote['pickup-property-type'],
            quote.propertyType,
            quote.pickupLocationType,
            quote['pickup-location-type'],
            quote.pickupType,
            quote.summaryPickupType,
            quote['summary-pickup-type']
        );
        if (!raw) return 'Not provided';
        return prettyLabel(raw);
    }

    function isTruthyServiceValue(value) {
        if (value === true) return true;
        if (typeof value === 'number') return Number.isFinite(value) && value > 0;

        const text = String(value || '').trim().toLowerCase();
        if (!text) return false;
        if (text === 'yes' || text === 'true' || text === 'selected' || text === 'included' || text === 'required' || text === 'on') return true;
        if (text === 'no' || text === 'false' || text === 'none' || text === 'off' || text === 'not required') return false;
        return true;
    }

    function prettyLabel(value) {
        const text = String(value || '').trim();
        if (!text) return '';
        const normalized = text
            .replace(/^service[-_\s]*/i, '')
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }

    function formatDistance(quote) {
        const value = firstText(quote.routeDistanceKm, quote.distanceKm, quote.distance, quote.routeDistance);
        if (!value) return '';
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric.toFixed(1) + ' km' : String(value);
    }

    function getQuoteTitle(quote) {
        return resolveServiceTypeTitle(quote, 'Transport request');
    }

    function getServiceLabel(quote) {
        return resolveServiceTypeTitle(quote, 'General move');
    }

    function resolveServiceTypeTitle(quote, fallback) {
        const raw = firstText(
            quote.serviceType,
            quote.service,
            quote.selectedService,
            quote.serviceName,
            quote.transportType,
            quote.itemType,
            quote.itemDescription,
            quote.propertyType,
            fallback
        );

        const normalized = String(raw || '').trim().toLowerCase();
        const known = {
            'house removals': 'House Removal',
            'house removal': 'House Removal',
            'office removals': 'Office Relocation',
            'office relocation': 'Office Relocation',
            'apartment move': 'Apartment Move',
            'single room move': 'Single Room Move',
            'man and van': 'Man & Van',
            'man with van': 'Man & Van'
        };

        if (known[normalized]) return known[normalized];
        if (!raw) return fallback;
        return String(raw)
            .trim()
            .replace(/[-_]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
    }

    function formatFullLocationLabel(quote, kind) {
        const isPickup = kind === 'pickup';
        const address = String(isPickup ? quote.pickupAddress : quote.deliveryAddress || '').trim();
        const city = String(isPickup ? quote.pickupCity : quote.deliveryCity || '').trim();
        const postcode = String(isPickup ? quote.pickupPostcode : quote.deliveryPostcode || '').trim();
        const parts = [address, city, postcode].filter(Boolean);
        if (parts.length) {
            return parts.join(', ');
        }
        return firstText(
            isPickup ? quote.pickupLocation : quote.deliveryLocation,
            isPickup ? quote.pickupTown : quote.deliveryTown,
            isPickup ? quote.pickupAddress : quote.deliveryAddress,
            isPickup ? quote.pickupCity : quote.deliveryCity,
            'Not provided'
        );
    }

    function getPickupLabel(quote) {
        return formatFullLocationLabel(quote, 'pickup');
    }

    function getPickupDisplayLabel(quote) {
        const location = getPickupLabel(quote);
        const property = getPropertyPickupType(quote);
        if (!property || property === 'Not provided') return location;
        return location + ' (' + property + ')';
    }

    function getDeliveryLabel(quote) {
        return formatFullLocationLabel(quote, 'delivery');
    }

    function parseCoordinatePair(value) {
        if (Array.isArray(value) && value.length >= 2) {
            const lng = Number(value[0]);
            const lat = Number(value[1]);
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
                return [lng, lat];
            }
        }
        if (typeof value === 'string' && value.indexOf(',') >= 0) {
            const parts = value.split(',').map(function (part) { return parseFloat(String(part).trim()); });
            if (parts.length >= 2 && parts.every(function (n) { return Number.isFinite(n); })) {
                return [parts[0], parts[1]];
            }
        }
        if (value && typeof value === 'object') {
            const lng = Number(value.lng != null ? value.lng : (value.lon != null ? value.lon : value.longitude));
            const lat = Number(value.lat != null ? value.lat : value.latitude);
            if (Number.isFinite(lng) && Number.isFinite(lat)) {
                return [lng, lat];
            }
        }
        return null;
    }

    function resolveQuoteCoordinates(quote, kind) {
        const isPickup = kind === 'pickup';
        const candidates = isPickup
            ? [quote.pickupCoords, quote.pickupCoordinates, quote.pickupLngLat]
            : [quote.deliveryCoords, quote.deliveryCoordinates, quote.deliveryLngLat];
        for (let i = 0; i < candidates.length; i += 1) {
            const parsed = parseCoordinatePair(candidates[i]);
            if (parsed) return parsed;
        }
        return null;
    }

    function parseStoredRouteGeometry(quote) {
        const candidates = [quote.routeGeometry, quote.overviewRouteGeometry];
        for (let i = 0; i < candidates.length; i += 1) {
            const candidate = candidates[i];
            if (!candidate) continue;
            if (candidate.type === 'LineString' && Array.isArray(candidate.coordinates)) {
                return candidate;
            }
            if (candidate.geometry && candidate.geometry.type === 'LineString') {
                return candidate.geometry;
            }
        }
        return null;
    }

    function normalizeAssignmentItemKey(itemKey) {
        const raw = String(itemKey || '').trim();
        if (!raw) return '';
        if (!raw.includes('||')) {
            return formatItemLabel(raw);
        }
        const parts = raw.split('||').map(function (part) {
            return String(part || '').trim();
        }).filter(Boolean);
        if (!parts.length) return '';
        // Step 5 keys are itemName||sourcePickupFloor (e.g. "Console Table||Ground").
        return formatItemLabel(parts[0]);
    }

    function getAssignmentKeyParts(itemKey) {
        const raw = String(itemKey || '').trim();
        if (!raw) {
            return { itemName: '', sourceFloor: '' };
        }
        if (!raw.includes('||')) {
            return { itemName: formatItemLabel(raw), sourceFloor: '' };
        }
        const parts = raw.split('||').map(function (part) {
            return String(part || '').trim();
        }).filter(Boolean);
        return {
            itemName: formatItemLabel(parts[0] || raw),
            sourceFloor: parts[1] || ''
        };
    }

    function populatePickupInventoryFallback(quote, pickupMap, deliveryMap, addToFloorMap) {
        if (Object.keys(pickupMap).length > 0) {
            return;
        }

        const floorBlocks = Array.isArray(quote.floorBlocks) ? quote.floorBlocks : [];
        floorBlocks.forEach(function (block) {
            const pickupFloor = firstText(
                block && block.floor,
                block && block.pickupFloor,
                block && block.floorLabel,
                quote.pickupFloorSelect,
                quote.pickupFloor,
                'Ground'
            );
            [block && block.houseInventory, block && block.officeInventory].forEach(function (inventory) {
                if (!inventory || typeof inventory !== 'object') return;
                const flatItems = firstNonEmptyObject(inventory.items, inventory.itemQuantities, inventory.quantities);
                if (!flatItems) return;
                Object.keys(flatItems).forEach(function (itemKey) {
                    const qty = parseInt(flatItems[itemKey], 10) || 0;
                    if (qty > 0) {
                        addToFloorMap(pickupMap, pickupFloor, normalizeAssignmentItemKey(itemKey), qty);
                    }
                });
                collectNestedRoomItems(inventory.subRoomQuantities, function (room, item, qty) {
                    addToFloorMap(pickupMap, pickupFloor, normalizeAssignmentItemKey(item), qty);
                });
            });
        });

        if (Object.keys(pickupMap).length > 0) {
            return;
        }

        const defaultPickupFloor = firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.fromFloor, 'Ground');
        Object.keys(deliveryMap).forEach(function (deliveryFloor) {
            const floorItems = deliveryMap[deliveryFloor];
            if (!floorItems || typeof floorItems !== 'object') return;
            Object.keys(floorItems).forEach(function (itemName) {
                const qty = parseInt(floorItems[itemName], 10) || 0;
                if (qty <= 0) return;
                const pickupFloor = firstText(resolvePickupFloorForItem(quote, itemName), defaultPickupFloor);
                addToFloorMap(pickupMap, pickupFloor, itemName, qty);
            });
        });
    }

    function getDeliveryDisplayLabel(quote) {
        const location = getDeliveryLabel(quote);
        const property = getPropertyDeliveryType(quote);
        if (!property || property === 'Not provided') return location;
        return location + ' (' + property + ')';
    }

    function getPickupTime(quote) {
        const time = firstText(quote.preferredPickupTime, quote.pickupTime, quote.timeWindowPickup, 'Flexible');
        const flexibility = String(quote.preferredPickupTimeFlexibility || 'mandatory').toLowerCase();
        const badge = flexibility === 'mandatory' 
            ? '<span style="display:inline-block; margin-left:8px; padding:2px 8px; background:#fee2e2; color:#991b1b; border-radius:4px; font-weight:700; font-size:0.75rem;">Mandatory time</span>'
            : '<span style="display:inline-block; margin-left:8px; padding:2px 8px; background:#e0f2fe; color:#0369a1; border-radius:4px; font-weight:700; font-size:0.75rem;">Flexible time</span>';
        return time ? time + badge : 'Flexible' + badge;
    }

    function getDeliveryTime(quote) {
        const time = firstText(quote.preferredDeliveryTime, quote.deliveryTime, quote.timeWindowDelivery, 'Flexible');
        const flexibility = String(quote.preferredDeliveryTimeFlexibility || 'mandatory').toLowerCase();
        const badge = flexibility === 'mandatory'
            ? '<span style="display:inline-block; margin-left:8px; padding:2px 8px; background:#fee2e2; color:#991b1b; border-radius:4px; font-weight:700; font-size:0.75rem;">Mandatory time</span>'
            : '<span style="display:inline-block; margin-left:8px; padding:2px 8px; background:#e0f2fe; color:#0369a1; border-radius:4px; font-weight:700; font-size:0.75rem;">Flexible time</span>';
        return time ? time + badge : 'Flexible' + badge;
    }

    function getPreferredTimeSummary(quote) {
        const pickupTime = firstText(quote.preferredPickupTime, quote.pickupTime, quote.timeWindowPickup, 'Not set');
        const deliveryTime = firstText(quote.preferredDeliveryTime, quote.deliveryTime, quote.timeWindowDelivery, 'Not set');
        const pickupFlexibility = String(quote.preferredPickupTimeFlexibility || 'mandatory').toLowerCase() === 'mandatory' ? 'M' : 'F';
        const deliveryFlexibility = String(quote.preferredDeliveryTimeFlexibility || 'mandatory').toLowerCase() === 'mandatory' ? 'M' : 'F';
        return 'Pickup: ' + pickupTime + ' (' + pickupFlexibility + ') | Delivery: ' + deliveryTime + ' (' + deliveryFlexibility + ')';
    }

    function getStorageSummary(quote) {
        const storageValue = firstText(quote.serviceStorage, quote['service-storage'], quote.storage);
        const storageStatus = String(storageValue || '').trim().toLowerCase();
        if (storageStatus === 'no') return 'No storage';
        if (storageStatus !== 'yes') return 'Storage not selected';

        const storageDateMode = String(firstText(quote.serviceStorageDateMode, quote['service-storage-date-mode']) || 'exact').trim().toLowerCase();
        const parseDateValue = (raw) => {
            const value = String(raw || '').trim();
            const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (!match) return null;
            return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        };
        const formatDurationLabel = (startDate, endDate) => {
            if (!startDate || !endDate) return '';
            const differenceMs = endDate.getTime() - startDate.getTime();
            if (!Number.isFinite(differenceMs) || differenceMs < 0) return '';
            const days = Math.max(1, Math.round(differenceMs / 86400000));
            if (days % 7 === 0) {
                const weeks = days / 7;
                return weeks === 1 ? '1 week' : weeks + ' weeks';
            }
            return days === 1 ? '1 day' : days + ' days';
        };

        if (storageDateMode === 'approx') {
            const approxStartFrom = parseDateValue(firstText(quote.serviceStorageStartApproxFrom, quote['service-storage-start-approx-from']));
            const approxEndTo = parseDateValue(firstText(quote.serviceStorageEndApproxTo, quote['service-storage-end-approx-to']));
            const durationLabel = formatDurationLabel(approxStartFrom, approxEndTo);
            return durationLabel ? 'Yes, approx. for ' + durationLabel : 'Yes, duration pending';
        }

        const startDate = parseDateValue(firstText(quote.serviceStorageStartDatetime, quote['service-storage-start-datetime']));
        const endDate = parseDateValue(firstText(quote.serviceStorageEndDatetime, quote['service-storage-end-datetime']));
        const durationLabel = formatDurationLabel(startDate, endDate);
        return durationLabel ? 'Yes, for ' + durationLabel : 'Yes, duration pending';
    }

    function getMoveDate(quote) {
        const value = firstText(quote.transportDate, quote.preferredDate, quote.moveDate, quote.date);
        if (!value) return 'Not provided';
        return formatDate(value);
    }

    function getMoversRequired(quote) {
        const pickupMode = firstText(quote.servicePickupMoversMode, quote['service-pickup-movers-mode']);
        const deliveryMode = firstText(quote.serviceDeliveryMoversMode, quote['service-delivery-movers-mode']);
        const fallbackTotal = firstText(
            quote.moversRequired,
            quote.numberOfMovers,
            quote.serviceMovers,
            quote['service-number-of-movers']
        );

        if (!pickupMode && !deliveryMode) {
            return fallbackTotal ? ('Required: ' + fallbackTotal) : 'Not provided';
        }

        const pickupValue = pickupMode === 'unsure'
            ? 'Pickup: Movers decide'
            : 'Pickup: ' + (firstText(quote.servicePickupMovers, quote['service-pickup-movers'], quote.pickupMovers, fallbackTotal) || 'Not provided');

        const deliveryValue = deliveryMode === 'unsure'
            ? 'Delivery: Movers decide'
            : 'Delivery: ' + (firstText(quote.serviceDeliveryMovers, quote['service-delivery-movers'], quote.deliveryMovers, fallbackTotal) || 'Not provided');

        return pickupValue + ' | ' + deliveryValue;
    }

    function getPickupMoversValue(quote) {
        const mode = firstText(quote.servicePickupMoversMode, quote['service-pickup-movers-mode']);
        if (mode === 'unsure') return 'Movers decide';
        return firstText(
            quote.servicePickupMovers,
            quote['service-pickup-movers'],
            quote.pickupMovers,
            quote.moversRequired,
            quote.numberOfMovers,
            'Not provided'
        ) || 'Not provided';
    }

    function getDeliveryMoversValue(quote) {
        const mode = firstText(quote.serviceDeliveryMoversMode, quote['service-delivery-movers-mode']);
        if (mode === 'unsure') return 'Movers decide';
        return firstText(
            quote.serviceDeliveryMovers,
            quote['service-delivery-movers'],
            quote.deliveryMovers,
            quote.moversRequired,
            quote.numberOfMovers,
            'Not provided'
        ) || 'Not provided';
    }

    function firstText() {
        for (let i = 0; i < arguments.length; i += 1) {
            const value = arguments[i];
            if (value === null || value === undefined) continue;
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (typeof value === 'number' && Number.isFinite(value)) return String(value);
            if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        }
        return '';
    }

    function formatDate(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(value) {
        if (!value) return 'Not provided';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);
        return date.toLocaleString('en-IE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(text) {
        return String(text == null ? '' : text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttribute(text) {
        return escapeHtml(text);
    }
})();
