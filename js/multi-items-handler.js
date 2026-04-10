// Multi-item handler for Pianos and Vehicles
// Stores and manages multiple pianos and vehicles with JSON serialization

window.multiItemsManager = {
    editingVehicleIds: {},
    // Parse stored pianos from JSON
    parsePianos() {
        const hidden = document.getElementById('pianos-json-hidden');
        if (!hidden || !hidden.value) return [];
        try {
            return JSON.parse(hidden.value);
        } catch (e) {
            return [];
        }
    },

    // Save pianos to JSON
    savePianos(pianos) {
        const hidden = document.getElementById('pianos-json-hidden');
        if (hidden) {
            hidden.value = pianos.length > 0 ? JSON.stringify(pianos) : '';
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
    },

    // Add a piano entry
    addPiano(pianoData) {
        const pianos = this.parsePianos();
        if (pianos.length >= 100) {
            alert('Maximum 100 pianos allowed');
            return false;
        }
        pianos.push({
            ...pianoData,
            id: Date.now() + Math.random()
        });
        this.savePianos(pianos);
        this.renderPianosList();
        return true;
    },

    // Delete a piano entry
    deletePiano(pianoId) {
        let pianos = this.parsePianos();
        pianos = pianos.filter(p => p.id !== pianoId);
        this.savePianos(pianos);
        this.renderPianosList();
    },

    // Render pianos list
    renderPianosList() {
        const listContainer = document.getElementById('pianos-list');
        if (!listContainer) return;

        const pianos = this.parsePianos();
        listContainer.innerHTML = '';

        if (pianos.length === 0) {
            return;
        }

        pianos.forEach((piano, index) => {
            const pianoEl = document.createElement('div');
            pianoEl.style.cssText = 'padding: 12px; margin-bottom: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; display: flex; align-items: center; justify-content: space-between;';

            const detailEl = document.createElement('div');
            const typeLabel = this.getPianoTypeLabel(piano.type);
            const typeGroupLabel = this.getPianoTypeGroupLabel(piano.type);
            let sizeLabel = '';

            if (piano.isCustomType || piano.isCustomSize) {
                const customDims = [piano.customLength, piano.customWidth, piano.customHeight]
                    .map((v) => String(v || '').trim())
                    .filter(Boolean)
                    .join(' x ');
                const customUnit = String(piano.customUnit || '').trim();
                const customDimsLabel = customDims ? `${customDims}${customUnit ? ` ${customUnit}` : ''}` : '';
                const customName = String(piano.customName || '').trim();
                sizeLabel = customName && customDimsLabel
                    ? `Model: ${customName} (${customDimsLabel})`
                    : customName
                        ? `Model: ${customName}`
                        : customDimsLabel
                            ? `Custom size: ${customDimsLabel}`
                            : 'Custom size';
            } else if (piano.type === 'unknown') {
                const approxDims = [piano.lengthMeasurement, piano.widthMeasurement, piano.heightMeasurement]
                    .map((v) => String(v || '').trim())
                    .filter(Boolean)
                    .join(' x ');
                sizeLabel = approxDims ? `Approx: ${approxDims} cm` : 'Details from uploaded media';
            } else {
                sizeLabel = this.getPianoSizeLabel(piano.size);
            }

            detailEl.innerHTML = `<strong>Piano ${index + 1}:</strong> ${typeLabel}${typeGroupLabel ? ` (${typeGroupLabel})` : ''}${sizeLabel ? ' - ' + sizeLabel : ''}`;
            detailEl.style.flex = '1';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = '✕ Remove';
            deleteBtn.style.cssText = 'padding: 6px 12px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem;';
            deleteBtn.addEventListener('click', () => {
                this.deletePiano(piano.id);
                if (window.updateNextButtonState) window.updateNextButtonState();
            });

            pianoEl.appendChild(detailEl);
            pianoEl.appendChild(deleteBtn);
            listContainer.appendChild(pianoEl);
        });
    },

    getPianoTypeLabel(typeValue) {
        const labels = {
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
        return labels[typeValue] || typeValue;
    },

    getPianoTypeGroupLabel(typeValue) {
        const key = String(typeValue || '').trim();
        if (!key) return '';
        if (key.startsWith('upright-')) return 'Upright';
        if (key.includes('grand')) return 'Grand';
        if (key === 'digital' || key === 'keyboard') return 'Electronic';
        if (key === 'custom') return 'Custom';
        if (key === 'unknown') return 'Unknown type';
        return '';
    },

    getPianoSizeLabel(sizeValue) {
        const labels = {
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
        return labels[sizeValue] || '';
    },

    // Generic vehicle handlers
    parseVehicles(vehicleType) {
        const hidden = document.getElementById(`${vehicleType}-json-hidden`);
        if (!hidden || !hidden.value) return [];
        try {
            return JSON.parse(hidden.value);
        } catch (e) {
            return [];
        }
    },

    saveVehicles(vehicleType, vehicles) {
        const hidden = document.getElementById(`${vehicleType}-json-hidden`);
        if (hidden) {
            hidden.value = vehicles.length > 0 ? JSON.stringify(vehicles) : '';
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }
    },

    addVehicle(vehicleType, vehicleData) {
        const vehicles = this.parseVehicles(vehicleType);
        if (vehicles.length >= 100) {
            alert(`Maximum 100 ${vehicleType}s allowed`);
            return false;
        }
        vehicles.push({
            ...vehicleData,
            id: Date.now() + Math.random()
        });
        this.saveVehicles(vehicleType, vehicles);
        this.renderVehiclesList(vehicleType);
        return true;
    },

    updateVehicle(vehicleType, vehicleId, vehicleData) {
        const vehicles = this.parseVehicles(vehicleType);
        const index = vehicles.findIndex(v => v.id === vehicleId);
        if (index === -1) {
            return false;
        }

        vehicles[index] = {
            ...vehicles[index],
            ...vehicleData,
            id: vehicleId
        };

        this.saveVehicles(vehicleType, vehicles);
        this.renderVehiclesList(vehicleType);
        return true;
    },

    deleteVehicle(vehicleType, vehicleId) {
        let vehicles = this.parseVehicles(vehicleType);
        vehicles = vehicles.filter(v => v.id !== vehicleId);
        this.saveVehicles(vehicleType, vehicles);
        if (this.editingVehicleIds[vehicleType] === vehicleId) {
            this.editingVehicleIds[vehicleType] = null;
            this.updateVehicleEditUi(vehicleType);
        }
        this.renderVehiclesList(vehicleType);
    },

    setVehicleFormNavValue(vehicleType, suffix, value) {
        const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
        if (hidden) {
            hidden.value = value || '';
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const buttons = document.querySelectorAll(`.${vehicleType}-${suffix}-entry-nav .option-nav-btn`);
        buttons.forEach((btn) => {
            const isSelected = String(btn.dataset.value || '') === String(value || '');
            btn.classList.toggle('selected', isSelected);
            btn.classList.toggle('is-active', isSelected);
            btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
            btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
        });
    },

    syncVehicleCustomFieldVisibility(vehicleType) {
        const weightHidden = document.getElementById(`${vehicleType}-weight-entry-hidden`);
        const lengthHidden = document.getElementById(`${vehicleType}-length-entry-hidden`);
        const customWeightWrap = document.getElementById(`${vehicleType}-custom-weight-wrap`);
        const customLengthWrap = document.getElementById(`${vehicleType}-custom-length-wrap`);
        const customWeightInput = document.getElementById(`${vehicleType}-custom-weight`);
        const customLengthInput = document.getElementById(`${vehicleType}-custom-length`);

        const getResolvedNavValue = (hiddenInput, navSelector) => {
            const hiddenValue = String(hiddenInput?.value || '').trim();
            if (hiddenValue) return hiddenValue;

            const nav = document.querySelector(navSelector);
            if (!nav) return '';

            const selectedBtn = nav.querySelector('.option-nav-btn.selected')
                || nav.querySelector('.option-nav-btn.is-active')
                || nav.querySelector('.option-nav-btn[aria-checked="true"]')
                || nav.querySelector('.option-nav-btn[aria-pressed="true"]');

            const selectedValue = selectedBtn ? String(selectedBtn.getAttribute('data-value') || '').trim() : '';
            if (selectedValue && hiddenInput) {
                hiddenInput.value = selectedValue;
            }
            return selectedValue;
        };

        const isCustomLike = (value) => {
            const normalized = String(value || '').trim().toLowerCase();
            return normalized === 'custom' || normalized === 'other' || normalized === 'other-approx';
        };

        const resolvedWeightValue = getResolvedNavValue(weightHidden, `.${vehicleType}-weight-entry-nav`);
        const resolvedLengthValue = getResolvedNavValue(lengthHidden, `.${vehicleType}-length-entry-nav`);

        const showCustomWeight = isCustomLike(resolvedWeightValue);
        const showCustomLength = isCustomLike(resolvedLengthValue);

        if (customWeightWrap) {
            customWeightWrap.style.display = showCustomWeight ? '' : 'none';
        }
        if (!showCustomWeight && customWeightInput) {
            customWeightInput.value = '';
        }

        if (customLengthWrap) {
            customLengthWrap.style.display = showCustomLength ? '' : 'none';
        }
        if (!showCustomLength && customLengthInput) {
            customLengthInput.value = '';
        }
    },

    formatVehicleMeasurement(vehicle, kind) {
        const selected = String(vehicle?.[kind] || '').trim();
        if (selected !== 'custom') {
            return selected;
        }

        const isWeight = kind === 'weight';
        const valueKey = isWeight ? 'customWeight' : 'customLength';
        const unitKey = isWeight ? 'customWeightUnit' : 'customLengthUnit';
        const fallbackUnit = isWeight ? 'kg' : 'mm';

        const customValue = String(vehicle?.[valueKey] || '').trim();
        const customUnit = String(vehicle?.[unitKey] || fallbackUnit).trim();

        if (!customValue) {
            return isWeight ? 'Other (approx.)' : 'Other';
        }

        return isWeight
            ? `Approx. ${customValue} ${customUnit}`
            : `${customValue} ${customUnit}`;
    },

    getVehicleFloorsLabel(vehicle) {
        if (!vehicle.floors || !Array.isArray(vehicle.floors) || vehicle.floors.length === 0) {
            return '';
        }
        return vehicle.floors.join(', ');
    },

    parseVehicleMediaFromHidden(vehicleType) {
        const hidden = document.getElementById(`${vehicleType}-media-hidden`);
        if (!hidden || !hidden.value) return [];
        try {
            const parsed = JSON.parse(hidden.value);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((item) => ({
                    name: String(item?.name || '').trim(),
                    type: String(item?.type || '').trim(),
                    size: Number(item?.size || 0) || 0,
                    dataUrl: String(item?.dataUrl || '').trim()
                }))
                .filter((item) => item.name);
        } catch (_error) {
            return [];
        }
    },

    saveVehicleMediaToHidden(vehicleType, mediaItems) {
        const hidden = document.getElementById(`${vehicleType}-media-hidden`);
        if (!hidden) return;
        hidden.value = Array.isArray(mediaItems) && mediaItems.length > 0
            ? JSON.stringify(mediaItems)
            : '';
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
    },

    formatVehicleMediaLabel(vehicle) {
        const mediaItems = Array.isArray(vehicle?.media) ? vehicle.media : [];
        if (mediaItems.length === 0) return '';

        const imageCount = mediaItems.filter((item) => String(item?.type || '').startsWith('image/')).length;
        const videoCount = mediaItems.filter((item) => String(item?.type || '').startsWith('video/')).length;

        const parts = [];
        if (imageCount > 0) parts.push(`${imageCount} photo${imageCount === 1 ? '' : 's'}`);
        if (videoCount > 0) parts.push(`${videoCount} video${videoCount === 1 ? '' : 's'}`);
        if (parts.length === 0) parts.push(`${mediaItems.length} file${mediaItems.length === 1 ? '' : 's'}`);
        return parts.join(', ');
    },

    renderVehicleMediaPreview(vehicleType, mediaItems) {
        const preview = document.getElementById(`${vehicleType}-media-preview`);
        if (!preview) return;

        const files = Array.isArray(mediaItems) ? mediaItems : [];
        if (files.length === 0) {
            preview.innerHTML = '';
            preview.style.display = 'none';
            return;
        }

        const chips = files.map((item, index) => {
            const type = String(item?.type || '').toLowerCase();
            const icon = type.startsWith('video/') ? '🎥' : '📷';
            const name = String(item?.name || 'File').replace(/[<>]/g, '');
            const size = item?.size ? this.formatFileSize(item.size) : 'Unknown';
            return `
                <div style="display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border:1px solid #dbeafe; border-radius:6px; background:#eff6ff; color:#1e3a8a; font-size:0.8rem; font-weight:600; position:relative; cursor:pointer;" 
                     title="Click to view details" 
                     data-vehicle-type="${vehicleType}" 
                     data-media-index="${index}">
                    <span>${icon} ${name}</span>
                    <span style="font-size:0.7rem; color:#3b82f6;">(${size})</span>
                    <button type="button" 
                            style="background:none; border:none; padding:0; cursor:pointer; color:#ef4444; font-size:1rem; line-height:1; margin-left:4px;" 
                            title="Delete this file"
                            data-delete-media
                            data-vehicle-type="${vehicleType}"
                            data-media-index="${index}">
                        ✕
                    </button>
                </div>
            `;
        }).join('');

        preview.innerHTML = `<div style="display:flex; flex-wrap:wrap; gap:6px;">${chips}</div>`;
        preview.style.display = 'block';

        // Add event listeners for delete buttons
        preview.querySelectorAll('[data-delete-media]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const vType = btn.getAttribute('data-vehicle-type');
                const idx = parseInt(btn.getAttribute('data-media-index'), 10);
                this.deleteVehicleMedia(vType, idx);
            });
        });

        // Add event listeners for detail inspection
        preview.querySelectorAll('[data-media-index]').forEach((chip) => {
            chip.addEventListener('click', (e) => {
                if (e.target.closest('[data-delete-media]')) return;
                const vType = chip.getAttribute('data-vehicle-type');
                const idx = parseInt(chip.getAttribute('data-media-index'), 10);
                this.showMediaDetails(vType, idx);
            });
        });
    },

    deleteVehicleMedia(vehicleType, index) {
        const mediaItems = this.parseVehicleMediaFromHidden(vehicleType);
        if (index >= 0 && index < mediaItems.length) {
            mediaItems.splice(index, 1);
            this.saveVehicleMediaToHidden(vehicleType, mediaItems);
            this.renderVehicleMediaPreview(vehicleType, mediaItems);
            const input = document.getElementById(`${vehicleType}-media-input`);
            if (input) input.value = '';
            if (window.updateNextButtonState) window.updateNextButtonState();
        }
    },

    showMediaDetails(vehicleType, index) {
        const mediaItems = this.parseVehicleMediaFromHidden(vehicleType);
        if (index < 0 || index >= mediaItems.length) return;

        const item = mediaItems[index];
        const type = String(item?.type || '').toLowerCase();
        const isVideo = type.startsWith('video/');
        const icon = isVideo ? '🎥' : '📷';

        // Create modal backdrop
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;

        // Create modal content
        const content = document.createElement('div');
        content.style.cssText = `
            background: white;
            border-radius: 8px;
            max-width: 90%;
            max-height: 90vh;
            width: auto;
            overflow: auto;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;

        // Build content HTML
        let contentHTML = `
            <div style="margin-bottom: 20px;">
                <h2 style="margin: 0 0 15px 0; color: #1e3a8a; display: flex; align-items: center; gap: 10px;">
                    ${icon} File Preview
                </h2>
                <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 15px;">
                    <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">
                        <strong>Name:</strong> ${item.name}
                    </p>
                    <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">
                        <strong>Type:</strong> ${item.type || 'Unknown'}
                    </p>
                    <p style="margin: 5px 0; font-size: 0.9rem; color: #666;">
                        <strong>Size:</strong> ${this.formatFileSize(item.size || 0)}
                    </p>
                </div>
            </div>
            <div style="display: flex; justify-content: center; margin-bottom: 20px;">
        `;

        // Add preview based on file type
        if (isVideo && item.dataUrl) {
            contentHTML += `
                <video controls style="max-width: 100%; max-height: 500px; border-radius: 4px;">
                    <source src="${item.dataUrl}" type="${item.type}">
                    Your browser does not support the video tag.
                </video>
            `;
        } else if (!isVideo && item.dataUrl) {
            contentHTML += `
                <img src="${item.dataUrl}" style="max-width: 100%; max-height: 500px; border-radius: 4px; object-fit: contain;">
            `;
        } else {
            contentHTML += `
                <p style="color: #666;">Preview not available for this file.</p>
            `;
        }

        contentHTML += `
            </div>
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" id="media-close-btn" style="
                    padding: 10px 20px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 600;
                ">Close</button>
            </div>
        `;

        content.innerHTML = contentHTML;
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close button handler
        document.getElementById('media-close-btn').addEventListener('click', () => {
            modal.remove();
        });

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    },

    formatFileSize(bytes) {
        if (typeof bytes !== 'number' || bytes < 0) return '0 B';
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    },

    syncVehicleMediaFromInput(vehicleType) {
        const input = document.getElementById(`${vehicleType}-media-input`);
        if (!input) return;

        const newFiles = Array.from(input.files || []);
        const existingMedia = this.parseVehicleMediaFromHidden(vehicleType);
        const mediaLimit = typeof window.getServiceMediaUploadLimit === 'function'
            ? window.getServiceMediaUploadLimit()
            : 5;
        const hasLimit = Number.isFinite(mediaLimit);

        // Process each new file and convert to data URL for preview
        Promise.all(newFiles.map((file) => this.fileToDataUrl(file))).then((dataUrls) => {
            const newMediaItems = newFiles.map((file, idx) => ({
                name: String(file?.name || '').trim(),
                type: String(file?.type || '').trim(),
                size: Number(file?.size || 0) || 0,
                dataUrl: dataUrls[idx] || ''
            })).filter((item) => item.name);

            const remainingSlots = hasLimit ? Math.max(0, mediaLimit - existingMedia.length) : newMediaItems.length;
            const limitedNewMediaItems = hasLimit ? newMediaItems.slice(0, remainingSlots) : newMediaItems;
            if (hasLimit && newMediaItems.length > limitedNewMediaItems.length) {
                alert(`You can upload up to ${mediaLimit} files.`);
            }

            const mergedMedia = [...existingMedia, ...limitedNewMediaItems];

            // Remove duplicates by name
            const uniqueMedia = Array.from(new Map(
                mergedMedia.map(item => [item.name, item])
            ).values());

            this.saveVehicleMediaToHidden(vehicleType, uniqueMedia);
            this.renderVehicleMediaPreview(vehicleType, uniqueMedia);
        });
    },

    fileToDataUrl(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    },

    renderVehicleFloorSelector(vehicleType) {
        const selector = document.getElementById(`${vehicleType}-floors-selector`);
        const hidden = document.getElementById(`${vehicleType}-floors-hidden`);
        if (!selector || !hidden) return;

        const availableFloors = window.selectedPickupFloors ? Array.from(window.selectedPickupFloors) : [];
        if (availableFloors.length === 0) return;

        selector.innerHTML = '';
        const selectedFloors = hidden.value ? hidden.value.split(',').map(f => f.trim()) : [];

        availableFloors.forEach(floor => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = floor;
            btn.style.cssText = `
                padding: 8px 12px;
                border: 2px solid ${selectedFloors.includes(floor) ? '#3b82f6' : '#d1d5db'};
                background: ${selectedFloors.includes(floor) ? '#dbeafe' : '#ffffff'};
                color: ${selectedFloors.includes(floor) ? '#1d4ed8' : '#6b7280'};
                border-radius: 6px;
                cursor: pointer;
                font-weight: ${selectedFloors.includes(floor) ? '700' : '500'};
                font-size: 0.9rem;
                transition: all 0.2s;
            `;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (selectedFloors.includes(floor)) {
                    selectedFloors.splice(selectedFloors.indexOf(floor), 1);
                } else {
                    selectedFloors.push(floor);
                }
                hidden.value = selectedFloors.join(', ');
                this.renderVehicleFloorSelector(vehicleType);
            });

            selector.appendChild(btn);
        });
    },

    clearVehicleFormFloors(vehicleType) {
        const floorsHidden = document.getElementById(`${vehicleType}-floors-hidden`);
        if (floorsHidden) floorsHidden.value = '';
        this.renderVehicleFloorSelector(vehicleType);
    },

    restoreVehicleFormFloors(vehicleType, vehicle) {
        const floorsHidden = document.getElementById(`${vehicleType}-floors-hidden`);
        if (floorsHidden && vehicle.floors && Array.isArray(vehicle.floors)) {
            floorsHidden.value = vehicle.floors.join(', ');
        }
        this.renderVehicleFloorSelector(vehicleType);
    },

    parseFloorsFromHidden(vehicleType) {
        const floorsHidden = document.getElementById(`${vehicleType}-floors-hidden`);
        if (!floorsHidden || !floorsHidden.value) return [];
        return floorsHidden.value.split(',').map(f => f.trim()).filter(f => f);
    },

    clearVehicleForm(vehicleType) {
        const makeInput = document.getElementById(`${vehicleType}-make-model-entry`);
        if (makeInput) {
            makeInput.value = '';
        }

        const sectionIdByType = {
            car: 'car-transport-section',
            motorbike: 'motorbike-transport-section',
            trailer: 'trailer-campervan-section'
        };
        const section = document.getElementById(sectionIdByType[vehicleType] || '');
        const activeForm = section?.querySelector?.(`[data-vehicle-entry-form="${vehicleType}"]`) || section;

        const olderYearInput = document.getElementById(`${vehicleType}-older-year-entry`);
        const olderYearWrap = document.getElementById(`${vehicleType}-older-year-wrap`);
        if (olderYearInput) {
            olderYearInput.value = '';
        }
        if (olderYearWrap) {
            olderYearWrap.style.display = 'none';
        }

        [
            'year',
            'value',
            'condition',
            'method',
            'weight',
            'length',
            'operational',
            'roadworthy',
            'insurance',
            'roadtax',
            'tested',
            'type'
        ].forEach((suffix) => this.setVehicleFormNavValue(vehicleType, suffix, ''));

        const customWeightInput = document.getElementById(`${vehicleType}-custom-weight`);
        const customWeightUnitInput = document.getElementById(`${vehicleType}-custom-weight-unit`);
        const customLengthInput = document.getElementById(`${vehicleType}-custom-length`);
        const customLengthUnitInput = document.getElementById(`${vehicleType}-custom-length-unit`);
        if (customWeightInput) customWeightInput.value = '';
        if (customWeightUnitInput) customWeightUnitInput.value = 'kg';
        if (customLengthInput) customLengthInput.value = '';
        if (customLengthUnitInput) customLengthUnitInput.value = 'mm';

        // Force-clear any lingering selected nav state in the active vehicle section.
        if (activeForm) {
            activeForm.querySelectorAll('.option-nav-btn.selected, .option-nav-btn.is-active').forEach((btn) => {
                btn.classList.remove('selected');
                btn.classList.remove('is-active');
                btn.setAttribute('aria-checked', 'false');
                btn.setAttribute('aria-pressed', 'false');
            });

            activeForm.querySelectorAll('input[type="hidden"][id$="-entry-hidden"]').forEach((hidden) => {
                hidden.value = '';
                hidden.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }

        const mediaInput = document.getElementById(`${vehicleType}-media-input`);
        if (mediaInput) mediaInput.value = '';
        this.saveVehicleMediaToHidden(vehicleType, []);
        this.renderVehicleMediaPreview(vehicleType, []);

        this.clearVehicleFormFloors(vehicleType);
        this.syncVehicleCustomFieldVisibility(vehicleType);

        if (vehicleType === 'trailer') {
            const testedWrap = document.getElementById('trailer-tested-entry-wrap');
            if (testedWrap) testedWrap.style.display = 'none';
        }
    },

    populateVehicleForm(vehicleType, vehicle) {
        const makeInput = document.getElementById(`${vehicleType}-make-model-entry`);
        if (makeInput) {
            makeInput.value = vehicle.makeModel || '';
        }

        const yearRaw = String(vehicle.year || '').trim();
        const yearNav = document.querySelector(`.${vehicleType}-year-entry-nav`);
        const hasExactYearButton = !!(yearNav && yearRaw && yearNav.querySelector(`.option-nav-btn[data-value="${yearRaw}"]`));
        const olderYearInput = document.getElementById(`${vehicleType}-older-year-entry`);
        const olderYearWrap = document.getElementById(`${vehicleType}-older-year-wrap`);

        if (yearRaw && !hasExactYearButton) {
            this.setVehicleFormNavValue(vehicleType, 'year', 'older');
            if (olderYearInput) {
                olderYearInput.value = yearRaw;
            }
            if (olderYearWrap) {
                olderYearWrap.style.display = '';
            }
        } else {
            this.setVehicleFormNavValue(vehicleType, 'year', yearRaw);
            if (olderYearInput) {
                olderYearInput.value = '';
            }
            if (olderYearWrap) {
                olderYearWrap.style.display = 'none';
            }
        }

        this.setVehicleFormNavValue(vehicleType, 'value', vehicle.value || '');
        this.setVehicleFormNavValue(vehicleType, 'condition', vehicle.condition || '');
        this.setVehicleFormNavValue(vehicleType, 'method', vehicle.method || '');
        this.setVehicleFormNavValue(vehicleType, 'weight', vehicle.weight || '');
        this.setVehicleFormNavValue(vehicleType, 'length', vehicle.length || '');
        this.setVehicleFormNavValue(vehicleType, 'operational', vehicle.operational || '');
        this.setVehicleFormNavValue(vehicleType, 'roadworthy', vehicle.roadworthy || '');
        this.setVehicleFormNavValue(vehicleType, 'insurance', vehicle.insurance || '');
        this.setVehicleFormNavValue(vehicleType, 'roadtax', vehicle.roadtax || '');
        this.setVehicleFormNavValue(vehicleType, 'tested', vehicle.tested || '');
        this.setVehicleFormNavValue(vehicleType, 'type', vehicle.type || '');

        const customWeightInput = document.getElementById(`${vehicleType}-custom-weight`);
        const customWeightUnitInput = document.getElementById(`${vehicleType}-custom-weight-unit`);
        const customLengthInput = document.getElementById(`${vehicleType}-custom-length`);
        const customLengthUnitInput = document.getElementById(`${vehicleType}-custom-length-unit`);

        if (customWeightInput) customWeightInput.value = vehicle.customWeight || '';
        if (customWeightUnitInput) customWeightUnitInput.value = vehicle.customWeightUnit || 'kg';
        if (customLengthInput) customLengthInput.value = vehicle.customLength || '';
        if (customLengthUnitInput) customLengthUnitInput.value = vehicle.customLengthUnit || 'mm';

        this.saveVehicleMediaToHidden(vehicleType, Array.isArray(vehicle.media) ? vehicle.media : []);
        this.renderVehicleMediaPreview(vehicleType, Array.isArray(vehicle.media) ? vehicle.media : []);
        const mediaInput = document.getElementById(`${vehicleType}-media-input`);
        if (mediaInput) mediaInput.value = '';

        this.restoreVehicleFormFloors(vehicleType, vehicle);
        this.syncVehicleCustomFieldVisibility(vehicleType);

        if (vehicleType === 'trailer') {
            const testedWrap = document.getElementById('trailer-tested-entry-wrap');
            if (testedWrap) {
                const customWeight = parseFloat(String(vehicle.customWeight || '').trim());
                const customUnit = String(vehicle.customWeightUnit || 'kg').trim().toLowerCase();
                const customKg = Number.isFinite(customWeight)
                    ? (customUnit === 'lb'
                        ? customWeight * 0.45359237
                        : (customUnit === 'tonne' ? customWeight * 1000 : customWeight))
                    : 0;
                testedWrap.style.display = (vehicle.weight === 'over-3500' || (vehicle.weight === 'custom' && customKg > 3500)) ? '' : 'none';
            }
        }
    },

    updateVehicleEditUi(vehicleType) {
        const addBtn = document.getElementById(`add-${vehicleType}-btn`);
        if (!addBtn) return;

        const isEditing = !!this.editingVehicleIds[vehicleType];
        const addAnotherBtn = document.getElementById(`${vehicleType}-add-another-btn`);
        const addLabelMap = {
            car: 'Add Campervan/Car',
            motorbike: 'Add Motorbike',
            trailer: 'Add Caravan / Trailer'
        };
        addBtn.textContent = isEditing ? 'Save Changes' : (addLabelMap[vehicleType] || '+ Add Vehicle');

        // Keep only one visible action: add-another in add mode, save-changes in edit mode.
        addBtn.style.display = isEditing ? '' : 'none';

        if (addAnotherBtn) {
            addAnotherBtn.style.display = isEditing ? 'none' : '';
        }
    },

    renderVehiclesList(vehicleType) {
        const listContainer = document.getElementById(`${vehicleType}-list`);
        if (!listContainer) return;

        const vehicles = this.parseVehicles(vehicleType);
        listContainer.innerHTML = '';

        if (vehicles.length === 0) {
            listContainer.style.display = 'none';
            return;
        }

        listContainer.style.display = 'block';

        const sectionIdMap = {
            car: 'car-transport-section',
            motorbike: 'motorbike-transport-section',
            trailer: 'trailer-campervan-section'
        };
        const section = document.getElementById(sectionIdMap[vehicleType] || '');
        const template = section?.querySelector(`[data-vehicle-entry-form="${vehicleType}"]`);
        if (!template) {
            return;
        }

        const setCloneNavValue = (clone, suffix, value) => {
            const hidden = clone.querySelector(`#${vehicleType}-${suffix}-entry-hidden`);
            if (hidden) hidden.value = value || '';
            const nav = clone.querySelector(`.${vehicleType}-${suffix}-entry-nav`);
            if (!nav) return;
            nav.querySelectorAll('.option-nav-btn').forEach((btn) => {
                const isSelected = String(btn.dataset.value || '') === String(value || '');
                btn.classList.toggle('selected', isSelected);
                btn.classList.toggle('is-active', isSelected);
                btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
            });
        };

        vehicles.forEach((vehicle, index) => {
            const vehicleEl = document.createElement('div');
            vehicleEl.style.cssText = 'margin-bottom: 14px;';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = '✕ Remove';
            deleteBtn.style.cssText = 'padding: 6px 12px; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9rem;';
            deleteBtn.addEventListener('click', () => {
                this.deleteVehicle(vehicleType, vehicle.id);
                if (window.updateNextButtonState) window.updateNextButtonState();
            });

            const headerRow = document.createElement('div');
            headerRow.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:8px;';

            const title = document.createElement('div');
            title.style.cssText = 'font-size:1.14rem; font-weight:700; color:#0f172a;';
            title.textContent = `Vehicle ${index + 1}`;

            const actionsWrap = document.createElement('div');
            actionsWrap.style.cssText = 'display:flex; align-items:center; gap:8px;';
            actionsWrap.appendChild(deleteBtn);

            headerRow.appendChild(title);
            headerRow.appendChild(actionsWrap);

            const clone = template.cloneNode(true);
            clone.removeAttribute('data-vehicle-entry-form');

            const suffixes = [
                'year',
                'value',
                'condition',
                'method',
                'weight',
                'length',
                'operational',
                'roadworthy',
                'insurance',
                'roadtax',
                'tested',
                'type'
            ];

            const refs = {
                makeModel: clone.querySelector(`#${vehicleType}-make-model-entry`),
                olderYearInput: clone.querySelector(`#${vehicleType}-older-year-entry`),
                olderYearWrap: clone.querySelector(`#${vehicleType}-older-year-wrap`),
                customWeight: clone.querySelector(`#${vehicleType}-custom-weight`),
                customWeightUnit: clone.querySelector(`#${vehicleType}-custom-weight-unit`),
                customWeightWrap: clone.querySelector(`#${vehicleType}-custom-weight-wrap`),
                customLength: clone.querySelector(`#${vehicleType}-custom-length`),
                customLengthUnit: clone.querySelector(`#${vehicleType}-custom-length-unit`),
                customLengthWrap: clone.querySelector(`#${vehicleType}-custom-length-wrap`),
                testedWrap: clone.querySelector('#trailer-tested-entry-wrap')
            };

            suffixes.forEach((suffix) => {
                refs[`${suffix}Hidden`] = clone.querySelector(`#${vehicleType}-${suffix}-entry-hidden`);
                refs[`${suffix}Nav`] = clone.querySelector(`.${vehicleType}-${suffix}-entry-nav`);
            });

            const normalizeYearInput = (value) => String(value || '').replace(/\D+/g, '').slice(0, 4);

            const isCustomLike = (value) => {
                const normalized = String(value || '').trim().toLowerCase();
                return normalized === 'custom' || normalized === 'other' || normalized === 'other-approx';
            };

            const syncCloneConditionalUi = () => {
                const yearValue = String(refs.yearHidden?.value || '').trim().toLowerCase();
                if (refs.olderYearWrap) {
                    refs.olderYearWrap.style.display = yearValue === 'older' ? '' : 'none';
                }

                const weightValue = String(refs.weightHidden?.value || '').trim();
                const lengthValue = String(refs.lengthHidden?.value || '').trim();
                if (refs.customWeightWrap) refs.customWeightWrap.style.display = isCustomLike(weightValue) ? '' : 'none';
                if (refs.customLengthWrap) refs.customLengthWrap.style.display = isCustomLike(lengthValue) ? '' : 'none';

                if (vehicleType === 'trailer' && refs.testedWrap) {
                    refs.testedWrap.style.display = (weightValue === 'over-3500' || isCustomLike(weightValue)) ? '' : 'none';
                }
            };

            const setCloneNavValue = (suffix, value) => {
                const hidden = refs[`${suffix}Hidden`];
                const nav = refs[`${suffix}Nav`];
                if (hidden) hidden.value = value || '';
                if (nav) {
                    nav.querySelectorAll('.option-nav-btn').forEach((btn) => {
                        const isSelected = String(btn.dataset.value || '') === String(value || '');
                        btn.classList.toggle('selected', isSelected);
                        btn.classList.toggle('is-active', isSelected);
                        btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                        btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                    });
                }
                syncCloneConditionalUi();
            };

            const makeInput = clone.querySelector(`#${vehicleType}-make-model-entry`);
            if (makeInput) makeInput.value = vehicle.makeModel || '';

            const yearRaw = String(vehicle.year || '').trim();
            const yearNav = refs.yearNav;
            const hasExactYearButton = !!(yearNav && yearRaw && yearNav.querySelector(`.option-nav-btn[data-value="${yearRaw}"]`));
            if (yearRaw && !hasExactYearButton) {
                setCloneNavValue('year', 'older');
                if (refs.olderYearWrap) refs.olderYearWrap.style.display = '';
                if (refs.olderYearInput) refs.olderYearInput.value = yearRaw;
            } else {
                setCloneNavValue('year', yearRaw);
            }

            setCloneNavValue('value', vehicle.value || '');
            setCloneNavValue('condition', vehicle.condition || '');
            setCloneNavValue('method', vehicle.method || '');
            setCloneNavValue('weight', vehicle.weight || '');
            setCloneNavValue('length', vehicle.length || '');
            setCloneNavValue('operational', vehicle.operational || '');
            setCloneNavValue('roadworthy', vehicle.roadworthy || '');
            setCloneNavValue('insurance', vehicle.insurance || '');
            setCloneNavValue('roadtax', vehicle.roadtax || '');
            setCloneNavValue('tested', vehicle.tested || '');
            setCloneNavValue('type', vehicle.type || '');

            if (refs.customWeight) refs.customWeight.value = vehicle.customWeight || '';
            if (refs.customWeightUnit) refs.customWeightUnit.value = vehicle.customWeightUnit || 'kg';
            if (refs.customLength) refs.customLength.value = vehicle.customLength || '';
            if (refs.customLengthUnit) refs.customLengthUnit.value = vehicle.customLengthUnit || 'mm';
            syncCloneConditionalUi();

            const persistCloneVehicle = () => {
                const vehiclesNow = this.parseVehicles(vehicleType);
                const targetIndex = vehiclesNow.findIndex((entry) => entry.id === vehicle.id);
                if (targetIndex === -1) return;

                const selectedYear = String(refs.yearHidden?.value || '').trim();
                const resolvedYear = selectedYear.toLowerCase() === 'older'
                    ? normalizeYearInput(refs.olderYearInput?.value || '')
                    : selectedYear;

                const selectedWeight = String(refs.weightHidden?.value || '').trim();
                const selectedLength = String(refs.lengthHidden?.value || '').trim();

                vehiclesNow[targetIndex] = {
                    ...vehiclesNow[targetIndex],
                    makeModel: String(refs.makeModel?.value || '').trim(),
                    year: resolvedYear,
                    value: String(refs.valueHidden?.value || '').trim(),
                    condition: String(refs.conditionHidden?.value || '').trim(),
                    method: String(refs.methodHidden?.value || '').trim(),
                    weight: selectedWeight,
                    length: selectedLength,
                    customWeight: isCustomLike(selectedWeight) ? String(refs.customWeight?.value || '').trim() : '',
                    customWeightUnit: isCustomLike(selectedWeight) ? String(refs.customWeightUnit?.value || 'kg').trim() : 'kg',
                    customLength: isCustomLike(selectedLength) ? String(refs.customLength?.value || '').trim() : '',
                    customLengthUnit: isCustomLike(selectedLength) ? String(refs.customLengthUnit?.value || 'mm').trim() : 'mm',
                    operational: String(refs.operationalHidden?.value || '').trim(),
                    roadworthy: String(refs.roadworthyHidden?.value || '').trim(),
                    insurance: String(refs.insuranceHidden?.value || '').trim(),
                    roadtax: String(refs.roadtaxHidden?.value || '').trim(),
                    tested: String(refs.testedHidden?.value || '').trim(),
                    type: String(refs.typeHidden?.value || '').trim()
                };

                this.saveVehicles(vehicleType, vehiclesNow);
                if (window.updateNextButtonState) window.updateNextButtonState();
            };

            suffixes.forEach((suffix) => {
                const nav = refs[`${suffix}Nav`];
                if (!nav) return;
                nav.addEventListener('click', (event) => {
                    const btn = event.target.closest('.option-nav-btn');
                    if (!btn || !nav.contains(btn)) return;
                    setCloneNavValue(suffix, btn.dataset.value || '');
                    persistCloneVehicle();
                });
            });

            [refs.makeModel, refs.customWeight, refs.customLength, refs.customWeightUnit, refs.customLengthUnit, refs.olderYearInput]
                .filter(Boolean)
                .forEach((field) => {
                    field.addEventListener('change', () => {
                        if (field === refs.olderYearInput) {
                            const normalized = normalizeYearInput(field.value);
                            if (field.value !== normalized) field.value = normalized;
                        }
                        syncCloneConditionalUi();
                        persistCloneVehicle();
                    });
                });

            // Hide action buttons inside the cloned card; this card is read-only.
            const addBtnInClone = clone.querySelector(`#add-${vehicleType}-btn`);
            const addAnotherInClone = clone.querySelector(`#${vehicleType}-add-another-btn`);
            const continueBtnInClone = clone.querySelector(`#${vehicleType}-continue-with-saved-btn`);
            const deleteFormBtnInClone = clone.querySelector(`#${vehicleType}-delete-form-btn`);
            if (addBtnInClone) addBtnInClone.style.display = 'none';
            if (addAnotherInClone) addAnotherInClone.style.display = 'none';
            if (continueBtnInClone) continueBtnInClone.style.display = 'none';
            if (deleteFormBtnInClone) deleteFormBtnInClone.style.display = 'none';

            // Prevent cloned blocks from being targeted by live vehicle form selectors.
            clone.querySelectorAll('[class]').forEach((el) => {
                const removeClasses = [];
                el.classList.forEach((className) => {
                    if (className.startsWith(`${vehicleType}-`) && className.endsWith('-entry-nav')) {
                        removeClasses.push(className);
                    }
                });
                removeClasses.forEach((className) => el.classList.remove(className));
            });
            clone.querySelectorAll('[data-option-nav-for]').forEach((el) => {
                el.removeAttribute('data-option-nav-for');
            });

            // Remove duplicated IDs and disable controls to avoid conflicts.
            clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
            clone.querySelectorAll('[name]').forEach((el) => el.removeAttribute('name'));
            // Keep fields editable inline; only hide internal action buttons above.

            vehicleEl.appendChild(headerRow);
            vehicleEl.appendChild(clone);
            listContainer.appendChild(vehicleEl);
        });
    }
};

// Initialize piano form handlers
document.addEventListener('DOMContentLoaded', function() {
    const setPianoUnknownMediaRequired = (required) => {
        const hidden = document.getElementById('global-service-media-hidden');
        const requiredText = document.getElementById('global-service-media-required-text');

        if (hidden) {
            if (required) {
                hidden.setAttribute('data-required', 'true');
                hidden.setAttribute('aria-required', 'true');
            } else {
                hidden.removeAttribute('data-required');
                hidden.removeAttribute('aria-required');
                hidden.removeAttribute('aria-invalid');
                hidden.classList.remove('input-error');
            }
        }

        if (requiredText) {
            requiredText.style.display = required ? 'inline' : 'none';
            requiredText.classList.toggle('required-text--active', !!required);
        }
    };

    const addPianoBtn = document.getElementById('add-piano-btn');
    if (addPianoBtn) {
        addPianoBtn.addEventListener('click', function(e) {
            e.preventDefault();

            const typeInput = document.getElementById('piano-type-entry-hidden');
            const sizeInput = document.getElementById('piano-size-entry-hidden');
            const customName = document.getElementById('piano-custom-name');
            const customLength = document.getElementById('piano-custom-length');
            const customWidth = document.getElementById('piano-custom-width');
            const customHeight = document.getElementById('piano-custom-height');
            const customUnit = document.getElementById('piano-custom-size-unit');

            if (!typeInput || !typeInput.value.trim()) {
                alert('Please select a piano type');
                return;
            }

            const isCustomType = typeInput.value === 'custom';
            const isUnknownType = typeInput.value === 'unknown';
            if (!isCustomType && !isUnknownType && (!sizeInput || !sizeInput.value.trim())) {
                alert('Please select a piano size');
                return;
            }

            if (isUnknownType) {
                const mediaHidden = document.getElementById('global-service-media-hidden');
                if (mediaHidden) {
                    let hasMedia = false;
                    try {
                        const parsed = JSON.parse((mediaHidden.value || '').trim() || '[]');
                        hasMedia = Array.isArray(parsed) && parsed.length > 0;
                    } catch (_error) {
                        hasMedia = false;
                    }

                    if (!hasMedia) {
                        setPianoUnknownMediaRequired(true);
                        const mediaSection = document.getElementById('universal-media-section');
                        const mediaInput = document.getElementById('global-service-media-input');
                        if (mediaSection) {
                            mediaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                        if (mediaInput) mediaInput.focus();
                        alert("Please upload at least one photo or video when piano type is 'I don't know'.");
                        return;
                    }
                }
            }

            const isCustomSize = sizeInput && sizeInput.value === 'custom';
            if (isCustomType || isCustomSize) {
                // Require photos for custom pianos too
                const pianoMediaHidden = document.getElementById('piano-media-hidden');
                if (pianoMediaHidden) {
                    let hasMedia = false;
                    try {
                        const parsed = JSON.parse((pianoMediaHidden.value || '').trim() || '[]');
                        hasMedia = Array.isArray(parsed) && parsed.length > 0;
                    } catch (_error) {
                        hasMedia = false;
                    }

                    if (!hasMedia) {
                        alert('Please upload at least one photo or video for custom pianos.');
                        return;
                    }
                }
                
                if (!customName || !customName.value.trim()) {
                    alert('Please enter piano name/model');
                    return;
                }
                if (!customLength || !customLength.value.trim()) {
                    alert('Please enter length');
                    return;
                }
                if (!customWidth || !customWidth.value.trim()) {
                    alert('Please enter width');
                    return;
                }
                if (!customHeight || !customHeight.value.trim()) {
                    alert('Please enter height');
                    return;
                }
            }

            // Collect data
            const pianoData = {
                type: typeInput.value,
                size: sizeInput ? sizeInput.value : '',
                isCustomType: isCustomType,
                isUnknownType: isUnknownType,
                isCustomSize: isCustomSize,
                customName: customName ? customName.value : '',
                customLength: customLength ? customLength.value : '',
                customWidth: customWidth ? customWidth.value : '',
                customHeight: customHeight ? customHeight.value : '',
                customUnit: customUnit ? customUnit.value : 'cm'
            };

            // Add piano
            if (window.multiItemsManager.addPiano(pianoData)) {
                // Clear form
                typeInput.value = '';
                if (sizeInput) sizeInput.value = '';
                if (customName) customName.value = '';
                if (customLength) customLength.value = '';
                if (customWidth) customWidth.value = '';
                if (customHeight) customHeight.value = '';

                // Reset UI
                document.querySelectorAll('.piano-type-entry-nav .option-nav-btn').forEach(btn => {
                    btn.classList.remove('selected', 'is-active');
                    btn.setAttribute('aria-checked', 'false');
                });
                document.querySelectorAll('.piano-size-entry-nav .option-nav-btn').forEach(btn => {
                    btn.classList.remove('selected', 'is-active');
                    btn.setAttribute('aria-checked', 'false');
                });
                const customSection = document.getElementById('piano-custom-section');
                if (customSection) customSection.style.display = 'none';
                setPianoUnknownMediaRequired(false);

                if (window.updateNextButtonState) window.updateNextButtonState();
            }
        });
    }

    // Handle piano type change for custom section
    const pianoTypeNav = document.querySelector('.piano-type-entry-nav');
    const pianoSizeNav = document.querySelector('.piano-size-entry-nav');
    const customSection = document.getElementById('piano-custom-section');

    if (pianoTypeNav) {
        pianoTypeNav.addEventListener('click', function(e) {
            const btn = e.target.closest('.option-nav-btn');
            if (!btn || !pianoTypeNav.contains(btn)) return;

            const typeInput = document.getElementById('piano-type-entry-hidden');
            const sizeInput = document.getElementById('piano-size-entry-hidden');
            const nextValue = btn.dataset.value || '';

            pianoTypeNav.querySelectorAll('.option-nav-btn').forEach((candidate) => {
                const isActive = candidate === btn;
                candidate.classList.toggle('selected', isActive);
                candidate.classList.toggle('is-active', isActive);
                candidate.setAttribute('aria-checked', isActive ? 'true' : 'false');
            });

            if (typeInput) {
                typeInput.value = nextValue;
                typeInput.dispatchEvent(new Event('change', { bubbles: true }));
            }

            const isCustom = nextValue === 'custom';
            const isUnknown = nextValue === 'unknown';
            if (pianoSizeNav) {
                pianoSizeNav.style.display = (isCustom || isUnknown) ? 'none' : '';
                if ((isCustom || isUnknown) && sizeInput) {
                    sizeInput.value = '';
                    sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
                    pianoSizeNav.querySelectorAll('.option-nav-btn').forEach((candidate) => {
                        candidate.classList.remove('selected', 'is-active');
                        candidate.setAttribute('aria-checked', 'false');
                    });
                }
            }

            setPianoUnknownMediaRequired(isUnknown);
            if (isUnknown) {
                const mediaSection = document.getElementById('universal-media-section');
                const mediaInput = document.getElementById('global-service-media-input');
                if (mediaSection) {
                    mediaSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                if (mediaInput) mediaInput.focus();
            }

            updateCustomSection();
            if (window.updateNextButtonState) window.updateNextButtonState();
        });
    }

    if (pianoSizeNav) {
        pianoSizeNav.addEventListener('click', function(e) {
            const btn = e.target.closest('.option-nav-btn');
            if (!btn || !pianoSizeNav.contains(btn)) return;

            const sizeInput = document.getElementById('piano-size-entry-hidden');
            const nextValue = btn.dataset.value || '';

            pianoSizeNav.querySelectorAll('.option-nav-btn').forEach((candidate) => {
                const isActive = candidate === btn;
                candidate.classList.toggle('selected', isActive);
                candidate.classList.toggle('is-active', isActive);
                candidate.setAttribute('aria-checked', isActive ? 'true' : 'false');
            });

            if (sizeInput) {
                sizeInput.value = nextValue;
                sizeInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            updateCustomSection();
            if (window.updateNextButtonState) window.updateNextButtonState();
        });
    }

    function updateCustomSection() {
        const typeInput = document.getElementById('piano-type-entry-hidden');
        const sizeInput = document.getElementById('piano-size-entry-hidden');
        const customSection = document.getElementById('piano-custom-section');
        const photoSection = document.getElementById('piano-photo-section');
        const photoRequiredLabel = document.getElementById('piano-media-required');
        const measurementsSection = document.getElementById('piano-unknown-measurements');

        if (!typeInput || !customSection) return;

        const isCustomType = typeInput.value === 'custom';
        const isCustomSize = sizeInput && sizeInput.value === 'custom';
        const isUnknownType = typeInput.value === 'unknown';
        const isCustom = isCustomType || isCustomSize;

        customSection.style.display = isCustom ? 'block' : 'none';
        
        // Show photo section for all types, but make it required only for custom or unknown
        if (photoSection) {
            photoSection.style.display = 'block';
        }
        // Toggle "(required)" label based on conditions
        if (photoRequiredLabel) {
            photoRequiredLabel.style.display = (isUnknownType || isCustom) ? 'inline' : 'none';
        }
        // Show measurements only when "I don't know" is selected
        if (measurementsSection) {
            measurementsSection.style.display = isUnknownType ? 'block' : 'none';
        }
    }

    // Initial render + hydration-safe re-render for refreshed pages
    window.multiItemsManager.renderPianosList();

    const pianosJsonHidden = document.getElementById('pianos-json-hidden');
    if (pianosJsonHidden) {
        pianosJsonHidden.addEventListener('change', () => {
            window.multiItemsManager.renderPianosList();
            if (window.updateNextButtonState) window.updateNextButtonState();
        });
    }

    // Some restore flows repopulate hidden inputs shortly after DOMContentLoaded.
    setTimeout(() => {
        window.multiItemsManager.renderPianosList();
    }, 250);

    const isBoatsServiceActive = () => {
        const serviceHidden = document.getElementById('item-description-hidden')
            || document.getElementById('create-job-hidden');
        return (serviceHidden?.value || '').trim() === 'Boats';
    };

    // Initialize vehicle handlers for each type
    ['car', 'motorbike', 'trailer'].forEach(vehicleType => {
        const continueWithSavedBtn = document.getElementById(`${vehicleType}-continue-with-saved-btn`);
        const continueWithSavedHidden = document.getElementById(`${vehicleType}-continue-with-saved-hidden`);
        const addAnotherBtn = document.getElementById(`${vehicleType}-add-another-btn`);

        const hasVehicleDraftInProgress = () => {
            const makeModel = String(document.getElementById(`${vehicleType}-make-model-entry`)?.value || '').trim();
            if (makeModel) return true;

            const typedOlderYear = String(document.getElementById(`${vehicleType}-older-year-entry`)?.value || '').trim();
            if (typedOlderYear) return true;

            const hiddenFieldIds = [
                `${vehicleType}-year-entry-hidden`,
                `${vehicleType}-value-entry-hidden`,
                `${vehicleType}-condition-entry-hidden`,
                `${vehicleType}-method-entry-hidden`,
                `${vehicleType}-weight-entry-hidden`,
                `${vehicleType}-length-entry-hidden`,
                `${vehicleType}-operational-entry-hidden`,
                `${vehicleType}-roadworthy-entry-hidden`,
                `${vehicleType}-insurance-entry-hidden`,
                `${vehicleType}-roadtax-entry-hidden`,
                `${vehicleType}-tested-entry-hidden`,
                `${vehicleType}-type-entry-hidden`,
                `${vehicleType}-media-hidden`
            ];

            const hasHiddenValue = hiddenFieldIds.some((fieldId) => String(document.getElementById(fieldId)?.value || '').trim());
            if (hasHiddenValue) return true;

            const customValueIds = [
                `${vehicleType}-custom-weight`,
                `${vehicleType}-custom-length`
            ];

            return customValueIds.some((fieldId) => String(document.getElementById(fieldId)?.value || '').trim());
        };

        const resetContinueWithSavedChoice = () => {
            if (!continueWithSavedHidden) return;
            continueWithSavedHidden.value = '';
            continueWithSavedHidden.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const normalizeYearInput = (value) => {
            const digits = String(value || '').replace(/\D+/g, '').slice(0, 4);
            return digits;
        };

        const getOlderYearInput = () => document.getElementById(`${vehicleType}-older-year-entry`);
        const getOlderYearWrap = () => document.getElementById(`${vehicleType}-older-year-wrap`);

        const syncOlderYearInputVisibility = () => {
            const yearHidden = document.getElementById(`${vehicleType}-year-entry-hidden`);
            const olderYearInput = getOlderYearInput();
            const olderYearWrap = getOlderYearWrap();
            if (!yearHidden || !olderYearInput || !olderYearWrap) return;

            const selectedYearValue = String(yearHidden.value || '').trim().toLowerCase();
            const showOlderYearInput = selectedYearValue === 'older';
            olderYearWrap.style.display = showOlderYearInput ? '' : 'none';

            if (!showOlderYearInput) {
                olderYearInput.value = '';
                olderYearInput.classList.remove('input-error');
                olderYearInput.removeAttribute('aria-invalid');
            }
        };

        const resolveYearValue = () => {
            const yearHidden = document.getElementById(`${vehicleType}-year-entry-hidden`);
            let selectedYear = String(yearHidden?.value || '').trim();

            if (!selectedYear) {
                const yearNav = document.querySelector(`.${vehicleType}-year-entry-nav`);
                const selectedBtn = yearNav?.querySelector('.option-nav-btn.selected')
                    || yearNav?.querySelector('.option-nav-btn[aria-checked="true"]');
                selectedYear = String(selectedBtn?.dataset?.value || '').trim();
                if (selectedYear && yearHidden) {
                    yearHidden.value = selectedYear;
                }
            }

            if (String(selectedYear).toLowerCase() !== 'older') {
                return { selectedYear, resolvedYear: selectedYear };
            }

            const olderYearInput = getOlderYearInput();
            const typedOlderYear = normalizeYearInput(olderYearInput?.value || '');
            if (olderYearInput && olderYearInput.value !== typedOlderYear) {
                olderYearInput.value = typedOlderYear;
            }

            return { selectedYear, resolvedYear: typedOlderYear };
        };

        const syncContinueWithSavedUi = () => {
            if (!continueWithSavedBtn || !continueWithSavedHidden) return;
            const savedCount = window.multiItemsManager.parseVehicles(vehicleType).length;
            const hasSaved = savedCount > 0;
            const hasDraft = hasVehicleDraftInProgress();
            const isEditing = !!window.multiItemsManager.editingVehicleIds[vehicleType];
            const shouldShow = hasSaved && hasDraft && !isEditing;

            continueWithSavedBtn.style.display = shouldShow ? '' : 'none';
            if (!shouldShow && continueWithSavedHidden.value) {
                resetContinueWithSavedChoice();
            }
        };

        const syncAddAnotherUi = () => {
            if (!addAnotherBtn) return;
            const isEditing = !!window.multiItemsManager.editingVehicleIds[vehicleType];
            addAnotherBtn.style.display = isEditing ? 'none' : '';
        };

        const deleteFormBtn = document.getElementById(`${vehicleType}-delete-form-btn`);
        const syncDeleteFormUi = () => {
            if (!deleteFormBtn) return;
            const hasDraft = hasVehicleDraftInProgress();
            deleteFormBtn.style.display = hasDraft ? '' : 'none';
        };

        const showVehicleSavedIndicator = (wasEdit) => {
            const sectionIdByType = {
                car: 'car-transport-section',
                motorbike: 'motorbike-transport-section',
                trailer: 'trailer-campervan-section'
            };

            const section = document.getElementById(sectionIdByType[vehicleType] || '');
            if (!section) return;

            let banner = section.querySelector('.vehicle-save-success-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.className = 'vehicle-save-success-banner';
                banner.setAttribute('role', 'status');
                banner.setAttribute('aria-live', 'polite');
                banner.style.cssText = 'margin: 0 0 12px; padding: 10px 12px; border: 1px solid #86efac; border-radius: 8px; background: #f0fdf4; color: #166534; font-weight: 700; font-size: 0.92rem;';

                const card = section.querySelector('.card-section');
                if (card) {
                    const firstHeading = card.querySelector('h3, h2, p');
                    if (firstHeading && firstHeading.parentElement === card) {
                        firstHeading.insertAdjacentElement('afterend', banner);
                    } else {
                        card.prepend(banner);
                    }
                } else {
                    section.prepend(banner);
                }
            }

            banner.textContent = wasEdit
                ? 'Vehicle details updated. You can add another vehicle now.'
                : 'Vehicle added. Use + Add Another Vehicle to start a new blank entry.';
            banner.style.display = 'block';

            // Keep the user in the active form area so adding another vehicle feels continuous.
            const makeInput = document.getElementById(`${vehicleType}-make-model-entry`);
            const addButton = document.getElementById(`add-${vehicleType}-btn`);
            const targetElement = makeInput || addButton;
            if (targetElement && typeof targetElement.scrollIntoView === 'function') {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            if (!wasEdit && makeInput && typeof makeInput.focus === 'function') {
                makeInput.focus();
            }

            if (banner._hideTimer) {
                clearTimeout(banner._hideTimer);
            }
            banner._hideTimer = setTimeout(() => {
                banner.style.display = 'none';
                banner._hideTimer = null;
            }, 4500);
        };

        const isCustomWeightAboveTrailerThreshold = () => {
            if (vehicleType !== 'trailer') return false;
            const selectedWeight = (document.getElementById('trailer-weight-entry-hidden')?.value || '').trim();
            if (selectedWeight !== 'custom') return false;

            const customWeightRaw = String(document.getElementById('trailer-custom-weight')?.value || '').trim();
            const customWeight = parseFloat(customWeightRaw);
            if (!Number.isFinite(customWeight)) return false;

            const unitRaw = String(document.getElementById('trailer-custom-weight-unit')?.value || 'kg').trim().toLowerCase();
            const weightInKg = unitRaw === 'lb'
                ? (customWeight * 0.45359237)
                : (unitRaw === 'tonne' ? (customWeight * 1000) : customWeight);
            return weightInKg > 3500;
        };

        const syncTrailerTestedRequirement = () => {
            if (vehicleType !== 'trailer') return;

            const testedWrap = document.getElementById('trailer-tested-entry-wrap');
            const testedHidden = document.getElementById('trailer-tested-entry-hidden');

            if (isBoatsServiceActive()) {
                if (testedWrap) testedWrap.style.display = 'none';
                if (testedHidden) {
                    testedHidden.value = '';
                    testedHidden.dispatchEvent(new Event('change', { bubbles: true }));
                    document.querySelectorAll('.trailer-tested-entry-nav .option-nav-btn').forEach((btn) => {
                        btn.classList.remove('selected');
                        btn.setAttribute('aria-checked', 'false');
                    });
                }
                return;
            }

            const selectedWeight = (document.getElementById('trailer-weight-entry-hidden')?.value || '').trim();
            const requiresTested = selectedWeight === 'over-3500' || isCustomWeightAboveTrailerThreshold();

            if (testedWrap) {
                testedWrap.style.display = requiresTested ? '' : 'none';
            }

            if (!requiresTested && testedHidden) {
                testedHidden.value = '';
                testedHidden.dispatchEvent(new Event('change', { bubbles: true }));
                document.querySelectorAll('.trailer-tested-entry-nav .option-nav-btn').forEach((btn) => {
                    btn.classList.remove('selected');
                    btn.setAttribute('aria-checked', 'false');
                });
            }
        };

        const wireSingleSelectNav = (navSelector, hiddenId) => {
            const nav = document.querySelector(navSelector);
            const hiddenInput = document.getElementById(hiddenId);
            if (!nav || !hiddenInput) return;

            nav.addEventListener('click', function(event) {
                const btn = event.target.closest('.option-nav-btn');
                if (!btn || !nav.contains(btn)) return;

                nav.querySelectorAll('.option-nav-btn').forEach((candidate) => {
                    candidate.classList.remove('selected');
                    candidate.classList.remove('is-active');
                    candidate.setAttribute('aria-checked', 'false');
                    candidate.setAttribute('aria-pressed', 'false');
                });

                btn.classList.add('selected');
                btn.classList.add('is-active');
                btn.setAttribute('aria-checked', 'true');
                btn.setAttribute('aria-pressed', 'true');
                hiddenInput.value = btn.dataset.value || '';
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                if (hiddenId === `${vehicleType}-year-entry-hidden`) {
                    syncOlderYearInputVisibility();
                }
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                syncDeleteFormUi();

                if (hiddenId === `${vehicleType}-weight-entry-hidden` || hiddenId === `${vehicleType}-length-entry-hidden`) {
                    window.multiItemsManager.syncVehicleCustomFieldVisibility(vehicleType);
                }

                if (vehicleType === 'trailer' && hiddenId === 'trailer-weight-entry-hidden') {
                    syncTrailerTestedRequirement();
                }

                if (window.updateNextButtonState) window.updateNextButtonState();
            });
        };

        [
            'year',
            'value',
            'condition',
            'method',
            'weight',
            'length',
            'operational',
            'roadworthy',
            'insurance',
            'roadtax',
            'tested',
            'type'
        ].forEach((suffix) => {
            wireSingleSelectNav(`.${vehicleType}-${suffix}-entry-nav`, `${vehicleType}-${suffix}-entry-hidden`);
        });

        const customWeightInput = document.getElementById(`${vehicleType}-custom-weight`);
        const customWeightUnitInput = document.getElementById(`${vehicleType}-custom-weight-unit`);
        const customLengthInput = document.getElementById(`${vehicleType}-custom-length`);
        const customLengthUnitInput = document.getElementById(`${vehicleType}-custom-length-unit`);

        [customWeightInput, customWeightUnitInput, customLengthInput, customLengthUnitInput]
            .filter(Boolean)
            .forEach((field) => {
                field.addEventListener('input', () => {
                    resetContinueWithSavedChoice();
                    syncContinueWithSavedUi();
                    syncDeleteFormUi();
                    if (vehicleType === 'trailer') {
                        syncTrailerTestedRequirement();
                    }
                    if (window.updateNextButtonState) window.updateNextButtonState();
                });
                field.addEventListener('change', () => {
                    resetContinueWithSavedChoice();
                    syncContinueWithSavedUi();
                    syncDeleteFormUi();
                    if (vehicleType === 'trailer') {
                        syncTrailerTestedRequirement();
                    }
                    if (window.updateNextButtonState) window.updateNextButtonState();
                });
            });

        const mediaInput = document.getElementById(`${vehicleType}-media-input`);
        if (mediaInput) {
            mediaInput.addEventListener('change', () => {
                window.multiItemsManager.syncVehicleMediaFromInput(vehicleType);
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                if (window.updateNextButtonState) window.updateNextButtonState();
            });
        }

        const makeModelInput = document.getElementById(`${vehicleType}-make-model-entry`);
        if (makeModelInput) {
            makeModelInput.addEventListener('input', () => {
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                if (window.updateNextButtonState) window.updateNextButtonState();
            });
            makeModelInput.addEventListener('change', () => {
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                if (window.updateNextButtonState) window.updateNextButtonState();
            });
        }

        const olderYearInput = getOlderYearInput();
        if (olderYearInput) {
            const onOlderYearInput = () => {
                const normalized = normalizeYearInput(olderYearInput.value);
                if (olderYearInput.value !== normalized) {
                    olderYearInput.value = normalized;
                }
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                if (window.updateNextButtonState) window.updateNextButtonState();
            };

            olderYearInput.addEventListener('input', onOlderYearInput);
            olderYearInput.addEventListener('change', onOlderYearInput);
        }

        if (continueWithSavedBtn && continueWithSavedHidden) {
            continueWithSavedBtn.addEventListener('click', () => {
                continueWithSavedHidden.value = '1';
                continueWithSavedHidden.dispatchEvent(new Event('change', { bubbles: true }));
                continueWithSavedBtn.style.display = 'none';
                if (window.updateNextButtonState) window.updateNextButtonState();
                
                // Automatically advance to next step
                setTimeout(() => {
                    const currentStep = parseInt(document.body.getAttribute('data-form-step') || document.body.getAttribute('data-current-step') || '1', 10);
                    if (typeof window.setFormStep === 'function') {
                        window.setFormStep(currentStep + 1);
                    }
                }, 0);
            });
        }

        let clearAfterSuccessfulAdd = false;
        if (addAnotherBtn) {
            addAnotherBtn.addEventListener('click', () => {
                const isEditing = !!window.multiItemsManager.editingVehicleIds[vehicleType];
                if (isEditing || !addBtn) return;

                clearAfterSuccessfulAdd = true;
                addBtn.click();
            });
        }

        if (deleteFormBtn) {
            deleteFormBtn.addEventListener('click', () => {
                const editingVehicleId = window.multiItemsManager.editingVehicleIds[vehicleType];
                if (editingVehicleId) {
                    // If editing an existing vehicle, delete that specific vehicle
                    window.multiItemsManager.deleteVehicle(vehicleType, editingVehicleId);
                    window.multiItemsManager.editingVehicleIds[vehicleType] = null;
                } else {
                    // If not editing, delete the most recently saved vehicle (undo last save)
                    const savedVehicles = window.multiItemsManager.parseVehicles(vehicleType);
                    if (savedVehicles.length > 0) {
                        const lastVehicleId = savedVehicles[savedVehicles.length - 1].id;
                        window.multiItemsManager.deleteVehicle(vehicleType, lastVehicleId);
                    }
                }
                window.multiItemsManager.clearVehicleForm(vehicleType);
                window.multiItemsManager.updateVehicleEditUi(vehicleType);
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncAddAnotherUi();
                syncDeleteFormUi();
                window.multiItemsManager.renderVehiclesList(vehicleType);
                if (window.updateNextButtonState) window.updateNextButtonState();
            });
        }

        const syncVehicleCustomVisibilityAfterHydration = () => {
            window.multiItemsManager.syncVehicleCustomFieldVisibility(vehicleType);
            if (vehicleType === 'trailer') {
                syncTrailerTestedRequirement();
            }
        };

        const weightHiddenInput = document.getElementById(`${vehicleType}-weight-entry-hidden`);
        const lengthHiddenInput = document.getElementById(`${vehicleType}-length-entry-hidden`);
        [weightHiddenInput, lengthHiddenInput].filter(Boolean).forEach((hiddenInput) => {
            hiddenInput.addEventListener('change', syncVehicleCustomVisibilityAfterHydration);
            hiddenInput.addEventListener('input', syncVehicleCustomVisibilityAfterHydration);
        });

        const yearHiddenInput = document.getElementById(`${vehicleType}-year-entry-hidden`);
        if (yearHiddenInput) {
            yearHiddenInput.addEventListener('change', syncOlderYearInputVisibility);
            yearHiddenInput.addEventListener('input', syncOlderYearInputVisibility);
        }

        // Run immediate + deferred syncs because draft hydration can happen asynchronously.
        syncVehicleCustomVisibilityAfterHydration();
        syncOlderYearInputVisibility();
        if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => {
                requestAnimationFrame(syncVehicleCustomVisibilityAfterHydration);
            });
        }
        setTimeout(syncVehicleCustomVisibilityAfterHydration, 0);
        setTimeout(syncVehicleCustomVisibilityAfterHydration, 120);
        setTimeout(syncOlderYearInputVisibility, 0);
        setTimeout(syncOlderYearInputVisibility, 120);

        const addBtn = document.getElementById(`add-${vehicleType}-btn`);
        if (addBtn) {
            const handleAddClick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log(`[${vehicleType}] Add button clicked`);
                try {
                    const getEntryValue = (suffix) => {
                    const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
                    const hiddenValue = hidden ? String(hidden.value || '').trim() : '';
                    if (hiddenValue) {
                        return hiddenValue;
                    }

                    const nav = document.querySelector(`.${vehicleType}-${suffix}-entry-nav`);
                    if (!nav) {
                        return '';
                    }

                    const selectedBtn = nav.querySelector('.option-nav-btn.selected')
                        || nav.querySelector('.option-nav-btn[aria-checked="true"]');
                    const selectedValue = selectedBtn ? String(selectedBtn.dataset.value || '').trim() : '';

                    if (selectedValue && hidden) {
                        hidden.value = selectedValue;
                    }

                    return selectedValue;
                };

                const makeInput = document.getElementById(`${vehicleType}-make-model-entry`);
                const yearInput = document.getElementById(`${vehicleType}-year-entry-hidden`);
                const valueInput = document.getElementById(`${vehicleType}-value-entry-hidden`);
                const conditionInput = document.getElementById(`${vehicleType}-condition-entry-hidden`);
                const methodInput = document.getElementById(`${vehicleType}-method-entry-hidden`);
                const weightInput = document.getElementById(`${vehicleType}-weight-entry-hidden`);
                const lengthInput = document.getElementById(`${vehicleType}-length-entry-hidden`);
                const operationalInput = document.getElementById(`${vehicleType}-operational-entry-hidden`);
                const roadworthyInput = document.getElementById(`${vehicleType}-roadworthy-entry-hidden`);
                const insuranceInput = document.getElementById(`${vehicleType}-insurance-entry-hidden`);
                const roadtaxInput = document.getElementById(`${vehicleType}-roadtax-entry-hidden`);
                const testedInput = document.getElementById(`${vehicleType}-tested-entry-hidden`);
                const typeInput = document.getElementById(`${vehicleType}-type-entry-hidden`);

                const focusVehicleField = (suffixOrField) => {
                    let target = null;

                    if (typeof suffixOrField === 'string') {
                        const navByClass = document.querySelector(`.${vehicleType}-${suffixOrField}-entry-nav`);
                        const navByData = document.querySelector(`.option-nav[data-option-nav-for="${vehicleType}-${suffixOrField}-entry-hidden"]`);
                        target = navByClass || navByData || document.getElementById(`${vehicleType}-${suffixOrField}-entry-hidden`);
                    } else if (suffixOrField) {
                        target = suffixOrField;
                    }

                    if (!target) return;

                    if (typeof target.scrollIntoView === 'function') {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }

                    if (typeof target.focus === 'function') {
                        setTimeout(() => {
                            target.focus({ preventScroll: true });
                        }, 0);
                    }
                };

                if (!makeInput || !makeInput.value.trim()) {
                    console.warn(`[${vehicleType}] Validation failed: missing make & model`);
                    focusVehicleField(makeInput);
                    alert('Please enter make & model');
                    return;
                }

                const yearData = resolveYearValue();
                if (!yearData.selectedYear) {
                    focusVehicleField('year');
                    alert('Please select a year');
                    return;
                }

                if (String(yearData.selectedYear).toLowerCase() === 'older' && !yearData.resolvedYear) {
                    const olderYearInputField = getOlderYearInput();
                    focusVehicleField(olderYearInputField || 'year');
                    alert('Please enter the vehicle year for the Older option');
                    return;
                }

                const valueEntryValue = getEntryValue('value');
                if (!valueEntryValue) {
                    focusVehicleField('value');
                    alert('Please select estimated value');
                    return;
                }

                const requiredByType = {
                    car: ['type', 'condition', 'method', 'weight', 'length', 'roadworthy', 'insurance', 'roadtax'],
                    motorbike: ['condition', 'weight', 'roadworthy', 'insurance', 'roadtax'],
                    trailer: ['type', 'condition', 'method', 'weight', 'length', 'roadworthy']
                };
                const requiredFieldLabel = {
                    condition: 'condition',
                    method: 'transport method',
                    weight: 'weight',
                    length: 'length',
                    roadworthy: (vehicleType === 'trailer' && isBoatsServiceActive()) ? 'seaworthy' : 'roadworthy (NCT/DOE)',
                    insurance: 'insurance',
                    roadtax: 'road tax',
                    tested: 'tested certification status',
                    type: vehicleType === 'car' ? 'vehicle type' : 'type'
                };
                const lookup = {
                    condition: getEntryValue('condition'),
                    method: getEntryValue('method'),
                    weight: getEntryValue('weight'),
                    length: getEntryValue('length'),
                    operational: getEntryValue('operational'),
                    roadworthy: getEntryValue('roadworthy'),
                    insurance: getEntryValue('insurance'),
                    roadtax: getEntryValue('roadtax'),
                    tested: getEntryValue('tested'),
                    type: getEntryValue('type')
                };
                const missingExtra = (requiredByType[vehicleType] || []).find((fieldName) => {
                    return !String(lookup[fieldName] || '').trim();
                });
                if (missingExtra) {
                    focusVehicleField(missingExtra);
                    alert(`Please select ${requiredFieldLabel[missingExtra] || missingExtra}`);
                    return;
                }

                const customWeightInput = document.getElementById(`${vehicleType}-custom-weight`);
                const customWeightUnitInput = document.getElementById(`${vehicleType}-custom-weight-unit`);
                const customLengthInput = document.getElementById(`${vehicleType}-custom-length`);
                const customLengthUnitInput = document.getElementById(`${vehicleType}-custom-length-unit`);

                const customWeightValue = lookup.weight === 'custom'
                    ? String(customWeightInput?.value || '').trim()
                    : '';
                const customLengthValue = lookup.length === 'custom'
                    ? String(customLengthInput?.value || '').trim()
                    : '';

                if (lookup.weight === 'custom' && !customWeightValue) {
                    focusVehicleField(customWeightInput);
                    alert('Please enter approximate weight');
                    if (customWeightInput) customWeightInput.focus();
                    return;
                }

                if (lookup.length === 'custom' && !customLengthValue) {
                    focusVehicleField(customLengthInput);
                    alert('Please Enter approx length');
                    if (customLengthInput) customLengthInput.focus();
                    return;
                }

                const trailerNeedsTested = vehicleType === 'trailer' && !isBoatsServiceActive() && (
                    lookup.weight === 'over-3500'
                    || (lookup.weight === 'custom' && isCustomWeightAboveTrailerThreshold())
                );

                if (trailerNeedsTested && !String(lookup.tested || '').trim()) {
                    focusVehicleField('tested');
                    alert('Please select tested certification status for trailers over 3500kg');
                    return;
                }

                // Collect data
                const vehicleData = {
                    makeModel: makeInput.value,
                    year: yearData.resolvedYear,
                    value: valueEntryValue,
                    condition: lookup.condition,
                    method: lookup.method,
                    weight: lookup.weight,
                    length: lookup.length,
                    customWeight: lookup.weight === 'custom' ? customWeightValue : '',
                    customWeightUnit: lookup.weight === 'custom' ? String(customWeightUnitInput?.value || 'kg').trim() : 'kg',
                    customLength: lookup.length === 'custom' ? customLengthValue : '',
                    customLengthUnit: lookup.length === 'custom' ? String(customLengthUnitInput?.value || 'mm').trim() : 'mm',
                    operational: lookup.operational,
                    roadworthy: lookup.roadworthy,
                    insurance: lookup.insurance,
                    roadtax: lookup.roadtax,
                    tested: lookup.tested,
                    type: lookup.type,
                    media: window.multiItemsManager.parseVehicleMediaFromHidden(vehicleType),
                    floors: window.multiItemsManager.parseFloorsFromHidden(vehicleType)
                };

                const editingVehicleId = window.multiItemsManager.editingVehicleIds[vehicleType];
                const saved = editingVehicleId
                    ? window.multiItemsManager.updateVehicle(vehicleType, editingVehicleId, vehicleData)
                    : window.multiItemsManager.addVehicle(vehicleType, vehicleData);

                if (saved) {
                    console.log(`[${vehicleType}] Vehicle saved successfully`);
                    const wasEdit = !!editingVehicleId;
                    // Always clear the form after successful save (except when editing)
                    if (!wasEdit) {
                        window.multiItemsManager.clearVehicleForm(vehicleType);
                        window.multiItemsManager.editingVehicleIds[vehicleType] = null;
                        clearAfterSuccessfulAdd = false;
                    } else {
                        // When editing, keep the editing ID active so user can see the form
                        const vehicles = window.multiItemsManager.parseVehicles(vehicleType);
                        const vehicleIdToKeep = editingVehicleId || (vehicles.length > 0 ? vehicles[vehicles.length - 1].id : null);
                        window.multiItemsManager.editingVehicleIds[vehicleType] = vehicleIdToKeep;
                    }
                    window.multiItemsManager.updateVehicleEditUi(vehicleType);
                    resetContinueWithSavedChoice();
                    syncContinueWithSavedUi();
                    syncAddAnotherUi();
                    syncDeleteFormUi();
                    showVehicleSavedIndicator(wasEdit);

                    // Scroll to the vehicle list to show saved vehicles
                    setTimeout(() => {
                        const listContainer = document.getElementById(`${vehicleType}-list`);
                        if (listContainer && listContainer.style.display !== 'none') {
                            listContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                    }, 300);

                    if (window.updateNextButtonState) window.updateNextButtonState();
                }
                } catch (error) {
                    console.error(`Vehicle save handler error: ${error.message}`, error);
                    alert('An error occurred while saving. Please try again.');
                }
            };
            
            addBtn.addEventListener('click', handleAddClick);
        }

        // Store reference to re-render when returning to this step
        window.multiItemsManager._vehicleRenderFuncs = window.multiItemsManager._vehicleRenderFuncs || {};
        window.multiItemsManager._vehicleRenderFuncs[vehicleType] = () => {
            window.multiItemsManager.renderVehiclesList(vehicleType);
            window.multiItemsManager.updateVehicleEditUi(vehicleType);
            syncContinueWithSavedUi();
            syncAddAnotherUi();
            syncDeleteFormUi();
        };

        // Initial render
        window.multiItemsManager._vehicleRenderFuncs[vehicleType]();
        if (vehicleType === 'trailer') {
            syncTrailerTestedRequirement();
        }
    });

    // Watch for step changes to re-render vehicles when returning to step 3
    const vehicleStepObserver = setInterval(() => {
        const currentStep = parseInt(document.body.getAttribute('data-form-step') || document.body.getAttribute('data-current-step') || '1', 10);
        if (currentStep === 3 && window.multiItemsManager._vehicleRenderFuncs) {
            ['car', 'motorbike', 'trailer'].forEach((vehicleType) => {
                if (window.multiItemsManager._vehicleRenderFuncs[vehicleType]) {
                    try {
                        window.multiItemsManager._vehicleRenderFuncs[vehicleType]();
                    } catch (e) {
                        console.error(`Error re-rendering ${vehicleType} vehicles:`, e);
                    }
                }
            });
        }
    }, 500);

    // Initialize piano media input
    const pianoMediaInput = document.getElementById('piano-media-input');
    if (pianoMediaInput) {
        pianoMediaInput.addEventListener('change', () => {
            window.multiItemsManager.syncVehicleMediaFromInput('piano');
            if (window.updateNextButtonState) window.updateNextButtonState();
        });
    }

    const petMediaInput = document.getElementById('pet-media-input');
    if (petMediaInput) {
        petMediaInput.addEventListener('change', () => {
            window.multiItemsManager.syncVehicleMediaFromInput('pet');
            if (window.updateNextButtonState) window.updateNextButtonState();
        });
    }
});

