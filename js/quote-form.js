// Quote Form Functionality
(function() {
    // Inventory item selection
    const inventoryItems = document.querySelectorAll('.inventory-item');
    const selectedItems = new Set();

    inventoryItems.forEach(item => {
        item.addEventListener('click', function() {
            const itemName = this.getAttribute('data-item');
            
            if (this.classList.contains('selected')) {
                this.classList.remove('selected');
                selectedItems.delete(itemName);
            } else {
                this.classList.add('selected');
                selectedItems.add(itemName);
            }
            
            // Store selection
            localStorage.setItem('selected_inventory_items', JSON.stringify(Array.from(selectedItems)));
        });
    });

    // Load previously selected items
    const saved = localStorage.getItem('selected_inventory_items');
    if (saved) {
        try {
            const items = JSON.parse(saved);
            items.forEach(itemName => {
                const element = document.querySelector(`.inventory-item[data-item="${itemName}"]`);
                if (element) {
                    element.classList.add('selected');
                    selectedItems.add(itemName);
                }
            });
        } catch(e) {
            console.error('Error loading saved inventory items:', e);
        }
    }

    // Continue button functionality
    const continueBtn = document.getElementById('start-quote-btn');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            const pickupPostcode = document.getElementById('pickupPostcode')?.value || '';
            const deliveryPostcode = document.getElementById('deliveryPostcode')?.value || '';
            const pickupProperty = document.getElementById('pickupPropertyType')?.value || '';
            const deliveryProperty = document.getElementById('deliveryPropertyType')?.value || '';

            const payload = {
                pickupPostcode,
                deliveryPostcode,
                pickupPropertyType: pickupProperty,
                deliveryPropertyType: deliveryProperty,
                inventoryItems: Array.from(selectedItems),
                savedAt: Date.now()
            };

            localStorage.setItem('anytransport_quote_data', JSON.stringify(payload));
            
            // Navigate to detailed form
            if (document.getElementById('house-removal-modal')) {
                // Open modal if exists
                document.getElementById('house-removal-modal').style.display = 'flex';
            } else {
                // Navigate to create job page
                window.location.href = 'create-job.html';
            }
        });
    }
})();
