// House Removal Modal JavaScript

const ROOM_ITEMS = {
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

let currentRoom = '';
let itemQuantities = {};
let selectedRooms = new Set();
let roomListenersAttached = false;

// Initialize quantities
Object.keys(ROOM_ITEMS).forEach(room => {
    ROOM_ITEMS[room].forEach(item => {
        itemQuantities[item] = 0;
    });
});

// Inline inventory - no modal needed anymore

function setupRoomTabListeners() {
    if (roomListenersAttached) return;
    const roomTabs = document.querySelectorAll('#house-removal-inventory-section .room-tab-btn');
    roomTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const room = tab.getAttribute('data-room');
            const isSelected = tab.classList.contains('is-selected');

            if (isSelected) {
                tab.classList.remove('is-selected');
                tab.setAttribute('aria-pressed', 'false');
                selectedRooms.delete(room);

                if (currentRoom === room) {
                    const nextRoom = Array.from(selectedRooms)[0];
                    if (nextRoom) {
                        setActiveRoom(nextRoom);
                    } else {
                        clearActiveRoom();
                    }
                }
            } else {
                selectedRooms.add(room);
                tab.classList.add('is-selected');
                tab.setAttribute('aria-pressed', 'true');
                setActiveRoom(room);
            }

            updateRoomSelectionState();
        });
    });
    roomListenersAttached = true;
}

function selectRoom(room) {
    const tab = document.querySelector(`#house-removal-inventory-section .room-tab-btn[data-room="${room}"]`);
    if (!tab) return;

    selectedRooms.add(room);
    tab.classList.add('is-selected');
    tab.setAttribute('aria-pressed', 'true');
    setActiveRoom(room);
    updateRoomSelectionState();
}

function setActiveRoom(room) {
    const roomTabs = document.querySelectorAll('#house-removal-inventory-section .room-tab-btn');
    roomTabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-room') === room));
    currentRoom = room;
    renderRoomItems(room);
}

function clearActiveRoom() {
    const roomTabs = document.querySelectorAll('#house-removal-inventory-section .room-tab-btn');
    roomTabs.forEach(t => t.classList.remove('active'));
    currentRoom = '';
    renderRoomItems(null);
}

function updateRoomSelectionState() {
    const hiddenField = document.getElementById('house-rooms-hidden');
    if (hiddenField) {
        hiddenField.value = Array.from(selectedRooms).join(',');
    }

    if (selectedRooms.size > 0) {
        const error = document.getElementById('room-selection-error');
        if (error) error.style.display = 'none';
        const tabs = document.getElementById('room-tabs');
        if (tabs) tabs.classList.remove('is-required');
    }

    if (typeof window.updateProgressiveFlow === 'function') {
        window.updateProgressiveFlow();
    }
}

function initializeRoomSelection(defaultRoom) {
    selectedRooms = new Set();
    const roomTabs = document.querySelectorAll('#house-removal-inventory-section .room-tab-btn');
    roomTabs.forEach(tab => {
        tab.classList.remove('active', 'is-selected');
        tab.setAttribute('aria-pressed', 'false');
    });
    currentRoom = '';

    if (defaultRoom) {
        selectRoom(defaultRoom);
        return;
    }

    renderRoomItems(null);
    updateRoomSelectionState();
}

function renderRoomItems(room) {
    const container = document.getElementById('room-items-container');
    if (!container) return;
    const items = room ? ROOM_ITEMS[room] : null;

    if (!items) {
        container.innerHTML = '<div class="room-empty-state">Select a room icon to view items.</div>';
        return;
    }

    let html = '';

    items.forEach(item => {
        const qty = itemQuantities[item] || 0;
        const isSelected = qty > 0;
        html += `
            <li class="room-item ${isSelected ? 'selected' : ''}">
                <span class="room-item-name">${item}</span>
                <div class="room-item-controls">
                    <button type="button" class="room-item-quantity-btn minus" data-item="${item}" onclick="decreaseQuantity('${item}')" ${qty === 0 ? 'disabled' : ''}>−</button>
                    <span class="room-item-quantity-display">${qty}</span>
                    <button type="button" class="room-item-quantity-btn plus" data-item="${item}" onclick="increaseQuantity('${item}')">+</button>
                </div>
            </li>
        `;
    });



    container.innerHTML = html;
}

function increaseQuantity(item) {
    itemQuantities[item] = (itemQuantities[item] || 0) + 1;
    renderRoomItems(currentRoom);
}

function decreaseQuantity(item) {
    if (itemQuantities[item] > 0) {
        itemQuantities[item]--;
        renderRoomItems(currentRoom);
    }
}

function setupExpandableToggle() {
    const expandables = document.querySelectorAll('.expandable');
    expandables.forEach(expandable => {
        const header = expandable.querySelector('h3');
        if (header) {
            header.addEventListener('click', () => {
                expandable.classList.toggle('collapsed');
            });
        }
    });
}

// Handle form submission
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('house-removal-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Collect form data
            const formData = {
                serviceType: document.getElementById('removal-service-type').value,
                movingFromType: document.getElementById('moving-from-type').value,
                movingToType: document.getElementById('moving-to-type').value,
                items: itemQuantities,
                packing: Array.from(document.querySelectorAll('input[name="packing"]:checked')).map(cb => cb.value),
                moveDate: document.getElementById('move-date').value,
                specialInstructions: document.getElementById('special-instructions').value,
                customItems: document.getElementById('custom-items-textarea')?.value || '',
                extraItems: document.getElementById('extra-items-textarea')?.value || ''
            };
            
            // Validate required fields
            if (!formData.serviceType || !formData.movingFromType || !formData.movingToType || !formData.moveDate) {
                alert('Please fill in all required fields');
                return;
            }
            
            // Check if at least one item is selected
            const hasItems = Object.values(itemQuantities).some(qty => qty > 0);
            if (!hasItems && !formData.customItems) {
                alert('Please select at least one item or add custom items');
                return;
            }
            
            // Save to localStorage and proceed
            localStorage.setItem('house_removal_quote', JSON.stringify(formData));
            
            // You can either:
            // 1. Show a confirmation message
            alert('Quote request submitted! We will contact you soon with prices.');
            
            // 2. Or redirect to a quote summary page
            // window.location.href = 'quote-summary.html';
            
            // 3. Or close the modal and show success message
            closeHouseRemovalModal();
        });
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('house-removal-modal');
    if (modal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeHouseRemovalModal();
            }
        });
    }
});

window.getSelectedHouseRooms = function() {
    return Array.from(selectedRooms);
};

// Prevent form submission on room tab buttons
document.addEventListener('DOMContentLoaded', () => {
    const roomTabs = document.querySelectorAll('#house-removal-inventory-section .room-tab-btn');
    roomTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });
});
