(function (global) {
    'use strict';

    var OTHER_TYPE_VALUE = '__other__';

    var STANDARD_VEHICLE_TYPES = [
        'Car',
        'Motorbike',
        'Bicycle',
        'Van',
        'Mini van',
        'Transit van (delivery van)',
        'Lorry',
        'Truck',
        'Trailer'
    ];

    var CAPACITY_OPTIONS = [
        'Up to 1.5 t.',
        'Up to 3.5 t.',
        'Up to 7.5 t.',
        'Up to 18 t.',
        'Not applicable'
    ];

    function escapeHtml(s) {
        return String(s || '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function escapeAttribute(s) {
        return String(s || '').replace(/"/g, '&quot;');
    }

    function typeKey(label) {
        return typeof global.normalizeTransportModeKey === 'function'
            ? global.normalizeTransportModeKey(label)
            : String(label || '').trim().toLowerCase();
    }

    function iconSvg(label, size) {
        size = size || 18;
        var fn = typeof global.transportModeIconSvg === 'function' ? global.transportModeIconSvg : null;
        if (!fn) return '';
        var svg = fn(label);
        return svg.replace(/width="18"/, 'width="' + size + '"').replace(/height="18"/, 'height="' + size + '"');
    }

    function isCatalogType(label) {
        var key = typeKey(label);
        return STANDARD_VEHICLE_TYPES.some(function (entry) { return typeKey(entry) === key; });
    }

    function normalizeVehicleEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        var customType = String(entry.customType || entry.typeLabel || '').trim();
        var type = String(entry.type || entry.vehicleType || customType || '').trim();
        if (entry.type === OTHER_TYPE_VALUE && customType) {
            type = customType;
        }
        if (!type) return null;
        var capacity = String(entry.capacity || entry.maxCapacity || CAPACITY_OPTIONS[1]).trim();
        if (!CAPACITY_OPTIONS.some(function (opt) { return opt === capacity; })) {
            capacity = CAPACITY_OPTIONS[1];
        }
        var qty = parseInt(entry.quantity != null ? entry.quantity : entry.qty, 10);
        if (!Number.isFinite(qty) || qty < 1) qty = 1;
        qty = Math.min(999, qty);
        return {
            type: type,
            capacity: capacity,
            quantity: qty
        };
    }

    function normalizeFleetFromUser(u, getTransportModes) {
        if (!u || typeof u !== 'object') return [];
        if (Array.isArray(u.providerVehicles) && u.providerVehicles.length) {
            return u.providerVehicles.map(normalizeVehicleEntry).filter(Boolean);
        }
        var modes = typeof getTransportModes === 'function' ? getTransportModes(u) : [];
        if (!modes.length) return [];
        var total = u.vehicleCount != null && u.vehicleCount !== '' ? parseInt(u.vehicleCount, 10) : 0;
        if (!Number.isFinite(total) || total < 1) total = modes.length;
        var per = Math.max(1, Math.floor(total / modes.length) || 1);
        return modes.map(function (mode, index) {
            var qty = index === modes.length - 1 ? Math.max(1, total - per * (modes.length - 1)) : per;
            return normalizeVehicleEntry({
                type: mode,
                capacity: 'Up to 3.5 t.',
                quantity: qty
            });
        }).filter(Boolean);
    }

    function deriveLegacyFromFleet(fleet) {
        var list = Array.isArray(fleet) ? fleet.map(normalizeVehicleEntry).filter(Boolean) : [];
        var modes = [];
        var seen = {};
        var total = 0;
        list.forEach(function (item) {
            var label = String(item.type || '').trim();
            if (!label) return;
            var key = typeKey(label);
            if (key && !seen[key]) {
                seen[key] = true;
                modes.push(label);
            }
            total += item.quantity || 0;
        });
        return {
            providerVehicles: list,
            transportModes: modes,
            vehicleCount: list.length ? Math.min(9999, total) : null
        };
    }

    function fleetSignature(fleet) {
        return JSON.stringify((fleet || []).map(normalizeVehicleEntry).filter(Boolean));
    }

    function formatFleetChange(before, after) {
        if (fleetSignature(before) === fleetSignature(after)) return null;
        var prev = (before || []).map(function (v) {
            return (v.quantity || 1) + '× ' + v.type + (v.capacity ? ' (' + v.capacity + ')' : '');
        });
        var next = (after || []).map(function (v) {
            return (v.quantity || 1) + '× ' + v.type + (v.capacity ? ' (' + v.capacity + ')' : '');
        });
        if (!prev.length && next.length) return 'Vehicles: added ' + next.join('; ');
        if (prev.length && !next.length) return 'Vehicles: cleared';
        return 'Vehicles: ' + (next.length ? next.join('; ') : 'updated');
    }

        function buildTypeSelectOptions(selectedType, extraTypes) {
        var html = '';
        var selectedKey = typeKey(selectedType);
        var isCustom = selectedType && !isCatalogType(selectedType);
        STANDARD_VEHICLE_TYPES.forEach(function (label) {
            html += '<option value="' + escapeAttribute(label) + '"' + (!isCustom && typeKey(label) === selectedKey ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
        });
        var extras = Array.isArray(extraTypes) ? extraTypes : [];
        extras.forEach(function (label) {
            if (!label || isCatalogType(label)) return;
            if (typeKey(label) === selectedKey) return;
            html += '<option value="' + escapeAttribute(label) + '">' + escapeHtml(label) + '</option>';
        });
        if (isCustom) {
            html += '<option value="' + OTHER_TYPE_VALUE + '" selected>Other vehicle…</option>';
        } else {
            html += '<option value="' + OTHER_TYPE_VALUE + '">Other vehicle…</option>';
        }
        return html;
    }

    function buildCapacityOptions(selected) {
        return CAPACITY_OPTIONS.map(function (opt) {
            return '<option value="' + escapeAttribute(opt) + '"' + (opt === selected ? ' selected' : '') + '>' + escapeHtml(opt) + '</option>';
        }).join('');
    }

    function buildEditorRow(row, index, disabled, extraTypes) {
        row = normalizeVehicleEntry(row) || { type: 'Van', capacity: CAPACITY_OPTIONS[1], quantity: 1 };
        var isOther = !isCatalogType(row.type);
        var customStyle = isOther ? '' : ' style="display:none;"';
        var disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';
        return [
            '<div class="provider-vehicle-row" data-vehicle-row="' + index + '">',
            '  <div class="provider-vehicle-field provider-vehicle-field--type">',
            '    <span class="provider-vehicle-field-label">Vehicle type</span>',
            '    <div class="provider-vehicle-type-control">',
            '      <span class="provider-vehicle-row-icon" data-vehicle-icon>' + iconSvg(row.type, 22) + '</span>',
            '      <select class="form-input provider-vehicle-type-select" data-vehicle-type' + disabledAttr + '>',
            buildTypeSelectOptions(isOther ? row.type : row.type, extraTypes),
            '      </select>',
            '    </div>',
            '    <input class="form-input provider-vehicle-custom-type" data-vehicle-custom-type type="text" maxlength="60" placeholder="Vehicle name"' + customStyle + ' value="' + escapeAttribute(isOther ? row.type : '') + '"' + disabledAttr + '>',
            '  </div>',
            '  <div class="provider-vehicle-field provider-vehicle-field--capacity">',
            '    <span class="provider-vehicle-field-label">Max capacity</span>',
            '    <select class="form-input" data-vehicle-capacity' + disabledAttr + '>' + buildCapacityOptions(row.capacity) + '</select>',
            '  </div>',
            '  <div class="provider-vehicle-field provider-vehicle-field--qty">',
            '    <span class="provider-vehicle-field-label">Quantity</span>',
            '    <div class="provider-vehicle-qty">',
            '      <button type="button" class="provider-vehicle-qty-btn" data-vehicle-qty-minus aria-label="Decrease quantity"' + disabledAttr + '>−</button>',
            '      <input class="form-input provider-vehicle-qty-input" data-vehicle-qty type="number" min="1" max="999" step="1" value="' + row.quantity + '"' + disabledAttr + '>',
            '      <button type="button" class="provider-vehicle-qty-btn" data-vehicle-qty-plus aria-label="Increase quantity"' + disabledAttr + '>+</button>',
            '    </div>',
            '  </div>',
            disabled ? '' : '  <button type="button" class="provider-vehicle-remove" data-vehicle-remove aria-label="Remove vehicle">×</button>',
            '</div>'
        ].join('');
    }

    function renderEditorHtml(fleet, disabled, extraTypes) {
        var rows = Array.isArray(fleet) && fleet.length ? fleet : [{ type: 'Van', capacity: CAPACITY_OPTIONS[1], quantity: 1 }];
        return [
            '<div class="provider-vehicle-fleet-editor" data-provider-vehicle-editor>',
            '  <div class="provider-vehicle-fleet-head" aria-hidden="true">',
            '    <span>Vehicle type</span><span>Max capacity</span><span>Quantity</span><span></span>',
            '  </div>',
            '  <div class="provider-vehicle-fleet-rows" data-vehicle-rows>',
            rows.map(function (row, index) { return buildEditorRow(row, index, disabled, extraTypes); }).join(''),
            '  </div>',
            disabled ? '' : '  <button type="button" class="provider-vehicle-add-link" data-vehicle-add type="button">+ Add vehicle</button>',
            '</div>'
        ].join('');
    }

    function readRowType(rowEl) {
        var select = rowEl.querySelector('[data-vehicle-type]');
        var custom = rowEl.querySelector('[data-vehicle-custom-type]');
        if (!select) return '';
        if (select.value === OTHER_TYPE_VALUE) {
            return String(custom && custom.value || '').trim();
        }
        return String(select.value || '').trim();
    }

    function updateRowIcon(rowEl) {
        var iconWrap = rowEl.querySelector('[data-vehicle-icon]');
        if (!iconWrap) return;
        var label = readRowType(rowEl) || 'Van';
        iconWrap.innerHTML = iconSvg(label, 22);
    }

    function collectFleetFromEditor(root) {
        if (!root) return [];
        var rows = root.querySelectorAll('[data-vehicle-row]');
        var fleet = [];
        rows.forEach(function (rowEl) {
            var type = readRowType(rowEl);
            if (!type) return;
            var capacityEl = rowEl.querySelector('[data-vehicle-capacity]');
            var qtyEl = rowEl.querySelector('[data-vehicle-qty]');
            fleet.push(normalizeVehicleEntry({
                type: type,
                capacity: capacityEl ? capacityEl.value : CAPACITY_OPTIONS[1],
                quantity: qtyEl ? qtyEl.value : 1
            }));
        });
        return fleet.filter(Boolean);
    }

    function bindEditor(root, onChange) {
        if (!root) return;

        function notify() {
            if (typeof onChange === 'function') onChange(collectFleetFromEditor(root));
        }

        root.addEventListener('change', function (e) {
            var row = e.target.closest('[data-vehicle-row]');
            if (!row) return notify();
            if (e.target.matches('[data-vehicle-type]')) {
                var custom = row.querySelector('[data-vehicle-custom-type]');
                if (e.target.value === OTHER_TYPE_VALUE) {
                    if (custom) {
                        custom.style.display = '';
                        custom.focus();
                    }
                } else if (custom) {
                    custom.style.display = 'none';
                    custom.value = '';
                }
                updateRowIcon(row);
            }
            notify();
        });

        root.addEventListener('input', function (e) {
            if (e.target.matches('[data-vehicle-custom-type]')) {
                updateRowIcon(e.target.closest('[data-vehicle-row]'));
            }
            notify();
        });

        root.addEventListener('click', function (e) {
            var addBtn = e.target.closest('[data-vehicle-add]');
            if (addBtn) {
                e.preventDefault();
                var rowsWrap = root.querySelector('[data-vehicle-rows]');
                if (!rowsWrap) return;
                var index = rowsWrap.querySelectorAll('[data-vehicle-row]').length;
                var extraTypes = collectFleetFromEditor(root).map(function (v) { return v.type; });
                rowsWrap.insertAdjacentHTML('beforeend', buildEditorRow({ type: 'Van', capacity: CAPACITY_OPTIONS[1], quantity: 1 }, index, false, extraTypes));
                notify();
                return;
            }
            var removeBtn = e.target.closest('[data-vehicle-remove]');
            if (removeBtn) {
                e.preventDefault();
                var row = removeBtn.closest('[data-vehicle-row]');
                var rowsWrap = root.querySelector('[data-vehicle-rows]');
                if (!row || !rowsWrap) return;
                if (rowsWrap.querySelectorAll('[data-vehicle-row]').length <= 1) {
                    row.querySelector('[data-vehicle-type]').value = 'Van';
                    var custom = row.querySelector('[data-vehicle-custom-type]');
                    if (custom) { custom.style.display = 'none'; custom.value = ''; }
                    row.querySelector('[data-vehicle-capacity]').value = CAPACITY_OPTIONS[1];
                    row.querySelector('[data-vehicle-qty]').value = '1';
                    updateRowIcon(row);
                } else {
                    row.remove();
                }
                notify();
                return;
            }
            var minus = e.target.closest('[data-vehicle-qty-minus]');
            if (minus) {
                e.preventDefault();
                var qtyInput = minus.parentNode.querySelector('[data-vehicle-qty]');
                if (!qtyInput) return;
                qtyInput.value = String(Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1));
                notify();
                return;
            }
            var plus = e.target.closest('[data-vehicle-qty-plus]');
            if (plus) {
                e.preventDefault();
                var qtyInput2 = plus.parentNode.querySelector('[data-vehicle-qty]');
                if (!qtyInput2) return;
                qtyInput2.value = String(Math.min(999, (parseInt(qtyInput2.value, 10) || 1) + 1));
                notify();
            }
        });
    }

    function renderPublicFleetHtml(fleet) {
        var list = Array.isArray(fleet) ? fleet.map(normalizeVehicleEntry).filter(Boolean) : [];
        if (!list.length) return '';
        return '<div class="provider-vehicle-fleet-public">' + list.map(function (item) {
            var qtyLabel = (item.quantity || 1) + '× ' + item.type;
            return [
                '<div class="provider-vehicle-public-card">',
                '  <div class="provider-vehicle-public-icon">' + iconSvg(item.type, 56) + '</div>',
                '  <div class="provider-vehicle-public-name">' + escapeHtml(qtyLabel) + '</div>',
                '  <div class="provider-vehicle-public-capacity">Capacity ' + escapeHtml(String(item.capacity || '').toLowerCase()) + '</div>',
                '</div>'
            ].join('');
        }).join('') + '</div>';
    }

    global.anytransportProviderVehicles = {
        OTHER_TYPE_VALUE: OTHER_TYPE_VALUE,
        STANDARD_VEHICLE_TYPES: STANDARD_VEHICLE_TYPES,
        CAPACITY_OPTIONS: CAPACITY_OPTIONS,
        normalizeVehicleEntry: normalizeVehicleEntry,
        normalizeFleetFromUser: normalizeFleetFromUser,
        deriveLegacyFromFleet: deriveLegacyFromFleet,
        formatFleetChange: formatFleetChange,
        renderEditorHtml: renderEditorHtml,
        bindEditor: bindEditor,
        collectFleetFromEditor: collectFleetFromEditor,
        renderPublicFleetHtml: renderPublicFleetHtml,
        iconSvg: iconSvg
    };
})(typeof window !== 'undefined' ? window : this);
