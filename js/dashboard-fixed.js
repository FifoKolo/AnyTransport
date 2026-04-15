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
        activeStatus: 'all',
        search: '',
        serviceFilters: [],
        distanceMin: '',
        distanceMax: '',
        dateFilter: '',
        expandedQuoteIds: new Set()
    };

    document.addEventListener('DOMContentLoaded', initDashboard);

    function initDashboard() {
        if (!auth || !auth.isLoggedIn || !auth.isLoggedIn()) {
            alert('You need to sign in to access your dashboard');
            window.location.href = 'index.html';
            return;
        }

        const user = auth.getUser();
        if (!user) {
            alert('Session expired. Please sign in again.');
            window.location.href = 'index.html';
            return;
        }

        loadUserInfo(user);
        wireTabs();
        wireProviderControls(user);
        wireDashboardActions(user);
        loadProfileForm(user);
        ensureDemoListingsExist();
        renderAll(user);

        if (auth.isProvider && auth.isProvider()) {
            showTab('provider-board');
        } else {
            showTab('my-quotes');
            hideProviderOnlyTabs();
        }
    }

    function hideProviderOnlyTabs() {
        document.querySelectorAll('.nav-item[data-tab="provider-board"], .nav-item[data-tab="my-bids"]').forEach((item) => {
            item.style.display = 'none';
        });
    }

    function ensureDemoListingsExist() {
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
            localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify(merged));
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
    }

    function showTab(tabName) {
        document.querySelectorAll('.tab-content').forEach((tab) => tab.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));

        const target = document.getElementById(tabName);
        if (target) target.classList.add('active');

        const navItem = document.querySelector('[data-tab="' + tabName + '"]');
        if (navItem) navItem.classList.add('active');
    }

    function wireProviderControls(user) {
        const searchInput = document.getElementById('provider-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                state.search = String(searchInput.value || '').trim().toLowerCase();
                renderProviderListings(user);
            });
        }

        const filterTabs = document.getElementById('provider-filter-tabs');
        if (filterTabs) {
            filterTabs.addEventListener('click', (event) => {
                const btn = event.target.closest('.provider-filter-btn');
                if (!btn) return;
                state.activeStatus = btn.getAttribute('data-status') || 'all';
                filterTabs.querySelectorAll('.provider-filter-btn').forEach((node) => {
                    node.classList.toggle('active', node === btn);
                });
                renderProviderListings(user);
            });
        }

        const serviceToggles = document.getElementById('service-filter-toggles');
        if (serviceToggles) {
            serviceToggles.addEventListener('click', (event) => {
                const btn = event.target.closest('.service-toggle-btn');
                if (!btn) return;
                const service = btn.getAttribute('data-service') || '';
                if (state.serviceFilters.includes(service)) {
                    state.serviceFilters = state.serviceFilters.filter((s) => s !== service);
                } else {
                    state.serviceFilters.push(service);
                }
                btn.classList.toggle('active');
                renderProviderListings(user);
            });
        }

        const distanceMinInput = document.getElementById('filter-distance-min');
        if (distanceMinInput) {
            distanceMinInput.addEventListener('input', () => {
                state.distanceMin = distanceMinInput.value ? Number(distanceMinInput.value) : '';
                renderProviderListings(user);
            });
        }

        const distanceMaxInput = document.getElementById('filter-distance-max');
        if (distanceMaxInput) {
            distanceMaxInput.addEventListener('input', () => {
                state.distanceMax = distanceMaxInput.value ? Number(distanceMaxInput.value) : '';
                renderProviderListings(user);
            });
        }

        const dateFilter = document.getElementById('filter-date');
        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                state.dateFilter = String(dateFilter.value || '').trim();
                renderProviderListings(user);
            });
        }

        const resetBtn = document.getElementById('filter-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state.serviceFilters = [];
                state.distanceMin = '';
                state.distanceMax = '';
                state.dateFilter = '';
                if (searchInput) searchInput.value = '';
                state.search = '';
                if (serviceToggles) {
                    serviceToggles.querySelectorAll('.service-toggle-btn').forEach((btn) => {
                        btn.classList.remove('active');
                    });
                }
                if (distanceMinInput) distanceMinInput.value = '';
                if (distanceMaxInput) distanceMaxInput.value = '';
                if (dateFilter) dateFilter.value = '';
                renderProviderListings(user);
            });
        }
    }

    function wireDashboardActions(user) {
        document.addEventListener('click', (event) => {
            const toggleBtn = event.target.closest('.toggle-details-btn');
            if (toggleBtn) {
                const listing = toggleBtn.closest('.provider-listing');
                if (!listing) return;
                const isExpanded = listing.classList.toggle('expanded');
                toggleBtn.textContent = isExpanded ? 'Hide' : 'View';
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

        document.addEventListener('change', (event) => {
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
        renderMyQuotes(user.id);
        renderProviderListings(user);
        renderMyBids(user);
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

    function renderMyQuotes(userId) {
        const quotes = getAllQuotes().filter((quote) => quote.userId === userId || quote.createdBy === userId);
        const container = document.getElementById('my-quotes-list');
        if (!container) return;

        if (!quotes.length) {
            container.innerHTML = [
                '<div class="empty-state">',
                '<h3>No quotes requested yet</h3>',
                '<p>Request your first quote to get started.</p>',
                '<a href="create-job.html" class="btn btn-primary">Get a Quote</a>',
                '</div>'
            ].join('');
            return;
        }

        const bids = getAllBids();
        container.innerHTML = quotes
            .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
            .map((quote) => createCustomerQuoteCard(quote, bids, userId))
            .join('');
    }

    function createCustomerQuoteCard(quote, bids, userId) {
        const quoteBids = bids.filter((bid) => bid.quoteId === quote.id && bid.status === 'active');
        const lowest = getLowestBid(quoteBids);
        const statusLabel = quote.status === 'claimed' ? 'CLAIMED' : 'PENDING';
        const statusClass = quote.status === 'claimed' ? 'claimed' : 'pending';

        const actions = [
            '<button class="btn btn-secondary quote-edit-btn" data-quote-id="' + escapeHtml(quote.id) + '">Edit</button>',
            '<button class="btn btn-outline quote-delete-btn" data-quote-id="' + escapeHtml(quote.id) + '">Delete</button>'
        ].join('');

        return [
            '<article class="job-card ' + statusClass + '">',
            '<div class="job-header">',
            '<div>',
            '<h3 class="job-title">' + escapeHtml(getQuoteTitle(quote)) + '</h3>',
            '<div class="job-meta">',
            '<span class="job-meta-item">ID ' + escapeHtml(quote.id) + '</span>',
            quote.transportDate ? '<span class="job-meta-item">Date ' + escapeHtml(formatDate(quote.transportDate)) + '</span>' : '',
            '<span class="job-meta-item">Bids ' + quoteBids.length + '</span>',
            lowest ? '<span class="job-meta-item">Lowest €' + Number(lowest.amount).toFixed(2) + '</span>' : '',
            '</div>',
            '</div>',
            '<span class="job-status ' + statusClass + '">' + statusLabel + '</span>',
            '</div>',
            '<div class="job-locations">',
            '<div class="location-item"><div class="location-label">From</div><div class="location-value">' + escapeHtml(getFromLabel(quote)) + '</div></div>',
            '<div class="location-item"><div class="location-label">To</div><div class="location-value">' + escapeHtml(getToLabel(quote)) + '</div></div>',
            '</div>',
            '<div class="job-footer"><div class="job-actions">' + actions + '</div></div>',
            '</article>'
        ].join('');
    }

    function renderProviderListings(user) {
        const container = document.getElementById('provider-listings');
        if (!container) return;

        const quotes = getAllQuotes();
        const bids = getAllBids();
        const myBids = bids.filter((bid) => bid.providerId === user.id && bid.status === 'active');

        const filtered = quotes.filter((quote) => {
            if (state.activeStatus === 'pending' && quote.status !== 'pending') return false;
            if (state.activeStatus === 'with-my-bid' && !myBids.find((bid) => bid.quoteId === quote.id)) return false;

            // Text search filter
            if (state.search) {
                const haystack = [
                    quote.id,
                    getQuoteTitle(quote),
                    getFromLabel(quote),
                    getToLabel(quote),
                    quote.itemDescription,
                    quote.pickupCity,
                    quote.deliveryCity
                ].join(' ').toLowerCase();
                if (!haystack.includes(state.search)) return false;
            }

            // Service filter (multi-select)
            if (state.serviceFilters.length > 0) {
                const quoteService = String(getQuoteTitle(quote) || quote.itemDescription || '').toLowerCase();
                const matchesService = state.serviceFilters.some((service) => quoteService.includes(service));
                if (!matchesService) return false;
            }

            // Distance filter
            const distance = Number(quote.routeDistanceKm) || 0;
            if (state.distanceMin !== '' && distance < Number(state.distanceMin)) return false;
            if (state.distanceMax !== '' && distance > Number(state.distanceMax)) return false;

            // Date filter
            if (state.dateFilter) {
                const quoteDate = String(quote.transportDate || '').trim();
                const filterDate = String(state.dateFilter).trim();
                if (quoteDate < filterDate) return false;
            }

            return true;
        }).sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));

        updateProviderKpis(filtered, quotes, myBids);

        const previewListing = createProviderPreviewListing(user, bids);

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

        if (!filtered.length) {
            container.innerHTML = [
                header,
                previewListing,
                '<div class="empty-state">',
                '<h3>No listings match your current filters</h3>',
                '<p>Try another status or search keyword.</p>',
                '</div>'
            ].join('');
            return;
        }

        const rows = filtered.map((quote) => createProviderListingCard(quote, bids, user)).join('');
        container.innerHTML = header + previewListing + rows;

        container.querySelectorAll('.provider-listing[data-quote-id]').forEach((listing) => {
            const quoteId = listing.getAttribute('data-quote-id');
            const shouldExpand = quoteId && state.expandedQuoteIds && state.expandedQuoteIds.has(quoteId);
            listing.classList.toggle('expanded', !!shouldExpand);
            const toggleBtn = listing.querySelector('.toggle-details-btn');
            if (toggleBtn) toggleBtn.textContent = shouldExpand ? 'Hide' : 'View';
            if (shouldExpand) initializeMapsInScope(listing);
        });
    }

    function createProviderPreviewListing(user, bids) {
        const previewQuote = getDemoProviderListingQuote();
        const previewBids = bids.filter((bid) => bid.quoteId === previewQuote.id && bid.status === 'active');
        const myBid = getLowestBidForProvider(previewBids, user.id);
        const myBidText = myBid ? ('Your bid €' + Number(myBid.amount).toFixed(2)) : 'Not bid yet';

        return [
            '<article class="provider-listing provider-listing-preview" data-quote-id="' + escapeHtml(previewQuote.id) + '" aria-label="Transport provider form preview">',
            '<div class="listing-row body">',
            '<div class="listing-cell">Preview</div>',
            '<div class="listing-cell">',
            '<div class="listing-title">' + escapeHtml(getQuoteTitle(previewQuote)) + '</div>',
            '<div class="listing-sub">Listing ' + escapeHtml(previewQuote.id) + ' • ' + escapeHtml(previewQuote.itemDescription || 'General move') + '</div>',
            '</div>',
            '<div class="listing-cell">' + escapeHtml(getFromLabel(previewQuote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getToLabel(previewQuote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getPickupLabel(previewQuote)) + '</div>',
            '<div class="listing-cell">' + previewBids.length + '</div>',
            '<div class="listing-cell"><span class="listing-amount">' + escapeHtml(myBidText) + '</span></div>',
            '<div class="listing-cell actions"><button type="button" class="toggle-details-btn">View</button></div>',
            '</div>',
            '<div class="listing-details">',
            '<div class="details-layout">',
            createReferenceStyleDemoForm(previewQuote),
            '</div>',
            createBidPanel(previewQuote, previewBids, myBid, myBidText),
            '</div>',
            '</div>',
            '</article>'
        ].join('');
    }

    function createProviderListingCard(quote, bids, user) {
        const quoteBids = bids.filter((bid) => bid.quoteId === quote.id && bid.status === 'active');
        const myBid = getLowestBidForProvider(quoteBids, user.id);
        const lowest = getLowestBid(quoteBids);

        const quickQuoteText = lowest ? ('€' + Number(lowest.amount).toFixed(2)) : 'No bids';
        const myBidText = myBid ? ('Your bid €' + Number(myBid.amount).toFixed(2)) : 'Not bid yet';

        return [
            '<article class="provider-listing" data-quote-id="' + escapeHtml(quote.id) + '">',
            '<div class="listing-row body">',
            '<div class="listing-cell">' + escapeHtml(timeAgoLabel(quote.submittedAt)) + '</div>',
            '<div class="listing-cell">',
            '<div class="listing-title">' + escapeHtml(getQuoteTitle(quote)) + '</div>',
            '<div class="listing-sub">Listing ' + escapeHtml(quote.id) + ' • ' + escapeHtml(quote.itemDescription || 'General move') + '</div>',
            '</div>',
            '<div class="listing-cell">' + escapeHtml(getFromLabel(quote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getToLabel(quote)) + '</div>',
            '<div class="listing-cell">' + escapeHtml(getPickupLabel(quote)) + '</div>',
            '<div class="listing-cell">' + quoteBids.length + '</div>',
            '<div class="listing-cell"><span class="listing-amount">' + escapeHtml(quickQuoteText) + '</span></div>',
            '<div class="listing-cell actions"><button type="button" class="toggle-details-btn">View</button></div>',
            '</div>',
            '<div class="listing-details">',
            '<div class="details-layout">',
            createReferenceStyleDemoForm(quote),
            '</div>',
            createBidPanel(quote, quoteBids, myBid, myBidText),
            '</div>',
            '</div>',
            '</article>'
        ].join('');
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
                    new mapboxgl.Marker({ color: '#2f8ed8' }).setLngLat(fromCoords).addTo(map);
                    map.setCenter(fromCoords);
                    map.setZoom(10);
                }
                if (toCoords) {
                    new mapboxgl.Marker({ color: '#e62f7a' }).setLngLat(toCoords).addTo(map);
                    map.setCenter(toCoords);
                    map.setZoom(10);
                }
                return;
            }

            new mapboxgl.Marker({ color: '#2f8ed8' })
                .setLngLat(fromCoords)
                .setPopup(new mapboxgl.Popup().setText('Pickup'))
                .addTo(map);

            new mapboxgl.Marker({ color: '#e62f7a' })
                .setLngLat(toCoords)
                .setPopup(new mapboxgl.Popup().setText('Delivery'))
                .addTo(map);

            const routeGeoJson = await fetchDirectionsGeometry(fromCoords, toCoords);
            const drawRouteAndFit = () => {
                if (routeGeoJson) {
                    if (map.getSource('route')) map.removeSource('route');
                    if (map.getLayer('route-line')) map.removeLayer('route-line');

                    map.addSource('route', {
                        type: 'geojson',
                        data: {
                            type: 'Feature',
                            geometry: routeGeoJson
                        }
                    });

                    map.addLayer({
                        id: 'route-line',
                        type: 'line',
                        source: 'route',
                        layout: {
                            'line-cap': 'round',
                            'line-join': 'round'
                        },
                        paint: {
                            'line-color': '#2f8ed8',
                            'line-width': 4,
                            'line-opacity': 0.9
                        }
                    });
                }

                const bounds = new mapboxgl.LngLatBounds();
                bounds.extend(fromCoords);
                bounds.extend(toCoords);
                map.fitBounds(bounds, { padding: 44, maxZoom: 11 });
            };

            if (map.isStyleLoaded()) {
                drawRouteAndFit();
            } else {
                map.on('load', drawRouteAndFit);
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
            ? bids.filter((bid) => bid.providerId === providerId && bid.status === 'active')
            : [];
        return getLowestBid(providerBids);
    }

    function updateProviderKpis(filteredQuotes, allQuotes, myBids) {
        const openEl = document.getElementById('kpi-open-listings');
        const bidEl = document.getElementById('kpi-my-bids');
        const distEl = document.getElementById('kpi-avg-distance');

        const openCount = allQuotes.filter((quote) => quote.status === 'pending').length;
        const distances = filteredQuotes.map((quote) => Number(quote.routeDistanceKm)).filter((value) => Number.isFinite(value) && value > 0);
        const avgDistance = distances.length ? (distances.reduce((sum, value) => sum + value, 0) / distances.length) : 0;

        if (openEl) openEl.textContent = String(openCount);
        if (bidEl) bidEl.textContent = String(myBids.length);
        if (distEl) distEl.textContent = avgDistance ? (avgDistance.toFixed(1) + ' km') : '0 km';
    }

    function renderMyBids(user) {
        const container = document.getElementById('my-bids-list');
        if (!container) return;

        const bids = getAllBids()
            .filter((bid) => bid.providerId === user.id)
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
                '<div>Listing ID: ' + escapeHtml(bid.quoteId) + '</div>',
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
        const myActiveBids = bids.filter((bid) => bid.quoteId === quoteId && bid.providerId === user.id && bid.status === 'active');
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
        renderMyQuotes(user.id);
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
        const target = bids.find((bid) => bid.id === bidId && bid.providerId === user.id);
        if (!target) return;

        if (!confirm('Withdraw this bid?')) return;
        target.status = 'withdrawn';
        target.updatedAt = new Date().toISOString();
        saveAllBids(bids);

        renderProviderListings(user);
        renderMyBids(user);
        renderMyQuotes(user.id);
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
        localStorage.setItem(LISTING_STORAGE_KEY, JSON.stringify(filteredQuotes));

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
        try {
            const raw = JSON.parse(localStorage.getItem(LISTING_STORAGE_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (_error) {
            return [];
        }
    }

    function getAllBids() {
        try {
            const raw = JSON.parse(localStorage.getItem(BID_STORAGE_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (_error) {
            return [];
        }
    }

    function saveAllBids(bids) {
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
        const base = (quote.itemDescription || quote.itemType || 'Transport request').trim();
        return base.charAt(0).toUpperCase() + base.slice(1);
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
        return quote.transportDate
            ? formatDate(quote.transportDate)
            : (quote.preferredDate ? formatDate(quote.preferredDate) : 'Flexible');
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
        return firstText(
            quote.itemDescription,
            quote.itemType,
            quote.serviceType,
            quote.service,
            quote.title,
            quote.summary,
            quote.category
        ) || 'General';
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
        const value = firstText(quote.transportDate, quote.preferredDate, quote.moveDate, quote.date);
        if (!value) return 'Not provided';
        return formatDate(value);
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
        const date = new Date(rawDate);
        if (!Number.isFinite(date.getTime())) return 'Not provided';
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
})();
