// Multi-item handler for Pianos and Vehicles
// Stores and manages multiple pianos and vehicles with JSON serialization

window.multiItemsManager = {
    editingVehicleIds: {},
    showVehicleDraftForm: {},
    pendingVehicleMediaSync: {},
    allowProgrammaticVehicleAddClick: {},
    scheduleProgressSyncTimer: null,
    scheduleProgressSync(delayMs = 120) {
        if (this.scheduleProgressSyncTimer) {
            clearTimeout(this.scheduleProgressSyncTimer);
        }

        this.scheduleProgressSyncTimer = setTimeout(() => {
            this.scheduleProgressSyncTimer = null;
            if (typeof window.updateNextButtonState === 'function') {
                window.updateNextButtonState();
            }
            if (typeof window.saveCreateJobProgress === 'function') {
                window.saveCreateJobProgress();
            }
        }, delayMs);
    },
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
            listContainer.style.display = 'none';
            return;
        }

        listContainer.style.display = 'block';

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
            detailEl.style.flex = '1';
            const safe = (value) => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            detailEl.innerHTML = `<strong>Piano ${index + 1}:</strong> ${safe(typeLabel)}${sizeLabel ? ` · ${safe(sizeLabel)}` : ''}`;

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

    clearPianoForm() {
        const typeInput = document.getElementById('piano-type-entry-hidden');
        const sizeInput = document.getElementById('piano-size-entry-hidden');
        if (typeInput) typeInput.value = '';
        if (sizeInput) sizeInput.value = '';

        document.querySelectorAll('.piano-type-entry-nav .option-nav-btn, .piano-size-entry-nav .option-nav-btn').forEach((btn) => {
            btn.classList.remove('selected', 'is-active');
            btn.setAttribute('aria-checked', 'false');
            btn.setAttribute('aria-pressed', 'false');
        });

        ['piano-custom-name', 'piano-custom-length', 'piano-custom-width', 'piano-custom-height',
            'piano-length-measurement', 'piano-width-measurement', 'piano-height-measurement'].forEach((id) => {
            const field = document.getElementById(id);
            if (field) field.value = '';
        });

        const customUnit = document.getElementById('piano-custom-size-unit');
        const measureUnit = document.getElementById('piano-measurement-unit');
        if (customUnit) customUnit.value = 'cm';
        if (measureUnit) measureUnit.value = 'cm';

        const customSection = document.getElementById('piano-custom-section');
        const unknownSection = document.getElementById('piano-unknown-measurements');
        const sizeGroup = document.getElementById('piano-size-group');
        const sizeNav = document.querySelector('.piano-size-entry-nav');
        if (customSection) customSection.style.display = 'none';
        if (unknownSection) unknownSection.style.display = 'none';
        if (sizeGroup) sizeGroup.style.display = '';
        if (sizeNav) sizeNav.style.display = '';

        const mediaInput = document.getElementById('piano-media-input');
        if (mediaInput) mediaInput.value = '';
        this.saveVehicleMediaToHidden('piano', []);
        this.renderVehicleMediaPreview('piano', []);

        const photoRequiredLabel = document.getElementById('piano-media-required');
        if (photoRequiredLabel) photoRequiredLabel.style.display = 'none';
    },

    collectPianoDraft() {
        const read = (id) => String(document.getElementById(id)?.value || '').trim();
        const type = read('piano-type-entry-hidden');
        const size = read('piano-size-entry-hidden');
        const isCustomType = type === 'custom';
        const isUnknownType = type === 'unknown';
        const isCustomSize = size === 'custom';

        return {
            type,
            size,
            isCustomType,
            isUnknownType,
            isCustomSize,
            customName: read('piano-custom-name'),
            customLength: read('piano-custom-length'),
            customWidth: read('piano-custom-width'),
            customHeight: read('piano-custom-height'),
            customUnit: read('piano-custom-size-unit') || 'cm',
            lengthMeasurement: read('piano-length-measurement'),
            widthMeasurement: read('piano-width-measurement'),
            heightMeasurement: read('piano-height-measurement'),
            measurementUnit: read('piano-measurement-unit') || 'cm',
            media: this.parseVehicleMediaFromHidden('piano')
        };
    },

    getMissingPianoField(draft) {
        if (!draft.type) {
            return document.querySelector('.piano-type-entry-nav') || document.getElementById('piano-type-entry-hidden');
        }

        const isCustomType = draft.isCustomType;
        const isUnknownType = draft.isUnknownType;
        const isCustomSize = draft.isCustomSize;

        if (isUnknownType) {
            const globalMediaHidden = document.getElementById('global-service-media-hidden');
            let hasGlobalMedia = false;
            if (globalMediaHidden?.value) {
                try {
                    const parsed = JSON.parse(globalMediaHidden.value);
                    hasGlobalMedia = Array.isArray(parsed) && parsed.length > 0;
                } catch (_e) {
                    hasGlobalMedia = false;
                }
            }
            if (!hasGlobalMedia && (!draft.media || !draft.media.length)) {
                return document.getElementById('global-service-media-input')
                    || document.getElementById('piano-media-input')
                    || document.getElementById('universal-media-section');
            }
            if (!draft.lengthMeasurement) return document.getElementById('piano-length-measurement');
            if (!draft.widthMeasurement) return document.getElementById('piano-width-measurement');
            if (!draft.heightMeasurement) return document.getElementById('piano-height-measurement');
            return null;
        }

        if (!isCustomType && !draft.size) {
            return document.querySelector('.piano-size-entry-nav') || document.getElementById('piano-size-entry-hidden');
        }

        if (isCustomType || isCustomSize) {
            if (!draft.media || !draft.media.length) {
                return document.getElementById('piano-media-input') || document.getElementById('piano-media-hidden');
            }
            if (!draft.customName) return document.getElementById('piano-custom-name');
            if (!draft.customLength) return document.getElementById('piano-custom-length');
            if (!draft.customWidth) return document.getElementById('piano-custom-width');
            if (!draft.customHeight) return document.getElementById('piano-custom-height');
        }

        return null;
    },

    commitPianoDraft(options = {}) {
        const {
            mediaOverride = null,
            showAlert = true,
            focusOnMissing = true,
            clearAfterSave = true
        } = options;

        const draft = this.collectPianoDraft();
        if (Array.isArray(mediaOverride)) {
            draft.media = mediaOverride;
        }

        const missing = this.getMissingPianoField(draft);
        if (missing) {
            if (focusOnMissing && typeof window.revealMissingFieldBeforeAlert === 'function') {
                window.revealMissingFieldBeforeAlert(missing, {
                    skipAlert: !showAlert,
                    alertMessage: showAlert
                        ? 'Please complete all required piano fields before adding another piano.'
                        : ''
                });
            } else if (focusOnMissing && typeof missing.scrollIntoView === 'function') {
                missing.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (typeof missing.focus === 'function') {
                    missing.focus();
                }
            }
            return false;
        }

        const pianoData = {
            type: draft.type,
            size: draft.size,
            isCustomType: draft.isCustomType,
            isUnknownType: draft.isUnknownType,
            isCustomSize: draft.isCustomSize,
            customName: draft.customName,
            customLength: draft.customLength,
            customWidth: draft.customWidth,
            customHeight: draft.customHeight,
            customUnit: draft.customUnit,
            lengthMeasurement: draft.lengthMeasurement,
            widthMeasurement: draft.widthMeasurement,
            heightMeasurement: draft.heightMeasurement,
            measurementUnit: draft.measurementUnit,
            media: draft.media
        };

        if (!this.addPiano(pianoData)) {
            return false;
        }

        if (clearAfterSave) {
            this.clearPianoForm();
            if (typeof window.updatePianoCustomSection === 'function') {
                window.updatePianoCustomSection();
            }
        }

        if (typeof window.updateNextButtonState === 'function') {
            window.updateNextButtonState();
        }
        if (typeof window.saveCreateJobProgress === 'function') {
            window.saveCreateJobProgress();
        }

        return true;
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

        const getResolvedNavValue = (hiddenInput, navSelector, suffix) => {
            const hiddenValue = String(hiddenInput?.value || '').trim();
            if (hiddenValue) return hiddenValue;

            if (suffix) {
                const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
                const visibleValue = String(visible?.value || '').trim();
                if (visibleValue) {
                    if (hiddenInput) {
                        hiddenInput.value = visibleValue;
                        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    return visibleValue;
                }
            }

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

        const resolvedWeightValue = getResolvedNavValue(weightHidden, `.${vehicleType}-weight-entry-nav`, 'weight');
        const resolvedLengthValue = getResolvedNavValue(lengthHidden, `.${vehicleType}-length-entry-nav`, 'length');

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

    syncVehicleDraftUi(vehicleType) {
        const suffixes = ['year', 'value', 'condition', 'method', 'weight', 'length', 'operational', 'roadworthy', 'insurance', 'roadtax', 'tested', 'type'];

        suffixes.forEach((suffix) => {
            const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
            const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
            const nav = document.querySelector(`.${vehicleType}-${suffix}-entry-nav`);
            const value = String(hidden?.value || '').trim();

            if (visible) {
                visible.value = value;
                visible.dispatchEvent(new Event('change', { bubbles: true }));
            }

            if (nav) {
                nav.querySelectorAll('.option-nav-btn').forEach((btn) => {
                    const isSelected = String(btn.dataset.value || '') === value;
                    btn.classList.toggle('selected', isSelected);
                    btn.classList.toggle('is-active', isSelected);
                    btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                });
            }
        });

        const makeInput = document.getElementById(`${vehicleType}-make-model-entry`);
        if (makeInput) {
            makeInput.dispatchEvent(new Event('input', { bubbles: true }));
            makeInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        this.syncVehicleCustomFieldVisibility(vehicleType);

        if (vehicleType === 'trailer') {
            const testedHidden = document.getElementById('trailer-tested-entry-hidden');
            if (testedHidden) {
                const testedValue = String(testedHidden.value || '').trim();
                document.querySelectorAll('.trailer-tested-entry-nav .option-nav-btn').forEach((btn) => {
                    const isSelected = String(btn.dataset.value || '') === testedValue;
                    btn.classList.toggle('selected', isSelected);
                    btn.classList.toggle('is-active', isSelected);
                    btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
                    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
                });
            }
        }

        if (typeof window.updateNextButtonState === 'function') {
            window.updateNextButtonState();
        }
    },

    syncVisibleVehicleFieldsToHidden(vehicleType) {
        const syncPairsByType = {
            car: ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'insurance', 'roadtax', 'weight', 'length'],
            motorbike: ['year', 'value', 'condition', 'roadworthy', 'insurance', 'roadtax', 'weight', 'length'],
            trailer: ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'tested', 'weight', 'length']
        };

        (syncPairsByType[vehicleType] || []).forEach((suffix) => {
            const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
            const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
            if (!visible || !hidden) return;

            let nextValue = String(visible.value || '').trim();
            if (suffix === 'year') {
                nextValue = nextValue.replace(/\D+/g, '').slice(0, 4);
                visible.value = nextValue;
            }
            hidden.value = nextValue;
            hidden.dispatchEvent(new Event('change', { bubbles: true }));
        });

        this.syncVehicleCustomFieldVisibility(vehicleType);

        if (vehicleType === 'trailer' && typeof this.syncTrailerTestedRequirement === 'function') {
            this.syncTrailerTestedRequirement();
        }
    },

    syncTrailerTestedRequirement() {
        const serviceHidden = document.getElementById('item-description-hidden')
            || document.getElementById('create-job-hidden');
        const isBoatsService = (serviceHidden?.value || '').trim() === 'Boats';

        const testedWrap = document.getElementById('trailer-tested-entry-wrap');
        const testedHidden = document.getElementById('trailer-tested-entry-hidden');
        const testedVisible = document.getElementById('trailer-tested-visible');

        if (isBoatsService) {
            if (testedWrap) testedWrap.style.display = 'none';
            if (testedHidden) {
                testedHidden.value = '';
                testedHidden.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (testedVisible) testedVisible.value = '';
            return;
        }

        const selectedWeight = String(
            document.getElementById('trailer-weight-entry-hidden')?.value
            || document.getElementById('trailer-weight-visible')?.value
            || ''
        ).trim();

        let requiresTested = selectedWeight === 'over-3500';
        if (!requiresTested && selectedWeight === 'custom') {
            const customWeightRaw = String(document.getElementById('trailer-custom-weight')?.value || '').trim();
            const customWeight = parseFloat(customWeightRaw);
            if (Number.isFinite(customWeight)) {
                const unitRaw = String(document.getElementById('trailer-custom-weight-unit')?.value || 'kg').trim().toLowerCase();
                const weightInKg = unitRaw === 'lb'
                    ? (customWeight * 0.45359237)
                    : (unitRaw === 'tonne' ? (customWeight * 1000) : customWeight);
                requiresTested = weightInKg > 3500;
            }
        }

        if (testedWrap) {
            testedWrap.style.display = requiresTested ? '' : 'none';
        }

        if (!requiresTested) {
            if (testedHidden) {
                testedHidden.value = '';
                testedHidden.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (testedVisible) testedVisible.value = '';
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

    renderVehiclePhotoTiles(vehicleType, mediaItems, formRoot, options = {}) {
        const readOnly = !!options.readOnly;
        const sectionIdMap = {
            car: 'car-transport-section',
            motorbike: 'motorbike-transport-section',
            trailer: 'trailer-campervan-section'
        };

        const section = document.getElementById(sectionIdMap[vehicleType] || '');
        const activeForm = formRoot || section?.querySelector?.(`[data-vehicle-entry-form="${vehicleType}"]`);
        if (!activeForm) return;

        const tiles = Array.from(activeForm.querySelectorAll('.vehicle-photo-upload-area'));
        if (!tiles.length) return;

        const files = Array.isArray(mediaItems) ? mediaItems : [];

        tiles.forEach((tile, index) => {
            const svg = tile.querySelector('svg');
            const text = tile.querySelector('span');
            const media = files[index] || null;
            const existingRemoveBtn = tile.querySelector('.vehicle-tile-remove-btn');
            const existingInspectBtn = tile.querySelector('.vehicle-tile-inspect-btn');

            if (existingRemoveBtn) {
                existingRemoveBtn.remove();
            }
            if (existingInspectBtn) {
                existingInspectBtn.remove();
            }

            tile.style.backgroundImage = '';
            tile.style.backgroundSize = '';
            tile.style.backgroundPosition = '';
            tile.style.backgroundRepeat = '';
            tile.style.borderStyle = '';

            if (svg) svg.style.display = '';
            if (text) {
                text.style.display = '';
                text.innerHTML = 'Drag photo or video here <strong>upload</strong>';
            }

            if (readOnly) {
                tile.removeAttribute('for');
                tile.style.cursor = 'default';
                tile.setAttribute('aria-disabled', 'true');
            } else {
                tile.setAttribute('for', `${vehicleType}-media-input`);
                tile.style.cursor = 'pointer';
                tile.removeAttribute('aria-disabled');
            }

            if (!media) return;

            const mediaType = String(media?.type || '').toLowerCase();
            const isImage = mediaType.startsWith('image/');
            const hasData = !!String(media?.dataUrl || '').trim();

            if (!readOnly) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'vehicle-tile-remove-btn';
                removeBtn.textContent = 'Remove';
                removeBtn.style.cssText = 'position:absolute;top:8px;right:8px;border:1px solid #fecaca;background:#fff1f2;color:#b91c1c;border-radius:6px;padding:3px 8px;font-size:0.75rem;font-weight:700;cursor:pointer;z-index:3;';
                removeBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    this.deleteVehicleMedia(vehicleType, index);
                });
                tile.appendChild(removeBtn);
            }

            if (isImage && hasData) {
                tile.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.08), rgba(15, 23, 42, 0.08)), url("${media.dataUrl}")`;
                tile.style.backgroundSize = 'cover';
                tile.style.backgroundPosition = 'center';
                tile.style.backgroundRepeat = 'no-repeat';
                tile.style.borderStyle = 'solid';
                if (svg) svg.style.display = 'none';
                if (text) {
                    text.style.display = 'none';
                }
                return;
            }

            if (text) {
                text.style.display = '';
                text.innerHTML = '<strong>Video selected</strong>';
            }
        });
    },

    renderVehicleMediaPreview(vehicleType, mediaItems) {
        const preview = document.getElementById(`${vehicleType}-media-preview`);
        if (!preview) return;

        const files = Array.isArray(mediaItems) ? mediaItems : [];
        this.renderVehiclePhotoTiles(vehicleType, files);

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

        preview.querySelectorAll('[data-delete-media]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const vType = btn.getAttribute('data-vehicle-type');
                const idx = parseInt(btn.getAttribute('data-media-index'), 10);
                this.deleteVehicleMedia(vType, idx);
            });
        });

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
                <video 
                    controls 
                    autoplay 
                    playsInline 
                    preload="metadata"
                    width="100%" 
                    style="max-width: 100%; max-height: 500px; border-radius: 4px; background: #000; display: block;">
                    <source src="${item.dataUrl}" type="${item.type || 'video/mp4'}">
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
        if (!input) return Promise.resolve([]);

        const newFiles = Array.from(input.files || []);
        const existingMedia = this.parseVehicleMediaFromHidden(vehicleType);
        const mediaLimit = typeof window.getServiceMediaUploadLimit === 'function'
            ? window.getServiceMediaUploadLimit()
            : 5;
        const hasLimit = Number.isFinite(mediaLimit);

        // Process each new file and convert to data URL for preview
        const syncPromise = Promise.all(newFiles.map((file) => this.fileToDataUrl(file))).then((dataUrls) => {
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
            return uniqueMedia;
        });

        this.pendingVehicleMediaSync[vehicleType] = syncPromise
            .catch(() => [])
            .finally(() => {
                if (this.pendingVehicleMediaSync[vehicleType] === syncPromise) {
                    this.pendingVehicleMediaSync[vehicleType] = null;
                }
            });

        return this.pendingVehicleMediaSync[vehicleType];
    },

    fileToDataUrl(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => resolve('');
            reader.readAsDataURL(file);
        });
    },

    async resolveVehicleMediaForSave(vehicleType) {
        const existing = this.parseVehicleMediaFromHidden(vehicleType);
        if (existing.length > 0) {
            return existing;
        }

        const input = document.getElementById(`${vehicleType}-media-input`);
        const files = Array.from(input?.files || []);
        if (files.length === 0) {
            return [];
        }

        const mediaLimit = typeof window.getServiceMediaUploadLimit === 'function'
            ? window.getServiceMediaUploadLimit()
            : 5;
        const hasLimit = Number.isFinite(mediaLimit);
        const limitedFiles = hasLimit ? files.slice(0, mediaLimit) : files;

        if (hasLimit && files.length > limitedFiles.length) {
            alert(`You can upload up to ${mediaLimit} files.`);
        }

        const dataUrls = await Promise.all(limitedFiles.map((file) => this.fileToDataUrl(file)));
        const mediaItems = limitedFiles.map((file, idx) => ({
            name: String(file?.name || '').trim(),
            type: String(file?.type || '').trim(),
            size: Number(file?.size || 0) || 0,
            dataUrl: String(dataUrls[idx] || '')
        })).filter((item) => item.name);

        this.saveVehicleMediaToHidden(vehicleType, mediaItems);
        this.renderVehicleMediaPreview(vehicleType, mediaItems);
        return mediaItems;
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
            activeForm.querySelectorAll(`[id^="${vehicleType}-"][id$="-visible"]`).forEach((field) => {
                field.value = '';
                field.dispatchEvent(new Event('change', { bubbles: true }));
            });

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

            // Keep custom select shells in sync with cleared native select values.
            activeForm.querySelectorAll('.vehicle-select-shell').forEach((shell) => {
                const select = shell.querySelector('select');
                const label = shell.querySelector('.vehicle-select-label');
                const menu = shell.querySelector('.vehicle-select-menu');
                if (!select) return;

                if (label) {
                    const selectedOption = select.options[select.selectedIndex];
                    label.textContent = selectedOption ? selectedOption.textContent : '';
                }

                if (menu) {
                    menu.querySelectorAll('.vehicle-select-option').forEach((item) => {
                        const isSelected = String(item.dataset.value || '') === String(select.value || '');
                        item.classList.toggle('is-selected', isSelected);
                        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                    });
                }

                shell.classList.remove('is-open');
                const trigger = shell.querySelector('.vehicle-select-trigger');
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                }
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

        this.updateVehicleEntryTitle(vehicleType);
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

        ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'insurance', 'roadtax', 'tested', 'weight', 'length'].forEach((suffix) => {
            const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
            if (!visible) return;
            visible.value = String(vehicle?.[suffix] || '').trim();
        });

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

        const vehicles = this.parseVehicles(vehicleType);
        const hasSavedVehicles = vehicles.length > 0;
        const shouldShowDraftForm = !!this.showVehicleDraftForm[vehicleType] || !hasSavedVehicles;
        const addAnotherBtn = document.getElementById(`${vehicleType}-add-another-btn`);
        const addLabelMap = {
            car: 'Add Campervan/Car',
            motorbike: 'Add Motorbike',
            trailer: 'Save Caravan / Trailer'
        };
        addBtn.textContent = addLabelMap[vehicleType] || '+ Add Vehicle';

        // Keep primary save button hidden in UI; Add Another is the only visible action button.
        addBtn.style.display = 'none';

        if (addAnotherBtn) {
            addAnotherBtn.style.display = (vehicleType === 'car' || vehicleType === 'motorbike' || vehicleType === 'trailer')
                ? ''
                : (shouldShowDraftForm ? '' : 'none');
        }

        this.updateVehicleEntryTitle(vehicleType);
    },

    updateVehicleEntryTitle(vehicleType) {
        const sectionIdMap = {
            car: 'car-transport-section',
            motorbike: 'motorbike-transport-section',
            trailer: 'trailer-campervan-section'
        };
        const section = document.getElementById(sectionIdMap[vehicleType] || '');
        const form = section?.querySelector?.(`[data-vehicle-entry-form="${vehicleType}"]`);
        const titleNode = form?.querySelector?.('.custom-item-title');
        if (!titleNode) return;

        const vehicles = this.parseVehicles(vehicleType);
        const editingId = this.editingVehicleIds?.[vehicleType];

        if (editingId) {
            const editIndex = vehicles.findIndex((vehicle) => vehicle.id === editingId);
            if (editIndex >= 0) {
                titleNode.textContent = `Vehicle ${editIndex + 1}`;
                return;
            }
        }

        titleNode.textContent = `Vehicle ${vehicles.length + 1}`;
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
        const entryForm = section?.querySelector?.(`[data-vehicle-entry-form="${vehicleType}"]`);

        const isEditing = !!this.editingVehicleIds[vehicleType];
        const isDraftVisible = !!this.showVehicleDraftForm[vehicleType];
        const isSimpleEditableVehicle = vehicleType === 'motorbike' || vehicleType === 'trailer';
        const shouldShowEntryForm = true;
        if (entryForm) {
            // Keep the live vehicle form always visible so users can freely adjust details without entering edit mode.
            entryForm.style.display = shouldShowEntryForm ? '' : 'none';
        }

        if (!entryForm) {
            return;
        }

        vehicles.forEach((vehicle, index) => {
            const vehicleEl = document.createElement('div');
            vehicleEl.style.cssText = 'margin-bottom: 14px;';

            const openVehicleInEditor = () => {
                this.editingVehicleIds[vehicleType] = vehicle.id;
                this.showVehicleDraftForm[vehicleType] = true;
                this.populateVehicleForm(vehicleType, vehicle);
                this.updateVehicleEditUi(vehicleType);
                this.renderVehiclesList(vehicleType);
                if (entryForm && typeof entryForm.scrollIntoView === 'function') {
                    entryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            };

            const actionsWrap = document.createElement('div');
            actionsWrap.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px; justify-content:flex-end;';

            const actionRow = document.createElement('div');
            actionRow.style.cssText = 'display:flex; gap:8px;';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Remove';
            deleteBtn.style.cssText = 'padding:6px 12px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.86rem;';
            deleteBtn.addEventListener('click', () => {
                this.deleteVehicle(vehicleType, vehicle.id);
                if (window.updateNextButtonState) window.updateNextButtonState();
            });

            actionRow.appendChild(deleteBtn);
            actionsWrap.appendChild(actionRow);

            const clone = entryForm.cloneNode(true);
            clone.removeAttribute('data-vehicle-entry-form');
            clone.style.display = '';

            const setCloneValue = (selector, value) => {
                const field = clone.querySelector(selector);
                if (!field) return;
                if (field.tagName === 'SELECT' || field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                    field.value = String(value || '').trim();
                }
            };

            setCloneValue(`#${vehicleType}-make-model-entry`, vehicle.makeModel || '');
            setCloneValue(`#${vehicleType}-year-visible`, vehicle.year || '');
            setCloneValue(`#${vehicleType}-value-visible`, vehicle.value || '');
            setCloneValue(`#${vehicleType}-condition-visible`, vehicle.condition || '');
            setCloneValue(`#${vehicleType}-method-visible`, vehicle.method || '');
            setCloneValue(`#${vehicleType}-roadworthy-visible`, vehicle.roadworthy || '');
            setCloneValue(`#${vehicleType}-insurance-visible`, vehicle.insurance || '');
            setCloneValue(`#${vehicleType}-roadtax-visible`, vehicle.roadtax || '');
            setCloneValue(`#${vehicleType}-weight-visible`, vehicle.weight || '');
            setCloneValue(`#${vehicleType}-length-visible`, vehicle.length || '');
            setCloneValue(`#${vehicleType}-type-visible`, vehicle.type || '');
            setCloneValue(`#${vehicleType}-tested-visible`, vehicle.tested || '');

            setCloneValue(`#${vehicleType}-custom-weight`, vehicle.customWeight || '');
            setCloneValue(`#${vehicleType}-custom-weight-unit`, vehicle.customWeightUnit || 'kg');
            setCloneValue(`#${vehicleType}-custom-length`, vehicle.customLength || '');
            setCloneValue(`#${vehicleType}-custom-length-unit`, vehicle.customLengthUnit || 'mm');

            clone.querySelectorAll('.vehicle-select-shell').forEach((shell) => {
                const select = shell.querySelector('select');
                const label = shell.querySelector('.vehicle-select-label');
                const menu = shell.querySelector('.vehicle-select-menu');
                if (!select) return;

                if (label) {
                    const selectedOption = select.options[select.selectedIndex];
                    label.textContent = selectedOption ? selectedOption.textContent : '';
                }

                if (menu) {
                    menu.querySelectorAll('.vehicle-select-option').forEach((item) => {
                        const isSelected = String(item.dataset.value || '') === String(select.value || '');
                        item.classList.toggle('is-selected', isSelected);
                        item.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                    });
                }

                shell.classList.remove('is-open');
                const trigger = shell.querySelector('.vehicle-select-trigger');
                if (trigger) {
                    trigger.setAttribute('aria-expanded', 'false');
                }
            });

            const cloneTitle = clone.querySelector('.custom-item-title');
            if (cloneTitle) {
                cloneTitle.textContent = `Vehicle ${index + 1}`;
            }

            const cloneMedia = Array.isArray(vehicle.media) ? vehicle.media : [];
            this.renderVehiclePhotoTiles(vehicleType, cloneMedia, clone, { readOnly: true });

            const clonePreview = clone.querySelector(`#${vehicleType}-media-preview`);
            if (clonePreview) {
                clonePreview.innerHTML = '';
                clonePreview.style.display = 'none';
            }

            const cloneWeightWrap = clone.querySelector(`#${vehicleType}-custom-weight-wrap`);
            const cloneLengthWrap = clone.querySelector(`#${vehicleType}-custom-length-wrap`);
            const weightMode = String(vehicle.weight || '').trim().toLowerCase();
            const lengthMode = String(vehicle.length || '').trim().toLowerCase();
            if (cloneWeightWrap) {
                cloneWeightWrap.style.display = (weightMode === 'custom' || weightMode === 'other' || weightMode === 'other-approx') ? '' : 'none';
            }
            if (cloneLengthWrap) {
                cloneLengthWrap.style.display = (lengthMode === 'custom' || lengthMode === 'other' || lengthMode === 'other-approx') ? '' : 'none';
            }

            const addBtnInClone = clone.querySelector(`#add-${vehicleType}-btn`);
            const addAnotherInClone = clone.querySelector(`#${vehicleType}-add-another-btn`);
            const continueBtnInClone = clone.querySelector(`#${vehicleType}-continue-with-saved-btn`);
            const deleteFormBtnInClone = clone.querySelector(`#${vehicleType}-delete-form-btn`);
            if (addBtnInClone) addBtnInClone.style.display = 'none';
            if (addAnotherInClone) addAnotherInClone.style.display = 'none';
            if (continueBtnInClone) continueBtnInClone.style.display = 'none';
            if (deleteFormBtnInClone) deleteFormBtnInClone.style.display = 'none';

            const persistSavedVehicleEdit = (mutate) => {
                const current = this.parseVehicles(vehicleType);
                const editIndex = current.findIndex((entry) => entry.id === vehicle.id);
                if (editIndex < 0) return;

                mutate(current[editIndex]);

                if (document.getElementById(`${vehicleType}-json-hidden`)) {
                    const jsonHidden = document.getElementById(`${vehicleType}-json-hidden`);
                    jsonHidden.value = current.length > 0 ? JSON.stringify(current) : '';
                    jsonHidden.dispatchEvent(new Event('change', { bubbles: true }));
                }

                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
                if (typeof window.saveCreateJobProgress === 'function') {
                    window.saveCreateJobProgress();
                }
            };

            const bindSimpleSavedField = (selector, key, options = {}) => {
                const field = clone.querySelector(selector);
                if (!field) return;

                const commit = () => {
                    let nextValue = String(field.value || '').trim();
                    if (options.normalizeYear) {
                        nextValue = nextValue.replace(/\D+/g, '').slice(0, 4);
                        field.value = nextValue;
                    }

                    persistSavedVehicleEdit((entry) => {
                        entry[key] = nextValue;
                        if (options.afterMutate) {
                            options.afterMutate(entry, nextValue);
                        }
                    });

                    if (options.afterCommit) {
                        options.afterCommit(nextValue);
                    }
                };

                field.addEventListener('change', commit);
                if (field.tagName === 'INPUT') {
                    field.addEventListener('blur', commit);
                }
            };

            if (isSimpleEditableVehicle) {
                clone.querySelectorAll('input[type="file"]').forEach((field) => {
                    field.disabled = true;
                });

                if (vehicleType === 'motorbike') {
                    bindSimpleSavedField(`#${vehicleType}-make-model-entry`, 'makeModel');
                    bindSimpleSavedField(`#${vehicleType}-year-visible`, 'year', { normalizeYear: true });
                    bindSimpleSavedField(`#${vehicleType}-value-visible`, 'value');
                    bindSimpleSavedField(`#${vehicleType}-condition-visible`, 'condition');
                    bindSimpleSavedField(`#${vehicleType}-roadworthy-visible`, 'roadworthy');
                    bindSimpleSavedField(`#${vehicleType}-insurance-visible`, 'insurance');
                    bindSimpleSavedField(`#${vehicleType}-roadtax-visible`, 'roadtax');
                    bindSimpleSavedField(`#${vehicleType}-weight-visible`, 'weight', {
                        afterMutate: (entry, nextValue) => {
                            const mode = String(nextValue || '').trim().toLowerCase();
                            if (!(mode === 'custom' || mode === 'other' || mode === 'other-approx')) {
                                entry.customWeight = '';
                            }
                        },
                        afterCommit: () => {
                            if (cloneWeightWrap) {
                                const modeValue = String(clone.querySelector('#motorbike-weight-visible')?.value || '').trim().toLowerCase();
                                cloneWeightWrap.style.display = (modeValue === 'custom' || modeValue === 'other' || modeValue === 'other-approx') ? '' : 'none';
                            }
                        }
                    });
                    bindSimpleSavedField(`#${vehicleType}-length-visible`, 'length', {
                        afterMutate: (entry, nextValue) => {
                            const mode = String(nextValue || '').trim().toLowerCase();
                            if (!(mode === 'custom' || mode === 'other' || mode === 'other-approx')) {
                                entry.customLength = '';
                            }
                        },
                        afterCommit: () => {
                            if (cloneLengthWrap) {
                                const modeValue = String(clone.querySelector('#motorbike-length-visible')?.value || '').trim().toLowerCase();
                                cloneLengthWrap.style.display = (modeValue === 'custom' || modeValue === 'other' || modeValue === 'other-approx') ? '' : 'none';
                            }
                        }
                    });
                    bindSimpleSavedField(`#${vehicleType}-custom-weight`, 'customWeight');
                    bindSimpleSavedField(`#${vehicleType}-custom-weight-unit`, 'customWeightUnit', {
                        afterMutate: (entry, nextValue) => {
                            entry.customWeightUnit = nextValue || 'kg';
                        }
                    });
                    bindSimpleSavedField(`#${vehicleType}-custom-length`, 'customLength');
                    bindSimpleSavedField(`#${vehicleType}-custom-length-unit`, 'customLengthUnit', {
                        afterMutate: (entry, nextValue) => {
                            entry.customLengthUnit = nextValue || 'mm';
                        }
                    });
                }

                if (vehicleType === 'trailer') {
                    bindSimpleSavedField(`#${vehicleType}-make-model-entry`, 'makeModel');
                    bindSimpleSavedField(`#${vehicleType}-type-visible`, 'type');
                    bindSimpleSavedField(`#${vehicleType}-year-visible`, 'year', { normalizeYear: true });
                    bindSimpleSavedField(`#${vehicleType}-value-visible`, 'value');
                    bindSimpleSavedField(`#${vehicleType}-condition-visible`, 'condition');
                    bindSimpleSavedField(`#${vehicleType}-method-visible`, 'method');
                    bindSimpleSavedField(`#${vehicleType}-roadworthy-visible`, 'roadworthy');
                    bindSimpleSavedField(`#${vehicleType}-weight-visible`, 'weight', {
                        afterMutate: (entry, nextValue) => {
                            const mode = String(nextValue || '').trim().toLowerCase();
                            if (!(mode === 'custom' || mode === 'other' || mode === 'other-approx')) {
                                entry.customWeight = '';
                            }
                        },
                        afterCommit: () => {
                            const modeValue = String(clone.querySelector('#trailer-weight-visible')?.value || '').trim().toLowerCase();
                            if (cloneWeightWrap) {
                                cloneWeightWrap.style.display = (modeValue === 'custom' || modeValue === 'other' || modeValue === 'other-approx') ? '' : 'none';
                            }
                        }
                    });
                    bindSimpleSavedField(`#${vehicleType}-length-visible`, 'length', {
                        afterMutate: (entry, nextValue) => {
                            const mode = String(nextValue || '').trim().toLowerCase();
                            if (!(mode === 'custom' || mode === 'other' || mode === 'other-approx')) {
                                entry.customLength = '';
                            }
                        },
                        afterCommit: () => {
                            const modeValue = String(clone.querySelector('#trailer-length-visible')?.value || '').trim().toLowerCase();
                            if (cloneLengthWrap) {
                                cloneLengthWrap.style.display = (modeValue === 'custom' || modeValue === 'other' || modeValue === 'other-approx') ? '' : 'none';
                            }
                        }
                    });
                    bindSimpleSavedField(`#${vehicleType}-tested-visible`, 'tested');
                    bindSimpleSavedField(`#${vehicleType}-custom-weight`, 'customWeight');
                    bindSimpleSavedField(`#${vehicleType}-custom-weight-unit`, 'customWeightUnit', {
                        afterMutate: (entry, nextValue) => {
                            entry.customWeightUnit = nextValue || 'kg';
                        }
                    });
                    bindSimpleSavedField(`#${vehicleType}-custom-length`, 'customLength');
                    bindSimpleSavedField(`#${vehicleType}-custom-length-unit`, 'customLengthUnit', {
                        afterMutate: (entry, nextValue) => {
                            entry.customLengthUnit = nextValue || 'mm';
                        }
                    });
                }
            } else {
                clone.querySelectorAll('input, select, textarea, button').forEach((field) => {
                    if (field.dataset && field.dataset.vehicleClearMedia === vehicleType) {
                        field.style.display = 'none';
                        return;
                    }
                    if (field.tagName === 'BUTTON') return;
                    field.disabled = true;
                    field.readOnly = true;
                });
            }

            clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
            clone.querySelectorAll('[name]').forEach((el) => el.removeAttribute('name'));

            clone.style.cursor = 'default';
            clone.removeAttribute('title');

            vehicleEl.appendChild(actionsWrap);
            vehicleEl.appendChild(clone);
            listContainer.appendChild(vehicleEl);
        });

        if (!isSimpleEditableVehicle && !isEditing && !isDraftVisible && vehicles.length > 0) {
            const addNewBtn = document.createElement('button');
            addNewBtn.type = 'button';
            addNewBtn.textContent = '+ Add Another Vehicle';
            addNewBtn.style.cssText = 'width: 100%; margin-top: 6px; padding: 10px 16px; background: #ffffff; color: #1d4ed8; border: 1px solid #93c5fd; border-radius: 8px; cursor: pointer; font-weight: 700;';
            addNewBtn.addEventListener('click', () => {
                this.editingVehicleIds[vehicleType] = null;
                this.showVehicleDraftForm[vehicleType] = true;
                this.clearVehicleForm(vehicleType);
                this.updateVehicleEditUi(vehicleType);
                this.renderVehiclesList(vehicleType);
                if (entryForm && typeof entryForm.scrollIntoView === 'function') {
                    entryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
            listContainer.appendChild(addNewBtn);
        }

        this.updateVehicleEntryTitle(vehicleType);
    }
};

if (!window.multiItemsManager.__simpleVehicleModePatched) {
    window.multiItemsManager.__simpleVehicleModePatched = true;
    window.multiItemsManager.__simpleCarModePatched = true;

    window.multiItemsManager.__originalRenderVehiclesList = window.multiItemsManager.renderVehiclesList;
    window.multiItemsManager.renderVehiclesList = function(vehicleType) {
        const renderSimpleList = this._renderSimpleVehicleList
            && typeof this._renderSimpleVehicleList[vehicleType] === 'function'
            ? this._renderSimpleVehicleList[vehicleType]
            : null;
        if (renderSimpleList) {
            return renderSimpleList();
        }
        return this.__originalRenderVehiclesList.call(this, vehicleType);
    };

    window.multiItemsManager.__originalUpdateVehicleEditUi = window.multiItemsManager.updateVehicleEditUi;
    window.multiItemsManager.updateVehicleEditUi = function(vehicleType) {
        const usesSimpleFlow = this._renderSimpleVehicleList
            && typeof this._renderSimpleVehicleList[vehicleType] === 'function';
        if (usesSimpleFlow) {
            const addBtn = document.getElementById(`add-${vehicleType}-btn`);
            const addAnotherBtn = document.getElementById(`${vehicleType}-add-another-btn`);
            const continueBtn = document.getElementById(`${vehicleType}-continue-with-saved-btn`);
            if (addBtn) addBtn.style.display = 'none';
            if (addAnotherBtn) addAnotherBtn.style.display = '';
            this.updateVehicleEntryTitle(vehicleType);
            if (typeof this._syncSimpleVehicleDraftUi?.[vehicleType] === 'function') {
                this._syncSimpleVehicleDraftUi[vehicleType]();
            }
            return;
        }
        return this.__originalUpdateVehicleEditUi.call(this, vehicleType);
    };
}

// Initialize piano form handlers
document.addEventListener('DOMContentLoaded', function() {
    const initVehicleCustomSelects = () => {
        const selectNodes = document.querySelectorAll('[data-vehicle-entry-form] select.form-input');
        if (!selectNodes.length) return;

        const closeAllVehicleSelectMenus = () => {
            document.querySelectorAll('.vehicle-select-shell.is-open').forEach((shell) => {
                shell.classList.remove('is-open');
            });
        };

        if (!window.__vehicleSelectGlobalCloseBound) {
            document.addEventListener('click', (event) => {
                if (!event.target.closest('.vehicle-select-shell')) {
                    closeAllVehicleSelectMenus();
                }
            });

            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape') {
                    closeAllVehicleSelectMenus();
                }
            });

            window.__vehicleSelectGlobalCloseBound = true;
        }

        selectNodes.forEach((select) => {
            if (select.dataset.vehicleCustomSelectReady === 'true') return;
            select.dataset.vehicleCustomSelectReady = 'true';

            const shell = document.createElement('div');
            shell.className = 'vehicle-select-shell';

            const trigger = document.createElement('button');
            trigger.type = 'button';
            trigger.className = 'vehicle-select-trigger';
            trigger.setAttribute('aria-haspopup', 'listbox');
            trigger.setAttribute('aria-expanded', 'false');

            const label = document.createElement('span');
            label.className = 'vehicle-select-label';

            const menu = document.createElement('ul');
            menu.className = 'vehicle-select-menu';
            menu.setAttribute('role', 'listbox');

            const setTriggerLabel = () => {
                const selectedOption = select.options[select.selectedIndex];
                label.textContent = selectedOption ? selectedOption.textContent : '';
            };

            const rebuildMenu = () => {
                menu.innerHTML = '';
                Array.from(select.options).forEach((option) => {
                    const item = document.createElement('li');
                    item.className = 'vehicle-select-option';
                    item.setAttribute('role', 'option');
                    item.textContent = option.textContent || '';
                    item.dataset.value = option.value;

                    if (option.disabled) {
                        item.classList.add('is-disabled');
                        item.setAttribute('aria-disabled', 'true');
                    }

                    if (option.value === select.value) {
                        item.classList.add('is-selected');
                        item.setAttribute('aria-selected', 'true');
                    }

                    item.addEventListener('click', () => {
                        if (option.disabled) return;
                        select.value = option.value;
                        select.dispatchEvent(new Event('input', { bubbles: true }));
                        select.dispatchEvent(new Event('change', { bubbles: true }));
                        shell.classList.remove('is-open');
                        trigger.setAttribute('aria-expanded', 'false');
                        setTriggerLabel();
                        rebuildMenu();
                    });

                    menu.appendChild(item);
                });
            };

            trigger.appendChild(label);
            const parent = select.parentNode;
            if (!parent) return;
            parent.insertBefore(shell, select);
            shell.appendChild(select);
            shell.appendChild(trigger);
            shell.appendChild(menu);

            select.classList.add('vehicle-select-native');

            const toggleMenu = () => {
                const open = shell.classList.contains('is-open');
                closeAllVehicleSelectMenus();
                if (!open) {
                    shell.classList.add('is-open');
                    trigger.setAttribute('aria-expanded', 'true');
                } else {
                    shell.classList.remove('is-open');
                    trigger.setAttribute('aria-expanded', 'false');
                }
            };

            trigger.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                toggleMenu();
            });

            select.addEventListener('change', () => {
                setTriggerLabel();
                rebuildMenu();
            });

            setTriggerLabel();
            rebuildMenu();
        });
    };

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

    const setupSimplePianoFlow = () => {
        const manager = window.multiItemsManager;
        if (!manager) return;

        const addBtn = document.getElementById('add-piano-btn');
        const addAnotherBtn = document.getElementById('piano-add-another-btn');
        const continueBtn = document.getElementById('piano-continue-with-saved-btn');
        const continueHidden = document.getElementById('piano-continue-with-saved-hidden');
        const deleteFormBtn = document.getElementById('piano-delete-form-btn');
        if (!addAnotherBtn) return;

        const hasPianoDraftInProgress = () => {
            const draft = manager.collectPianoDraft();
            return !!(
                draft.type
                || draft.size
                || draft.customName
                || draft.customLength
                || draft.customWidth
                || draft.customHeight
                || draft.lengthMeasurement
                || draft.widthMeasurement
                || draft.heightMeasurement
                || (draft.media && draft.media.length)
            );
        };

        const resetContinueWithSavedChoice = () => {
            if (!continueHidden) return;
            continueHidden.value = '';
            continueHidden.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const syncPianoDraftUi = () => {
            const savedCount = manager.parsePianos().length;
            const hasSaved = savedCount > 0;
            const hasDraft = hasPianoDraftInProgress();

            if (continueBtn && continueHidden) {
                continueBtn.style.display = (hasSaved && hasDraft) ? '' : 'none';
                if (!(hasSaved && hasDraft) && continueHidden.value) {
                    resetContinueWithSavedChoice();
                }
            }
            if (deleteFormBtn) {
                deleteFormBtn.style.display = hasDraft ? '' : 'none';
            }
            if (addAnotherBtn) {
                addAnotherBtn.style.display = '';
            }
        };

        const persistAndRefreshState = () => {
            syncPianoDraftUi();
            manager.scheduleProgressSync?.();
        };

        if (addBtn) addBtn.style.display = 'none';
        if (addAnotherBtn.dataset.simplePianoBound !== '1') {
            addAnotherBtn.dataset.simplePianoBound = '1';
            addAnotherBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (typeof manager.pendingVehicleMediaSync?.piano?.then === 'function') {
                    await manager.pendingVehicleMediaSync.piano;
                }

                const media = typeof manager.resolveVehicleMediaForSave === 'function'
                    ? await manager.resolveVehicleMediaForSave('piano')
                    : manager.parseVehicleMediaFromHidden('piano');

                manager.commitPianoDraft({
                    mediaOverride: Array.isArray(media) ? media : [],
                    showAlert: true,
                    focusOnMissing: true,
                    clearAfterSave: true
                });
                manager.renderPianosList();
                syncPianoDraftUi();
            });
        }

        if (deleteFormBtn && deleteFormBtn.dataset.simplePianoBound !== '1') {
            deleteFormBtn.dataset.simplePianoBound = '1';
            deleteFormBtn.addEventListener('click', () => {
                manager.clearPianoForm();
                resetContinueWithSavedChoice();
                if (typeof window.updatePianoCustomSection === 'function') {
                    window.updatePianoCustomSection();
                }
                syncPianoDraftUi();
                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
            });
        }

        if (continueBtn && continueHidden && continueBtn.dataset.simplePianoBound !== '1') {
            continueBtn.dataset.simplePianoBound = '1';
            continueBtn.addEventListener('click', () => {
                continueHidden.value = '1';
                continueHidden.dispatchEvent(new Event('change', { bubbles: true }));
                syncPianoDraftUi();
                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
            });
        }

        const pianoFieldIds = [
            'piano-type-entry-hidden', 'piano-size-entry-hidden',
            'piano-custom-name', 'piano-custom-length', 'piano-custom-width', 'piano-custom-height',
            'piano-length-measurement', 'piano-width-measurement', 'piano-height-measurement',
            'piano-media-hidden'
        ];
        pianoFieldIds.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field || field.dataset.simplePianoBound === '1') return;
            field.dataset.simplePianoBound = '1';
            field.addEventListener('input', persistAndRefreshState);
            field.addEventListener('change', persistAndRefreshState);
        });

        document.querySelectorAll('.piano-type-entry-nav, .piano-size-entry-nav').forEach((nav) => {
            if (nav.dataset.simplePianoBound === '1') return;
            nav.dataset.simplePianoBound = '1';
            nav.addEventListener('click', () => {
                setTimeout(persistAndRefreshState, 0);
            });
        });

        const pianoMediaInput = document.getElementById('piano-media-input');
        if (pianoMediaInput && pianoMediaInput.dataset.simplePianoBound !== '1') {
            pianoMediaInput.dataset.simplePianoBound = '1';
            pianoMediaInput.addEventListener('change', () => {
                if (typeof manager.syncVehicleMediaFromInput === 'function') {
                    manager.syncVehicleMediaFromInput('piano');
                }
                persistAndRefreshState();
            });
        }

        syncPianoDraftUi();
        manager.renderPianosList();
    };

    setupSimplePianoFlow();

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

    window.updatePianoCustomSection = updateCustomSection;

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

    const VEHICLE_SIMPLE_SYNC_FIELDS = {
        car: ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'insurance', 'roadtax', 'weight', 'length'],
        motorbike: ['year', 'value', 'condition', 'roadworthy', 'insurance', 'roadtax', 'weight', 'length'],
        trailer: ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'tested', 'weight', 'length']
    };

    const setupSimpleVehicleFlow = (vehicleType) => {
        const manager = window.multiItemsManager;
        if (!manager || !['car', 'motorbike', 'trailer'].includes(vehicleType)) return;

        const addBtn = document.getElementById(`add-${vehicleType}-btn`);
        const addAnotherBtn = document.getElementById(`${vehicleType}-add-another-btn`);
        const continueBtn = document.getElementById(`${vehicleType}-continue-with-saved-btn`);
        const continueHidden = document.getElementById(`${vehicleType}-continue-with-saved-hidden`);
        const deleteFormBtn = document.getElementById(`${vehicleType}-delete-form-btn`);
        const listContainer = document.getElementById(`${vehicleType}-list`);
        const jsonField = document.getElementById(`${vehicleType}-json-hidden`);
        if (!addAnotherBtn || !listContainer || !jsonField) return;

        const setHidden = (id, value) => {
            const field = document.getElementById(id);
            if (!field) return;
            field.value = String(value || '').trim();
            field.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const syncVisibleToHidden = () => {
            if (typeof manager.syncVisibleVehicleFieldsToHidden === 'function') {
                manager.syncVisibleVehicleFieldsToHidden(vehicleType);
                return;
            }

            (VEHICLE_SIMPLE_SYNC_FIELDS[vehicleType] || []).forEach((suffix) => {
                const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
                let value = String(visible?.value || '').trim();
                if (suffix === 'year') {
                    value = value.replace(/\D+/g, '').slice(0, 4);
                    if (visible) visible.value = value;
                }
                setHidden(`${vehicleType}-${suffix}-entry-hidden`, value);
            });

            if (typeof manager.syncVehicleCustomFieldVisibility === 'function') {
                manager.syncVehicleCustomFieldVisibility(vehicleType);
            }
        };

        const collectDraft = () => {
            const read = (id) => String(document.getElementById(id)?.value || '').trim();
            const media = typeof manager.resolveVehicleMediaForSave === 'function'
                ? null
                : (typeof manager.parseVehicleMediaFromHidden === 'function'
                    ? manager.parseVehicleMediaFromHidden(vehicleType)
                    : []);

            return {
                makeModel: read(`${vehicleType}-make-model-entry`),
                year: read(`${vehicleType}-year-entry-hidden`),
                value: read(`${vehicleType}-value-entry-hidden`),
                type: read(`${vehicleType}-type-entry-hidden`),
                condition: read(`${vehicleType}-condition-entry-hidden`),
                method: read(`${vehicleType}-method-entry-hidden`),
                roadworthy: read(`${vehicleType}-roadworthy-entry-hidden`),
                insurance: read(`${vehicleType}-insurance-entry-hidden`),
                roadtax: read(`${vehicleType}-roadtax-entry-hidden`),
                tested: read(`${vehicleType}-tested-entry-hidden`),
                weight: read(`${vehicleType}-weight-entry-hidden`),
                length: read(`${vehicleType}-length-entry-hidden`),
                customWeight: read(`${vehicleType}-custom-weight`),
                customWeightUnit: read(`${vehicleType}-custom-weight-unit`) || 'kg',
                customLength: read(`${vehicleType}-custom-length`),
                customLengthUnit: read(`${vehicleType}-custom-length-unit`) || 'mm',
                media
            };
        };

        const isCustomLike = (value) => {
            const normalized = String(value || '').trim().toLowerCase();
            return normalized === 'custom' || normalized === 'other' || normalized === 'other-approx';
        };

        const getMissingDraftField = (draft) => {
            const fieldOr = (suffix) => document.getElementById(`${vehicleType}-${suffix}-visible`)
                || document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);

            if (!draft.makeModel) return document.getElementById(`${vehicleType}-make-model-entry`);
            if (vehicleType !== 'motorbike' && !draft.type) return fieldOr('type');
            if (!draft.year) return fieldOr('year');
            if (!draft.value) return fieldOr('value');
            if (!draft.condition) return fieldOr('condition');
            if (vehicleType !== 'motorbike' && !draft.method) return fieldOr('method');
            if (!draft.roadworthy) return fieldOr('roadworthy');
            if (vehicleType !== 'trailer' && !draft.insurance) return fieldOr('insurance');
            if (vehicleType !== 'trailer' && !draft.roadtax) return fieldOr('roadtax');
            if (!draft.weight) return fieldOr('weight');
            if (!draft.length) return fieldOr('length');

            if (vehicleType === 'trailer') {
                const serviceHidden = document.getElementById('item-description-hidden')
                    || document.getElementById('create-job-hidden');
                const isBoatsService = (serviceHidden?.value || '').trim() === 'Boats';
                const weight = String(draft.weight || '').trim();
                let requiresTested = !isBoatsService && weight === 'over-3500';
                if (!requiresTested && !isBoatsService && isCustomLike(weight)) {
                    const customWeight = parseFloat(String(draft.customWeight || '').trim());
                    if (Number.isFinite(customWeight)) {
                        const unit = String(draft.customWeightUnit || 'kg').trim().toLowerCase();
                        const weightInKg = unit === 'lb'
                            ? (customWeight * 0.45359237)
                            : (unit === 'tonne' ? (customWeight * 1000) : customWeight);
                        requiresTested = weightInKg > 3500;
                    }
                }
                if (requiresTested && !draft.tested) {
                    return fieldOr('tested');
                }
            }

            if (isCustomLike(draft.weight) && !draft.customWeight) {
                return document.getElementById(`${vehicleType}-custom-weight`);
            }
            if (isCustomLike(draft.length) && !draft.customLength) {
                return document.getElementById(`${vehicleType}-custom-length`);
            }

            return null;
        };

        const clearDraft = () => {
            if (typeof manager.clearVehicleForm === 'function') {
                manager.clearVehicleForm(vehicleType);
            }
            manager.editingVehicleIds[vehicleType] = null;
            manager.showVehicleDraftForm[vehicleType] = true;
            if (continueHidden) {
                continueHidden.value = '';
                continueHidden.dispatchEvent(new Event('change', { bubbles: true }));
            }
            syncDraftUi();
        };

        const commitSimpleVehicleDraft = (options = {}) => {
            const {
                mediaOverride = null,
                showAlert = true,
                focusOnMissing = true,
                clearAfterSave = true
            } = options;

            const draft = collectDraft();
            draft.media = Array.isArray(mediaOverride)
                ? mediaOverride
                : manager.parseVehicleMediaFromHidden(vehicleType);
            draft.id = Date.now() + Math.random();

            const missing = getMissingDraftField(draft);
            if (missing) {
                if (focusOnMissing && typeof window.revealMissingFieldBeforeAlert === 'function') {
                    const labelMap = {
                        car: 'car/campervan',
                        motorbike: 'motorbike',
                        trailer: 'caravan/trailer'
                    };
                    window.revealMissingFieldBeforeAlert(missing, {
                        skipAlert: !showAlert,
                        alertMessage: showAlert
                            ? `Please complete all required ${labelMap[vehicleType] || 'vehicle'} fields before adding another vehicle.`
                            : ''
                    });
                } else if (focusOnMissing && typeof missing.scrollIntoView === 'function') {
                    missing.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    if (typeof missing.focus === 'function') {
                        missing.focus();
                    }
                }
                return false;
            }

            const vehicles = manager.parseVehicles(vehicleType);
            vehicles.push(draft);
            manager.saveVehicles(vehicleType, vehicles);

            if (clearAfterSave) {
                clearDraft();
            }
            renderSimpleVehicleList();

            if (typeof manager.updateVehicleEntryTitle === 'function') {
                manager.updateVehicleEntryTitle(vehicleType);
            }
            if (typeof window.updateNextButtonState === 'function') {
                window.updateNextButtonState();
            }
            if (typeof window.saveCreateJobProgress === 'function') {
                window.saveCreateJobProgress();
            }

            return true;
        };

        manager.commitSimpleVehicleDraft = manager.commitSimpleVehicleDraft || {};
        manager.commitSimpleVehicleDraft[vehicleType] = commitSimpleVehicleDraft;
        if (vehicleType === 'car') {
            manager.commitSimpleCarDraft = commitSimpleVehicleDraft;
        }

        const renderSimpleVehicleList = () => {
            const vehicles = manager.parseVehicles(vehicleType);
            listContainer.innerHTML = '';
            const sectionIdMap = {
                car: 'car-transport-section',
                motorbike: 'motorbike-transport-section',
                trailer: 'trailer-campervan-section'
            };
            const section = document.getElementById(sectionIdMap[vehicleType] || '');
            const entryForm = section?.querySelector?.(`[data-vehicle-entry-form="${vehicleType}"]`);

            if (!vehicles.length) {
                listContainer.style.display = 'none';
                return;
            }

            listContainer.style.display = 'block';
            vehicles.forEach((vehicle, index) => {
                const card = document.createElement('div');
                card.style.cssText = 'margin-bottom: 14px;';

                const actionsWrap = document.createElement('div');
                actionsWrap.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:8px; justify-content:flex-end;';

                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.textContent = 'Remove';
                removeBtn.style.cssText = 'padding:6px 12px; background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.86rem;';
                removeBtn.addEventListener('click', () => {
                    const current = manager.parseVehicles(vehicleType);
                    const filtered = current.filter((entry) => entry.id !== vehicle.id);
                    manager.saveVehicles(vehicleType, filtered);
                    renderSimpleVehicleList();
                    if (typeof window.updateNextButtonState === 'function') {
                        window.updateNextButtonState();
                    }
                    if (typeof window.saveCreateJobProgress === 'function') {
                        window.saveCreateJobProgress();
                    }
                });

                actionsWrap.appendChild(removeBtn);

                if (!entryForm) {
                    const fallback = document.createElement('div');
                    fallback.style.cssText = 'padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb;';
                    const model = String(vehicle?.makeModel || '').trim() || `Vehicle ${index + 1}`;
                    const year = String(vehicle?.year || '').trim();
                    const type = String(vehicle?.type || '').trim();
                    const worth = String(vehicle?.value || '').trim();
                    const summaryParts = [year, type, worth].filter(Boolean);
                    fallback.innerHTML = `<strong>Vehicle ${index + 1}:</strong> ${model}${summaryParts.length ? ` (${summaryParts.join(' | ')})` : ''}`;

                    card.appendChild(actionsWrap);
                    card.appendChild(fallback);
                    listContainer.appendChild(card);
                    return;
                }

                const clone = entryForm.cloneNode(true);
                clone.removeAttribute('data-vehicle-entry-form');
                clone.style.display = '';

                const setCloneValue = (selector, value) => {
                    const field = clone.querySelector(selector);
                    if (!field) return;
                    if (field.tagName === 'SELECT' || field.tagName === 'INPUT' || field.tagName === 'TEXTAREA') {
                        field.value = String(value || '').trim();
                    }
                };

                setCloneValue(`#${vehicleType}-make-model-entry`, vehicle.makeModel || '');
                setCloneValue(`#${vehicleType}-type-visible`, vehicle.type || '');
                setCloneValue(`#${vehicleType}-year-visible`, vehicle.year || '');
                setCloneValue(`#${vehicleType}-value-visible`, vehicle.value || '');
                setCloneValue(`#${vehicleType}-condition-visible`, vehicle.condition || '');
                setCloneValue(`#${vehicleType}-method-visible`, vehicle.method || '');
                setCloneValue(`#${vehicleType}-roadworthy-visible`, vehicle.roadworthy || '');
                setCloneValue(`#${vehicleType}-insurance-visible`, vehicle.insurance || '');
                setCloneValue(`#${vehicleType}-roadtax-visible`, vehicle.roadtax || '');
                setCloneValue(`#${vehicleType}-tested-visible`, vehicle.tested || '');
                setCloneValue(`#${vehicleType}-weight-visible`, vehicle.weight || '');
                setCloneValue(`#${vehicleType}-length-visible`, vehicle.length || '');
                setCloneValue(`#${vehicleType}-custom-weight`, vehicle.customWeight || '');
                setCloneValue(`#${vehicleType}-custom-weight-unit`, vehicle.customWeightUnit || 'kg');
                setCloneValue(`#${vehicleType}-custom-length`, vehicle.customLength || '');
                setCloneValue(`#${vehicleType}-custom-length-unit`, vehicle.customLengthUnit || 'mm');

                const cloneTitle = clone.querySelector('.custom-item-title');
                if (cloneTitle) {
                    cloneTitle.textContent = `Vehicle ${index + 1}`;
                }

                const cloneWeightWrap = clone.querySelector(`#${vehicleType}-custom-weight-wrap`);
                const cloneLengthWrap = clone.querySelector(`#${vehicleType}-custom-length-wrap`);
                const weightMode = String(vehicle.weight || '').trim().toLowerCase();
                const lengthMode = String(vehicle.length || '').trim().toLowerCase();
                if (cloneWeightWrap) {
                    cloneWeightWrap.style.display = (weightMode === 'custom' || weightMode === 'other' || weightMode === 'other-approx') ? '' : 'none';
                }
                if (cloneLengthWrap) {
                    cloneLengthWrap.style.display = (lengthMode === 'custom' || lengthMode === 'other' || lengthMode === 'other-approx') ? '' : 'none';
                }

                const cloneMedia = Array.isArray(vehicle.media) ? vehicle.media : [];
                manager.renderVehiclePhotoTiles(vehicleType, cloneMedia, clone, { readOnly: true });

                const clonePreview = clone.querySelector(`#${vehicleType}-media-preview`);
                if (clonePreview) {
                    clonePreview.innerHTML = '';
                    clonePreview.style.display = 'none';
                }

                const addBtnInClone = clone.querySelector(`#add-${vehicleType}-btn`);
                const addAnotherInClone = clone.querySelector(`#${vehicleType}-add-another-btn`);
                const continueBtnInClone = clone.querySelector(`#${vehicleType}-continue-with-saved-btn`);
                const deleteFormBtnInClone = clone.querySelector(`#${vehicleType}-delete-form-btn`);
                if (addBtnInClone) addBtnInClone.style.display = 'none';
                if (addAnotherInClone) addAnotherInClone.style.display = 'none';
                if (continueBtnInClone) continueBtnInClone.style.display = 'none';
                if (deleteFormBtnInClone) deleteFormBtnInClone.style.display = 'none';

                const persistSavedVehicleEdit = (mutate) => {
                    const current = manager.parseVehicles(vehicleType);
                    const editIndex = current.findIndex((entry) => entry.id === vehicle.id);
                    if (editIndex < 0) return;

                    mutate(current[editIndex]);

                    if (jsonField) {
                        jsonField.value = current.length > 0 ? JSON.stringify(current) : '';
                        jsonField.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    if (typeof window.updateNextButtonState === 'function') {
                        window.updateNextButtonState();
                    }
                    if (typeof window.saveCreateJobProgress === 'function') {
                        window.saveCreateJobProgress();
                    }
                };

                const syncCloneCustomWraps = () => {
                    const weightSelect = clone.querySelector(`#${vehicleType}-weight-visible`);
                    const lengthSelect = clone.querySelector(`#${vehicleType}-length-visible`);
                    const weightModeValue = String(weightSelect?.value || '').trim().toLowerCase();
                    const lengthModeValue = String(lengthSelect?.value || '').trim().toLowerCase();

                    if (cloneWeightWrap) {
                        cloneWeightWrap.style.display = (weightModeValue === 'custom' || weightModeValue === 'other' || weightModeValue === 'other-approx') ? '' : 'none';
                    }
                    if (cloneLengthWrap) {
                        cloneLengthWrap.style.display = (lengthModeValue === 'custom' || lengthModeValue === 'other' || lengthModeValue === 'other-approx') ? '' : 'none';
                    }
                };

                const bindSavedField = (selector, key, options = {}) => {
                    const field = clone.querySelector(selector);
                    if (!field) return;

                    const commit = () => {
                        let nextValue = String(field.value || '').trim();
                        if (options.normalizeYear) {
                            nextValue = nextValue.replace(/\D+/g, '').slice(0, 4);
                            field.value = nextValue;
                        }

                        persistSavedVehicleEdit((entry) => {
                            entry[key] = nextValue;
                            if (options.afterMutate) {
                                options.afterMutate(entry, nextValue);
                            }
                        });

                        if (options.afterCommit) {
                            options.afterCommit(nextValue);
                        }
                    };

                    field.addEventListener('change', commit);
                    if (field.tagName === 'INPUT') {
                        field.addEventListener('blur', commit);
                    }
                };

                bindSavedField(`#${vehicleType}-make-model-entry`, 'makeModel');
                if (vehicleType !== 'motorbike') {
                    bindSavedField(`#${vehicleType}-type-visible`, 'type');
                }
                bindSavedField(`#${vehicleType}-year-visible`, 'year', { normalizeYear: true });
                bindSavedField(`#${vehicleType}-value-visible`, 'value');
                bindSavedField(`#${vehicleType}-condition-visible`, 'condition');
                if (vehicleType !== 'motorbike') {
                    bindSavedField(`#${vehicleType}-method-visible`, 'method');
                }
                bindSavedField(`#${vehicleType}-roadworthy-visible`, 'roadworthy');
                if (vehicleType !== 'trailer') {
                    bindSavedField(`#${vehicleType}-insurance-visible`, 'insurance');
                    bindSavedField(`#${vehicleType}-roadtax-visible`, 'roadtax');
                }
                if (vehicleType === 'trailer') {
                    bindSavedField(`#${vehicleType}-tested-visible`, 'tested');
                }
                bindSavedField(`#${vehicleType}-weight-visible`, 'weight', {
                    afterMutate: (entry, nextValue) => {
                        const mode = String(nextValue || '').trim().toLowerCase();
                        if (!(mode === 'custom' || mode === 'other' || mode === 'other-approx')) {
                            entry.customWeight = '';
                        }
                    },
                    afterCommit: () => syncCloneCustomWraps()
                });
                bindSavedField(`#${vehicleType}-length-visible`, 'length', {
                    afterMutate: (entry, nextValue) => {
                        const mode = String(nextValue || '').trim().toLowerCase();
                        if (!(mode === 'custom' || mode === 'other' || mode === 'other-approx')) {
                            entry.customLength = '';
                        }
                    },
                    afterCommit: () => syncCloneCustomWraps()
                });
                bindSavedField(`#${vehicleType}-custom-weight`, 'customWeight');
                bindSavedField(`#${vehicleType}-custom-weight-unit`, 'customWeightUnit', {
                    afterMutate: (entry, nextValue) => {
                        entry.customWeightUnit = nextValue || 'kg';
                    }
                });
                bindSavedField(`#${vehicleType}-custom-length`, 'customLength');
                bindSavedField(`#${vehicleType}-custom-length-unit`, 'customLengthUnit', {
                    afterMutate: (entry, nextValue) => {
                        entry.customLengthUnit = nextValue || 'mm';
                    }
                });

                clone.querySelectorAll('input[type="file"]').forEach((field) => {
                    field.disabled = true;
                });
                clone.querySelectorAll('button').forEach((field) => {
                    if (field.dataset && field.dataset.vehicleClearMedia === vehicleType) {
                        field.style.display = 'none';
                        return;
                    }
                    field.style.display = 'none';
                });

                clone.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
                clone.querySelectorAll('[name]').forEach((el) => el.removeAttribute('name'));

                card.appendChild(actionsWrap);
                card.appendChild(clone);
                listContainer.appendChild(card);
            });
        };

        manager._renderSimpleVehicleList = manager._renderSimpleVehicleList || {};
        manager._renderSimpleVehicleList[vehicleType] = renderSimpleVehicleList;
        if (vehicleType === 'car') {
            manager.renderSimpleCarList = renderSimpleVehicleList;
        }

        const hasVehicleDraftInProgress = () => {
            const makeModel = String(document.getElementById(`${vehicleType}-make-model-entry`)?.value || '').trim();
            if (makeModel) return true;

            const hasVisibleOrHiddenValue = (VEHICLE_SIMPLE_SYNC_FIELDS[vehicleType] || []).some((suffix) => {
                const visibleValue = String(document.getElementById(`${vehicleType}-${suffix}-visible`)?.value || '').trim();
                const hiddenValue = String(document.getElementById(`${vehicleType}-${suffix}-entry-hidden`)?.value || '').trim();
                return !!(visibleValue || hiddenValue);
            });

            if (hasVisibleOrHiddenValue) return true;

            return !!(
                String(document.getElementById(`${vehicleType}-custom-weight`)?.value || '').trim()
                || String(document.getElementById(`${vehicleType}-custom-length`)?.value || '').trim()
                || String(document.getElementById(`${vehicleType}-media-hidden`)?.value || '').trim()
            );
        };

        const resetContinueWithSavedChoice = () => {
            if (!continueHidden) return;
            continueHidden.value = '';
            continueHidden.dispatchEvent(new Event('change', { bubbles: true }));
        };

        const syncDraftUi = () => {
            const savedCount = manager.parseVehicles(vehicleType).length;
            const hasSaved = savedCount > 0;
            const hasDraft = hasVehicleDraftInProgress();
            const isEditing = !!manager.editingVehicleIds[vehicleType];

            if (continueBtn && continueHidden) {
                continueBtn.style.display = (hasSaved && hasDraft && !isEditing) ? '' : 'none';
                if (!(hasSaved && hasDraft && !isEditing) && continueHidden.value) {
                    resetContinueWithSavedChoice();
                }
            }

            if (deleteFormBtn) {
                deleteFormBtn.style.display = hasDraft ? '' : 'none';
                deleteFormBtn.textContent = isEditing ? 'Cancel edit' : 'Clear form';
            }

            if (addAnotherBtn) {
                addAnotherBtn.style.display = isEditing ? 'none' : '';
            }
        };

        manager._syncSimpleVehicleDraftUi = manager._syncSimpleVehicleDraftUi || {};
        manager._syncSimpleVehicleDraftUi[vehicleType] = syncDraftUi;

        const persistAndRefreshState = () => {
            syncVisibleToHidden();
            syncDraftUi();
            window.multiItemsManager?.scheduleProgressSync?.();
        };

        if (addBtn) addBtn.style.display = 'none';
        if (addAnotherBtn) {
            addAnotherBtn.style.display = '';
            addAnotherBtn.type = 'button';
        }

        const visibleFieldIds = [
            `${vehicleType}-make-model-entry`,
            ...(VEHICLE_SIMPLE_SYNC_FIELDS[vehicleType] || []).map((suffix) => `${vehicleType}-${suffix}-visible`),
            `${vehicleType}-custom-weight`,
            `${vehicleType}-custom-weight-unit`,
            `${vehicleType}-custom-length`,
            `${vehicleType}-custom-length-unit`
        ];

        visibleFieldIds.forEach((fieldId) => {
            const field = document.getElementById(fieldId);
            if (!field || field.dataset.simpleVehicleBound === '1') return;
            field.dataset.simpleVehicleBound = '1';
            field.addEventListener('input', persistAndRefreshState);
            field.addEventListener('change', persistAndRefreshState);
        });

        const mediaInput = document.getElementById(`${vehicleType}-media-input`);
        if (mediaInput && mediaInput.dataset.simpleVehicleBound !== '1') {
            mediaInput.dataset.simpleVehicleBound = '1';
            mediaInput.addEventListener('change', () => {
                if (typeof manager.syncVehicleMediaFromInput === 'function') {
                    manager.syncVehicleMediaFromInput(vehicleType);
                }
                syncDraftUi();
                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
                    window.multiItemsManager?.scheduleProgressSync?.();
            });
        }

        const clearMediaBtn = document.querySelector(`[data-vehicle-clear-media="${vehicleType}"]`);
        if (clearMediaBtn && clearMediaBtn.dataset.simpleVehicleBound !== '1') {
            clearMediaBtn.dataset.simpleVehicleBound = '1';
            clearMediaBtn.addEventListener('click', () => {
                const input = document.getElementById(`${vehicleType}-media-input`);
                if (input) input.value = '';
                manager.saveVehicleMediaToHidden(vehicleType, []);
                manager.renderVehicleMediaPreview(vehicleType, []);
                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
                if (typeof window.saveCreateJobProgress === 'function') {
                    window.saveCreateJobProgress();
                }
            });
        }

        if (deleteFormBtn && deleteFormBtn.dataset.simpleVehicleBound !== '1') {
            deleteFormBtn.dataset.simpleVehicleBound = '1';
            deleteFormBtn.addEventListener('click', () => {
                const editingVehicleId = manager.editingVehicleIds[vehicleType];
                if (editingVehicleId) {
                    manager.editingVehicleIds[vehicleType] = null;
                } else {
                    const savedVehicles = manager.parseVehicles(vehicleType);
                    manager.showVehicleDraftForm[vehicleType] = savedVehicles.length === 0;
                }
                clearDraft();
                renderSimpleVehicleList();
                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
                if (typeof window.saveCreateJobProgress === 'function') {
                    window.saveCreateJobProgress();
                }
            });
        }

        if (continueBtn && continueHidden && continueBtn.dataset.simpleVehicleBound !== '1') {
            continueBtn.dataset.simpleVehicleBound = '1';
            continueBtn.addEventListener('click', () => {
                continueHidden.value = '1';
                continueHidden.dispatchEvent(new Event('change', { bubbles: true }));
                syncDraftUi();
                if (typeof window.updateNextButtonState === 'function') {
                    window.updateNextButtonState();
                }
            });
        }

        if (addAnotherBtn.dataset.simpleVehicleBound !== '1') {
            addAnotherBtn.dataset.simpleVehicleBound = '1';
            addAnotherBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                syncVisibleToHidden();

                if (typeof manager.pendingVehicleMediaSync?.[vehicleType]?.then === 'function') {
                    await manager.pendingVehicleMediaSync[vehicleType];
                }

                const media = typeof manager.resolveVehicleMediaForSave === 'function'
                    ? await manager.resolveVehicleMediaForSave(vehicleType)
                    : manager.parseVehicleMediaFromHidden(vehicleType);
                commitSimpleVehicleDraft({
                    mediaOverride: Array.isArray(media) ? media : [],
                    showAlert: true,
                    focusOnMissing: true,
                    clearAfterSave: true
                });
            });
        }

        manager._vehicleRenderFuncs = manager._vehicleRenderFuncs || {};
        manager._vehicleRenderFuncs[vehicleType] = () => {
            if (addBtn) addBtn.style.display = 'none';
            syncVisibleToHidden();
            syncDraftUi();
            renderSimpleVehicleList();
        };

        manager._vehicleRenderFuncs[vehicleType]();
        setTimeout(() => manager._vehicleRenderFuncs[vehicleType](), 0);
        setTimeout(() => manager._vehicleRenderFuncs[vehicleType](), 150);
    };

    // Initialize unified vehicle handlers for each transport service type.
    ['car', 'motorbike', 'trailer'].forEach((vehicleType) => {
        setupSimpleVehicleFlow(vehicleType);
    });

    // Legacy per-type init removed — all vehicle services use setupSimpleVehicleFlow above.
    if (false) {
    ['car', 'motorbike', 'trailer'].forEach(vehicleType => {
        if (vehicleType === 'car') {
            return;
        }

        const continueWithSavedBtn = document.getElementById(`${vehicleType}-continue-with-saved-btn`);
        const continueWithSavedHidden = document.getElementById(`${vehicleType}-continue-with-saved-hidden`);
        const addAnotherBtn = document.getElementById(`${vehicleType}-add-another-btn`);

        const syncVehicleMediaUiFromHidden = () => {
            const mediaItems = window.multiItemsManager.parseVehicleMediaFromHidden(vehicleType);
            window.multiItemsManager.renderVehicleMediaPreview(vehicleType, mediaItems);
        };

        const defaultFieldsByType = {
            car: {},
            motorbike: {},
            trailer: {}
        };

        const syncVisibleVehicleFieldsToHidden = () => {
            const syncPairsByType = {
                car: ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'insurance', 'roadtax', 'weight', 'length'],
                motorbike: ['year', 'value', 'condition', 'roadworthy', 'insurance', 'roadtax', 'weight', 'length'],
                trailer: ['type', 'year', 'value', 'condition', 'method', 'roadworthy', 'tested', 'weight', 'length']
            };

            const fields = syncPairsByType[vehicleType] || [];
            fields.forEach((suffix) => {
                const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
                const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
                if (!visible || !hidden) return;

                let nextValue = String(visible.value || '').trim();
                if (suffix === 'year') {
                    nextValue = nextValue.replace(/\D+/g, '').slice(0, 4);
                    visible.value = nextValue;
                }
                hidden.value = nextValue;
                hidden.dispatchEvent(new Event('change', { bubbles: true }));
            });

            window.multiItemsManager.syncVehicleCustomFieldVisibility(vehicleType);
            if (vehicleType === 'trailer') {
                syncTrailerTestedRequirement();
            }
        };

        const applyVehicleFieldDefaults = () => {
            const defaults = defaultFieldsByType[vehicleType] || {};
            Object.entries(defaults).forEach(([suffix, defaultValue]) => {
                const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
                if (!hidden) return;

                const currentValue = String(hidden.value || '').trim();
                if (!currentValue) {
                    hidden.value = defaultValue;
                }
            });

            const customLengthInput = document.getElementById(`${vehicleType}-custom-length`);
            if (customLengthInput && !String(customLengthInput.value || '').trim()) {
                customLengthInput.value = '0';
            }
        };

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

            const makeInput = document.getElementById(`${vehicleType}-make-model-entry`);
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

        const clearMediaBtn = document.querySelector(`[data-vehicle-clear-media="${vehicleType}"]`);
        if (clearMediaBtn) {
            clearMediaBtn.addEventListener('click', () => {
                const mediaInputField = document.getElementById(`${vehicleType}-media-input`);
                if (mediaInputField) mediaInputField.value = '';
                window.multiItemsManager.saveVehicleMediaToHidden(vehicleType, []);
                window.multiItemsManager.renderVehicleMediaPreview(vehicleType, []);
                if (window.updateNextButtonState) window.updateNextButtonState();
            });
        }

        const makeModelInput = document.getElementById(`${vehicleType}-make-model-entry`);
        if (makeModelInput) {
            makeModelInput.addEventListener('input', () => {
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                window.multiItemsManager?.scheduleProgressSync?.();
            });
            makeModelInput.addEventListener('change', () => {
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                window.multiItemsManager?.scheduleProgressSync?.();
            });
        }

        document.querySelectorAll(`[id^="${vehicleType}-"][id$="-visible"]`).forEach((field) => {
            field.addEventListener('input', () => {
                syncVisibleVehicleFieldsToHidden();
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                window.multiItemsManager?.scheduleProgressSync?.();
            });
            field.addEventListener('change', () => {
                syncVisibleVehicleFieldsToHidden();
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncDeleteFormUi();
                window.multiItemsManager?.scheduleProgressSync?.();
            });
        });

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
        let allowProgrammaticAddClick = false;
        if (addAnotherBtn) {
            addAnotherBtn.addEventListener('click', () => {
                const isEditing = !!window.multiItemsManager.editingVehicleIds[vehicleType];
                if (isEditing || !addBtn) return;

                const beforeSavedCount = window.multiItemsManager.parseVehicles(vehicleType).length;
                clearAfterSuccessfulAdd = true;
            allowProgrammaticAddClick = true;
            addBtn.click();
            allowProgrammaticAddClick = false;

                // Guard against stale UI state: if save succeeded, force a fresh blank draft view.
                setTimeout(() => {
                    const afterSavedCount = window.multiItemsManager.parseVehicles(vehicleType).length;
                    if (afterSavedCount > beforeSavedCount) {
                        window.multiItemsManager.editingVehicleIds[vehicleType] = null;
                        window.multiItemsManager.showVehicleDraftForm[vehicleType] = true;
                        window.multiItemsManager.clearVehicleForm(vehicleType);
                        window.multiItemsManager.updateVehicleEditUi(vehicleType);
                        window.multiItemsManager.renderVehiclesList(vehicleType);
                        syncContinueWithSavedUi();
                        syncAddAnotherUi();
                        syncDeleteFormUi();
                    }
                }, 0);
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
                    // If not editing, this button should only clear the in-progress draft form.
                    // Saved vehicles are removed via the card-level Remove action.
                    const savedVehicles = window.multiItemsManager.parseVehicles(vehicleType);
                    window.multiItemsManager.showVehicleDraftForm[vehicleType] = savedVehicles.length === 0;
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

        const commitVehicleDraft = (mediaForSave, options = {}) => {
            const {
                showAlert = true,
                clearAfterSuccessfulAdd = true
            } = options;

            syncVisibleVehicleFieldsToHidden();

            const getEntryValue = (suffix) => {
                const hidden = document.getElementById(`${vehicleType}-${suffix}-entry-hidden`);
                const hiddenValue = hidden ? String(hidden.value || '').trim() : '';
                if (hiddenValue) {
                    return hiddenValue;
                }

                const visible = document.getElementById(`${vehicleType}-${suffix}-visible`);
                const visibleValue = visible ? String(visible.value || '').trim() : '';
                if (visibleValue) {
                    if (hidden) {
                        hidden.value = visibleValue;
                        hidden.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    return visibleValue;
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

            const focusVehicleField = (suffixOrField, alertMessage) => {
                let target = null;

                if (typeof suffixOrField === 'string') {
                    const visibleField = document.getElementById(`${vehicleType}-${suffixOrField}-visible`);
                    const navByClass = document.querySelector(`.${vehicleType}-${suffixOrField}-entry-nav`);
                    const navByData = document.querySelector(`.option-nav[data-option-nav-for="${vehicleType}-${suffixOrField}-entry-hidden"]`);
                    target = visibleField
                        || navByClass
                        || navByData
                        || document.getElementById(`${vehicleType}-${suffixOrField}-entry-hidden`);
                } else if (suffixOrField) {
                    target = suffixOrField;
                }

                if (!target) return;

                if (typeof window.revealMissingFieldBeforeAlert === 'function') {
                    window.revealMissingFieldBeforeAlert(target, {
                        skipAlert: !showAlert,
                        alertMessage: String(alertMessage || '').trim()
                    });
                    return;
                }

                if (typeof target.scrollIntoView === 'function') {
                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }

                if (typeof target.focus === 'function') {
                    setTimeout(() => {
                        target.focus({ preventScroll: true });
                    }, 0);
                }

                if (showAlert && alertMessage) {
                    alert(alertMessage);
                }
            };

            const vehicleDisplayLabel = vehicleType === 'trailer' ? 'caravan/trailer' : 'vehicle';

            if (!makeInput || !makeInput.value.trim()) {
                focusVehicleField(makeInput, `Please enter ${vehicleDisplayLabel} make and model`);
                return false;
            }

            const yearData = resolveYearValue();
            if (!yearData.selectedYear) {
                focusVehicleField('year', `Please select a ${vehicleDisplayLabel} year`);
                return false;
            }

            if (String(yearData.selectedYear).toLowerCase() === 'older' && !yearData.resolvedYear) {
                const olderYearInputField = getOlderYearInput();
                focusVehicleField(
                    olderYearInputField || 'year',
                    `Please enter the ${vehicleDisplayLabel} year for the Older option`
                );
                return false;
            }

            const valueEntryValue = getEntryValue('value');
            if (!valueEntryValue) {
                focusVehicleField('value', `Please select ${vehicleDisplayLabel} estimated value`);
                return false;
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
                focusVehicleField(
                    missingExtra,
                    `Please select ${vehicleDisplayLabel} ${requiredFieldLabel[missingExtra] || missingExtra}`
                );
                return false;
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
                focusVehicleField(customWeightInput, 'Please enter approximate weight');
                return false;
            }

            if (lookup.length === 'custom' && !customLengthValue) {
                focusVehicleField(customLengthInput, 'Please enter approximate length');
                return false;
            }

            const trailerNeedsTested = vehicleType === 'trailer' && !isBoatsServiceActive() && (
                lookup.weight === 'over-3500'
                || (lookup.weight === 'custom' && isCustomWeightAboveTrailerThreshold())
            );

            if (trailerNeedsTested && !String(lookup.tested || '').trim()) {
                focusVehicleField('tested', 'Please select tested certification status for trailers over 3500kg');
                return false;
            }

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
                media: Array.isArray(mediaForSave) ? mediaForSave : window.multiItemsManager.parseVehicleMediaFromHidden(vehicleType),
                floors: window.multiItemsManager.parseFloorsFromHidden(vehicleType)
            };

            const saved = window.multiItemsManager.addVehicle(vehicleType, vehicleData);

            if (saved) {
                const wasEdit = false;
                window.multiItemsManager.clearVehicleForm(vehicleType);
                window.multiItemsManager.editingVehicleIds[vehicleType] = null;
                window.multiItemsManager.showVehicleDraftForm[vehicleType] = true;
                window.multiItemsManager.updateVehicleEditUi(vehicleType);
                window.multiItemsManager.renderVehiclesList(vehicleType);
                resetContinueWithSavedChoice();
                syncContinueWithSavedUi();
                syncAddAnotherUi();
                syncDeleteFormUi();
                showVehicleSavedIndicator(wasEdit);

                if (window.updateNextButtonState) window.updateNextButtonState();
                if (typeof window.saveCreateJobProgress === 'function') {
                    window.saveCreateJobProgress();
                }
            }

            return saved;
        };

        window.multiItemsManager.commitVehicleDraft = window.multiItemsManager.commitVehicleDraft || {};
        window.multiItemsManager.commitVehicleDraft[vehicleType] = commitVehicleDraft;

        const addBtn = document.getElementById(`add-${vehicleType}-btn`);
        if (addBtn) {
            const handleAddClick = async function(e) {
                e.preventDefault();
                e.stopPropagation();

                // Ignore unintended synthetic clicks (for example from unrelated validation flows).
                // We only allow synthetic clicks triggered by the explicit "+ Add Another Vehicle" action.
                const isProgrammaticClick = !!(e && Object.prototype.hasOwnProperty.call(e, 'isTrusted') && e.isTrusted === false);
                const allowProgrammaticFromManager = !!(window.multiItemsManager.allowProgrammaticVehicleAddClick && window.multiItemsManager.allowProgrammaticVehicleAddClick[vehicleType]);
                if (allowProgrammaticFromManager && window.multiItemsManager.allowProgrammaticVehicleAddClick) {
                    window.multiItemsManager.allowProgrammaticVehicleAddClick[vehicleType] = false;
                }

                if (isProgrammaticClick && !allowProgrammaticAddClick && !allowProgrammaticFromManager) {
                    return;
                }

                console.log(`[${vehicleType}] Add button clicked`);
                try {
                    const pendingMediaSync = window.multiItemsManager.pendingVehicleMediaSync?.[vehicleType];
                    if (pendingMediaSync && typeof pendingMediaSync.then === 'function') {
                        await pendingMediaSync;
                    }

                    const mediaForSave = await window.multiItemsManager.resolveVehicleMediaForSave(vehicleType);

                    const saved = commitVehicleDraft(mediaForSave, { showAlert: true, clearAfterSuccessfulAdd: true });
                    if (!saved) {
                        return;
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
            syncVehicleMediaUiFromHidden();
            syncContinueWithSavedUi();
            syncAddAnotherUi();
            syncDeleteFormUi();
        };

        // Initial render
        window.multiItemsManager._vehicleRenderFuncs[vehicleType]();
        syncVehicleMediaUiFromHidden();
        setTimeout(syncVehicleMediaUiFromHidden, 0);
        setTimeout(syncVehicleMediaUiFromHidden, 150);
        if (vehicleType === 'trailer') {
            syncTrailerTestedRequirement();
        }
    });
    }

    // Watch for step changes and re-render vehicles only when entering step 3.
    let lastObservedStep = parseInt(document.body.getAttribute('data-form-step') || document.body.getAttribute('data-current-step') || '1', 10);
    const rerenderVehiclesIfNeeded = () => {
        const currentStep = parseInt(document.body.getAttribute('data-form-step') || document.body.getAttribute('data-current-step') || '1', 10);
        if (currentStep !== 3 || currentStep === lastObservedStep || !window.multiItemsManager._vehicleRenderFuncs) {
            lastObservedStep = currentStep;
            return;
        }

        lastObservedStep = currentStep;
        ['car', 'motorbike', 'trailer'].forEach((vehicleType) => {
            if (window.multiItemsManager._vehicleRenderFuncs[vehicleType]) {
                try {
                    window.multiItemsManager._vehicleRenderFuncs[vehicleType]();
                } catch (e) {
                    console.error(`Error re-rendering ${vehicleType} vehicles:`, e);
                }
            }
        });
    };

    if (document.body && typeof MutationObserver === 'function') {
        const stepMutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes') {
                    rerenderVehiclesIfNeeded();
                    break;
                }
            }
        });
        stepMutationObserver.observe(document.body, {
            attributes: true,
            attributeFilter: ['data-form-step', 'data-current-step']
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            rerenderVehiclesIfNeeded();
        }
    });

    window.addEventListener('pageshow', () => {
        rerenderVehiclesIfNeeded();
    });

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

    // Keep native selects until custom vehicle-select CSS is restored.
    // The enhancer currently renders unstyled list menus when reverted CSS is missing.
    // initVehicleCustomSelects();
});

