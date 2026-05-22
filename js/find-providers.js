(function () {
    'use strict';

    const MAPBOX_TOKEN = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ';
    const RADIUS_SOURCE_ID = 'customer-search-radius';
    const RADIUS_FILL_LAYER_ID = 'customer-search-radius-fill';
    const RADIUS_LINE_LAYER_ID = 'customer-search-radius-line';

    let map = null;
    let mapReady = false;
    let markers = [];
    let customerMarker = null;
    let lastResults = [];
    let activeProviderId = '';
    let lastSearchGeo = null;
    let lastSearchMaxKm = 100;
    let customerQuotesCache = null;
    let inviteTargetProvider = null;

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function firstText() {
        for (let i = 0; i < arguments.length; i += 1) {
            const v = arguments[i];
            if (v != null && String(v).trim() !== '') return String(v);
        }
        return '';
    }

    function setStatus(text, isError) {
        const el = document.getElementById('find-providers-status');
        if (!el) return;
        el.textContent = text || '';
        el.classList.toggle('find-providers-status--error', !!isError);
    }

    function getMaxKmInput() {
        const maxKmInput = document.getElementById('customer-search-max-km');
        return Math.max(5, Math.min(300, Number(maxKmInput && maxKmInput.value) || 100));
    }

    function createCirclePolygon(lng, lat, radiusKm, points) {
        const count = points || 64;
        const coords = [];
        const kmPerDegLat = 110.574;
        const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
        const dLng = radiusKm / (kmPerDegLng || 1);
        const dLat = radiusKm / kmPerDegLat;
        for (let i = 0; i < count; i += 1) {
            const theta = (i / count) * 2 * Math.PI;
            coords.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
        }
        coords.push(coords[0]);
        return {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] }
        };
    }

    function updateSearchRadiusCircle() {
        const m = map;
        if (!m || !mapReady || !lastSearchGeo) return;

        const radiusKm = lastSearchMaxKm;
        const feature = createCirclePolygon(lastSearchGeo.lng, lastSearchGeo.lat, radiusKm);

        if (m.getSource(RADIUS_SOURCE_ID)) {
            m.getSource(RADIUS_SOURCE_ID).setData(feature);
            return;
        }

        m.addSource(RADIUS_SOURCE_ID, { type: 'geojson', data: feature });
        m.addLayer({
            id: RADIUS_FILL_LAYER_ID,
            type: 'fill',
            source: RADIUS_SOURCE_ID,
            paint: {
                'fill-color': '#0ea5e9',
                'fill-opacity': 0.12
            }
        });
        m.addLayer({
            id: RADIUS_LINE_LAYER_ID,
            type: 'line',
            source: RADIUS_SOURCE_ID,
            paint: {
                'line-color': '#0284c7',
                'line-width': 2,
                'line-dasharray': [2, 2]
            }
        });
    }

    function ensureMap() {
        if (!window.mapboxgl || !MAPBOX_TOKEN) return null;
        mapboxgl.accessToken = MAPBOX_TOKEN;
        const container = document.getElementById('find-providers-map');
        if (!container) return null;
        if (map) return map;
        map = new mapboxgl.Map({
            container: 'find-providers-map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-7.5, 53.4],
            zoom: 6
        });
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        map.on('load', function () {
            mapReady = true;
            updateSearchRadiusCircle();
        });
        return map;
    }

    async function geocodeQuery(query) {
        const q = String(query || '').trim();
        if (!q) return null;
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/'
            + encodeURIComponent(q)
            + '.json?access_token=' + encodeURIComponent(MAPBOX_TOKEN)
            + '&limit=1&country=ie,gb&types=address,place,locality,postcode';
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        const feature = data && data.features && data.features[0];
        if (!feature || !Array.isArray(feature.center) || feature.center.length < 2) return null;
        return {
            lng: Number(feature.center[0]),
            lat: Number(feature.center[1]),
            label: String(feature.place_name || q)
        };
    }

    function clearMarkers() {
        markers.forEach(function (m) {
            try { m.remove(); } catch (_e) {}
        });
        markers = [];
    }

    function providerDisplayName(p) {
        return firstText(p.businessName, p.username, 'Provider');
    }

    function providerLocationLabel(p) {
        if (p.showExactAddressOnMap && p.serviceAreaAddress) {
            return p.serviceAreaAddress + (p.serviceAreaCity ? ', ' + p.serviceAreaCity : '');
        }
        return firstText(p.serviceAreaCity, 'Location not set');
    }

    function focusProvider(providerId) {
        activeProviderId = String(providerId || '');
        document.querySelectorAll('.find-provider-card').forEach(function (card) {
            card.classList.toggle('is-active', card.getAttribute('data-provider-id') === activeProviderId);
        });
        const provider = lastResults.find(function (p) {
            return String(p.id) === activeProviderId;
        });
        if (!provider || !map) return;
        map.flyTo({ center: [provider.mapLng, provider.mapLat], zoom: 11, duration: 800 });
    }

    async function loadCustomerQuotes() {
        if (customerQuotesCache) return customerQuotesCache;
        const me = window.auth && typeof window.auth.getUser === 'function' ? window.auth.getUser() : null;
        if (!me || !me.id) return [];
        let quotes = [];
        if (window.anytransportApi && typeof window.anytransportApi.getQuotes === 'function') {
            try {
                quotes = await Promise.resolve(window.anytransportApi.getQuotes(me.id));
            } catch (_e) {
                quotes = [];
            }
        }
        if (!quotes.length) {
            try {
                const raw = localStorage.getItem('anytransport_quote_requests');
                const parsed = raw ? JSON.parse(raw) : [];
                quotes = Array.isArray(parsed) ? parsed : [];
            } catch (_e2) {
                quotes = [];
            }
        }
        customerQuotesCache = quotes.filter(function (q) {
            return q && String(q.id || '').trim();
        });
        return customerQuotesCache;
    }

    function openInviteModal(provider) {
        inviteTargetProvider = provider;
        const modal = document.getElementById('invite-provider-modal');
        const sub = document.getElementById('invite-modal-provider');
        const select = document.getElementById('invite-quote-select');
        const status = document.getElementById('invite-modal-status');
        if (!modal || !select) return;
        if (sub) {
            sub.textContent = 'Invite ' + providerDisplayName(provider) + ' to submit a quote on your form.';
        }
        if (status) {
            status.textContent = '';
            status.classList.remove('find-invite-modal-status--error');
        }
        select.innerHTML = '<option value="">Loading your forms…</option>';
        modal.hidden = false;

        loadCustomerQuotes().then(function (quotes) {
            if (!quotes.length) {
                select.innerHTML = '<option value="">No request forms yet</option>';
                return;
            }
            select.innerHTML = [
                '<option value="">Select a form…</option>'
            ].concat(quotes.map(function (q) {
                const fid = String(q.formId || q.id || '').trim();
                const label = (fid ? 'Form ' + fid : 'Request') + ' — ' + firstText(q.itemType, q.itemDescription, 'Transport');
                return '<option value="' + escapeHtml(String(q.id || '')) + '">' + escapeHtml(label) + '</option>';
            })).join('');
        });
    }

    function closeInviteModal() {
        const modal = document.getElementById('invite-provider-modal');
        if (modal) modal.hidden = true;
        inviteTargetProvider = null;
    }

    async function submitInvite() {
        const select = document.getElementById('invite-quote-select');
        const status = document.getElementById('invite-modal-status');
        const quoteId = select ? String(select.value || '').trim() : '';
        if (!inviteTargetProvider || !quoteId) {
            if (status) {
                status.textContent = 'Choose one of your request forms.';
                status.classList.add('find-invite-modal-status--error');
            }
            return;
        }
        if (!window.anytransportApi || typeof window.anytransportApi.inviteProviderToQuote !== 'function') {
            if (status) {
                status.textContent = 'Invitations are not available right now.';
                status.classList.add('find-invite-modal-status--error');
            }
            return;
        }
        if (status) {
            status.textContent = 'Sending invitation…';
            status.classList.remove('find-invite-modal-status--error');
        }
        try {
            const result = await window.anytransportApi.inviteProviderToQuote(
                quoteId,
                inviteTargetProvider.id,
                {
                    lat: lastSearchGeo ? lastSearchGeo.lat : 0,
                    lng: lastSearchGeo ? lastSearchGeo.lng : 0,
                    maxKm: lastSearchMaxKm
                }
            );
            if (status) {
                status.textContent = result && result.alreadyInvited
                    ? 'This provider was already invited to that form.'
                    : 'Invitation sent. They will be notified by email and in their dashboard.';
            }
        } catch (err) {
            if (status) {
                status.textContent = err && err.message ? err.message : 'Could not send invitation.';
                status.classList.add('find-invite-modal-status--error');
            }
        }
    }

    function renderResults(providers, searchLabel) {
        lastResults = Array.isArray(providers) ? providers : [];
        const head = document.getElementById('find-providers-list-head');
        const body = document.getElementById('find-providers-list-body');
        if (head) {
            head.textContent = lastResults.length
                ? (lastResults.length + ' provider' + (lastResults.length === 1 ? '' : 's') + ' within ' + lastSearchMaxKm + ' km')
                : 'No providers in range';
        }
        if (!body) return;

        if (!lastResults.length) {
            body.innerHTML = '<p class="find-providers-empty">No approved providers in your search area. Try increasing your search radius or a different location.</p>';
            clearMarkers();
            updateSearchRadiusCircle();
            return;
        }

        body.innerHTML = lastResults.map(function (p) {
            const name = providerDisplayName(p);
            const loc = providerLocationLabel(p);
            const dist = p.distanceKm != null ? (p.distanceKm + ' km away') : '';
            const services = Array.isArray(p.services) && p.services.length
                ? p.services.slice(0, 4).join(' · ')
                : 'General transport';
            const selectedQuoteId = select ? String(select.value || '').trim() : '';
            const msgUrl = 'messages.html?to=' + encodeURIComponent(String(p.id || ''))
                + (selectedQuoteId ? ('&quoteId=' + encodeURIComponent(selectedQuoteId)) : '');
            const canInvite = !p.blockInvites;
            const inviteBtn = canInvite
                ? '<button type="button" class="btn btn-outline btn-sm find-invite-btn" data-provider-id="' + escapeHtml(String(p.id || '')) + '">Invite to quote</button>'
                : '<span class="profile-help" style="font-size:12px;">Not accepting invites</span>';
            return [
                '<article class="find-provider-card" data-provider-id="' + escapeHtml(String(p.id || '')) + '">',
                '<h3>' + escapeHtml(name) + '</h3>',
                '<p class="find-provider-meta">' + escapeHtml(loc) + (dist ? ' · ' + escapeHtml(dist) : '') + '</p>',
                '<p class="find-provider-services">' + escapeHtml(services) + '</p>',
                '<div class="find-provider-actions">',
                '<a class="btn btn-primary btn-sm" href="' + escapeHtml(msgUrl) + '">Message</a>',
                inviteBtn,
                '</div>',
                '</article>'
            ].join('');
        }).join('');

        body.querySelectorAll('.find-provider-card').forEach(function (card) {
            card.addEventListener('click', function (event) {
                if (event.target.closest('a, button')) return;
                focusProvider(card.getAttribute('data-provider-id'));
            });
        });

        body.querySelectorAll('.find-invite-btn').forEach(function (btn) {
            btn.addEventListener('click', function (event) {
                event.stopPropagation();
                const pid = btn.getAttribute('data-provider-id');
                const provider = lastResults.find(function (p) { return String(p.id) === String(pid); });
                if (provider) openInviteModal(provider);
            });
        });

        clearMarkers();
        const m = ensureMap();
        if (!m) return;

        updateSearchRadiusCircle();

        const bounds = new mapboxgl.LngLatBounds();
        if (lastSearchGeo) {
            bounds.extend([lastSearchGeo.lng, lastSearchGeo.lat]);
        }

        lastResults.forEach(function (p) {
            if (!p.mapLat || !p.mapLng) return;
            const el = document.createElement('div');
            el.className = 'find-provider-marker';
            el.style.cssText = 'width:14px;height:14px;border-radius:50%;background:#0ea5e9;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.25);cursor:pointer;';
            const popupHtml = '<strong>' + escapeHtml(providerDisplayName(p)) + '</strong><br>'
                + escapeHtml(providerLocationLabel(p))
                + (p.distanceKm != null ? '<br>' + escapeHtml(String(p.distanceKm)) + ' km from you' : '')
                + (p.blockInvites ? '' : '<br><em>Click list card to invite or message</em>');
            const marker = new mapboxgl.Marker({ element: el })
                .setLngLat([p.mapLng, p.mapLat])
                .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(popupHtml))
                .addTo(m);
            el.addEventListener('click', function () {
                focusProvider(p.id);
            });
            markers.push(marker);
            bounds.extend([p.mapLng, p.mapLat]);
        });

        if (!bounds.isEmpty()) {
            m.fitBounds(bounds, { padding: 60, maxZoom: 12 });
        }
    }

    async function runSearch() {
        const locationInput = document.getElementById('customer-search-location');
        const categoryInput = document.getElementById('customer-search-category');
        const query = locationInput ? String(locationInput.value || '').trim() : '';
        if (!query) {
            setStatus('Enter your town, city, or address.', true);
            return;
        }

        if (!window.auth || !window.auth.isLoggedIn || !window.auth.isLoggedIn()) {
            setStatus('Please log in to search for providers.', true);
            window.location.href = 'index.html';
            return;
        }

        if (!window.anytransportApi || typeof window.anytransportApi.searchProviders !== 'function') {
            setStatus('Provider search is not available. Try again later.', true);
            return;
        }

        setStatus('Finding your location on the map…');
        const geo = await geocodeQuery(query);
        if (!geo) {
            setStatus('Could not find that location. Try a town name or full address.', true);
            return;
        }

        lastSearchGeo = geo;
        lastSearchMaxKm = getMaxKmInput();

        const m = ensureMap();
        if (m) {
            if (customerMarker) {
                try { customerMarker.remove(); } catch (_e) {}
            }
            customerMarker = new mapboxgl.Marker({ color: '#16a34a' })
                .setLngLat([geo.lng, geo.lat])
                .setPopup(new mapboxgl.Popup().setText('Your search location'))
                .addTo(m);
            updateSearchRadiusCircle();
            m.flyTo({ center: [geo.lng, geo.lat], zoom: getZoomForRadius(lastSearchMaxKm) });
        }

        const category = categoryInput ? String(categoryInput.value || '').trim().toLowerCase() : '';

        setStatus('Searching for providers…');
        try {
            const providers = window.anytransportApi.searchProviders(geo.lat, geo.lng, {
                maxKm: lastSearchMaxKm,
                category: category
            });
            renderResults(providers, geo.label);
            setStatus(providers.length
                ? ('Showing providers within your ' + lastSearchMaxKm + ' km search radius.')
                : 'No providers matched. They must be approved and have a town/city on their profile.');
        } catch (err) {
            setStatus(err && err.message ? err.message : 'Search failed.', true);
        }
    }

    function getZoomForRadius(km) {
        if (km <= 15) return 10;
        if (km <= 30) return 9;
        if (km <= 60) return 8;
        if (km <= 120) return 7;
        return 6;
    }

    function init() {
        if (window.auth && typeof window.auth.initAuth === 'function') {
            window.auth.initAuth();
        }
        const searchBtn = document.getElementById('customer-search-btn');
        const locationInput = document.getElementById('customer-search-location');
        const maxKmInput = document.getElementById('customer-search-max-km');

        if (searchBtn) {
            searchBtn.addEventListener('click', function () {
                runSearch().catch(function (e) {
                    console.error(e);
                    setStatus('Search failed.', true);
                });
            });
        }
        if (locationInput) {
            locationInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    runSearch().catch(console.error);
                }
            });
        }
        if (maxKmInput) {
            maxKmInput.addEventListener('change', function () {
                lastSearchMaxKm = getMaxKmInput();
                updateSearchRadiusCircle();
                if (lastSearchGeo) {
                    setStatus('Radius updated to ' + lastSearchMaxKm + ' km. Click Search to refresh results.');
                }
            });
        }

        document.querySelectorAll('[data-invite-close]').forEach(function (el) {
            el.addEventListener('click', closeInviteModal);
        });
        const inviteSubmit = document.getElementById('invite-provider-submit');
        if (inviteSubmit) {
            inviteSubmit.addEventListener('click', function () {
                submitInvite().catch(console.error);
            });
        }

        ensureMap();

        const me = window.auth && typeof window.auth.getUser === 'function' ? window.auth.getUser() : null;
        if (me && me.city && locationInput && !locationInput.value) {
            locationInput.value = String(me.city);
        }
    }

    document.addEventListener('DOMContentLoaded', init);
})();
