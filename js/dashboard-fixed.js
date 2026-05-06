// Dashboard supports both customer and provider workflows.
(function () {
    const BID_STORAGE_KEY = 'anytransport_provider_bids';
    const LISTING_STORAGE_KEY = 'anytransport_quote_requests';
    const DEMO_PROVIDER_LISTING_ID = 'demo-provider-listing';
    const ANYTRANSPORT_MAPBOX_TOKEN = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ';
    const BID_TEMPLATES = {
        available: 'Hi, we are available for your requested date and route. We can collect and deliver safely within your preferred window.',
        insured: 'Your shipment is covered by goods-in-transit insurance and handled by an experienced crew. Happy to confirm details today.',
        express: 'We can offer an express slot with priority collection and direct delivery. Please confirm if this timeline works for you.',
        custom: ''
    };

    const state = {
        activeProviderMode: 'dashboard',
        dashboardScope: 'watching',
        dashboardListingId: '',
        searchListingId: '',
        searchKeyword: '',
        searchCategory: '',
        searchCity: '',
        distanceMin: '',
        distanceMax: '',
        dateFilter: '',
        expandedQuoteIds: new Set(),
        focusedFormId: '',
        activeTab: '',
        adminReviewQuery: '',
        adminShowRejected: false,
        adminReviewRefreshTimer: null
    };

    function isStorageQuotaError(error) {
        if (!error) return false;
        const name = String(error.name || '').toLowerCase();
        const message = String(error.message || '').toLowerCase();
        return name === 'quotaexceedederror'
            || name === 'nserror_dom_quota_reached'
            || message.includes('quota')
            || message.includes('exceeded the quota');
    }

    function stripHeavyMediaFields(value) {
        if (Array.isArray(value)) {
            return value.map(stripHeavyMediaFields);
        }

        if (!value || typeof value !== 'object') {
            return value;
        }

        const result = {};
        Object.keys(value).forEach((key) => {
            if (key === 'previewDataUrl' || key === 'previewUrl' || key === 'dataUrl') {
                return;
            }
            result[key] = stripHeavyMediaFields(value[key]);
        });
        return result;
    }

    function saveQuotesToStorage(quotes) {
        const normalized = Array.isArray(quotes) ? quotes : [];
        const candidates = [normalized, stripHeavyMediaFields(normalized)];
        let quotaError = null;

        for (let i = 0; i < candidates.length; i += 1) {
            try {
                localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify(candidates[i]));
                return candidates[i];
            } catch (error) {
                if (!isStorageQuotaError(error)) {
                    throw error;
                }
                quotaError = error;
            }
        }

        throw new Error(
            quotaError && quotaError.message
                ? quotaError.message
                : 'Storage is full. Please remove old items or attachments and try again.'
        );
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
            reader.readAsDataURL(file);
        });
    }

    function isProviderPendingReview(user) {
        const role = String(user && user.role || '').toLowerCase().trim();
        if (role !== 'provider') return false;
        const status = String(user && user.identityReviewStatus || '').trim();
        if (status === '') return true;
        return status === 'pending_review';
    }

    function getPendingProvidersForReview() {
        let providers = [];

        // Preferred path: dedicated admin queue endpoint.
        try {
            if (window.anytransportApi && typeof window.anytransportApi.getIdentityReviewQueue === 'function') {
                providers = window.anytransportApi.getIdentityReviewQueue();
                if (Array.isArray(providers)) {
                    return providers;
                }
            }
        } catch (_error) {
            // Continue with fallbacks.
        }

        // Web-safe fallback: fetch all users and filter providers client-side.
        try {
            if (window.anytransportApi && typeof window.anytransportApi.getUsers === 'function') {
                const users = window.anytransportApi.getUsers();
                if (Array.isArray(users) && users.length) {
                    providers = users.filter(isProviderPendingReview);
                    if (providers.length) {
                        return providers;
                    }
                }
            }
        } catch (_error) {
            // Continue with local fallback.
        }

        // Local file:// fallback.
        try {
            const users = auth && typeof auth.loadUsers === 'function' ? auth.loadUsers() : [];
            if (Array.isArray(users) && users.length) {
                providers = users.filter(isProviderPendingReview);
            }
        } catch (_error) {
            providers = [];
        }

        return providers;
    }

    function getAllProvidersForAdmin() {
        let providers = [];
        try {
            if (window.anytransportApi && typeof window.anytransportApi.getUsers === 'function') {
                const users = window.anytransportApi.getUsers();
                if (Array.isArray(users) && users.length) {
                    providers = users.filter((user) => String(user && user.role || '').toLowerCase().trim() === 'provider');
                    return providers;
                }
            }
        } catch (_error) {}

        try {
            const users = auth && typeof auth.loadUsers === 'function' ? auth.loadUsers() : [];
            if (Array.isArray(users) && users.length) {
                providers = users.filter((user) => String(user && user.role || '').toLowerCase().trim() === 'provider');
            }
        } catch (_error) {
            providers = [];
        }
        return providers;
    }

    function getAllUsersForAdmin() {
        try {
            if (window.anytransportApi && typeof window.anytransportApi.getUsers === 'function') {
                const users = window.anytransportApi.getUsers();
                if (Array.isArray(users) && users.length) {
                    return users;
                }
            }
        } catch (_error) {}

        try {
            const users = auth && typeof auth.loadUsers === 'function' ? auth.loadUsers() : [];
            if (Array.isArray(users) && users.length) {
                return users;
            }
        } catch (_error) {}
        return [];
    }

    document.addEventListener('DOMContentLoaded', initDashboard);

    function initDashboard() {
        if (!auth || !auth.isLoggedIn || !auth.isLoggedIn()) {
            alert('You need to sign in to access your dashboard');
            window.location.href = 'index.html';
            return;
        }

        const user = auth.getUser();
        // provider-mode 'profile' has been removed from the UI; no action required here
        if (!user) {
            alert('Session expired. Please sign in again.');
            window.location.href = 'index.html';
            return;
        }

        const me = auth.getUser && auth.getUser();
        const isProvider = auth.isProvider && auth.isProvider();
        const canBeProvider = isProvider && me && (me.verified === true || String(me.identityReviewStatus || '') === 'approved');
        if (isProvider && !canBeProvider) {
            alert('Your provider account is not yet approved. You will be redirected until approval.');
            window.setTimeout(() => {
                window.location.href = 'index.html';
            }, 0);
            return;
        }

        const adminReviewNav = document.getElementById('admin-review-nav');
        if (adminReviewNav) {
            adminReviewNav.style.display = auth.isAdmin && auth.isAdmin() ? '' : 'none';
        }

        // If the inline nav only contains one visible item (e.g. only "Profile"), hide it to avoid a lonely pill.
        consolidateInlineNav();

        loadUserInfo(user);
        wireTabs();
        wireProviderControls(user);
        wireDashboardActions(user);
        loadProfileForm(user);
        ensureDemoListingsExist();
        applyFocusedFormContext();
        renderAll(user);

        if (canBeProvider) {
            showTab('provider-board');
        } else {
            showTab('provider-board');
            hideProviderOnlyTabs();
        }

        // If the signed-in user is an admin, restrict the UI to admin-only views.
        if (auth.isAdmin && auth.isAdmin()) {
            document.querySelectorAll('.nav-item').forEach((item) => {
                try {
                    if (item.getAttribute('data-tab') !== 'verification-review') item.style.display = 'none';
                } catch (_e) {
                    // ignore
                }
            });
            const modeSwitch = document.getElementById('provider-mode-switch');
            if (modeSwitch) modeSwitch.style.display = 'none';
            // Ensure admin sees the verification review immediately
            showTab('verification-review');
            // Re-check inline nav visibility after adjustments
            consolidateInlineNav();
            return;
        }

        // Re-check inline nav visibility after provider-only tabs may have been hidden
        consolidateInlineNav();

        if (state.focusedFormId && auth.isProvider && auth.isProvider()) {
            requestAnimationFrame(() => focusHighlightedProviderListing());
        }
    }

    function applyFocusedFormContext() {
        let focused = '';
        try {
            const params = new URLSearchParams(window.location.search || '');
            focused = String(params.get('newFormId') || '').trim();
        } catch (_error) {
            focused = '';
        }

        if (!/^\d{5}$/.test(focused)) {
            focused = String(sessionStorage.getItem('pending_quote_form_id') || localStorage.getItem('pending_quote_form_id') || '').trim();
        }

        if (!/^\d{5}$/.test(focused)) {
            state.focusedFormId = '';
            return;
        }

        state.focusedFormId = focused;
        state.activeProviderMode = 'dashboard';
        state.dashboardScope = 'watching';
        state.distanceMin = '';
        state.distanceMax = '';
        state.dateFilter = '';
        state.dashboardListingId = focused;
        state.searchListingId = focused;

        const dashboardIdSearch = document.getElementById('dashboard-id-search');
        if (dashboardIdSearch) dashboardIdSearch.value = focused;

        const searchListingId = document.getElementById('search-listing-id');
        if (searchListingId) searchListingId.value = focused;

        try {
            sessionStorage.removeItem('pending_quote_form_id');
            sessionStorage.removeItem('pending_quote_id');
            localStorage.removeItem('pending_quote_form_id');
            localStorage.removeItem('pending_quote_id');
            const currentUrl = new URL(window.location.href);
            currentUrl.searchParams.delete('newFormId');
            window.history.replaceState({}, document.title, currentUrl.toString());
        } catch (_error) {
            // Ignore URL/storage update failures in restrictive environments.
        }
    }

    function focusHighlightedProviderListing() {
        const highlighted = document.querySelector('.provider-listing.is-focused-form');
        if (!highlighted) return;
        highlighted.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function hideProviderOnlyTabs() {
        document.querySelectorAll('.nav-item[data-tab="provider-board"], .nav-item[data-tab="my-bids"]').forEach((item) => {
            item.style.display = 'none';
        });
    }

    function consolidateInlineNav() {
        try {
            const nav = document.querySelector('.dashboard-inline-nav');
            if (!nav) return;
            const items = Array.from(nav.querySelectorAll('.nav-item')) || [];
            const visible = items.filter((i) => {
                try {
                    return getComputedStyle(i).display !== 'none' && i.offsetParent !== null;
                } catch (_e) {
                    return false;
                }
            });
            if (visible.length <= 1) {
                nav.style.display = 'none';
            } else {
                nav.style.display = '';
            }
        } catch (e) {
            // ignore
        }
    }

    function ensureDemoListingsExist() {
        if (window.anytransportApi && typeof window.anytransportApi.getQuotes === 'function') {
            return;
        }

        const allQuotes = getAllQuotes();
        const demoIds = ['demo-provider-listing', 'demo-office-move', 'demo-apartment-move', 'demo-single-room', 'demo-man-van'];
        const existing = new Set(allQuotes.map((q) => q.id));

        const demoListings = [
            getDemoProviderListingQuote(),
            {
                id: 'demo-office-move',
                status: 'pending',
                submittedAt: '2026-04-14T10:30:00.000Z',
                pickupAddress: 'Dublin Tech Hub, City Centre',
                deliveryAddress: 'Custom House Docks, Dublin',
                pickupPostcode: 'D1',
                deliveryPostcode: 'D1',
                pickupLift: 'Yes',
                deliveryLift: 'Yes',
                propertyType: 'Office',
                itemDescription: 'Office relocation',
                routeDistanceKm: 3,
                routeDurationText: '12 min',
                transportDate: '2026-04-25',
                preferredPickupTime: '18:00 - 20:00',
                preferredDeliveryTime: 'Next morning 09:00',
                timeFlexibility: 'Flexible by 1 hour',
                serviceSelections: ['Packing assistance', 'Furniture assembly'],
                serviceSpecialInstructions: 'After hours pickup, office must be empty by 20:00',
                mediaAttachments: [{}, {}, {}],
                floorBlocks: [
                    {
                        lift: 'Yes',
                        officeInventory: {
                            items: { desks: 15, chairs: 20, cabinets: 5, boxes: 30 },
                            subRoomQuantities: {},
                            customItems: '3 servers, 2 printers, networking equipment',
                            extraItems: 'IT equipment and monitors'
                        },
                        houseInventory: null
                    }
                ],
                itemQuantities: { desks: 15, chairs: 20, cabinets: 5, boxes: 30 },
                customItems: '3 servers, 2 printers, networking equipment',
                pickupFloorSelect: 'Ground floor',
                deliveryFloorSelect: 'Multiple floors',
                itemPickupFloorAssignments: { desks: 'Ground floor', chairs: 'Ground floor', cabinets: 'Ground floor', boxes: 'Ground floor' },
                itemFloorAssignments: { desks: 'First floor', chairs: 'First floor', cabinets: 'Ground floor', boxes: 'First floor' },
                overviewNotes: 'Office move for 15-person startup',
                summaryNotes: 'Small office relocation with desks and IT equipment'
            },
            {
                id: 'demo-apartment-move',
                status: 'pending',
                submittedAt: '2026-04-13T14:20:00.000Z',
                pickupAddress: 'Sandyford, South Dublin',
                deliveryAddress: 'Ranelagh, Dublin',
                pickupPostcode: 'D18',
                deliveryPostcode: 'D6',
                pickupLift: 'Yes',
                deliveryLift: 'Yes',
                propertyType: 'Apartment',
                itemDescription: 'Apartment move',
                routeDistanceKm: 8,
                routeDurationText: '18 min',
                transportDate: '2026-04-28',
                preferredPickupTime: '10:00 - 12:00',
                preferredDeliveryTime: 'Same day 14:00 - 16:00',
                timeFlexibility: 'Flexible by 3 hours',
                serviceSelections: ['Packing assistance'],
                serviceSpecialInstructions: 'Ground floor apartment, no stairs',
                mediaAttachments: [{}, {}],
                floorBlocks: [
                    {
                        lift: 'Yes',
                        houseInventory: {
                            items: { sofas: 2, beds: 2, wardrobes: 3, tables: 4, chairs: 8, boxes: 20 },
                            subRoomQuantities: {},
                            customItems: 'TV stand, bookshelf, dining table',
                            extraItems: 'Rugs, lamps, mirrors'
                        },
                        officeInventory: null
                    }
                ],
                itemQuantities: { sofas: 2, beds: 2, wardrobes: 3, tables: 4, chairs: 8, boxes: 20 },
                customItems: 'TV stand, bookshelf, dining table',
                pickupFloorSelect: 'Ground floor',
                deliveryFloorSelect: 'Ground floor',
                itemPickupFloorAssignments: { sofas: 'Ground floor', beds: 'Ground floor', wardrobes: 'Ground floor', tables: 'Ground floor', chairs: 'Ground floor' },
                itemFloorAssignments: { sofas: 'Ground floor', beds: 'Ground floor', wardrobes: 'First floor', tables: 'Ground floor', chairs: 'Ground floor' },
                overviewNotes: 'City center apartment move',
                summaryNotes: '2-bed apartment with modern furniture'
            },
            {
                id: 'demo-single-room',
                status: 'pending',
                submittedAt: '2026-04-12T11:45:00.000Z',
                pickupAddress: 'Ballymun, North Dublin',
                deliveryAddress: 'Clontibret, Monaghan',
                pickupPostcode: 'D9',
                deliveryPostcode: 'H18',
                pickupLift: 'No',
                deliveryLift: 'No',
                propertyType: 'Single room',
                itemDescription: 'Single room move',
                routeDistanceKm: 72,
                routeDurationText: '1 hour 15 min',
                transportDate: '2026-04-30',
                preferredPickupTime: '09:00 - 10:00',
                preferredDeliveryTime: 'Same day 12:00 - 13:00',
                timeFlexibility: 'Flexible by 30 min',
                serviceSelections: ['Basic removal assistance'],
                serviceSpecialInstructions: 'Basic bedroom furniture and boxes',
                mediaAttachments: [{}],
                floorBlocks: [
                    {
                        lift: 'No',
                        houseInventory: {
                            items: { bed: 1, wardrobe: 1, desk: 1, chair: 2, boxes: 12 },
                            subRoomQuantities: {},
                            customItems: 'Bicycle, mirror',
                            extraItems: 'Study lamp and suitcase'
                        },
                        officeInventory: null
                    }
                ],
                itemQuantities: { bed: 1, wardrobe: 1, desk: 1, chair: 2, boxes: 12 },
                customItems: 'Bicycle, mirror',
                pickupFloorSelect: 'Ground floor',
                deliveryFloorSelect: 'First floor',
                itemPickupFloorAssignments: { bed: 'Ground floor', wardrobe: 'Ground floor', desk: 'Ground floor', chair: 'Ground floor', boxes: 'Ground floor' },
                itemFloorAssignments: { bed: 'First floor', wardrobe: 'First floor', desk: 'First floor', chair: 'First floor', boxes: 'First floor' },
                overviewNotes: 'Long distance single room move',
                summaryNotes: 'Student moving back home with essentials'
            },
            {
                id: 'demo-man-van',
                status: 'pending',
                submittedAt: '2026-04-11T09:15:00.000Z',
                pickupAddress: 'Crumlin, South Dublin',
                deliveryAddress: 'Malahide, North Dublin',
                pickupPostcode: 'D12',
                deliveryPostcode: 'K1',
                pickupLift: 'No',
                deliveryLift: 'No',
                propertyType: 'Multiple items',
                itemDescription: 'Man and van service',
                routeDistanceKm: 26,
                routeDurationText: '38 min',
                transportDate: '2026-04-24',
                preferredPickupTime: '13:00 - 14:00',
                preferredDeliveryTime: 'Same day 15:00 - 16:00',
                timeFlexibility: 'Flexible by 1 hour',
                serviceSelections: ['Loading help', 'Furniture transport'],
                serviceSpecialInstructions: 'Furniture delivery, 4 large pieces',
                mediaAttachments: [{}, {}],
                floorBlocks: [
                    {
                        lift: 'No',
                        houseInventory: {
                            items: { sofas: 2, wardrobes: 2, tables: 2, chairs: 4, boxes: 8 },
                            subRoomQuantities: {},
                            customItems: 'Dining table, coffee table, shelving unit',
                            extraItems: 'Flat-pack furniture and boxed items'
                        },
                        officeInventory: null
                    }
                ],
                itemQuantities: { sofas: 2, wardrobes: 2, tables: 2, chairs: 4, boxes: 8 },
                customItems: 'Dining table, coffee table, shelving unit',
                pickupFloorSelect: 'Ground floor',
                deliveryFloorSelect: 'Ground floor',
                itemPickupFloorAssignments: { sofas: 'Ground floor', wardrobes: 'Ground floor', tables: 'Ground floor', chairs: 'Ground floor', boxes: 'Ground floor' },
                itemFloorAssignments: { sofas: 'Ground floor', wardrobes: 'Ground floor', tables: 'Ground floor' },
                overviewNotes: 'Furniture delivery across Dublin',
                summaryNotes: 'IKEA furniture and boxes'
            }
        ];

        let changed = false;
        const demosById = {};
        demoListings.forEach((demo) => {
            demosById[demo.id] = demo;
        });

        const merged = allQuotes.map((quote) => {
            if (demosById[quote.id]) {
                changed = true;
                return { ...quote, ...demosById[quote.id] };
            }
            return quote;
        });

        demoListings.forEach((demo) => {
            if (!existing.has(demo.id)) {
                merged.push(demo);
                changed = true;
            }
        });

        if (changed) {
            try {
                saveQuotesToStorage(merged);
            } catch (_error) {
                // Keep dashboard usable even if browser storage is currently full.
            }
        }
    }

    function wireTabs() {
        const tabItems = document.querySelectorAll('.nav-item[data-tab]');
        tabItems.forEach((item) => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                showTab(item.getAttribute('data-tab'));
            });
        });
        // Wire dropdown toggles (profile menu)
        document.querySelectorAll('.nav-dropdown .nav-toggle').forEach((btn) => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const parent = btn.closest('.nav-dropdown');
                if (!parent) return;
                const isOpen = parent.classList.toggle('open');
                btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
            });
        });
        // Close any open dropdown when clicking elsewhere
        document.addEventListener('click', () => {
            document.querySelectorAll('.nav-dropdown.open').forEach((d) => {
                d.classList.remove('open');
                const t = d.querySelector('.nav-toggle');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        });
        // wire profile back button if present
        const backBtn = document.getElementById('profile-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', function () {
                showTab('provider-board');
                // also ensure the provider board mode is visible
                const modeBtn = document.querySelector('.provider-mode-btn[data-mode="dashboard"]');
                if (modeBtn) modeBtn.click();
            });
        }
    }

    function showTab(tabName) {
        state.activeTab = tabName;
        document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));

        const target = document.getElementById(tabName);
        if (target) target.classList.add('active');

        const navItem = document.querySelector('[data-tab="' + tabName + '"]');
        if (navItem) navItem.classList.add('active');
        // If profile tab opened, navigate to full profile page so dropdown and tab show identical view
        if (tabName === 'profile') {
            try {
                const current = auth && auth.getUser ? auth.getUser() : null;
                if (current && current.id) {
                    window.location.href = 'provider-profile.html?userId=' + encodeURIComponent(current.id);
                    return;
                }
                // fallback: render inline if no current user
                if (typeof window.renderProviderProfileInto === 'function') {
                    try {
                        window.renderProviderProfileInto('dashboard-profile-container', '').catch(() => {});
                    } catch (_e) {}
                }
            } catch (_e) {}
        }

        if (tabName === 'profile') {
            const modeSwitch = document.getElementById('provider-mode-switch');
            if (modeSwitch) {
                modeSwitch.querySelectorAll('.provider-mode-btn').forEach((node) => {
                    node.classList.toggle('active', node.getAttribute('data-mode') === 'dashboard');
                });
            }
        }

        if (tabName === 'verification-review') {
            renderAdminReviewQueue();
            ensureAdminReviewAutoRefresh();
            return;
        }
        clearAdminReviewAutoRefresh();
    }

    function clearAdminReviewAutoRefresh() {
        if (state.adminReviewRefreshTimer) {
            clearInterval(state.adminReviewRefreshTimer);
            state.adminReviewRefreshTimer = null;
        }
    }

    function ensureAdminReviewAutoRefresh() {
        if (!(auth.isAdmin && auth.isAdmin())) return;
        if (state.adminReviewRefreshTimer) return;
        state.adminReviewRefreshTimer = window.setInterval(() => {
            if (state.activeTab !== 'verification-review') return;
            renderAdminReviewQueue();
        }, 30000);
    }

    function wireProviderControls(user) {
        const renderSearchModeIfActive = () => {
            if (state.activeProviderMode === 'search') {
                renderProviderListings(user);
            }
        };

        const modeSwitch = document.getElementById('provider-mode-switch');
        const dashboardPanel = document.getElementById('provider-dashboard-panel');
        const searchPanel = document.getElementById('provider-search-panel');
        if (modeSwitch) {
            modeSwitch.addEventListener('click', (event) => {
                const btn = event.target.closest('.provider-mode-btn');
                if (!btn) return;
                const modeAttr = btn.getAttribute('data-mode');
                const mode = modeAttr === 'search' ? 'search' : modeAttr === 'profile' ? 'profile' : 'dashboard';

                if (mode === 'profile') {
                    showTab('profile');
                    return;
                }

                state.activeProviderMode = mode;

                modeSwitch.querySelectorAll('.provider-mode-btn').forEach((node) => {
                    node.classList.toggle('active', node === btn);
                });

                if (dashboardPanel) dashboardPanel.classList.toggle('active', mode === 'dashboard');
                if (searchPanel) searchPanel.classList.toggle('active', mode === 'search');
                // ensure listing rendering only for dashboard/search modes
                renderProviderListings(user);
            });
        }

        const dashboardTabs = document.getElementById('provider-dashboard-tabs');
        if (dashboardTabs) {
            dashboardTabs.addEventListener('click', (event) => {
                const btn = event.target.closest('.provider-dashboard-tab');
                if (!btn) return;
                state.dashboardScope = btn.getAttribute('data-scope') || 'watching';
                dashboardTabs.querySelectorAll('.provider-dashboard-tab').forEach((node) => {
                    const active = node === btn;
                    node.classList.toggle('active', active);
                    node.setAttribute('aria-selected', active ? 'true' : 'false');
                });
                renderProviderListings(user);
            });
        }

        const dashboardIdSearch = document.getElementById('dashboard-id-search');
        if (dashboardIdSearch) {
            dashboardIdSearch.addEventListener('input', () => {
                state.dashboardListingId = String(dashboardIdSearch.value || '').trim();
            });
            dashboardIdSearch.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                renderProviderListings(user);
            });
        }

        const dashboardSearchBtn = document.getElementById('dashboard-id-search-btn');
        if (dashboardSearchBtn) {
            dashboardSearchBtn.addEventListener('click', () => {
                if (dashboardIdSearch) {
                    state.dashboardListingId = String(dashboardIdSearch.value || '').trim();
                }
                renderProviderListings(user);
            });
        }

        const dashboardResetBtn = document.getElementById('dashboard-id-reset-btn');
        if (dashboardResetBtn) {
            dashboardResetBtn.addEventListener('click', () => {
                state.dashboardListingId = '';
                if (dashboardIdSearch) dashboardIdSearch.value = '';
                renderProviderListings(user);
            });
        }

        const searchListingIdInput = document.getElementById('search-listing-id');
        const searchCityInput = document.getElementById('search-city');
        const searchKeywordInput = document.getElementById('search-keyword');
        const searchCategoryInput = document.getElementById('search-category');
        const distanceMinInput = document.getElementById('filter-distance-min');
        const distanceMaxInput = document.getElementById('filter-distance-max');
        const dateFilterInput = document.getElementById('filter-date');

        if (searchListingIdInput) {
            searchListingIdInput.addEventListener('input', () => {
                state.searchListingId = String(searchListingIdInput.value || '').trim();
                renderSearchModeIfActive();
            });
        }

        if (searchCityInput) {
            searchCityInput.addEventListener('input', () => {
                state.searchCity = String(searchCityInput.value || '').trim().toLowerCase();
                renderSearchModeIfActive();
            });
        }

        if (searchKeywordInput) {
            searchKeywordInput.addEventListener('input', () => {
                state.searchKeyword = String(searchKeywordInput.value || '').trim().toLowerCase();
                renderSearchModeIfActive();
            });
        }

        if (searchCategoryInput) {
            searchCategoryInput.addEventListener('change', () => {
                state.searchCategory = String(searchCategoryInput.value || '').trim().toLowerCase();
                renderSearchModeIfActive();
            });
        }

        if (distanceMinInput) {
            distanceMinInput.addEventListener('input', () => {
                state.distanceMin = distanceMinInput.value ? Number(distanceMinInput.value) : '';
                renderSearchModeIfActive();
            });
        }

        if (distanceMaxInput) {
            distanceMaxInput.addEventListener('input', () => {
                state.distanceMax = distanceMaxInput.value ? Number(distanceMaxInput.value) : '';
                renderSearchModeIfActive();
            });
        }

        if (dateFilterInput) {
            dateFilterInput.addEventListener('change', () => {
                state.dateFilter = String(dateFilterInput.value || '').trim();
                renderSearchModeIfActive();
            });
        }

        const resetBtn = document.getElementById('filter-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state.searchListingId = '';
                state.searchCity = '';
                state.searchKeyword = '';
                state.searchCategory = '';
                state.distanceMin = '';
                state.distanceMax = '';
                state.dateFilter = '';

                if (searchListingIdInput) searchListingIdInput.value = '';
                if (searchCityInput) searchCityInput.value = '';
                if (searchKeywordInput) searchKeywordInput.value = '';
                if (searchCategoryInput) searchCategoryInput.value = '';
                if (distanceMinInput) distanceMinInput.value = '';
                if (distanceMaxInput) distanceMaxInput.value = '';
                if (dateFilterInput) dateFilterInput.value = '';

                renderProviderListings(user);
            });
        }
    }

    function wireDashboardActions(user) {
        document.addEventListener('click', (event) => {
            const getDetailsBtn = event.target.closest('.get-details-btn');
            if (getDetailsBtn) {
                const formId = String(getDetailsBtn.getAttribute('data-form-id') || '').trim();
                if (formId) {
                    window.location.href = 'listing-details.html?id=' + encodeURIComponent(formId);
                    return;
                }

                const quoteId = String(getDetailsBtn.getAttribute('data-quote-id') || '').trim();
                if (!quoteId) return;
                window.location.href = 'listing-details.html?quoteId=' + encodeURIComponent(quoteId);
                return;
            }

            const rowToggle = event.target.closest('.listing-row-toggle');
            if (rowToggle && !event.target.closest('.listing-cell.actions')) {
                const listing = rowToggle.closest('.provider-listing');
                if (!listing) return;
                const isExpanded = listing.classList.toggle('expanded');
                rowToggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
                const quoteId = listing.getAttribute('data-quote-id');
                if (quoteId) {
                    if (isExpanded) state.expandedQuoteIds.add(quoteId);
                    else state.expandedQuoteIds.delete(quoteId);
                }
                if (isExpanded) {
                    initializeMapsInScope(listing);
                }
                return;
            }

            const placeBidBtn = event.target.closest('.place-bid-btn');
            if (placeBidBtn) {
                placeBid(placeBidBtn.getAttribute('data-quote-id'), user);
                return;
            }

            const reuploadBtn = event.target.closest('.reupload-identity-btn');
            if (reuploadBtn) {
                const reviewCard = reuploadBtn.closest('.provider-listing');
                const uploadInput = reviewCard ? reviewCard.querySelector('.identity-reupload-input') : null;
                if (uploadInput) uploadInput.click();
                return;
            }

            const reviewBtn = event.target.closest('.review-provider-btn');
            if (reviewBtn) {
                if (!(auth.isAdmin && auth.isAdmin())) {
                    alert('Admin access required.');
                    return;
                }

                const providerId = String(reviewBtn.getAttribute('data-provider-id') || '').trim();
                const status = String(reviewBtn.getAttribute('data-status') || '').trim();
                const reviewCard = reviewBtn.closest('.provider-listing');
                const notesField = reviewCard ? reviewCard.querySelector('.review-notes') : null;
                const notes = notesField ? String(notesField.value || '').trim() : '';

                // If admin is declining, require a note
                if (status === 'rejected' && (!notes || String(notes).trim() === '')) {
                    alert('Please add a review note explaining the reason for declining this provider.');
                    if (notesField) notesField.focus();
                    return;
                }

                try {
                    if (window.anytransportApi && typeof window.anytransportApi.updateIdentityReview === 'function') {
                        window.anytransportApi.updateIdentityReview(providerId, status, notes);
                    } else {
                        const users = auth && typeof auth.loadUsers === 'function' ? auth.loadUsers() : [];
                        const index = users.findIndex((entry) => String(entry && entry.id || '') === providerId);
                        if (index < 0) {
                            alert('Provider not found.');
                            return;
                        }

                        users[index] = {
                            ...users[index],
                            identityReviewStatus: status,
                            identityReviewedAt: new Date().toISOString(),
                            identityReviewedBy: String(auth.getUser && auth.getUser() && auth.getUser().id || ''),
                            identityReviewNotes: notes,
                            verified: status === 'approved' ? true : (status === 'rejected' ? false : !!users[index].verified)
                        };

                        if (typeof auth.saveUsers === 'function') {
                            auth.saveUsers(users);
                        }
                    }
                    renderAdminReviewQueue();
                } catch (error) {
                    alert(error && error.message ? error.message : 'Unable to update the review status.');
                }
                return;
            }

            const rejectedToggleBtn = event.target.closest('.admin-rejected-toggle');
            if (rejectedToggleBtn) {
                state.adminShowRejected = !state.adminShowRejected;
                renderAdminReviewQueue();
                return;
            }

            const clearSearchBtn = event.target.closest('.admin-provider-search-clear');
            if (clearSearchBtn) {
                state.adminReviewQuery = '';
                renderAdminReviewQueue();
                return;
            }

            const adminEmailBtn = event.target.closest('.admin-email-form-btn');
            if (adminEmailBtn) {
                if (!(auth.isAdmin && auth.isAdmin())) {
                    alert('Admin access required.');
                    return;
                }
                const quoteId = String(adminEmailBtn.getAttribute('data-quote-id') || '').trim();
                const row = adminEmailBtn.closest('.provider-listing');
                const notesField = row ? row.querySelector('.admin-form-note') : null;
                const statusBadge = row ? row.querySelector('.admin-email-status') : null;
                const reason = notesField ? String(notesField.value || '').trim() : '';
                if (!quoteId || !reason) {
                    alert('Please write a reason before sending the email.');
                    if (notesField) notesField.focus();
                    return;
                }
                try {
                    if (statusBadge) {
                        statusBadge.textContent = 'Sending...';
                        statusBadge.style.color = '#1d4ed8';
                    }
                    if (window.anytransportApi && typeof window.anytransportApi.notifyQuoteOwner === 'function') {
                        window.anytransportApi.notifyQuoteOwner(quoteId, reason);
                        if (statusBadge) {
                            statusBadge.textContent = 'Sent';
                            statusBadge.style.color = '#166534';
                        }
                    } else {
                        if (statusBadge) {
                            statusBadge.textContent = 'Email unavailable';
                            statusBadge.style.color = '#991b1b';
                        }
                        alert('Email sending is not available in this mode.');
                    }
                } catch (error) {
                    if (statusBadge) {
                        statusBadge.textContent = 'Failed';
                        statusBadge.style.color = '#991b1b';
                    }
                    alert(error && error.message ? error.message : 'Unable to send email.');
                }
                return;
            }

            const withdrawBtn = event.target.closest('.withdraw-bid-btn');
            if (withdrawBtn) {
                withdrawBid(withdrawBtn.getAttribute('data-bid-id'), user);
                return;
            }

            const quoteDeleteBtn = event.target.closest('.quote-delete-btn');
            if (quoteDeleteBtn) {
                deleteQuote(quoteDeleteBtn.getAttribute('data-quote-id'), user);
                return;
            }

            const quoteEditBtn = event.target.closest('.quote-edit-btn');
            if (quoteEditBtn) {
                editQuote(quoteEditBtn.getAttribute('data-quote-id'));
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const rowToggle = event.target.closest('.listing-row-toggle');
            if (!rowToggle) return;
            event.preventDefault();
            rowToggle.click();
        });

        document.addEventListener('change', async (event) => {
            const identityInput = event.target.closest('.identity-reupload-input');
            if (identityInput) {
                if (!(auth.isAdmin && auth.isAdmin())) {
                    alert('Admin access required.');
                    return;
                }

                const providerId = String(identityInput.getAttribute('data-provider-id') || '').trim();
                const files = Array.from(identityInput.files || []);
                if (!providerId || !files.length) return;

                try {
                    const photoPayload = [];
                    for (const file of files) {
                        if (!file) continue;
                        if (file.size > 2 * 1024 * 1024) {
                            alert('Please keep each identity photo under 2MB.');
                            return;
                        }

                        const dataUrl = await readFileAsDataUrl(file);
                        photoPayload.push({
                            label: file.name || 'identity-photo',
                            name: file.name || 'identity-photo',
                            type: file.type || 'image/*',
                            size: file.size || 0,
                            dataUrl: dataUrl,
                            previewDataUrl: dataUrl,
                            uploadedAt: new Date().toISOString()
                        });
                    }

                    if (!photoPayload.length) return;

                    if (window.anytransportApi && typeof window.anytransportApi.identityPhotosUpload === 'function') {
                        const uploads = photoPayload.map((p) => p.dataUrl);
                        window.anytransportApi.identityPhotosUpload(providerId, uploads);
                    } else {
                        const users = auth && typeof auth.loadUsers === 'function' ? auth.loadUsers() : [];
                        const index = users.findIndex((entry) => String(entry && entry.id || '') === providerId);
                        if (index < 0) {
                            alert('Provider not found.');
                            return;
                        }

                        const existing = Array.isArray(users[index].identityPhotos) ? users[index].identityPhotos : [];
                        users[index] = {
                            ...users[index],
                            identityPhotos: existing.concat(photoPayload),
                            identityReviewStatus: users[index].identityReviewStatus || 'pending_review',
                            identityReviewSubmittedAt: users[index].identityReviewSubmittedAt || new Date().toISOString()
                        };
                        if (typeof auth.saveUsers === 'function') {
                            auth.saveUsers(users);
                        }
                    }

                    identityInput.value = '';
                    renderAdminReviewQueue();
                    alert('Identity photos uploaded successfully.');
                } catch (error) {
                    alert(error && error.message ? error.message : 'Unable to upload identity photos.');
                }
                return;
            }

            const templateSelect = event.target.closest('.bid-template-select');
            if (!templateSelect) return;
            const quoteId = templateSelect.getAttribute('data-quote-id');
            const value = templateSelect.value;
            const textarea = document.querySelector('.bid-message-input[data-quote-id="' + quoteId + '"]');
            if (!textarea) return;
            if (value === 'custom') {
                if (!textarea.value.trim()) {
                    textarea.placeholder = 'Write your custom bid message';
                }
                return;
            }
            textarea.value = BID_TEMPLATES[value] || '';
        });

        document.addEventListener('input', (event) => {
            const adminSearchInput = event.target.closest('.admin-provider-search');
            if (adminSearchInput) {
                state.adminReviewQuery = String(adminSearchInput.value || '').trim();
                if (state.activeTab === 'verification-review') {
                    renderAdminReviewQueue();
                }
                return;
            }

            const amountInput = event.target.closest('.bid-amount-input');
            if (!amountInput) return;

            const maxValue = Number(amountInput.getAttribute('max'));
            if (!Number.isFinite(maxValue) || maxValue <= 0) return;

            const currentValue = Number(amountInput.value);
            if (!Number.isFinite(currentValue)) return;

            if (currentValue > maxValue) {
                amountInput.value = String(maxValue);
            }
        });
    }

    function renderAll(user) {
        renderProviderListings(user);
        renderMyBids(user);
        renderAdminReviewQueue();
    }

    function loadUserInfo(user) {
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const userAvatar = document.getElementById('user-avatar');
        const roleBadge = document.getElementById('dashboard-role-badge');
        const displayName = firstText(user.username, user.nickname, user.displayName, user.name) || 'User';

        if (userName) userName.textContent = displayName;
        if (userEmail) userEmail.textContent = user.email || '';
        if (userAvatar && displayName) userAvatar.textContent = displayName.charAt(0).toUpperCase();

        if (roleBadge) {
            const provider = auth.isProvider && auth.isProvider();
            roleBadge.textContent = provider ? 'Provider' : 'Customer';
        }
    }

    function renderProviderListings(user) {
        const container = document.getElementById('provider-listings');
        if (!container) return;

        const quotes = getAllQuotes();
        const bids = getAllBids();
        const watchedQuoteIds = new Set(getWatchedQuoteIdsForProvider(user.id));
        const myBids = bids.filter((bid) => isBidOwnedByUser(bid, user) && isActiveBid(bid));
        const myBidQuoteIds = new Set(myBids.map((bid) => normalizeIdValue(bid.quoteId)).filter(Boolean));
        const wonQuoteIds = getWonQuoteIdsForProvider(user.id, quotes, bids);
        const quotesById = {};
        quotes.forEach((quote) => {
            const key = normalizeIdValue(quote && quote.id);
            if (key) quotesById[key] = quote;
        });

        updateDashboardScopeCounts(watchedQuoteIds.size, myBidQuoteIds.size, wonQuoteIds.size);

        const searchFilteredQuotes = quotes.filter((quote) => {
            if (state.searchListingId && !matchesListingIdFilter(quote, state.searchListingId)) return false;

            if (state.searchCategory) {
                const quoteService = String(getQuoteTitle(quote) || quote.itemDescription || '').toLowerCase();
                if (!quoteService.includes(state.searchCategory)) return false;
            }

            if (state.searchCity) {
                const cityHaystack = [
                    quote.pickupCity,
                    quote.deliveryCity,
                    getFromLabel(quote),
                    getToLabel(quote)
                ].join(' ').toLowerCase();
                if (!cityHaystack.includes(state.searchCity)) return false;
            }

            if (state.searchKeyword) {
                const haystack = [
                    quote.id,
                    quote.formId,
                    getFormIdLabel(quote),
                    getQuoteTitle(quote),
                    getFromLabel(quote),
                    getToLabel(quote),
                    quote.itemDescription,
                    quote.pickupCity,
                    quote.deliveryCity,
                    quote.overviewNotes,
                    quote.summaryNotes,
                    quote.notes
                ].join(' ').toLowerCase();
                if (!haystack.includes(state.searchKeyword)) return false;
            }

            const distance = Number(quote.routeDistanceKm) || 0;
            if (state.distanceMin !== '' && distance < Number(state.distanceMin)) return false;
            if (state.distanceMax !== '' && distance > Number(state.distanceMax)) return false;

            if (state.dateFilter) {
                const quoteDate = normalizeDateKey(getPrimaryTransportDateValue(quote) || getSecondaryTransportDateValue(quote));
                const filterDate = normalizeDateKey(state.dateFilter);
                if (filterDate && quoteDate && quoteDate < filterDate) return false;
                if (filterDate && !quoteDate) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

        const dashboardWatchingQuotes = quotes.filter((quote) => watchedQuoteIds.has(normalizeIdValue(quote && quote.id)))
            .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
        const dashboardWonQuotes = quotes.filter((quote) => wonQuoteIds.has(normalizeIdValue(quote && quote.id)))
            .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

        const header = [
            '<div class="provider-listing">',
            '<div class="listing-row head">',
            '<div class="listing-cell">Listed</div>',
            '<div class="listing-cell">Label</div>',
            '<div class="listing-cell">From</div>',
            '<div class="listing-cell">To</div>',
            '<div class="listing-cell">Pickup</div>',
            '<div class="listing-cell">Bids</div>',
            '<div class="listing-cell">Quote</div>',
            '<div class="listing-cell">Action</div>',
            '</div>',
            '</div>'
        ].join('');

        if (state.activeProviderMode === 'dashboard') {
            if (state.dashboardScope === 'bidding') {
                const filteredBids = myBids.filter((bid) => {
                    if (!state.dashboardListingId) return true;

                    const quote = quotesById[normalizeIdValue(bid && bid.quoteId)] || null;
                    if (quote && matchesListingIdFilter(quote, state.dashboardListingId)) return true;

                    return normalizeIdValue(bid && bid.quoteId).toLowerCase().includes(String(state.dashboardListingId || '').trim().toLowerCase());
                }).sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

                if (!filteredBids.length) {
                    container.innerHTML = [
                        header,
                        '<div class="empty-state">',
                        '<h3>No current bids right now</h3>',
                        '<p>Place a bid in Get Details and it will appear here.</p>',
                        '</div>'
                    ].join('');
                    return;
                }

                const rows = filteredBids.map((bid) => {
                    const quote = quotesById[normalizeIdValue(bid && bid.quoteId)] || null;
                    return createProviderCurrentBidCard(bid, quote, bids);
                }).join('');

                container.innerHTML = header + rows;
                return;
            }

            const scopeQuotes = state.dashboardScope === 'watching' ? dashboardWatchingQuotes : dashboardWonQuotes;
            const filteredDashboardQuotes = scopeQuotes.filter((quote) => {
                if (!state.dashboardListingId) return true;
                return matchesListingIdFilter(quote, state.dashboardListingId);
            });

            if (!filteredDashboardQuotes.length) {
                const dashboardLabel = state.dashboardScope === 'watching' ? 'watched' : 'won';
                container.innerHTML = [
                    header,
                    '<div class="empty-state">',
                    '<h3>No ' + escapeHtml(dashboardLabel) + ' listings right now</h3>',
                    '<p>Use Watch in Get Details or win a bid to populate this section.</p>',
                    '</div>'
                ].join('');
                return;
            }

            const rows = filteredDashboardQuotes.map((quote) => createProviderListingCard(quote, bids, user)).join('');
            container.innerHTML = header + rows;
            return;
        }

        if (!searchFilteredQuotes.length) {
            const modeLabel = state.activeProviderMode === 'dashboard'
                ? ('No listings in ' + state.dashboardScope + ' right now')
                : 'No listings match your search filters';
            container.innerHTML = [
                header,
                '<div class="empty-state">',
                '<h3>' + escapeHtml(modeLabel) + '</h3>',
                '<p>Try a different tab or adjust your filters.</p>',
                '</div>'
            ].join('');
            return;
        }

        const rows = searchFilteredQuotes.map((quote) => createProviderListingCard(quote, bids, user)).join('');
        container.innerHTML = header + rows;

        container.querySelectorAll('.provider-listing[data-quote-id]').forEach((listing) => {
            const quoteId = listing.getAttribute('data-quote-id');
            const shouldExpand = quoteId && state.expandedQuoteIds && state.expandedQuoteIds.has(quoteId);
            listing.classList.toggle('expanded', !!shouldExpand);
            const rowToggle = listing.querySelector('.listing-row-toggle');
            if (rowToggle) rowToggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
            if (shouldExpand) {
                initializeMapsInScope(listing);
            }
        });
    }

    function renderAdminReviewQueue() {
        const container = document.getElementById('provider-review-queue');
        if (!container) return;

        if (!(auth.isAdmin && auth.isAdmin())) {
            container.innerHTML = '<div class="empty-inventory">Admin access required.</div>';
            return;
        }

        try {
            const providers = getPendingProvidersForReview();
            const allUsers = getAllUsersForAdmin();
            const allProviders = getAllProvidersForAdmin();
            const rejectedProviders = allProviders.filter((provider) => {
                const status = String(provider && provider.identityReviewStatus || '').trim().toLowerCase();
                return status === 'rejected';
            });
            const approvedProviders = allProviders.filter((provider) => {
                const status = String(provider && provider.identityReviewStatus || '').trim().toLowerCase();
                return status === 'approved' || provider.verified === true;
            });
            const query = String(state.adminReviewQuery || '').trim().toLowerCase();
            const matchesProviderQuery = (provider) => {
                if (!query) return true;
                const status = String(provider && provider.identityReviewStatus || '').trim().toLowerCase().replace(/_/g, ' ');
                const haystack = [
                    firstText(provider.businessName, provider.name, provider.username, provider.email),
                    firstText(provider.city, provider.location, ''),
                    status
                ].join(' ').toLowerCase();
                return haystack.indexOf(query) >= 0;
            };
            const approvedFiltered = approvedProviders.filter(matchesProviderQuery);
            const rejectedFiltered = rejectedProviders.filter(matchesProviderQuery);
            const userNameById = {};
            allUsers.forEach((entry) => {
                const id = String(entry && entry.id || '').trim();
                if (!id) return;
                userNameById[id] = firstText(entry.businessName, entry.name, entry.nickname, entry.username, entry.email, id);
            });
            const allQuotes = getAllQuotes();

            const pendingMarkup = providers.length ? providers.map((provider) => {
                const name = escapeHtml(firstText(provider.businessName, provider.name, provider.nickname, provider.username, provider.email));
                const email = escapeHtml(firstText(provider.email, 'Not provided'));
                const status = escapeHtml(String(provider.identityReviewStatus || 'pending_review').replace(/_/g, ' '));
                const notes = escapeHtml(firstText(provider.identityReviewNotes, ''));
                const photos = Array.isArray(provider.identityPhotos) ? provider.identityPhotos : [];
                const photoMarkup = photos.length ? photos.map((photo) => {
                    const src = escapeHtml(firstText(photo.previewDataUrl, photo.dataUrl, photo.originalUrl, (photo.stripeFile ? ('api/index.php?action=stripe.file.get&fileId=' + encodeURIComponent(photo.stripeFile)) : '')));
                    const label = escapeHtml(firstText(photo.label, photo.name, 'Identity photo'));
                    return '<figure style="margin:0; width:140px;">' +
                        '<img src="' + src + '" alt="' + label + '" style="width:140px; height:100px; object-fit:cover; border-radius:10px; border:1px solid #dbeafe;">' +
                        '<figcaption style="font-size:12px; color:#64748b; margin-top:6px;">' + label + '</figcaption>' +
                        '</figure>';
                }).join('') : '<div class="empty-inventory">No identity photos attached.</div>';

                return [
                    '<article class="provider-listing" style="margin-bottom:16px;">',
                    '<div class="listing-row body" style="grid-template-columns: 220px 160px 1fr 1fr;">',
                    '<div class="listing-cell">',
                    '<div class="listing-title">' + name + '</div>',
                    '<div class="listing-sub">' + email + '</div>',
                    '</div>',
                    '<div class="listing-cell"><span class="profile-value">' + status + '</span></div>',
                    '<div class="listing-cell" style="display:flex; flex-wrap:wrap; gap:10px;">' + photoMarkup + '</div>',
                    '<div class="listing-cell review-actions-cell">',
                    '<textarea class="form-input review-notes" rows="4" data-provider-id="' + escapeHtml(provider.id) + '" placeholder="Review notes" style="width:100%; box-sizing:border-box;">' + notes + '</textarea>',
                    '<input type="file" class="identity-reupload-input" data-provider-id="' + escapeHtml(provider.id) + '" accept="image/*" multiple style="display:none;">',
                    '<div class="actions review-actions" style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-start;">',
                    '<button type="button" class="btn btn-outline reupload-identity-btn" data-provider-id="' + escapeHtml(provider.id) + '">Upload photos</button>',
                    '<button type="button" class="btn btn-primary review-provider-btn" data-provider-id="' + escapeHtml(provider.id) + '" data-status="approved">Approve</button>',
                    '<button type="button" class="btn btn-danger review-provider-btn" data-provider-id="' + escapeHtml(provider.id) + '" data-status="rejected">Decline</button>',
                    '</div>',
                    '</div>',
                    '</div>',
                    '</article>'
                ].join('');
            }).join('') : '<div class="empty-inventory">No providers are waiting for review.</div>';

            const providerRows = approvedFiltered.length ? approvedFiltered.map((provider) => {
                const status = escapeHtml(String(provider.identityReviewStatus || 'pending_review').replace(/_/g, ' '));
                const reviewedBy = String(provider.identityReviewedBy || '').trim();
                const reviewerLabel = escapeHtml(firstText(userNameById[reviewedBy], reviewedBy, '—'));
                return '<tr>'
                    + '<td>' + escapeHtml(firstText(provider.businessName, provider.name, provider.username, provider.email)) + '</td>'
                    + '<td>' + escapeHtml(firstText(provider.email, '—')) + '</td>'
                    + '<td>' + status + '</td>'
                    + '<td>' + escapeHtml(firstText(provider.city, provider.location, '—')) + '</td>'
                    + '<td>' + escapeHtml(formatDateTime(provider.identityReviewedAt || provider.verifiedAt || '')) + '</td>'
                    + '<td>' + reviewerLabel + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="6" class="customer-empty-cell">No approved providers found.</td></tr>';

            const rejectedRows = rejectedFiltered.length ? rejectedFiltered.map((provider) => {
                const status = escapeHtml(String(provider.identityReviewStatus || 'rejected').replace(/_/g, ' '));
                const reviewedBy = String(provider.identityReviewedBy || '').trim();
                const reviewerLabel = escapeHtml(firstText(userNameById[reviewedBy], reviewedBy, '—'));
                return '<tr>'
                    + '<td>' + escapeHtml(firstText(provider.businessName, provider.name, provider.username, provider.email)) + '</td>'
                    + '<td>' + escapeHtml(firstText(provider.email, '—')) + '</td>'
                    + '<td>' + status + '</td>'
                    + '<td>' + escapeHtml(firstText(provider.city, provider.location, '—')) + '</td>'
                    + '<td>' + escapeHtml(formatDateTime(provider.identityReviewedAt || '')) + '</td>'
                    + '<td>' + reviewerLabel + '</td>'
                    + '</tr>';
            }).join('') : '<tr><td colspan="6" class="customer-empty-cell">No rejected providers found.</td></tr>';

            const quoteRows = allQuotes.length ? allQuotes.slice().sort((a, b) => {
                return new Date(b.submittedAt || b.createdAt || 0) - new Date(a.submittedAt || a.createdAt || 0);
            }).map((quote) => {
                const quoteId = String(quote.id || '').trim();
                const formId = escapeHtml(firstText(quote.formId, quoteId, '—'));
                const owner = escapeHtml(firstText(quote.customerEmail, quote.customerName, quote.userId, 'Unknown'));
                return [
                    '<article class="provider-listing" style="margin-bottom:12px;">',
                    '<div class="listing-row body" style="grid-template-columns: 160px 1fr 1fr;">',
                    '<div class="listing-cell">',
                    '<div class="listing-title">Form ' + formId + '</div>',
                    '<div class="listing-sub">' + escapeHtml(formatDateTime(quote.submittedAt || quote.createdAt || '')) + '</div>',
                    '</div>',
                    '<div class="listing-cell">',
                    '<div class="listing-sub">Owner: ' + owner + '</div>',
                    '<div class="listing-sub">' + escapeHtml(firstText(quote.itemDescription, quote.itemType, 'Transport request')) + '</div>',
                    '</div>',
                    '<div class="listing-cell review-actions-cell">',
                    '<textarea class="form-input admin-form-note" rows="3" placeholder="Reason to email the user"></textarea>',
                    '<div class="actions review-actions" style="margin-top:8px;">',
                    '<button type="button" class="btn btn-outline admin-email-form-btn" data-quote-id="' + escapeHtml(quoteId) + '">Email form owner</button>',
                    '<span class="admin-email-status" style="display:inline-flex; align-items:center; font-weight:700; color:#64748b;">Not sent</span>',
                    '</div>',
                    '</div>',
                    '</div>',
                    '</article>'
                ].join('');
            }).join('') : '<div class="empty-inventory">No forms found.</div>';

            container.innerHTML = [
                '<section style="margin-bottom:24px;">',
                '<h3 style="margin:0 0 10px;">Pending provider reviews (' + providers.length + ')</h3>',
                pendingMarkup,
                '</section>',
                '<section style="margin-bottom:24px;">',
                '<div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom:10px;">',
                '<h3 style="margin:0;">Approved providers (' + approvedFiltered.length + ')</h3>',
                '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">',
                '<input class="form-input admin-provider-search" type="search" placeholder="Search approved/rejected providers" value="' + escapeHtml(state.adminReviewQuery || '') + '" style="min-width:280px;">',
                '<button type="button" class="btn btn-outline admin-provider-search-clear">Clear</button>',
                '</div>',
                '</div>',
                '<div class="customer-quotes-table-wrap"><table class="customer-quotes-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Location</th><th>Approved at</th><th>Approved by</th></tr></thead><tbody>',
                providerRows,
                '</tbody></table></div>',
                '</section>',
                '<section style="margin-bottom:24px;">',
                '<div style="display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap; margin-bottom:10px;">',
                '<h3 style="margin:0;">Rejected providers (' + rejectedFiltered.length + ')</h3>',
                '<button type="button" class="btn btn-outline admin-rejected-toggle">' + (state.adminShowRejected ? 'Hide rejected' : 'Show rejected') + '</button>',
                '</div>',
                (state.adminShowRejected
                    ? '<div class="customer-quotes-table-wrap"><table class="customer-quotes-table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Location</th><th>Reviewed at</th><th>Reviewed by</th></tr></thead><tbody>' + rejectedRows + '</tbody></table></div>'
                    : '<div class="empty-inventory">Rejected providers are hidden.</div>'),
                '</section>',
                '<section>',
                '<h3 style="margin:0 0 10px;">All submitted forms</h3>',
                quoteRows,
                '</section>'
            ].join('');
        } catch (_error) {
            container.innerHTML = '<div class="empty-inventory">Unable to load the review queue.</div>';
        }
    }

    function createProviderPreviewListing(user, bids) {
        const previewQuote = getDemoProviderListingQuote();
        const previewBids = bids.filter((bid) => bid.quoteId === previewQuote.id && bid.status === 'active');
        const myBid = getLowestBidForProvider(previewBids, user.id);
        const myBidText = myBid ? ('Your bid €' + Number(myBid.amount).toFixed(2)) : 'Not bid yet';

        return [
            '<article class="provider-listing provider-listing-preview" data-quote-id="' + escapeHtml(previewQuote.id) + '" aria-label="Transport provider form preview">',
            '<div class="listing-row body listing-row-toggle" role="button" tabindex="0" aria-expanded="false">',
            '<div class="listing-cell">Preview</div>',
            '<div class="listing-cell">',
            '<div class="listing-title">' + escapeHtml(getQuoteTitle(previewQuote)) + '</div>',
            '<div class="listing-sub">Listing ' + escapeHtml(getFormIdLabel(previewQuote)) + ' • ' + escapeHtml(previewQuote.itemDescription || 'General move') + '</div>',
            '</div>',
            '<div class="listing-cell">' + escapeHtml(getFromLabel(previewQuote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getToLabel(previewQuote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getPickupLabel(previewQuote)) + '</div>',
            '<div class="listing-cell">' + previewBids.length + '</div>',
            '<div class="listing-cell"><span class="listing-amount">' + escapeHtml(myBidText) + '</span></div>',
            '<div class="listing-cell actions"><button type="button" class="get-details-btn" data-quote-id="' + escapeHtml(previewQuote.id) + '" data-form-id="' + escapeHtml(getFormIdLabel(previewQuote)) + '">Get Details</button></div>',
            '</div>',
            '<div class="listing-details">',
            createQuickInfoPanel(previewQuote),
            '</div>',
            '</article>'
        ].join('');
    }

    function createProviderListingCard(quote, bids, user) {
        const quoteBids = bids.filter((bid) => idsEqual(bid && bid.quoteId, quote && quote.id) && isActiveBid(bid));
        const lowest = getLowestBid(quoteBids);
        const formId = String(getFormIdLabel(quote) || '').trim();
        const isFocused = !!state.focusedFormId && formId === state.focusedFormId;

        const quickQuoteText = lowest ? ('€' + Number(lowest.amount).toFixed(2)) : 'No bids';
        return [
            '<article class="provider-listing' + (isFocused ? ' is-focused-form' : '') + '" data-quote-id="' + escapeHtml(quote.id) + '" data-form-id="' + escapeHtml(formId) + '">',
            '<div class="listing-row body listing-row-toggle" role="button" tabindex="0" aria-expanded="false">',
            '<div class="listing-cell">' + escapeHtml(timeAgoLabel(quote.submittedAt)) + '</div>',
            '<div class="listing-cell">',
            '<div class="listing-title">' + escapeHtml(getQuoteTitle(quote)) + '</div>',
            '<div class="listing-sub">Listing ' + escapeHtml(getFormIdLabel(quote)) + ' • ' + escapeHtml(quote.itemDescription || 'General move') + '</div>',
            '</div>',
            '<div class="listing-cell">' + escapeHtml(getFromLabel(quote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getToLabel(quote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getPickupLabel(quote)) + '</div>',
            '<div class="listing-cell">' + quoteBids.length + '</div>',
            '<div class="listing-cell"><span class="listing-amount">' + escapeHtml(quickQuoteText) + '</span></div>',
            '<div class="listing-cell actions"><button type="button" class="get-details-btn" data-quote-id="' + escapeHtml(quote.id) + '" data-form-id="' + escapeHtml(getFormIdLabel(quote)) + '">Get Details</button></div>',
            '</div>',
            '<div class="listing-details">',
            '<div class="details-layout">',
            createQuickInfoPanel(quote),
            '</div>',
            '</div>',
            '</article>'
        ].join('');
    }

    function createQuickInfoPanel(quote) {
        const pickupCity = firstText(quote.pickupCity, quote.pickupAddress, quote.pickupLocation, quote.pickupTown) || 'Not provided';
        const deliveryCity = firstText(quote.deliveryCity, quote.deliveryAddress, quote.deliveryLocation, quote.deliveryTown) || 'Not provided';
        const pickupPostcode = firstText(quote.pickupPostcode, quote.pickupEircode, quote.pickupAreaEircode, quote.pickupArea) || '';
        const deliveryPostcode = firstText(quote.deliveryPostcode, quote.deliveryEircode, quote.deliveryAreaEircode, quote.deliveryArea) || '';
        const distance = getRouteDistanceLabel(quote);
        const duration = getRouteDurationLabel(quote);
        const moversLines = getMoversRequiredLines(quote);
        const dateLines = getMoveDateLines(quote);
        const timeLines = getPreferredTimesLines(quote);
        const storageLines = getStorageLines(quote);
        const spaceRequiredLines = getSpaceRequiredLines(quote);
        
        // Build full pickup address
        const pickupFull = pickupCity + (pickupPostcode ? ', ' + pickupPostcode : '');
        // Build full delivery address
        const deliveryFull = deliveryCity + (deliveryPostcode ? ', ' + deliveryPostcode : '');

        return [
            '<section class="quick-info-panel-expanded" aria-label="Listing quick information">',
            '<div class="quick-info-wrapper">',
            
            '<div class="quick-info-section quick-info-locations">',
            '<h4>Route Information</h4>',
            '<div class="quick-info-route-map-wrap">',
            '<div class="route-map route-mapbox quick-info-route-map" data-from="' + escapeHtml(pickupFull) + '" data-to="' + escapeHtml(deliveryFull) + '">',
            '<div class="map-footer">',
            '<span class="map-badge">Distance: ' + escapeHtml(distance) + '</span>',
            '<span class="map-badge">ETA: ' + escapeHtml(duration) + '</span>',
            '</div>',
            '</div>',
            '</div>',
            '</div>',
            
            '<div class="quick-info-section quick-info-requirements">',
            '<h4>Details</h4>',
            '<div class="requirements-grid">',
            '<div class="requirement-item">',
            '<span class="requirement-label">Movers</span>',
            '<span class="requirement-value">' + renderRequirementLines(moversLines) + '</span>',
            '</div>',
            '<div class="requirement-item">',
            '<span class="requirement-label">Date Required</span>',
            '<span class="requirement-value">' + renderRequirementLines(dateLines) + '</span>',
            '</div>',
            '<div class="requirement-item">',
            '<span class="requirement-label">Preferred Times</span>',
            '<span class="requirement-value">' + renderRequirementLines(timeLines) + '</span>',
            '</div>',
            '<div class="requirement-item">',
            '<span class="requirement-label">Storage</span>',
            '<span class="requirement-value">' + renderRequirementLines(storageLines) + '</span>',
            '</div>',
            '<div class="requirement-item">',
            '<span class="requirement-label">Space Required</span>',
            '<span class="requirement-value">' + renderRequirementLines(spaceRequiredLines) + '</span>',
            '</div>',
            '</div>',
            '</div>',
            
            '<p class="quick-info-hint">Click "Get Details" to open the full form, including the complete bidding section.</p>',
            '</div>',
            '</section>'
        ].join('');
    }

    function getMoversRequiredLines(quote) {
        const pickupMode = firstText(quote.servicePickupMoversMode, quote['service-pickup-movers-mode']);
        const deliveryMode = firstText(quote.serviceDeliveryMoversMode, quote['service-delivery-movers-mode']);

        const pickup = pickupMode === 'unsure'
            ? 'Pickup: Movers decide'
            : 'Pickup: ' + (firstText(quote.servicePickupMovers, quote['service-pickup-movers'], quote.pickupMovers, quote.moversPickup) || 'Not provided');

        const delivery = deliveryMode === 'unsure'
            ? 'Delivery: Movers decide'
            : 'Delivery: ' + (firstText(quote.serviceDeliveryMovers, quote['service-delivery-movers'], quote.deliveryMovers, quote.moversDelivery) || 'Not provided');

        return [pickup, delivery];
    }

    function getMoveDateLines(quote) {
        const pickupRaw = getPrimaryTransportDateValue(quote);
        const deliveryRaw = getSecondaryTransportDateValue(quote);
        const pickupTime = firstText(
            quote.preferredPickupTime,
            quote.preferredTimePickup,
            quote.pickupTime,
            quote.timeWindowPickup
        ) || 'Time not specified';
        const deliveryTime = firstText(
            quote.preferredDeliveryTime,
            quote.preferredTimeDelivery,
            quote.deliveryTime,
            quote.timeWindowDelivery
        ) || 'Time not specified';

        const pickup = pickupRaw ? formatDate(pickupRaw) : 'Not provided';
        const delivery = deliveryRaw ? formatDate(deliveryRaw) : 'Not provided';

        return [
            'Pickup: ' + pickup + ' - ' + pickupTime,
            'Delivery: ' + delivery + ' - ' + deliveryTime
        ];
    }

    function getPreferredTimesLines(quote) {
        const pickupTime = firstText(quote.preferredPickupTime, quote.pickupTime, '—');
        const pickupFlexibility = String(quote.preferredPickupTimeFlexibility || 'flexible').toLowerCase();
        const pickupBadge = pickupFlexibility === 'mandatory' ? ' <span style="display:inline-block; margin-left:4px; padding:1px 6px; background:#fee2e2; color:#991b1b; border-radius:3px; font-weight:700; font-size:0.7rem; text-decoration:none;">Mandatory time</span>' : ' <span style="display:inline-block; margin-left:4px; padding:1px 6px; background:#e0f2fe; color:#0369a1; border-radius:3px; font-weight:700; font-size:0.7rem; text-decoration:none;">Flexible time</span>';

        const deliveryTime = firstText(quote.preferredDeliveryTime, quote.deliveryTime, '—');
        const deliveryFlexibility = String(quote.preferredDeliveryTimeFlexibility || 'flexible').toLowerCase();
        const deliveryBadge = deliveryFlexibility === 'mandatory' ? ' <span style="display:inline-block; margin-left:4px; padding:1px 6px; background:#fee2e2; color:#991b1b; border-radius:3px; font-weight:700; font-size:0.7rem; text-decoration:none;">Mandatory time</span>' : ' <span style="display:inline-block; margin-left:4px; padding:1px 6px; background:#e0f2fe; color:#0369a1; border-radius:3px; font-weight:700; font-size:0.7rem; text-decoration:none;">Flexible time</span>';

        return [
            'Pickup: ' + pickupTime + pickupBadge,
            'Delivery: ' + deliveryTime + deliveryBadge
        ];
    }

    function getStorageLines(quote) {
        const storageValue = firstText(quote.serviceStorage, quote['service-storage'], quote.storage);
        const storageStatus = String(storageValue || '').trim().toLowerCase();
        if (storageStatus === 'no') return ['No storage'];
        if (storageStatus !== 'yes') return ['Storage not selected'];

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
            return [durationLabel ? 'Yes, approx. for ' + durationLabel : 'Yes, duration pending'];
        }

        const startDate = parseDateValue(firstText(quote.serviceStorageStartDatetime, quote['service-storage-start-datetime']));
        const endDate = parseDateValue(firstText(quote.serviceStorageEndDatetime, quote['service-storage-end-datetime']));
        const durationLabel = formatDurationLabel(startDate, endDate);
        return [durationLabel ? 'Yes, for ' + durationLabel : 'Yes, duration pending'];
    }

    function getSpaceRequiredLines(quote) {
        const summary = calculateSpaceRequiredSummary(quote);
        if (!summary) return ['Not provided'];
        return ['Estimated: ' + summary.totalVolume.toFixed(2) + ' m³ total'];
    }

    function calculateSpaceRequiredSummary(quote) {
        const entries = [];

        const addEntry = function (name, qty, roomName) {
            const itemName = String(name || '').trim();
            const quantity = Math.max(1, parseInt(String(qty || 1), 10) || 1);
            if (!itemName) return;
            const volume = getHouseRemovalItemVolumeEstimate(itemName, roomName);
            if (!(volume > 0)) return;
            entries.push({ quantity: quantity, volume: volume });
        };

        const collectMap = function (map, roomName) {
            if (!map || typeof map !== 'object') return;
            Object.keys(map).forEach(function (itemName) {
                addEntry(itemName, map[itemName], roomName);
            });
        };

        const collectSource = function (source, roomName) {
            if (!source || typeof source !== 'object') return;
            collectMap(source.items, roomName);
            collectMap(source.itemQuantities, roomName);

            if (source.subRoomQuantities && typeof source.subRoomQuantities === 'object') {
                Object.keys(source.subRoomQuantities).forEach(function (subRoom) {
                    collectMap(source.subRoomQuantities[subRoom], subRoom);
                });
            }

            appendTextAsVolumeEntries(source.customItems, roomName);
            appendTextAsVolumeEntries(source.extraItems, roomName);
        };

        const appendTextAsVolumeEntries = function (value, roomName) {
            if (!value) return;
            if (Array.isArray(value)) {
                value.forEach(function (entry) { appendTextAsVolumeEntries(entry, roomName); });
                return;
            }
            if (typeof value === 'object') {
                Object.values(value).forEach(function (entry) { appendTextAsVolumeEntries(entry, roomName); });
                return;
            }

            String(value).split(/[\n,;|]+/).map(function (entry) {
                return String(entry || '').trim();
            }).filter(Boolean).forEach(function (entry) {
                addEntry(entry, 1, roomName);
            });
        };

        if (Array.isArray(quote.floorBlocks)) {
            quote.floorBlocks.forEach(function (block) {
                if (!block || typeof block !== 'object') return;
                collectSource(block.houseInventory, block.floor || block.pickupFloor || block.floorLabel);
            });
        }

        collectSource(quote.houseInventory, quote.pickupFloorSelect);
        collectSource(quote.house_removal_inventory, quote.pickupFloorSelect);
        collectSource(quote.houseRemovalInventory, quote.pickupFloorSelect);
        collectMap(quote.itemQuantities, quote.pickupFloorSelect);
        collectMap(quote.multiFloorInventory && typeof quote.multiFloorInventory === 'object' ? flattenMultiFloorInventory(quote.multiFloorInventory) : null, quote.pickupFloorSelect);

        if (!entries.length) return null;

        const totalVolume = entries.reduce(function (sum, entry) {
            return sum + (entry.volume * entry.quantity);
        }, 0);
        const totalQuantity = entries.reduce(function (sum, entry) {
            return sum + entry.quantity;
        }, 0);

        if (!(totalVolume > 0) || !(totalQuantity > 0)) return null;
        return {
            totalVolume: totalVolume,
            totalQuantity: totalQuantity
        };
    }

    function flattenMultiFloorInventory(multiFloorInventory) {
        const flattened = {};
        Object.keys(multiFloorInventory || {}).forEach(function (floorName) {
            const floorItems = multiFloorInventory[floorName];
            if (!floorItems || typeof floorItems !== 'object') return;
            Object.keys(floorItems).forEach(function (itemName) {
                flattened[itemName] = (parseInt(flattened[itemName], 10) || 0) + (parseInt(floorItems[itemName], 10) || 0);
            });
        });
        return flattened;
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

    function renderRequirementLines(lines) {
        if (!Array.isArray(lines) || !lines.length) return escapeHtml('Not provided');
        return lines
            .filter((line) => String(line || '').trim())
            .map((line) => '<span class="requirement-line">' + line + '</span>')
            .join('');
    }

    function createStepCard(title, pairs) {
        const content = pairs.map((pair) => {
            return [
                '<div class="kv-item">',
                '<div class="kv-key">' + escapeHtml(pair[0]) + '</div>',
                '<div class="kv-value">' + escapeHtml(pair[1]) + '</div>',
                '</div>'
            ].join('');
        }).join('');

        return [
            '<section class="step-card">',
            '<h4>' + escapeHtml(title) + '</h4>',
            '<div class="kv-list">' + content + '</div>',
            '</section>'
        ].join('');
    }

    function createReferenceStyleDemoForm(quote) {
        const itemRows = buildDemoItemRows(quote);
        const photoCount = Number(getAttachmentCountLabel(quote)) || 0;

        return [
            '<section class="demo-form-card">',
            '<div class="demo-form-hero">',
            '<div class="demo-locations">',
            '<div class="demo-location-block">',
            '<div class="demo-location-icon pickup"></div>',
            '<div>',
            '<div class="demo-location-country">Ireland</div>',
            '<div class="demo-location-title">' + escapeHtml(getFromLabel(quote)) + '</div>',
            '<div class="demo-location-date">' + escapeHtml(getPickupTimeLabel(quote)) + '</div>',
            '</div>',
            '</div>',
            '<div class="demo-location-block">',
            '<div class="demo-location-icon delivery"></div>',
            '<div>',
            '<div class="demo-location-country">Ireland</div>',
            '<div class="demo-location-title">' + escapeHtml(getToLabel(quote)) + '</div>',
            '<div class="demo-location-date">' + escapeHtml(getDeliveryTimeLabel(quote)) + '</div>',
            '</div>',
            '</div>',
            '</div>',
            '<div class="demo-route-map-wrap">',
            createRouteMapCard(getFromLabel(quote), getToLabel(quote), getRouteDistanceLabel(quote), getRouteDurationLabel(quote)),
            '</div>',
            '</div>',
            '<div class="demo-form-section">',
            '<div class="demo-section-header">',
            '<h4>Inventory</h4>',
            '<span class="preview-badge">' + escapeHtml(getItemsEnteredLabel(quote) + ' items') + '</span>',
            '</div>','<div class="demo-inventory-summary">',
            '<div class="demo-inventory-note">' + escapeHtml(summarizeEntireInventoryLabel(quote)) + '</div>',
            '<div class="demo-inventory-meta">',
            '<span><strong>Delivery floor:</strong> ' + escapeHtml(getDeliveryFloorLabel(quote)) + '</span>',
            '<span><strong>Floor assignment:</strong> ' + escapeHtml(summarizeItemAssignments(quote)) + '</span>',
            '</div>',
            '</div>',
            '<div class="demo-item-list-wrap">',
            '<ul class="demo-item-list">',
                itemRows.length ? itemRows.join('') : '<li class="demo-empty-line">No inventory listed</li>',
            '</ul>',
            '</div>',
            '<div class="demo-form-section demo-form-details">',
            '<div class="demo-form-divider"></div>',
            buildDemoFieldRow('Type of service', getServiceLabel(quote)),
            buildDemoFieldRow('Pick-up', getOverviewPickupLabel(quote)),
            buildDemoFieldRow('Delivery', getOverviewDeliveryLabel(quote)),
            buildDemoFieldRow('Customer', getCustomerTypeLabel(quote)),
            buildDemoFieldRow('Additional information', getOverviewNotesLabel(quote)),
            buildDemoFieldRow('Pictures', String(photoCount)),
            '<div class="demo-form-section-heading">Captured data</div>',
            '<div class="demo-captured-list">',
            getCapturedDataPairs(quote).map((pair) => buildDemoFieldRow(pair[0], pair[1], true)).join(''),
            '</div>',
            '</div>',
            '</section>'
        ].join('');
    }

    function buildDemoItemRows(quote) {
        const rows = [];
        const seen = new Set();

        const quantityItems = quote.itemQuantities && typeof quote.itemQuantities === 'object'
            ? Object.entries(quote.itemQuantities)
            : [];

        quantityItems.forEach(([name, amount]) => {
            const quantity = Number(amount) || 0;
            const fromFloor = getItemFloorFromLabel(quote, name);
            const toFloor = getItemFloorToLabel(quote, name);
            const key = normalizeItemKey(name);
            seen.add(key);
            rows.push([
                '<li class="demo-item-row">',
                '<div class="demo-item-name">' + escapeHtml(formatRawLabel(name)) + ' <span class="demo-item-count">x' + escapeHtml(quantity ? String(quantity) : '1') + '</span></div>',
                '<div class="demo-item-meta">',
                '<span><strong>From:</strong> ' + escapeHtml(fromFloor) + '</span>',
                '<span><strong>To:</strong> ' + escapeHtml(toFloor) + '</span>',
                '</div>',
                '</li>'
            ].join(''));
        });

        collectCustomInventoryEntries(quote).forEach((entry) => {
            const key = normalizeItemKey(entry);
            if (!key || seen.has(key)) return;
            seen.add(key);

            rows.push([
                '<li class="demo-item-row custom">',
                '<div class="demo-item-name">' + escapeHtml(formatRawLabel(entry)) + ' <span class="demo-item-count">x1</span></div>',
                '<div class="demo-item-meta">',
                '<span><strong>From:</strong> ' + escapeHtml(getItemFloorFromLabel(quote, entry)) + '</span>',
                '<span><strong>To:</strong> ' + escapeHtml(getItemFloorToLabel(quote, entry)) + '</span>',
                '</div>',
                '</li>'
            ].join(''));
        });

        return rows;
    }

    function collectCustomInventoryEntries(quote) {
        const values = [];

        appendCustomInventoryValue(values, quote.customItems);
        appendCustomInventoryValue(values, quote.extraItems);

        const floorBlocks = Array.isArray(quote.floorBlocks) ? quote.floorBlocks : [];
        floorBlocks.forEach((block) => {
            appendCustomInventoryValue(values, block && block.houseInventory && block.houseInventory.customItems);
            appendCustomInventoryValue(values, block && block.houseInventory && block.houseInventory.extraItems);
            appendCustomInventoryValue(values, block && block.officeInventory && block.officeInventory.customItems);
        });

        return values;
    }

    function appendCustomInventoryValue(target, value) {
        if (!value) return;

        if (Array.isArray(value)) {
            value.forEach((item) => appendCustomInventoryValue(target, item));
            return;
        }

        if (typeof value === 'object') {
            Object.values(value).forEach((item) => appendCustomInventoryValue(target, item));
            return;
        }

        String(value)
            .split(/[\n,;|]+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .forEach((item) => target.push(item));
    }

    function getItemFloorFromLabel(quote, itemName) {
        const pickupAssignments = firstObject(
            quote.itemPickupFloorAssignments,
            quote.pickupItemFloorAssignments,
            quote.pickupFloorAssignments
        );

        const value = resolveAssignmentForItem(pickupAssignments, itemName);
        return value || firstText(quote.pickupFloorSelect, quote.pickupFloor, quote.originFloor, quote.fromFloor) || 'Not provided';
    }

    function getItemFloorToLabel(quote, itemName) {
        const deliveryAssignments = firstObject(
            quote.itemFloorAssignments,
            quote.deliveryItemFloorAssignments,
            quote.deliveryFloorAssignments
        );

        const value = resolveAssignmentForItem(deliveryAssignments, itemName);
        return value || getDeliveryFloorLabel(quote);
    }

    function resolveAssignmentForItem(assignments, itemName) {
        if (!assignments || typeof assignments !== 'object') return '';

        const targetKey = normalizeItemKey(itemName);
        const directValue = assignments[itemName];
        if (directValue && String(directValue).trim()) return String(directValue).trim();

        const keys = Object.keys(assignments);
        const match = keys.find((key) => normalizeItemKey(key) === targetKey);
        if (match && assignments[match] && String(assignments[match]).trim()) {
            return String(assignments[match]).trim();
        }

        return '';
    }

    function normalizeItemKey(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '');
    }

    function firstObject() {
        for (let i = 0; i < arguments.length; i += 1) {
            const value = arguments[i];
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                return value;
            }
        }
        return null;
    }

    function buildDemoFieldRow(label, value, compact = false) {
        return [
            '<div class="demo-field-row' + (compact ? ' compact' : '') + '">',
            '<div class="demo-field-label">' + escapeHtml(label) + '</div>',
            '<div class="demo-field-value">' + escapeHtml(value) + '</div>',
            '</div>'
        ].join('');
    }

    function buildDemoFieldLine(label, value) {
        return [
            '<div class="demo-field-line">',
            '<div class="demo-field-label">' + escapeHtml(label) + '</div>',
            '<div class="demo-field-value">' + escapeHtml(value) + '</div>',
            '</div>'
        ].join('');
    }

    function createOverviewStepCard(quote) {
        const overviewPairs = [
            ['Type of service', getServiceLabel(quote)],
            ['Pick-up', getOverviewPickupLabel(quote)],
            ['Delivery', getOverviewDeliveryLabel(quote)],
            ['Customer', getCustomerTypeLabel(quote)],
            ['Additional information', getOverviewNotesLabel(quote)],
            ['Pictures', getAttachmentCountLabel(quote)]
        ];

        const capturedPairs = getCapturedDataPairs(quote)
            .slice(0, 8)
            .map((pair) => [pair[0], pair[1]]);

        return [
            '<section class="step-card overview-step-card">',
            '<div class="overview-step-header">',
            '<div>',
            '<h4>Step 8: Overview</h4>',
            '<div class="map-meta">Complete summary pulled from the form data</div>',
            '</div>',
            '<span class="preview-badge">Overview</span>',
            '</div>',
            '<div class="overview-grid">',
            overviewPairs.map((pair) => [
                '<div class="overview-field">',
                '<div class="preview-label">' + escapeHtml(pair[0]) + '</div>',
                '<div class="preview-value">' + escapeHtml(pair[1]) + '</div>',
                '</div>'
            ].join('')).join(''),
            '</div>',
            '<div class="overview-captured">',
            '<div class="preview-label">Captured data</div>',
            '<div class="kv-list">',
            capturedPairs.map((pair) => [
                '<div class="kv-item">',
                '<div class="kv-key">' + escapeHtml(pair[0]) + '</div>',
                '<div class="kv-value">' + escapeHtml(pair[1]) + '</div>',
                '</div>'
            ].join('')).join(''),
            '</div>',
            '</div>',
            '</section>'
        ].join('');
    }

    function getCustomerTypeLabel(quote) {
        return firstText(quote.customerType, quote.customerTypeLabel, quote.customerCategory, quote.customerKind) || 'Private person';
    }

    function getOverviewPickupLabel(quote) {
        return firstText(
            quote.pickupOverview,
            quote.pickupSummary,
            quote.pickupFloorSummary,
            getFromLabel(quote) + ' / ' + getPickupLiftLabel(quote)
        ) || 'Not provided';
    }

    function getOverviewDeliveryLabel(quote) {
        return firstText(
            quote.deliveryOverview,
            quote.deliverySummary,
            quote.deliveryFloorSummary,
            getToLabel(quote) + ' / ' + getDeliveryLiftLabel(quote)
        ) || 'Not provided';
    }

    function createRouteMapCard(fromLabel, toLabel, distanceLabel, durationLabel) {
        return [
            '<section class="step-card map-step-card">',
            '<div class="map-header">',
            '<h4>Route map preview</h4>',
            '<div class="map-meta">Visual route summary for provider review</div>',
            '</div>',
            '<div class="route-map route-mapbox" data-from="' + escapeHtml(fromLabel) + '" data-to="' + escapeHtml(toLabel) + '">',
            '<div class="map-footer">',
            '<span class="map-badge">Distance: ' + escapeHtml(distanceLabel) + '</span>',
            '<span class="map-badge">ETA: ' + escapeHtml(durationLabel) + '</span>',
            '</div>',
            '</div>',
            '</section>'
        ].join('');
    }

    function createRouteMarkerElement(label, variant) {
        const element = document.createElement('div');
        element.className = 'route-marker route-marker--' + String(variant || '').trim();
        element.textContent = String(label || '').trim();
        return element;
    }

    function ensureMapboxAccessToken() {
        if (!window.mapboxgl) return false;

        const currentToken = String(mapboxgl.accessToken || '').trim();
        if (currentToken) return true;

        const fallbackToken = String(ANYTRANSPORT_MAPBOX_TOKEN || '').trim();
        if (!fallbackToken) return false;

        mapboxgl.accessToken = fallbackToken;
        return !!String(mapboxgl.accessToken || '').trim();
    }

    function initializeMapsInScope(scope) {
        const root = scope || document;
        const mapEls = root.querySelectorAll('.route-mapbox');
        if (!mapEls.length) return;
        if (!window.mapboxgl || !ensureMapboxAccessToken()) return;

        mapEls.forEach((mapEl) => {
            if (mapEl.__anytransportMap) {
                mapEl.__anytransportMap.resize();
                return;
            }
            renderRouteMapbox(mapEl);
        });
    }

    async function renderRouteMapbox(mapEl) {
        const fromLabel = String(mapEl.getAttribute('data-from') || '').trim();
        const toLabel = String(mapEl.getAttribute('data-to') || '').trim();

        try {
            const map = new mapboxgl.Map({
                container: mapEl,
                style: 'mapbox://styles/mapbox/streets-v12',
                center: [-6.2603, 53.3498],
                zoom: 8,
                attributionControl: false
            });

            mapEl.__anytransportMap = map;

            const [fromCoords, toCoords] = await Promise.all([
                geocodeSingleAddress(fromLabel),
                geocodeSingleAddress(toLabel)
            ]);

            if (!fromCoords || !toCoords) {
                if (fromCoords) {
                    new mapboxgl.Marker({ element: createRouteMarkerElement('A', 'pickup') }).setLngLat(fromCoords).addTo(map);
                    map.setCenter(fromCoords);
                    map.setZoom(10);
                }
                if (toCoords) {
                    new mapboxgl.Marker({ element: createRouteMarkerElement('B', 'delivery') }).setLngLat(toCoords).addTo(map);
                    map.setCenter(toCoords);
                    map.setZoom(10);
                }
                return;
            }

            new mapboxgl.Marker({ element: createRouteMarkerElement('A', 'pickup') })
                .setLngLat(fromCoords)
                .setPopup(new mapboxgl.Popup().setText('Pickup'))
                .addTo(map);

            new mapboxgl.Marker({ element: createRouteMarkerElement('B', 'delivery') })
                .setLngLat(toCoords)
                .setPopup(new mapboxgl.Popup().setText('Delivery'))
                .addTo(map);

            const routeGeometry = await fetchDirectionsGeometry(fromCoords, toCoords);
            if (routeGeometry) {
                const drawRoute = () => {
                    renderOverviewRouteGeometry(map, routeGeometry);
                };

                if (typeof map.isStyleLoaded === 'function' && map.isStyleLoaded()) {
                    drawRoute();
                } else {
                    map.once('load', drawRoute);
                }
            }

            const drawAndFit = () => {
                const bounds = new mapboxgl.LngLatBounds();
                bounds.extend(fromCoords);
                bounds.extend(toCoords);
                map.fitBounds(bounds, { padding: 44, maxZoom: 11 });
            };

            if (map.isStyleLoaded()) {
                drawAndFit();
            } else {
                map.on('load', drawAndFit);
            }
        } catch (error) {
            console.warn('Mapbox preview failed to render', error);
        }
    }

    async function geocodeSingleAddress(label) {
        const query = String(label || '').trim();
        if (!query || !window.mapboxgl || !mapboxgl.accessToken) return null;

        const encoded = encodeURIComponent(query);
        const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' + encoded + '.json?access_token=' + encodeURIComponent(mapboxgl.accessToken) + '&limit=1&country=ie&types=postcode,address,place';

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const feature = data && Array.isArray(data.features) ? data.features[0] : null;
            if (!feature || !Array.isArray(feature.center) || feature.center.length < 2) return null;
            return [Number(feature.center[0]), Number(feature.center[1])];
        } catch (error) {
            return null;
        }
    }

    function renderOverviewRouteGeometry(map, geometry) {
        if (!map || !geometry) return;

        const sourceId = 'provider-overview-route-source';
        const layerId = 'provider-overview-route-layer';

        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        map.addSource(sourceId, {
            type: 'geojson',
            data: {
                type: 'Feature',
                geometry,
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
                'line-width': 4,
                'line-opacity': 0.85
            }
        });
    }

    async function fetchDirectionsGeometry(fromCoords, toCoords) {
        if (!window.mapboxgl || !mapboxgl.accessToken) return null;

        const coords = String(fromCoords[0]) + ',' + String(fromCoords[1]) + ';' + String(toCoords[0]) + ',' + String(toCoords[1]);
        const url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' + coords + '?access_token=' + encodeURIComponent(mapboxgl.accessToken) + '&geometries=geojson&overview=full';

        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const data = await response.json();
            const route = data && Array.isArray(data.routes) ? data.routes[0] : null;
            return route && route.geometry ? route.geometry : null;
        } catch (error) {
            return null;
        }
    }

    function shortMapLabel(value) {
        const text = String(value || '').trim();
        if (!text) return 'Not set';
        const firstSegment = text.split(',')[0].trim();
        if (firstSegment.length <= 18) return firstSegment;
        return firstSegment.slice(0, 18).trim() + '...';
    }

    function createBidPanel(quote, quoteBids, myBid, myBidText) {
        const expiresDefault = toLocalDateTimeInput(nextWeekAt2359());
        const bidCap = myBid ? Number(myBid.amount) : null;
        const bidCapValue = Number.isFinite(bidCap) && bidCap > 0 ? bidCap : null;
        const bidMaxAttr = bidCapValue ? (' max="' + bidCapValue.toFixed(0) + '" data-max-bid="' + bidCapValue.toFixed(2) + '"') : '';
        const bidPlaceholder = bidCapValue ? String(Math.max(1, Math.floor(bidCapValue))) : '85';

        return [
            '<aside class="bid-panel">',
            '<h4>Place your bid</h4>',
            '<p class="bid-panel-helper">Enter your amount, add a message, and submit to add it to the current bids list.</p>',
            '<div class="bid-meta">',
            '<div>Total bids: ' + quoteBids.length + '</div>',
            '<div>' + escapeHtml(myBidText) + '</div>',
            '</div>',
            '<div class="bid-history">',
            '<div class="bid-history-title">Current bids</div>',
            renderBidHistory(quoteBids),
            '</div>',
            '<div class="bid-field bid-row">',
            '<div class="bid-currency">€</div>',
            '<input type="number" min="1" step="1" class="bid-input bid-amount-input" data-quote-id="' + escapeHtml(quote.id) + '" value="' + (myBid ? Number(myBid.amount).toFixed(0) : '') + '" placeholder="' + escapeHtml(bidPlaceholder) + '"' + bidMaxAttr + '>',
            '</div>',
            '<div class="bid-field">',
            '<label class="sr-only" for="bid-template-' + escapeHtml(quote.id) + '">Bid template</label>',
            '<select id="bid-template-' + escapeHtml(quote.id) + '" class="bid-select bid-template-select" data-quote-id="' + escapeHtml(quote.id) + '">',
            '<option value="available">Availability message</option>',
            '<option value="insured">Insurance message</option>',
            '<option value="express">Express delivery message</option>',
            '<option value="custom">Custom message</option>',
            '</select>',
            '</div>',
            '<div class="bid-field">',
            '<textarea class="bid-textarea bid-message-input" data-quote-id="' + escapeHtml(quote.id) + '" placeholder="Write a short message to the customer">' + escapeHtml(myBid ? myBid.message : BID_TEMPLATES.available) + '</textarea>',
            '</div>',
            '<div class="bid-field">',
            '<label class="sr-only" for="bid-expiry-' + escapeHtml(quote.id) + '">Bid expiry</label>',
            '<input id="bid-expiry-' + escapeHtml(quote.id) + '" type="datetime-local" class="bid-input bid-expiry-input" data-quote-id="' + escapeHtml(quote.id) + '" value="' + escapeHtml(myBid ? toLocalDateTimeInput(myBid.expiresAt) : expiresDefault) + '">',
            '</div>',
            '<div class="bid-actions">',
            '<button type="button" class="mini-btn place-bid-btn" data-quote-id="' + escapeHtml(quote.id) + '">Submit bid</button>',
            myBid ? '<button type="button" class="ghost-btn withdraw-bid-btn" data-bid-id="' + escapeHtml(myBid.id) + '">Withdraw</button>' : '',
            '</div>',
            '</aside>'
        ].join('');
    }

    function renderBidHistory(quoteBids) {
        if (!Array.isArray(quoteBids) || !quoteBids.length) {
            return '<div class="bid-history-empty">No bids submitted yet.</div>';
        }

        const rows = quoteBids
            .slice()
            .sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0))
            .map((bid) => {
                const bidder = escapeHtml(getBidderLabel(bid));
                const amount = Number(bid.amount);
                const amountText = Number.isFinite(amount) ? ('€' + amount.toFixed(2)) : '€0.00';
                return '<div class="bid-history-item"><span class="bidder">' + bidder + '</span><span class="amount">' + escapeHtml(amountText) + '</span></div>';
            })
            .join('');

        return '<div class="bid-history-list">' + rows + '</div>';
    }

    function getBidderLabel(bid) {
        return firstText(
            getUsernameForProviderId(bid.providerId),
            bid.providerUsername,
            bid.providerNickname,
            bid.providerName,
            bid.providerCompany,
            bid.providerEmail,
            bid.providerId
        ) || 'Provider';
    }

    function getUsernameForProviderId(providerId) {
        const targetId = String(providerId || '').trim();
        if (!targetId) return '';

        try {
            const users = JSON.parse(localStorage.getItem('anytransport_users') || '[]');
            if (!Array.isArray(users)) return '';

            const user = users.find((entry) => String(entry.id || '').trim() === targetId);
            if (!user) return '';

            return firstText(user.username, user.nickname, user.handle, user.name) || '';
        } catch (_error) {
            return '';
        }
    }

    function getLowestBidForProvider(bids, providerId) {
        const providerBids = Array.isArray(bids)
            ? bids.filter((bid) => idsEqual(bid && bid.providerId, providerId) && isActiveBid(bid))
            : [];
        return getLowestBid(providerBids);
    }

    function updateDashboardScopeCounts(watchingCount, biddingCount, wonCount) {
        const watchingEl = document.getElementById('count-watching');
        const biddingEl = document.getElementById('count-bidding');
        const wonEl = document.getElementById('count-won');

        if (watchingEl) watchingEl.textContent = String(Number(watchingCount) || 0);
        if (biddingEl) biddingEl.textContent = String(Number(biddingCount) || 0);
        if (wonEl) wonEl.textContent = String(Number(wonCount) || 0);
    }

    function matchesListingIdFilter(quote, filterValue) {
        const needle = String(filterValue || '').trim().toLowerCase();
        if (!needle) return true;

        const candidates = [
            quote && quote.id,
            quote && quote.formId,
            quote && quote.quoteId,
            quote && quote.requestId,
            getFormIdLabel(quote)
        ];

        return candidates.some((value) => String(value || '').toLowerCase().includes(needle));
    }

    function getWonQuoteIdsForProvider(providerId, quotes, bids) {
        const wonIds = new Set();
        const targetProvider = normalizeIdValue(providerId);
        if (!targetProvider) return wonIds;

        const quoteList = Array.isArray(quotes) ? quotes : [];
        const bidList = Array.isArray(bids) ? bids : [];

        quoteList.forEach((quote) => {
            const quoteId = normalizeIdValue(quote && quote.id);
            if (!quoteId) return;

            const explicitWinner = firstText(
                quote.winningProviderId,
                quote.awardedProviderId,
                quote.selectedProviderId,
                quote.acceptedProviderId
            );
            if (String(explicitWinner || '').trim() === targetProvider) {
                wonIds.add(quoteId);
                return;
            }

            const quoteBids = bidList.filter((bid) => idsEqual(bid && bid.quoteId, quoteId));
            const hasAcceptedBid = quoteBids.some((bid) => {
                const providerMatch = idsEqual(bid && bid.providerId, targetProvider);
                if (!providerMatch) return false;
                const status = String(bid.status || '').toLowerCase();
                return status === 'won' || status === 'accepted' || bid.accepted === true;
            });
            if (hasAcceptedBid) {
                wonIds.add(quoteId);
                return;
            }

            if (String(quote.status || '').toLowerCase() !== 'claimed') return;
            const activeBids = quoteBids.filter((bid) => isActiveBid(bid));
            const lowest = getLowestBid(activeBids);
            if (lowest && idsEqual(lowest.providerId, targetProvider)) {
                wonIds.add(quoteId);
            }
        });

        return wonIds;
    }

    function getWatchedQuoteIdsForProvider(providerId) {
        const targetProvider = normalizeIdValue(providerId);
        if (!targetProvider) return [];

        try {
            const parsed = JSON.parse(localStorage.getItem('anytransport_provider_watchlist_' + targetProvider) || '[]');
            return Array.isArray(parsed)
                ? parsed.map((entry) => normalizeIdValue(entry)).filter(Boolean)
                : [];
        } catch (_error) {
            return [];
        }
    }

    function renderMyBids(user) {
        const container = document.getElementById('my-bids-list');
        if (!container) return;

        const bids = getAllBids()
            .filter((bid) => isBidOwnedByUser(bid, user))
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));

        if (!bids.length) {
            container.innerHTML = [
                '<div class="empty-state">',
                '<h3>No bids yet</h3>',
                '<p>Your submitted bids will appear here.</p>',
                '</div>'
            ].join('');
            return;
        }

        const quotesById = {};
        getAllQuotes().forEach((quote) => {
            quotesById[quote.id] = quote;
        });

        container.innerHTML = bids.map((bid) => {
            const quote = quotesById[bid.quoteId] || null;
            const statusLabel = bid.status === 'active' ? 'Active' : 'Withdrawn';
            const title = quote ? getQuoteTitle(quote) : ('Listing ' + bid.quoteId);

            return [
                '<article class="my-bid-card">',
                '<h3>' + escapeHtml(title) + '</h3>',
                '<div class="my-bid-meta">',
                '<div>Listing ID: ' + escapeHtml(getFormIdByQuoteId(bid.quoteId, quotesById)) + '</div>',
                '<div>Amount: €' + Number(bid.amount).toFixed(2) + ' • Status: ' + escapeHtml(statusLabel) + '</div>',
                '<div>Expires: ' + escapeHtml(formatDateTime(bid.expiresAt)) + '</div>',
                '</div>',
                '<p style="margin-top: 8px;">' + escapeHtml(bid.message || '') + '</p>',
                bid.status === 'active'
                    ? '<div class="job-actions" style="margin-top: 10px;"><button type="button" class="ghost-btn withdraw-bid-btn" data-bid-id="' + escapeHtml(bid.id) + '">Withdraw bid</button></div>'
                    : '',
                '</article>'
            ].join('');
        }).join('');
    }

    function createProviderCurrentBidCard(bid, quote, allBids) {
        const quoteId = normalizeIdValue(bid && bid.quoteId);
        const quoteBids = Array.isArray(allBids)
            ? allBids.filter((entry) => idsEqual(entry && entry.quoteId, quoteId) && isActiveBid(entry))
            : [];
        const amountValue = Number(bid && bid.amount);
        const amountText = Number.isFinite(amountValue) ? ('€' + amountValue.toFixed(2)) : '€0.00';

        const title = quote ? getQuoteTitle(quote) : ('Listing ' + quoteId);
        const formLabel = quote ? getFormIdLabel(quote) : quoteId;
        const fromLabel = quote ? getFromLabel(quote) : 'Not provided';
        const toLabel = quote ? getToLabel(quote) : 'Not provided';
        const pickupLabel = quote ? getPickupLabel(quote) : 'Flexible';

        const actionHtml = quote
            ? '<button type="button" class="get-details-btn" data-quote-id="' + escapeHtml(quoteId) + '" data-form-id="' + escapeHtml(formLabel) + '">Get Details</button>'
            : '<button type="button" class="get-details-btn" disabled>Unavailable</button>';

        return [
            '<article class="provider-listing" data-quote-id="' + escapeHtml(quoteId) + '">',
            '<div class="listing-row body">',
            '<div class="listing-cell">' + escapeHtml(timeAgoLabel((bid && (bid.updatedAt || bid.createdAt)) || '')) + '</div>',
            '<div class="listing-cell">',
            '<div class="listing-title">' + escapeHtml(title) + '</div>',
            '<div class="listing-sub">Listing ' + escapeHtml(formLabel) + ' • Your current bid</div>',
            '</div>',
            '<div class="listing-cell">' + escapeHtml(fromLabel) + '</div>',
            '<div class="listing-cell">' + escapeHtml(toLabel) + '</div>',
            '<div class="listing-cell">' + escapeHtml(pickupLabel) + '</div>',
            '<div class="listing-cell">' + quoteBids.length + '</div>',
            '<div class="listing-cell"><span class="listing-amount">' + escapeHtml(amountText) + '</span></div>',
            '<div class="listing-cell actions">' + actionHtml + '</div>',
            '</div>',
            '</article>'
        ].join('');
    }

    function placeBid(quoteId, user) {
        const isDemoListing = quoteId === DEMO_PROVIDER_LISTING_ID;
        const quote = getAllQuotes().find((entry) => entry.id === quoteId) || (isDemoListing ? getDemoProviderListingQuote() : null);
        if (!quote) {
            alert('Listing not found.');
            return;
        }

        const amountInput = document.querySelector('.bid-amount-input[data-quote-id="' + quoteId + '"]');
        const messageInput = document.querySelector('.bid-message-input[data-quote-id="' + quoteId + '"]');
        const expiryInput = document.querySelector('.bid-expiry-input[data-quote-id="' + quoteId + '"]');

        const amount = amountInput ? Number(amountInput.value) : 0;
        const message = messageInput ? String(messageInput.value || '').trim() : '';
        const expiresAt = expiryInput && expiryInput.value ? new Date(expiryInput.value).toISOString() : nextWeekAt2359().toISOString();

        if (!Number.isFinite(amount) || amount <= 0) {
            alert('Enter a valid bid amount.');
            if (amountInput) amountInput.focus();
            return;
        }

        if (!message) {
            alert('Please add a bid message.');
            if (messageInput) messageInput.focus();
            return;
        }

        const bids = getAllBids();
        const now = new Date().toISOString();
        const myActiveBids = bids.filter((bid) => idsEqual(bid && bid.quoteId, quoteId) && isBidOwnedByUser(bid, user) && isActiveBid(bid));
        const lowestMyActiveBid = getLowestBid(myActiveBids);

        if (lowestMyActiveBid && amount > Number(lowestMyActiveBid.amount)) {
            alert('Your new bid must be lower than or equal to your current lowest active bid for this listing.');
            if (amountInput) amountInput.focus();
            return;
        }

        bids.push({
            id: 'bid_' + Math.random().toString(36).slice(2, 10),
            quoteId,
            providerId: user.id,
            providerUsername: user.username || user.nickname || user.nicknameName || user.handle || '',
            providerNickname: user.username || user.nickname || user.nicknameName || user.handle || '',
            providerName: user.name || user.email || 'Provider',
            providerEmail: user.email || '',
            amount,
            message,
            createdAt: now,
            updatedAt: now,
            expiresAt,
            status: 'active'
        });

        saveAllBids(bids);
        renderProviderListings(user);
        renderMyBids(user);
    }

    function getDemoProviderListingQuote() {
        return {
            id: DEMO_PROVIDER_LISTING_ID,
            status: 'pending',
            submittedAt: '2026-04-15T09:15:00.000Z',
            pickupAddress: 'Blanchardstown, Dublin',
            deliveryAddress: 'Donacarney, Meath',
            pickupPostcode: 'D15',
            deliveryPostcode: 'A92',
            pickupLift: 'No',
            deliveryLift: 'Not available',
            propertyType: 'Semi-detached house',
            itemDescription: 'House removal',
            routeDistanceKm: 34,
            routeDurationText: '42 min',
            transportDate: '2026-04-22',
            preferredPickupTime: '09:00 - 11:00',
            preferredDeliveryTime: 'Same day afternoon',
            timeFlexibility: 'Flexible by 2 hours',
            serviceSelections: ['Packing assistance', 'Protective blankets'],
            serviceSpecialInstructions: 'Call before arrival, fragile boxes only',
            mediaAttachments: [{}, {}, {}],
            floorBlocks: [{
                lift: 'No',
                houseInventory: {
                    items: { sofas: 2, 'dining table': 1, boxes: 6, wardrobe: 1 },
                    subRoomQuantities: {},
                    customItems: 'Mirror, bike, garden tools',
                    extraItems: ''
                },
                officeInventory: null
            }],
            itemQuantities: { sofas: 2, 'dining table': 1, boxes: 6, wardrobe: 1 },
            customItems: 'Mirror, bike, garden tools',
            pickupFloorSelect: 'Ground floor',
            deliveryFloorSelect: 'Ground floor',
            itemPickupFloorAssignments: { sofas: 'Ground floor', 'dining table': 'Ground floor', boxes: 'Ground floor', wardrobe: 'Ground floor' },
            itemFloorAssignments: { sofas: 'Ground floor', 'dining table': 'Ground floor', boxes: 'Ground floor', wardrobe: 'Ground floor' },
            overviewNotes: 'Demo listing preview for provider bidding',
            summaryNotes: 'House move with fragile items and mixed floor access',
            notes: 'Call before arrival, fragile boxes only',
            instructions: 'Call before arrival, fragile boxes only'
        };
    }

    function withdrawBid(bidId, user) {
        if (!bidId) return;
        const bids = getAllBids();
        const target = bids.find((bid) => idsEqual(bid && bid.id, bidId) && isBidOwnedByUser(bid, user));
        if (!target) return;

        if (!confirm('Withdraw this bid?')) return;
        target.status = 'withdrawn';
        target.updatedAt = new Date().toISOString();
        saveAllBids(bids);

        renderProviderListings(user);
        renderMyBids(user);
    }

    function editQuote(_quoteId) {
        alert('Edit flow can be connected to quote restore next.');
    }

    function deleteQuote(quoteId, user) {
        if (!confirm('Are you sure you want to delete this request?')) return;

        const quotes = getAllQuotes();
        const target = quotes.find((quote) => quote.id === quoteId);
        if (!target) return;

        const ownerId = target.userId || target.createdBy;
        if (ownerId && ownerId !== user.id) {
            alert('You can only delete your own requests.');
            return;
        }

        const filteredQuotes = quotes.filter((quote) => quote.id !== quoteId);
        try {
            if (window.anytransportApi && typeof window.anytransportApi.deleteQuote === 'function') {
                window.anytransportApi.deleteQuote(quoteId);
            } else {
                saveQuotesToStorage(filteredQuotes);
            }
        } catch (error) {
            alert(error && error.message ? error.message : 'Unable to update quotes right now.');
            return;
        }

        const filteredBids = getAllBids().filter((bid) => bid.quoteId !== quoteId);
        saveAllBids(filteredBids);

        renderAll(user);
    }

    function loadProfileForm(user) {
        const nameEl = document.getElementById('profile-name');
        const usernameEl = document.getElementById('profile-username');
        const emailEl = document.getElementById('profile-email');
        const phoneEl = document.getElementById('profile-phone');
        const cityEl = document.getElementById('profile-city');
        const profileForm = document.getElementById('profile-form');

        if (nameEl) nameEl.value = user.name || '';
        if (usernameEl) usernameEl.value = user.username || user.nickname || user.name || '';
        if (emailEl) emailEl.value = user.email || '';
        if (phoneEl) phoneEl.value = user.phone || '';
        if (cityEl) cityEl.value = user.city || '';

        if (profileForm) {
            profileForm.addEventListener('submit', (event) => {
                event.preventDefault();

                const updatedUser = {
                    ...user,
                    name: nameEl ? nameEl.value : user.name,
                    username: usernameEl ? usernameEl.value : user.username,
                    nickname: usernameEl ? usernameEl.value : user.nickname,
                    email: emailEl ? emailEl.value : user.email,
                    phone: phoneEl ? phoneEl.value : user.phone,
                    city: cityEl ? cityEl.value : user.city
                };

                try {
                    auth.saveUser(updatedUser);
                } catch (error) {
                    alert(error && error.message ? error.message : 'Unable to save profile.');
                    return;
                }

                loadUserInfo(updatedUser);
                alert('Profile updated successfully!');
            });
        }
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
            const raw = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
            if (!Array.isArray(raw)) return [];

            let changed = false;
            const usedFormIds = new Set();
            raw.forEach((quote) => {
                if (!quote || typeof quote !== 'object') return;
                const existing = String(quote.formId || '').trim();
                if (/^\d{5}$/.test(existing)) {
                    usedFormIds.add(existing);
                }
            });

            raw.forEach((quote) => {
                if (!quote || typeof quote !== 'object') return;
                const existing = String(quote.formId || '').trim();
                if (/^\d{5}$/.test(existing)) return;
                quote.formId = generateUniqueFormId(usedFormIds);
                changed = true;
            });

            if (changed) {
                try {
                    saveQuotesToStorage(raw);
                } catch (_error) {
                    // Ignore auto-fix persistence issues and continue with in-memory result.
                }
            }

            return raw;
        } catch (_error) {
            return [];
        }
    }

    function normalizeIdValue(value) {
        return String(value == null ? '' : value).trim();
    }

    function idsEqual(left, right) {
        return normalizeIdValue(left) === normalizeIdValue(right);
    }

    function isActiveBid(bid) {
        return String((bid && bid.status) || 'active').trim().toLowerCase() === 'active';
    }

    function isBidOwnedByUser(bid, user) {
        if (!bid || !user) return false;
        return idsEqual(bid.providerId, user.id);
    }

    function generateUniqueFormId(usedSet) {
        const maxAttempts = 5000;
        for (let i = 0; i < maxAttempts; i += 1) {
            const next = String(Math.floor(10000 + Math.random() * 90000));
            if (!usedSet.has(next)) {
                usedSet.add(next);
                return next;
            }
        }

        const fallbackBase = Date.now() % 90000;
        let fallback = String(10000 + fallbackBase).slice(-5);
        while (usedSet.has(fallback)) {
            fallback = String((Number(fallback) + 1) % 100000).padStart(5, '0');
        }
        usedSet.add(fallback);
        return fallback;
    }

    function getFormIdLabel(quote) {
        return firstText(quote && quote.formId, quote && quote.id, quote && quote.quoteId, quote && quote.requestId, 'Not provided');
    }

    function getFormIdByQuoteId(quoteId, quotesById) {
        const quote = quotesById && quotesById[quoteId] ? quotesById[quoteId] : null;
        return getFormIdLabel(quote || { id: quoteId });
    }

    function getAllBids() {
        if (window.anytransportApi && typeof window.anytransportApi.getBids === 'function') {
            try {
                const bids = window.anytransportApi.getBids('');
                return Array.isArray(bids) ? bids : [];
            } catch (_error) {
                return [];
            }
        }

        try {
            const raw = JSON.parse(localStorage.getItem(BID_STORAGE_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (_error) {
            return [];
        }
    }

    function saveAllBids(bids) {
        if (window.anytransportApi && typeof window.anytransportApi.replaceAllBids === 'function') {
            try {
                window.anytransportApi.replaceAllBids(Array.isArray(bids) ? bids : []);
                return;
            } catch (_error) {
                // Fall back to local storage below.
            }
        }

        localStorage.setItem(BID_STORAGE_KEY, JSON.stringify(bids));
    }

    function getLowestBid(bids) {
        if (!bids || !bids.length) return null;
        return bids.reduce((lowest, current) => {
            if (!lowest) return current;
            return Number(current.amount) < Number(lowest.amount) ? current : lowest;
        }, null);
    }

    function getQuoteTitle(quote) {
        return resolveServiceTypeTitle(quote, 'Transport request');
    }

    function getFromLabel(quote) {
        return firstText(
            quote.pickupAddress,
            quote.pickupCity,
            quote.pickupLocation,
            quote.pickupLocationName,
            quote.pickupAddressLine,
            quote.pickupAddressDisplay,
            quote.pickupStreet,
            quote.pickupTown,
            quote.pickupCounty,
            quote.origin,
            quote.from,
            quote.fromAddress,
            quote.collectionAddress
        ) || 'Not provided';
    }

    function getToLabel(quote) {
        return firstText(
            quote.deliveryAddress,
            quote.deliveryCity,
            quote.deliveryLocation,
            quote.deliveryLocationName,
            quote.deliveryAddressLine,
            quote.deliveryAddressDisplay,
            quote.deliveryStreet,
            quote.deliveryTown,
            quote.deliveryCounty,
            quote.destination,
            quote.to,
            quote.toAddress,
            quote.dropoffAddress
        ) || 'Not provided';
    }

    function getPickupLabel(quote) {
        const value = getPrimaryTransportDateValue(quote);
        return value ? formatDate(value) : 'Flexible';
    }

    function getPrimaryTransportDateValue(quote) {
        const detailsDate = firstText(
            quote.transportDate,
            quote.preferredDate,
            quote.moveDate,
            quote.date
        );

        return firstText(
            detailsDate,
            quote.serviceTransportDate,
            quote['service-transport-date'],
            quote.requestedDate,
            quote.pickupDate,
            quote.pickupTransportDate,
            quote.pickupPreferredDate,
            quote.serviceStorageStartDatetime,
            quote['service-storage-start-datetime'],
            quote.serviceStorageStartApproxFrom,
            quote['service-storage-start-approx-from'],
            quote.serviceStorageStartApproxTo,
            quote['service-storage-start-approx-to']
        );
    }

    function getSecondaryTransportDateValue(quote) {
        const detailsDate = firstText(
            quote.transportDate,
            quote.preferredDate,
            quote.moveDate,
            quote.date
        );

        return firstText(
            detailsDate,
            quote.serviceTransportDate,
            quote['service-transport-date'],
            quote.requestedDate,
            quote.deliveryDate,
            quote.deliveryTransportDate,
            quote.deliveryPreferredDate,
            quote.serviceStorageEndDatetime,
            quote['service-storage-end-datetime'],
            quote.serviceStorageEndApproxFrom,
            quote['service-storage-end-approx-from'],
            quote.serviceStorageEndApproxTo,
            quote['service-storage-end-approx-to'],
            quote.serviceStorageStartDatetime,
            quote['service-storage-start-datetime'],
            quote.serviceStorageStartApproxFrom,
            quote['service-storage-start-approx-from'],
            quote.serviceStorageStartApproxTo,
            quote['service-storage-start-approx-to']
        );
    }

    function getRouteDistanceLabel(quote) {
        const distanceValue = firstText(quote.routeDistanceKm, quote.distanceKm, quote.distance, quote.routeDistance);
        if (!distanceValue) return 'Not provided';
        const numeric = Number(distanceValue);
        if (Number.isFinite(numeric)) return numeric.toFixed(1) + ' km';
        return String(distanceValue);
    }

    function getRouteDurationLabel(quote) {
        return firstText(quote.routeDurationText, quote.routeDuration, quote.durationText, quote.duration) || 'Not provided';
    }

    function getServiceLabel(quote) {
        return resolveServiceTypeTitle(quote, 'General');
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
            quote.title,
            quote.category,
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

    function getPropertyTypeLabel(quote) {
        return firstText(
            quote.pickupPropertyType,
            quote['pickup-property-type'],
            quote.deliveryPropertyType,
            quote['delivery-property-type'],
            quote.propertyType,
            quote.locationType,
            quote.houseType,
            quote.deliveryProperty,
            quote.pickupProperty
        ) || 'Not provided';
    }

    function getItemsEnteredLabel(quote) {
        if (Array.isArray(quote.items)) return String(quote.items.length);
        if (quote.items && typeof quote.items === 'object') return String(Object.keys(quote.items).length);
        const floorCount = countActiveEntries(quote.multiFloorInventory);
        if (floorCount > 0) return String(floorCount);
        const quantityCount = countActiveEntries(quote.itemQuantities);
        if (quantityCount > 0) return String(quantityCount);
        return '0';
    }

    function summarizeFloorBlocks(quote) {
        const sources = [];
        if (Array.isArray(quote.floorBlocks)) sources.push(...quote.floorBlocks);
        if (Array.isArray(quote.stops)) sources.push(...quote.stops);

        const labels = sources
            .map((block) => firstText(
                block && block.floor,
                block && block.name,
                block && block.label,
                block && block.sourceFloor,
                block && block.pickupFloor,
                block && block.deliveryFloor,
                block && block.floorLabel
            ))
            .filter(Boolean)
            .slice(0, 4);

        const fallback = firstText(
            quote.pickupFloorSelect,
            quote['pickup-floor-select'],
            quote.deliveryFloorSelect,
            quote['delivery-floor-select'],
            quote.selectedPickupFloors,
            quote.selectedDeliveryFloors,
            quote.step3SelectedFloors
        );

        if (!labels.length && !fallback) return 'Not provided';
        if (!labels.length) return String(fallback);
        const more = sources.length > labels.length ? ' +' + (sources.length - labels.length) + ' more' : '';
        return labels.join(', ') + more;
    }

    function summarizeHouseInventory(quote) {
        const houseInventory = quote.houseInventory || quote.house_removal_inventory || quote.houseRemovalInventory || null;
        if (!houseInventory || typeof houseInventory !== 'object') {
            const baseCount = countActiveEntries(quote.itemQuantities);
            const customCount = countTextEntries(quote.customItems, quote.extraItems);
            const floorCount = countActiveEntries(quote.multiFloorInventory);
            const total = baseCount + customCount + floorCount;
            return total ? (total + ' item groups') : 'No inventory listed';
        }

        const baseItems = countActiveEntries(houseInventory.items);
        const roomItems = countNestedActiveEntries(houseInventory.subRoomQuantities);
        const custom = countTextEntries(houseInventory.customItems, houseInventory.extraItems);
        const total = baseItems + roomItems + custom;

        return total ? (total + ' item groups') : 'No inventory listed';
    }

    function summarizeOfficeInventory(quote) {
        const officeInventory = quote.officeInventory || quote.officeInventoryState || quote.office_removal_inventory || null;
        if (!officeInventory) {
            const officeCount = countActiveEntries(quote.officeState && quote.officeState.offices);
            const customCount = countTextEntries(quote.officeCustomItems);
            return (officeCount || customCount) ? ((officeCount + customCount) + ' item groups') : 'Not provided';
        }

        if (Array.isArray(officeInventory.offices)) {
            const officeCount = officeInventory.offices.length;
            const itemCount = officeInventory.offices.reduce((sum, office) => {
                return sum + countActiveEntries(office && office.items);
            }, 0);
            return officeCount ? (officeCount + ' offices, ' + itemCount + ' item groups') : 'Not provided';
        }

        const officeCount = firstText(officeInventory.officeCount, officeInventory.count);
        const quantities = countActiveEntries(officeInventory.quantities || officeInventory.items);
        const customItems = countTextEntries(officeInventory.customItems);
        if (officeCount || quantities || customItems) {
            return (officeCount || '1') + ' offices, ' + (quantities + customItems) + ' item groups';
        }
        return 'Not provided';
    }

    function summarizeSpecialCargo(quote) {
        const petCount = summarizePetDetails(quote.petDetails);
        if (petCount !== 'No specialist pet payload') return petCount;

        const vehicleSummary = firstText(
            quote.carDetails,
            quote.motorbikeDetails,
            quote.trailerDetails,
            quote.campervanDetails,
            quote.vehicleDetails,
            quote.specialistDetails,
            quote.industrialDetails,
            quote.freightDetails,
            quote.clearanceDetails
        );
        return vehicleSummary || 'No specialist payload';
    }

    function summarizeHouseInventoryOverview(quote) {
        const lines = [];
        const floorBlocks = Array.isArray(quote.floorBlocks) ? quote.floorBlocks : [];

        floorBlocks.forEach((block) => {
            const inventory = block && block.houseInventory;
            if (!inventory || typeof inventory !== 'object') return;
            collectInventoryLinesFromObject(inventory.items, lines);
            collectNestedInventoryLines(inventory.subRoomQuantities, lines);
            appendTextIfPresent(lines, inventory.customItems);
            appendTextIfPresent(lines, inventory.extraItems);
        });

        if (!lines.length) {
            const inventory = quote.houseInventory || quote.house_removal_inventory || quote.houseRemovalInventory || null;
            if (inventory && typeof inventory === 'object') {
                collectInventoryLinesFromObject(inventory.items, lines);
                collectNestedInventoryLines(inventory.subRoomQuantities, lines);
                appendTextIfPresent(lines, inventory.customItems);
                appendTextIfPresent(lines, inventory.extraItems);
            }
        }

        if (!lines.length) return summarizeHouseInventory(quote);
        return compactList(lines, 6);
    }

    function summarizeOfficeInventoryOverview(quote) {
        const lines = [];
        const floorBlocks = Array.isArray(quote.floorBlocks) ? quote.floorBlocks : [];

        floorBlocks.forEach((block) => {
            const inventory = block && block.officeInventory;
            if (!inventory || typeof inventory !== 'object') return;
            collectInventoryLinesFromObject(inventory.items, lines);
            appendTextIfPresent(lines, inventory.customItems);
        });

        if (!lines.length) {
            const officeInventory = quote.officeInventory || quote.officeInventoryState || quote.office_removal_inventory || null;
            if (officeInventory && typeof officeInventory === 'object') {
                if (Array.isArray(officeInventory.offices)) {
                    officeInventory.offices.forEach((office) => {
                        collectInventoryLinesFromObject(office && (office.items || office.quantities), lines);
                        appendTextIfPresent(lines, office && office.customItems);
                    });
                }
                collectInventoryLinesFromObject(officeInventory.items || officeInventory.quantities, lines);
                appendTextIfPresent(lines, officeInventory.customItems);
            }
        }

        if (!lines.length) return summarizeOfficeInventory(quote);
        return compactList(lines, 6);
    }

    function summarizeSpecialCargoOverview(quote) {
        const base = summarizeSpecialCargo(quote);
        const custom = summarizeCustomItems(quote);
        if (custom === 'Not provided') return base;
        if (base === 'No specialist payload' || base === 'No specialist pet payload') return custom;
        return base + ' | ' + custom;
    }

    function getAssignmentNotesLabel(quote) {
        const assignmentSummary = summarizeItemAssignments(quote);
        const explicit = firstText(
            quote.assignmentNotes,
            quote.assignmentSummary,
            quote.deliveryAssignmentNotes,
            quote.step5AssignmentNotes,
            quote.instructionsForDriver
        );

        if (explicit && assignmentSummary !== 'Not provided') {
            return explicit + ' | ' + assignmentSummary;
        }
        if (explicit) return explicit;
        if (assignmentSummary !== 'Not provided') return assignmentSummary;
        return getInstructionsLabel(quote);
    }

    function summarizePetDetails(petDetails) {
        const pets = petDetails && Array.isArray(petDetails.pets) ? petDetails.pets : [];
        return pets.length ? (pets.length + ' pets') : 'No specialist pet payload';
    }

    function getDeliveryPostcodeLabel(quote) {
        return firstText(quote.deliveryPostcode, quote['delivery-postcode'], quote.deliveryArea, quote.deliveryAreaEircode, quote.deliveryEircode) || 'Not provided';
    }

    function getPickupPostcodeLabel(quote) {
        return firstText(quote.pickupPostcode, quote['pickup-postcode'], quote.pickupArea, quote.pickupAreaEircode, quote.pickupEircode) || 'Not provided';
    }

    function getDeliveryCityLabel(quote) {
        return firstText(quote.deliveryCity, quote.deliveryAddress, quote.deliveryCityArea, quote.deliveryLocation, quote.destinationCity) || 'Not provided';
    }

    function getPickupTimeLabel(quote) {
        return firstText(quote.preferredPickupTime, quote.preferredTimePickup, quote.pickupTime, quote.timeWindowPickup) || 'Flexible';
    }

    function getDeliveryTimeLabel(quote) {
        return firstText(quote.preferredDeliveryTime, quote.preferredTimeDelivery, quote.deliveryTime, quote.timeWindowDelivery) || 'Flexible';
    }

    function getTimeFlexibilityLabel(quote) {
        return firstText(quote.timeFlexibility, quote.flexibility, quote.dateFlexibility, quote.pickupFlexibility, quote.deliveryFlexibility) || 'Not specified';
    }

    function getCustomerPhoneLabel(quote) {
        return firstText(quote.customerPhone, quote.phone, quote.customerTel, quote.contactNumber) || 'Not shared';
    }

    function getAttachmentCountLabel(quote) {
        const attachments = quote.mediaAttachments || quote.attachments || quote.photos || quote.uploads || [];
        if (Array.isArray(attachments)) return String(attachments.length);
        if (attachments && typeof attachments === 'object') return String(Object.keys(attachments).length);
        return '0';
    }

    function getServiceNotesLabel(quote) {
        const stopNotes = Array.isArray(quote.stops)
            ? quote.stops.map((stop) => stop && stop.notes).filter((value) => String(value || '').trim())
            : [];
        return firstText(
            quote.serviceSpecialInstructions,
            quote.specialInstructions,
            quote.step6Notes,
            stopNotes,
            quote.notes,
            quote.note
        ) || 'None provided';
    }

    function normalizeLiftDisplay(value) {
        const raw = String(value == null ? '' : value).trim();
        if (!raw) return 'Not provided';

        const normalized = raw.toLowerCase();
        if (normalized === 'yes' || normalized === 'true' || normalized === 'available' || normalized === 'lift available' || normalized === 'with lift') {
            return 'Lift available';
        }
        if (normalized === 'no' || normalized === 'false' || normalized === 'not available' || normalized === 'no lift' || normalized === 'without lift') {
            return 'No lift';
        }

        return raw;
    }

    function getPickupLiftLabel(quote) {
        const fromBlock = Array.isArray(quote.floorBlocks)
            ? quote.floorBlocks.map((block) => block && block.lift).filter((value) => String(value || '').trim())
            : [];
        return normalizeLiftDisplay(firstText(
            quote.pickupLift,
            quote['pickup-lift'],
            quote.pickupElevator,
            quote.pickupHasLift,
            quote.elevatorPickup,
            quote.lift,
            fromBlock
        ));
    }

    function getDeliveryLiftLabel(quote) {
        const fromStops = Array.isArray(quote.stops)
            ? quote.stops
                .filter((stop) => String(stop && stop.role || '').toLowerCase() === 'delivery')
                .map((stop) => stop && stop.lift)
                .filter((value) => String(value || '').trim())
            : [];
        return normalizeLiftDisplay(firstText(
            quote.deliveryLift,
            quote['delivery-lift'],
            quote.deliveryElevator,
            quote.deliveryHasLift,
            quote.elevatorDelivery,
            quote.dropoffLift,
            fromStops
        ));
    }

    function summarizeEntireInventoryLabel(quote) {
        const lines = [];
        const floorBlocks = Array.isArray(quote.floorBlocks) ? quote.floorBlocks : [];

        floorBlocks.forEach((block) => {
            const house = block && block.houseInventory;
            if (house && typeof house === 'object') {
                collectInventoryLinesFromObject(house.items, lines);
                collectNestedInventoryLines(house.subRoomQuantities, lines);
                appendTextIfPresent(lines, house.customItems);
                appendTextIfPresent(lines, house.extraItems);
            }

            const office = block && block.officeInventory;
            if (office && typeof office === 'object') {
                collectInventoryLinesFromObject(office.items, lines);
                appendTextIfPresent(lines, office.customItems);
            }
        });

        if (!lines.length) {
            collectInventoryLinesFromObject(quote.itemQuantities, lines);
            collectInventoryLinesFromObject(quote.items, lines);
            appendTextIfPresent(lines, summarizeHouseInventoryOverview(quote));
            appendTextIfPresent(lines, summarizeOfficeInventoryOverview(quote));
            appendTextIfPresent(lines, summarizeSpecialCargoOverview(quote));
            appendTextIfPresent(lines, summarizeCustomItems(quote));
        }

        if (!lines.length) return 'Not provided';
        return compactList(lines, 12);
    }

    function getRequestedServicesLabel(quote) {
        const collected = [];

        const listSources = [
            quote.additionalServices,
            quote.serviceSelections,
            quote.selectedServices,
            quote.additionalServiceList,
            quote.step6Selections,
            quote.services
        ];

        listSources.forEach((source) => {
            if (Array.isArray(source)) {
                source.forEach((item) => appendTextIfPresent(collected, item));
                return;
            }
            if (source && typeof source === 'object') {
                Object.entries(source).forEach(([key, value]) => {
                    if (value === true || String(value || '').toLowerCase() === 'yes') {
                        collected.push(formatRawLabel(key));
                        return;
                    }
                    if (typeof value === 'string' && value.trim()) {
                        collected.push(value.trim());
                    }
                });
                return;
            }
            appendTextIfPresent(collected, source);
        });

        const booleanFlags = [
            ['packingRequired', quote.packingRequired],
            ['packingService', quote.packingService],
            ['loadingAssistance', quote.loadingAssistance],
            ['unloadingAssistance', quote.unloadingAssistance],
            ['disassembly', quote.disassembly],
            ['reassembly', quote.reassembly],
            ['storage', quote.storage],
            ['furnitureProtection', quote.furnitureProtection]
        ];

        booleanFlags.forEach(([label, value]) => {
            if (value === true || String(value || '').toLowerCase() === 'yes') {
                collected.push(formatRawLabel(label));
            }
        });

        if (!collected.length) {
            return getServiceLabel(quote);
        }

        return compactList(collected, 6);
    }

    function getMoveDateLabel(quote) {
        const value = getPrimaryTransportDateValue(quote);
        if (!value) return 'Not provided';
        return formatDate(value);
    }

    function normalizeDateKey(rawValue) {
        const text = String(rawValue || '').trim();
        if (!text) return '';

        const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) {
            return isoMatch[1] + '-' + isoMatch[2] + '-' + isoMatch[3];
        }

        const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (slashMatch) {
            const day = String(slashMatch[1]).padStart(2, '0');
            const month = String(slashMatch[2]).padStart(2, '0');
            const year = String(slashMatch[3]);
            return year + '-' + month + '-' + day;
        }

        const date = new Date(text);
        if (!Number.isFinite(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    }

    function getOverviewNotesLabel(quote) {
        return firstText(
            quote.overviewNotes,
            quote.summaryNotes,
            quote.description,
            quote.summary,
            quote.quoteSummary
        ) || 'None provided';
    }

    function getInstructionsLabel(quote) {
        return firstText(
            quote.instructions,
            quote.driverInstructions,
            quote.pickupInstructions,
            quote.deliveryInstructions,
            quote.specialInstructions,
            quote.serviceSpecialInstructions,
            quote.notes,
            quote.note,
            quote.overviewNotes,
            quote.summaryNotes
        ) || 'Not provided';
    }

    function getDeliveryFloorLabel(quote) {
        return firstText(quote.deliveryFloorSelect, quote['delivery-floor-select'], quote.deliveryFloor, quote.dropoffFloor) || 'Not provided';
    }

    function summarizeMultiFloorInventory(quote) {
        const inventory = quote.multiFloorInventory || quote.multiFloor || quote.floorInventory;
        if (!inventory || typeof inventory !== 'object') return 'Not provided';
        const floors = Object.keys(inventory);
        if (!floors.length) return 'Not provided';
        return floors.slice(0, 4).join(', ') + (floors.length > 4 ? ' +' + (floors.length - 4) + ' more' : '');
    }

    function summarizeItemAssignments(quote) {
        const assignments = quote.itemFloorAssignments || quote.assignments || quote.floorAssignments;
        if (!assignments || typeof assignments !== 'object') return 'Not provided';
        const keys = Object.keys(assignments).filter((key) => String(assignments[key] || '').trim());
        return keys.length ? (String(keys.length) + ' assigned items') : 'Not provided';
    }

    function summarizeCustomItems(quote) {
        const customItems = quote.customItems || quote.customItemsPerRoom || quote.extraItems || quote.customItemList;
        if (!customItems || typeof customItems !== 'object' && !String(customItems || '').trim()) return 'Not provided';
        if (Array.isArray(customItems)) return customItems.length ? (String(customItems.length) + ' custom items') : 'Not provided';
        if (typeof customItems === 'object') {
            const keys = Object.keys(customItems).filter((key) => {
                const value = customItems[key];
                return Array.isArray(value) ? value.length > 0 : !!String(value || '').trim();
            });
            return keys.length ? (String(keys.length) + ' custom item groups') : 'Not provided';
        }
        return String(customItems).trim() || 'Not provided';
    }

    function getCapturedDataPairs(quote) {
        const interestingKeys = [
            ['Pickup address', firstText(quote.pickupAddress, quote.pickupAddressLine, quote.pickupLocation, quote.pickupLocationName)],
            ['Pickup city', firstText(quote.pickupCity, quote.pickupTown, quote.pickupCityArea, quote.pickupArea)],
            ['Pickup postcode', firstText(quote.pickupPostcode, quote.pickupEircode, quote.pickupAreaEircode, quote.pickupArea)],
            ['Delivery address', firstText(quote.deliveryAddress, quote.deliveryAddressLine, quote.deliveryLocation, quote.deliveryLocationName)],
            ['Delivery city', firstText(quote.deliveryCity, quote.deliveryTown, quote.deliveryCityArea, quote.deliveryArea)],
            ['Delivery postcode', firstText(quote.deliveryPostcode, quote.deliveryEircode, quote.deliveryAreaEircode, quote.deliveryArea)],
            ['Transport date', firstText(quote.transportDate, quote.preferredDate)],
            ['Pickup time', getPickupTimeLabel(quote)],
            ['Delivery time', getDeliveryTimeLabel(quote)],
            ['Service notes', getServiceNotesLabel(quote)],
            ['Overview notes', firstText(quote.overviewNotes, quote.summaryNotes, quote.description)],
            ['Steps payload', firstText(quote.steps, quote.stepData, quote.formData, quote.quoteData)]
        ];

        const pairs = interestingKeys.filter((pair) => pair[1] && String(pair[1]).trim());
        if (pairs.length) return pairs;

        const rawPairs = Object.entries(quote)
            .filter(([key, value]) => !shouldIgnoreRawKey(key) && hasRenderableValue(value))
            .slice(0, 12)
            .map(([key, value]) => [formatRawLabel(key), stringifyRenderableValue(value)]);

        return rawPairs.length ? rawPairs : [['Captured data', 'No additional values found']];
    }

    function firstText(...values) {
        for (const value of values) {
            if (value === null || value === undefined) continue;
            if (typeof value === 'string' && value.trim()) return value.trim();
            if (typeof value === 'number' && Number.isFinite(value)) return String(value);
            if (typeof value === 'boolean') return value ? 'Yes' : 'No';
            if (Array.isArray(value) && value.length) {
                const joined = value.map((entry) => stringifyRenderableValue(entry)).filter(Boolean).join(', ');
                if (joined) return joined;
            }
            if (typeof value === 'object') {
                const scalar = firstText(value.value, value.label, value.name, value.title, value.text, value.address, value.city, value.postcode);
                if (scalar) return scalar;
            }
        }
        return '';
    }

    function countActiveEntries(source) {
        if (!source) return 0;
        if (Array.isArray(source)) return source.filter((value) => hasRenderableValue(value)).length;
        if (typeof source === 'object') {
            return Object.values(source).reduce((count, value) => count + (hasRenderableValue(value) ? 1 : 0), 0);
        }
        return hasRenderableValue(source) ? 1 : 0;
    }

    function countNestedActiveEntries(source) {
        if (!source || typeof source !== 'object') return 0;
        return Object.values(source).reduce((sum, value) => {
            if (Array.isArray(value)) return sum + value.filter((entry) => hasRenderableValue(entry)).length;
            if (value && typeof value === 'object') return sum + countActiveEntries(value);
            return sum + (hasRenderableValue(value) ? 1 : 0);
        }, 0);
    }

    function countTextEntries(...sources) {
        return sources.reduce((sum, source) => {
            if (Array.isArray(source)) {
                return sum + source.filter((value) => String(value || '').trim()).length;
            }
            if (source && typeof source === 'object') {
                return sum + Object.values(source).filter((value) => String(value || '').trim()).length;
            }
            return sum + (String(source || '').trim() ? 1 : 0);
        }, 0);
    }

    function collectInventoryLinesFromObject(items, collector) {
        if (!items || typeof items !== 'object') return;
        Object.entries(items).forEach(([key, value]) => {
            const qty = Number(value);
            if (!Number.isFinite(qty) || qty <= 0) return;
            collector.push(formatRawLabel(key) + ' x' + qty);
        });
    }

    function collectNestedInventoryLines(source, collector) {
        if (!source || typeof source !== 'object') return;
        Object.entries(source).forEach(([, roomMap]) => {
            if (!roomMap || typeof roomMap !== 'object') return;
            Object.entries(roomMap).forEach(([, itemMap]) => {
                collectInventoryLinesFromObject(itemMap, collector);
            });
        });
    }

    function appendTextIfPresent(collector, value) {
        const text = String(value || '').trim();
        if (!text) return;
        collector.push(text);
    }

    function compactList(values, maxItems) {
        const unique = [];
        values.forEach((value) => {
            const normalized = String(value || '').trim();
            if (!normalized) return;
            if (unique.includes(normalized)) return;
            unique.push(normalized);
        });

        if (!unique.length) return 'Not provided';
        if (unique.length <= maxItems) return unique.join(', ');
        return unique.slice(0, maxItems).join(', ') + ' +' + (unique.length - maxItems) + ' more';
    }

    function hasRenderableValue(value) {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return !!value.trim();
        if (typeof value === 'number') return Number.isFinite(value);
        if (typeof value === 'boolean') return true;
        if (Array.isArray(value)) return value.some((entry) => hasRenderableValue(entry));
        if (typeof value === 'object') return Object.values(value).some((entry) => hasRenderableValue(entry));
        return false;
    }

    function stringifyRenderableValue(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string') return value.trim();
        if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) {
            return value.map((entry) => stringifyRenderableValue(entry)).filter(Boolean).join(', ');
        }
        if (typeof value === 'object') {
            const parts = [];
            ['label', 'name', 'title', 'text', 'value', 'address', 'city', 'postcode', 'floor', 'type'].forEach((key) => {
                if (hasRenderableValue(value[key])) parts.push(stringifyRenderableValue(value[key]));
            });
            if (parts.length) return parts.join(' ');
            try {
                return JSON.stringify(value);
            } catch (_error) {
                return String(value);
            }
        }
        return String(value);
    }

    function shouldIgnoreRawKey(key) {
        return [
            'id',
            'userId',
            'createdBy',
            'status',
            'submittedAt',
            'updatedAt',
            'createdAt',
            'password',
            'passwordConfirm',
            'confirmPassword'
        ].includes(key);
    }

    function formatRawLabel(key) {
        return String(key)
            .replace(/[-_]+/g, ' ')
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/\s+/g, ' ')
            .replace(/^./, (char) => char.toUpperCase());
    }

    function formatDate(rawDate) {
        const value = String(rawDate || '').trim();
        if (!value) return 'Not provided';

        let date = new Date(value);
        if (!Number.isFinite(date.getTime())) {
            const slashMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (slashMatch) {
                const day = String(slashMatch[1]).padStart(2, '0');
                const month = String(slashMatch[2]).padStart(2, '0');
                const year = String(slashMatch[3]);
                date = new Date(year + '-' + month + '-' + day + 'T00:00:00');
            }
        }

        if (!Number.isFinite(date.getTime())) return value;
        return date.toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function formatDateTime(rawDate) {
        const date = new Date(rawDate);
        if (!Number.isFinite(date.getTime())) return 'Not provided';
        return date.toLocaleString('en-IE', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function timeAgoLabel(rawDate) {
        const date = new Date(rawDate);
        if (!Number.isFinite(date.getTime())) return 'Recently';
        const diffMs = Date.now() - date.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (days <= 0) return 'Today';
        if (days === 1) return '1 day ago';
        return days + ' days ago';
    }

    function nextWeekAt2359() {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        date.setHours(23, 59, 0, 0);
        return date;
    }

    function toLocalDateTimeInput(rawDate) {
        const date = rawDate instanceof Date ? rawDate : new Date(rawDate);
        if (!Number.isFinite(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Initialize notification bell
    document.addEventListener('DOMContentLoaded', function () {
        if (typeof window.notificationSystem === 'object' && window.notificationSystem.initBell) {
            window.notificationSystem.initBell();
        }
    }, { once: true });
})();
