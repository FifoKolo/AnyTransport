(function () {
    const LISTING_STORAGE_KEY = 'anytransport_quote_requests';
    const BID_STORAGE_KEY = 'anytransport_provider_bids';
    const ANYTRANSPORT_MAPBOX_TOKEN = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ';

    document.addEventListener('DOMContentLoaded', initListingDetailsPage);

    function initListingDetailsPage() {
        const quoteId = getQuoteIdFromUrl();
        const titleEl = document.getElementById('details-title');
        const subtitleEl = document.getElementById('details-subtitle');

        if (!quoteId) {
            titleEl.textContent = 'Listing not found';
            subtitleEl.textContent = 'Missing quoteId in URL.';
            renderMissingState('No listing was selected. Open a listing from the provider board.');
            return;
        }

        const quote = getAllQuotes().find((entry) => String((entry && entry.id) || '').trim() === quoteId);
        if (!quote) {
            titleEl.textContent = 'Listing not found';
            subtitleEl.textContent = 'The selected listing does not exist in local storage.';
            renderMissingState('This listing may have been removed or not created on this browser yet.');
            return;
        }

        titleEl.textContent = getQuoteTitle(quote);
        subtitleEl.textContent = 'Listing ' + quoteId + ' • Full submitted form details';

        renderQuickInfo(quote);
        renderMap(quote);
        renderInventory(quote);
        renderBidUserContext();
        renderBids(quoteId);
        setupBidForm(quoteId);
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

    function getQuoteIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return String(params.get('quoteId') || '').trim();
    }

    function getAllQuotes() {
        try {
            const parsed = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (error) {
            return [];
        }
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

        const cards = [
            ['Pickup', getPickupLabel(quote)],
            ['Delivery', getDeliveryLabel(quote)],
            ['Movers Required', getMoversRequired(quote)],
            ['Required Date', getMoveDate(quote)],
            ['Service', getServiceLabel(quote)],
            ['Pickup Time', getPickupTime(quote)],
            ['Delivery Time', getDeliveryTime(quote)],
            ['Status', firstText(quote.status, 'pending') || 'pending']
        ];

        quick.innerHTML = cards.map(function (card) {
            return '<article class="quick-item"><span class="quick-label">' + escapeHtml(card[0]) + '</span><span class="quick-value">' + escapeHtml(card[1]) + '</span></article>';
        }).join('');
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

        map.on('load', function () {
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
        if (!inventoryEl) return;

        const items = collectInventoryItems(quote);
        if (!items.length) {
            inventoryEl.innerHTML = '<div class="empty-inventory">No items specified for this listing.</div>';
            return;
        }

        inventoryEl.innerHTML = items.map(function (item) {
            const qtyHtml = item.qty ? '<div class="inventory-item-qty">' + escapeHtml(String(item.qty)) + '</div>' : '';
            return '<div class="inventory-item"><div class="inventory-item-name">' + escapeHtml(item.name) + '</div>' + qtyHtml + '</div>';
        }).join('');
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

    function renderBids(quoteId) {
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

        if (!quoteBids.length) {
            historyEl.innerHTML = '<div class="empty-bids">No bids yet. Be the first to bid.</div>';
            return;
        }

        historyEl.innerHTML = '<h3 class="bid-history-header">Current Bids (' + quoteBids.length + ')</h3>' +
            '<div class="bid-history-list">' +
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
                return '<div class="bid-item">' +
                    '<div class="bid-item-info">' +
                    '<div class="bid-item-user">' + escapeHtml(bidder) + '</div>' +
                    '<div class="bid-item-time">' + escapeHtml(when) + '</div>' +
                    '</div>' +
                    '<div class="bid-item-amount">€' + amount + '</div>' +
                    '</div>';
            }).join('') +
            '</div>';
    }

    function setupBidForm(quoteId) {
        const form = document.getElementById('bid-form');
        if (!form) return;

        form.addEventListener('submit', function (evt) {
            evt.preventDefault();

            const amountEl = document.getElementById('bid-amount');
            const messageEl = document.getElementById('bid-message');
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
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            localStorage.setItem(BID_STORAGE_KEY, JSON.stringify(allBids));
            if (form) form.reset();
            renderBids(quoteId);
            alert('Bid submitted successfully.');
        });
    }

    function renderFormSections(quote) {
        const root = document.getElementById('details-form-sections');
        if (!root) return;

        const submitterProfile = resolveSubmitterProfile(quote);

        const sections = [
            {
                title: 'Move Summary',
                fields: [
                    ['Property Type', firstText(quote.propertyType, quote['pickup-property-type'], quote.pickupPropertyType)],
                    ['Property Delivery Type', getPropertyDeliveryType(quote)],
                    ['Description', firstText(quote.itemDescription, quote.description)],
                    ['Step 6 Services', getStepSixServicesLabel(quote)],
                    ['Special Instructions', firstText(quote.serviceSpecialInstructions, quote.instructions, quote.notes)],
                    ['Overview Notes', firstText(quote.overviewNotes, quote.summaryNotes)]
                ]
            },
            {
                title: 'Route & Timing',
                fields: [
                    ['Route Distance', formatDistance(quote)],
                    ['Route Duration', firstText(quote.routeDurationText, quote.routeDuration, quote.durationText)],
                    ['Required Date', getMoveDate(quote)],
                    ['Pickup Time', getPickupTime(quote)],
                    ['Delivery Time', getDeliveryTime(quote)],
                    ['Date Flexibility', firstText(quote.timeFlexibility, quote.transportDateMode)]
                ]
            },
            {
                title: 'Labour & Access',
                fields: [
                    ['Movers Required', getMoversRequired(quote)],
                    ['Pickup Lift', firstText(quote.pickupLift, quote.pickupLiftAvailable, quote['pickup-lift-available'])],
                    ['Delivery Lift', firstText(quote.deliveryLift, quote.deliveryLiftAvailable, quote['delivery-lift-available'])],
                    ['Pickup Floor', firstText(quote.pickupFloorSelect, quote.pickupFloor)],
                    ['Delivery Floor', firstText(quote.deliveryFloorSelect, quote.deliveryFloor)]
                ]
            },
            {
                title: 'Customer Profile',
                fields: [
                    ['Username', firstText(submitterProfile && submitterProfile.username, quote.customerUsername, quote.username)],
                    ['Name', firstText(submitterProfile && submitterProfile.name, quote.customerName)],
                    ['Email', firstText(submitterProfile && submitterProfile.email, quote.customerEmail)],
                    ['Phone', firstText(submitterProfile && submitterProfile.phone, submitterProfile && submitterProfile.contact, quote.customerPhone)],
                    ['City', firstText(submitterProfile && submitterProfile.city, quote.customerCity)]
                ]
            }
        ];

        root.innerHTML = sections.map(function (section) {
            const rows = section.fields
                .filter(function (pair) {
                    return String(pair[1] || '').trim() !== '';
                })
                .map(function (pair) {
                    return '<div class="form-field-row">' +
                        '<span class="form-field-label">' + escapeHtml(pair[0]) + '</span>' +
                        '<span class="form-field-value">' + escapeHtml(pair[1]) + '</span>' +
                        '</div>';
                }).join('');

            const content = section.title === 'Route & Timing'
                ? renderRouteSectionCard(quote, rows)
                : '<div class="form-section-fields">' + (rows || '<div class="form-field-row"><span class="form-field-value">No submitted values.</span></div>') + '</div>';

            return '<section class="form-section-card">' +
                '<h3 class="form-section-title">' + escapeHtml(section.title) + '</h3>' +
                content +
                '</section>';
        }).join('');

        initInlineRouteMap(quote);
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

    function getDeliveryLabel(quote) {
        return firstText(
            quote.deliveryAddress,
            quote.deliveryCity,
            quote.deliveryLocation,
            quote.deliveryTown,
            'Not provided'
        );
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

        const pickupValue = pickupMode === 'unsure'
            ? 'Pickup: Movers decide'
            : 'Pickup: ' + (firstText(quote.servicePickupMovers, quote['service-pickup-movers'], quote.pickupMovers) || 'Not provided');

        const deliveryValue = deliveryMode === 'unsure'
            ? 'Delivery: Movers decide'
            : 'Delivery: ' + (firstText(quote.serviceDeliveryMovers, quote['service-delivery-movers'], quote.deliveryMovers) || 'Not provided');

        return pickupValue + ' | ' + deliveryValue;
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
})();
