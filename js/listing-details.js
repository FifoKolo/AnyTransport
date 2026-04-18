(function () {
    const LISTING_STORAGE_KEY = 'anytransport_quote_requests';
    const BID_STORAGE_KEY = 'anytransport_provider_bids';
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

        const quote = resolveListingByRef(getAllQuotes(), listingRef);
        if (!quote) {
            titleEl.textContent = 'Listing not found';
            subtitleEl.textContent = 'The selected listing does not exist in local storage.';
            renderMissingState('This listing may have been removed or not created on this browser yet.');
            return;
        }

        const quoteId = String((quote && quote.id) || '').trim();
        const listingId = getFormIdLabel(quote);

        titleEl.textContent = getQuoteTitle(quote);
        subtitleEl.textContent = 'Listing ' + listingId + ' • Full submitted form details';

        renderQuickInfo(quote);
        renderWatchToggle(quote);
        renderMap(quote);
        renderInventory(quote);
        renderMediaGallery(quote);
        renderServices(quote);
        renderBidUserContext();
        renderSidebarQuickInfo(quote);
        renderBids(quoteId, quote);
        initializeBidFormDefaults(quote);
        setupBidForm(quoteId, quote);
        renderFormSections(quote);
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

        root.innerHTML = [
            buildSidebarInfoRow('Listing ID', listingId),
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

    function initializeBidFormDefaults(quote) {
        const dateEl = document.getElementById('bid-expire-date');
        const timeEl = document.getElementById('bid-expire-time');
        const templateEl = document.getElementById('bid-template');
        const messageEl = document.getElementById('bid-message');
        const pickupDateEl = document.getElementById('bid-pickup-date');
        const deliveryDateEl = document.getElementById('bid-delivery-date');
        const defaultTemplate = 'Check availability 2';
        const defaultMessage = 'If you are happy with our quote and you don\'t have any questions, please accept our bid as soon as possible to avoid disappointment from being us not available on your preferred date and time as we are working on the first come first serve basis.';

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
        try {
            const parsed = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
    }

    function getFormIdLabel(quote) {
        return firstText(quote && quote.formId, quote && quote.id, quote && quote.quoteId, quote && quote.requestId, 'Not provided');
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

        const listingId = getFormIdLabel(quote);
        const collection = getPickupDisplayLabel(quote);
        const delivery = getDeliveryDisplayLabel(quote);
        const pickupMovers = getPickupMoversValue(quote);
        const deliveryMovers = getDeliveryMoversValue(quote);
        const createdAt = quote.createdAt ? formatDateTime(quote.createdAt) : 'Not provided';
        const username = firstText(quote.customerUsername, quote.username, quote.customerName, 'Unknown');
        const distance = firstText(formatDistance(quote), 'Not provided');
        const duration = firstText(quote.routeDurationText, quote.routeDuration, quote.durationText, 'Not provided');
        const moveDate = getMoveDate(quote);

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
            buildModernStat('Collection', collection),
            buildModernStat('Delivery', delivery),
            buildModernStat('Distance', distance),
            buildModernStat('Time', duration),
            buildModernStat('Pickup date', moveDate),
            buildModernStat('Delivery date', moveDate),
            buildModernStat('Pickup movers', pickupMovers),
            buildModernStat('Delivery movers', deliveryMovers),
            buildModernStat('User', username),
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
            '<button type="button" id="inventory-toggle-btn" class="inventory-open-btn" aria-expanded="false">Open Inventory</button>',
            '<button type="button" id="media-toggle-btn" class="inventory-open-btn" aria-expanded="false" style="margin-top:10px;">Open Photos</button>',
            '<button type="button" id="services-toggle-btn" class="inventory-open-btn" aria-expanded="false" style="margin-top:10px;">Open Services</button>',
            '</div>',
            '</div>',
            '<div id="inventory-modal" class="inventory-modal" aria-hidden="true">',
            '<div class="inventory-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title">',
            '<div id="inventory-drag-handle" class="inventory-modal-header" title="Drag to move">',
            '<h3 id="inventory-modal-title">Inventory details</h3>',
            '<div class="inventory-window-actions">',
            '<button type="button" id="inventory-reset-btn" class="inventory-close-btn" aria-label="Reset inventory window position">Reset</button>',
            '<button type="button" id="inventory-close-btn" class="inventory-close-btn" aria-label="Close inventory">Close</button>',
            '</div>',
            '</div>',
            '<div id="details-inventory" class="inventory-modal-content"></div>',
            '<div class="inventory-resize-handle inventory-resize-nw" data-corner="nw" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-ne" data-corner="ne" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-sw" data-corner="sw" aria-hidden="true"></div>',
            '<div class="inventory-resize-handle inventory-resize-se" data-corner="se" aria-hidden="true"></div>',
            '</div>',
            '</div>',
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

    function buildModernStat(label, value) {
        return '<div class="modern-stat-card">' +
            '<span>' + escapeHtml(label) + '</span>' +
            '<strong>' + escapeHtml(value) + '</strong>' +
            '</div>';
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

        const pickupCoord = await geocodeAddress(pickupAddress);
        const deliveryCoord = await geocodeAddress(deliveryAddress);

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
                new mapboxgl.Marker({ color: '#22a06b' })
                    .setLngLat(pickupCoord)
                    .setPopup(new mapboxgl.Popup({ offset: 22 }).setText('Pickup: ' + pickupAddress))
                    .addTo(map);
                bounds.extend(pickupCoord);
            }

            if (deliveryCoord) {
                new mapboxgl.Marker({ color: '#e62f7a' })
                    .setLngLat(deliveryCoord)
                    .setPopup(new mapboxgl.Popup({ offset: 22 }).setText('Delivery: ' + deliveryAddress))
                    .addTo(map);
                bounds.extend(deliveryCoord);
            }

            if (pickupCoord && deliveryCoord) {
                await drawRouteLine(map, pickupCoord, deliveryCoord);
            }

            if (pickupCoord && deliveryCoord) {
                map.fitBounds(bounds, { padding: 60, maxZoom: 12 });
            } else if (!bounds.isEmpty()) {
                map.fitBounds(bounds, { padding: 60, maxZoom: 11 });
            }
        });
    }

    async function geocodeAddress(addressText) {
        const query = String(addressText || '').trim();
        if (!query || !window.mapboxgl || !mapboxgl.accessToken) return null;

        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
            encodeURIComponent(query) +
            '.json?access_token=' + encodeURIComponent(mapboxgl.accessToken) +
            '&limit=1&country=ie&types=postcode,address,place';

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

    function renderInventory(quote) {
        const inventoryEl = document.getElementById('details-inventory');
        const toggleBtn = document.getElementById('inventory-toggle-btn');
        const modalEl = document.getElementById('inventory-modal');
        const dialogEl = modalEl ? modalEl.querySelector('.inventory-modal-dialog') : null;
        const dragHandleEl = document.getElementById('inventory-drag-handle');
        const closeBtn = document.getElementById('inventory-close-btn');
        const resetBtn = document.getElementById('inventory-reset-btn');
        if (!inventoryEl || !toggleBtn || !modalEl || !dialogEl || !dragHandleEl || !closeBtn || !resetBtn) return;

        const overviewInventory = collectOverviewStyleInventory(quote);
        if (overviewInventory) {
            inventoryEl.innerHTML = renderOverviewStyleInventory(overviewInventory);
        } else {
            const groups = collectInventoryGroups(quote);
            if (!groups.length) {
                inventoryEl.innerHTML = '<div class="empty-inventory">No items specified for this listing.</div>';
            } else {
                inventoryEl.innerHTML = groups.map(function (group) {
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

        closeInventoryModal();
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.textContent = 'Open Inventory';
        toggleBtn.onclick = toggleInventoryModal;
        closeBtn.onclick = closeInventoryModal;
        resetBtn.onclick = function () {
            setDefaultInventoryWindowPosition();
        };

        enableInventoryWindowDrag(dialogEl, dragHandleEl);
        enableInventoryWindowCornerResize(dialogEl);

        modalEl.onclick = function (event) {
            if (event.target === modalEl) {
                closeInventoryModal();
            }
        };

        if (modalEl._inventoryEscapeHandler) {
            document.removeEventListener('keydown', modalEl._inventoryEscapeHandler);
        }

        modalEl._inventoryEscapeHandler = function (event) {
            if (event.key === 'Escape' && modalEl.classList.contains('is-open')) {
                closeInventoryModal();
            }
        };

        document.addEventListener('keydown', modalEl._inventoryEscapeHandler);

        function toggleInventoryModal() {
            if (modalEl.classList.contains('is-open')) {
                closeInventoryModal();
                return;
            }

            openInventoryModal();
        }

        function openInventoryModal() {
            modalEl.classList.add('is-open');
            modalEl.setAttribute('aria-hidden', 'false');
            toggleBtn.setAttribute('aria-expanded', 'true');
            toggleBtn.textContent = 'Close Inventory';
            if (dialogEl.dataset.userPositioned !== 'true') {
                setDefaultInventoryWindowPosition();
            }
        }

        function closeInventoryModal() {
            modalEl.classList.remove('is-open');
            modalEl.setAttribute('aria-hidden', 'true');
            toggleBtn.setAttribute('aria-expanded', 'false');
            toggleBtn.textContent = 'Open Inventory';
        }

        function setDefaultInventoryWindowPosition() {
            const margin = 20;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const preferredWidth = Math.min(920, Math.max(360, Math.floor(viewportWidth * 0.62)));
            const left = Math.max(margin, viewportWidth - preferredWidth - margin);
            const top = Math.max(96, Math.min(140, viewportHeight - 260));

            dialogEl.style.left = String(left) + 'px';
            dialogEl.style.top = String(top) + 'px';
            dialogEl.style.width = String(preferredWidth) + 'px';
            dialogEl.dataset.userPositioned = 'false';
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

        const inventoryData = collectOverviewStyleInventory(quote);
        const services = buildServiceSelections(quote);

        servicesEl.innerHTML = renderServicesMarkup(inventoryData, services);

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

    function buildServiceSelections(quote) {
        const packingItems = parseServiceSelectionMap(quote.servicePackingItems);
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
            storageQtyByFloorItem: createFloorItemQtyMap(storageItems)
        };
    }

    function renderServicesMarkup(inventoryData, services) {
        if (!inventoryData || !inventoryData.pickup || !Object.keys(inventoryData.pickup).length) {
            return '<div class="empty-inventory">No inventory items available to map services yet.</div>';
        }

        const floorNames = getOrderedFloorNames(Object.keys(inventoryData.pickup || {}));
        if (!floorNames.length) {
            return '<div class="empty-inventory">No pickup inventory available for services.</div>';
        }

        const legend = '<div class="services-legend">' +
            renderServiceBadge('packing') +
            renderServiceBadge('disassemble') +
            renderServiceBadge('assemble') +
            renderServiceBadge('both') +
            renderServiceBadge('storage') +
            '</div>';

        const quantityContext = {
            remainingPackingQtyByItem: new Map(services.packingQtyByItem || [])
        };

        const floorBlocks = floorNames.map(function (floorName) {
            const floorItems = Object.entries(inventoryData.pickup[floorName] || {})
                .filter(function (entry) { return (parseInt(entry[1], 10) || 0) > 0; })
                .sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), undefined, { sensitivity: 'base' }); });

            const rows = floorItems.map(function (entry) {
                const itemLabel = formatItemLabel(entry[0]);
                const qty = parseInt(entry[1], 10) || 0;
                const badges = getItemServiceBadges(floorName, itemLabel, qty, services, quantityContext);

                return '<li class="services-item-row">' +
                    '<div class="services-item-main">' +
                        '<span class="services-item-name">' + escapeHtml(itemLabel) + '</span>' +
                        '<span class="services-item-qty">x' + escapeHtml(String(qty)) + '</span>' +
                    '</div>' +
                    '<div class="services-item-tags">' + (badges.length ? badges.map(renderServiceBadge).join('') : '<span class="service-badge service-badge-none">No service</span>') + '</div>' +
                '</li>';
            }).join('');

            return '<section class="services-floor-block">' +
                '<h4 class="services-floor-title">' + escapeHtml(floorName) + ' Floor</h4>' +
                '<ul class="services-item-list">' + rows + '</ul>' +
            '</section>';
        }).join('');

        return '<div class="services-modal-wrap">' + legend + floorBlocks + '</div>';
    }

    function getItemServiceBadges(floorName, itemLabel, itemQty, services, quantityContext) {
        const normalizedFloor = normalizeServiceFloorName(floorName);
        const normalizedItem = normalizeServiceItemName(itemLabel);
        const floorKey = normalizedFloor + '||' + normalizedItem;
        const qty = Math.max(0, parseInt(itemQty, 10) || 0);

        const packingSelectedQty = services.isPackingAll
            ? qty
            : consumeQuantityAllocation(
                quantityContext && quantityContext.remainingPackingQtyByItem,
                normalizedItem,
                qty
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
            .replace(/\s+/g, ' ')
            .toLowerCase();
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
                    const previewSrc = firstText(entry.previewDataUrl, entry.previewUrl, entry.dataUrl, '');
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
                previewSrc: firstText(entry.previewDataUrl, entry.previewUrl, entry.dataUrl, ''),
                fileName: firstText(entry.fileName, entry.name, 'Attachment'),
                note: firstText(entry.note, entry.notes, ''),
                itemName: ''
            });
        });

        return entries;
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

        const multiFloorInventory = firstObject(quote.multiFloorInventory, quote.multi_floor_inventory, quote.floorInventory);
        if (multiFloorInventory && typeof multiFloorInventory === 'object') {
            Object.keys(multiFloorInventory).forEach(function (floorName) {
                const floorItems = multiFloorInventory[floorName];
                if (!floorItems || typeof floorItems !== 'object') return;
                Object.keys(floorItems).forEach(function (itemName) {
                    addToFloorMap(pickupMap, floorName, itemName, floorItems[itemName]);
                });
            });
        }

        if (!Object.keys(pickupMap).length) {
            const pickupFloorFallback = firstText(quote.pickupFloorSelect, quote.pickupFloor, 'Ground');
            collectFlatInventoryItems(quote.itemQuantities, function (item, qty) {
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
                const baseName = String(itemKey || '').split('||')[0] || itemKey;
                const perFloor = assignments[itemKey];
                if (!perFloor || typeof perFloor !== 'object') return;

                Object.keys(perFloor).forEach(function (deliveryFloor) {
                    addToFloorMap(deliveryMap, deliveryFloor, baseName, perFloor[deliveryFloor]);
                });
            });
        }

        const hasPickup = Object.keys(pickupMap).length > 0;
        const hasDelivery = Object.keys(deliveryMap).length > 0;
        if (!hasPickup && !hasDelivery) return null;

        return {
            pickup: pickupMap,
            delivery: deliveryMap
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
                        return '<li>' + escapeHtml(formatItemLabel(entry[0])) + ' x' + escapeHtml(String(parseInt(entry[1], 10) || 0)) + '</li>';
                    }).join('')
                    : '<li>No items</li>';

                return '<div class="inventory-overview-floor-block">' +
                    '<div class="inventory-overview-floor-title">' + escapeHtml(floorName) + ' Floor</div>' +
                    '<ul class="inventory-overview-floor-items">' + rows + '</ul>' +
                    '</div>';
            }).join('');
        };

        return '<div class="inventory-overview-grid">' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Pickup Floor Inventory</h4>' +
                renderFloorBlocks(inventoryData.pickup, 'No pickup inventory selected yet.') +
            '</section>' +
            '<section class="inventory-overview-column">' +
                '<h4 class="inventory-overview-column-title">Delivery Floor Inventory</h4>' +
                renderFloorBlocks(inventoryData.delivery, 'No delivery floor assignments yet.') +
            '</section>' +
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
                collectFlatInventoryItems(houseInventory.items, function (item, qty) {
                    addEntry('General', item, qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });

                collectNestedRoomItems(houseInventory.subRoomQuantities, function (room, item, qty) {
                    addEntry(room, item, qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });
            }

            const officeInventory = block && block.officeInventory;
            if (officeInventory && typeof officeInventory === 'object') {
                collectFlatInventoryItems(officeInventory.items, function (item, qty) {
                    addEntry('Office', item, qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
                });

                collectNestedRoomItems(officeInventory.subRoomQuantities, function (room, item, qty) {
                    addEntry(room, item, qty, pickupFloor, resolveDeliveryFloorForItem(quote, item));
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
                collectFlatInventoryItems(topLevelHouseInventory.items, function (item, qty) {
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
            collectFlatInventoryItems(quote.itemQuantities, function (item, qty) {
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
        if (assignments && itemKey && assignments[itemKey]) {
            return firstText(assignments[itemKey]);
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
        if (assignments && itemKey && assignments[itemKey]) {
            const assignment = assignments[itemKey];
            if (assignment && typeof assignment === 'object') {
                const firstFloor = Object.keys(assignment).find(function (floorKey) {
                    return Number(assignment[floorKey]) > 0;
                });
                if (firstFloor) return firstFloor;
            }
            return firstText(assignment);
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

        if (Array.isArray(quote.pets)) {
            quote.pets.forEach(function (pet) {
                const label = (pet && pet.animalType) ? pet.animalType : 'Pet';
                addItem(label, (pet && pet.quantity) ? pet.quantity : '');
            });
        }

        return items;
    }

    function renderBids(quoteId, quote) {
        const historyEl = document.getElementById('bid-history');
        if (!historyEl) return;

        let allBids = [];
        try {
            const parsed = JSON.parse(localStorage.getItem(BID_STORAGE_KEY) || '[]');
            allBids = Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            allBids = [];
        }

        const quoteBids = allBids
            .filter(function (bid) {
                return String(bid.quoteId || '') === String(quoteId || '') && String(bid.status || 'active') === 'active';
            })
            .sort(function (a, b) {
                return Number(a.amount || 0) - Number(b.amount || 0);
            });

        updateSidebarBidCount(quoteBids.length);

        const dateLabel = firstText(getMoveDate(quote), 'Not provided');

        if (!quoteBids.length) {
            historyEl.innerHTML = '<div class="empty-bids">No bids yet. Be the first to bid.</div>';
            return;
        }

        historyEl.innerHTML = '<table class="legacy-bids-table legacy-bids-table-bottom"><thead><tr><th>Bidder</th><th>Amount</th><th>When</th><th>Dates</th><th>Expires</th><th></th></tr></thead><tbody>' +
            quoteBids.map(function (bid) {
                const bidder = firstText(
                    bid.providerUsername,
                    bid.providerNickname,
                    bid.providerName,
                    bid.bidderName,
                    bid.username,
                    'Provider'
                );
                const when = bid.createdAt ? formatDateTime(bid.createdAt) : 'Unknown';
                const amount = Number(bid.amount || 0).toFixed(2);
                const expiry = firstText(bid.bidExpiryDate, 'N/A') + (bid.bidExpiryTime ? ' ' + bid.bidExpiryTime : '');
                return '<tr>' +
                    '<td class="legacy-bidder-cell"><span class="legacy-bidder-icon">+</span>' + escapeHtml(bidder) + '</td>' +
                    '<td>€' + amount + '</td>' +
                    '<td>' + escapeHtml(when) + '</td>' +
                    '<td><strong>P:</strong> ' + escapeHtml(dateLabel) + '<br><strong>D:</strong> ' + escapeHtml(dateLabel) + '</td>' +
                    '<td>' + escapeHtml(expiry) + '</td>' +
                    '<td><button type="button" class="legacy-bids-view-btn">VIEW</button></td>' +
                    '</tr>';
            }).join('') +
            '</tbody></table>';
    }

    function setupBidForm(quoteId, quote) {
        const form = document.getElementById('bid-form');
        if (!form) return;

        const templateEl = document.getElementById('bid-template');
        const messageEl = document.getElementById('bid-message');

        if (templateEl && messageEl) {
            templateEl.addEventListener('change', function () {
                if (!String(messageEl.value || '').trim() && String(templateEl.value || '').trim()) {
                    messageEl.value = templateEl.value;
                }
            });
        }

        form.addEventListener('submit', function (evt) {
            evt.preventDefault();

            const amountEl = document.getElementById('bid-amount');
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

            let allBids = [];
            try {
                const parsed = JSON.parse(localStorage.getItem(BID_STORAGE_KEY) || '[]');
                allBids = Array.isArray(parsed) ? parsed : [];
            } catch (error) {
                allBids = [];
            }

            allBids.push({
                id: 'bid-' + Date.now(),
                quoteId: quoteId,
                providerId: user.id,
                providerUsername: firstText(user.username, user.nickname, user.handle),
                providerNickname: firstText(user.username, user.nickname, user.handle),
                providerName: firstText(user.name, user.email, 'Provider'),
                providerEmail: firstText(user.email),
                amount: amount,
                message: messageEl ? String(messageEl.value || '') : '',
                messageTemplate: templateEl ? String(templateEl.value || '') : '',
                bidExpiryDate: expireDateEl ? String(expireDateEl.value || '') : '',
                bidExpiryTime: expireTimeEl ? String(expireTimeEl.value || '') : '',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            localStorage.setItem(BID_STORAGE_KEY, JSON.stringify(allBids));
            if (form) form.reset();
            initializeBidFormDefaults(quote);
            renderBids(quoteId, quote);
        });
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
            ['Pickup time', getPickupTime(quote)],
            ['Delivery time', getDeliveryTime(quote)],
            ['Date', getMoveDate(quote)],
            ['Movers', getMoversRequired(quote)],
            ['Special instructions', firstText(quote.serviceSpecialInstructions, quote.instructions, quote.notes, 'None')],
            ['Status', firstText(quote.status, 'pending') || 'pending']
        ];

        root.innerHTML = '<section class="form-section-card compact-form-section">' +
            '<h3 class="form-section-title">Key Details</h3>' +
            '<div class="compact-details-table">' + fields.map(function (pair) {
                return '<div class="compact-detail-row"><span class="compact-detail-label">' + escapeHtml(pair[0]) + ':</span><span class="compact-detail-value">' + escapeHtml(pair[1]) + '</span></div>';
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

        geocodeAddress(pickupAddress).then(function (pickupCoord) {
            return geocodeAddress(deliveryAddress).then(function (deliveryCoord) {
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
                        new mapboxgl.Marker({ color: '#22a06b' }).setLngLat(pickupCoord).addTo(map);
                        bounds.extend(pickupCoord);
                    }

                    if (deliveryCoord) {
                        new mapboxgl.Marker({ color: '#e62f7a' }).setLngLat(deliveryCoord).addTo(map);
                        bounds.extend(deliveryCoord);
                    }

                    if (pickupCoord && deliveryCoord) {
                        fetchRouteDetails(pickupCoord, deliveryCoord).then(function (routeDetails) {
                            renderInlineRouteDetails(routeDetails, pickupAddress, deliveryAddress);
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

    function getPickupLabel(quote) {
        return firstText(
            quote.pickupAddress,
            quote.pickupCity,
            quote.pickupLocation,
            quote.pickupTown,
            'Not provided'
        );
    }

    function getPickupDisplayLabel(quote) {
        const location = getPickupLabel(quote);
        const property = getPropertyPickupType(quote);
        if (!property || property === 'Not provided') return location;
        return location + ' (' + property + ')';
    }

    function getDeliveryLabel(quote) {
        return firstText(
            quote.deliveryAddress,
            quote.deliveryCity,
            quote.deliveryLocation,
            quote.deliveryTown,
            'Not provided'
        );
    }

    function getDeliveryDisplayLabel(quote) {
        const location = getDeliveryLabel(quote);
        const property = getPropertyDeliveryType(quote);
        if (!property || property === 'Not provided') return location;
        return location + ' (' + property + ')';
    }

    function getPickupTime(quote) {
        return firstText(quote.preferredPickupTime, quote.pickupTime, quote.timeWindowPickup, 'Flexible');
    }

    function getDeliveryTime(quote) {
        return firstText(quote.preferredDeliveryTime, quote.deliveryTime, quote.timeWindowDelivery, 'Flexible');
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
