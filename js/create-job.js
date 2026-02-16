// --- Show inventory only when both fields are filled ---
document.addEventListener('DOMContentLoaded', function () {
        const inventoryFloorTitle = document.getElementById('inventory-floor-title');
    // Property type icon selection step
    const propertyTypeBtns = document.querySelectorAll('.property-type-icon-btn');
    const propertyTypeHidden = document.getElementById('pickup-property-type');
    const floorIconGrid = document.getElementById('floor-icon-grid');
    const floorHiddenInput = document.getElementById('pickup-floor-select');
    const inventoryCardContainer = document.getElementById('inventory-card-container');
    const elevatorOptionContainer = document.getElementById('elevator-option-container');
    const elevatorIconGridId = 'elevator-icon-grid';
    const elevatorHiddenInputId = 'elevator-available';

    function updateInventoryAndElevatorVisibility() {
                // Update inventory title to match selected floor
                if (inventoryFloorTitle && floorHiddenInput) {
                    const floor = floorHiddenInput.value;
                    if (floor) {
                        inventoryFloorTitle.textContent = `Inventory for ${floor} Floor`;
                    } else {
                        inventoryFloorTitle.textContent = '';
                    }
                }
        // Inventory logic: only show in step 3 (now pickup details step)
        const body = document.body;
        const isStep3 = body.getAttribute('data-form-step') === '3' || body.getAttribute('data-current-step') === '3';
        if (propertyTypeHidden && floorHiddenInput && inventoryCardContainer) {
            const propertyPrompt = propertyTypeHidden.value === '';
            const floorPrompt = floorHiddenInput.value === '';
            if (!propertyPrompt && !floorPrompt && isStep3) {
                inventoryCardContainer.style.display = '';
            } else {
                inventoryCardContainer.style.display = 'none';
            }
        }
        // Elevator logic: show for any property type when floor is 1 or above (not ground)
        if (propertyTypeHidden && elevatorOptionContainer && floorHiddenInput) {
            const floorVal = (floorHiddenInput.value || '').toLowerCase();
            // Show elevator if floor is not ground and not empty
            if (floorVal && floorVal !== 'ground') {
                elevatorOptionContainer.style.display = '';
            } else {
                elevatorOptionContainer.style.display = 'none';
            }
        }
        // Add .house-removals-active to body if House Removals or Apartment is selected in step 3
        if (propertyTypeHidden && body) {
            const val = (propertyTypeHidden.value || '').toLowerCase().trim();
            if (val === 'house' || val === 'apartment') {
                body.classList.add('house-removals-active');
            } else {
                body.classList.remove('house-removals-active');
            }
        }
    }

    // Floor options for each property type
    const propertyFloors = {
        house: ['Attic','Basement', 'Ground', '1st', '2nd', '3rd'],
        apartment: ['Basement', 'Ground', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th'],
        duplex: ['attic','Basement', 'Ground', '1st', '2nd'],
        warehouse: ['Basement', 'Ground', '1st', '2nd', '3rd', '4th'],
        bungalow: ['Basement', 'Ground'],
        'storage-unit': ['Basement', 'Ground', '1st', '2nd', '3rd', '4th', '5th']
    };

    // SVG icon for floor (simple stairs/level icon)
    function getFloorIconSvg(floor) {
        // Use a simple stairs or number icon for each floor
        if (floor === 'Ground') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="16" width="14" height="3" rx="1.5" fill="currentColor"/></svg>';
        }
        // 1st, 2nd, ...
        const num = floor.replace(/[^0-9]/g, '');
        return `<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="18" text-anchor="middle" font-size="14" fill="currentColor" font-family="Arial, sans-serif">${num}</text></svg>`;
    }

    // Render floor icon grid
    function renderFloorIcons(propertyType) {
        if (!floorIconGrid) return;
        floorIconGrid.innerHTML = '';
        const floors = propertyFloors[propertyType] || [];
        floors.forEach(floor => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'floor-icon-btn';
            btn.setAttribute('data-value', floor);
            btn.innerHTML = `${getFloorIconSvg(floor)}<span>${floor}</span>`;
            btn.setAttribute('aria-pressed', 'false');
            btn.addEventListener('click', function () {
                // Deselect all
                floorIconGrid.querySelectorAll('.floor-icon-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('selected');
                btn.setAttribute('aria-pressed', 'true');
                if (floorHiddenInput) {
                    floorHiddenInput.value = floor;
                    // Fire change event for listeners
                    const event = new Event('change', { bubbles: true });
                    floorHiddenInput.dispatchEvent(event);
                }
                // Ensure elevator field updates immediately
                setTimeout(updateInventoryAndElevatorVisibility, 0);
            });
            floorIconGrid.appendChild(btn);
        });
        // Reset hidden input if property type changes
        if (floorHiddenInput) floorHiddenInput.value = '';
        // Render elevator icon grid if needed
        renderElevatorIcons();
    }

    // Render elevator icon grid (Yes/No icons)
    function renderElevatorIcons() {
        if (!elevatorOptionContainer) return;
        let grid = elevatorOptionContainer.querySelector(`#${elevatorIconGridId}`);
        let hidden = elevatorOptionContainer.querySelector(`#${elevatorHiddenInputId}`);
        if (!grid) {
            grid = document.createElement('div');
            grid.className = 'elevator-icon-grid';
            grid.id = elevatorIconGridId;
            elevatorOptionContainer.insertBefore(grid, elevatorOptionContainer.firstChild.nextSibling);
        }
        if (!hidden) {
            hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.id = elevatorHiddenInputId;
            hidden.name = 'elevator-available';
            elevatorOptionContainer.appendChild(hidden);
        }
        grid.innerHTML = '';
        const options = [
            { value: 'yes', label: 'Yes', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#4A90E2"/><path d="M8 12l3 3 5-5" stroke="#fff" stroke-width="2" fill="none"/></svg>' },
            { value: 'no', label: 'No', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#e53e3e"/><path d="M8 8l8 8M16 8l-8 8" stroke="#fff" stroke-width="2" fill="none"/></svg>' }
        ];
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'elevator-icon-btn';
            btn.setAttribute('data-value', opt.value);
            btn.innerHTML = `${opt.icon}<span>${opt.label}</span>`;
            btn.setAttribute('aria-pressed', 'false');
            btn.addEventListener('click', function () {
                grid.querySelectorAll('.elevator-icon-btn').forEach(b => {
                    b.classList.remove('selected');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('selected');
                btn.setAttribute('aria-pressed', 'true');
                hidden.value = opt.value;
                // Fire change event for listeners
                const event = new Event('change', { bubbles: true });
                hidden.dispatchEvent(event);
            });
            grid.appendChild(btn);
        });
        // Reset hidden input
        hidden.value = '';
    }

    // Icon button selection logic
    if (propertyTypeBtns && propertyTypeHidden) {
        propertyTypeBtns.forEach(btn => {
            btn.addEventListener('click', function () {
                propertyTypeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                propertyTypeBtns.forEach(b => b.setAttribute('aria-pressed', 'false'));
                btn.setAttribute('aria-pressed', 'true');
                propertyTypeHidden.value = btn.getAttribute('data-value');
                // Fire change event for hidden input so listeners update
                const event = new Event('change', { bubbles: true });
                propertyTypeHidden.dispatchEvent(event);
                // Render floor icons for this property type
                renderFloorIcons(propertyTypeHidden.value);
                updateInventoryAndElevatorVisibility();
            });
        });
    }

    // Render floor icons if property type is preselected
    if (propertyTypeHidden && propertyTypeHidden.value) {
        renderFloorIcons(propertyTypeHidden.value);
    }

    // When property type changes (e.g. by code), re-render floor icons
    if (propertyTypeHidden) {
        propertyTypeHidden.addEventListener('change', function () {
            renderFloorIcons(propertyTypeHidden.value);
        });
    }

    // No longer need to listen for floorSelect (dropdown) changes here
    updateInventoryAndElevatorVisibility();
});
// --- Multi-Floor Inventory Functionality ---
document.addEventListener('DOMContentLoaded', function () {
    const addFloorBtn = document.querySelector('#house-removal-inventory-section .add-floor-btn');
    const floorModal = document.getElementById('floor-modal');
    const floorSelect = document.getElementById('floor-select-modal');
    const floorModalAdd = document.getElementById('floor-modal-add');
    const floorModalCancel = document.getElementById('floor-modal-cancel');
    const inventorySection = document.getElementById('house-removal-inventory-section');

    // Container for all floor inventories
    let floorsContainer = document.createElement('div');
    floorsContainer.className = 'floors-inventory-container';
    inventorySection.insertBefore(floorsContainer, addFloorBtn);

    // Store which floors have been added
    const addedFloors = new Set();

    // Room types and SVGs for inventory-tabs
    const roomTypes = [
        { name: 'Hallway', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="7" width="14" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="9" y="3" width="6" height="4" rx="1" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Shed', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="8" rx="2" stroke="currentColor" stroke-width="2"/><path d="M4 10l8-6 8 6" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Utility room', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="6" y="8" width="12" height="8" rx="2" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Living', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="10" width="18" height="7" rx="2" stroke="currentColor" stroke-width="2"/><rect x="7" y="7" width="10" height="3" rx="1.5" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Dining', svg: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 10h16M4 14h16M9 18V6m6 12V6" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Kitchen', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M8 4v16" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Office', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="7" y="3" width="10" height="4" rx="1" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Bedrooms', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="10" width="18" height="7" rx="2" stroke="currentColor" stroke-width="2"/><rect x="7" y="7" width="10" height="3" rx="1.5" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Bathrooms', svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><rect x="9" y="8" width="6" height="8" rx="2" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Garden', svg: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="2"/></svg>' },
        { name: 'Boxes & Other', svg: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="7" width="18" height="10" rx="2" stroke="currentColor" stroke-width="2"/><rect x="7" y="3" width="10" height="4" rx="1" stroke="currentColor" stroke-width="2"/></svg>' }
    ];
    // Inventory items (should match the main inventory)
    const inventoryItems = [
        '2 seater sofa',
        '3 seater sofa',
        'Armchair',
        'Coffee table',
        'TV',
        'TV Unit',
        'Side Tables',
        'Book Case',
        'Rug',
        'Artwork',
        'Lamps & Shades'
    ];
    function createInventoryBlock(floorName) {
        // Block wrapper
        const block = document.createElement('div');
        block.className = 'floor-inventory-block';
        block.style.margin = '32px 0';
        block.style.background = '#fff';
        block.style.borderRadius = '8px';
        block.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)';
        block.style.padding = '24px 18px 18px 18px';

        // Title
        const title = document.createElement('h3');
        title.textContent = `Inventory for ${floorName} Floor`;
        title.style.marginBottom = '18px';
        block.appendChild(title);

        // Inventory tabs (room type icons)
        const tabs = document.createElement('div');
        tabs.className = 'inventory-tabs';
        roomTypes.forEach((room, idx) => {
            const btn = document.createElement('button');
            btn.className = 'inventory-tab';
            btn.type = 'button';
            btn.innerHTML = `<span>${room.svg}</span>${room.name}`;
            btn.addEventListener('click', function() {
                tabs.querySelectorAll('.inventory-tab').forEach(tab => tab.classList.remove('active'));
                btn.classList.add('active');
            });
            tabs.appendChild(btn);
        });
        // Set the first tab as active by default
        const firstTab = tabs.querySelector('.inventory-tab');
        if (firstTab) firstTab.classList.add('active');
        block.appendChild(tabs);

        // Item list with robust + and - controls
        const ul = document.createElement('ul');
        ul.className = 'inventory-items-list';
        const itemCounts = {};
        inventoryItems.forEach(itemName => {
            itemCounts[itemName] = 0;
            const li = document.createElement('li');
            li.className = 'inventory-item';
            const label = document.createElement('span');
            label.className = 'inventory-item-label';
            label.textContent = itemName;
            const controls = document.createElement('div');
            controls.className = 'inventory-item-controls';

            // Remove button
            const removeBtn = document.createElement('button');
            removeBtn.className = 'inventory-item-remove';
            removeBtn.title = 'Remove';
            removeBtn.innerHTML = '<span aria-hidden="true">&#8722;</span>';
            removeBtn.style.display = 'none';
            removeBtn.onclick = function(e) {
                e.preventDefault();
                if (itemCounts[itemName] > 0) {
                    itemCounts[itemName]--;
                    updateControls();
                }
            };

            // Count span
            const countSpan = document.createElement('span');
            countSpan.className = 'inventory-item-count';
            countSpan.textContent = '0';
            countSpan.style.display = 'none';

            // Add button
            const addBtn = document.createElement('button');
            addBtn.className = 'inventory-item-add';
            addBtn.title = 'Add';
            addBtn.innerHTML = '<span aria-hidden="true">&#43;</span>';
            addBtn.style.display = 'inline-flex';
            addBtn.onclick = function(e) {
                e.preventDefault();
                itemCounts[itemName]++;
                updateControls();
            };

            function updateControls() {
                if (itemCounts[itemName] > 0) {
                    removeBtn.style.display = 'inline-flex';
                    countSpan.style.display = 'inline-block';
                    countSpan.textContent = itemCounts[itemName];
                    li.classList.add('added');
                } else {
                    removeBtn.style.display = 'none';
                    countSpan.style.display = 'none';
                    countSpan.textContent = '0';
                    li.classList.remove('added');
                }
            }

            controls.appendChild(removeBtn);
            controls.appendChild(countSpan);
            controls.appendChild(addBtn);
            li.appendChild(label);
            li.appendChild(controls);
            ul.appendChild(li);
        });
        block.appendChild(ul);

        // Search input
        const search = document.createElement('input');
        search.className = 'inventory-search';
        search.type = 'text';
        search.placeholder = 'Enter more house items here';
        search.style.marginTop = '18px';
        block.appendChild(search);

        return block;
    }

    // Property type to available floors mapping
    const propertyFloors = {
        house: ['Basement', 'Ground', '1st', '2nd', '3rd'],
        apartment: ['Basement', 'Ground', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th'],
        duplex: ['Basement', 'Ground', '1st', '2nd'],
        warehouse: ['Basement', 'Ground', '1st', '2nd', '3rd', '4th'],
        bungalow: ['Basement', 'Ground'],
        'storage-unit': ['Basement', 'Ground', '1st', '2nd', '3rd', '4th', '5th']
    };

    // Show modal, link floors to property type
    addFloorBtn?.addEventListener('click', function () {
        const propertyTypeSelect = document.getElementById('pickup-property-type');
        const propertyType = propertyTypeSelect ? propertyTypeSelect.value : '';
        let floors = propertyFloors[propertyType] || propertyFloors['apartment'];
        floorSelect.innerHTML = '<option value="">Choose floor</option>' + floors.map(f => `<option value="${f}">${f}</option>`).join('');
        floorModal.style.display = 'flex';
        floorSelect.value = '';
    });

    // Remove floor blocks if property type changes and floor is not valid
    const propertyTypeSelect = document.getElementById('pickup-property-type');
    if (propertyTypeSelect) {
        propertyTypeSelect.addEventListener('change', function () {
            const propertyType = propertyTypeSelect.value;
            let validFloors = propertyFloors[propertyType] || propertyFloors['apartment'];
            // Remove floor blocks for floors not in validFloors
            Array.from(floorsContainer.children).forEach(block => {
                const title = block.querySelector('h3');
                if (title) {
                    const match = title.textContent.match(/Inventory for (.+) Floor/);
                    if (match && !validFloors.includes(match[1])) {
                        block.remove();
                        addedFloors.delete(match[1]);
                    }
                }
            });
        });
    }
    // Cancel modal
    floorModalCancel?.addEventListener('click', function () {
        floorModal.style.display = 'none';
    });
    // Add floor from modal
    floorModalAdd?.addEventListener('click', function () {
        const floor = floorSelect.value;
        if (!floor || addedFloors.has(floor)) return;
        addedFloors.add(floor);
        const block = createInventoryBlock(floor);
        floorsContainer.appendChild(block);
        floorModal.style.display = 'none';
    });
});
// --- Inventory UI Functionality ---
document.addEventListener('DOMContentLoaded', function () {
    // Inventory item data (can be expanded)
    const inventoryItems = [
        '2 seater sofa',
        '3 seater sofa',
        'Armchair',
        'Coffee table',
        'TV',
        'TV Unit',
        'Side Tables',
        'Book Case',
        'Rug',
        'Artwork',
        'Lamps & Shades'
    ];

    const inventoryList = document.querySelector('#house-removal-inventory-section .inventory-items-list');
    const searchInput = document.querySelector('#house-removal-inventory-section .inventory-search');

    // Add item to selected list (for demo, just alert or visually mark)
    // Add/remove logic for counter UI (same as multi-floor)
    function handleAddClick(e) {
        e.preventDefault();
        const item = e.currentTarget.closest('.inventory-item');
        if (item) {
            const countSpan = item.querySelector('.inventory-item-count');
            const removeBtn = item.querySelector('.inventory-item-remove');
            let count = parseInt(countSpan.textContent, 10) || 0;
            count++;
            countSpan.textContent = count;
            countSpan.style.display = 'inline-block';
            removeBtn.style.display = 'inline-flex';
            item.classList.add('added');
        }
    }
    function handleRemoveClick(e) {
        e.preventDefault();
        const item = e.currentTarget.closest('.inventory-item');
        if (item) {
            const countSpan = item.querySelector('.inventory-item-count');
            const removeBtn = item.querySelector('.inventory-item-remove');
            let count = parseInt(countSpan.textContent, 10) || 0;
            if (count > 1) {
                count--;
                countSpan.textContent = count;
            } else {
                count = 0;
                countSpan.textContent = '';
                countSpan.style.display = 'none';
                removeBtn.style.display = 'none';
                item.classList.remove('added');
            }
        }
    }
    function attachAddListeners() {
        inventoryList.querySelectorAll('.inventory-item-add').forEach(btn => {
            btn.removeEventListener('click', handleAddClick);
            btn.addEventListener('click', handleAddClick);
        });
        inventoryList.querySelectorAll('.inventory-item-remove').forEach(btn => {
            btn.removeEventListener('click', handleRemoveClick);
            btn.addEventListener('click', handleRemoveClick);
        });
    }
    // Filter inventory items by search
    function filterInventoryList() {
        const query = searchInput.value.trim().toLowerCase();
        inventoryList.innerHTML = '';
        inventoryItems.forEach(itemName => {
            if (!query || itemName.toLowerCase().includes(query)) {
                const li = document.createElement('li');
                li.className = 'inventory-item';
                li.innerHTML = `
                    <span class="inventory-item-label">${itemName}</span>
                    <div class="inventory-item-controls">
                        <button class="inventory-item-remove" title="Remove" style="display:none;"><span aria-hidden="true">−</span></button>
                        <span class="inventory-item-count" style="display:none;"></span>
                        <button class="inventory-item-add" title="Add"><span aria-hidden="true">+</span></button>
                    </div>
                `;
                inventoryList.appendChild(li);
            }
        });
        attachAddListeners();
    }
    if (searchInput && inventoryList) {
        searchInput.addEventListener('input', filterInventoryList);
        filterInventoryList(); // Initial render
    }
    // Initial add button listeners for static HTML
    attachAddListeners();
});
/**
 * MAPBOX SETUP INSTRUCTIONS:
 * 
 * 1. Get your Mapbox access token from: https://account.mapbox.com/tokens/
 * 2. Replace the token in initRoutePlanner() function (line ~475) with your actual token
 * 3. The map will show a route between pickup and delivery locations
 * 4. Supports geocoding, directions, and interactive route visualization
 * 
 * APIs Used:
 * - Mapbox Geocoding API: Converts addresses to coordinates
 * - Mapbox Directions API: Calculates route distance/duration
 * - Mapbox GL JS: Interactive map visualization
 */
let isMultiStopMode = false;
let multiStopMarkers = [];
let multiStopRouteTimer;
let multiStopIdCounter = 0;
const multiStopHouseState = {};
const multiStopOfficeState = {};

function getMultiStopLocationIconMarkup(value) {
    switch (value) {
        case 'house':
            return '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" fill="currentColor"/>';
        case 'apartment':
            return '<path d="M6 3h12v18H6z" fill="currentColor"/><path d="M9 6h2v2H9zm4 0h2v2h-2zM9 10h2v2H9zm4 0h2v2h-2zM9 14h2v2H9zm4 0h2v2h-2z" fill="#fff"/>';
        case 'duplex':
            return '<path d="M3 10l9-6 9 6v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="currentColor"/><path d="M12 10v10" stroke="#fff" stroke-width="2"/>';
        case 'warehouse':
            return '<path d="M3 9l9-5 9 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" fill="currentColor"/><path d="M7 20v-6h10v6" stroke="#fff" stroke-width="2"/>';
        case 'bungalow':
            return '<path d="M4 12l8-6 8 6v8H4z" fill="currentColor"/><path d="M9 20v-5h6v5" stroke="#fff" stroke-width="2"/>';
        case 'storage-unit':
            return '<rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor"/><path d="M4 10h16" stroke="#fff" stroke-width="2"/>';
        default:
            return '';
    }
}

function getMultiStopNavIconMarkup(type, value) {
    if (type === 'elevator') {
        if (value === 'yes') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18H7z" fill="currentColor"/><path d="M12 6l2 2h-4z" fill="#fff"/><path d="M12 18l-2-2h4z" fill="#fff"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h4v2H4zm0-4h6v2H4zm0-4h8v2H4zm0-4h10v2H4z" fill="currentColor"/></svg>';
    }
    if (type === 'floor') {
        return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h6v-4h4v4h6v2H4z" fill="currentColor"/><path d="M6 13h6V9h6v2h-4v4H6z" fill="#fff"/></svg>';
    }
    return '';
}

function buildMultiStopSectionFromTemplate(templateId, stopId, categories) {
    const template = document.getElementById(templateId);
    if (!template || !stopId) return '';

    const clone = template.cloneNode(true);
    const idMap = new Map();

    const updateId = (el) => {
        if (!el || !el.id) return;
        const oldId = el.id;
        const newId = `${stopId}-${oldId}`;
        idMap.set(oldId, newId);
        el.id = newId;
    };

    updateId(clone);
    clone.querySelectorAll('[id]').forEach(updateId);

    const remapAttr = (el, attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const mapped = idMap.get(value);
        if (mapped) el.setAttribute(attr, mapped);
    };

    clone.querySelectorAll('*').forEach((el) => {
        remapAttr(el, 'for');
        remapAttr(el, 'data-option-nav-for');
        remapAttr(el, 'data-required-for');
        remapAttr(el, 'aria-controls');
        remapAttr(el, 'aria-labelledby');
    });

    return `
        <div class="multi-stop-category-section" data-stop-category="Piano Transport" style="display: none;">
            <div class="card-section">
                ${clone.outerHTML}
            </div>
        </div>
    `;
}

function buildMultiStopAdditionalInfoSection(stopId) {
    const template = document.getElementById('generic-additional-info-section');
    if (!template || !stopId) return '';

    const clone = template.cloneNode(true);
    const idMap = new Map();

    const updateId = (el) => {
        if (!el || !el.id) return;
        const oldId = el.id;
        const newId = `${stopId}-${oldId}`;
        idMap.set(oldId, newId);
        el.id = newId;
    };

    updateId(clone);
    clone.querySelectorAll('[id]').forEach(updateId);

    const remapAttr = (el, attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const mapped = idMap.get(value);
        if (mapped) el.setAttribute(attr, mapped);
    };

    clone.querySelectorAll('*').forEach((el) => {
        remapAttr(el, 'for');
        remapAttr(el, 'data-option-nav-for');
        remapAttr(el, 'data-required-for');
        remapAttr(el, 'aria-controls');
        remapAttr(el, 'aria-labelledby');
    });

    clone.classList.add('multi-stop-additional');
    clone.setAttribute('data-stop-section', 'additional');
    clone.setAttribute('data-stop-id', stopId);

    const toggle = clone.querySelector('.collapsible-toggle');
    if (toggle) {
        toggle.classList.add('multi-stop-additional-toggle');
        toggle.setAttribute('data-stop-id', stopId);
    }

    const twoPorters = clone.querySelector('input[type="checkbox"][name="two-porters"], input[type="checkbox"][id$="generic-two-porters"]');
    if (twoPorters) {
        twoPorters.classList.add('multi-stop-two-porters');
        twoPorters.setAttribute('data-stop-id', stopId);
    }

    const specialInstructions = clone.querySelector('textarea[id$="generic-special-instructions"]');
    if (specialInstructions) {
        specialInstructions.classList.add('multi-stop-special-instructions');
        specialInstructions.setAttribute('data-stop-id', stopId);
    }

    const photoInputs = Array.from(clone.querySelectorAll('.photo-input'));
    photoInputs.forEach((input) => {
        input.classList.add('multi-stop-photo-input');
        input.setAttribute('data-stop-id', stopId);
    });

    const dimensionsList = clone.querySelector('[id$="generic-dimensions-list"]');
    if (dimensionsList) {
        dimensionsList.classList.add('multi-stop-dimensions-list');
        dimensionsList.setAttribute('data-stop-id', stopId);
        dimensionsList.querySelectorAll('.dimension-item').forEach((item) => {
            item.classList.add('multi-stop-dimension-item');
        });
    }

    const addButton = clone.querySelector('[id$="add-generic-dimension-btn"]');
    if (addButton) {
        addButton.classList.add('multi-stop-add-dimension');
        addButton.setAttribute('data-stop-id', stopId);
    }

    return clone.outerHTML;
}

function buildMultiStopFloorsSection(stopId) {
    if (!stopId) return '';
    const typeId = `${stopId}-location-type`;
    const floorId = `${stopId}-floor`;
    const elevatorId = `${stopId}-elevator`;

    const typeButtons = [
        { value: 'house', label: 'House' },
        { value: 'apartment', label: 'Apartment' },
        { value: 'duplex', label: 'Duplex' },
        { value: 'warehouse', label: 'Warehouse' },
        { value: 'bungalow', label: 'Bungalow' },
        { value: 'storage-unit', label: 'Storage unit' }
    ]
        .map((opt) => `
            <button type="button" class="location-nav-btn" data-value="${opt.value}" role="radio" aria-checked="false">
                <svg viewBox="0 0 24 24" aria-hidden="true">${getMultiStopLocationIconMarkup(opt.value)}</svg>
                <span>${opt.label}</span>
            </button>
        `)
        .join('');

    return `
        <div class="multi-stop-floors-section" data-stop-section="floors" data-stop-id="${stopId}">
            <div class="card-section">
                <div class="location-group">
                    <label class="form-label" for="${typeId}">Property type</label>
                    <div class="location-nav-wrapper">
                        <div class="location-nav location-type-nav" data-nav-for="${typeId}" data-nav-type="location-type" role="radiogroup" aria-label="Property type">
                            ${typeButtons}
                        </div>
                        <select id="${typeId}" class="form-input location-nav-select multi-stop-location-type">
                            <option value="">Choose location type</option>
                            <option value="house">House</option>
                            <option value="apartment">Apartment</option>
                            <option value="duplex">Duplex</option>
                            <option value="warehouse">Warehouse</option>
                            <option value="bungalow">Bungalow</option>
                            <option value="storage-unit">Storage unit</option>
                        </select>
                    </div>
                </div>
                <div class="location-details">
                    <div class="location-detail-row floors-layout">
                        <div class="form-group floor-group">
                            <label class="form-label" for="${floorId}">Floor</label>
                            <div class="location-nav-wrapper">
                                <div class="location-nav floor-nav" data-nav-for="${floorId}" data-nav-type="floor" role="radiogroup" aria-label="Floor"></div>
                                <select id="${floorId}" class="form-input location-nav-select multi-stop-floor">
                                    <option value="">Choose floor</option>
                                    <option value="basement">Basement</option>
                                    <option value="ground">Ground</option>
                                    <option value="1">1st</option>
                                    <option value="2">2nd</option>
                                    <option value="3">3rd</option>
                                    <option value="4">4th</option>
                                    <option value="5">5th</option>
                                    <option value="6">6th</option>
                                    <option value="7">7th</option>
                                    <option value="8">8th</option>
                                    <option value="9">9th</option>
                                    <option value="10">10th</option>
                                    <option value="11">11th</option>
                                    <option value="12">12th</option>
                                    <option value="13">13th</option>
                                    <option value="14">14th</option>
                                    <option value="15">15th</option>
                                    <option value="16">16th</option>
                                    <option value="17">17th</option>
                                    <option value="18">18th</option>
                                    <option value="19">19th</option>
                                    <option value="20">20th</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group elevator-group">
                            <label class="form-label" for="${elevatorId}">Elevator available</label>
                            <div class="location-nav-wrapper">
                                <div class="location-nav elevator-nav" data-nav-for="${elevatorId}" data-nav-type="elevator" role="radiogroup" aria-label="Elevator available"></div>
                                <select id="${elevatorId}" class="form-input location-nav-select multi-stop-elevator">
                                    <option value="">Select</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildMultiStopOfficeFloorsSection(stopId) {
    if (!stopId) return '';
    const typeId = `${stopId}-office-location-type`;
    const floorId = `${stopId}-office-floor`;
    const elevatorId = `${stopId}-office-elevator`;

    const typeButtons = [
        { value: 'traditional', label: 'Traditional' },
        { value: 'cubicle', label: 'Cubicle' },
        { value: 'open-space', label: 'Open space' },
        { value: 'team-cluster', label: 'Team cluster' }
    ]
        .map((opt) => `
            <button type="button" class="location-nav-btn" data-value="${opt.value}" role="radio" aria-checked="false">
                <svg viewBox="0 0 24 24" aria-hidden="true">${getMultiStopLocationIconMarkup(opt.value)}</svg>
                <span>${opt.label}</span>
            </button>
        `)
        .join('');

    return `
        <div class="multi-stop-office-floors-section" data-stop-section="office-floors" data-stop-id="${stopId}" style="display: none;">
            <div class="card-section">
                <div class="location-group">
                    <label class="form-label" for="${typeId}">Office type</label>
                    <div class="location-nav-wrapper">
                        <div class="location-nav location-type-nav" data-nav-for="${typeId}" data-nav-type="location-type" role="radiogroup" aria-label="Office type">
                            ${typeButtons}
                        </div>
                        <select id="${typeId}" class="form-input location-nav-select multi-stop-location-type">
                            <option value="">Choose office type</option>
                            <option value="traditional">Traditional</option>
                            <option value="cubicle">Cubicle</option>
                            <option value="open-space">Open space</option>
                            <option value="team-cluster">Team cluster</option>
                        </select>
                    </div>
                </div>
                <div class="location-details">
                    <div class="location-detail-row floors-layout">
                        <div class="form-group floor-group">
                            <label class="form-label" for="${floorId}">Floor</label>
                            <div class="location-nav-wrapper">
                                <div class="location-nav floor-nav" data-nav-for="${floorId}" data-nav-type="floor" role="radiogroup" aria-label="Office floor"></div>
                                <select id="${floorId}" class="form-input location-nav-select multi-stop-floor">
                                    <option value="">Choose floor</option>
                                    <option value="basement">Basement</option>
                                    <option value="ground">Ground</option>
                                    <option value="1">1st</option>
                                    <option value="2">2nd</option>
                                    <option value="3">3rd</option>
                                    <option value="4">4th</option>
                                    <option value="5">5th</option>
                                    <option value="6">6th</option>
                                    <option value="7">7th</option>
                                    <option value="8">8th</option>
                                    <option value="9">9th</option>
                                    <option value="10">10th</option>
                                    <option value="11">11th</option>
                                    <option value="12">12th</option>
                                    <option value="13">13th</option>
                                    <option value="14">14th</option>
                                    <option value="15">15th</option>
                                    <option value="16">16th</option>
                                    <option value="17">17th</option>
                                    <option value="18">18th</option>
                                    <option value="19">19th</option>
                                    <option value="20">20th</option>
                                </select>
                            </div>
                        </div>
                        <div class="form-group elevator-group">
                            <label class="form-label" for="${elevatorId}">Elevator available</label>
                            <div class="location-nav-wrapper">
                                <div class="location-nav elevator-nav" data-nav-for="${elevatorId}" data-nav-type="elevator" role="radiogroup" aria-label="Elevator available"></div>
                                <select id="${elevatorId}" class="form-input location-nav-select multi-stop-elevator">
                                    <option value="">Select</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function buildMultiStopOfficeMoveDateSection(stopId) {
    if (!stopId) return '';
    const dateId = `${stopId}-office-move-date`;
    return `
        <div class="multi-stop-office-date-section" data-stop-section="office-date" data-stop-id="${stopId}" style="display: none;">
            <div class="card-section">
                <label class="form-label" for="${dateId}">Estimated move date</label>
                <input type="date" id="${dateId}" class="form-input" placeholder="Select a Date Option">
            </div>
        </div>
    `;
}

function buildMultiStopHouseInventorySection(stopId) {
    if (!stopId) return '';
    return getMultiStopHouseInventoryMarkup(stopId);
}

function buildMultiStopOfficeInventorySection(stopId) {
    if (!stopId) return '';
    return getMultiStopOfficeInventoryMarkup(stopId);
}

function applyMultiStopRequiredRules(card) {
    if (!card) return;
    const fields = Array.from(card.querySelectorAll('input, select, textarea'));

    fields.forEach((field) => {
        if (field.closest('.multi-stop-additional')) return;
        if (field.hasAttribute('data-optional')) return;

        const type = field.type;
        if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button') {
            return;
        }

        if (type === 'hidden') {
            const isDropdownHidden = field.closest('.custom-dropdown-wrapper');
            if (!isDropdownHidden) {
                return;
            }
        }

        field.setAttribute('data-required', 'true');
        field.setAttribute('aria-required', 'true');
    });
}

function setMultiStopFieldRequired(field, isRequired) {
    if (!field) return;
    if (isRequired) {
        field.setAttribute('data-required', 'true');
        field.setAttribute('aria-required', 'true');
        field.removeAttribute('data-optional');
        return;
    }

    field.setAttribute('data-optional', 'true');
    field.removeAttribute('data-required');
    field.removeAttribute('aria-required');
    field.classList.remove('input-error');
    field.removeAttribute('aria-invalid');
    if (field.id) {
        const inline = document.querySelector(`.field-error-message[data-error-for="${field.id}"]`);
        if (inline) inline.remove();
    }
}

function initMultiStopOptionNavs(card) {
    if (!card) return;

    const parseValues = (raw) => {
        if (!raw) return [];
        return String(raw)
            .split(',')
            .map((val) => val.trim())
            .filter(Boolean);
    };

    const setState = (nav, values, isMulti) => {
        if (!nav) return;
        const valueSet = new Set(values);
        const buttons = Array.from(nav.querySelectorAll('.option-nav-btn'));
        buttons.forEach((btn) => {
            const isActive = valueSet.has(btn.getAttribute('data-value'));
            btn.classList.toggle('is-active', isActive);
            if (isMulti) {
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            } else {
                btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
            }
        });
    };

    const navs = Array.from(card.querySelectorAll('.option-nav'));
    navs.forEach((nav) => {
            if (nav.dataset.optionNavReady === 'true') return;
            const targetId = nav.getAttribute('data-option-nav-for');
            const wrapper = nav.closest('.custom-dropdown-wrapper');
            let hidden = targetId ? card.querySelector(`[id="${targetId}"]`) : null;
            if (!hidden) {
                hidden = wrapper?.querySelector('input[type="hidden"]') || null;
            }
            if (!hidden) return;
            if (!targetId && hidden.id) {
                nav.setAttribute('data-option-nav-for', hidden.id);
            }

        const isMulti = nav.getAttribute('data-option-nav-multi') === 'true';
        const initialValues = parseValues(hidden.value);
        setState(nav, initialValues, isMulti);

        hidden.addEventListener('change', () => {
            const values = parseValues(hidden.value);
            setState(nav, values, isMulti);
        });

        nav.dataset.optionNavReady = 'true';
    });
}

function initMultiStopLocationNavs(card) {
    if (!card) return;

    const setNavState = (nav, value) => {
        if (!nav) return;
        const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
        buttons.forEach((btn) => {
            const isActive = btn.getAttribute('data-value') === value;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
    };

    const buildNavFromSelect = (selectEl, nav, type) => {
        if (!selectEl || !nav) return;
        nav.innerHTML = '';
        const options = Array.from(selectEl.options).filter((opt) => opt.value);
        options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'location-nav-btn';
            btn.setAttribute('data-value', opt.value);
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', 'false');
            const iconMarkup = getMultiStopNavIconMarkup(type, opt.value);
            btn.innerHTML = `${iconMarkup}<span class="floor-label">${opt.textContent.trim()}</span>`;
            nav.appendChild(btn);
        });
        setNavState(nav, selectEl.value);
    };

    const navs = Array.from(card.querySelectorAll('.location-nav[data-nav-for]'));
        navs.forEach((nav) => {
            if (nav.dataset.multiStopNavReady === 'true') return;
            const selectId = nav.getAttribute('data-nav-for');
            const selectEl = selectId ? document.getElementById(selectId) : null;
            if (!selectEl) return;

        const navType = nav.getAttribute('data-nav-type');
        if (navType === 'floor' || navType === 'elevator') {
            buildNavFromSelect(selectEl, nav, navType);
        } else {
            setNavState(nav, selectEl.value);
        }

        nav.addEventListener('click', (event) => {
            const btn = event.target.closest('.location-nav-btn');
            if (!btn) return;
            const value = btn.getAttribute('data-value') || '';
            if (!value) return;
            selectEl.value = value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            setNavState(nav, value);
        });

        selectEl.addEventListener('change', () => {
            setNavState(nav, selectEl.value);
        });

        nav.dataset.multiStopNavReady = 'true';
    });
}

function initMultiStopDropdowns(card) {
    if (!card || card.dataset.multiStopDropdownsReady === 'true') return;

    const dropdowns = Array.from(card.querySelectorAll('.custom-dropdown[data-ms-dropdown]'));
    if (dropdowns.length === 0) return;

    const closeAllMenus = (except) => {
        dropdowns.forEach((dropdown) => {
            const menu = dropdown.querySelector('[data-ms-menu]');
            const toggle = dropdown.querySelector('[data-ms-toggle]');
            if (menu && menu !== except) menu.classList.remove('active');
            if (toggle && menu !== except) toggle.classList.remove('active');
        });
    };

    dropdowns.forEach((dropdown) => {
        const toggle = dropdown.querySelector('[data-ms-toggle]');
        const menu = dropdown.querySelector('[data-ms-menu]');
        const label = dropdown.querySelector('[data-ms-label]');
        const hiddenId = dropdown.getAttribute('data-ms-hidden');
        const hidden = hiddenId ? card.querySelector(`#${hiddenId}`) : null;
        const isMulti = dropdown.getAttribute('data-ms-multi') === 'true';

        if (!toggle || !menu) return;

        toggle.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const isOpen = menu.classList.contains('active');
            closeAllMenus();
            if (!isOpen) {
                menu.classList.add('active');
                toggle.classList.add('active');
            }
        });

        if (isMulti) {
            const checkboxes = Array.from(menu.querySelectorAll('input[type="checkbox"]'));
            checkboxes.forEach((checkbox) => {
                checkbox.addEventListener('change', (event) => {
                    event.stopPropagation();
                    const selected = checkboxes
                        .filter((cb) => cb.checked)
                        .map((cb) => cb.closest('label')?.querySelector('.option-text')?.textContent?.trim())
                        .filter(Boolean);

                    if (label) {
                        if (selected.length > 0) {
                            label.textContent = selected.join(', ');
                            label.style.color = '#374151';
                        } else {
                            label.textContent = label.dataset.placeholder || 'Select options';
                            label.style.color = '#9ca3af';
                        }
                    }
                    if (hidden) {
                        hidden.value = selected.join(', ');
                        hidden.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            });

            menu.addEventListener('click', (event) => event.stopPropagation());
        } else {
            const items = Array.from(menu.querySelectorAll('.dropdown-item'));
            items.forEach((item) => {
                item.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    const value = item.getAttribute('data-value');
                    const text = item.textContent.trim();
                    if (hidden) {
                        hidden.value = value || '';
                        hidden.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    if (label) {
                        label.textContent = text;
                        label.style.color = '#374151';
                    }
                    menu.classList.remove('active');
                    toggle.classList.remove('active');
                });
            });
        }
    });

    card.addEventListener('click', (event) => {
        if (!event.target.closest('.custom-dropdown')) {
            closeAllMenus();
        }
    });

    card.dataset.multiStopDropdownsReady = 'true';
}

const MULTI_STOP_ROOM_ITEMS = {
    living: [
        '2 seater sofa',
        '3 seater sofa',
        'Armchair',
        'Coffee table',
        'TV',
        'TV Unit',
        'Side Tables',
        'Book Case',
        'Rug',
        'Artwork',
        'Lamps & Shades'
    ],
    dining: [
        'Dining Table - 6 person',
        'Dining Table - 8/10 person',
        'Dining Chairs',
        'Cabinet Dresser',
        'Display Unit',
        'Side Board',
        'Rug'
    ],
    kitchen: [
        'Kitchen Table',
        'Chairs',
        'Fridge',
        'Fridge Freezer',
        'Tumble Dryer',
        'Washing Machine',
        'Oven',
        'Microwave',
        'Shelving Unit',
        'Bin',
        'Vacuum Cleaner'
    ],
    office: [
        'Desk',
        'Chair',
        'Pedestal',
        'Filing cabinet',
        'Desktop computer',
        'Photocopier',
        'Printer',
        'Board room table',
        'Boxes - large',
        'Boxes - medium',
        'Crates'
    ],
    bedrooms: [
        'Kingsize Bed',
        'Double Bed',
        'Single Bed',
        'Bedside Tables',
        'Chest of Drawers',
        'Wardrobe',
        'Dressing Table',
        'Mirror',
        'Lamps & Shades',
        'Suitcase',
        'Wardrobe Boxes'
    ],
    bathrooms: [
        'Bathroom Cabinet',
        'Storage units',
        'Mirror',
        'Bath',
        'Sink',
        'Rug'
    ],
    hallway: [
        'Console table',
        'Coat rack',
        'Shoe rack',
        'Mirror',
        'Runner rug',
        'Umbrella stand',
        'Storage bench'
    ],
    garden: [
        'Garden table',
        'Chairs',
        'Bench',
        'Parasol',
        'Lawn mower',
        'Barbecue',
        'Bicycle'
    ],
    utility: [
        'Washing Machine',
        'Tumble Dryer',
        'Ironing Board',
        'Vacuum Cleaner',
        'Shelving Unit',
        'Laundry Basket'
    ],
    shed: [
        'Tool Chest',
        'Workbench',
        'Lawn mower',
        'Garden tools',
        'Bike',
        'Storage boxes'
    ],
    boxes: [
        'Extra Large Boxes',
        'Large Boxes',
        'Medium Boxes',
        'Small Boxes',
        'Artwork',
        'Bicycle',
        'Suitcase',
        'Wardrobe Boxes',
        'Treadmill',
        'Fish Tank'
    ]
};

const MULTI_STOP_OFFICE_ITEMS = [
    { name: 'Desk', category: 'workstations' },
    { name: 'Chair', category: 'seating' },
    { name: 'Pedestal', category: 'storage' },
    { name: 'Filing cabinet', category: 'storage' },
    { name: 'Desktop computer', category: 'electronics' },
    { name: 'Photocopier', category: 'electronics' },
    { name: 'Printer', category: 'electronics' },
    { name: 'Board room table', category: 'meeting' },
    { name: 'Boxes - large', category: 'packing' },
    { name: 'Boxes - medium', category: 'packing' },
    { name: 'Crates', category: 'packing' },
    { name: 'Add more items', category: 'other' }
];

// Quote Request Form
document.addEventListener('DOMContentLoaded', function() {
    // Collapsible Additional Information Section
    const toggleBtn = document.getElementById('additional-toggle');
    const section = document.querySelector('.collapsible-section');
    
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            section.classList.toggle('expanded');
        });
    }

    // Dimension Item Management
    const addDimensionBtn = document.getElementById('add-dimension-btn');
    const dimensionsList = document.getElementById('dimensions-list');

    if (addDimensionBtn) {
        addDimensionBtn.addEventListener('click', (e) => {
            e.preventDefault();
            addDimensionItem();
        });
    }

    // Remove dimension item
    if (dimensionsList) {
        dimensionsList.addEventListener('click', (e) => {
            const deleteBtn = e.target.closest('.btn-delete-dimension');
            if (deleteBtn) {
                const item = deleteBtn.closest('.dimension-item');
                if (item) item.remove();
            }
        });
    }

    // Photo upload handlers
    const photoAreas = document.querySelectorAll('.photo-upload-area');
    photoAreas.forEach(area => {
        const input = area.querySelector('.photo-input');
        
        area.addEventListener('click', () => input.click());
        
        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.style.borderColor = '#4A90E2';
            area.style.background = '#f0f6ff';
        });
        
        area.addEventListener('dragleave', () => {
            area.style.borderColor = '#ddd';
            area.style.background = '#f9f9f9';
        });
        
        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.style.borderColor = '#ddd';
            area.style.background = '#f9f9f9';
            if (input) {
                input.files = e.dataTransfer.files;
            }
        });
    });

    // Service selection
    const cjHidden = document.getElementById('item-description-hidden');
    const serviceIconButtons = document.querySelectorAll('.service-icon-btn');
    const urlParams = new URLSearchParams(window.location.search);
    isMultiStopMode = urlParams.get('mode') === 'multi' || urlParams.get('multistop') === '1';
    const isSingleForm = document.body.classList.contains('single-form');

    // Auto-select service if provided in URL
    const serviceFromUrl = urlParams.get('service');
    if (serviceFromUrl && serviceIconButtons.length) {
        serviceIconButtons.forEach(btn => {
            if (btn.dataset.value && btn.dataset.value.toLowerCase().replace(/\s|&/g, '') === serviceFromUrl.toLowerCase().replace(/\s|&/g, '')) {
                // Set as selected
                btn.setAttribute('aria-pressed', 'true');
                btn.classList.add('active');
                if (cjHidden) {
                    cjHidden.value = btn.dataset.value;
                }
            } else {
                btn.setAttribute('aria-pressed', 'false');
                btn.classList.remove('active');
            }
        });
        // Update summary if present
        const summaryService = document.getElementById('summary-service');
        if (summaryService && cjHidden && cjHidden.value) {
            summaryService.textContent = cjHidden.value;
        }
    }

    // --- Dynamic Property Type & Floor Dropdown Logic ---
    // Only for main (non-multistop) form step 3
    const propertyTypeSelect = document.getElementById('pickup-property-type');
    const floorSelect = document.getElementById('pickup-floor-select');

    // Map property type to allowed floors
    const propertyTypeFloors = {
        'house': [
            { value: 'basement', label: 'Basement' },
            { value: 'ground', label: 'Ground' },
            { value: '1', label: '1st' },
            { value: '2', label: '2nd' },
            { value: '3', label: '3rd' }
        ],
        'apartment': [
            { value: 'basement', label: 'Basement' },
            { value: 'ground', label: 'Ground' },
            { value: '1', label: '1st' },
            { value: '2', label: '2nd' },
            { value: '3', label: '3rd' },
            { value: '4', label: '4th' },
            { value: '5', label: '5th' },
            { value: '6', label: '6th' },
            { value: '7', label: '7th' },
            { value: '8', label: '8th' },
            { value: '9', label: '9th' },
            { value: '10', label: '10th' },
            { value: '11', label: '11th' },
            { value: '12', label: '12th' },
            { value: '13', label: '13th' },
            { value: '14', label: '14th' },
            { value: '15', label: '15th' },
            { value: '16', label: '16th' },
            { value: '17', label: '17th' },
            { value: '18', label: '18th' },
            { value: '19', label: '19th' },
            { value: '20', label: '20th' }
        ],
        'duplex': [
            { value: 'ground', label: 'Ground' },
            { value: '1', label: '1st' },
            { value: '2', label: '2nd' }
        ],
        'warehouse': [
            { value: 'ground', label: 'Ground' },
            { value: '1', label: '1st' },
            { value: '2', label: '2nd' },
            { value: '3', label: '3rd' },
            { value: '4', label: '4th' },
            { value: '5', label: '5th' }
        ],
        'bungalow': [
            { value: 'ground', label: 'Ground' },
            { value: 'basement', label: 'Basement' }
        ],
        'storage-unit': [
            { value: 'ground', label: 'Ground' },
            { value: '1', label: '1st' },
            { value: '2', label: '2nd' },
            { value: '3', label: '3rd' },
            { value: '4', label: '4th' },
            { value: '5', label: '5th' },
            { value: 'basement', label: 'Basement' }
        ]
    };

    // Legacy floor select logic removed (now handled by icon grid)
    // --- End Dynamic Property Type & Floor Dropdown Logic ---

    let stepFlowReady = false;
    let pendingServiceValue = '';


    // Stepper: 1. Destinations, 2. Pickup details, 3. Delivery details, 4. Additional info
    const initStepVisibility = () => {
        const stepTargets = Array.from(document.querySelectorAll('[data-form-step], [data-form-steps]'));
        if (isSingleForm) {
            stepTargets.forEach((el) => el.classList.remove('step-hidden'));
            return;
        }
        const parseStepList = (el) => {
            if (!el) return [];
            const steps = el.getAttribute('data-form-steps') || el.getAttribute('data-form-step') || '';
            return steps
                .split(',')
                .map((value) => parseInt(value.trim(), 10))
                .filter((value) => Number.isFinite(value));
        };

        stepTargets.forEach((el) => {
            const steps = parseStepList(el);
            // Show step 1 by default (Destinations)
            const isStepOne = steps.includes(1);
            if (isStepOne) {
                el.classList.remove('step-hidden');
            } else {
                el.classList.add('step-hidden');
            }
        });
    };

    initStepVisibility();

    const setActiveServiceIcon = (value) => {
        serviceIconButtons.forEach((btn) => {
            const isActive = btn.getAttribute('data-value') === value;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
    };

    window.setActiveServiceIcon = setActiveServiceIcon;

    const getServiceLabel = (value) => {
        const match = Array.from(serviceIconButtons).find((btn) => btn.getAttribute('data-value') === value);
        return match ? match.textContent.trim() : value;
    };

    const applyServiceSelection = (value, labelText) => {
        const hasValue = !!value;
        if (hasValue && cjHidden) cjHidden.value = value;
        if (hasValue && cjHidden) {
            clearFieldError(cjHidden);
            clearInlineError(cjHidden);
        }
        if (hasValue) {
            setActiveServiceIcon(value);
            hideOtherSection();
            applyRequiredRules();
            updateLocationSections();
            updateLocationDetails();
            if (isSingleForm) {
                initFloorBlockListeners();
                resetFloorBlocks(value);
            }
        }

        if (stepFlowReady) {
            // Step flow already wired; only update sections on service change.
        } else {
            stepFlowReady = true;
            if (isSingleForm) {
                return;
            }

        const stepper = document.getElementById('form-stepper');
        const stepLinks = stepper ? Array.from(stepper.querySelectorAll('.stepper-link')) : [];
        const stepItems = stepper ? Array.from(stepper.querySelectorAll('.stepper-item')) : [];
        const stepTargets = Array.from(document.querySelectorAll('[data-form-step], [data-form-steps]'));
        const stepBackBtn = document.getElementById('step-back-btn');
        const stepNextBtn = document.getElementById('step-next-btn');
        const getPricesBtn = document.getElementById('get-prices-btn');
        const totalSteps = 4;
        let currentStep = 1;

        const parseStepList = (el) => {
            if (!el) return [];
            const steps = el.getAttribute('data-form-steps') || el.getAttribute('data-form-step') || '';
            return steps
                .split(',')
                .map((value) => parseInt(value.trim(), 10))
                .filter((value) => Number.isFinite(value));
        };

        const isStepMatch = (el, step) => {
            const steps = parseStepList(el);
            return steps.includes(step);
        };

        const setStepVisibility = (step) => {
            stepTargets.forEach((el) => {
                if (isStepMatch(el, step)) {
                    el.classList.remove('step-hidden');
                } else {
                    el.classList.add('step-hidden');
                }
            });
        };

        const updateStepSlices = (step) => {
            const slices = Array.from(document.querySelectorAll('[data-step-slice]'));
            const parseSliceSteps = (el) => {
                if (!el) return [];
                const steps = el.getAttribute('data-step-slice') || '';
                return steps
                    .split(',')
                    .map((value) => parseInt(value.trim(), 10))
                    .filter((value) => Number.isFinite(value));
            };
            slices.forEach((el) => {
                const steps = parseSliceSteps(el);
                el.classList.toggle('step-hidden', !steps.includes(step));
            });
        };

        const updateStepperState = (step) => {
            stepItems.forEach((item) => {
                const itemStep = parseInt(item.getAttribute('data-step'), 10);
                item.classList.toggle('is-active', itemStep === step);
                item.classList.toggle('is-complete', itemStep < step);
            });
        };

        const updateStepButtons = () => {
            if (stepBackBtn) stepBackBtn.disabled = currentStep === 1;
            if (stepNextBtn) {
                if (currentStep >= totalSteps) {
                    stepNextBtn.style.display = 'none';
                } else {
                    stepNextBtn.style.display = 'inline-flex';
                    
                    // Get next step label from stepper
                    const nextStep = currentStep + 1;
                    const nextStepperItem = document.querySelector(`.stepper-item[data-step="${nextStep}"]`);
                    const nextLabel = nextStepperItem?.querySelector('.stepper-label')?.textContent?.trim() || '';
                    
                    stepNextBtn.textContent = 'Next';
                }
            }
        };
        
        const updateSubmitButton = () => {
            if (!getPricesBtn) return;
            
            if (currentStep === totalSteps) {
                // Validate all required fields in step 4
                applyRequiredRules();
                const firstInvalid = validateRequiredFieldsInStep(currentStep);
                
                if (!firstInvalid) {
                    // All fields valid, show the button
                    getPricesBtn.style.display = 'inline-flex';
                } else {
                    // Has invalid fields, hide the button
                    getPricesBtn.style.display = 'none';
                }
            } else {
                // Not on final step, hide the button
                getPricesBtn.style.display = 'none';
            }
        };

        const getSelectText = (selectId) => {
            const select = document.getElementById(selectId);
            if (!select) return '';
            const option = select.options[select.selectedIndex];
            if (!option || !option.value) return '';
            return option.textContent.trim();
        };

        const getSelectTextFromEl = (selectEl) => {
            if (!selectEl) return '';
            const option = selectEl.options[selectEl.selectedIndex];
            if (!option || !option.value) return '';
            return option.textContent.trim();
        };

        const getInputValue = (inputId) => {
            const input = document.getElementById(inputId);
            return input ? input.value.trim() : '';
        };

        const setSummaryValue = (targetId, value) => {
            const target = document.getElementById(targetId);
            if (!target) return;
            target.textContent = value && value.trim().length > 0 ? value : '—';
        };

        const formatAddress = (addressId, cityId, postcodeId) => {
            const parts = [getInputValue(addressId), getInputValue(cityId), getInputValue(postcodeId)].filter(Boolean);
            return parts.join(', ');
        };

        const getVehicleSummary = (makeModelId, yearId) => {
            const makeModel = getInputValue(makeModelId);
            const year = getInputValue(yearId);
            if (!makeModel && !year) return '';
            return year ? `${makeModel} (${year})`.trim() : makeModel;
        };

        const getOptionNavLabel = (hiddenId) => {
            const hidden = document.getElementById(hiddenId);
            if (!hidden) return '';
            const value = hidden.value.trim();
            if (!value) return '';
            const nav = document.querySelector(`.option-nav[data-option-nav-for="${hiddenId}"]`);
            const btn = nav ? nav.querySelector(`.option-nav-btn[data-value="${value}"]`) : null;
            return btn ? btn.textContent.trim() : value;
        };

        const getOptionNavLabels = (hiddenId) => {
            const hidden = document.getElementById(hiddenId);
            if (!hidden) return '';
            const values = parseOptionNavValues(hidden.value);
            if (values.length === 0) return '';
            const nav = document.querySelector(`.option-nav[data-option-nav-for="${hiddenId}"]`);
            const labels = values.map((value) => {
                const btn = nav ? nav.querySelector(`.option-nav-btn[data-value="${value}"]`) : null;
                return btn ? btn.textContent.trim() : value;
            });
            return labels.filter(Boolean).join(', ');
        };

        const getDropdownLabel = (hiddenId, labelId) => {
            const hidden = document.getElementById(hiddenId);
            if (!hidden || !hidden.value.trim()) return '';
            const label = document.getElementById(labelId);
            return label ? label.textContent.trim() : hidden.value.trim();
        };

        const updateFormSummary = () => {
            if (!quoteForm) return;
            if (isMultiStopMode) {
                const stopCards = Array.from(document.querySelectorAll('.multi-stop-card'));
                const stopCount = stopCards.length;
                const categories = Array.from(document.querySelectorAll('.multi-stop-category'))
                    .map((field) => field.value.trim())
                    .filter(Boolean);
                const uniqueCategories = Array.from(new Set(categories));
                const addressInputs = Array.from(document.querySelectorAll('.multi-stop-address'));
                const firstAddress = addressInputs[0]?.value.trim() || '';
                const lastAddress = addressInputs[addressInputs.length - 1]?.value.trim() || '';
                const typeSelects = Array.from(document.querySelectorAll('.multi-stop-location-type'));
                const firstType = getSelectTextFromEl(typeSelects[0]);
                const lastType = getSelectTextFromEl(typeSelects[typeSelects.length - 1]);
                const floorSelects = Array.from(document.querySelectorAll('.multi-stop-floor'));
                const firstFloor = getSelectTextFromEl(floorSelects[0]);
                const lastFloor = getSelectTextFromEl(floorSelects[floorSelects.length - 1]);
                const moveDate = Array.from(document.querySelectorAll('.multi-stop-office-date-section input[type="date"]'))
                    .map((input) => input.value)
                    .find((value) => value) || '';
                const notes = Array.from(document.querySelectorAll('.multi-stop-special-instructions'))
                    .map((field) => field.value.trim())
                    .find((value) => value) || '';

                let floorSummary = '';
                if (firstFloor || lastFloor) {
                    const pickupText = firstFloor ? `Stop 1: ${firstFloor}` : 'Stop 1: —';
                    const deliveryText = lastFloor ? `Final: ${lastFloor}` : 'Final: —';
                    floorSummary = `${pickupText} | ${deliveryText}`;
                }

                setSummaryValue('summary-service', stopCount ? `Multi-stop (${stopCount} stops)` : 'Multi-stop');
                setSummaryValue('summary-pickup-type', firstType || '—');
                setSummaryValue('summary-delivery-type', lastType || '—');
                setSummaryValue('summary-floors', floorSummary || '—');
                setSummaryValue('summary-pickup-address', firstAddress || '—');
                setSummaryValue('summary-delivery-address', lastAddress || '—');
                setSummaryValue('summary-items', uniqueCategories.length ? uniqueCategories.join(', ') : '—');
                setSummaryValue('summary-date', moveDate || '—');
                setSummaryValue('summary-notes', notes || '—');
                
                // Hide/show floors row based on categories - hide if all categories don't need floors
                const floorsRow = document.getElementById('summary-floors-row');
                if (floorsRow) {
                    const allNoFloor = categories.length > 0 && categories.every(cat => vehicleNoFloorCategories.has(cat));
                    if (allNoFloor) {
                        floorsRow.style.display = 'none';
                    } else {
                        floorsRow.style.display = '';
                    }
                }
                return;
            }

            const serviceValue = cjHidden ? cjHidden.value.trim() : '';
            const serviceLabel = serviceValue ? getServiceLabel(serviceValue) : '';
            let pickupType = getSelectText('pickup-location-type') || getSelectText('office-pickup-location-type');
            const deliveryType = getSelectText('delivery-location-type') || getSelectText('office-delivery-location-type');
            let pickupFloor = getSelectText('pickup-floor') || getSelectText('office-pickup-floor');
            const deliveryFloor = getSelectText('delivery-floor') || getSelectText('office-delivery-floor');
            const pickupAddress = formatAddress('pickup-address', 'pickup-city', 'pickup-postcode');
            const deliveryAddress = formatAddress('delivery-address', 'delivery-city', 'delivery-postcode');
            const moveDate = getInputValue('office-move-date');
            const specialInstructions = getInputValue('generic-special-instructions');
            const portersNeeded = getInputValue('additional-porters');
            const packingRequired = document.getElementById('additional-packing')?.checked;

            let itemsSummary = '';

            if (serviceValue === 'House Removals') {
                const rooms = getInputValue('house-rooms-hidden');
                itemsSummary = rooms
                    ? `Rooms: ${rooms.split(',').map((room) => room.trim()).filter(Boolean).join(', ')}`
                    : '';
            } else if (serviceValue === 'Office Removals') {
                itemsSummary = getInputValue('office-removal-description') || getInputValue('office-inventory-category');
            } else if (serviceValue === 'Car Transport') {
                const base = getVehicleSummary('car-make-model', 'car-year-hidden');
                const extras = [];
                const valueLabel = getOptionNavLabel('car-value-hidden') || getDropdownLabel('car-value-hidden', 'car-value-label');
                const methodLabel = getOptionNavLabels('car-transport-method-hidden');
                const conditionLabel = getOptionNavLabel('car-condition-hidden') || getDropdownLabel('car-condition-hidden', 'car-condition-label');
                const weightLabel = getOptionNavLabel('car-weight-hidden') || getDropdownLabel('car-weight-hidden', 'car-weight-label');
                const lengthLabel = getOptionNavLabel('car-length-hidden') || getDropdownLabel('car-length-hidden', 'car-length-label');
                const operationalLabel = getOptionNavLabel('car-operational-hidden');
                if (valueLabel) extras.push(`Value: ${valueLabel}`);
                if (conditionLabel) extras.push(`Condition: ${conditionLabel}`);
                if (weightLabel) extras.push(`Weight: ${weightLabel}`);
                if (lengthLabel) extras.push(`Length: ${lengthLabel}`);
                if (methodLabel) extras.push(`Method: ${methodLabel}`);
                if (operationalLabel) extras.push(`Operational: ${operationalLabel}`);
                itemsSummary = [base, ...extras].filter(Boolean).join(' | ');
            } else if (serviceValue === 'Motorbike Transport') {
                const base = getVehicleSummary('motorbike-make-model', 'motorbike-year-hidden');
                const extras = [];
                const valueLabel = getOptionNavLabel('motorbike-value-hidden') || getDropdownLabel('motorbike-value-hidden', 'motorbike-value-label');
                const conditionLabel = getOptionNavLabel('motorbike-condition-hidden') || getDropdownLabel('motorbike-condition-hidden', 'motorbike-condition-label');
                const weightLabel = getOptionNavLabel('motorbike-weight-hidden') || getDropdownLabel('motorbike-weight-hidden', 'motorbike-weight-label');
                const operationalLabel = getOptionNavLabel('motorbike-operational-hidden');
                if (valueLabel) extras.push(`Value: ${valueLabel}`);
                if (conditionLabel) extras.push(`Condition: ${conditionLabel}`);
                if (weightLabel) extras.push(`Weight: ${weightLabel}`);
                if (operationalLabel) extras.push(`Operational: ${operationalLabel}`);
                itemsSummary = [base, ...extras].filter(Boolean).join(' | ');
            } else if (serviceValue === 'Trailers & Campervans Transport') {
                const base = getVehicleSummary('trailer-campervan-make-model', 'trailer-campervan-year-hidden');
                const extras = [];
                const typeLabel = getOptionNavLabel('trailer-campervan-type-hidden') || getDropdownLabel('trailer-campervan-type-hidden', 'trailer-campervan-type-label');
                const valueLabel = getOptionNavLabel('trailer-campervan-value-hidden') || getDropdownLabel('trailer-campervan-value-hidden', 'trailer-campervan-value-label');
                const deliveryLabel = getOptionNavLabel('trailer-campervan-delivery-hidden') || getDropdownLabel('trailer-campervan-delivery-hidden', 'trailer-campervan-delivery-label');
                if (typeLabel) extras.push(`Type: ${typeLabel}`);
                if (valueLabel) extras.push(`Value: ${valueLabel}`);
                if (deliveryLabel) extras.push(`Delivery: ${deliveryLabel}`);
                itemsSummary = [base, ...extras].filter(Boolean).join(' | ');
            } else if (serviceValue === 'Piano Transport') {
                const pianoType = getOptionNavLabel('piano-type-hidden');
                itemsSummary = pianoType ? `Type: ${pianoType}` : '';
            } else {
                itemsSummary = getInputValue('other-job-description') || getInputValue('manpower-job-description') || getInputValue('office-removal-description');
            }

            const notesParts = [];
            if (portersNeeded) notesParts.push(`Porters: ${portersNeeded}`);
            if (packingRequired) notesParts.push('Packing service requested');
            if (specialInstructions) notesParts.push(specialInstructions);

            const floorBlockListEl = document.getElementById('floor-block-list');
            const firstBlock = floorBlockListEl ? floorBlockListEl.querySelector('.floor-block') : null;
            if (firstBlock) {
                if (!pickupType) {
                    pickupType = getSelectTextFromEl(firstBlock.querySelector('.multi-stop-location-type'));
                }
                if (!pickupFloor) {
                    pickupFloor = getSelectTextFromEl(firstBlock.querySelector('.multi-stop-floor'));
                }
            }

            let floorSummary = '';
            if (pickupFloor || deliveryFloor) {
                const pickupText = pickupFloor ? `Pickup: ${pickupFloor}` : 'Pickup: —';
                const deliveryText = deliveryFloor ? `Delivery: ${deliveryFloor}` : 'Delivery: —';
                floorSummary = `${pickupText} | ${deliveryText}`;
            }

            setSummaryValue('summary-service', serviceLabel || '—');
            setSummaryValue('summary-pickup-type', pickupType || '—');
            setSummaryValue('summary-delivery-type', deliveryType || '—');
            setSummaryValue('summary-floors', floorSummary || '—');
            setSummaryValue('summary-pickup-address', pickupAddress || '—');
            setSummaryValue('summary-delivery-address', deliveryAddress || '—');
            setSummaryValue('summary-items', itemsSummary || '—');
            setSummaryValue('summary-date', moveDate || '—');
            setSummaryValue('summary-notes', notesParts.length ? notesParts.join(' - ') : '—');
            
            // Hide/show floors row based on service category
            const floorsRow = document.getElementById('summary-floors-row');
            if (floorsRow) {
                if (vehicleNoFloorCategories.has(serviceValue)) {
                    floorsRow.style.display = 'none';
                } else {
                    floorsRow.style.display = '';
                }
            }
        };

        const validateRequiredFieldsInStep = (step) => {
            const stepFields = [];
            stepTargets.forEach((el) => {
                if (isStepMatch(el, step)) {
                    stepFields.push(...Array.from(el.querySelectorAll('[data-required="true"]')));
                }
            });

            let firstInvalid = null;

            stepFields.forEach((field) => {
                if (!isElementVisible(field)) {
                    clearFieldError(field);
                    clearInlineError(field);
                    return;
                }

                let hasValue = true;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    hasValue = field.checked;
                } else {
                    hasValue = !!field.value && field.value.trim().length > 0;
                }

                if (!hasValue) {
                    markFieldError(field);
                    setInlineError(field, getInlineRequiredMessage(field, quoteForm));
                    if (field.id === 'item-description-hidden') {
                        const serviceGrid = document.getElementById('service-icon-grid');
                        markFieldError(serviceGrid);
                    }
                    if (field.type === 'hidden') {
                        const wrapperToggle = field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle');
                        markFieldError(wrapperToggle);
                    }
                    if (!firstInvalid) firstInvalid = field;
                } else {
                    clearFieldError(field);
                    clearInlineError(field);
                    if (field.id === 'item-description-hidden') {
                        const serviceGrid = document.getElementById('service-icon-grid');
                        clearFieldError(serviceGrid);
                    }
                    if (field.type === 'hidden') {
                        const wrapperToggle = field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle');
                        clearFieldError(wrapperToggle);
                    }
                }
            });

            return firstInvalid;
        };

        const updateMultiStopStepVisibility = (step) => {
            if (!isMultiStopMode) return;
            const cards = Array.from(document.querySelectorAll('.multi-stop-card'));
            cards.forEach((card) => {
                const serviceSection = card.querySelector('.multi-stop-service-section');
                const floorsSections = Array.from(card.querySelectorAll('.multi-stop-floors-section, .multi-stop-office-floors-section'));
                const itemSections = Array.from(card.querySelectorAll('.multi-stop-category-section, .multi-stop-house-inventory, .multi-stop-office-inventory, .multi-stop-additional'));

                if (serviceSection) serviceSection.classList.toggle('step-hidden', step !== 1);
                floorsSections.forEach((section) => section.classList.toggle('step-hidden', step !== 2));
                itemSections.forEach((section) => section.classList.toggle('step-hidden', step !== 3));
            });

            const addRow = document.getElementById('multi-stop-add-row');
            if (addRow) {
                addRow.style.display = step === 1 ? 'flex' : 'none';
            }
        };

        window.updateMultiStopStepVisibility = updateMultiStopStepVisibility;
        window.updateFormSummary = updateFormSummary;

        const setFormStep = (step) => {
            if (step < 1 || step > totalSteps) return;
            currentStep = step;
            document.body.dataset.formStep = String(step);
            setStepVisibility(step);
            updateStepSlices(step);
            updateStepperState(step);
            updateStepButtons();
            updateSubmitButton();
            updateMultiStopStepVisibility(step);
            updateFormSummary();
            if (step === 3) {
                updateHouseInventoryVisibility();
            }
            if (step === 2 && typeof map !== 'undefined' && map && typeof map.resize === 'function') {
                setTimeout(() => map.resize(), 200);
            }
        };

        if (stepBackBtn) {
            stepBackBtn.addEventListener('click', () => {
                setFormStep(currentStep - 1);
            });
        }

        if (stepNextBtn) {
            stepNextBtn.addEventListener('click', () => {
                applyRequiredRules();
                const firstInvalid = validateRequiredFieldsInStep(currentStep);
                if (firstInvalid) {
                    scrollToField(firstInvalid);
                    return;
                }
                setFormStep(currentStep + 1);
            });
        }

        stepLinks.forEach((link) => {
            link.addEventListener('click', () => {
                const targetStep = parseInt(link.getAttribute('data-step'), 10);
                if (!Number.isFinite(targetStep)) return;
                if (targetStep > currentStep) {
                    applyRequiredRules();
                    const firstInvalid = validateRequiredFieldsInStep(currentStep);
                    if (firstInvalid) {
                        scrollToField(firstInvalid);
                        return;
                    }
                }
                setFormStep(targetStep);
            });
        });

        setFormStep(1);
        
        // Add listeners to update submit button visibility when fields change
        if (quoteForm) {
            quoteForm.addEventListener('input', () => {
                if (currentStep === totalSteps) {
                    updateSubmitButton();
                }
            });
            quoteForm.addEventListener('change', () => {
                if (currentStep === totalSteps) {
                    updateSubmitButton();
                }
            });
        }

        }

        const stepper = document.getElementById('form-stepper');
        const stepLinks = stepper ? Array.from(stepper.querySelectorAll('.stepper-link')) : [];
        const stepItems = stepper ? Array.from(stepper.querySelectorAll('.stepper-item')) : [];
        const stepTargets = Array.from(document.querySelectorAll('[data-form-step], [data-form-steps]'));
        const stepBackBtn = document.getElementById('step-back-btn');
        const stepNextBtn = document.getElementById('step-next-btn');
        const getPricesBtn = document.getElementById('get-prices-btn');
        const totalSteps = 5;
        let currentStep = 1;

        const parseStepList = (el) => {
            if (!el) return [];
            const steps = el.getAttribute('data-form-steps') || el.getAttribute('data-form-step') || '';
            return steps
                .split(',')
                .map((value) => parseInt(value.trim(), 10))
                .filter((value) => Number.isFinite(value));
        };

        const isStepMatch = (el, step) => {
            const steps = parseStepList(el);
            return steps.includes(step);
        };

        const setStepVisibility = (step) => {
            stepTargets.forEach((el) => {
                if (isStepMatch(el, step)) {
                    el.classList.remove('step-hidden');
                } else {
                    el.classList.add('step-hidden');
                }
            });
        };

        const updateStepperState = (step) => {
            stepItems.forEach((item) => {
                const itemStep = parseInt(item.getAttribute('data-step'), 10);
                item.classList.toggle('is-active', itemStep === step);
                item.classList.toggle('is-complete', itemStep < step);
            });
        };

        const updateStepButtons = () => {
            if (stepBackBtn) stepBackBtn.disabled = currentStep === 1;
            if (stepNextBtn) {
                // Always show the next button except on the last step
                if (currentStep >= totalSteps) {
                    stepNextBtn.style.display = 'none';
                } else {
                    stepNextBtn.style.display = 'inline-flex';
                    // Get next step label from stepper
                    const nextStep = currentStep + 1;
                    const nextStepperItem = document.querySelector(`.stepper-item[data-step="${nextStep}"]`);
                    const nextLabel = nextStepperItem?.querySelector('.stepper-label')?.textContent?.trim() || '';
                    stepNextBtn.textContent = 'Next';
                }
            }
            // Always show the step navigation container
            const stepActions = document.getElementById('form-step-actions');
            if (stepActions) {
                stepActions.style.display = 'flex';
            }
        };
        
        const updateSubmitButton = () => {
            if (!getPricesBtn) return;
            
            if (currentStep === totalSteps) {
                // Validate all required fields in step 4
                applyRequiredRules();
                const firstInvalid = validateRequiredFieldsInStep(currentStep);
                
                if (!firstInvalid) {
                    // All fields valid, show the button
                    getPricesBtn.style.display = 'inline-flex';
                } else {
                    // Has invalid fields, hide the button
                    getPricesBtn.style.display = 'none';
                }
            } else {
                // Not on final step, hide the button
                getPricesBtn.style.display = 'none';
            }
        };

        const getSelectText = (selectId) => {
            const select = document.getElementById(selectId);
            if (!select) return '';
            const option = select.options[select.selectedIndex];
            if (!option || !option.value) return '';
            return option.textContent.trim();
        };

        const getSelectTextFromEl = (selectEl) => {
            if (!selectEl) return '';
            const option = selectEl.options[selectEl.selectedIndex];
            if (!option || !option.value) return '';
            return option.textContent.trim();
        };

        const getInputValue = (inputId) => {
            const input = document.getElementById(inputId);
            return input ? input.value.trim() : '';
        };

        const setSummaryValue = (targetId, value) => {
            const target = document.getElementById(targetId);
            if (!target) return;
            target.textContent = value && value.trim().length > 0 ? value : '—';
        };

        const formatAddress = (addressId, cityId, postcodeId) => {
            const parts = [getInputValue(addressId), getInputValue(cityId), getInputValue(postcodeId)].filter(Boolean);
            return parts.join(', ');
        };

        const getVehicleSummary = (makeModelId, yearId) => {
            const makeModel = getInputValue(makeModelId);
            const year = getInputValue(yearId);
            if (!makeModel && !year) return '';
            return year ? `${makeModel} (${year})`.trim() : makeModel;
        };

        const getOptionNavLabel = (hiddenId) => {
            const hidden = document.getElementById(hiddenId);
            if (!hidden) return '';
            const value = hidden.value.trim();
            if (!value) return '';
            const nav = document.querySelector(`.option-nav[data-option-nav-for="${hiddenId}"]`);
            const btn = nav ? nav.querySelector(`.option-nav-btn[data-value="${value}"]`) : null;
            return btn ? btn.textContent.trim() : value;
        };

        const getOptionNavLabels = (hiddenId) => {
            const hidden = document.getElementById(hiddenId);
            if (!hidden) return '';
            const values = parseOptionNavValues(hidden.value);
            if (values.length === 0) return '';
            const nav = document.querySelector(`.option-nav[data-option-nav-for="${hiddenId}"]`);
            const labels = values.map((value) => {
                const btn = nav ? nav.querySelector(`.option-nav-btn[data-value="${value}"]`) : null;
                return btn ? btn.textContent.trim() : value;
            });
            return labels.filter(Boolean).join(', ');
        };

        const getDropdownLabel = (hiddenId, labelId) => {
            const hidden = document.getElementById(hiddenId);
            if (!hidden || !hidden.value.trim()) return '';
            const label = document.getElementById(labelId);
            return label ? label.textContent.trim() : hidden.value.trim();
        };

        const updateFormSummary = () => {
            if (!quoteForm) return;
            if (isMultiStopMode) {
                const stopCards = Array.from(document.querySelectorAll('.multi-stop-card'));
                const stopCount = stopCards.length;
                const categories = Array.from(document.querySelectorAll('.multi-stop-category'))
                    .map((field) => field.value.trim())
                    .filter(Boolean);
                const uniqueCategories = Array.from(new Set(categories));
                const addressInputs = Array.from(document.querySelectorAll('.multi-stop-address'));
                const firstAddress = addressInputs[0]?.value.trim() || '';
                const lastAddress = addressInputs[addressInputs.length - 1]?.value.trim() || '';
                const typeSelects = Array.from(document.querySelectorAll('.multi-stop-location-type'));
                const firstType = getSelectTextFromEl(typeSelects[0]);
                const lastType = getSelectTextFromEl(typeSelects[typeSelects.length - 1]);
                const floorSelects = Array.from(document.querySelectorAll('.multi-stop-floor'));
                const firstFloor = getSelectTextFromEl(floorSelects[0]);
                const lastFloor = getSelectTextFromEl(floorSelects[floorSelects.length - 1]);
                const moveDate = Array.from(document.querySelectorAll('.multi-stop-office-date-section input[type="date"]'))
                    .map((input) => input.value)
                    .find((value) => value) || '';
                const notes = Array.from(document.querySelectorAll('.multi-stop-special-instructions'))
                    .map((field) => field.value.trim())
                    .find((value) => value) || '';

                let floorSummary = '';
                if (firstFloor || lastFloor) {
                    const pickupText = firstFloor ? `Stop 1: ${firstFloor}` : 'Stop 1: —';
                    const deliveryText = lastFloor ? `Final: ${lastFloor}` : 'Final: —';
                    floorSummary = `${pickupText} | ${deliveryText}`;
                }

                setSummaryValue('summary-service', stopCount ? `Multi-stop (${stopCount} stops)` : 'Multi-stop');
                setSummaryValue('summary-pickup-type', firstType || '—');
                setSummaryValue('summary-delivery-type', lastType || '—');
                setSummaryValue('summary-floors', floorSummary || '—');
                setSummaryValue('summary-pickup-address', firstAddress || '—');
                setSummaryValue('summary-delivery-address', lastAddress || '—');
                setSummaryValue('summary-items', uniqueCategories.length ? uniqueCategories.join(', ') : '—');
                setSummaryValue('summary-date', moveDate || '—');
                setSummaryValue('summary-notes', notes || '—');
                
                // Hide/show floors row based on categories - hide if all categories don't need floors
                const floorsRow = document.getElementById('summary-floors-row');
                if (floorsRow) {
                    const allNoFloor = categories.length > 0 && categories.every(cat => vehicleNoFloorCategories.has(cat));
                    if (allNoFloor) {
                        floorsRow.style.display = 'none';
                    } else {
                        floorsRow.style.display = '';
                    }
                }
                return;
            }

            const serviceValue = cjHidden ? cjHidden.value.trim() : '';
            const serviceLabel = serviceValue ? getServiceLabel(serviceValue) : '';
            const pickupType = getSelectText('pickup-location-type') || getSelectText('office-pickup-location-type');
            const deliveryType = getSelectText('delivery-location-type') || getSelectText('office-delivery-location-type');
            const pickupFloor = getSelectText('pickup-floor') || getSelectText('office-pickup-floor');
            const deliveryFloor = getSelectText('delivery-floor') || getSelectText('office-delivery-floor');
            const pickupAddress = formatAddress('pickup-address', 'pickup-city', 'pickup-postcode');
            const deliveryAddress = formatAddress('delivery-address', 'delivery-city', 'delivery-postcode');
            const moveDate = getInputValue('office-move-date');
            const specialInstructions = getInputValue('generic-special-instructions');
            const twoPorters = document.getElementById('generic-two-porters')?.checked;

            let itemsSummary = '';

            if (serviceValue === 'House Removals') {
                const rooms = getInputValue('house-rooms-hidden');
                itemsSummary = rooms
                    ? `Rooms: ${rooms.split(',').map((room) => room.trim()).filter(Boolean).join(', ')}`
                    : '';
            } else if (serviceValue === 'Office Removals') {
                itemsSummary = getInputValue('office-removal-description') || getInputValue('office-inventory-category');
            } else if (serviceValue === 'Car Transport') {
                const base = getVehicleSummary('car-make-model', 'car-year-hidden');
                const extras = [];
                const valueLabel = getOptionNavLabel('car-value-hidden') || getDropdownLabel('car-value-hidden', 'car-value-label');
                const methodLabel = getOptionNavLabels('car-transport-method-hidden');
                const conditionLabel = getOptionNavLabel('car-condition-hidden') || getDropdownLabel('car-condition-hidden', 'car-condition-label');
                const weightLabel = getOptionNavLabel('car-weight-hidden') || getDropdownLabel('car-weight-hidden', 'car-weight-label');
                const lengthLabel = getOptionNavLabel('car-length-hidden') || getDropdownLabel('car-length-hidden', 'car-length-label');
                const operationalLabel = getOptionNavLabel('car-operational-hidden');
                if (valueLabel) extras.push(`Value: ${valueLabel}`);
                if (conditionLabel) extras.push(`Condition: ${conditionLabel}`);
                if (weightLabel) extras.push(`Weight: ${weightLabel}`);
                if (lengthLabel) extras.push(`Length: ${lengthLabel}`);
                if (methodLabel) extras.push(`Method: ${methodLabel}`);
                if (operationalLabel) extras.push(`Operational: ${operationalLabel}`);
                itemsSummary = [base, ...extras].filter(Boolean).join(' | ');
            } else if (serviceValue === 'Motorbike Transport') {
                const base = getVehicleSummary('motorbike-make-model', 'motorbike-year-hidden');
                const extras = [];
                const valueLabel = getOptionNavLabel('motorbike-value-hidden') || getDropdownLabel('motorbike-value-hidden', 'motorbike-value-label');
                const conditionLabel = getOptionNavLabel('motorbike-condition-hidden') || getDropdownLabel('motorbike-condition-hidden', 'motorbike-condition-label');
                const weightLabel = getOptionNavLabel('motorbike-weight-hidden') || getDropdownLabel('motorbike-weight-hidden', 'motorbike-weight-label');
                const operationalLabel = getOptionNavLabel('motorbike-operational-hidden');
                if (valueLabel) extras.push(`Value: ${valueLabel}`);
                if (conditionLabel) extras.push(`Condition: ${conditionLabel}`);
                if (weightLabel) extras.push(`Weight: ${weightLabel}`);
                if (operationalLabel) extras.push(`Operational: ${operationalLabel}`);
                itemsSummary = [base, ...extras].filter(Boolean).join(' | ');
            } else if (serviceValue === 'Trailers & Campervans Transport') {
                const base = getVehicleSummary('trailer-campervan-make-model', 'trailer-campervan-year-hidden');
                const extras = [];
                const typeLabel = getOptionNavLabel('trailer-campervan-type-hidden') || getDropdownLabel('trailer-campervan-type-hidden', 'trailer-campervan-type-label');
                const valueLabel = getOptionNavLabel('trailer-campervan-value-hidden') || getDropdownLabel('trailer-campervan-value-hidden', 'trailer-campervan-value-label');
                const deliveryLabel = getOptionNavLabel('trailer-campervan-delivery-hidden') || getDropdownLabel('trailer-campervan-delivery-hidden', 'trailer-campervan-delivery-label');
                if (typeLabel) extras.push(`Type: ${typeLabel}`);
                if (valueLabel) extras.push(`Value: ${valueLabel}`);
                if (deliveryLabel) extras.push(`Delivery: ${deliveryLabel}`);
                itemsSummary = [base, ...extras].filter(Boolean).join(' | ');
            } else if (serviceValue === 'Piano Transport') {
                const pianoType = getOptionNavLabel('piano-type-hidden');
                itemsSummary = pianoType ? `Type: ${pianoType}` : '';
            } else {
                itemsSummary = getInputValue('other-job-description') || getInputValue('manpower-job-description') || getInputValue('office-removal-description');
            }

            const notesParts = [];
            if (twoPorters) notesParts.push('Two porters requested');
            if (specialInstructions) notesParts.push(specialInstructions);

            let floorSummary = '';
            if (pickupFloor || deliveryFloor) {
                const pickupText = pickupFloor ? `Pickup: ${pickupFloor}` : 'Pickup: —';
                const deliveryText = deliveryFloor ? `Delivery: ${deliveryFloor}` : 'Delivery: —';
                floorSummary = `${pickupText} | ${deliveryText}`;
            }

            setSummaryValue('summary-service', serviceLabel || '—');
            setSummaryValue('summary-pickup-type', pickupType || '—');
            setSummaryValue('summary-delivery-type', deliveryType || '—');
            setSummaryValue('summary-floors', floorSummary || '—');
            setSummaryValue('summary-pickup-address', pickupAddress || '—');
            setSummaryValue('summary-delivery-address', deliveryAddress || '—');
            setSummaryValue('summary-items', itemsSummary || '—');
            setSummaryValue('summary-date', moveDate || '—');
            setSummaryValue('summary-notes', notesParts.length ? notesParts.join(' - ') : '—');
            
            // Hide/show floors row based on service category
            const floorsRow = document.getElementById('summary-floors-row');
            if (floorsRow) {
                if (vehicleNoFloorCategories.has(serviceValue)) {
                    floorsRow.style.display = 'none';
                } else {
                    floorsRow.style.display = '';
                }
            }
        };

        const validateRequiredFieldsInStep = (step) => {
            const stepFields = [];
            stepTargets.forEach((el) => {
                if (isStepMatch(el, step)) {
                    stepFields.push(...Array.from(el.querySelectorAll('[data-required="true"]')));
                }
            });

            let firstInvalid = null;

            stepFields.forEach((field) => {
                if (!isElementVisible(field)) {
                    clearFieldError(field);
                    clearInlineError(field);
                    return;
                }

                let hasValue = true;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    hasValue = field.checked;
                } else {
                    hasValue = !!field.value && field.value.trim().length > 0;
                }

                if (!hasValue) {
                    markFieldError(field);
                    setInlineError(field, getInlineRequiredMessage(field, quoteForm));
                    if (field.id === 'item-description-hidden') {
                        const serviceGrid = document.getElementById('service-icon-grid');
                        markFieldError(serviceGrid);
                    }
                    if (field.type === 'hidden') {
                        const wrapperToggle = field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle');
                        markFieldError(wrapperToggle);
                    }
                    if (!firstInvalid) firstInvalid = field;
                } else {
                    clearFieldError(field);
                    clearInlineError(field);
                    if (field.id === 'item-description-hidden') {
                        const serviceGrid = document.getElementById('service-icon-grid');
                        clearFieldError(serviceGrid);
                    }
                    if (field.type === 'hidden') {
                        const wrapperToggle = field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle');
                        clearFieldError(wrapperToggle);
                    }
                }
            });

            return firstInvalid;
        };

        const updateMultiStopStepVisibility = (step) => {
            if (!isMultiStopMode) return;
            const cards = Array.from(document.querySelectorAll('.multi-stop-card'));
            cards.forEach((card) => {
                const serviceSection = card.querySelector('.multi-stop-service-section');
                const floorsSections = Array.from(card.querySelectorAll('.multi-stop-floors-section, .multi-stop-office-floors-section'));
                const itemSections = Array.from(card.querySelectorAll('.multi-stop-category-section, .multi-stop-house-inventory, .multi-stop-office-inventory, .multi-stop-additional'));

                if (serviceSection) serviceSection.classList.toggle('step-hidden', step !== 1);
                floorsSections.forEach((section) => section.classList.toggle('step-hidden', step !== 2));
                itemSections.forEach((section) => section.classList.toggle('step-hidden', step !== 2));
            });

            const addRow = document.getElementById('multi-stop-add-row');
            if (addRow) {
                addRow.style.display = step === 1 ? 'flex' : 'none';
            }
        };

        window.updateMultiStopStepVisibility = updateMultiStopStepVisibility;
        window.updateFormSummary = updateFormSummary;

        const setFormStep = (step) => {
            if (step < 1 || step > totalSteps) return;
            currentStep = step;
            document.body.dataset.formStep = String(step);
            setStepVisibility(step);
            updateStepperState(step);
            updateStepButtons();
            updateSubmitButton();
            updateMultiStopStepVisibility(step);
            updateFormSummary();
            if (step === 2) {
                updateHouseInventoryVisibility();
            }
            if (step === 4 && typeof map !== 'undefined' && map && typeof map.resize === 'function') {
                setTimeout(() => map.resize(), 200);
            }
        };

        if (stepBackBtn) {
            stepBackBtn.addEventListener('click', () => {
                setFormStep(currentStep - 1);
            });
        }

        if (stepNextBtn) {
            stepNextBtn.addEventListener('click', () => {
                applyRequiredRules();
                const firstInvalid = validateRequiredFieldsInStep(currentStep);
                if (firstInvalid) {
                    scrollToField(firstInvalid);
                    return;
                }
                setFormStep(currentStep + 1);
            });
        }

        stepLinks.forEach((link) => {
            link.addEventListener('click', () => {
                const targetStep = parseInt(link.getAttribute('data-step'), 10);
                if (!Number.isFinite(targetStep)) return;
                if (targetStep > currentStep) {
                    applyRequiredRules();
                    const firstInvalid = validateRequiredFieldsInStep(currentStep);
                    if (firstInvalid) {
                        scrollToField(firstInvalid);
                        return;
                    }
                }
                setFormStep(targetStep);
            });
        });

        setFormStep(1);
        
        // Add listeners to update submit button visibility when fields change
        if (quoteForm) {
            quoteForm.addEventListener('input', () => {
                if (currentStep === totalSteps) {
                    updateSubmitButton();
                }
            });
            quoteForm.addEventListener('change', () => {
                if (currentStep === totalSteps) {
                    updateSubmitButton();
                }
            });
        }

        const inventorySection = document.getElementById('house-removal-inventory-section');
        const genericSection = document.getElementById('generic-additional-info-section');
        const carTransportSection = document.getElementById('car-transport-section');

        if (!hasValue) {
            return;
        }

        if (value === 'House Removals') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hideIndustrialSection();

            setTimeout(() => {
                updateHouseInventoryVisibility();
            }, 100);
        } else if (value === 'Car Transport') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'block';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hideIndustrialSection();
            setTimeout(() => {
                initCarTransportDropdowns();
            }, 100);
        } else if (value === 'Motorbike Transport') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) {
                genericSection.style.display = 'none';
                genericSection.classList.add('progressive-hidden');
            }
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideIndustrialSection();
            showMotorbikeTransportSection();
            setTimeout(() => {
                initMotorbikeTransportDropdowns();
            }, 100);
        } else if (value === 'Trailers & Campervans Transport') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showTrailerCampervanSection();
            setTimeout(() => {
                initTrailerCampervanDropdowns();
            }, 100);
        } else if (value === 'Piano Transport') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hideIndustrialSection();
            showPianoDeliverySection();
        } else if (value === 'Other') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showOtherSection();
            showDeliveryFloor();
        } else if (value === 'Man Power Only') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            showManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showDeliveryFloor();
        } else if (value === 'Industrial') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            showIndustrialSection();
        } else if (value === 'Boats') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showBoatsSection();
        } else if (value === 'Clearance') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showClearanceSection();
        } else if (value === 'Freight') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showFreightSection();
        } else if (value === 'Packaging') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showPackagingSection();
        } else if (value === 'Customized Items') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showSpecialistAntiquesSection();
        } else if (value === 'Specialist & Antiques') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showSpecialistAntiquesSection();
        } else if (value === 'Office Removals') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showOfficeRemovalSection();
        } else if (value === 'Vehicle Parts') {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
            hideIndustrialSection();
            showVehiclePartsSection();
        } else {
            if (inventorySection) {
                inventorySection.style.display = 'none';
                inventorySection.classList.add('progressive-hidden');
            }
            if (genericSection) genericSection.style.display = 'block';
            if (carTransportSection) carTransportSection.style.display = 'none';
            resetMandatoryAdditionalInfoForm();
            hideManpowerSection();
            hideOfficeRemovalSection();
            hideVehiclePartsSection();
            hideIndustrialSection();
            hideBoatsSection();
            hideClearanceSection();
            hideFreightSection();
            hidePackagingSection();
            hideSpecialistAntiquesSection();
            hideMotorbikeTransportSection();
            hideTrailerCampervanSection();
            hidePianoDeliverySection();
        }

        if (typeof window.updateProgressiveFlow === 'function') {
            window.updateProgressiveFlow();
        }
        if (typeof window.updateFormSummary === 'function') {
            window.updateFormSummary();
        }
    };

    const serviceGrid = document.getElementById('service-icon-grid');
    if (serviceGrid && serviceGrid.dataset.listenerBound !== 'true') {
        serviceGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.service-icon-btn');
            if (!btn) return;
            e.preventDefault();
            const value = btn.getAttribute('data-value');
            applyServiceSelection(value, btn.textContent.trim());
        });
        serviceGrid.dataset.listenerBound = 'true';
    }

    // Setup collapsible for generic additional info (available for all non-House Removals services)
    const genericAdditionalToggle = document.getElementById('generic-additional-toggle');
    const genericAdditionalSection = document.getElementById('generic-additional');
    if (genericAdditionalToggle && genericAdditionalSection) {
        genericAdditionalToggle.addEventListener('click', (e) => {
            e.preventDefault();
            genericAdditionalSection.classList.toggle('expanded');
        });
    }
    resetMandatoryAdditionalInfoForm();

    // Setup collapsible for house removal additional info
    const houseAdditionalToggle = document.getElementById('house-removal-additional-toggle');
    const houseAdditionalSection = document.getElementById('house-removal-additional');
    if (houseAdditionalToggle && houseAdditionalSection) {
        houseAdditionalToggle.addEventListener('click', (e) => {
            e.preventDefault();
            houseAdditionalSection.classList.toggle('expanded');
        });
    }

    function addDimensionItem() {
        const item = document.createElement('div');
        item.className = 'dimension-item';
        item.innerHTML = `
            <input type="text" class="form-input dimension-description" placeholder="Enter Item Description here">
            <div class="dimension-inputs">
                <input type="number" class="form-input dimension-field" placeholder="Width" min="0" step="0.1">
                <input type="number" class="form-input dimension-field" placeholder="Depth" min="0" step="0.1">
                <input type="number" class="form-input dimension-field" placeholder="Height" min="0" step="0.1">
                <select class="form-input dimension-unit">
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="ft">ft</option>
                </select>
                <input type="number" class="form-input dimension-field" placeholder="Weight" min="0" step="0.1">
                <select class="form-input dimension-unit">
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                </select>
            </div>
            <button type="button" class="btn-delete-dimension">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                Delete
            </button>
        `;
        dimensionsList.appendChild(item);
    }

    const quoteForm = document.getElementById('create-job-form');

    const isElementVisible = (el) => {
        if (!el) return false;
        if (el.type === 'hidden') {
            const wrapper = el.closest('.custom-dropdown-wrapper') || el.parentElement;
            if (!wrapper) return true;
            const style = window.getComputedStyle(wrapper);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            return wrapper.offsetParent !== null || wrapper.getClientRects().length > 0;
        }
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return el.offsetParent !== null || el.getClientRects().length > 0;
    };

    let inlineErrorCounter = 0;

    const getInlineErrorKey = (field) => {
        if (!field) return '';
        return field.id || field.dataset.inlineErrorKey || '';
    };

    const ensureInlineErrorKey = (field) => {
        if (!field) return '';
        if (field.id) return field.id;
        if (!field.dataset.inlineErrorKey) {
            inlineErrorCounter += 1;
            field.dataset.inlineErrorKey = `inline-error-${inlineErrorCounter}`;
        }
        return field.dataset.inlineErrorKey;
    };

    const getInlineMessageTarget = (field) => {
        if (!field) return null;
        if (field.classList.contains('location-nav-select')) {
            const nav = document.querySelector(`.location-nav[data-nav-for="${field.id}"]`);
            if (nav) return nav;
        }
        if (field.type === 'hidden' && field.id) {
            const optionNav = document.querySelector(`.option-nav[data-option-nav-for="${field.id}"]`);
            if (optionNav) return optionNav;
        }
        if (field.type === 'hidden') {
            if (field.id === 'item-description-hidden') {
                return document.getElementById('service-icon-grid') || field.parentElement;
            }
            return field.closest('.custom-dropdown-wrapper') || field.parentElement;
        }
        return field;
    };

    const clearInlineError = (field) => {
        const key = getInlineErrorKey(field);
        if (!key) return;
        const existing = document.querySelector(`.field-error-message[data-error-for="${key}"]`);
        if (existing) existing.remove();
    };

    const setInlineError = (field, message) => {
        if (!field || !message) return;
        const key = ensureInlineErrorKey(field);
        if (!key) return;
        const target = getInlineMessageTarget(field);
        if (!target || !target.parentNode) return;

        let node = document.querySelector(`.field-error-message[data-error-for="${key}"]`);
        if (!node) {
            node = document.createElement('div');
            node.className = 'field-error-message';
            node.setAttribute('data-error-for', key);
            target.insertAdjacentElement('afterend', node);
        }
        node.textContent = message;
    };

    const applyRequiredRules = () => {
        if (!quoteForm) return;
        const fields = Array.from(quoteForm.querySelectorAll('input, select, textarea'));

        fields.forEach((field) => {
            if (field.closest('#generic-additional')) return;
            if (field.hasAttribute('data-optional')) return;

            const type = field.type;
            if (type === 'checkbox' || type === 'radio' || type === 'file' || type === 'submit' || type === 'button') {
                return;
            }

            if (type === 'hidden') {
                const isDropdownHidden = field.closest('.custom-dropdown-wrapper');
                if (!isDropdownHidden && field.id !== 'item-description-hidden') {
                    return;
                }
            }

            field.setAttribute('data-required', 'true');
            field.setAttribute('aria-required', 'true');

            if (field.id) {
                const label = quoteForm.querySelector(`label[for="${field.id}"]`);
                if (label && !label.querySelector('.required-text')) {
                    const requiredSpan = document.createElement('span');
                    requiredSpan.className = 'required-text';
                    requiredSpan.textContent = '(required)';
                    requiredSpan.setAttribute('data-required-for', field.id);
                    label.appendChild(document.createTextNode(' '));
                    label.appendChild(requiredSpan);
                }
            }
        });

        const dropdownHiddenFields = Array.from(quoteForm.querySelectorAll('.custom-dropdown-wrapper input[type="hidden"]'));
        dropdownHiddenFields.forEach((field) => {
            if (field.closest('#generic-additional')) return;
            field.setAttribute('data-required', 'true');
            field.setAttribute('aria-required', 'true');

            if (field.id) {
                const label = field.closest('.card-section')?.querySelector('.form-label');
                if (label && !label.querySelector('.required-text')) {
                    const requiredSpan = document.createElement('span');
                    requiredSpan.className = 'required-text';
                    requiredSpan.textContent = '(required)';
                    requiredSpan.setAttribute('data-required-for', field.id);
                    label.appendChild(document.createTextNode(' '));
                    label.appendChild(requiredSpan);
                }
            }
        });
    };

    const clearFieldError = (el) => {
        if (!el) return;
        el.classList.remove('input-error');
        el.removeAttribute('aria-invalid');
        clearInlineError(el);

        if (el.classList.contains('location-nav-select')) {
            const nav = document.querySelector(`.location-nav[data-nav-for="${el.id}"]`);
            if (nav) nav.classList.remove('input-error');
        }
        if (el.type === 'hidden' && el.id) {
            const optionNav = document.querySelector(`.option-nav[data-option-nav-for="${el.id}"]`);
            if (optionNav) optionNav.classList.remove('input-error');
        }

        if (el.id) {
            const requiredText = document.querySelectorAll(`[data-required-for="${el.id}"]`);
            requiredText.forEach((node) => node.classList.remove('required-text--active'));
        }
    };

    const markFieldError = (el) => {
        if (!el) return;
        el.classList.add('input-error');
        el.setAttribute('aria-invalid', 'true');

        if (el.classList.contains('location-nav-select')) {
            const nav = document.querySelector(`.location-nav[data-nav-for="${el.id}"]`);
            if (nav) nav.classList.add('input-error');
        }
        if (el.type === 'hidden' && el.id) {
            const optionNav = document.querySelector(`.option-nav[data-option-nav-for="${el.id}"]`);
            if (optionNav) optionNav.classList.add('input-error');
        }

        if (el.id) {
            const requiredText = document.querySelectorAll(`[data-required-for="${el.id}"]`);
            requiredText.forEach((node) => node.classList.add('required-text--active'));
        }
    };

    // Check for service parameter in URL and pre-select in service icons
    const serviceParam = urlParams.get('service');

    if (serviceParam && cjHidden && !isMultiStopMode) {
        const isValidService = Array.from(serviceIconButtons).some(
            (btn) => btn.getAttribute('data-value') === serviceParam
        );
        if (isValidService) {
            pendingServiceValue = serviceParam;
        }
    }

    // Prefill from landing step + custom dropdown label sync
    // Only use localStorage if there's no URL parameter (URL parameter takes priority)
    if (!serviceParam && !isMultiStopMode) {
        try {
            const raw = localStorage.getItem('anytransport_quote_prefill');
            if (raw) {
                const prefill = JSON.parse(raw);
                if (prefill.itemType) {
                    const isValidService = Array.from(serviceIconButtons).some(
                        (btn) => btn.getAttribute('data-value') === prefill.itemType
                    );
                    if (isValidService && !pendingServiceValue) {
                        pendingServiceValue = prefill.itemType;
                    }
                }
            }
        } catch (err) {
            console.warn('Prefill load failed', err);
        }
    }

    const setRequiredTextState = (id, isActive) => {
        if (!id) return;
        const requiredText = document.querySelectorAll(`[data-required-for="${id}"]`);
        requiredText.forEach((node) => {
            if (isActive) {
                node.classList.add('required-text--active');
            } else {
                node.classList.remove('required-text--active');
            }
        });
    };

    const setInventoryHighlight = (sectionId, isActive) => {
        const section = document.getElementById(sectionId);
        if (!section) return;
        section.classList.toggle('inventory-required', isActive);
    };

    const vehicleNoFloorCategories = new Set([
        'Car Transport',
        'Motorbike Transport',
        'Trailers & Campervans Transport',
        'Vehicle Parts',
        'Boats'
    ]);

    const floorBlockSection = document.getElementById('floor-inventory-section');
    const floorBlockList = document.getElementById('floor-block-list');
    const addFloorBlockBtn = document.getElementById('add-floor-block-btn');
    let floorBlockCounter = 0;

    const setPickupFieldsOptional = (isOptional) => {
        const pickupType = document.getElementById('pickup-location-type');
        const pickupFloor = document.getElementById('pickup-floor');
        const pickupElevator = document.getElementById('pickup-elevator');
        [pickupType, pickupFloor, pickupElevator].forEach((field) => {
            if (!field) return;
            setFieldRequired(field, !isOptional);
            if (isOptional) {
                field.setAttribute('data-optional', 'true');
            } else {
                field.removeAttribute('data-optional');
            }
        });
    };

    const syncPickupFieldsFromFloorBlock = (block) => {
        if (!block) return;
        const typeSelect = block.querySelector('.multi-stop-location-type');
        const floorSelect = block.querySelector('.multi-stop-floor');
        const pickupType = document.getElementById('pickup-location-type');
        const pickupFloor = document.getElementById('pickup-floor');

        if (pickupType && typeSelect && pickupType.value !== typeSelect.value) {
            pickupType.value = typeSelect.value;
            refreshLocationNavForSelect(pickupType);
        }

        if (pickupFloor && floorSelect && pickupFloor.value !== floorSelect.value) {
            pickupFloor.value = floorSelect.value;
            refreshLocationNavForSelect(pickupFloor);
        }
    };

    const shouldShowFloorBlocks = (serviceValue) => {
        return !!serviceValue && !vehicleNoFloorCategories.has(serviceValue);
    };

    const initFloorBlockCard = (card) => {
        if (!card) return;
        const stopId = card.dataset.stopId;
        if (!stopId) return;

        const revealStepFlowBlock = () => {
            if (!document.querySelector('.form-stepper')) return;
            card.querySelectorAll('.step-hidden, .progressive-hidden').forEach((el) => {
                el.classList.remove('step-hidden', 'progressive-hidden');
            });
            const sections = card.querySelectorAll(
                '.multi-stop-floors-section, .multi-stop-office-floors-section, [data-stop-section="floors"], [data-stop-section="office-floors"]'
            );
            sections.forEach((section) => {
                section.style.display = 'block';
            });
        };

        const normalizeSingleFormBlock = () => {
            // Force all major sections to be visible
            card.querySelectorAll('.multi-stop-floors-section, .floors-fields, .card-section').forEach((section) => {
                section.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
            });
            
            card.querySelectorAll('.step-hidden, .progressive-hidden').forEach((el) => {
                el.classList.remove('step-hidden', 'progressive-hidden');
            });
            card.querySelectorAll('[data-step-slice]').forEach((el) => {
                el.classList.remove('step-hidden');
                el.style.cssText = 'display: flex !important; flex-direction: column !important; visibility: visible !important;';
            });
            card.querySelectorAll('.location-details').forEach((details) => {
                details.classList.add('is-visible');
                details.style.display = 'flex';
            });
            card.querySelectorAll('.floor-group, .elevator-group, .location-group').forEach((group) => {
                group.style.cssText = 'display: block !important; visibility: visible !important;';
            });
            card.querySelectorAll('.form-group').forEach((group) => {
                group.style.cssText = 'display: block !important; visibility: visible !important;';
            });
            card.querySelectorAll('.location-nav-wrapper').forEach((wrapper) => {
                wrapper.style.cssText = 'position: static !important; display: block !important; visibility: visible !important;';
            });
            card.querySelectorAll('.location-nav').forEach((nav) => {
                nav.style.display = 'none';
            });
            card.querySelectorAll('select.location-nav-select').forEach((select) => {
                select.disabled = false;
                select.style.cssText = 'position: static !important; display: block !important; visibility: visible !important; opacity: 1 !important; width: 100% !important; height: auto !important; min-height: 44px !important; padding: 10px 12px !important; border: 1px solid #e5e7eb !important; border-radius: 8px !important; background: #ffffff !important; color: #111827 !important; font-size: 14px !important; margin-top: 8px !important; pointer-events: auto !important; left: auto !important; top: auto !important;';
                console.log('Floor block select found:', select.id, 'Options:', select.options.length);
            });
            // Force all selects to be visible regardless of class
            card.querySelectorAll('select').forEach((select) => {
                if (!select.classList.contains('location-nav-select')) {
                    select.style.cssText = 'display: block !important; visibility: visible !important; opacity: 1 !important;';
                }
            });
        };

        if (!multiStopHouseState[stopId]) {
            const quantities = {};
            Object.values(MULTI_STOP_ROOM_ITEMS).flat().forEach((item) => {
                quantities[item] = 0;
            });
            multiStopHouseState[stopId] = {
                currentRoom: '',
                selectedRooms: new Set(),
                quantities,
                customItems: '',
                extraItems: '',
                searchQueries: {},
                subRooms: {},
                subRoomQuantities: {}
            };
        }

        if (!multiStopOfficeState[stopId]) {
            const quantities = {};
            MULTI_STOP_OFFICE_ITEMS.forEach((item) => {
                quantities[item.name] = 0;
            });
            multiStopOfficeState[stopId] = {
                category: 'workstations',
                quantities,
                customItems: ''
            };
        }

        renderMultiStopHouseItems(stopId, null);
        renderMultiStopOfficeInventory(stopId);
        initMultiStopLocationNavs(card);

        const seedFloorBlockType = () => {
            const typeSelect = card.querySelector('.multi-stop-location-type');
            if (!typeSelect || typeSelect.value) return;
            const serviceValue = document.getElementById('item-description-hidden')?.value || '';
            const sourceId = serviceValue === 'Office Removals'
                ? 'office-pickup-location-type'
                : 'pickup-location-type';
            const sourceValue = document.getElementById(sourceId)?.value || '';
            if (!sourceValue) return;
            typeSelect.value = sourceValue;
            updateMultiStopFloorOptions(card, sourceValue);
            updateMultiStopLocationDetails(card, sourceValue);
            const nav = card.querySelector('.location-type-nav[data-nav-for]');
            if (nav) {
                const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
                buttons.forEach((btn) => {
                    const isActive = btn.getAttribute('data-value') === sourceValue;
                    btn.classList.toggle('is-active', isActive);
                    btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
                });
            }
        };

        updateMultiStopFloorOptions(card, '');
        updateMultiStopLocationDetails(card);
        updateMultiStopCategorySections(card, document.getElementById('item-description-hidden')?.value || '');
        const houseSection = card.querySelector('[data-stop-section="house-inventory"]');
        if (houseSection) houseSection.classList.remove('progressive-hidden');
        const officeSection = card.querySelector('[data-stop-section="office-inventory"]');
        if (officeSection) officeSection.classList.remove('progressive-hidden');
        seedFloorBlockType();
        applyMultiStopRequiredRules(card);
        initMultiStopOptionNavs(card);
        initMultiStopDropdowns(card);
        if (document.body.classList.contains('single-form')) {
            normalizeSingleFormBlock();
        }
        revealStepFlowBlock();
    };

    const syncFloorBlockInventory = (card, serviceValue) => {
        if (!card) return;
        const isHouse = serviceValue === 'House Removals';
        const isOffice = serviceValue === 'Office Removals';
        const houseSection = card.querySelector('[data-stop-section="house-inventory"]');
        const officeSection = card.querySelector('[data-stop-section="office-inventory"]');
        if (houseSection) houseSection.style.display = isHouse ? '' : 'none';
        if (officeSection) officeSection.style.display = isOffice ? '' : 'none';
    };

    const buildFloorBlock = (serviceValue) => {
        if (!floorBlockList) return null;
        floorBlockCounter += 1;
        const blockId = `floor-block-${floorBlockCounter}`;
        const isOffice = serviceValue === 'Office Removals';
        const floorsMarkup = isOffice
            ? buildMultiStopOfficeFloorsSection(blockId)
            : buildMultiStopFloorsSection(blockId);
        const houseMarkup = buildMultiStopHouseInventorySection(blockId);
        const officeMarkup = buildMultiStopOfficeInventorySection(blockId);

        const block = document.createElement('div');
        block.className = 'floor-block multi-stop-card';
        block.dataset.stopId = blockId;
        block.innerHTML = `
            <div class="floor-block-header">
                <h3 class="floor-block-title">Floor ${floorBlockCounter}</h3>
                <button type="button" class="floor-block-remove" data-remove-floor>Remove</button>
            </div>
            ${floorsMarkup}
            ${houseMarkup}
            ${officeMarkup}
            <div class="floor-block-elevator">
            </div>
        `;

        const typeLabel = block.querySelector('label[for$="pickup-location-type"]');
        if (typeLabel) typeLabel.textContent = isOffice ? 'Office type' : 'Property type';
        const detailsLabel = block.querySelector('[data-location-group$="details"] > .form-label');
        if (detailsLabel) detailsLabel.textContent = 'Floor selection';

        block.querySelectorAll('.office-hidden').forEach((node) => node.classList.remove('office-hidden'));

        const elevatorGroup = block.querySelector('.elevator-group');
        const elevatorWrap = block.querySelector('.floor-block-elevator');
        if (elevatorGroup && elevatorWrap) {
            elevatorWrap.appendChild(elevatorGroup);
        }

        syncFloorBlockInventory(block, serviceValue);
        return block;
    };

    const updateFloorBlockTitles = () => {
        if (!floorBlockList) return;
        const blocks = Array.from(floorBlockList.querySelectorAll('.floor-block'));
        blocks.forEach((block, index) => {
            const title = block.querySelector('.floor-block-title');
            if (title) title.textContent = `Floor ${index + 1}`;
            const removeBtn = block.querySelector('[data-remove-floor]');
            if (removeBtn) removeBtn.style.visibility = blocks.length > 1 ? 'visible' : 'hidden';
        });
    };

    const syncFloorBlockTypeLocks = (primaryValue) => {
        if (!floorBlockList) return;
        const blocks = Array.from(floorBlockList.querySelectorAll('.floor-block'));
        if (!blocks.length) return;

        const firstBlock = blocks[0];
        const firstSelect = firstBlock.querySelector('.multi-stop-location-type');
        const resolvedValue = primaryValue || (firstSelect ? firstSelect.value : '');

        blocks.forEach((block, index) => {
            const typeSelect = block.querySelector('.multi-stop-location-type');
            if (!typeSelect) return;
            const isPrimary = index === 0;

            if (isPrimary) {
                typeSelect.disabled = false;
                typeSelect.removeAttribute('aria-disabled');
                return;
            }

            if (resolvedValue) {
                typeSelect.value = resolvedValue;
                updateMultiStopFloorOptions(block, resolvedValue);
                updateMultiStopLocationDetails(block, resolvedValue);
                const nav = block.querySelector('.location-type-nav[data-nav-for]');
                if (nav) {
                    const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
                    buttons.forEach((btn) => {
                        const isActive = btn.getAttribute('data-value') === resolvedValue;
                        btn.classList.toggle('is-active', isActive);
                        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
                    });
                }
            }

            typeSelect.disabled = true;
            typeSelect.setAttribute('aria-disabled', 'true');
        });
    };

    const resetFloorBlocks = (serviceValue) => {
        if (!floorBlockList || !floorBlockSection) return;
        floorBlockList.innerHTML = '';
        floorBlockCounter = 0;
        if (!shouldShowFloorBlocks(serviceValue)) {
            floorBlockSection.style.display = 'none';
            if (addFloorBlockBtn) addFloorBlockBtn.disabled = true;
            return;
        }
        floorBlockSection.style.display = '';
        const block = buildFloorBlock(serviceValue);
        if (block) {
            floorBlockList.appendChild(block);
            initFloorBlockCard(block);
        }
        updateFloorBlockTitles();
        syncFloorBlockTypeLocks();
        if (addFloorBlockBtn) addFloorBlockBtn.disabled = false;
    };

    const addFloorBlock = (serviceValue) => {
        if (!floorBlockList) return;
        const block = buildFloorBlock(serviceValue);
        if (!block) return;
        floorBlockList.appendChild(block);
        initFloorBlockCard(block);
        updateFloorBlockTitles();
        syncFloorBlockTypeLocks();
    };

    const initFloorBlockListeners = () => {
        if (!floorBlockList || floorBlockList.dataset.listenersReady === 'true') return;
        floorBlockList.addEventListener('pointerdown', handleMultiStopOptionNavCapture, true);
        floorBlockList.addEventListener('click', handleMultiStopListClick);
        floorBlockList.addEventListener('input', handleMultiStopListInput);
        floorBlockList.addEventListener('change', handleMultiStopListInput);
        floorBlockList.addEventListener('change', (event) => {
            const target = event.target;
            if (!target) return;
            const card = target.closest('.floor-block');
            if (!card) return;
            if (target.classList.contains('multi-stop-location-type')) {
                updateMultiStopFloorOptions(card, target.value);
                updateMultiStopLocationDetails(card, target.value);
                const details = card.querySelector('[data-location-group$="details"] .location-details')
                    || card.querySelector('.location-details');
                if (details) details.classList.add('is-visible');
                const floorGroup = card.querySelector('.floor-group');
                const floorSelect = card.querySelector('.multi-stop-floor');
                if (floorGroup) floorGroup.style.display = '';
                if (floorSelect) floorSelect.disabled = false;
                syncFloorBlockTypeLocks(target.value);
            } else if (target.classList.contains('multi-stop-floor')) {
                updateMultiStopLocationDetails(card);
            }

            if (target.classList.contains('multi-stop-location-type') || target.classList.contains('multi-stop-floor')) {
                syncPickupFieldsFromFloorBlock(card);
                if (typeof window.updateFormSummary === 'function') {
                    window.updateFormSummary();
                }
                updateHouseInventoryVisibility();
            }
        });
        floorBlockList.addEventListener('change', (event) => {
            if (!document.body.classList.contains('single-form')) return;
            const target = event.target;
            if (!target || !(target instanceof HTMLSelectElement)) return;
            const card = target.closest('.floor-block');
            if (!card) return;
            if (target.classList.contains('multi-stop-location-type')) {
                updateMultiStopFloorOptions(card, target.value);
                updateMultiStopLocationDetails(card, target.value);
                const details = card.querySelector('[data-location-group$="details"] .location-details')
                    || card.querySelector('.location-details');
                if (details) details.classList.add('is-visible');
                const floorGroup = card.querySelector('.floor-group');
                const floorSelect = card.querySelector('.multi-stop-floor');
                if (floorGroup) floorGroup.style.display = '';
                if (floorSelect) floorSelect.disabled = false;
                syncFloorBlockTypeLocks(target.value);
                return;
            }
            if (target.classList.contains('multi-stop-floor')) {
                updateMultiStopLocationDetails(card);
            }
        });
        floorBlockList.addEventListener('click', (event) => {
            if (!document.body.classList.contains('single-form')) return;
            const navButton = event.target.closest('.floor-block .location-nav-btn');
            if (!navButton) return;
            const nav = navButton.closest('.location-nav');
            if (!nav) return;
            const selectId = nav.getAttribute('data-nav-for');
            const selectEl = selectId ? document.getElementById(selectId) : null;
            if (!selectEl) return;
            if (selectEl.disabled) return;
            const value = navButton.getAttribute('data-value') || '';
            if (!value) return;
            selectEl.value = value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
            buttons.forEach((btn) => {
                const isActive = btn === navButton;
                btn.classList.toggle('is-active', isActive);
                btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
            });
            if (nav.getAttribute('data-nav-type') === 'location-type') {
                const card = navButton.closest('.floor-block');
                if (card) {
                    updateMultiStopFloorOptions(card, value);
                    updateMultiStopLocationDetails(card, value);
                }
            }
        });
        floorBlockList.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-remove-floor]');
            if (!removeBtn) return;
            const block = removeBtn.closest('.floor-block');
            if (!block) return;
            block.remove();
            updateFloorBlockTitles();
        });
        floorBlockList.dataset.listenersReady = 'true';
    };

    const roomOptions = [
        { value: 'living', label: 'Living' },
        { value: 'dining', label: 'Dining' },
        { value: 'kitchen', label: 'Kitchen' },
        { value: 'hallway', label: 'Hallway' },
        { value: 'office', label: 'Office' },
        { value: 'bedrooms', label: 'Bedrooms' },
        { value: 'bathrooms', label: 'Bathrooms' },
        { value: 'garden', label: 'Garden' }
    ];

    const locationRoomConfigs = [
        // Removed 'pickup' config to prevent old Pickup room fields from being generated
        {
            prefix: 'delivery',
            typeSelectId: 'delivery-location-type',
            detailsId: 'delivery-location-details',
            floorSelectId: 'delivery-floor',
            roomListId: 'delivery-room-list',
            addButtonId: 'delivery-add-room-btn',
            roomLabel: 'Delivery room',
            itemLabel: 'What to deliver to this room',
            itemPlaceholder: 'e.g. Couch',
            limitedFloorTypes: ['house', 'duplex'],
            noFloorTypes: ['warehouse'],
            noRoomTypes: ['warehouse', 'storage-unit'],
            noElevatorTypes: ['house', 'duplex', 'bungalow', 'warehouse']
        },
        {
            prefix: 'office-pickup',
            typeSelectId: 'office-pickup-location-type',
            detailsId: 'office-pickup-location-details',
            floorSelectId: 'office-pickup-floor',
            roomListId: 'office-pickup-room-list',
            addButtonId: 'office-pickup-add-room-btn',
            roomLabel: 'Pickup room',
            itemLabel: 'What to pick up from this room',
            itemPlaceholder: 'e.g. Desks, chairs'
        },
        {
            prefix: 'office-delivery',
            typeSelectId: 'office-delivery-location-type',
            detailsId: 'office-delivery-location-details',
            floorSelectId: 'office-delivery-floor',
            roomListId: 'office-delivery-room-list',
            addButtonId: 'office-delivery-add-room-btn',
            roomLabel: 'Delivery room',
            itemLabel: 'What to deliver to this room',
            itemPlaceholder: 'e.g. Desks, chairs'
        }
    ];

    const roomEntryCounters = {};
    const locationTypeState = {};

    const fullFloorOptions = [
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' },
        { value: '3', label: '3rd' },
        { value: '4', label: '4th' },
        { value: '5', label: '5th' },
        { value: '6', label: '6th' },
        { value: '7', label: '7th' },
        { value: '8', label: '8th' },
        { value: '9', label: '9th' },
        { value: '10', label: '10th' },
        { value: '11', label: '11th' },
        { value: '12', label: '12th' },
        { value: '13', label: '13th' },
        { value: '14', label: '14th' },
        { value: '15', label: '15th' },
        { value: '16', label: '16th' },
        { value: '17', label: '17th' },
        { value: '18', label: '18th' },
        { value: '19', label: '19th' },
        { value: '20', label: '20th' }
    ];

    const limitedFloorOptions = [
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' }
    ];

    const bungalowFloorOptions = [
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' }
    ];

    const storageUnitFloorOptions = [
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' },
        { value: '3', label: '3rd' },
        { value: '4', label: '4th' },
        { value: '5', label: '5th' }
    ];

    const buildRoomOptions = () => {
        return roomOptions.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('');
    };

    const setFloorOptions = (selectEl, options) => {
        if (!selectEl) return;
        const currentValue = selectEl.value;
        const optionMarkup = options.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('');
        selectEl.innerHTML = `<option value="">Choose floor</option>${optionMarkup}`;
        if (options.some((opt) => opt.value === currentValue)) {
            selectEl.value = currentValue;
        }
    };

    const updateFloorOptionsForType = (config, typeValue) => {
        const floorSelect = config.floorSelectId ? document.getElementById(config.floorSelectId) : null;
        if (!floorSelect) return;

        const limitTypes = config.limitedFloorTypes || [];
        if (typeValue === 'bungalow') {
            setFloorOptions(floorSelect, bungalowFloorOptions);
            refreshLocationNavForSelect(floorSelect);
            return;
        }
        if (typeValue === 'storage-unit') {
            setFloorOptions(floorSelect, storageUnitFloorOptions);
            refreshLocationNavForSelect(floorSelect);
            return;
        }
        const useLimited = limitTypes.includes(typeValue);
        setFloorOptions(floorSelect, useLimited ? limitedFloorOptions : fullFloorOptions);
        refreshLocationNavForSelect(floorSelect);
    };

    const setFieldRequired = (field, isRequired) => {
        if (!field) return;
        if (isRequired) {
            field.setAttribute('data-required', 'true');
            field.setAttribute('aria-required', 'true');
            field.removeAttribute('data-optional');
            return;
        }
        field.setAttribute('data-optional', 'true');
        field.removeAttribute('data-required');
        field.removeAttribute('aria-required');
        clearFieldError(field);
    };

    const getLocationNavForSelect = (selectEl) => {
        if (!selectEl || !selectEl.id) return null;
        return document.querySelector(`.location-nav[data-nav-for="${selectEl.id}"]`);
    };

    const setNavButtonState = (nav, value) => {
        if (!nav) return;
        const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
        buttons.forEach((btn) => {
            const isActive = btn.getAttribute('data-value') === value;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
    };

    const getNavIconMarkup = (type, value) => {
        if (type === 'elevator') {
            if (value === 'yes') {
                return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v18H7z" fill="currentColor"/><path d="M12 6l2 2h-4z" fill="#fff"/><path d="M12 18l-2-2h4z" fill="#fff"/></svg>';
            }
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18h4v2H4zm0-4h6v2H4zm0-4h8v2H4zm0-4h10v2H4z" fill="currentColor"/></svg>';
        }
        if (type === 'floor') {
            return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h6v-4h4v4h6v2H4z" fill="currentColor"/><path d="M6 13h6V9h6v2h-4v4H6z" fill="#fff"/></svg>';
        }
        return '';
    };

    const buildNavFromSelect = (selectEl, nav, type) => {
        if (!selectEl || !nav) return;
        nav.innerHTML = '';
        const options = Array.from(selectEl.options).filter((opt) => opt.value);
        options.forEach((opt) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'location-nav-btn';
            btn.setAttribute('data-value', opt.value);
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', 'false');
            const iconMarkup = getNavIconMarkup(type, opt.value);
            const labelText = opt.textContent.trim();
            btn.innerHTML = `${iconMarkup}<span class="floor-label">${labelText}</span>`;
            nav.appendChild(btn);
        });
        setNavButtonState(nav, selectEl.value);
    };

    const syncNavWithSelect = (selectEl) => {
        const nav = getLocationNavForSelect(selectEl);
        if (!nav) return;
        setNavButtonState(nav, selectEl.value);
    };

    const refreshLocationNavForSelect = (selectEl) => {
        const nav = getLocationNavForSelect(selectEl);
        if (!nav) return;
        const navType = nav.getAttribute('data-nav-type');
        if (navType === 'floor' || navType === 'elevator') {
            buildNavFromSelect(selectEl, nav, navType);
        } else {
            setNavButtonState(nav, selectEl.value);
        }
    };

    const setupLocationNavs = () => {
        const navs = Array.from(document.querySelectorAll('.location-nav[data-nav-for]'));
        navs.forEach((nav) => {
            const selectId = nav.getAttribute('data-nav-for');
            const selectEl = selectId ? document.getElementById(selectId) : null;
            if (!selectEl) return;

            const navType = nav.getAttribute('data-nav-type');
            if (navType === 'floor' || navType === 'elevator') {
                buildNavFromSelect(selectEl, nav, navType);
            } else {
                setNavButtonState(nav, selectEl.value);
            }

            nav.addEventListener('click', (event) => {
                const btn = event.target.closest('.location-nav-btn');
                if (!btn) return;
                const value = btn.getAttribute('data-value') || '';
                if (!value) return;
                selectEl.value = value;
                selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                clearFieldError(selectEl);
                setNavButtonState(nav, value);
            });

            selectEl.addEventListener('change', () => {
                syncNavWithSelect(selectEl);
            });
        });
    };

    const setOptionNavState = (nav, values, isMulti) => {
        if (!nav) return;
        const valueSet = new Set(values.filter(Boolean));
        const buttons = Array.from(nav.querySelectorAll('.option-nav-btn'));
        buttons.forEach((btn) => {
            const isActive = valueSet.has(btn.getAttribute('data-value'));
            btn.classList.toggle('is-active', isActive);
            if (isMulti) {
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            } else {
                btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
            }
        });
    };

    const parseOptionNavValues = (raw) => {
        if (!raw) return [];
        return String(raw)
            .split(',')
            .map((val) => val.trim())
            .filter(Boolean);
    };

    const initOptionNav = (nav) => {
        if (!nav || nav.dataset.optionNavReady === 'true') return;
        const targetId = nav.getAttribute('data-option-nav-for');
        const wrapper = nav.closest('.custom-dropdown-wrapper');
        let hidden = targetId ? document.getElementById(targetId) : null;
        if (!hidden) {
            hidden = wrapper?.querySelector('input[type="hidden"]') || null;
        }
        if (!hidden) return;

        const isMulti = nav.getAttribute('data-option-nav-multi') === 'true';
        const initialValues = parseOptionNavValues(hidden.value);
        setOptionNavState(nav, initialValues, isMulti);

        nav.addEventListener('click', (event) => {
            const btn = event.target.closest('.option-nav-btn');
            if (!btn) return;
            const value = btn.getAttribute('data-value') || '';
            if (!value) return;

            let values = parseOptionNavValues(hidden.value);
            if (isMulti) {
                if (values.includes(value)) {
                    values = values.filter((entry) => entry !== value);
                } else {
                    values.push(value);
                }
                hidden.value = values.join(', ');
            } else {
                hidden.value = value;
                values = [value];
            }

            hidden.dispatchEvent(new Event('change', { bubbles: true }));
            clearFieldError(hidden);
            setOptionNavState(nav, values, isMulti);
        });

        hidden.addEventListener('change', () => {
            const values = parseOptionNavValues(hidden.value);
            setOptionNavState(nav, values, isMulti);
        });

        nav.dataset.optionNavReady = 'true';
    };

    const setupOptionNavs = () => {
        const navs = Array.from(document.querySelectorAll('.option-nav[data-option-nav-for]'));
        navs.forEach((nav) => initOptionNav(nav));
    };

    const buildRoomOptionNav = () => {
        const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor"/><path d="M4 10h16" stroke="#fff" stroke-width="2"/></svg>';
        return roomOptions
            .map((opt) => `<button type="button" class="option-nav-btn" data-value="${opt.value}" role="radio" aria-checked="false">${icon}<span>${opt.label}</span></button>`)
            .join('');
    };

    const createRoomEntry = (config, isOptional) => {
        const list = document.getElementById(config.roomListId);
        if (!list) return;

        const index = (roomEntryCounters[config.prefix] || 0) + 1;
        roomEntryCounters[config.prefix] = index;

        const roomId = `${config.prefix}-room-${index}`;
        const roomHiddenId = `${roomId}-hidden`;
        const itemsId = `${config.prefix}-room-items-${index}`;
        const optionalAttr = isOptional ? ' data-optional="true"' : '';
        const optionalClass = isOptional ? ' location-room-entry--optional' : '';
        const requiredText = isOptional ? '' : ' <span class="required-text required-text--conditional" data-required-for="' + roomId + '">(required)</span>';
        const requiredItemText = isOptional ? '' : ' <span class="required-text required-text--conditional" data-required-for="' + itemsId + '">(required)</span>';
        const useRoomIcons = config.prefix === 'delivery';
        const roomControl = useRoomIcons
            ? `
                <div class="custom-dropdown-wrapper has-option-nav">
                    <div class="option-nav option-nav--compact option-nav--room-grid" data-option-nav-for="${roomHiddenId}" role="radiogroup" aria-label="${config.roomLabel}">
                        ${buildRoomOptionNav()}
                    </div>
                    <input type="hidden" id="${roomHiddenId}" class="form-input location-room-select"${optionalAttr}>
                </div>
            `
            : `
                <select id="${roomId}" class="form-input location-room-select"${optionalAttr}>
                    <option value="">Choose room</option>
                    ${buildRoomOptions()}
                </select>
            `;

        const entry = document.createElement('div');
        entry.className = `location-room-entry${optionalClass}`;
        entry.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="${useRoomIcons ? roomHiddenId : roomId}">${config.roomLabel}${requiredText}</label>
                ${roomControl}
            </div>
            <div class="form-group">
                <label class="form-label" for="${itemsId}">${config.itemLabel}${requiredItemText}</label>
                <input type="text" id="${itemsId}" class="form-input location-room-items" placeholder="${config.itemPlaceholder}"${optionalAttr}>
            </div>
        `;
        list.appendChild(entry);

        const roomSelect = entry.querySelector(`#${useRoomIcons ? roomHiddenId : roomId}`);
        const itemsInput = entry.querySelector(`#${itemsId}`);
        if (!isOptional) {
            setFieldRequired(roomSelect, true);
            setFieldRequired(itemsInput, true);
        }

        if (useRoomIcons) {
            const nav = entry.querySelector(`.option-nav[data-option-nav-for="${roomHiddenId}"]`);
            initOptionNav(nav);
        }
    };

    const resetRoomList = (config) => {
        const list = document.getElementById(config.roomListId);
        if (!list) return;
        list.innerHTML = '';
        roomEntryCounters[config.prefix] = 0;
        createRoomEntry(config, false);
        if (config.prefix !== 'delivery') {
            createRoomEntry(config, true);
        }
        applyRequiredRules();
    };

    const setLocationDetailsState = (config, show, options = {}) => {
        const showFloor = options.showFloor !== undefined ? options.showFloor : show;
        const showRooms = options.showRooms !== undefined ? options.showRooms : show;
        const showElevator = options.showElevator !== undefined ? options.showElevator : show;
        const details = document.getElementById(config.detailsId);
        if (!details) return;
        details.classList.toggle('is-visible', show);
        const fields = Array.from(details.querySelectorAll('input, select, textarea, button'));
        fields.forEach((field) => {
            field.disabled = !show;
        });

        const floorSelect = config.floorSelectId ? document.getElementById(config.floorSelectId) : null;
        const floorSelected = floorSelect ? !!floorSelect.value : true;
        const floorGroup = floorSelect ? floorSelect.closest('.form-group') : null;
        if (floorGroup) {
            floorGroup.style.display = show && showFloor ? '' : 'none';
        }
        if (floorSelect) {
            floorSelect.disabled = !show || !showFloor;
            setFieldRequired(floorSelect, show && showFloor);
            if (!show || !showFloor) {
                floorSelect.value = '';
                clearFieldError(floorSelect);
                syncNavWithSelect(floorSelect);
            }
        }

        const elevatorSelect = details.querySelector('select[id$="-elevator"]');
        if (elevatorSelect) {
            const elevatorGroup = elevatorSelect.closest('.form-group');
            if (elevatorGroup) {
                elevatorGroup.style.display = show && showElevator ? '' : 'none';
            }
            elevatorSelect.disabled = !show || !showElevator;
            setFieldRequired(elevatorSelect, show && showElevator);
            if (!show || !showElevator) {
                elevatorSelect.value = '';
                clearFieldError(elevatorSelect);
                syncNavWithSelect(elevatorSelect);
            }
        }

        const showRoomBlock = show && showRooms;
        const allowRooms = show && showRooms && (!showFloor || floorSelected);
        const roomList = config.roomListId ? document.getElementById(config.roomListId) : null;
        const roomFields = details.querySelectorAll('.location-room-select, .location-room-items');
        const roomListFields = roomList ? roomList.querySelectorAll('.location-room-select, .location-room-items') : [];
        const allRoomFields = [...roomFields, ...roomListFields];
        allRoomFields.forEach((field) => {
            const isOptional = field.hasAttribute('data-optional');
            setFieldRequired(field, allowRooms && !isOptional);
            field.disabled = !allowRooms;
        });

        const roomActionsButton = config.addButtonId ? document.getElementById(config.addButtonId) : null;
        const roomActions = roomActionsButton ? roomActionsButton.closest('.location-room-actions') : null;
        if (roomList) {
            roomList.style.display = showRoomBlock ? '' : 'none';
            if (!showRoomBlock) {
                roomList.innerHTML = '';
                roomEntryCounters[config.prefix] = 0;
            }
        }
        if (roomActions) {
            roomActions.style.display = showRoomBlock ? '' : 'none';
        }

        const conditionalRequired = details.querySelectorAll('.required-text--conditional');
        conditionalRequired.forEach((node) => {
            const isRoomNode = !!node.closest('.location-room-list');
            const shouldShow = show && (!isRoomNode || allowRooms);
            node.style.display = shouldShow ? 'inline' : 'none';
            if (!shouldShow) node.classList.remove('required-text--active');
        });

        if (show) {
            return;
        }

        fields.forEach((field) => {
            if (field.tagName === 'BUTTON') return;
            if (field.type === 'checkbox' || field.type === 'radio') {
                field.checked = false;
            } else {
                field.value = '';
            }
            clearFieldError(field);
        });
        resetRoomList(config);
    };

    const updateLocationDetailForConfig = (config) => {
        const serviceValue = document.getElementById('item-description-hidden')?.value || '';
        const allowLocations = true;
        const isVehicleNoFloor = vehicleNoFloorCategories.has(serviceValue);
        const typeSelect = document.getElementById(config.typeSelectId);
        if (!typeSelect) return;

        const typeValue = typeSelect.value;
        updateFloorOptionsForType(config, typeValue);

        const shouldShow = allowLocations && !!typeValue;
        const isHouseRemoval = serviceValue === 'House Removals';
        const isPianoTransport = serviceValue === 'Piano Transport';
        const hideFloor = (config.noFloorTypes || []).includes(typeValue)
            || isVehicleNoFloor;
        const hideRooms = (config.noRoomTypes || []).includes(typeValue)
            || (isPianoTransport && config.prefix === 'pickup')
            || config.prefix === 'pickup'
            || isVehicleNoFloor;
        const hideElevator = (config.noElevatorTypes || []).includes(typeValue) || isVehicleNoFloor;

        const floorSelect = config.floorSelectId ? document.getElementById(config.floorSelectId) : null;
        const floorSelected = floorSelect ? !!floorSelect.value : true;
        const showRoomBlock = shouldShow && !hideRooms;
        const allowRooms = shouldShow && !hideRooms && (!hideFloor && floorSelect ? floorSelected : true);

        if (config.prefix === 'pickup') {
            const showPianoType = isPianoTransport;
            const pianoGroup = document.getElementById('pickup-piano-type-group');
            const pianoHidden = document.getElementById('piano-type-hidden');
            if (pianoGroup) {
                pianoGroup.style.display = showPianoType ? '' : 'none';
            }
            if (pianoHidden) {
                setFieldRequired(pianoHidden, showPianoType);
                if (!showPianoType) {
                    pianoHidden.value = '';
                    clearFieldError(pianoHidden);
                    pianoHidden.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        const prevType = locationTypeState[config.prefix];
        const typeChanged = typeValue !== prevType;
        locationTypeState[config.prefix] = typeValue;

        if (showRoomBlock) {
            const roomList = config.roomListId ? document.getElementById(config.roomListId) : null;
            if (typeChanged || !roomList || roomList.children.length === 0) {
                resetRoomList(config);
            }
        }

        setLocationDetailsState(config, shouldShow, {
            showFloor: !hideFloor,
            showRooms: !hideRooms,
            showElevator: !hideElevator
        });

        if (isPianoTransport && config.prefix === 'delivery') {
            const details = document.getElementById(config.detailsId);
            if (details) {
                const itemInputs = details.querySelectorAll('.location-room-items');
                itemInputs.forEach((input) => {
                    const group = input.closest('.form-group');
                    if (group) group.style.display = 'none';
                    setFieldRequired(input, false);
                    input.value = '';
                    clearFieldError(input);
                });
            }
        }
    };

    const updateLocationDetails = () => {
        locationRoomConfigs.forEach((config) => {
            updateLocationDetailForConfig(config);
        });
        updateHouseInventoryVisibility();
    };

    function updateHouseInventoryVisibility() {
        const inventorySection = document.getElementById('house-removal-inventory-section');
        const serviceValue = document.getElementById('item-description-hidden')?.value || '';
        const isHouse = serviceValue === 'House Removals';
        const currentStep = document.body.dataset.formStep;

        document.body.classList.toggle('floor-block-mode', isHouse);
        setPickupFieldsOptional(isHouse);

        // Add or remove a class on body for House Removals
        if (isHouse) {
            document.body.classList.add('house-removals-active');
        } else {
            document.body.classList.remove('house-removals-active');
        }

        // Floor block section logic remains unchanged
        if (floorBlockSection) {
            floorBlockSection.style.display = 'none';
            floorBlockSection.classList.add('step-hidden');
        }
        if (isHouse && currentStep === '3' && floorBlockSection && floorBlockList) {
            floorBlockSection.style.display = 'block';
            floorBlockSection.classList.remove('step-hidden');
            if (floorBlockSection.dataset.blocksReady !== 'true') {
                resetFloorBlocks(serviceValue);
                initFloorBlockListeners();
                if (addFloorBlockBtn && addFloorBlockBtn.dataset.ready !== 'true') {
                    addFloorBlockBtn.addEventListener('click', () => {
                        addFloorBlock(serviceValue);
                    });
                    addFloorBlockBtn.dataset.ready = 'true';
                }
                floorBlockSection.dataset.blocksReady = 'true';
            }
            const firstBlock = floorBlockList.querySelector('.floor-block');
            if (firstBlock) {
                syncPickupFieldsFromFloorBlock(firstBlock);
            }
        }
    }

    const updateLocationSections = () => {
        if (document.body.classList.contains('single-form')) return;
        if (isMultiStopMode) return;
        const serviceValue = document.getElementById('item-description-hidden')?.value || '';
        const genericSection = document.getElementById('generic-floors-section');
        const deliverySection = document.getElementById('delivery-floors-section');
        const officeSection = document.getElementById('office-removal-floors-section');
        const officeDeliverySection = document.getElementById('office-delivery-floors-section');
        const illustrationPanel = document.querySelector('.floors-illustration-panel');
        if (!genericSection || !deliverySection) return;

        // If step mode is active, don't use inline styles - let step visibility handle it
        const formStepper = document.querySelector('.form-stepper');
        if (formStepper) {
            // In step mode, office removals hides the generic sections
            if (serviceValue === 'Office Removals') {
                genericSection.classList.add('office-hidden');
                deliverySection.classList.add('office-hidden');
                if (officeSection) officeSection.classList.remove('office-hidden');
                if (officeDeliverySection) officeDeliverySection.classList.remove('office-hidden');
            } else {
                genericSection.classList.remove('office-hidden');
                deliverySection.classList.remove('office-hidden');
                if (officeSection) officeSection.classList.add('office-hidden');
                if (officeDeliverySection) officeDeliverySection.classList.add('office-hidden');
            }
            // Don't override the display property in step mode
            return;
        }

        // Regular mode (no stepper)
        if (serviceValue === 'Office Removals') {
            genericSection.style.display = 'none';
            deliverySection.style.display = 'none';
            if (officeSection) officeSection.style.display = 'flex';
            if (officeDeliverySection) officeDeliverySection.style.display = 'flex';
            if (illustrationPanel) illustrationPanel.style.display = '';
            return;
        }

        genericSection.style.display = 'flex';
        deliverySection.style.display = 'flex';
        if (officeSection) officeSection.style.display = 'none';
        if (officeDeliverySection) officeDeliverySection.style.display = 'none';
        if (illustrationPanel) illustrationPanel.style.display = '';
    };

    if (!stepFlowReady) {
        applyServiceSelection(pendingServiceValue || cjHidden?.value || '');
    }

    const getFieldLabelText = (field, formEl) => {
        if (!field || !formEl) return '';
        let label = null;

        if (field.id) {
            label = formEl.querySelector(`label[for="${field.id}"]`);
        }

        if (!label) {
            label = field.closest('.form-group')?.querySelector('.form-label');
        }

        if (!label) {
            label = field.closest('.card-section')?.querySelector('.form-label');
        }

        if (!label && field.type === 'hidden') {
            label = field.closest('.custom-dropdown-wrapper')?.closest('.form-group')?.querySelector('.form-label');
        }

        if (!label) return '';

        const clone = label.cloneNode(true);
        const required = clone.querySelector('.required-text');
        if (required) required.remove();

        let text = clone.textContent || '';
        text = text.replace(/\s+/g, ' ').trim();
        if (text.endsWith(':')) {
            text = text.slice(0, -1).trim();
        }
        return text;
    };

    const getRequiredMessage = (field, formEl) => {
        if (!field) {
            return 'Please fill out all required fields highlighted below.';
        }

        if (field.id === 'item-description-hidden') {
            return 'Please choose what you are moving.';
        }

        const labelText = getFieldLabelText(field, formEl);
        if (!labelText) {
            return 'Please fill out all required fields highlighted below.';
        }

        let verb = 'enter';
        if (field.tagName === 'SELECT' || field.type === 'hidden') {
            verb = 'choose';
        } else if (field.type === 'date') {
            verb = 'select';
        }

        return `Please ${verb} ${labelText}.`;
    };

    const getInlineRequiredMessage = (field, formEl) => {
        if (!field) return '';
        if (field.id === 'item-description-hidden') {
            return 'Choose what you are moving.';
        }

        let labelText = getFieldLabelText(field, formEl);
        if (!labelText) {
            labelText = field.getAttribute('placeholder') || 'this field';
        }

        let verb = 'enter';
        if (field.tagName === 'SELECT' || field.type === 'hidden') {
            verb = 'choose';
        } else if (field.type === 'date') {
            verb = 'select';
        }

        return `${verb.charAt(0).toUpperCase() + verb.slice(1)} ${labelText}.`;
    };

    const validateRequiredFields = (formEl) => {
        const requiredFields = Array.from(formEl.querySelectorAll('[data-required="true"]'));
        let firstInvalid = null;

        requiredFields.forEach((field) => {
            if (!isElementVisible(field)) {
                clearFieldError(field);
                clearInlineError(field);
                return;
            }

            let hasValue = true;
            if (field.type === 'checkbox' || field.type === 'radio') {
                hasValue = field.checked;
            } else {
                hasValue = !!field.value && field.value.trim().length > 0;
            }

            if (!hasValue) {
                markFieldError(field);
                setInlineError(field, getInlineRequiredMessage(field, formEl));
                if (field.id === 'item-description-hidden') {
                    const serviceGrid = document.getElementById('service-icon-grid');
                    markFieldError(serviceGrid);
                }
                if (field.type === 'hidden') {
                    const wrapperToggle = field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle');
                    markFieldError(wrapperToggle);
                }
                if (!firstInvalid) firstInvalid = field;
            } else {
                clearFieldError(field);
                clearInlineError(field);
                if (field.id === 'item-description-hidden') {
                    const serviceGrid = document.getElementById('service-icon-grid');
                    clearFieldError(serviceGrid);
                }
                if (field.type === 'hidden') {
                    const wrapperToggle = field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle');
                    clearFieldError(wrapperToggle);
                }
            }
        });

        // Inline messages handle all required errors.

        return firstInvalid;
    };

    const getScrollTargetForField = (field) => {
        if (!field) return null;
        if (field.id === 'item-description-hidden') {
            return document.getElementById('service-icon-grid');
        }
        if (field.classList.contains('location-nav-select')) {
            const nav = document.querySelector(`.location-nav[data-nav-for="${field.id}"]`);
            if (nav) return nav;
        }
        if (field.type === 'hidden' && field.id) {
            const optionNav = document.querySelector(`.option-nav[data-option-nav-for="${field.id}"]`);
            if (optionNav) return optionNav;
        }
        if (field.type === 'hidden') {
            return field.closest('.custom-dropdown-wrapper')?.querySelector('.dropdown-toggle') || field;
        }
        return field;
    };

    const scrollToField = (field) => {
        const target = getScrollTargetForField(field);
        if (!target || typeof target.scrollIntoView !== 'function') return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const progressiveContainer = document.querySelector('.form-v2-main');
    const progressiveBlocks = progressiveContainer ? Array.from(progressiveContainer.children) : [];

    const isFieldVisible = (field) => {
        if (!field) return false;
        if (field.type === 'hidden') return true;
        return field.offsetParent !== null;
    };

    const isFieldComplete = (field) => {
        if (field.disabled) return true;
        if (field.type === 'checkbox' || field.type === 'radio') {
            return field.checked;
        }
        return !!field.value && field.value.trim().length > 0;
    };

    const isBlockComplete = (block) => {
        if (!block) return true;

        if (block.id === 'house-removal-inventory-section') {
            const hasRooms = typeof window.getSelectedHouseRooms === 'function'
                ? window.getSelectedHouseRooms().length > 0
                : false;
            if (!hasRooms) {
                return false;
            }
        }

        const requiredFields = Array.from(block.querySelectorAll('[data-required="true"]'))
            .filter((field) => isFieldVisible(field));

        if (requiredFields.length === 0) return true;
        return requiredFields.every(isFieldComplete);
    };

    const updateProgressiveFlow = () => {
        if (!progressiveContainer || progressiveBlocks.length === 0) return;
        if (document.body.classList.contains('single-form')) {
            progressiveBlocks.forEach((block) => block.classList.remove('progressive-hidden'));
            return;
        }
        if (document.getElementById('form-stepper')) {
            progressiveBlocks.forEach((block) => {
                block.classList.remove('progressive-hidden');
            });
            return;
        }
        let allowShow = true;
        const serviceValue = document.getElementById('item-description-hidden')?.value || '';
        const vehicleNoFloorCategories = new Set([
            'Car Transport',
            'Motorbike Transport',
            'Trailers & Campervans Transport',
            'Vehicle Parts',
            'Boats'
        ]);
        const floorSectionIds = new Set([
            'generic-floors-section',
            'delivery-floors-section',
            'office-removal-floors-section',
            'office-delivery-floors-section'
        ]);
        const skipLocationGate = vehicleNoFloorCategories.has(serviceValue);
        const inventorySection = document.getElementById('house-removal-inventory-section');
        const officeInventorySection = document.getElementById('office-removal-inventory-section');
        if (inventorySection) {
            inventorySection.style.display = serviceValue === 'House Removals' ? 'block' : 'none';
        }
        if (officeInventorySection) {
            officeInventorySection.style.display = serviceValue === 'Office Removals' ? 'block' : 'none';
        }
        progressiveBlocks.forEach((block) => {
            if (block.hasAttribute('data-skip-progressive')) {
                return;
            }
            if (block.id === 'generic-additional-info-section') {
                block.classList.remove('progressive-hidden');
                return;
            }
            if (floorSectionIds.has(block.id) && skipLocationGate) {
                block.classList.remove('progressive-hidden');
                const pickupType = document.getElementById('pickup-location-type')?.value || '';
                const deliveryType = document.getElementById('delivery-location-type')?.value || '';
                if (!pickupType || !deliveryType) {
                    allowShow = false;
                }
                return;
            }
            if (block.id === 'house-removal-inventory-section' && serviceValue === 'House Removals') {
                block.classList.remove('progressive-hidden');
                if (!isBlockComplete(block)) {
                    allowShow = false;
                }
                return;
            }
            if (block.id === 'office-removal-inventory-section' && serviceValue === 'Office Removals') {
                block.classList.remove('progressive-hidden');
                if (!isBlockComplete(block)) {
                    allowShow = false;
                }
                return;
            }
            if (block.style.display === 'none') {
                block.classList.add('progressive-hidden');
                return;
            }

            if (allowShow) {
                block.classList.remove('progressive-hidden');
                if (!isBlockComplete(block)) {
                    allowShow = false;
                }
            } else {
                block.classList.add('progressive-hidden');
            }
        });
    };

    window.updateProgressiveFlow = updateProgressiveFlow;
    if (quoteForm) {
        if (isMultiStopMode) {
            initMultiStopMode();
        }
        setupOptionNavs();
        setupLocationNavs();
        applyRequiredRules();
        updateLocationSections();
        updateProgressiveFlow();

        if (isSingleForm) {
            initFloorBlockListeners();
            if (addFloorBlockBtn && addFloorBlockBtn.dataset.ready !== 'true') {
                addFloorBlockBtn.addEventListener('click', () => {
                    const serviceValue = document.getElementById('item-description-hidden')?.value || '';
                    if (!shouldShowFloorBlocks(serviceValue)) return;
                    addFloorBlock(serviceValue);
                });
                addFloorBlockBtn.dataset.ready = 'true';
            }
            resetFloorBlocks(document.getElementById('item-description-hidden')?.value || '');

            document.addEventListener('change', (event) => {
                if (!document.body.classList.contains('single-form')) return;
                const target = event.target;
                if (!target || !(target instanceof HTMLSelectElement)) return;
                if (!target.closest('.floor-block')) return;
                if (target.classList.contains('multi-stop-location-type')) {
                    const card = target.closest('.floor-block');
                    if (!card) return;
                    updateMultiStopFloorOptions(card, target.value);
                    updateMultiStopLocationDetails(card, target.value);
                    const details = card.querySelector('[data-location-group$="details"] .location-details')
                        || card.querySelector('.location-details');
                    if (details) details.classList.add('is-visible');
                    const floorGroup = card.querySelector('.floor-group');
                    const floorSelect = card.querySelector('.multi-stop-floor');
                    if (floorGroup) floorGroup.style.display = '';
                    if (floorSelect) floorSelect.disabled = false;
                }
            });
        }

        locationRoomConfigs.forEach((config) => {
            resetRoomList(config);

            const typeSelect = document.getElementById(config.typeSelectId);
            if (typeSelect) {
                typeSelect.addEventListener('change', () => {
                    updateLocationDetails();
                    applyRequiredRules();

                    if (config.prefix === 'pickup' && floorBlockList) {
                        const serviceValue = document.getElementById('item-description-hidden')?.value || '';
                        if (serviceValue === 'House Removals' || serviceValue === 'Office Removals') {
                            const firstBlock = floorBlockList.querySelector('.floor-block');
                            if (firstBlock) {
                                const blockType = firstBlock.querySelector('.multi-stop-location-type');
                                const newValue = typeSelect.value || '';
                                if (blockType && blockType.value !== newValue) {
                                    blockType.value = newValue;
                                    updateMultiStopFloorOptions(firstBlock, newValue);
                                    updateMultiStopLocationDetails(firstBlock, newValue);
                                    const nav = firstBlock.querySelector('.location-type-nav[data-nav-for]');
                                    if (nav) {
                                        const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
                                        buttons.forEach((btn) => {
                                            const isActive = btn.getAttribute('data-value') === newValue;
                                            btn.classList.toggle('is-active', isActive);
                                            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
                                        });
                                    }
                                    syncFloorBlockTypeLocks(newValue);
                                }
                            }
                        }
                    }
                });
            }

            const floorSelect = config.floorSelectId ? document.getElementById(config.floorSelectId) : null;
            if (floorSelect) {
                floorSelect.addEventListener('change', () => {
                    updateLocationDetailForConfig(config);
                    updateHouseInventoryVisibility();
                    applyRequiredRules();
                });
            }

            const addButton = document.getElementById(config.addButtonId);
            if (addButton) {
                addButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    createRoomEntry(config, true);
                    setupOptionNavs();
                    applyRequiredRules();
                });
            }
        });

        updateLocationDetails();

        const collectFloorBlocks = () => {
            if (!floorBlockList) return [];
            const blocks = Array.from(floorBlockList.querySelectorAll('.floor-block'));
            return blocks.map((block, index) => {
                const stopId = block.dataset.stopId;
                const houseState = stopId ? multiStopHouseState[stopId] : null;
                const officeState = stopId ? multiStopOfficeState[stopId] : null;
                return {
                    index: index + 1,
                    locationType: block.querySelector('.multi-stop-location-type')?.value.trim() || '',
                    floor: block.querySelector('.multi-stop-floor')?.value.trim() || '',
                    elevator: block.querySelector('.multi-stop-elevator')?.value.trim() || '',
                    houseInventory: houseState ? {
                        selectedRooms: Array.from(houseState.selectedRooms || []),
                        items: houseState.quantities || {},
                        subRoomQuantities: houseState.subRoomQuantities || {},
                        customItems: block.querySelector('.multi-stop-house-custom')?.value.trim() || '',
                        extraItems: block.querySelector('.multi-stop-house-extra')?.value.trim() || ''
                    } : null,
                    officeInventory: officeState ? {
                        category: officeState.category || '',
                        items: officeState.quantities || {},
                        customItems: block.querySelector('.multi-stop-office-custom')?.value.trim() || ''
                    } : null
                };
            });
        };

        quoteForm.addEventListener('input', (e) => {
            const target = e.target;
            if (target && target.matches('[data-required="true"]')) {
                clearFieldError(target);
                clearInlineError(target);
            }
            updateProgressiveFlow();
            if (typeof window.updateFormSummary === 'function') {
                window.updateFormSummary();
            }
        });

        quoteForm.addEventListener('change', () => {
            updateProgressiveFlow();
            if (typeof window.updateFormSummary === 'function') {
                window.updateFormSummary();
            }
        });

        quoteForm.addEventListener('submit', function(e) {

            e.preventDefault();

            applyRequiredRules();
            const firstInvalidField = validateRequiredFields(quoteForm);
            if (firstInvalidField) {
                scrollToField(firstInvalidField);
                const serviceGrid = document.getElementById('service-icon-grid');
                if (firstInvalidField.id === 'item-description-hidden' && serviceGrid) {
                    markFieldError(serviceGrid);
                    serviceGrid.querySelector('.service-icon-btn')?.focus();
                } else if (typeof firstInvalidField.focus === 'function') {
                    firstInvalidField.focus();
                }
                return;
            }

            // Collect form data
            const items = Array.from(document.querySelectorAll('#items-list .item-entry')).map((entry) => {
                const getNum = (sel) => {
                    const el = entry.querySelector(sel);
                    const v = el && el.value !== '' ? parseFloat(el.value) : null;
                    return isNaN(v) ? null : v;
                };
                const getVal = (sel) => {
                    const el = entry.querySelector(sel);
                    return el ? el.value : '';
                };
                const getPhotoCount = () => {
                    const el = entry.querySelector('.item-photos');
                    return el && el.files ? el.files.length : 0;
                };
                return {
                    name: getVal('.item-name').trim(),
                    width: getNum('.item-width'),
                    widthUnit: getVal('.width-unit') || 'cm',
                    depth: getNum('.item-depth'),
                    depthUnit: getVal('.depth-unit') || 'cm',
                    height: getNum('.item-height'),
                    heightUnit: getVal('.height-unit') || 'cm',
                    weight: getNum('.item-weight'),
                    weightUnit: getVal('.weight-unit') || 'kg',
                    quantity: (() => {
                        const qEl = entry.querySelector('.item-quantity');
                        const q = qEl && qEl.value !== '' ? parseInt(qEl.value) : 1;
                        return isNaN(q) ? 1 : q;
                    })(),
                    notes: getVal('.item-notes').trim(),
                    photoCount: getPhotoCount()
                };
            }).filter(i => i.name || i.width || i.depth || i.height || i.weight);

            const firstItemName = items[0]?.name || '';

            // Get house removal inventory if it exists
            const houseInventory = localStorage.getItem('house_removal_inventory');
            const houseInventoryData = houseInventory ? JSON.parse(houseInventory) : null;

            // Helper function to safely get element value
            const getElementValue = (id) => {
                const element = document.getElementById(id);
                return element ? element.value : '';
            };

            const quoteData = {
                itemType: 'multiple',
                itemDescription: firstItemName,
                items,
                houseInventory: houseInventoryData, // Include house inventory if available
                floorBlocks: collectFloorBlocks(),
                pickupAddress: getElementValue('pickup-address'),
                pickupCity: getElementValue('pickup-city'),
                pickupPostcode: getElementValue('pickup-postcode'),
                deliveryAddress: getElementValue('delivery-address'),
                deliveryCity: getElementValue('delivery-city'),
                deliveryPostcode: getElementValue('delivery-postcode'),
                preferredDate: getElementValue('preferred-date'),
                preferredTime: getElementValue('preferred-time'),
                timeFlexibility: getElementValue('time-flexibility'),
                instructions: getElementValue('instructions'),
                customerName: getElementValue('customer-name'),
                customerEmail: getElementValue('customer-email'),
                customerPhone: getElementValue('customer-phone'),
                routeDistanceKm: parseFloat(getElementValue('route-distance-km')) || null,
                routeDurationText: getElementValue('route-duration-text'),
                submittedAt: new Date().toISOString()
            };

            // Validate only essential form data (not user fields since they're from auth)
            const itemTypeValue = getElementValue('item-description-hidden');
            if (!itemTypeValue) {
                const itemTypeField = document.getElementById('item-description-hidden');
                if (itemTypeField) {
                    markFieldError(itemTypeField);
                    setInlineError(itemTypeField, getInlineRequiredMessage(itemTypeField, quoteForm));
                    scrollToField(itemTypeField);
                }
                return;
            }

            if (isMultiStopMode) {
                const stops = collectMultiStopStops();
                if (stops.length < 2) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = 'Please add at least two stops.';
                        formErrorSummary.style.display = 'block';
                    }
                    document.getElementById('multi-stop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                const vehicleCategories = new Set([
                    'Car Transport',
                    'Motorbike Transport',
                    'Trailers & Campervans Transport',
                    'Vehicle Parts',
                    'Boats'
                ]);
                const invalidStop = stops.find((stop) => {
                    if (!stop.category || !stop.address || !stop.city) return true;
                    if (vehicleCategories.has(stop.category)) return false;
                    if (!stop.locationType) return true;
                    const noFloorTypes = new Set(['warehouse']);
                    const hideFloor = noFloorTypes.has(stop.locationType)
                        || (stop.category === 'House Removals' && (stop.locationType === 'house' || stop.locationType === 'bungalow'));
                    return !hideFloor && !stop.floor;
                });
                if (invalidStop) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = `Please complete all required fields for stop ${invalidStop.index}.`;
                        formErrorSummary.style.display = 'block';
                    }
                    document.getElementById('multi-stop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                const missingHouseInventory = stops.find((stop) => stop.category === 'House Removals' && (!stop.houseInventory || (!Object.values(stop.houseInventory.items || {}).some((qty) => qty > 0) && !stop.houseInventory.customItems && !stop.houseInventory.extraItems)));
                if (missingHouseInventory) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = `Please add at least one house inventory item for stop ${missingHouseInventory.index}.`;
                        formErrorSummary.style.display = 'block';
                    }
                    document.getElementById('multi-stop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                const missingOfficeInventory = stops.find((stop) => stop.category === 'Office Removals' && (!stop.officeInventory || (!Object.values(stop.officeInventory.items || {}).some((qty) => qty > 0) && !stop.officeInventory.customItems)));
                if (missingOfficeInventory) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = `Please add at least one office inventory item for stop ${missingOfficeInventory.index}.`;
                        formErrorSummary.style.display = 'block';
                    }
                    document.getElementById('multi-stop-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                quoteData.multiStop = true;
                quoteData.stops = stops;
                quoteData.itemType = 'multi-stop';
                quoteData.itemDescription = stops[0]?.category || 'Multi-stop move';
            }

            if (!isMultiStopMode && itemTypeValue === 'House Removals') {
                if (isSingleForm) {
                    const blocks = collectFloorBlocks();
                    if (blocks.length === 0) {
                        if (formErrorSummary) {
                            formErrorSummary.textContent = 'Please add at least one floor and inventory block.';
                            formErrorSummary.style.display = 'block';
                        }
                        document.getElementById('floor-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }

                    const hasItemsForBlock = (block) => {
                        const inventory = block.houseInventory || {};
                        const baseItems = Object.values(inventory.items || {}).some((qty) => qty > 0);
                        const subRoomItems = Object.values(inventory.subRoomQuantities || {}).some((roomMap) => {
                            return Object.values(roomMap || {}).some((itemMap) => {
                                return Object.values(itemMap || {}).some((qty) => qty > 0);
                            });
                        });
                        const hasCustom = !!inventory.customItems || !!inventory.extraItems;
                        return baseItems || subRoomItems || hasCustom;
                    };

                    const invalidBlock = blocks.find((block) => {
                        const inventory = block.houseInventory || {};
                        const roomsSelected = (inventory.selectedRooms || []).length > 0;
                        return !roomsSelected || !hasItemsForBlock(block);
                    });

                    if (invalidBlock) {
                        if (formErrorSummary) {
                            formErrorSummary.textContent = `Please add at least one house inventory item for floor ${invalidBlock.index}.`;
                            formErrorSummary.style.display = 'block';
                        }
                        document.getElementById('floor-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }
                } else {
                const selectedRooms = typeof window.getSelectedHouseRooms === 'function'
                    ? window.getSelectedHouseRooms()
                    : [];
                if (!selectedRooms || selectedRooms.length === 0) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = 'Please select at least one room.';
                        formErrorSummary.style.display = 'block';
                    }
                    const roomTabs = document.getElementById('room-tabs');
                    if (roomTabs) roomTabs.classList.add('is-required');
                    const roomError = document.getElementById('room-selection-error');
                    if (roomError) roomError.style.display = 'block';
                    document.getElementById('house-removal-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                const roomTabs = document.getElementById('room-tabs');
                if (roomTabs) roomTabs.classList.remove('is-required');
                const roomError = document.getElementById('room-selection-error');
                if (roomError) roomError.style.display = 'none';

                const quantities = typeof itemQuantities !== 'undefined' ? itemQuantities : {};
                const hasItems = Object.values(quantities).some(qty => qty > 0);
                const customItems = document.getElementById('custom-items-textarea')?.value.trim() || '';
                const extraItems = document.getElementById('extra-items-textarea')?.value.trim() || '';

                if (!hasItems && !customItems && !extraItems) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = 'Please add at least one house removal item.';
                        formErrorSummary.style.display = 'block';
                    }
                    setRequiredTextState('house-inventory', true);
                    setInventoryHighlight('house-removal-inventory-section', true);
                    document.getElementById('house-removal-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                setRequiredTextState('house-inventory', false);
                setInventoryHighlight('house-removal-inventory-section', false);
                }
            }

            if (!isMultiStopMode && itemTypeValue === 'Office Removals') {
                if (isSingleForm) {
                    const blocks = collectFloorBlocks();
                    if (blocks.length === 0) {
                        if (formErrorSummary) {
                            formErrorSummary.textContent = 'Please add at least one floor and inventory block.';
                            formErrorSummary.style.display = 'block';
                        }
                        document.getElementById('floor-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }

                    const missingOffice = blocks.find((block) => {
                        const inventory = block.officeInventory || {};
                        const hasItems = Object.values(inventory.items || {}).some((qty) => qty > 0);
                        const hasCustom = !!inventory.customItems;
                        return !hasItems && !hasCustom;
                    });

                    if (missingOffice) {
                        if (formErrorSummary) {
                            formErrorSummary.textContent = `Please add at least one office inventory item for floor ${missingOffice.index}.`;
                            formErrorSummary.style.display = 'block';
                        }
                        document.getElementById('floor-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        return;
                    }
                } else {
                const officeQuantities = window.officeItemQuantities || {};
                const hasOfficeItems = Object.values(officeQuantities).some(qty => qty > 0);
                const officeCustom = document.getElementById('office-custom-items-description')?.value.trim() || '';

                if (!hasOfficeItems && !officeCustom) {
                    if (formErrorSummary) {
                        formErrorSummary.textContent = 'Please add at least one office inventory item.';
                        formErrorSummary.style.display = 'block';
                    }
                    setRequiredTextState('office-inventory', true);
                    setInventoryHighlight('office-removal-inventory-section', true);
                    document.getElementById('office-removal-inventory-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    return;
                }
                setRequiredTextState('office-inventory', false);
                setInventoryHighlight('office-removal-inventory-section', false);
                }
            }

            // Check if user is logged in AFTER validation
            if (typeof auth === 'undefined' || !auth.isLoggedIn()) {
                // Save quote data temporarily
                localStorage.setItem('pending_quote_submission', JSON.stringify(quoteData));
                localStorage.setItem('pending_quote_data', JSON.stringify(quoteData));
                
                // Show login modal with notice
                const loginModal = document.getElementById('login-modal');
                const loginNotice = document.getElementById('login-modal-notice');
                
                if (loginModal) {
                    // Show the notice
                    if (loginNotice) {
                        loginNotice.style.display = 'block';
                    }
                    // Add show class to display modal
                    loginModal.classList.add('show');
                    // Ensure it's visible by setting z-index high
                    loginModal.style.zIndex = '9999';
                } else {
                    // Fallback if modal not on page
                    alert('Please log in or sign up to submit your quote request');
                    window.location.href = 'index.html#login';
                }
                return;
            }

            // Get user information from auth
            const currentUser = auth.getUser();
            
            // Add user information to quote data
            quoteData.customerName = currentUser.name;
            quoteData.customerEmail = currentUser.email;
            quoteData.customerPhone = currentUser.phone || '';

            // For "Other" service type, special instructions are mandatory
            if (!isMultiStopMode && itemTypeValue === 'Other') {
                const specialInstructions = document.getElementById('generic-special-instructions');
                if (!specialInstructions || !specialInstructions.value.trim()) {
                    if (specialInstructions) {
                        markFieldError(specialInstructions);
                        setInlineError(specialInstructions, getInlineRequiredMessage(specialInstructions, quoteForm));
                        scrollToField(specialInstructions);
                        specialInstructions.focus();
                    }
                    return;
                }
            }

            // Save request to localStorage (in production, this would send to server)
            const requests = JSON.parse(localStorage.getItem('anytransport_quote_requests') || '[]');
            quoteData.id = Math.random().toString(36).substr(2, 9);
            quoteData.status = 'pending'; // Awaiting quote from AnyTransport
            quoteData.userId = auth.getUser().id; // Link to user
            requests.push(quoteData);
            localStorage.setItem('anytransport_quote_requests', JSON.stringify(requests));
            
            // Clear house inventory data after submission
            localStorage.removeItem('house_removal_inventory');
            
            // Set flag for pending quote submission
            localStorage.setItem('pending_quote_submission', 'true');

            // Show confirmation modal
            showConfirmationModal();
        });
    }

    // Set minimum date to today
    const dateInput = document.getElementById('move-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }

    // Route editor toggle
    const routeEditBtn = document.getElementById('route-edit-btn');
    const routeEditor = document.getElementById('route-editor');
    if (routeEditBtn && routeEditor) {
        routeEditBtn.addEventListener('click', () => {
            routeEditor.classList.toggle('open');
            if (routeEditor.classList.contains('open')) {
                const pickupInput = document.getElementById('pickup-address');
                if (pickupInput) pickupInput.focus();
            }
        });
    }

    // Initialize Mapbox map
    initRoutePlanner();
});

// Helper functions for service-specific forms
function setupMandatoryAdditionalInfoForm() {
    const genericSection = document.getElementById('generic-additional');
    const genericTitle = document.querySelector('#generic-additional .collapsible-title');
    const specialInstructions = document.getElementById('generic-special-instructions');
    const specialInstructionsRequiredText = document.querySelector('[data-required-for="generic-special-instructions"]');
    
    if (genericTitle) {
        // Update title to remove "Optional"
        genericTitle.textContent = 'Additional information';
    }
    
    if (genericSection) {
        genericSection.classList.remove('expanded');
    }

    if (specialInstructions) {
        specialInstructions.setAttribute('data-required', 'true');
        specialInstructions.setAttribute('aria-required', 'true');
    }

    if (specialInstructionsRequiredText) {
        specialInstructionsRequiredText.style.display = 'inline';
    }
}

function resetMandatoryAdditionalInfoForm() {
    const genericSection = document.getElementById('generic-additional');
    const genericTitle = document.querySelector('#generic-additional .collapsible-title');
    const specialInstructions = document.getElementById('generic-special-instructions');
    const specialInstructionsRequiredText = document.querySelector('[data-required-for="generic-special-instructions"]');
    
    if (genericTitle) {
        // Reset title to optional
        genericTitle.textContent = 'Additional information - (Optional)';
    }
    
    if (genericSection) {
        genericSection.classList.remove('expanded');
    }

    if (specialInstructions) {
        specialInstructions.removeAttribute('data-required');
        specialInstructions.removeAttribute('aria-required');
        specialInstructions.removeAttribute('aria-invalid');
        specialInstructions.classList.remove('input-error');
    }

    if (specialInstructionsRequiredText) {
        specialInstructionsRequiredText.style.display = 'none';
        specialInstructionsRequiredText.classList.remove('required-text--active');
    }
}

function showManpowerSection() {
    const manpowerSection = document.getElementById('manpower-job-description-section');
    if (manpowerSection) {
        manpowerSection.style.display = 'block';
    }
}

function hideManpowerSection() {
    const manpowerSection = document.getElementById('manpower-job-description-section');
    if (manpowerSection) {
        manpowerSection.style.display = 'none';
    }
}

function showOtherSection() {
    const otherSection = document.getElementById('other-job-description-section');
    if (otherSection) {
        otherSection.style.display = 'block';
    }
}

function hideOtherSection() {
    const otherSection = document.getElementById('other-job-description-section');
    if (otherSection) {
        otherSection.style.display = 'none';
    }
}

function showOfficeRemovalSection() {
    const officeInventorySection = document.getElementById('office-removal-inventory-section');
    const officeMoveDateSection = document.getElementById('office-move-date-section');
    const officeFloorsSection = document.getElementById('office-removal-floors-section');
    const officeDeliveryFloorsSection = document.getElementById('office-delivery-floors-section');
    const officeDescSection = document.getElementById('office-removal-description-section');
    const genericFloorsSection = document.getElementById('generic-floors-section');
    const deliveryFloorsSection = document.getElementById('delivery-floors-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    const formGrid = document.querySelector('.form-v2-grid');
    const formStepper = document.getElementById('form-stepper');
    if (officeInventorySection) {
        officeInventorySection.style.display = 'block';
    }
    if (officeMoveDateSection) {
        officeMoveDateSection.style.display = 'block';
    }
    if (officeFloorsSection) {
        officeFloorsSection.style.display = formStepper ? '' : 'flex';
        officeFloorsSection.classList.remove('office-hidden');
    }
    if (officeDeliveryFloorsSection) {
        officeDeliveryFloorsSection.style.display = formStepper ? '' : 'flex';
        officeDeliveryFloorsSection.classList.remove('office-hidden');
    }
    if (officeDescSection) {
        officeDescSection.style.display = 'none';
    }
    if (genericFloorsSection) {
        genericFloorsSection.style.display = formStepper ? '' : 'none';
        genericFloorsSection.classList.add('office-hidden');
    }
    if (deliveryFloorsSection) {
        deliveryFloorsSection.style.display = formStepper ? '' : 'none';
        deliveryFloorsSection.classList.add('office-hidden');
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = '';
    }
    if (formGrid && !document.body.classList.contains('single-form')) {
        formGrid.classList.add('office-layout');
    }
    // Initialize office inventory
    setupOfficeInventoryTabs();
    renderOfficeInventory();
}

function hideOfficeRemovalSection() {
    const officeInventorySection = document.getElementById('office-removal-inventory-section');
    const officeMoveDateSection = document.getElementById('office-move-date-section');
    const officeFloorsSection = document.getElementById('office-removal-floors-section');
    const officeDeliveryFloorsSection = document.getElementById('office-delivery-floors-section');
    const officeDescSection = document.getElementById('office-removal-description-section');
    const genericFloorsSection = document.getElementById('generic-floors-section');
    const deliveryFloorsSection = document.getElementById('delivery-floors-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    const formGrid = document.querySelector('.form-v2-grid');
    const formStepper = document.getElementById('form-stepper');
    if (officeInventorySection) {
        officeInventorySection.style.display = 'none';
    }
    if (officeMoveDateSection) {
        officeMoveDateSection.style.display = 'none';
    }
    if (officeFloorsSection) {
        officeFloorsSection.style.display = formStepper ? '' : 'none';
        officeFloorsSection.classList.add('office-hidden');
    }
    if (officeDeliveryFloorsSection) {
        officeDeliveryFloorsSection.style.display = formStepper ? '' : 'none';
        officeDeliveryFloorsSection.classList.add('office-hidden');
    }
    if (officeDescSection) {
        officeDescSection.style.display = 'none';
    }
    if (genericFloorsSection) {
        genericFloorsSection.style.display = formStepper ? '' : 'flex';
        genericFloorsSection.classList.remove('office-hidden');
    }
    if (deliveryFloorsSection) {
        deliveryFloorsSection.style.display = formStepper ? '' : 'flex';
        deliveryFloorsSection.classList.remove('office-hidden');
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = '';
    }
    if (formGrid) {
        formGrid.classList.remove('office-layout');
    }
}

function showBoatsSection() {
    const boatsSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (boatsSection) {
        boatsSection.style.display = 'block';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function hideBoatsSection() {
    const boatsSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (boatsSection) {
        boatsSection.style.display = 'none';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function showClearanceSection() {
    const clearanceSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (clearanceSection) {
        clearanceSection.style.display = 'block';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'none';
    }
}

function hideClearanceSection() {
    const clearanceSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (clearanceSection) {
        clearanceSection.style.display = 'none';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function showFreightSection() {
    const freightSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (freightSection) {
        freightSection.style.display = 'block';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'none';
    }
}

function hideFreightSection() {
    const freightSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (freightSection) {
        freightSection.style.display = 'none';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function showVehiclePartsSection() {
    const vehiclePartsSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (vehiclePartsSection) {
        vehiclePartsSection.style.display = 'block';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function hideVehiclePartsSection() {
    const vehiclePartsSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (vehiclePartsSection) {
        vehiclePartsSection.style.display = 'none';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function showPackagingSection() {
    const packagingSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (packagingSection) {
        packagingSection.style.display = 'block';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function hidePackagingSection() {
    const packagingSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (packagingSection) {
        packagingSection.style.display = 'none';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function showSpecialistAntiquesSection() {
    const specialistSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (specialistSection) {
        specialistSection.style.display = 'block';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function hideSpecialistAntiquesSection() {
    const specialistSection = document.getElementById('office-removal-description-section');
    const deliveryLocationCol = document.getElementById('delivery-location-col');
    if (specialistSection) {
        specialistSection.style.display = 'none';
    }
    if (deliveryLocationCol) {
        deliveryLocationCol.style.display = 'block';
    }
}

function showMotorbikeTransportSection() {
    const motorbikeSection = document.getElementById('motorbike-transport-section');
    if (motorbikeSection) {
        motorbikeSection.style.display = 'block';
    }
}

function hideMotorbikeTransportSection() {
    const motorbikeSection = document.getElementById('motorbike-transport-section');
    if (motorbikeSection) {
        motorbikeSection.style.display = 'none';
    }
}

function showTrailerCampervanSection() {
    const trailerCampervanSection = document.getElementById('trailer-campervan-section');
    if (trailerCampervanSection) {
        trailerCampervanSection.style.display = 'block';
    }
}

function hideTrailerCampervanSection() {
    const trailerCampervanSection = document.getElementById('trailer-campervan-section');
    if (trailerCampervanSection) {
        trailerCampervanSection.style.display = 'none';
    }
}

function showPianoDeliverySection() {
    const pianoSection = document.getElementById('piano-delivery-section');
    if (pianoSection) {
        pianoSection.style.display = 'block';
    }
}

function hidePianoDeliverySection() {
    const pianoSection = document.getElementById('piano-delivery-section');
    if (pianoSection) {
        pianoSection.style.display = 'none';
    }
}

function initMultiStopMode() {
    document.body.classList.add('multi-stop-mode');

    const formTitle = document.querySelector('.form-title');
    if (formTitle) {
        formTitle.textContent = 'Multiple Stops Move';
    }

    const multiStopSection = document.getElementById('multi-stop-section');
    const serviceSection = document.getElementById('service-selection-section');
    const hiddenService = document.getElementById('item-description-hidden');

    if (multiStopSection) multiStopSection.style.display = 'block';
    if (serviceSection) serviceSection.style.display = 'none';

    if (hiddenService) {
        hiddenService.value = 'Multi-stop';
        hiddenService.setAttribute('data-optional', 'true');
        hiddenService.removeAttribute('data-required');
        hiddenService.removeAttribute('aria-required');
        hiddenService.classList.remove('input-error');
        hiddenService.removeAttribute('aria-invalid');
        const requiredText = document.querySelectorAll('[data-required-for="item-description-hidden"]');
        requiredText.forEach((node) => node.classList.remove('required-text--active'));
        const inlineError = document.querySelector('.field-error-message[data-error-for="item-description-hidden"]');
        if (inlineError) inlineError.remove();
    }

    const stopList = document.getElementById('multi-stop-list');
    const mapAddressWrap = document.getElementById('multi-stop-map-addresses');
    const mapAddressList = document.getElementById('multi-stop-map-list');
    const headerAddBtn = document.getElementById('multi-stop-add-btn');
    if (stopList && stopList.children.length === 0) {
        addMultiStopCard('pickup');
        addMultiStopCard('delivery');
    }

    if (mapAddressWrap) {
        mapAddressWrap.style.display = 'block';
    }

    if (headerAddBtn) {
        headerAddBtn.style.display = 'none';
    }

    if (stopList && stopList.dataset.listenersReady !== 'true') {
        stopList.addEventListener('pointerdown', handleMultiStopOptionNavCapture, true);
        stopList.addEventListener('click', handleMultiStopListClick);
        stopList.addEventListener('input', handleMultiStopListInput);
        stopList.addEventListener('change', handleMultiStopListInput);
        stopList.dataset.listenersReady = 'true';
    }

    if (stopList) {
        let addRow = document.getElementById('multi-stop-add-row');
        if (!addRow) {
            addRow = document.createElement('div');
            addRow.className = 'multi-stop-add-row';
            addRow.id = 'multi-stop-add-row';
            stopList.appendChild(addRow);
        }
        addRow.innerHTML = `
            <button type="button" class="btn btn-outline multi-stop-add-btn" data-action="stop">Add another stop</button>
        `;
    }

    if (mapAddressList && mapAddressList.dataset.listenersReady !== 'true') {
        mapAddressList.addEventListener('input', handleMultiStopListInput);
        mapAddressList.addEventListener('change', handleMultiStopListInput);
        mapAddressList.dataset.listenersReady = 'true';
    }

    updateMultiStopLabels();
    updateMultiStopProgressiveFlow();
    updateMultiStopRouteIfReady();
}

function initMultiStopCard(card) {
    if (!card) return;
    const stopId = card.dataset.stopId;
    if (!stopId) return;

    if (!multiStopHouseState[stopId]) {
        const quantities = {};
        Object.values(MULTI_STOP_ROOM_ITEMS).flat().forEach((item) => {
            quantities[item] = 0;
        });
        multiStopHouseState[stopId] = {
            currentRoom: '',
            selectedRooms: new Set(),
            quantities,
            customItems: '',
            extraItems: ''
        };
    }

    if (!multiStopOfficeState[stopId]) {
        const quantities = {};
        MULTI_STOP_OFFICE_ITEMS.forEach((item) => {
            quantities[item.name] = 0;
        });
        multiStopOfficeState[stopId] = {
            category: 'workstations',
            quantities,
            customItems: ''
        };
    }

    renderMultiStopHouseItems(stopId, null);
    renderMultiStopOfficeInventory(stopId);
    initMultiStopLocationNavs(card);
    updateMultiStopFloorOptions(card, '');
    updateMultiStopLocationDetails(card);
    applyMultiStopRequiredRules(card);
    initMultiStopOptionNavs(card);
    initMultiStopDropdowns(card);
    initMultiStopPhotoAreas(card);
    updateMultiStopProgressiveFlow();
}

function addMultiStopCard(role) {
    const stopList = document.getElementById('multi-stop-list');
    if (!stopList) return;

    const card = buildMultiStopCard(role);

    if (role === 'stop') {
        const cards = stopList.querySelectorAll('.multi-stop-card');
        const lastCard = cards[cards.length - 1];
        if (lastCard) {
            stopList.insertBefore(card, lastCard);
        } else {
            stopList.appendChild(card);
        }
    } else {
        stopList.appendChild(card);
    }

    addMultiStopAddressBlock(card.dataset.stopId);

    initMultiStopCard(card);

    const currentStepValue = parseInt(document.body.dataset.formStep || '', 10);
    if (window.updateMultiStopStepVisibility && Number.isFinite(currentStepValue)) {
        window.updateMultiStopStepVisibility(currentStepValue);
    }

    updateMultiStopLabels();
    updateMultiStopProgressiveFlow();
    scheduleMultiStopRouteUpdate();
}

function buildMultiStopAddressBlock(stopId) {
    if (!stopId) return '';
    const addressId = `${stopId}-address`;
    const cityId = `${stopId}-city`;
    const postcodeId = `${stopId}-postcode`;

    return `
        <div class="multi-stop-map-card" data-stop-id="${stopId}">
            <h4 class="multi-stop-map-title">Stop</h4>
            <label class="form-label" for="${addressId}">Address <span class="required-text" data-required-for="${addressId}">(required)</span></label>
            <input type="text" id="${addressId}" class="form-input multi-stop-address" placeholder="Street address" autocomplete="address-line1" data-required="true" aria-required="true">
            <div class="location-inline">
                <div class="location-field">
                    <label class="form-label" for="${cityId}">City <span class="required-text" data-required-for="${cityId}">(required)</span></label>
                    <input type="text" id="${cityId}" class="form-input multi-stop-city" placeholder="City" autocomplete="address-level2" data-required="true" aria-required="true">
                </div>
                <div class="location-field">
                    <label class="form-label" for="${postcodeId}">Eircode</label>
                    <input type="text" id="${postcodeId}" class="form-input multi-stop-postcode" placeholder="Eircode (e.g. A65 F4E2)" autocomplete="postal-code" data-optional="true">
                </div>
            </div>
        </div>
    `;
}

function addMultiStopAddressBlock(stopId) {
    const list = document.getElementById('multi-stop-map-list');
    if (!list || !stopId) return;
    list.insertAdjacentHTML('beforeend', buildMultiStopAddressBlock(stopId));

    const addressInput = document.getElementById(`${stopId}-address`);
    const cityInput = document.getElementById(`${stopId}-city`);
    const postcodeInput = document.getElementById(`${stopId}-postcode`);

    if (addressInput) {
        setupAddressAutocomplete(addressInput, 'multi-stop');
        addressInput.addEventListener('blur', scheduleMultiStopRouteUpdate);
        addressInput.addEventListener('change', scheduleMultiStopRouteUpdate);
    }
    if (cityInput) {
        cityInput.addEventListener('change', scheduleMultiStopRouteUpdate);
    }
    if (postcodeInput) {
        setupPostcodeAutocomplete(postcodeInput, 'multi-stop');
        postcodeInput.addEventListener('blur', () => handleMultiStopEircodeLookup(postcodeInput));
        postcodeInput.addEventListener('change', () => handleMultiStopEircodeLookup(postcodeInput));
    }
}

function getMultiStopCategorySectionsMarkup(stopId) {
    const sections = [
        buildMultiStopSectionFromTemplate('car-transport-section', stopId, 'Car Transport'),
        buildMultiStopSectionFromTemplate('motorbike-transport-section', stopId, 'Motorbike Transport'),
        buildMultiStopSectionFromTemplate('trailer-campervan-section', stopId, 'Trailers & Campervans Transport'),
        buildMultiStopSectionFromTemplate('industrial-section', stopId, 'Industrial'),
        buildMultiStopSectionFromTemplate('industrial-weight-section', stopId, 'Industrial'),
        buildMultiStopSectionFromTemplate(
            'office-removal-description-section',
            stopId,
            'Boats|Clearance|Freight|Vehicle Parts|Packaging|Specialist & Antiques|Customized Items'
        ),
        buildMultiStopSectionFromTemplate('manpower-job-description-section', stopId, 'Man Power Only'),
        buildMultiStopSectionFromTemplate('other-job-description-section', stopId, 'Other'),
        buildMultiStopPianoSection(stopId)
    ];

    return sections.filter(Boolean).join('');
}

function buildMultiStopCard(role) {
    multiStopIdCounter += 1;
    const stopId = `multi-stop-${multiStopIdCounter}`;

    const serviceSection = buildMultiStopServiceSection(stopId);
    const floorsSection = buildMultiStopFloorsSection(stopId);
    const officeFloorsSection = buildMultiStopOfficeFloorsSection(stopId);
    const officeMoveDateSection = buildMultiStopOfficeMoveDateSection(stopId);
    const houseInventorySection = buildMultiStopHouseInventorySection(stopId);
    const officeInventorySection = buildMultiStopOfficeInventorySection(stopId);
    const additionalSection = buildMultiStopAdditionalInfoSection(stopId);

    const card = document.createElement('div');
    card.className = 'multi-stop-card';
    card.dataset.stopRole = role;
    card.dataset.stopId = stopId;
    card.innerHTML = `
        <div class="multi-stop-card-header">
            <h3 class="multi-stop-card-title">Stop</h3>
            <button type="button" class="multi-stop-remove-btn" aria-label="Remove stop">Remove</button>
        </div>
        ${serviceSection}
        ${getMultiStopCategorySectionsMarkup(stopId)}
        ${floorsSection}
        ${officeMoveDateSection}
        ${officeFloorsSection}
        ${houseInventorySection}
        ${officeInventorySection}
        ${additionalSection}
    `;

    return card;
}

function buildMultiStopItemRow(stopId, isRequired) {
    const itemId = `${stopId}-item-${Math.random().toString(36).slice(2, 8)}`;
    const optionalAttr = isRequired ? '' : ' data-optional="true"';
    const requiredAttr = isRequired ? ' data-required="true" aria-required="true"' : '';
    const removeBtn = isRequired
        ? '<button type="button" class="multi-stop-item-remove" disabled>Keep</button>'
        : '<button type="button" class="multi-stop-item-remove">Remove</button>';

    return `
        <div class="multi-stop-item-row" data-item-row>
            <input type="text" class="form-input multi-stop-item-name" placeholder="Item description"${optionalAttr}${requiredAttr} data-item-field="name" data-item-id="${itemId}">
            <input type="number" class="form-input multi-stop-item-qty" min="1" value="1"${optionalAttr}${requiredAttr} data-item-field="qty" data-item-id="${itemId}">
            ${removeBtn}
        </div>
    `;
}

function getMultiStopHouseInventoryMarkup(stopId) {
    const roomTabs = [
        { key: 'living', label: 'Living', icon: '<path d="M3 13h2v8H3z"/><path d="M19 13h2v8h-2z"/><path d="M5 21h14v2H5z"/><path d="M5 9h14v10H5z"/><path d="M3 5h18v4H3z"/>' },
        { key: 'dining', label: 'Dining', icon: '<rect x="3" y="7" width="18" height="10" rx="2"/><line x1="3" y1="9" x2="21" y2="9" stroke="white" stroke-width="2"/>' },
        { key: 'kitchen', label: 'Kitchen', icon: '<rect x="2" y="7" width="20" height="13" rx="2"/><line x1="8" y1="7" x2="8" y2="20" stroke="white" stroke-width="2"/><line x1="16" y1="7" x2="16" y2="20" stroke="white" stroke-width="2"/>' },
        { key: 'office', label: 'Office', icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="9" x2="9" y2="15" stroke="white" stroke-width="2"/><line x1="15" y1="9" x2="15" y2="15" stroke="white" stroke-width="2"/>' },
        { key: 'bedrooms', label: 'Bedrooms', icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="6" y="8" width="8" height="6" fill="white"/>' },
        { key: 'bathrooms', label: 'Bathrooms', icon: '<path d="M4 4h16v2H4zM6 6h12v12H6zM9 10h6v2H9z"/>' },
        { key: 'garden', label: 'Garden', icon: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6z"/>' },
        { key: 'utility', label: 'Utility', icon: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="13" r="4" fill="white"/><circle cx="9" cy="7" r="1.2" fill="white"/>' },
        { key: 'shed', label: 'Shed', icon: '<path d="M4 10l8-6 8 6v10H4z"/><rect x="10" y="13" width="4" height="7" fill="white"/>' },
        { key: 'boxes', label: 'Boxes & Other', icon: '<path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z"/>' }
    ];

    const tabMarkup = roomTabs
        .map((room) => `
            <button type="button" class="room-tab-btn" data-room="${room.key}" data-stop-id="${stopId}" aria-pressed="false">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">${room.icon}</svg>
                ${room.label}
            </button>
        `)
        .join('');

    return `
        <div class="multi-stop-house-inventory" data-stop-section="house-inventory" data-stop-id="${stopId}" style="display: none;">
            <div class="card-section">
                <h3 style="margin-bottom: 16px; color: var(--text-primary);">Add your inventory <span class="required-text">(required)</span></h3>
                <div class="room-tabs room-tabs--fullbleed" data-stop-room-tabs="${stopId}">${tabMarkup}</div>
                <div class="field-error-message" data-stop-room-error="${stopId}" style="display: none;">Please select at least one room.</div>
                <div class="room-items-list" data-stop-room-items="${stopId}"></div>
                <div class="form-section">
                    <h3>Do you require packing? Tick relevant options.</h3>
                    <div class="form-group checkbox-group">
                        <label class="checkbox-label">
                            <input type="checkbox" name="${stopId}-packing" value="full">
                            <span>Full packing service including packing materials</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="${stopId}-packing" value="dismantle">
                            <span>Dismantling and Assembly required</span>
                        </label>
                        <label class="checkbox-label">
                            <input type="checkbox" name="${stopId}-packing" value="one-person">
                            <span>Only require 1 person (happy to help myself if needed)</span>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getMultiStopOfficeInventoryMarkup(stopId) {
    return `
        <div class="multi-stop-office-inventory" data-stop-section="office-inventory" data-stop-id="${stopId}" style="display: none;">
            <div class="card-section">
                <h3 style="margin-bottom: 16px; color: var(--text-primary);">Add your inventory <span class="required-text">(required)</span></h3>
                <div class="office-tabs" data-stop-office-tabs="${stopId}">
                    <button type="button" class="office-tab-btn" data-category="workstations" data-stop-id="${stopId}" aria-pressed="false">Workstations</button>
                    <button type="button" class="office-tab-btn" data-category="seating" data-stop-id="${stopId}" aria-pressed="false">Seating</button>
                    <button type="button" class="office-tab-btn" data-category="storage" data-stop-id="${stopId}" aria-pressed="false">Storage</button>
                    <button type="button" class="office-tab-btn" data-category="electronics" data-stop-id="${stopId}" aria-pressed="false">Electronics</button>
                    <button type="button" class="office-tab-btn" data-category="meeting" data-stop-id="${stopId}" aria-pressed="false">Meeting</button>
                    <button type="button" class="office-tab-btn" data-category="packing" data-stop-id="${stopId}" aria-pressed="false">Packing</button>
                    <button type="button" class="office-tab-btn" data-category="other" data-stop-id="${stopId}" aria-pressed="false">Other</button>
                </div>
                <div class="room-items-list" data-stop-office-items="${stopId}"></div>
            </div>
        </div>
    `;
}

function buildMultiStopDimensionItem() {
    return `
        <div class="dimension-item multi-stop-dimension-item">
            <input type="text" class="form-input dimension-description" placeholder="Enter Item Description here">
            <div class="dimension-inputs">
                <input type="number" class="form-input dimension-field" placeholder="Width" min="0" step="0.1">
                <input type="number" class="form-input dimension-field" placeholder="Depth" min="0" step="0.1">
                <input type="number" class="form-input dimension-field" placeholder="Height" min="0" step="0.1">
                <select class="form-input dimension-unit">
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="in">in</option>
                    <option value="ft">ft</option>
                </select>
                <input type="number" class="form-input dimension-field" placeholder="Weight" min="0" step="0.1">
                <select class="form-input dimension-unit">
                    <option value="kg">kg</option>
                    <option value="lbs">lbs</option>
                </select>
            </div>
        </div>
    `;
}

function initMultiStopPhotoAreas(card) {
    if (!card) return;
    const photoAreas = Array.from(card.querySelectorAll('.photo-upload-area'));
    photoAreas.forEach((area) => {
        if (area.dataset.multiStopPhotoReady === 'true') return;
        const input = area.querySelector('.photo-input');
        if (!input) return;

        area.addEventListener('click', () => input.click());

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.style.borderColor = '#4A90E2';
            area.style.background = '#f0f6ff';
        });

        area.addEventListener('dragleave', () => {
            area.style.borderColor = '#ddd';
            area.style.background = '#f9f9f9';
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.style.borderColor = '#ddd';
            area.style.background = '#f9f9f9';
            input.files = e.dataTransfer.files;
        });

        area.dataset.multiStopPhotoReady = 'true';
    });
}

function buildMultiStopRoomEntry(stopId, isRequired) {
    const entryId = `${stopId}-room-${Math.random().toString(36).slice(2, 8)}`;
    const optionalAttr = isRequired ? '' : ' data-optional="true"';
    const requiredAttr = isRequired ? ' data-required="true" aria-required="true"' : '';
    const removeBtn = isRequired
        ? '<button type="button" class="multi-stop-room-remove" disabled>Keep</button>'
        : '<button type="button" class="multi-stop-room-remove">Remove</button>';

    const roomOptions = [
        { value: '', label: 'Choose room' },
        { value: 'living', label: 'Living' },
        { value: 'dining', label: 'Dining' },
        { value: 'kitchen', label: 'Kitchen' },
        { value: 'hallway', label: 'Hallway' },
        { value: 'office', label: 'Office' },
        { value: 'bedrooms', label: 'Bedrooms' },
        { value: 'bathrooms', label: 'Bathrooms' },
        { value: 'garden', label: 'Garden' },
        { value: 'utility', label: 'Utility' },
        { value: 'shed', label: 'Shed' }
    ];

    const roomMarkup = roomOptions
        .filter((opt) => opt.value)
        .map((opt) => `
            <button type="button" class="multi-stop-room-option" data-value="${opt.value}" role="radio" aria-checked="false">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor"/><path d="M4 10h16" stroke="#fff" stroke-width="2"/></svg>
                <span>${opt.label}</span>
            </button>
        `)
        .join('');

    return `
        <div class="location-room-entry multi-stop-room-entry" data-room-entry>
            <div class="form-group">
                <label class="form-label" for="${entryId}-room">Room${isRequired ? ' <span class="required-text">(required)</span>' : ''}</label>
                <div class="custom-dropdown-wrapper has-option-nav">
                    <div class="option-nav option-nav--compact option-nav--room-grid">
                        ${roomMarkup}
                    </div>
                    <input type="hidden" id="${entryId}-room" class="form-input multi-stop-room-hidden"${optionalAttr}${requiredAttr}>
                </div>
            </div>
            <div class="form-group">
                <label class="form-label" for="${entryId}-items">Items in this room${isRequired ? ' <span class="required-text">(required)</span>' : ''}</label>
                <input type="text" id="${entryId}-items" class="form-input multi-stop-room-items" placeholder="e.g. Couch"${optionalAttr}${requiredAttr}>
            </div>
            <div class="form-group multi-stop-room-remove-wrap">
                ${removeBtn}
            </div>
        </div>
    `;
}

function handleMultiStopListClick(event) {
    const addStopBtn = event.target.closest('.multi-stop-add-btn');
    if (addStopBtn) {
        const action = addStopBtn.getAttribute('data-action') || 'stop';
        if (action === 'delivery') {
            addMultiStopCard('delivery');
        } else {
            addMultiStopCard('stop');
        }
        return;
    }

    const serviceBtn = event.target.closest('.service-icon-btn');
    if (serviceBtn) {
        const card = serviceBtn.closest('.multi-stop-card');
        if (!card) return;
        const hidden = card.querySelector('.multi-stop-category');
        const grid = card.querySelector('.multi-stop-service-grid');
        if (!hidden || !grid) return;
        const value = serviceBtn.getAttribute('data-value') || '';
        if (!value) return;
        hidden.value = value;
        const buttons = Array.from(grid.querySelectorAll('.service-icon-btn'));
        buttons.forEach((btn) => {
            const isActive = btn === serviceBtn;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        updateMultiStopCategorySections(card, value);
        return;
    }

    const navButton = event.target.closest('.location-nav-btn');
    if (navButton) {
        const nav = navButton.closest('.location-nav');
        if (!nav) return;
        const selectId = nav.getAttribute('data-nav-for');
        const selectEl = selectId ? document.getElementById(selectId) : null;
        if (!selectEl) return;
        const value = navButton.getAttribute('data-value') || '';
        selectEl.value = value;
        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
        const buttons = Array.from(nav.querySelectorAll('.location-nav-btn'));
        buttons.forEach((btn) => {
            const isActive = btn === navButton;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
        if (nav.getAttribute('data-nav-type') === 'location-type') {
            const card = navButton.closest('.multi-stop-card');
            if (card) {
                updateMultiStopFloorOptions(card, value);
                updateMultiStopLocationDetails(card, value);
            }
        }
        return;
    }

    const additionalToggle = event.target.closest('.multi-stop-additional-toggle');
    if (additionalToggle) {
        const card = additionalToggle.closest('.multi-stop-card');
        if (!card) return;
        const section = card.querySelector('.collapsible-section');
        if (section) {
            section.classList.toggle('expanded');
        }
        return;
    }

    const addDimensionBtn = event.target.closest('.multi-stop-add-dimension');
    if (addDimensionBtn) {
        const card = addDimensionBtn.closest('.multi-stop-card');
        if (!card) return;
        const list = card.querySelector('.multi-stop-dimensions-list');
        if (list) {
            list.insertAdjacentHTML('beforeend', buildMultiStopDimensionItem());
        }
        return;
    }

    const roomTabBtn = event.target.closest('.room-tab-btn');
    if (roomTabBtn && roomTabBtn.closest('.multi-stop-house-inventory')) {
        const stopId = roomTabBtn.getAttribute('data-stop-id');
        const room = roomTabBtn.getAttribute('data-room');
        if (!stopId || !room) return;
        toggleMultiStopRoom(stopId, room, roomTabBtn);
        return;
    }

    const houseQtyBtn = event.target.closest('.multi-stop-house-qty');
    if (houseQtyBtn) {
        const stopId = houseQtyBtn.getAttribute('data-stop-id');
        const item = houseQtyBtn.getAttribute('data-item');
        const action = houseQtyBtn.getAttribute('data-action');
        const room = houseQtyBtn.getAttribute('data-room') || '';
        const subRoom = houseQtyBtn.getAttribute('data-subroom') || '';
        if (!stopId || !item || !action) return;
        updateMultiStopHouseQuantity(stopId, item, action === 'plus' ? 1 : -1, room, subRoom);
        return;
    }

    const subRoomBtn = event.target.closest('.multi-stop-subroom-btn');
    if (subRoomBtn) {
        const stopId = subRoomBtn.getAttribute('data-stop-id');
        const room = subRoomBtn.getAttribute('data-room');
        const subRoom = subRoomBtn.getAttribute('data-subroom');
        if (!stopId || !room || !subRoom) return;
        const state = multiStopHouseState[stopId];
        if (!state) return;
        if (!state.subRooms) state.subRooms = {};
        state.subRooms[room] = subRoom;
        renderMultiStopHouseItems(stopId, room);
        return;
    }

    const officeTabBtn = event.target.closest('.office-tab-btn');
    if (officeTabBtn && officeTabBtn.closest('.multi-stop-office-inventory')) {
        const stopId = officeTabBtn.getAttribute('data-stop-id');
        const category = officeTabBtn.getAttribute('data-category');
        if (!stopId || !category) return;
        setMultiStopOfficeCategory(stopId, category);
        return;
    }

    const officeQtyBtn = event.target.closest('.multi-stop-office-qty');
    if (officeQtyBtn) {
        const stopId = officeQtyBtn.getAttribute('data-stop-id');
        const item = officeQtyBtn.getAttribute('data-item');
        const action = officeQtyBtn.getAttribute('data-action');
        if (!stopId || !item || !action) return;
        updateMultiStopOfficeQuantity(stopId, item, action === 'plus' ? 1 : -1);
        return;
    }

    const roomOptionBtn = event.target.closest('.multi-stop-room-option');
    if (roomOptionBtn) {
        const row = roomOptionBtn.closest('[data-room-entry]');
        if (!row) return;
        const hidden = row.querySelector('.multi-stop-room-hidden');
        if (!hidden) return;
        const value = roomOptionBtn.getAttribute('data-value') || '';
        hidden.value = value;
        const buttons = Array.from(row.querySelectorAll('.multi-stop-room-option'));
        buttons.forEach((btn) => {
            const isActive = btn === roomOptionBtn;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
        return;
    }

    const addItemBtn = event.target.closest('.multi-stop-add-item');
    if (addItemBtn) {
        const stopId = addItemBtn.getAttribute('data-stop-id');
        const list = document.querySelector(`.multi-stop-items-list[data-stop-items="${stopId}"]`);
        if (list) {
            list.insertAdjacentHTML('beforeend', buildMultiStopItemRow(stopId, false));
        }
        return;
    }

    const addRoomBtn = event.target.closest('.multi-stop-add-room');
    if (addRoomBtn) {
        const stopId = addRoomBtn.getAttribute('data-stop-id');
        const list = document.querySelector(`.multi-stop-room-list[data-stop-rooms="${stopId}"]`);
        if (list) {
            list.insertAdjacentHTML('beforeend', buildMultiStopRoomEntry(stopId, false));
        }
        return;
    }

    const removeItemBtn = event.target.closest('.multi-stop-item-remove');
    if (removeItemBtn && !removeItemBtn.disabled) {
        const row = removeItemBtn.closest('[data-item-row]');
        if (row) row.remove();
        return;
    }

    const removeRoomBtn = event.target.closest('.multi-stop-room-remove');
    if (removeRoomBtn && !removeRoomBtn.disabled) {
        const row = removeRoomBtn.closest('[data-room-entry]');
        if (row) row.remove();
        return;
    }

    const removeStopBtn = event.target.closest('.multi-stop-remove-btn');
    if (removeStopBtn) {
        const card = removeStopBtn.closest('.multi-stop-card');
        if (!card) return;
        const stopList = document.getElementById('multi-stop-list');
        if (stopList && stopList.querySelectorAll('.multi-stop-card').length <= 2) {
            return;
        }
        const stopId = card.dataset.stopId;
        if (stopId) {
            document.querySelector(`.multi-stop-map-card[data-stop-id="${stopId}"]`)?.remove();
        }
        card.remove();
        updateMultiStopLabels();
        updateMultiStopProgressiveFlow();
        scheduleMultiStopRouteUpdate();
    }
}

function handleMultiStopOptionNavCapture(event) {
    const optionNavBtn = event.target.closest('.option-nav-btn');
    if (!optionNavBtn) return;
    const nav = optionNavBtn.closest('.option-nav');
    const card = optionNavBtn.closest('.multi-stop-card');
    if (!nav || !card) return;

    const targetId = nav.getAttribute('data-option-nav-for');
    const wrapper = nav.closest('.custom-dropdown-wrapper');
    let hidden = targetId ? card.querySelector(`[id="${targetId}"]`) : null;
    if (!hidden) {
        hidden = wrapper?.querySelector('input[type="hidden"]') || null;
    }
    if (!hidden) return;
    if (!targetId && hidden.id) {
        nav.setAttribute('data-option-nav-for', hidden.id);
    }

    const value = optionNavBtn.getAttribute('data-value') || '';
    if (!value) return;

    const isMulti = nav.getAttribute('data-option-nav-multi') === 'true';
    const values = hidden.value
        ? hidden.value.split(',').map((item) => item.trim()).filter(Boolean)
        : [];

    let nextValues = values;
    if (isMulti) {
        nextValues = values.includes(value)
            ? values.filter((entry) => entry !== value)
            : values.concat(value);
        hidden.value = nextValues.join(', ');
    } else {
        hidden.value = value;
        nextValues = [value];
    }

    hidden.dispatchEvent(new Event('change', { bubbles: true }));
    const valueSet = new Set(nextValues);
    nav.querySelectorAll('.option-nav-btn').forEach((btn) => {
        const isActive = valueSet.has(btn.getAttribute('data-value'));
        btn.classList.toggle('is-active', isActive);
        if (isMulti) {
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        } else {
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        }
    });

    event.preventDefault();
    event.stopPropagation();
}

function applyMultiStopRoleRules(card) {
    if (!card) return;
    const role = card.dataset.stopRole || 'stop';
    const categoryGroup = card.querySelector('.multi-stop-category-group');
    const categoryInput = card.querySelector('.multi-stop-category');
    const serviceGrid = card.querySelector('.multi-stop-service-grid');
    const isDelivery = role === 'delivery';
    const typeLabel = card.querySelector('label[for$="pickup-location-type"]');
    if (typeLabel) {
        if (role === 'pickup') {
            typeLabel.textContent = 'Pickup: Type of Home/Storage';
        } else if (role === 'delivery') {
            typeLabel.textContent = 'Delivery: Type of Home/Storage';
        } else {
            typeLabel.textContent = 'Stop: Type of Home/Storage';
        }
    }

    if (categoryGroup) {
        categoryGroup.style.display = isDelivery ? 'none' : '';
    }

    if (categoryInput) {
        if (isDelivery) {
            if (!categoryInput.value) {
                categoryInput.value = 'House Removals';
            }
            setMultiStopFieldRequired(categoryInput, false);
            if (serviceGrid) {
                serviceGrid.querySelectorAll('.service-icon-btn').forEach((btn) => {
                    btn.classList.remove('is-active');
                    btn.setAttribute('aria-pressed', 'false');
                });
            }
            updateMultiStopCategorySections(card, categoryInput.value);
        } else {
            setMultiStopFieldRequired(categoryInput, true);
            const selected = categoryInput.value || '';
            if (serviceGrid && selected) {
                serviceGrid.querySelectorAll('.service-icon-btn').forEach((btn) => {
                    const isActive = btn.getAttribute('data-value') === selected;
                    btn.classList.toggle('is-active', isActive);
                    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
                });
                updateMultiStopCategorySections(card, selected);
            }
        }
    }
}

function handleMultiStopListInput(event) {
    const field = event.target;
    if (!field) return;
    if (field.classList.contains('multi-stop-house-search')) {
        const stopId = field.getAttribute('data-stop-id');
        const room = field.getAttribute('data-room');
        if (!stopId || !room) return;
        const state = multiStopHouseState[stopId];
        if (!state) return;
        if (!state.searchQueries) state.searchQueries = {};
        state.searchQueries[room] = field.value || '';
        renderMultiStopHouseItems(stopId, room);
        return;
    }

    if (field.classList.contains('multi-stop-house-custom') || field.classList.contains('multi-stop-house-extra')) {
        const stopId = field.getAttribute('data-stop-id');
        if (!stopId) return;
        const state = multiStopHouseState[stopId];
        if (!state) return;
        if (field.classList.contains('multi-stop-house-custom')) {
            state.customItems = field.value || '';
        } else {
            state.extraItems = field.value || '';
        }
        return;
    }

    if (field.classList.contains('multi-stop-office-custom')) {
        const stopId = field.getAttribute('data-stop-id');
        if (!stopId) return;
        const state = multiStopOfficeState[stopId];
        if (!state) return;
        state.customItems = field.value || '';
        return;
    }
    if (field.classList.contains('multi-stop-address')
        || field.classList.contains('multi-stop-city')
        || field.classList.contains('multi-stop-postcode')) {
        scheduleMultiStopRouteUpdate();
    }

    if (field.classList.contains('multi-stop-location-type')) {
        const card = field.closest('.multi-stop-card');
        if (card) {
            updateMultiStopFloorOptions(card, field.value);
            updateMultiStopLocationDetails(card, field.value);
        }
    }

    updateMultiStopProgressiveFlow();
}

function isMultiStopLocationReady(card, categoryValue) {
    if (!card) return true;
    const stopId = card.dataset.stopId;
    const category = categoryValue || card.querySelector('.multi-stop-category')?.value.trim() || '';
    if (!category) return false;

    const getVisibleField = (selector) => {
        const fields = Array.from(card.querySelectorAll(selector));
        if (fields.length === 0) return null;
        const visible = fields.find((field) => {
            const section = field.closest('[data-stop-section]');
            if (!section) return true;
            const style = window.getComputedStyle(section);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
        return visible || fields[0] || null;
    };

    const address = stopId ? document.getElementById(`${stopId}-address`)?.value.trim() || '' : '';
    const city = stopId ? document.getElementById(`${stopId}-city`)?.value.trim() || '' : '';
    if (!address || !city) return false;

    const vehicleNoFloorCategories = new Set([
        'Car Transport',
        'Motorbike Transport',
        'Trailers & Campervans Transport',
        'Boats'
    ]);
    if (vehicleNoFloorCategories.has(category)) return true;

    const locationType = getVisibleField('.multi-stop-location-type')?.value.trim() || '';
    if (!locationType) return false;

    const noFloorTypes = new Set(['warehouse']);
    const hideFloor = noFloorTypes.has(locationType)
        || (category === 'House Removals' && (locationType === 'house' || locationType === 'bungalow'));
    if (!hideFloor) {
        const floor = getVisibleField('.multi-stop-floor')?.value.trim() || '';
        if (!floor) return false;
    }

    return true;
}

function isMultiStopDetailsReady(card, categoryValue) {
    if (!card) return true;
    const category = categoryValue || card.querySelector('.multi-stop-category')?.value.trim() || '';
    if (!category) return false;

    const vehicleNoFloorCategories = new Set([
        'Car Transport',
        'Motorbike Transport',
        'Trailers & Campervans Transport',
        'Boats'
    ]);
    if (vehicleNoFloorCategories.has(category)) return true;

    const getVisibleField = (selector) => {
        const fields = Array.from(card.querySelectorAll(selector));
        if (fields.length === 0) return null;
        const visible = fields.find((field) => {
            const section = field.closest('[data-stop-section]');
            if (!section) return true;
            const style = window.getComputedStyle(section);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
        return visible || fields[0] || null;
    };

    const locationType = getVisibleField('.multi-stop-location-type')?.value.trim() || '';
    if (!locationType) return false;

    const noFloorTypes = new Set(['warehouse']);
    const hideFloor = noFloorTypes.has(locationType)
        || (category === 'House Removals' && (locationType === 'house' || locationType === 'bungalow'));
    if (!hideFloor) {
        const floor = getVisibleField('.multi-stop-floor')?.value.trim() || '';
        if (!floor) return false;
    }

    return true;
}

function updateMultiStopProgressiveFlow() {
    const cards = Array.from(document.querySelectorAll('.multi-stop-card'));
    const addRow = document.getElementById('multi-stop-add-row');
    cards.forEach((card) => {
        const stopId = card.dataset.stopId;
        const mapCard = stopId ? document.querySelector(`.multi-stop-map-card[data-stop-id="${stopId}"]`) : null;
        card.classList.remove('progressive-hidden');
        if (mapCard) mapCard.classList.remove('progressive-hidden');
    });

    if (addRow) {
        addRow.classList.remove('progressive-hidden');
    }

    cards.forEach((card) => {
        updateMultiStopCategoryProgressive(card);
        updateMultiStopCardProgressive(card);
    });
}

function updateMultiStopCardProgressive(card) {
    if (!card) return;
    const isSingleForm = document.body.classList.contains('single-form');
    const isFloorBlock = isSingleForm && card.classList.contains('floor-block');
    const category = card.querySelector('.multi-stop-category')?.value.trim() || '';
    const hasCategory = !!category;
    const floorsSection = card.querySelector('[data-stop-section="floors"]');
    const officeFloorsSection = card.querySelector('[data-stop-section="office-floors"]');
    const officeDateSection = card.querySelector('[data-stop-section="office-date"]');
    const locationBlock = officeFloorsSection && officeFloorsSection.style.display !== 'none'
        ? officeFloorsSection
        : floorsSection;
    const additionalSection = card.querySelector('[data-stop-section="additional"]');
    const houseSection = card.querySelector('[data-stop-section="house-inventory"]');
    const officeSection = card.querySelector('[data-stop-section="office-inventory"]');
    const categorySections = Array.from(card.querySelectorAll('.multi-stop-category-section'))
        .filter((section) => section.style.display !== 'none');

    if (isFloorBlock) {
        if (locationBlock && locationBlock.style.display !== 'none') {
            locationBlock.classList.remove('progressive-hidden');
        }
        categorySections.forEach((section) => {
            section.classList.remove('progressive-hidden');
        });
        if (houseSection && houseSection.style.display !== 'none') {
            houseSection.classList.remove('progressive-hidden');
        }
        if (officeSection && officeSection.style.display !== 'none') {
            officeSection.classList.remove('progressive-hidden');
        }
        if (officeDateSection && officeDateSection.style.display !== 'none') {
            officeDateSection.classList.remove('progressive-hidden');
        }
        if (additionalSection) {
            additionalSection.classList.add('progressive-hidden');
        }
        return;
    }

    if (locationBlock) {
        locationBlock.classList.toggle('progressive-hidden', !hasCategory);
    }

    const detailsReady = isMultiStopDetailsReady(card, category);

    categorySections.forEach((section) => {
        section.classList.toggle('progressive-hidden', !hasCategory);
    });

    if (houseSection) {
        if (houseSection.style.display !== 'none') {
            houseSection.classList.toggle('progressive-hidden', !detailsReady);
        } else {
            houseSection.classList.remove('progressive-hidden');
        }
    }

    if (officeSection) {
        if (officeSection.style.display !== 'none') {
            officeSection.classList.toggle('progressive-hidden', !detailsReady);
        } else {
            officeSection.classList.remove('progressive-hidden');
        }
    }

    if (officeDateSection) {
        if (officeDateSection.style.display !== 'none') {
            officeDateSection.classList.toggle('progressive-hidden', !detailsReady);
        } else {
            officeDateSection.classList.remove('progressive-hidden');
        }
    }

    if (additionalSection) {
        additionalSection.classList.toggle('progressive-hidden', !detailsReady);
    }
}

function updateMultiStopCategoryProgressive(card) {
    if (!card) return;
    const activeSections = Array.from(card.querySelectorAll('.multi-stop-category-section'))
        .filter((section) => section.style.display !== 'none');

    const isFieldVisible = (field) => {
        if (!field) return false;
        if (field.type === 'hidden') return true;
        const style = window.getComputedStyle(field);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return field.offsetParent !== null || field.getClientRects().length > 0;
    };

    const isFieldComplete = (field) => {
        if (!field || field.disabled) return true;
        if (field.type === 'checkbox' || field.type === 'radio') return field.checked;
        return !!field.value && field.value.trim().length > 0;
    };

    const isBlockComplete = (block) => {
        if (!block) return true;
        const requiredFields = Array.from(block.querySelectorAll('[data-required="true"]'))
            .filter((field) => isFieldVisible(field));
        if (requiredFields.length === 0) return true;
        return requiredFields.every(isFieldComplete);
    };

    activeSections.forEach((section) => {
        let blocks = [];
        if (section.classList.contains('card-section')) {
            blocks.push(section);
        }
        blocks = blocks.concat(
            Array.from(section.querySelectorAll('.card-section')).filter((block) => block !== section)
        );
        if (blocks.length === 0) {
            blocks = [section];
        }

        if (section.classList.contains('progressive-hidden')) {
            blocks.forEach((block) => block.classList.add('progressive-hidden'));
            return;
        }

        let allow = true;
        blocks.forEach((block, index) => {
            if (index === 0) {
                block.classList.remove('progressive-hidden');
                if (allow && !isBlockComplete(block)) allow = false;
                return;
            }

            if (allow) {
                block.classList.remove('progressive-hidden');
                if (!isBlockComplete(block)) allow = false;
            } else {
                block.classList.add('progressive-hidden');
            }
        });
    });

}

function updateMultiStopLocationDetails(card, typeValue) {
    if (!card) return;
    const isSingleForm = document.body.classList.contains('single-form');
    const category = card.querySelector('.multi-stop-category')?.value || '';
    const isFloorBlockCard = card.classList.contains('floor-block');
    const vehicleNoFloorCategories = new Set([
        'Car Transport',
        'Motorbike Transport',
        'Trailers & Campervans Transport',
        'Boats'
    ]);
    if (vehicleNoFloorCategories.has(category)) {
        const floorGroup = card.querySelector('.floor-group');
        const elevatorGroup = card.querySelector('.elevator-group');
        if (floorGroup) floorGroup.style.display = 'none';
        if (elevatorGroup) elevatorGroup.style.display = 'none';
        return;
    }

    const getVisibleField = (selector) => {
        const fields = Array.from(card.querySelectorAll(selector));
        if (fields.length === 0) return null;
        const visible = fields.find((field) => {
            const section = field.closest('[data-stop-section]');
            if (!section) return true;
            const style = window.getComputedStyle(section);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
        return visible || fields[0] || null;
    };

    const typeSelect = getVisibleField('.multi-stop-location-type');
    const type = typeValue || typeSelect?.value || '';
    const floorSelect = getVisibleField('.multi-stop-floor');
    const elevatorSelect = getVisibleField('.multi-stop-elevator');
    const floorGroup = floorSelect ? floorSelect.closest('.floor-group') : card.querySelector('.multi-stop-location-meta[data-location-field="floor"]');
    const elevatorGroup = elevatorSelect ? elevatorSelect.closest('.elevator-group') : card.querySelector('.multi-stop-location-meta[data-location-field="elevator"]');

    const noFloorTypes = new Set(['warehouse']);
    const noElevatorTypes = new Set(['house', 'duplex', 'bungalow', 'warehouse']);
    const hasType = !!type;
    const resolvedServiceValue = document.getElementById('item-description-hidden')?.value || '';
    const serviceValue = isSingleForm || isFloorBlockCard
        ? resolvedServiceValue
        : category;
    const hideHouseFloor = !isSingleForm && !isFloorBlockCard
        && serviceValue === 'House Removals'
        && (type === 'house' || type === 'bungalow');
    const hideFloor = !hasType
        || noFloorTypes.has(type)
        || hideHouseFloor
        || vehicleNoFloorCategories.has(serviceValue);
    const hideElevator = !hasType || noElevatorTypes.has(type) || vehicleNoFloorCategories.has(serviceValue);

    const floorsSection = card.querySelector('[data-stop-section="floors"], [data-stop-section="office-floors"]');
    const detailsBlock = floorsSection
        ? floorsSection.querySelector('.location-details')
        : typeSelect
            ? typeSelect.closest('.location-group')?.querySelector('.location-details')
            : null;
    const fallbackDetails = floorsSection
        ? floorsSection.querySelector('.location-details')
        : card.querySelector('[data-location-group$="details"] .location-details')
            || card.querySelector('.location-details');
    
    // In single-form floor blocks, always show location details so dropdowns are accessible
    const isFloorBlock = isFloorBlockCard;
    if (detailsBlock) {
        detailsBlock.classList.toggle('is-visible', isFloorBlock || hasType);
    } else if (fallbackDetails) {
        fallbackDetails.classList.toggle('is-visible', isFloorBlock || hasType);
    }

    if (floorGroup) floorGroup.style.display = hideFloor ? 'none' : '';
    if (floorSelect) {
        if (hideFloor) {
            floorSelect.value = '';
            setMultiStopFieldRequired(floorSelect, false);
            const nav = floorGroup ? floorGroup.querySelector('.location-nav') : null;
            if (nav) {
                nav.querySelectorAll('.location-nav-btn').forEach((btn) => {
                    btn.classList.remove('is-active');
                    btn.setAttribute('aria-checked', 'false');
                });
            }
        } else {
            setMultiStopFieldRequired(floorSelect, true);
        }
    }

    if (elevatorGroup) elevatorGroup.style.display = hideElevator ? 'none' : '';
    if (elevatorSelect) {
        if (hideElevator) {
            elevatorSelect.value = '';
            setMultiStopFieldRequired(elevatorSelect, false);
            const nav = elevatorGroup ? elevatorGroup.querySelector('.location-nav') : null;
            if (nav) {
                nav.querySelectorAll('.location-nav-btn').forEach((btn) => {
                    btn.classList.remove('is-active');
                    btn.setAttribute('aria-checked', 'false');
                });
            }
        } else {
            setMultiStopFieldRequired(elevatorSelect, false);
        }
    }

    if (isFloorBlock) {
        const floorSelected = floorSelect ? !!floorSelect.value : true;
        const showInventory = hasType && (hideFloor || floorSelected || isFloorBlock);
        const isHouse = serviceValue === 'House Removals';
        const isOffice = serviceValue === 'Office Removals';
        const houseSection = card.querySelector('[data-stop-section="house-inventory"]');
        const officeSection = card.querySelector('[data-stop-section="office-inventory"]');
        if (houseSection) houseSection.style.display = isHouse && showInventory ? '' : 'none';
        if (officeSection) officeSection.style.display = isOffice && showInventory ? '' : 'none';
    }
}

function toggleMultiStopRoom(stopId, room, tabButton) {
    const state = multiStopHouseState[stopId];
    if (!state) return;

    const isSelected = state.selectedRooms.has(room);
    if (isSelected) {
        state.selectedRooms.delete(room);
        if (tabButton) {
            tabButton.classList.remove('is-selected', 'active');
            tabButton.setAttribute('aria-pressed', 'false');
        }
        if (state.currentRoom === room) {
            state.currentRoom = '';
        }
    } else {
        state.selectedRooms.add(room);
        if (tabButton) {
            tabButton.classList.add('is-selected', 'active');
            tabButton.setAttribute('aria-pressed', 'true');
        }
        state.currentRoom = room;
    }

    renderMultiStopHouseItems(stopId, state.currentRoom);
}

function getMultiStopSubRoomQuantities(state, room, subRoom, items) {
    if (!state.subRoomQuantities) state.subRoomQuantities = {};
    if (!state.subRoomQuantities[room]) state.subRoomQuantities[room] = {};
    if (!state.subRoomQuantities[room][subRoom]) {
        const seed = {};
        (items || []).forEach((item) => {
            seed[item] = 0;
        });
        state.subRoomQuantities[room][subRoom] = seed;
    }
    const quantities = state.subRoomQuantities[room][subRoom];
    (items || []).forEach((item) => {
        if (quantities[item] === undefined) quantities[item] = 0;
    });
    return quantities;
}

function renderMultiStopHouseItems(stopId, room) {
    const state = multiStopHouseState[stopId];
    const container = document.querySelector(`[data-stop-room-items="${stopId}"]`);
    if (!state || !container) return;
    if (room) state.currentRoom = room;
    const items = room ? MULTI_STOP_ROOM_ITEMS[room] : null;

    if (!items) {
        container.innerHTML = '<div class="room-empty-state">Select a room icon to view items.</div>';
        return;
    }

    const isBedroom = room === 'bedrooms';
    const isBathroom = room === 'bathrooms';
    const hasSubRooms = isBedroom || isBathroom;
    const subRooms = hasSubRooms
        ? Array.from({ length: 5 }, (_, i) => `${isBedroom ? 'Bedroom' : 'Bathroom'} ${i + 1}`)
        : [];
    if (!state.subRooms) state.subRooms = {};
    const activeSubRoom = hasSubRooms
        ? (state.subRooms[room] || subRooms[0])
        : '';
    if (hasSubRooms) state.subRooms[room] = activeSubRoom;

    const quantities = hasSubRooms
        ? getMultiStopSubRoomQuantities(state, room, activeSubRoom, items)
        : state.quantities;

    const searchQuery = (state.searchQueries && state.searchQueries[room]) || '';
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const visibleItems = normalizedQuery
        ? items.filter((item) => item.toLowerCase().includes(normalizedQuery))
        : items;

    const searchMarkup = `
        <div class="inventory-search">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"></circle><path d="M20 20l-3.5-3.5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"></path></svg>
            <input type="text" class="multi-stop-house-search" data-stop-id="${stopId}" data-room="${room}" placeholder="Search items" value="${searchQuery}">
        </div>
    `;

    const buildItemsMarkup = () => {
        if (visibleItems.length === 0) {
            return '<div class="room-empty-state">No items match your search.</div>';
        }
        return visibleItems.map((item) => {
            const qty = quantities[item] || 0;
            return `
                <div class="room-item">
                    <span class="room-item-name">${item}</span>
                    <div class="item-quantity-control">
                        <button type="button" class="qty-btn minus multi-stop-house-qty" data-stop-id="${stopId}" data-item="${item}" data-room="${room}" data-subroom="${activeSubRoom}" data-action="minus" ${qty === 0 ? 'disabled' : ''}>−</button>
                        <span class="qty-display">${qty}</span>
                        <button type="button" class="qty-btn plus multi-stop-house-qty" data-stop-id="${stopId}" data-item="${item}" data-room="${room}" data-subroom="${activeSubRoom}" data-action="plus">+</button>
                    </div>
                </div>
            `;
        }).join('');
    };

    const subRoomMarkup = hasSubRooms
        ? `
            <div class="room-items-layout">
                <div class="room-subrooms">
                    ${subRooms.map((label) => `
                        <button type="button" class="room-subroom-btn multi-stop-subroom-btn ${label === activeSubRoom ? 'is-active' : ''}" data-stop-id="${stopId}" data-room="${room}" data-subroom="${label}">
                            ${label}
                        </button>
                    `).join('')}
                </div>
                <div>
                    ${searchMarkup}
                    ${buildItemsMarkup()}
                </div>
            </div>
        `
        : `${searchMarkup}${buildItemsMarkup()}`;

    const customMarkup = `
        <div class="custom-items-input">
            <label>Enter more house items here</label>
            <textarea class="multi-stop-house-custom" data-stop-id="${stopId}" placeholder="Enter any additional items" data-optional="true">${state.customItems || ''}</textarea>
        </div>
        <div class="custom-items-input">
            <label>Enter any additional items</label>
            <textarea class="multi-stop-house-extra" data-stop-id="${stopId}" placeholder="Add any other information" data-optional="true">${state.extraItems || ''}</textarea>
        </div>
    `;

    container.innerHTML = `${subRoomMarkup}${customMarkup}`;
}

function updateMultiStopHouseQuantity(stopId, item, delta, room, subRoom) {
    const state = multiStopHouseState[stopId];
    if (!state) return;
    const isBedroom = room === 'bedrooms';
    const isBathroom = room === 'bathrooms';
    const hasSubRooms = isBedroom || isBathroom;
    const quantities = hasSubRooms
        ? getMultiStopSubRoomQuantities(state, room, subRoom || `${isBedroom ? 'Bedroom' : 'Bathroom'} 1`, MULTI_STOP_ROOM_ITEMS[room])
        : state.quantities;
    const current = quantities[item] || 0;
    const next = Math.max(0, current + delta);
    quantities[item] = next;
    renderMultiStopHouseItems(stopId, state.currentRoom);
}

function setMultiStopOfficeCategory(stopId, category) {
    const state = multiStopOfficeState[stopId];
    if (!state) return;
    state.category = category;

    const tabs = document.querySelectorAll(`[data-stop-office-tabs="${stopId}"] .office-tab-btn`);
    tabs.forEach((btn) => {
        const isActive = btn.getAttribute('data-category') === category;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    renderMultiStopOfficeInventory(stopId);
}

function renderMultiStopOfficeInventory(stopId) {
    const container = document.querySelector(`[data-stop-office-items="${stopId}"]`);
    const state = multiStopOfficeState[stopId];
    if (!container || !state) return;

    const category = state.category || 'workstations';
    const visibleItems = MULTI_STOP_OFFICE_ITEMS.filter((item) => item.category === category);
    const itemsToRender = visibleItems.length > 0 ? visibleItems : MULTI_STOP_OFFICE_ITEMS;

    let html = '';
    itemsToRender.forEach((item) => {
        const qty = state.quantities[item.name] || 0;
        const isSelected = qty > 0;
        const isAddMore = item.name === 'Add more items';
        html += `
            <div class="room-item">
                <span class="room-item-name">${item.name}</span>
                <div class="item-quantity-control">
                    <button type="button" class="qty-btn minus multi-stop-office-qty" data-stop-id="${stopId}" data-item="${item.name}" data-action="minus" ${qty === 0 ? 'disabled' : ''}>−</button>
                    <span class="qty-display">${qty}</span>
                    <button type="button" class="qty-btn plus multi-stop-office-qty" data-stop-id="${stopId}" data-item="${item.name}" data-action="plus">+</button>
                </div>
            </div>
            ${isAddMore && isSelected ? `
                <div class="custom-items-input">
                    <label>Please describe the items you need to move</label>
                    <textarea class="multi-stop-office-custom" data-stop-id="${stopId}" placeholder="e.g., 2x Whiteboards" rows="3">${state.customItems || ''}</textarea>
                </div>
            ` : ''}
        `;
    });

    container.innerHTML = html;
}

function updateMultiStopOfficeQuantity(stopId, item, delta) {
    const state = multiStopOfficeState[stopId];
    if (!state) return;
    const current = state.quantities[item] || 0;
    const next = Math.max(0, current + delta);
    state.quantities[item] = next;
    renderMultiStopOfficeInventory(stopId);
}

function updateMultiStopCategorySections(card, category) {
    if (!card) return;
    const isFloorBlock = card.classList.contains('floor-block');
    const resolvedCategory = isFloorBlock
        ? (document.getElementById('item-description-hidden')?.value || '')
        : category;
    const isDelivery = card.dataset.stopRole === 'delivery';
    const floorsSection = card.querySelector('[data-stop-section="floors"]');
    const officeFloorsSection = card.querySelector('[data-stop-section="office-floors"]');
    const officeDateSection = card.querySelector('[data-stop-section="office-date"]');
    const houseSection = card.querySelector('[data-stop-section="house-inventory"]');
    const officeSection = card.querySelector('[data-stop-section="office-inventory"]');
    const categorySections = Array.from(card.querySelectorAll('.multi-stop-category-section'));
    const locationMetaGroups = Array.from(card.querySelectorAll('.multi-stop-location-meta'));
    const pianoSection = card.querySelector('.multi-stop-category-section[data-stop-category="Piano Transport"]');
    const pianoField = pianoSection ? pianoSection.querySelector('input[type="hidden"]') : null;

    const isHouse = resolvedCategory === 'House Removals';
    const isOffice = resolvedCategory === 'Office Removals';
    const vehicleNoFloorCategories = new Set([
        'Car Transport',
        'Motorbike Transport',
        'Trailers & Campervans Transport',
        'Boats'
    ]);

    const hideLocationMeta = false;

    if (floorsSection) floorsSection.style.display = isOffice ? 'none' : '';
    if (officeFloorsSection) officeFloorsSection.style.display = isOffice ? '' : 'none';
    if (officeDateSection) officeDateSection.style.display = isOffice ? '' : 'none';
    if (houseSection) houseSection.style.display = isHouse ? '' : 'none';
    if (officeSection) officeSection.style.display = isOffice ? '' : 'none';

    if (isDelivery) {
        if (officeFloorsSection) officeFloorsSection.style.display = 'none';
        if (officeDateSection) officeDateSection.style.display = 'none';
        if (floorsSection) floorsSection.style.display = '';
        if (houseSection) houseSection.style.display = 'none';
        if (officeSection) officeSection.style.display = 'none';
    }

    if (pianoField) {
        const showPiano = resolvedCategory === 'Piano Transport' && !isDelivery;
        setMultiStopFieldRequired(pianoField, showPiano);
        if (!showPiano) {
            pianoField.value = '';
        }
    }

    categorySections.forEach((section) => {
        if (isDelivery) {
            section.style.display = 'none';
            return;
        }
        const raw = section.getAttribute('data-stop-category') || '';
        const list = raw.split('|').map((value) => value.trim()).filter(Boolean);
        const isActive = list.includes(resolvedCategory);
        section.style.display = isActive ? '' : 'none';
    });

    locationMetaGroups.forEach((group) => {
        const field = group.querySelector('select');
        const fieldType = group.getAttribute('data-location-field');
        const hideGroup = hideLocationMeta
            || (vehicleNoFloorCategories.has(resolvedCategory) && fieldType !== 'type');
        group.style.display = hideGroup ? 'none' : '';
        if (field) {
            if (hideGroup) {
                field.value = '';
                setMultiStopFieldRequired(field, false);
                const nav = group.querySelector('.location-nav');
                if (nav) {
                    nav.querySelectorAll('.location-nav-btn').forEach((btn) => {
                        btn.classList.remove('is-active');
                        btn.setAttribute('aria-checked', 'false');
                    });
                }
            } else {
                setMultiStopFieldRequired(field, fieldType !== 'elevator');
            }
        }
    });

    if (hideLocationMeta) {
        if (floorsSection) floorsSection.style.display = 'none';
        if (officeFloorsSection) officeFloorsSection.style.display = 'none';
        if (pianoField) {
            setMultiStopFieldRequired(pianoField, false);
            pianoField.value = '';
        }
    }

    initMultiStopOptionNavs(card);

    if (isHouse && !isDelivery) {
        renderMultiStopHouseItems(card.dataset.stopId, multiStopHouseState[card.dataset.stopId]?.currentRoom || null);
    }
    if (isOffice && !isDelivery) {
        renderMultiStopOfficeInventory(card.dataset.stopId);
    }

    updateMultiStopLocationDetails(card);
    updateMultiStopAdditionalRequired(card, category);
    updateMultiStopProgressiveFlow();
    updateMultiStopCategoryProgressive(card);
    updateMultiStopCardProgressive(card);
}

function updateMultiStopAdditionalRequired(card, category) {
    if (!card) return;
    const instructions = card.querySelector('.multi-stop-special-instructions');
    if (!instructions) return;
    const requiredText = instructions.id
        ? card.querySelector(`[data-required-for="${instructions.id}"]`)
        : null;
    const section = instructions.closest('.collapsible-section');
    const isOther = category === 'Other';

    if (isOther) {
        setMultiStopFieldRequired(instructions, true);
        if (requiredText) {
            requiredText.style.display = 'inline';
        }
        if (section) {
            section.classList.add('expanded');
        }
    } else {
        setMultiStopFieldRequired(instructions, false);
        if (requiredText) {
            requiredText.style.display = '';
            requiredText.classList.remove('required-text--active');
        }
    }
}

function updateMultiStopFloorOptions(card, typeValue) {
    if (!card) return;
    const getVisibleField = (selector) => {
        const fields = Array.from(card.querySelectorAll(selector));
        if (fields.length === 0) return null;
        const visible = fields.find((field) => {
            const section = field.closest('[data-stop-section]');
            if (!section) return true;
            const style = window.getComputedStyle(section);
            return style.display !== 'none' && style.visibility !== 'hidden';
        });
        return visible || fields[0] || null;
    };

    const floorSelect = getVisibleField('.multi-stop-floor');
    const floorNav = floorSelect
        ? floorSelect.closest('.location-nav-wrapper')?.querySelector('.location-nav.floor-nav')
        : card.querySelector('.location-nav.floor-nav');
    if (!floorSelect) return;

    const fullFloorOptions = [
        { value: '', label: 'Choose floor' },
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value : "attic", label: "Attic" },
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' },
        { value: '3', label: '3rd' },
        { value: '4', label: '4th' },
        { value: '5', label: '5th' },
        { value: '6', label: '6th' },
        { value: '7', label: '7th' },
        { value: '8', label: '8th' },
        { value: '9', label: '9th' },
        { value: '10', label: '10th' },
        { value: '11', label: '11th' },
        { value: '12', label: '12th' },
        { value: '13', label: '13th' },
        { value: '14', label: '14th' },
        { value: '15', label: '15th' },
        { value: '16', label: '16th' },
        { value: '17', label: '17th' },
        { value: '18', label: '18th' },
        { value: '19', label: '19th' },
        { value: '20', label: '20th' }
    ];

    const limitedFloorOptions = [
        { value: '', label: 'Choose floor' },
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' },
        { value: 'attic', label: 'Attic' }
    ];

    const bungalowFloorOptions = [
        { value: '', label: 'Choose floor' },
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value: 'attic', label: 'Attic' }
    ];

    const storageUnitFloorOptions = [
        { value: '', label: 'Choose floor' },
        { value: 'basement', label: 'Basement' },
        { value: 'ground', label: 'Ground' },
        { value: '1', label: '1st' },
        { value: '2', label: '2nd' },
        { value: '3', label: '3rd' },
        { value: '4', label: '4th' },
        { value: '5', label: '5th' }
    ];

    let options = fullFloorOptions;
    if (typeValue === 'bungalow') {
        options = bungalowFloorOptions;
    } else if (typeValue === 'storage-unit') {
        options = storageUnitFloorOptions;
    } else if (typeValue === 'house' || typeValue === 'duplex') {
        options = limitedFloorOptions;
    }

    const currentValue = floorSelect.value;
    floorSelect.innerHTML = options.map((opt) => `<option value="${opt.value}">${opt.label}</option>`).join('');
    if (options.some((opt) => opt.value === currentValue)) {
        floorSelect.value = currentValue;
    } else {
        floorSelect.value = '';
    }

    if (floorNav) {
        floorNav.innerHTML = options
            .filter((opt) => opt.value)
            .map((opt) => `
                <button type="button" class="location-nav-btn" data-value="${opt.value}" role="radio" aria-checked="false">
                    ${getMultiStopNavIconMarkup('floor', opt.value)}
                    <span class="floor-label">${opt.label}</span>
                </button>
            `)
            .join('');
        const buttons = Array.from(floorNav.querySelectorAll('.location-nav-btn'));
        buttons.forEach((btn) => {
            const isActive = btn.getAttribute('data-value') === floorSelect.value;
            btn.classList.toggle('is-active', isActive);
            btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
        });
    }
}

function updateMultiStopLabels() {
    const cards = Array.from(document.querySelectorAll('.multi-stop-card'));
    const totalStops = cards.length;
    const mapList = document.getElementById('multi-stop-map-list');
    const addRow = document.getElementById('multi-stop-add-row');

    cards.forEach((card, index) => {
        const isFirst = index === 0;
        const isLast = index === totalStops - 1;
        card.dataset.stopRole = isFirst ? 'pickup' : isLast ? 'delivery' : 'stop';

        const title = card.querySelector('.multi-stop-card-title');
        const mapCard = document.querySelector(`.multi-stop-map-card[data-stop-id="${card.dataset.stopId}"]`);
        const mapTitle = mapCard ? mapCard.querySelector('.multi-stop-map-title') : null;
        const removeBtn = card.querySelector('.multi-stop-remove-btn');

        const stopNumber = index + 1;
        const suffix = isFirst ? ' (Pickup)' : isLast ? ' (Delivery)' : '';
        if (title) title.textContent = `Stop ${stopNumber}${suffix}`;
        if (mapTitle) mapTitle.textContent = `Stop ${stopNumber}${suffix}`;
        if (removeBtn) {
            removeBtn.style.visibility = isFirst || isLast ? 'hidden' : 'visible';
        }

        applyMultiStopRoleRules(card);

        if (mapList && mapCard) {
            mapList.appendChild(mapCard);
        }
    });

    if (addRow && cards.length > 0) {
        const lastCard = cards[cards.length - 1];
        lastCard.insertAdjacentElement('beforebegin', addRow);
    }

    updateRouteLabels();
}

function scheduleMultiStopRouteUpdate() {
    clearTimeout(multiStopRouteTimer);
    multiStopRouteTimer = setTimeout(() => {
        updateMultiStopRouteIfReady();
    }, 400);
}

function renderOfficeInventory() {
    const container = document.getElementById('office-items-container');
    if (!container) return;
    
    const OFFICE_ITEMS = [
        { name: 'Desk', category: 'workstations' },
        { name: 'Chair', category: 'seating' },
        { name: 'Pedestal', category: 'storage' },
        { name: 'Filing cabinet', category: 'storage' },
        { name: 'Desktop computer', category: 'electronics' },
        { name: 'Photocopier', category: 'electronics' },
        { name: 'Printer', category: 'electronics' },
        { name: 'Board room table', category: 'meeting' },
        { name: 'Boxes - large', category: 'packing' },
        { name: 'Boxes - medium', category: 'packing' },
        { name: 'Crates', category: 'packing' },
        { name: 'Add more items', category: 'other' }
    ];
    
    // Initialize office item quantities if not exists
    if (!window.officeItemQuantities) {
        window.officeItemQuantities = {};
        OFFICE_ITEMS.forEach(item => {
            window.officeItemQuantities[item.name] = 0;
        });
    }
    
    const selectedCategory = window.officeInventoryCategory || 'workstations';
    const visibleItems = OFFICE_ITEMS.filter(item => item.category === selectedCategory);
    const itemsToRender = visibleItems.length > 0 ? visibleItems : OFFICE_ITEMS;

    let html = '';
    
    itemsToRender.forEach(item => {
        const qty = window.officeItemQuantities[item.name] || 0;
        const isSelected = qty > 0;
        const displayQty = qty > 0 ? `(${qty}x) ` : '';
        const isAddMoreItems = item.name === 'Add more items';
        
        html += `
            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: ${isSelected ? '16px' : '0'};">
                    <span style="font-size: 16px; color: #1f2937; font-weight: ${qty > 0 ? '500' : '400'};">${displayQty}${item.name}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button type="button" class="qty-btn minus" onclick="decreaseOfficeQuantity('${item.name}')" ${qty === 0 ? 'disabled' : ''} style="width: 32px; height: 32px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #6b7280; font-weight: bold; font-size: 18px;">−</button>
                        <button type="button" class="qty-btn plus" onclick="increaseOfficeQuantity('${item.name}')" style="width: 32px; height: 32px; border: 2px solid #3b82f6; background: white; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #3b82f6; font-weight: bold; font-size: 18px;">+</button>
                        <input type="checkbox" class="office-item-checkbox" value="${item.name}" ${isSelected ? 'checked' : ''} onchange="toggleOfficeItem('${item.name}', this.checked)" style="width: 20px; height: 20px; cursor: pointer; accent-color: #3b82f6;">
                    </div>
                </div>
                ${isSelected ? (isAddMoreItems ? `
                    <div id="optional-${item.name.replace(/\s+/g, '-')}" style="padding: 16px; background: #f9fafb; border-radius: 6px; border-top: 1px solid #e5e7eb;">
                        <div style="color: #1f2937; font-size: 14px; margin-bottom: 12px;">
                            <strong>Please describe the items you need to move</strong>
                        </div>
                        <textarea class="form-input" id="office-custom-items-description" placeholder="e.g., 2x Whiteboards, 1x Water cooler, 3x Office plants..." rows="4" data-optional="true" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box; resize: vertical;"></textarea>
                    </div>
                ` : `
                    <div id="optional-${item.name.replace(/\s+/g, '-')}" style="padding: 16px; background: #f9fafb; border-radius: 6px; border-top: 1px solid #e5e7eb;">
                        <div style="color: #1f2937; font-size: 14px; margin-bottom: 16px;">
                            <strong>Optional</strong> - Please provide approximate measures and weight if possible
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px;">
                            <div>
                                <input type="number" class="form-input" placeholder="140" step="0.1" data-item="${item.name}" data-field="width" data-optional="true" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                            </div>
                            <div>
                                <input type="number" class="form-input" placeholder="93" step="0.1" data-item="${item.name}" data-field="depth" data-optional="true" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                            </div>
                            <div>
                                <input type="number" class="form-input" placeholder="100" step="0.1" data-item="${item.name}" data-field="height" data-optional="true" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                            </div>
                            <select class="form-input" data-item="${item.name}" data-field="unit" data-optional="true" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                                <option value="cm" selected>cm</option>
                                <option value="m">m</option>
                                <option value="inches">inches</option>
                            </select>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                            <div>
                                <input type="number" class="form-input" placeholder="20" step="0.1" data-item="${item.name}" data-field="weight" data-optional="true" style="width: 100%; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
                            </div>
                            <select class="form-input" data-item="${item.name}" data-field="weight-unit" data-optional="true" style="padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px; background: white;">
                                <option value="kg" selected>kg</option>
                                <option value="lbs">lbs</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 12px; justify-content: flex-end; align-items: center;">
                            <button type="button" class="btn-save-measurements" onclick="saveOfficeItemMeasurements('${item.name}')" style="padding: 8px 16px; background: white; color: #3b82f6; border: 1px solid #3b82f6; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="16"></line>
                                    <line x1="8" y1="12" x2="16" y2="12"></line>
                                </svg>
                                Save
                            </button>
                            <button type="button" class="btn-cancel-measurements" onclick="cancelOfficeItemMeasurements('${item.name}')" style="padding: 8px 16px; background: white; color: #6b7280; border: 1px solid #d1d5db; border-radius: 6px; cursor: pointer; font-size: 14px; display: flex; align-items: center; gap: 6px; font-weight: 500;">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                </svg>
                                Cancel
                            </button>
                        </div>
                    </div>
                `) : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function setupOfficeInventoryTabs() {
    const tabsContainer = document.getElementById('office-inventory-tabs');
    if (!tabsContainer || tabsContainer.dataset.ready === 'true') return;
    const hidden = document.getElementById('office-inventory-category');
    const tabs = Array.from(tabsContainer.querySelectorAll('.office-tab-btn'));
    if (tabs.length === 0) return;

    const initialCategory = (hidden && hidden.value)
        || window.officeInventoryCategory
        || tabs[0].getAttribute('data-category');
    setActiveOfficeTab(initialCategory, tabs, hidden);

    tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
            const category = btn.getAttribute('data-category');
            setActiveOfficeTab(category, tabs, hidden);
            renderOfficeInventory();
        });
    });

    tabsContainer.dataset.ready = 'true';
}

function setActiveOfficeTab(category, tabs, hidden) {
    if (!category) return;
    window.officeInventoryCategory = category;
    if (hidden) hidden.value = category;
    tabs.forEach((btn) => {
        const isActive = btn.getAttribute('data-category') === category;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
}

function increaseOfficeQuantity(item) {
    if (!window.officeItemQuantities) window.officeItemQuantities = {};
    window.officeItemQuantities[item] = (window.officeItemQuantities[item] || 0) + 1;
    renderOfficeInventory();
}

function decreaseOfficeQuantity(item) {
    if (!window.officeItemQuantities) window.officeItemQuantities = {};
    if (window.officeItemQuantities[item] > 0) {
        window.officeItemQuantities[item]--;
        renderOfficeInventory();
    }
}

function toggleOfficeItem(item, isChecked) {
    if (!window.officeItemQuantities) window.officeItemQuantities = {};
    if (isChecked && window.officeItemQuantities[item] === 0) {
        window.officeItemQuantities[item] = 1;
    } else if (!isChecked) {
        window.officeItemQuantities[item] = 0;
    }
    renderOfficeInventory();
}

function saveOfficeItemMeasurements(item) {
    // Save measurements - could be stored in a data structure for later use
    console.log('Measurements saved for:', item);
    const optionalSection = document.getElementById('optional-' + item.replace(/\s+/g, '-'));
    if (optionalSection) {
        optionalSection.style.display = 'none';
    }
}

function cancelOfficeItemMeasurements(item) {
    const optionalSection = document.getElementById('optional-' + item.replace(/\s+/g, '-'));
    if (optionalSection) {
        optionalSection.style.display = 'none';
    }
}

function showIndustrialSection() {
    const industrialSection = document.getElementById('industrial-section');
    const industrialWeightSection = document.getElementById('industrial-weight-section');
    if (industrialSection) {
        industrialSection.style.display = 'block';
    }
    if (industrialWeightSection) {
        industrialWeightSection.style.display = 'block';
    }
}

function hideIndustrialSection() {
    const industrialSection = document.getElementById('industrial-section');
    const industrialWeightSection = document.getElementById('industrial-weight-section');
    if (industrialSection) {
        industrialSection.style.display = 'none';
    }
    if (industrialWeightSection) {
        industrialWeightSection.style.display = 'none';
    }
}

// --- Google Maps route planner ---
// To fix API restrictions for local testing:
// 1. Go to: https://console.cloud.google.com/apis/library
// 2. Search for and ENABLE these APIs:
//    - "Routes API" (NEW - required for directions)
//    - "Maps JavaScript API"
//    - "Places API"
// 3. Go to: https://console.cloud.google.com/apis/credentials
// 4. Click your API key
// 5. Under "Application restrictions" select "None"
// 6. Under "API restrictions" ensure all 3 APIs above are checked
// 7. Save and wait 5 minutes for changes to propagate
const MAPS_API_KEY = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ';
const priceConfig = { base: 25, perKm: 1.2, minimum: 35 };

let map;
let directionsService;
let directionsRenderer;
let pickupAutocomplete;
let deliveryAutocomplete;


function loadGoogleMaps() {
    if (window.google && window.google.maps) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        if (document.getElementById('gmaps-script')) {
            document.getElementById('gmaps-script').addEventListener('load', resolve);
            document.getElementById('gmaps-script').addEventListener('error', reject);
            return;
        }

        const script = document.createElement('script');
        script.id = 'gmaps-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}&libraries=places&loading=async&callback=initMapCallback`;
        script.async = true;
        script.defer = true;
        
        window.initMapCallback = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function initRoutePlanner() {
    if (!window.mapboxgl) {
        console.warn('Mapbox GL not available. Showing static route preview.');
        showStaticRoutePreview();
        return;
    }

    const mapEl = document.getElementById('route-map');
    if (!mapEl) return;

    // Set your Mapbox access token here
    mapboxgl.accessToken = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ'; // Replace with your actual token
    
    try {
        map = new mapboxgl.Map({
            container: 'route-map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-6.2603, 53.3498], // Dublin [lng, lat]
            zoom: 7
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl());

        // Setup route calculation on address input
        map.on('load', () => {
            if (isMultiStopMode) {
                setupMultiStopRouteListeners();
            } else {
                setupRouteListeners();
            }
        });
    } catch (error) {
        console.error('Error initializing Mapbox:', error);
        showStaticRoutePreview();
    }
}

function showStaticRoutePreview() {
    // Fallback: show distance/price based on city/postcode (without Google Maps)
    const pickupCity = document.getElementById('pickup-city');
    const deliveryCity = document.getElementById('delivery-city');
    
    if (pickupCity && deliveryCity) {
        pickupCity.addEventListener('blur', estimateFromCities);
        deliveryCity.addEventListener('blur', estimateFromCities);
    }
    
    // Update map placeholder with error message
    const placeholder = document.querySelector('#route-map .map-placeholder');
    if (placeholder) {
        placeholder.innerHTML = '<strong>Google Maps Error</strong><br><small>Using basic distance estimator instead.<br>Check console for details or see API setup instructions in create-job.js</small>';
        placeholder.style.color = '#856404';
        placeholder.style.backgroundColor = '#fff3cd';
    }
}

function estimateFromCities() {
    const pickup = document.getElementById('pickup-city').value;
    const delivery = document.getElementById('delivery-city').value;
    if (!pickup || !delivery) return;

    // Simple distance estimate (in km) - would be more accurate with real coordinates
    const estimatedDistance = Math.random() * 50 + 15; // Random 15-65km for demo
    const estimatedMinutes = Math.ceil(estimatedDistance * 1.2); // ~1.2 min per km
    const price = calculatePrice(estimatedDistance);
    updateRouteUI(estimatedDistance, `~${estimatedMinutes} min`, price);
    persistRouteHiddenFields(estimatedDistance, `~${estimatedMinutes} min`, price);
}


let pickupPlacesService;
let deliveryPlacesService;
let placesService;

function setupRouteListeners() {
    const pickupInput = document.getElementById('pickup-address');
    const deliveryInput = document.getElementById('delivery-address');
    const pickupCity = document.getElementById('pickup-city');
    const deliveryCity = document.getElementById('delivery-city');
    const pickupPostcode = document.getElementById('pickup-postcode');
    const deliveryPostcode = document.getElementById('delivery-postcode');
    
    // Setup address autocomplete
    if (pickupInput) {
        setupAddressAutocomplete(pickupInput, 'pickup');
        pickupInput.addEventListener('blur', updateRouteIfReady);
        pickupInput.addEventListener('change', updateRouteIfReady);
    }
    if (deliveryInput) {
        setupAddressAutocomplete(deliveryInput, 'delivery');
        deliveryInput.addEventListener('blur', updateRouteIfReady);
        deliveryInput.addEventListener('change', updateRouteIfReady);
    }
    if (pickupCity) pickupCity.addEventListener('change', updateRouteIfReady);
    if (deliveryCity) deliveryCity.addEventListener('change', updateRouteIfReady);
    if (pickupPostcode) {
        setupPostcodeAutocomplete(pickupPostcode, 'pickup');
        pickupPostcode.addEventListener('blur', () => handleEircodeLookup(pickupPostcode, 'pickup'));
        pickupPostcode.addEventListener('change', () => handleEircodeLookup(pickupPostcode, 'pickup'));
    }
    if (deliveryPostcode) {
        setupPostcodeAutocomplete(deliveryPostcode, 'delivery');
        deliveryPostcode.addEventListener('blur', () => handleEircodeLookup(deliveryPostcode, 'delivery'));
        deliveryPostcode.addEventListener('change', () => handleEircodeLookup(deliveryPostcode, 'delivery'));
    }
}

function setupMultiStopRouteListeners() {
    const stopList = document.getElementById('multi-stop-list');
    if (!stopList) return;
    stopList.addEventListener('blur', (event) => {
        const target = event.target;
        if (!target) return;
        if (target.classList.contains('multi-stop-address')
            || target.classList.contains('multi-stop-city')
            || target.classList.contains('multi-stop-postcode')) {
            scheduleMultiStopRouteUpdate();
        }
    }, true);
}

function setupAddressAutocomplete(inputEl, type) {
    let debounceTimer;
    
    inputEl.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        inputEl.dataset.coords = '';
        inputEl.dataset.placeName = '';
        const value = e.target.value;
        
        if (value.length < 2) {
            removeAutocompleteList(inputEl);
            return;
        }
        
        debounceTimer = setTimeout(() => {
            fetchAddressSuggestions(value, inputEl, type);
        }, 300);
    });
    
    // Close autocomplete on blur (after a small delay to allow selection)
    inputEl.addEventListener('blur', () => {
        setTimeout(() => {
            removeAutocompleteList(inputEl);
        }, 200);
    });
}

function setupPostcodeAutocomplete(inputEl, type) {
    let debounceTimer;

    inputEl.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const normalized = normalizeEircodeInput(e.target.value);
        if (normalized !== e.target.value) {
            e.target.value = normalized;
        }

        if (normalized.length < 2) {
            removeAutocompleteList(inputEl);
            return;
        }

        debounceTimer = setTimeout(() => {
            fetchPostcodeSuggestions(normalized, inputEl, type);
            if (isEircode(normalized)) {
                if (type === 'multi-stop') {
                    handleMultiStopEircodeLookup(inputEl);
                } else {
                    handleEircodeLookup(inputEl, type);
                }
            }
        }, 250);
    });

    inputEl.addEventListener('blur', () => {
        setTimeout(() => {
            removeAutocompleteList(inputEl);
        }, 200);
    });
}

function getMultiStopIdFromInput(inputEl, suffix) {
    if (!inputEl || !inputEl.id) return '';
    const token = `-${suffix}`;
    if (!inputEl.id.endsWith(token)) return '';
    return inputEl.id.slice(0, -token.length);
}

function applyMultiStopAddressSuggestion(feature, inputEl) {
    const addressParts = feature.place_name.split(',');
    const mainAddress = addressParts[0].trim();
    inputEl.value = mainAddress;
    if (feature.geometry && feature.geometry.coordinates) {
        inputEl.dataset.coords = feature.geometry.coordinates.join(',');
    }
    inputEl.dataset.placeName = feature.place_name || '';

    const stopId = getMultiStopIdFromInput(inputEl, 'address');
    if (!stopId) return;
    const cityInput = document.getElementById(`${stopId}-city`);
    const postcodeInput = document.getElementById(`${stopId}-postcode`);

    const city = getCityFromFeature(feature);
    if (cityInput && city) cityInput.value = city;
    if (postcodeInput) {
        const eircode = getEircodeFromFeature(feature);
        if (eircode) postcodeInput.value = eircode;
    }

    scheduleMultiStopRouteUpdate();
}

function applyMultiStopEircodeFeature(feature, postcodeInput) {
    if (!feature || !postcodeInput) return;
    const stopId = getMultiStopIdFromInput(postcodeInput, 'postcode');
    if (!stopId) return;
    const addressInput = document.getElementById(`${stopId}-address`);
    const cityInput = document.getElementById(`${stopId}-city`);

    const eircode = getEircodeFromFeature(feature);
    if (eircode) postcodeInput.value = eircode;

    if (addressInput) {
        if (!addressInput.value) {
            addressInput.value = feature.place_name || postcodeInput.value;
        }
        if (feature.geometry && feature.geometry.coordinates) {
            addressInput.dataset.coords = feature.geometry.coordinates.join(',');
        }
        addressInput.dataset.placeName = feature.place_name || '';
    }

    const city = getCityFromFeature(feature);
    if (cityInput && city) {
        cityInput.value = city;
    }

    scheduleMultiStopRouteUpdate();
}

function handleMultiStopEircodeLookup(postcodeInput) {
    if (!postcodeInput) return;
    const normalized = normalizeEircodeInput(postcodeInput.value);
    if (normalized && normalized !== postcodeInput.value) {
        postcodeInput.value = normalized;
    }

    const lookupValue = isEircode(postcodeInput.value) ? postcodeInput.value : '';
    if (!lookupValue) {
        scheduleMultiStopRouteUpdate();
        return;
    }

    geocodeEircode(lookupValue).then(feature => {
        if (!feature) {
            scheduleMultiStopRouteUpdate();
            return;
        }

        applyMultiStopEircodeFeature(feature, postcodeInput);
    });
}


function normalizeEircodeInput(value) {
    if (!value) return '';
    const raw = String(value).trim().toUpperCase();
    if (!/[0-9]/.test(raw)) return raw;
    const stripped = raw.replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');
    const trimmed = stripped.slice(0, 7);
    if (trimmed.length <= 3) return trimmed;
    return `${trimmed.slice(0, 3)} ${trimmed.slice(3)}`.trim();
}

function fetchAddressSuggestions(query, inputEl, type) {
    const encodedQuery = encodeURIComponent(query);
    const countryParam = getGeocodeCountryParam(query);
    const typesParam = getGeocodeTypesParam(query, true);
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxgl.accessToken}&limit=5&country=${countryParam}&types=${typesParam}`;
    
    fetch(geocodeUrl)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                showAddressSuggestions(inputEl, data.features, type);
            } else {
                removeAutocompleteList(inputEl);
            }
        })
        .catch(err => {
            console.error('Autocomplete error:', err);
        });
}

function fetchPostcodeSuggestions(query, inputEl, type) {
    const encodedQuery = encodeURIComponent(query);
    const isExact = isEircode(query);
    const limit = isExact ? 1 : 5;
    const autocomplete = isExact ? 'false' : 'true';
    const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedQuery}.json?access_token=${mapboxgl.accessToken}&limit=${limit}&country=ie&types=postcode,address&autocomplete=${autocomplete}`;

    fetch(geocodeUrl)
        .then(response => response.json())
        .then(data => {
            const features = (data.features || []).filter(feature => getEircodeFromFeature(feature));
            if (features.length > 0) {
                showPostcodeSuggestions(inputEl, features, type);
            } else {
                removeAutocompleteList(inputEl);
            }
        })
        .catch(err => {
            console.error('Postcode autocomplete error:', err);
        });
}

function showAddressSuggestions(inputEl, features, type) {
    removeAutocompleteList(inputEl);
    
    if (!features || features.length === 0) return;
    
    const container = inputEl.parentElement;
    const list = document.createElement('ul');
    list.className = 'autocomplete-list';
    list.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ccc;
        border-top: none;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        margin: 0;
        padding: 0;
        list-style: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
    
    features.forEach(feature => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;';
        li.textContent = feature.place_name;
        
        li.addEventListener('mouseenter', () => li.style.backgroundColor = '#f5f5f5');
        li.addEventListener('mouseleave', () => li.style.backgroundColor = 'white');
        
        li.addEventListener('click', () => {
            selectAddressSuggestion(feature, inputEl, type);
            removeAutocompleteList(inputEl);
        });
        
        list.appendChild(li);
    });
    
    container.style.position = 'relative';
    container.appendChild(list);
}

function showPostcodeSuggestions(inputEl, features, type) {
    removeAutocompleteList(inputEl);

    if (!features || features.length === 0) return;

    const container = inputEl.parentElement;
    const list = document.createElement('ul');
    list.className = 'autocomplete-list';
    list.style.cssText = `
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #ccc;
        border-top: none;
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
        margin: 0;
        padding: 0;
        list-style: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    features.forEach(feature => {
        const li = document.createElement('li');
        li.style.cssText = 'padding: 10px; cursor: pointer; border-bottom: 1px solid #eee;';
        li.textContent = feature.place_name;

        li.addEventListener('mouseenter', () => li.style.backgroundColor = '#f5f5f5');
        li.addEventListener('mouseleave', () => li.style.backgroundColor = 'white');

        li.addEventListener('click', () => {
            selectPostcodeSuggestion(feature, inputEl, type);
            removeAutocompleteList(inputEl);
        });

        list.appendChild(li);
    });

    container.style.position = 'relative';
    container.appendChild(list);
}

function selectAddressSuggestion(feature, inputEl, type) {
    if (type === 'multi-stop') {
        applyMultiStopAddressSuggestion(feature, inputEl);
        return;
    }
    // Set the address to the place name
    const addressParts = feature.place_name.split(',');
    const mainAddress = addressParts[0].trim();
    inputEl.value = mainAddress;
    if (feature.geometry && feature.geometry.coordinates) {
        inputEl.dataset.coords = feature.geometry.coordinates.join(',');
    }
    inputEl.dataset.placeName = feature.place_name || '';
    
    // Extract city from the feature properties
    let city = '';
    
    // Try to get city and postcode from feature properties
    if (feature.context) {
        feature.context.forEach(ctx => {
            if (ctx.id.includes('place')) {
                city = ctx.text;
            }
        });
    }
    
    // Fallback: try to extract from place_name
    if (!city && addressParts.length > 1) {
        city = addressParts[addressParts.length - 2].trim();
    }
    
    // Set city and postcode fields
    if (type === 'pickup') {
        if (city) document.getElementById('pickup-city').value = city;
    } else if (type === 'delivery') {
        if (city) document.getElementById('delivery-city').value = city;
    }
    
    // Trigger route update if both addresses are filled
    setTimeout(updateRouteIfReady, 100);
}

function selectPostcodeSuggestion(feature, postcodeInput, type) {
    if (type === 'multi-stop') {
        applyMultiStopEircodeFeature(feature, postcodeInput);
        return;
    }
    const eircode = getEircodeFromFeature(feature);
    if (!eircode) return;
    postcodeInput.value = eircode;
    applyEircodeFeature(feature, type, postcodeInput);
}

function removeAutocompleteList(inputEl) {
    const existing = inputEl.parentElement.querySelector('.autocomplete-list');
    if (existing) {
        existing.remove();
    }
}

function applyEircodeFeature(feature, type, postcodeInput) {
    if (!feature) return;

    const addressInput = document.getElementById(type === 'pickup' ? 'pickup-address' : 'delivery-address');
    const cityInput = document.getElementById(type === 'pickup' ? 'pickup-city' : 'delivery-city');

    if (postcodeInput) {
        const eircode = getEircodeFromFeature(feature);
        if (eircode) {
            postcodeInput.value = eircode;
        }
    }

    if (addressInput) {
        if (!addressInput.value) {
            addressInput.value = feature.place_name || (postcodeInput ? postcodeInput.value : '');
        }
        if (feature.geometry && feature.geometry.coordinates) {
            addressInput.dataset.coords = feature.geometry.coordinates.join(',');
        }
        addressInput.dataset.placeName = feature.place_name || '';
    }

    const city = getCityFromFeature(feature);
    if (cityInput && city) {
        cityInput.value = city;
    }

    updateRouteIfReady();
}

function getEircodeFromFeature(feature) {
    if (!feature) return '';
    if (feature.text && isEircode(feature.text)) {
        return normalizeEircodeInput(feature.text);
    }
    if (feature.context) {
        const ctxPostcode = feature.context.find(ctx => ctx.id && ctx.id.includes('postcode'));
        if (ctxPostcode && isEircode(ctxPostcode.text)) {
            return normalizeEircodeInput(ctxPostcode.text);
        }
    }
    if (feature.place_name) {
        const fromText = findEircodeInText(feature.place_name);
        if (fromText) return fromText;
    }
    return '';
}

function handleEircodeLookup(postcodeInput, type) {
    if (!postcodeInput) return;
    const normalized = normalizeEircodeInput(postcodeInput.value);
    if (normalized && normalized !== postcodeInput.value) {
        postcodeInput.value = normalized;
    }

    const lookupValue = isEircode(postcodeInput.value) ? postcodeInput.value : '';
    if (!lookupValue) {
        updateRouteIfReady();
        return;
    }

    geocodeEircode(lookupValue).then(feature => {
        if (!feature) {
            updateRouteIfReady();
            return;
        }

        applyEircodeFeature(feature, type, postcodeInput);
    });
}

function geocodeEircode(eircode) {
    if (!mapboxgl || !mapboxgl.accessToken) {
        return Promise.resolve(null);
    }

    const encoded = encodeURIComponent(eircode);
    const primaryUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxgl.accessToken}&limit=1&country=ie&types=postcode&autocomplete=false`;
    const fallbackUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${mapboxgl.accessToken}&limit=1&country=ie&types=address,poi&autocomplete=false`;

    return fetch(primaryUrl)
        .then(response => response.json())
        .then(data => {
            if (data.features && data.features.length > 0) {
                return data.features[0];
            }
            return fetch(fallbackUrl)
                .then(response => response.json())
                .then(fallback => (fallback.features && fallback.features[0]) || null);
        })
        .catch(err => {
            console.error('Eircode geocoding error:', err);
            return null;
        });
}

function getCityFromFeature(feature) {
    if (!feature || !feature.context) return '';
    const place = feature.context.find(ctx => ctx.id && ctx.id.includes('place'));
    return place ? place.text : '';
}

function extractAndFillAddressComponents(components, type) {
    let city = '';
    let postcode = '';
    
    components.forEach(component => {
        if (component.types.includes('postal_code')) {
            postcode = component.long_name;
        }
        if (component.types.includes('locality') || component.types.includes('administrative_area_level_3')) {
            city = component.long_name;
        }
    });
    
    if (type === 'pickup') {
        if (city) document.getElementById('pickup-city').value = city;
        if (postcode) document.getElementById('pickup-postcode').value = postcode;
    } else if (type === 'delivery') {
        if (city) document.getElementById('delivery-city').value = city;
        if (postcode) document.getElementById('delivery-postcode').value = postcode;
    }
}

function updateRouteIfReady() {
    if (isMultiStopMode) {
        updateMultiStopRouteIfReady();
        return;
    }
    const pickupAddr = document.getElementById('pickup-address').value;
    const pickupCity = document.getElementById('pickup-city').value;
    const pickupPostcode = document.getElementById('pickup-postcode').value;
    const deliveryAddr = document.getElementById('delivery-address').value;
    const deliveryCity = document.getElementById('delivery-city').value;
    const deliveryPostcode = document.getElementById('delivery-postcode').value;
    const pickupInput = document.getElementById('pickup-address');
    const deliveryInput = document.getElementById('delivery-address');
    
    if (!pickupAddr || !pickupCity || !deliveryAddr || !deliveryCity) {
        console.log('Waiting for all address fields to be filled');
        return;
    }
    
    const pickupCoords = parseStoredCoords(pickupInput);
    const deliveryCoords = parseStoredCoords(deliveryInput);
    if (pickupCoords && deliveryCoords) {
        updateRouteLabels();
        calculateAndRenderRouteFromCoords(pickupCoords, deliveryCoords);
        return;
    }

    const pickupPlaceName = pickupInput?.dataset.placeName || '';
    const deliveryPlaceName = deliveryInput?.dataset.placeName || '';

    const pickupQuery = buildGeocodeQuery(pickupAddr, pickupCity, pickupPostcode);
    const deliveryQuery = buildGeocodeQuery(deliveryAddr, deliveryCity, deliveryPostcode);

    const origin = pickupPlaceName || pickupQuery;
    const destination = deliveryPlaceName || deliveryQuery;
    
    console.log('Calculating route from:', origin, 'to:', destination);
    updateRouteLabels();
    calculateAndRenderRoute(origin, destination);
}

function collectMultiStopStops() {
    const cards = Array.from(document.querySelectorAll('.multi-stop-card'));
    return cards.map((card, index) => {
        const stopId = card.dataset.stopId;
        const getValue = (selector) => {
            const field = card.querySelector(selector);
            return field ? field.value.trim() : '';
        };
        const getValueById = (suffix) => {
            if (!stopId) return '';
            const field = document.getElementById(`${stopId}-${suffix}`);
            return field ? field.value.trim() : '';
        };
        const rooms = Array.from(card.querySelectorAll('[data-room-entry]'))
            .map((row) => {
                const room = row.querySelector('.multi-stop-room-hidden')?.value.trim() || '';
                const items = row.querySelector('.multi-stop-room-items')?.value.trim() || '';
                return { room, items };
            })
            .filter((entry) => entry.room || entry.items);
        const items = Array.from(card.querySelectorAll('[data-item-row]'))
            .map((row) => {
                const name = row.querySelector('.multi-stop-item-name')?.value.trim() || '';
                const qtyRaw = row.querySelector('.multi-stop-item-qty')?.value || '1';
                const qty = parseInt(qtyRaw, 10);
                return {
                    name,
                    quantity: Number.isNaN(qty) ? 1 : qty
                };
            })
            .filter((item) => item.name);
        const houseState = stopId ? multiStopHouseState[stopId] : null;
        const officeState = stopId ? multiStopOfficeState[stopId] : null;
        const categoryDetails = {};
        const activeCategorySections = Array.from(card.querySelectorAll('.multi-stop-category-section'))
            .filter((section) => section.style.display !== 'none');
        activeCategorySections.forEach((section) => {
            const fields = Array.from(section.querySelectorAll('input, select, textarea'));
            fields.forEach((field) => {
                if (!field.id) return;
                const key = field.id.startsWith(`${stopId}-`) ? field.id.replace(`${stopId}-`, '') : field.id;
                if (field.type === 'checkbox' || field.type === 'radio') {
                    if (!field.checked) return;
                    if (!categoryDetails[key]) categoryDetails[key] = [];
                    categoryDetails[key].push(field.value || 'on');
                    return;
                }
                categoryDetails[key] = field.value;
            });
        });
        const houseCustom = card.querySelector('.multi-stop-house-custom')?.value.trim() || '';
        const houseExtra = card.querySelector('.multi-stop-house-extra')?.value.trim() || '';
        const officeCustom = card.querySelector('.multi-stop-office-custom')?.value.trim() || '';
        const packingSelections = Array.from(card.querySelectorAll(`input[name="${stopId}-packing"]:checked`)).map((input) => input.value);
        const twoPorters = card.querySelector('.multi-stop-two-porters')?.checked || false;
        const specialInstructions = card.querySelector('.multi-stop-special-instructions')?.value.trim() || '';
        const photoCount = Array.from(card.querySelectorAll('.multi-stop-photo-input'))
            .reduce((total, input) => total + (input.files ? input.files.length : 0), 0);
        const dimensions = Array.from(card.querySelectorAll('.multi-stop-dimension-item'))
            .map((item) => {
                const description = item.querySelector('.dimension-description')?.value.trim() || '';
                const width = item.querySelector('input[placeholder="Width"]')?.value || '';
                const depth = item.querySelector('input[placeholder="Depth"]')?.value || '';
                const height = item.querySelector('input[placeholder="Height"]')?.value || '';
                const weight = item.querySelector('input[placeholder="Weight"]')?.value || '';
                const units = item.querySelectorAll('.dimension-unit');
                const sizeUnit = units[0]?.value || '';
                const weightUnit = units[1]?.value || '';
                return {
                    description,
                    width,
                    depth,
                    height,
                    sizeUnit,
                    weight,
                    weightUnit
                };
            })
            .filter((entry) => Object.values(entry).some((val) => String(val).trim().length > 0));

        return {
            index: index + 1,
            role: card.dataset.stopRole || 'stop',
            category: getValue('.multi-stop-category'),
            address: getValueById('address'),
            city: getValueById('city'),
            postcode: getValueById('postcode'),
            locationType: getValue('.multi-stop-location-type'),
            floor: getValue('.multi-stop-floor'),
            elevator: getValue('.multi-stop-elevator'),
            rooms,
            items,
            notes: specialInstructions,
            categoryDetails,
            additionalInfo: {
                twoPorters,
                specialInstructions,
                photoCount,
                dimensions
            },
            houseInventory: houseState ? {
                selectedRooms: Array.from(houseState.selectedRooms),
                items: houseState.quantities,
                customItems: houseCustom,
                extraItems: houseExtra,
                packing: packingSelections
            } : null,
            officeInventory: officeState ? {
                category: officeState.category,
                items: officeState.quantities,
                customItems: officeCustom
            } : null
        };
    });
}

function updateMultiStopRouteIfReady() {
    if (!map) return;

    const stops = collectMultiStopStops();
    if (stops.length < 2) return;

    const missingFields = stops.some((stop) => !stop.address || !stop.city);
    if (missingFields) return;

    const queries = stops.map((stop) => buildGeocodeQuery(stop.address, stop.city, stop.postcode));
    Promise.all(
        queries.map((query, index) => geocodeAddress(query, `stop-${index + 1}`))
    )
        .then((coordsList) => {
            if (!coordsList || coordsList.some((coords) => !coords)) return;
            fetchMultiStopDirectionsAndRender(coordsList);
        })
        .catch((err) => {
            console.error('Multi-stop route error:', err);
        });
}

function fetchMultiStopDirectionsAndRender(coordsList) {
    if (!map || !coordsList || coordsList.length < 2) return;

    const coordsString = coordsList
        .map((coords) => `${coords[0]},${coords[1]}`)
        .join(';');
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?access_token=${mapboxgl.accessToken}&geometries=geojson&overview=full`;

    fetch(directionsUrl)
        .then((response) => response.json())
        .then((data) => {
            if (!data.routes || data.routes.length === 0) return;
            const route = data.routes[0];
            drawMultiStopRoute(route, coordsList);

            const distanceKm = route.distance / 1000;
            const durationMinutes = Math.ceil(route.duration / 60);
            const durationText = `${durationMinutes} min`;
            const price = calculatePrice(distanceKm);
            updateRouteUI(distanceKm, durationText, price);
            persistRouteHiddenFields(distanceKm, durationText, price);
        })
        .catch((err) => {
            console.error('Multi-stop directions error:', err);
        });
}

function drawMultiStopRoute(route, coordsList) {
    if (!map) return;

    if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
    }

    map.addSource('route', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: route.geometry
        }
    });

    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#4A90E2',
            'line-width': 4,
            'line-opacity': 0.8
        }
    });

    clearMultiStopMarkers();

    coordsList.forEach((coords, index) => {
        const isFirst = index === 0;
        const isLast = index === coordsList.length - 1;
        const color = isFirst ? '#10B981' : isLast ? '#EF4444' : '#3B82F6';
        const marker = new mapboxgl.Marker({ color })
            .setLngLat(coords)
            .setPopup(new mapboxgl.Popup().setText(`Stop ${index + 1}`))
            .addTo(map);
        multiStopMarkers.push(marker);
    });

    const bounds = new mapboxgl.LngLatBounds();
    coordsList.forEach((coords) => bounds.extend(coords));
    map.fitBounds(bounds, { padding: 60 });
}

function clearMultiStopMarkers() {
    multiStopMarkers.forEach((marker) => marker.remove());
    multiStopMarkers = [];
}

function calculateAndRenderRoute(origin, destination) {
    if (!map) {
        console.warn('Map not ready');
        estimateFromCities();
        return;
    }

    // Use Mapbox Geocoding API to convert addresses to coordinates
    geocodeAddress(origin, 'pickup').then(pickupCoords => {
        geocodeAddress(destination, 'delivery').then(deliveryCoords => {
            if (!pickupCoords || !deliveryCoords) {
                console.warn('Could not geocode addresses');
                estimateFromCities();
                return;
            }

            fetchDirectionsAndRender(pickupCoords, deliveryCoords);
        });
    });
}

function calculateAndRenderRouteFromCoords(pickupCoords, deliveryCoords) {
    if (!map) {
        console.warn('Map not ready');
        estimateFromCities();
        return;
    }
    fetchDirectionsAndRender(pickupCoords, deliveryCoords);
}

function fetchDirectionsAndRender(pickupCoords, deliveryCoords) {
    // Call Mapbox Directions API
    const directionsUrl = `https://api.mapbox.com/directions/v5/mapbox/driving/${pickupCoords[0]},${pickupCoords[1]};${deliveryCoords[0]},${deliveryCoords[1]}?access_token=${mapboxgl.accessToken}&geometries=geojson&overview=full`;
    
    fetch(directionsUrl)
        .then(response => response.json())
        .then(data => {
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                
                // Draw route on map
                drawMapRoute(route, pickupCoords, deliveryCoords);
                
                // Extract distance and duration
                const distanceKm = route.distance / 1000;
                const durationMinutes = Math.ceil(route.duration / 60);
                const durationText = `${durationMinutes} min`;
                const price = calculatePrice(distanceKm);
                
                console.log('Route calculated - Distance:', distanceKm.toFixed(2), 'km, Duration:', durationText);
                updateRouteUI(distanceKm, durationText, price);
                persistRouteHiddenFields(distanceKm, durationText, price);
            } else {
                console.error('No route found');
                estimateFromCities();
            }
        })
        .catch(err => {
            console.error('Directions API error:', err);
            estimateFromCities();
        });
}

function parseStoredCoords(inputEl) {
    if (!inputEl || !inputEl.dataset.coords) return null;
    const parts = inputEl.dataset.coords.split(',').map(val => parseFloat(val));
    if (parts.length !== 2 || parts.some(val => Number.isNaN(val))) return null;
    return parts;
}

function buildGeocodeQuery(address, city, postcode) {
    const parts = [];
    if (address) parts.push(address);
    if (city) parts.push(city);
    if (postcode) parts.push(postcode);
    parts.push('Ireland');
    return parts.join(', ');
}

function getGeocodeCountryParam(value) {
    if (isEircode(value)) {
        return 'ie';
    }
    return 'ie,gb';
}

function getGeocodeTypesParam(value, isAutocomplete) {
    if (isEircode(value)) {
        return isAutocomplete ? 'postcode' : 'postcode,address';
    }
    return 'address,place';
}

function isEircode(value) {
    if (!value) return false;
    const normalized = String(value).trim().toUpperCase();
    return /^[A-Z][0-9][A-Z0-9]\s?[A-Z0-9]{4}$/.test(normalized);
}


function findEircodeInText(text) {
    if (!text) return '';
    const match = String(text).toUpperCase().match(/[A-Z][0-9][A-Z0-9]\s?[A-Z0-9]{4}/);
    return match ? normalizeEircodeInput(match[0]) : '';
}

function geocodeAddress(address, type) {
    return new Promise((resolve) => {
        const encodedAddress = encodeURIComponent(address);
        const countryParam = getGeocodeCountryParam(address);
        const typesParam = getGeocodeTypesParam(address, false);
        const geocodeUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${mapboxgl.accessToken}&limit=1&country=${countryParam}&types=${typesParam}`;
        
        fetch(geocodeUrl)
            .then(response => response.json())
            .then(data => {
                if (data.features && data.features.length > 0) {
                    const coords = data.features[0].geometry.coordinates;
                    resolve(coords);
                } else {
                    console.warn(`Could not geocode ${type} address: ${address}`);
                    resolve(null);
                }
            })
            .catch(err => {
                console.error('Geocoding error:', err);
                resolve(null);
            });
    });
}

function drawMapRoute(route, pickupCoords, deliveryCoords) {
    if (!map) return;

    // Remove existing route layer and source if they exist
    if (map.getSource('route')) {
        map.removeLayer('route');
        map.removeSource('route');
    }

    // Add route as a new layer
    map.addSource('route', {
        type: 'geojson',
        data: {
            type: 'Feature',
            geometry: route.geometry
        }
    });

    map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#4A90E2',
            'line-width': 4,
            'line-opacity': 0.8
        }
    });

    // Add pickup marker
    if (document.getElementById('pickup-marker')) {
        document.getElementById('pickup-marker').remove();
    }
    new mapboxgl.Marker({ color: '#10B981' })
        .setLngLat(pickupCoords)
        .setPopup(new mapboxgl.Popup().setText('Pickup location'))
        .addTo(map);

    // Add delivery marker
    if (document.getElementById('delivery-marker')) {
        document.getElementById('delivery-marker').remove();
    }
    new mapboxgl.Marker({ color: '#EF4444' })
        .setLngLat(deliveryCoords)
        .setPopup(new mapboxgl.Popup().setText('Delivery location'))
        .addTo(map);

    // Fit map bounds to show route
    const bounds = new mapboxgl.LngLatBounds();
    bounds.extend(pickupCoords);
    bounds.extend(deliveryCoords);
    map.fitBounds(bounds, { padding: 50 });
}

function updateRouteUI(distanceKm, durationText, price) {
    const distanceEl = document.getElementById('route-distance');
    const durationEl = document.getElementById('route-duration');
    if (distanceEl) distanceEl.textContent = distanceKm ? `${distanceKm.toFixed(1)} km` : '—';
    if (durationEl) durationEl.textContent = durationText || '—';
    updateRouteLabels();
    // route-price element removed from UI, only using distance and duration
}

function persistRouteHiddenFields(distanceKm, durationText, price) {
    const distanceField = document.getElementById('route-distance-km');
    const durationField = document.getElementById('route-duration-text');
    const priceField = document.getElementById('route-price-estimate');
    if (distanceField) distanceField.value = distanceKm || '';
    if (durationField) durationField.value = durationText || '';
    if (priceField) priceField.value = price || '';
}

function calculatePrice(distanceKm) {
    if (!distanceKm) return null;
    const raw = priceConfig.base + priceConfig.perKm * distanceKm;
    return Math.max(priceConfig.minimum, raw);
}

function updateRouteLabels() {
    const pickupCity = document.getElementById('pickup-city');
    const deliveryCity = document.getElementById('delivery-city');
    const pickupLabel = document.getElementById('pickup-label');
    const deliveryLabel = document.getElementById('delivery-label');

    if (isMultiStopMode) {
        const stopCount = document.querySelectorAll('.multi-stop-card').length;
        if (pickupLabel) pickupLabel.textContent = stopCount > 0 ? 'Stop 1' : 'Pickup';
        if (deliveryLabel) deliveryLabel.textContent = stopCount > 1 ? `Stop ${stopCount}` : 'Delivery';
        return;
    }

    const pickupText = pickupCity && pickupCity.value ? pickupCity.value : 'Pickup';
    const deliveryText = deliveryCity && deliveryCity.value ? deliveryCity.value : 'Delivery';

    if (pickupLabel) pickupLabel.textContent = pickupText;
    if (deliveryLabel) deliveryLabel.textContent = deliveryText;
}

// Initialize Car Transport Dropdowns
let carDropdownsInitialized = false;

function initCarTransportDropdowns() {
    if (carDropdownsInitialized) {
        console.log('Car transport dropdowns already initialized');
        return;
    }
    
    console.log('Initializing car transport dropdowns...');
    
    const setupDropdown = (toggleId, menuId, labelId, hiddenId, isCheckbox = false) => {
        const toggle = document.getElementById(toggleId);
        const menu = document.getElementById(menuId);
        const label = document.getElementById(labelId);
        const hidden = document.getElementById(hiddenId);
        
        if (!toggle || !menu) {
            console.warn(`Dropdown elements not found: ${toggleId}, ${menuId}`);
            return;
        }
        
        console.log(`Setting up dropdown: ${toggleId}`);
        
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Close all other car dropdowns first
            document.querySelectorAll('#car-value-menu, #car-transport-method-menu, #car-condition-menu, #car-weight-menu, #car-length-menu').forEach(m => {
                if (m !== menu) {
                    m.classList.remove('active');
                }
            });
            document.querySelectorAll('#car-value-toggle, #car-transport-method-toggle, #car-condition-toggle, #car-weight-toggle, #car-length-toggle').forEach(t => {
                if (t !== toggle) {
                    t.classList.remove('active');
                }
            });
            
            // Toggle current dropdown
            menu.classList.toggle('active');
            toggle.classList.toggle('active');
        });
        
        if (isCheckbox) {
            // Handle checkbox selections for transport method
            const checkboxes = menu.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.addEventListener('change', function(e) {
                    e.stopPropagation();
                    const selectedMethods = Array.from(checkboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.parentElement.querySelector('.option-text').textContent);
                    
                    if (selectedMethods.length > 0) {
                        label.textContent = selectedMethods.join(', ');
                        label.style.color = '#374151';
                        if (hidden) hidden.value = selectedMethods.join(', ');
                    } else {
                        label.textContent = 'Select your preferred transport method';
                        label.style.color = '#9ca3af';
                        if (hidden) hidden.value = '';
                    }
                });
            });
            
            menu.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        } else {
            // Handle regular dropdown items
            const items = menu.querySelectorAll('.dropdown-item');
            items.forEach(item => {
                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const value = item.getAttribute('data-value');
                    const text = item.textContent.trim();
                    if (hidden) hidden.value = value || '';
                    if (label) {
                        label.textContent = text;
                        label.style.color = '#374151';
                    }
                    menu.classList.remove('active');
                    toggle.classList.remove('active');
                });
            });
        }
    };
    
    // Setup all dropdowns
    setupDropdown('car-value-toggle', 'car-value-menu', 'car-value-label', 'car-value-hidden', false);
    setupDropdown('car-transport-method-toggle', 'car-transport-method-menu', 'car-transport-method-label', 'car-transport-method-hidden', true);
    setupDropdown('car-condition-toggle', 'car-condition-menu', 'car-condition-label', 'car-condition-hidden', false);
    setupDropdown('car-weight-toggle', 'car-weight-menu', 'car-weight-label', 'car-weight-hidden', false);
    setupDropdown('car-length-toggle', 'car-length-menu', 'car-length-label', 'car-length-hidden', false);
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-dropdown-wrapper')) {
            document.querySelectorAll('#car-value-menu, #car-transport-method-menu, #car-condition-menu, #car-weight-menu, #car-length-menu').forEach(menu => {
                menu.classList.remove('active');
            });
            document.querySelectorAll('#car-value-toggle, #car-transport-method-toggle, #car-condition-toggle, #car-weight-toggle, #car-length-toggle').forEach(toggle => {
                toggle.classList.remove('active');
            });
        }
    });
    
    carDropdownsInitialized = true;
    console.log('Car transport dropdowns initialized successfully');
}

// Motorbike transport dropdowns initialization
let motorbikeDropdownsInitialized = false;

function initMotorbikeTransportDropdowns() {
    if (motorbikeDropdownsInitialized) {
        console.log('Motorbike transport dropdowns already initialized');
        return;
    }
    
    console.log('Initializing motorbike transport dropdowns...');
    
    const setupDropdown = (toggleId, menuId, labelId, hiddenId) => {
        const toggle = document.getElementById(toggleId);
        const menu = document.getElementById(menuId);
        const label = document.getElementById(labelId);
        const hidden = document.getElementById(hiddenId);
        
        if (!toggle || !menu) {
            console.warn(`Dropdown elements not found: ${toggleId}, ${menuId}`);
            return;
        }
        
        console.log(`Setting up dropdown: ${toggleId}`);
        
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Close all other motorbike dropdowns first
            document.querySelectorAll('#motorbike-value-menu, #motorbike-condition-menu, #motorbike-weight-menu').forEach(m => {
                if (m !== menu) {
                    m.classList.remove('active');
                }
            });
            document.querySelectorAll('#motorbike-value-toggle, #motorbike-condition-toggle, #motorbike-weight-toggle').forEach(t => {
                if (t !== toggle) {
                    t.classList.remove('active');
                }
            });
            
            // Toggle current dropdown
            menu.classList.toggle('active');
            toggle.classList.toggle('active');
        });
        
        // Handle regular dropdown items
        const items = menu.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const value = item.getAttribute('data-value');
                const text = item.textContent.trim();
                if (hidden) hidden.value = value || '';
                if (label) {
                    label.textContent = text;
                    label.style.color = '#374151';
                }
                menu.classList.remove('active');
                toggle.classList.remove('active');
            });
        });
    };
    
    // Setup all dropdowns
    setupDropdown('motorbike-value-toggle', 'motorbike-value-menu', 'motorbike-value-label', 'motorbike-value-hidden');
    setupDropdown('motorbike-condition-toggle', 'motorbike-condition-menu', 'motorbike-condition-label', 'motorbike-condition-hidden');
    setupDropdown('motorbike-weight-toggle', 'motorbike-weight-menu', 'motorbike-weight-label', 'motorbike-weight-hidden');
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-dropdown-wrapper')) {
            document.querySelectorAll('#motorbike-value-menu, #motorbike-condition-menu, #motorbike-weight-menu').forEach(menu => {
                menu.classList.remove('active');
            });
            document.querySelectorAll('#motorbike-value-toggle, #motorbike-condition-toggle, #motorbike-weight-toggle').forEach(toggle => {
                toggle.classList.remove('active');
            });
        }
    });
    
    motorbikeDropdownsInitialized = true;
    console.log('Motorbike transport dropdowns initialized successfully');
}

let trailerCampervanDropdownsInitialized = false;

function initTrailerCampervanDropdowns() {
    if (trailerCampervanDropdownsInitialized) {
        console.log('Trailer/campervan dropdowns already initialized, skipping');
        return;
    }
    
    console.log('Initializing trailer/campervan transport dropdowns');
    
    const setupDropdown = (toggleId, menuId, labelId, hiddenId) => {
        const toggle = document.getElementById(toggleId);
        const menu = document.getElementById(menuId);
        const label = document.getElementById(labelId);
        const hidden = document.getElementById(hiddenId);
        
        if (!toggle || !menu) {
            console.error('Missing element:', toggleId, menuId);
            return;
        }
        
        // Handle toggle click
        toggle.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Close other trailer/campervan dropdowns
            document.querySelectorAll('#trailer-campervan-type-menu, #trailer-campervan-value-menu, #trailer-campervan-delivery-menu').forEach(m => {
                if (m !== menu) {
                    m.classList.remove('active');
                }
            });
            document.querySelectorAll('#trailer-campervan-type-toggle, #trailer-campervan-value-toggle, #trailer-campervan-delivery-toggle').forEach(t => {
                if (t !== toggle) {
                    t.classList.remove('active');
                }
            });
            
            // Toggle current dropdown
            menu.classList.toggle('active');
            toggle.classList.toggle('active');
        });
        
        // Handle regular dropdown items
        const items = menu.querySelectorAll('.dropdown-item');
        items.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                const value = item.getAttribute('data-value');
                const text = item.textContent.trim();
                if (hidden) hidden.value = value || '';
                if (label) {
                    label.textContent = text;
                    label.style.color = '#374151';
                }
                menu.classList.remove('active');
                toggle.classList.remove('active');
            });
        });
    };
    
    // Setup all dropdowns
    setupDropdown('trailer-campervan-type-toggle', 'trailer-campervan-type-menu', 'trailer-campervan-type-label', 'trailer-campervan-type-hidden');
    setupDropdown('trailer-campervan-value-toggle', 'trailer-campervan-value-menu', 'trailer-campervan-value-label', 'trailer-campervan-value-hidden');
    setupDropdown('trailer-campervan-delivery-toggle', 'trailer-campervan-delivery-menu', 'trailer-campervan-delivery-label', 'trailer-campervan-delivery-hidden');
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.custom-dropdown-wrapper')) {
            document.querySelectorAll('#trailer-campervan-type-menu, #trailer-campervan-value-menu, #trailer-campervan-delivery-menu').forEach(menu => {
                menu.classList.remove('active');
            });
            document.querySelectorAll('#trailer-campervan-type-toggle, #trailer-campervan-value-toggle, #trailer-campervan-delivery-toggle').forEach(toggle => {
                toggle.classList.remove('active');
            });
        }
    });
    
    trailerCampervanDropdownsInitialized = true;
    console.log('Trailer/campervan transport dropdowns initialized successfully');
}

// Check URL parameters and auto-select service
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const service = urlParams.get('service');

    if (isMultiStopMode) {
        return;
    }
    
    if (service === 'house-removals') {
        document.querySelector('.service-icon-btn[data-value="House Removals"]')?.click();
    }
    
    if (service === 'Car Transport') {
        document.querySelector('.service-icon-btn[data-value="Car Transport"]')?.click();
    }
});
