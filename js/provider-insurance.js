(function (global) {
    'use strict';

    var OTHER_TYPE_VALUE = '__other__';
    var NO_INSURANCE_TYPE = 'No insurance';

    var STANDARD_INSURANCE_TYPES = [
        'Goods In Transit',
        'Public Liability',
        'Carriers Liability',
        'Freight Forwarders Liability',
        'Hazardous Goods',
        'Vehicle Recovery & Maintenance',
        'Taxi/PSV',
        'Pet Transport',
        NO_INSURANCE_TYPE,
        'Other'
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
        return String(label || '').trim().toLowerCase();
    }

    function isCatalogType(label) {
        var key = typeKey(label);
        return STANDARD_INSURANCE_TYPES.some(function (entry) {
            return typeKey(entry) === key;
        });
    }

    function isNoInsuranceType(label) {
        return typeKey(label) === typeKey(NO_INSURANCE_TYPE);
    }

    function parseCoverageValue(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        var num = parseFloat(String(value).replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(num) || num < 0) {
            return null;
        }
        return Math.min(999999999, Math.round(num));
    }

    function formatCoverageValue(value) {
        var num = parseCoverageValue(value);
        if (num === null) {
            return 'Not specified';
        }
        return 'Covers up to £' + num.toLocaleString('en-GB');
    }

    function normalizeInsuranceEntry(entry) {
        if (!entry || typeof entry !== 'object') {
            return null;
        }
        var customType = String(entry.customType || entry.typeLabel || '').trim();
        var type = String(entry.type || entry.insuranceType || customType || '').trim();
        if (entry.type === OTHER_TYPE_VALUE && customType) {
            type = customType;
        }
        if (!type) {
            return null;
        }
        var coverageUpTo = isNoInsuranceType(type) ? null : parseCoverageValue(
            entry.coverageUpTo != null ? entry.coverageUpTo : entry.coverageValue
        );
        return {
            type: type,
            coverageUpTo: coverageUpTo
        };
    }

    function normalizeInsuranceFromUser(u) {
        if (!u || typeof u !== 'object') {
            return [];
        }
        if (!Array.isArray(u.providerInsurance)) {
            return [];
        }
        return u.providerInsurance.map(normalizeInsuranceEntry).filter(Boolean);
    }

    function insuranceSignature(list) {
        return JSON.stringify((list || []).map(normalizeInsuranceEntry).filter(Boolean));
    }

    function formatInsuranceChange(before, after) {
        if (insuranceSignature(before) === insuranceSignature(after)) {
            return null;
        }
        var prev = (before || []).map(function (item) {
            return item.type + (isNoInsuranceType(item.type) ? '' : ' (' + formatCoverageValue(item.coverageUpTo) + ')');
        });
        var next = (after || []).map(function (item) {
            return item.type + (isNoInsuranceType(item.type) ? '' : ' (' + formatCoverageValue(item.coverageUpTo) + ')');
        });
        if (!prev.length && next.length) {
            return 'Insurance: added ' + next.join('; ');
        }
        if (prev.length && !next.length) {
            return 'Insurance: cleared';
        }
        return 'Insurance: ' + (next.length ? next.join('; ') : 'updated');
    }

    function buildTypeSelectOptions(selectedType) {
        var html = '';
        var selectedKey = typeKey(selectedType);
        var isCustom = selectedType && !isCatalogType(selectedType);
        STANDARD_INSURANCE_TYPES.forEach(function (label) {
            if (label === 'Other') {
                return;
            }
            html += '<option value="' + escapeAttribute(label) + '"' + (!isCustom && typeKey(label) === selectedKey ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
        });
        if (isCustom) {
            html += '<option value="' + OTHER_TYPE_VALUE + '" selected>Other…</option>';
        } else {
            html += '<option value="' + OTHER_TYPE_VALUE + '">Other…</option>';
        }
        return html;
    }

    function buildEditorRow(row, index, disabled) {
        row = normalizeInsuranceEntry(row) || { type: 'Goods In Transit', coverageUpTo: null };
        var isOther = !isCatalogType(row.type);
        var isNoInsurance = isNoInsuranceType(row.type);
        var customStyle = isOther ? '' : ' style="display:none;"';
        var coverageStyle = isNoInsurance ? ' style="display:none;"' : '';
        var disabledAttr = disabled ? ' disabled aria-disabled="true"' : '';
        var coverageValue = row.coverageUpTo != null ? String(row.coverageUpTo) : '';
        return [
            '<div class="provider-insurance-row" data-insurance-row="' + index + '">',
            '  <div class="provider-insurance-field provider-insurance-field--type">',
            '    <span class="provider-insurance-field-label">Insurance type</span>',
            '    <select class="form-input provider-insurance-type-select" data-insurance-type' + disabledAttr + '>',
            buildTypeSelectOptions(isOther ? row.type : row.type),
            '    </select>',
            '    <input class="form-input provider-insurance-custom-type" data-insurance-custom-type type="text" maxlength="80" placeholder="Insurance type name"' + customStyle + ' value="' + escapeAttribute(isOther ? row.type : '') + '"' + disabledAttr + '>',
            '  </div>',
            '  <div class="provider-insurance-field provider-insurance-field--coverage" data-insurance-coverage-wrap' + coverageStyle + '>',
            '    <span class="provider-insurance-field-label">Coverage up to (£)</span>',
            '    <input class="form-input provider-insurance-coverage-input" data-insurance-coverage type="number" min="0" step="1000" placeholder="e.g. 50000" value="' + escapeAttribute(coverageValue) + '"' + disabledAttr + '>',
            '  </div>',
            disabled ? '' : '  <button type="button" class="provider-insurance-remove" data-insurance-remove aria-label="Remove insurance">×</button>',
            '</div>'
        ].join('');
    }

    function renderEditorHtml(insurance, disabled) {
        var rows = Array.isArray(insurance) && insurance.length
            ? insurance
            : [{ type: 'Goods In Transit', coverageUpTo: null }];
        return [
            '<div class="provider-insurance-editor" data-provider-insurance-editor>',
            '  <div class="provider-insurance-head" aria-hidden="true">',
            '    <span>Insurance type</span><span>Coverage up to</span><span></span>',
            '  </div>',
            '  <div class="provider-insurance-rows" data-insurance-rows>',
            rows.map(function (row, index) { return buildEditorRow(row, index, disabled); }).join(''),
            '  </div>',
            disabled ? '' : '  <button type="button" class="provider-insurance-add-link" data-insurance-add type="button">+ Add insurance</button>',
            '</div>'
        ].join('');
    }

    function readRowType(rowEl) {
        var select = rowEl.querySelector('[data-insurance-type]');
        var custom = rowEl.querySelector('[data-insurance-custom-type]');
        if (!select) {
            return '';
        }
        if (select.value === OTHER_TYPE_VALUE) {
            return String(custom && custom.value || '').trim();
        }
        return String(select.value || '').trim();
    }

    function updateRowCoverageVisibility(rowEl) {
        var wrap = rowEl.querySelector('[data-insurance-coverage-wrap]');
        if (!wrap) {
            return;
        }
        var type = readRowType(rowEl);
        wrap.style.display = isNoInsuranceType(type) ? 'none' : '';
    }

    function collectInsuranceFromEditor(root) {
        if (!root) {
            return [];
        }
        var rows = root.querySelectorAll('[data-insurance-row]');
        var list = [];
        rows.forEach(function (rowEl) {
            var type = readRowType(rowEl);
            if (!type) {
                return;
            }
            var coverageEl = rowEl.querySelector('[data-insurance-coverage]');
            list.push(normalizeInsuranceEntry({
                type: type,
                coverageUpTo: isNoInsuranceType(type) ? null : (coverageEl ? coverageEl.value : null)
            }));
        });
        return list.filter(Boolean);
    }

    function bindEditor(root, onChange) {
        if (!root) {
            return;
        }

        function notify() {
            if (typeof onChange === 'function') {
                onChange(collectInsuranceFromEditor(root));
            }
        }

        root.addEventListener('change', function (e) {
            var row = e.target.closest('[data-insurance-row]');
            if (!row) {
                return notify();
            }
            if (e.target.matches('[data-insurance-type]')) {
                var custom = row.querySelector('[data-insurance-custom-type]');
                if (e.target.value === OTHER_TYPE_VALUE) {
                    if (custom) {
                        custom.style.display = '';
                        custom.focus();
                    }
                } else if (custom) {
                    custom.style.display = 'none';
                    custom.value = '';
                }
                updateRowCoverageVisibility(row);
            }
            notify();
        });

        root.addEventListener('input', function () {
            notify();
        });

        root.addEventListener('click', function (e) {
            var addBtn = e.target.closest('[data-insurance-add]');
            if (addBtn) {
                e.preventDefault();
                var rowsWrap = root.querySelector('[data-insurance-rows]');
                if (!rowsWrap) {
                    return;
                }
                var index = rowsWrap.querySelectorAll('[data-insurance-row]').length;
                rowsWrap.insertAdjacentHTML('beforeend', buildEditorRow({ type: 'Goods In Transit', coverageUpTo: null }, index, false));
                notify();
                return;
            }
            var removeBtn = e.target.closest('[data-insurance-remove]');
            if (removeBtn) {
                e.preventDefault();
                var row = removeBtn.closest('[data-insurance-row]');
                var rowsWrap = root.querySelector('[data-insurance-rows]');
                if (!row || !rowsWrap) {
                    return;
                }
                if (rowsWrap.querySelectorAll('[data-insurance-row]').length <= 1) {
                    row.querySelector('[data-insurance-type]').value = 'Goods In Transit';
                    var custom = row.querySelector('[data-insurance-custom-type]');
                    if (custom) {
                        custom.style.display = 'none';
                        custom.value = '';
                    }
                    var coverage = row.querySelector('[data-insurance-coverage]');
                    if (coverage) {
                        coverage.value = '';
                    }
                    updateRowCoverageVisibility(row);
                } else {
                    row.remove();
                }
                notify();
            }
        });
    }

    function renderPublicInsuranceHtml(insurance) {
        var list = Array.isArray(insurance) ? insurance.map(normalizeInsuranceEntry).filter(Boolean) : [];
        if (!list.length) {
            return '';
        }
        return '<div class="provider-insurance-public">' + list.map(function (item) {
            return [
                '<div class="provider-insurance-public-card">',
                '  <div class="provider-insurance-public-type">' + escapeHtml(item.type) + '</div>',
                '  <div class="provider-insurance-public-coverage">' + escapeHtml(
                    isNoInsuranceType(item.type) ? 'No cover declared' : formatCoverageValue(item.coverageUpTo)
                ) + '</div>',
                '</div>'
            ].join('');
        }).join('') + '</div>';
    }

    function renderOverviewEmptyHtml() {
        return '<p class="provider-insurance-overview-empty">No insurance listed yet. Click <strong>Edit insurance</strong> to add your cover details.</p>';
    }

    global.anytransportProviderInsurance = {
        OTHER_TYPE_VALUE: OTHER_TYPE_VALUE,
        NO_INSURANCE_TYPE: NO_INSURANCE_TYPE,
        STANDARD_INSURANCE_TYPES: STANDARD_INSURANCE_TYPES,
        normalizeInsuranceEntry: normalizeInsuranceEntry,
        normalizeInsuranceFromUser: normalizeInsuranceFromUser,
        formatInsuranceChange: formatInsuranceChange,
        formatCoverageValue: formatCoverageValue,
        renderEditorHtml: renderEditorHtml,
        bindEditor: bindEditor,
        collectInsuranceFromEditor: collectInsuranceFromEditor,
        renderPublicInsuranceHtml: renderPublicInsuranceHtml,
        renderOverviewEmptyHtml: renderOverviewEmptyHtml
    };
})(typeof window !== 'undefined' ? window : this);
