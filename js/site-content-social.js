(function () {
    'use strict';

    var SHAPE_OPTIONS = [
        { id: 'circle', label: 'Circle' },
        { id: 'rounded', label: 'Rounded square' },
        { id: 'square', label: 'Square' }
    ];

    var ICON_OPTIONS = [
        { id: 'facebook', label: 'Facebook' },
        { id: 'instagram', label: 'Instagram' },
        { id: 'twitter', label: 'Twitter / X' },
        { id: 'linkedin', label: 'LinkedIn' },
        { id: 'youtube', label: 'YouTube' },
        { id: 'tiktok', label: 'TikTok' },
        { id: 'pinterest', label: 'Pinterest' },
        { id: 'letter', label: 'Custom letter' },
        { id: 'custom', label: 'Custom image' }
    ];

    var ICON_SVGS = {
        facebook: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M22 12.07C22 6.48 17.52 2 11.93 2S2 6.48 2 12.07c0 4.99 3.65 9.13 8.43 9.93v-7.02H7.9v-2.91h2.53V9.41c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34v7.02C18.35 21.2 22 17.06 22 12.07z"/></svg>',
        instagram: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M7.8 2h8.4A5.8 5.8 0 0 1 22 7.8v8.4A5.8 5.8 0 0 1 16.2 22H7.8A5.8 5.8 0 0 1 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2zm0 2A3.8 3.8 0 0 0 4 7.8v8.4A3.8 3.8 0 0 0 7.8 20h8.4a3.8 3.8 0 0 0 3.8-3.8V7.8A3.8 3.8 0 0 0 16.2 4H7.8zm9.65 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
        twitter: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
        linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.35V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>',
        youtube: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M21.58 7.2a2.75 2.75 0 0 0-1.94-1.95C18.25 5 12 5 12 5s-6.25 0-7.64.25A2.75 2.75 0 0 0 2.42 7.2 28.9 28.9 0 0 0 2.17 12a28.9 28.9 0 0 0 .25 4.8 2.75 2.75 0 0 0 1.94 1.95C5.75 19 12 19 12 19s6.25 0 7.64-.25a2.75 2.75 0 0 0 1.94-1.95c.24-1.58.25-4.8.25-4.8s0-3.22-.25-4.8zM10 15.02V8.98L15.55 12 10 15.02z"/></svg>',
        tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.1 4.1 0 0 1-1-.48z"/></svg>',
        pinterest: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 4.07 2.44 7.55 5.92 9.08-.08-.78-.15-1.98.03-2.83.17-.72 1.1-4.57 1.1-4.57s-.28-.56-.28-1.39c0-1.3.75-2.27 1.69-2.27.8 0 1.18.6 1.18 1.32 0 .8-.51 2-0.78 3.12-.22.94.47 1.71 1.4 1.71 1.68 0 2.97-1.77 2.97-4.33 0-2.26-1.62-3.84-3.94-3.84-2.68 0-4.25 2.01-4.25 4.09 0 .81.31 1.68.7 2.15.08.09.09.17.07.26l-.27 1.08c-.04.17-.14.21-.32.13-1.19-.55-1.93-2.29-1.93-3.69 0-3.01 2.19-5.77 6.32-5.77 3.32 0 5.9 2.37 5.9 5.53 0 3.29-2.07 5.94-4.95 5.94-.97 0-1.88-.5-2.19-1.09l-.6 2.28c-.22.84-.81 1.89-1.21 2.53 0.91.28 1.87.43 2.86.43 5.46 0 9.91-4.45 9.91-9.91C22.95 6.45 18.5 2 12.04 2z"/></svg>'
    };

    var ALLOWED_ICONS = ICON_OPTIONS.map(function (o) { return o.id; });
    var ALLOWED_SHAPES = SHAPE_OPTIONS.map(function (o) { return o.id; });

    function inferIconFromLabel(label, id) {
        var text = String(label || '').toLowerCase();
        var sid = String(id || '').toLowerCase();
        if (text.indexOf('face') >= 0 || sid.indexOf('fb') >= 0) return 'facebook';
        if (text.indexOf('insta') >= 0 || sid.indexOf('ig') >= 0) return 'instagram';
        if (text.indexOf('twit') >= 0 || text.indexOf(' x') >= 0 || sid.indexOf('tw') >= 0) return 'twitter';
        if (text.indexOf('linked') >= 0) return 'linkedin';
        if (text.indexOf('you') >= 0 || text.indexOf('tube') >= 0) return 'youtube';
        if (text.indexOf('tik') >= 0) return 'tiktok';
        if (text.indexOf('pin') >= 0) return 'pinterest';
        return 'letter';
    }

    function normalizeSocialItem(item) {
        if (!item || typeof item !== 'object') return null;
        var label = String(item.label == null ? '' : item.label).trim();
        if (!label) return null;
        var icon = String(item.icon == null ? '' : item.icon).toLowerCase().trim();
        if (icon === 'x') icon = 'twitter';
        if (ALLOWED_ICONS.indexOf(icon) < 0) {
            icon = inferIconFromLabel(label, item.id);
        }
        var shape = String(item.shape == null ? 'circle' : item.shape).toLowerCase().trim();
        if (ALLOWED_SHAPES.indexOf(shape) < 0) shape = 'circle';
        var iconText = String(item.iconText == null ? '' : item.iconText).trim();
        if (!iconText) iconText = label.charAt(0).toUpperCase();
        return {
            id: String(item.id || ('social-' + Date.now())),
            label: label,
            href: String(item.href == null ? '#' : item.href).trim() || '#',
            visible: item.visible !== false,
            icon: icon,
            shape: shape,
            iconText: iconText.slice(0, 2),
            iconUrl: String(item.iconUrl == null ? '' : item.iconUrl).trim()
        };
    }

    function shapeClass(shape) {
        if (shape === 'square') return 'is-shape-square';
        if (shape === 'rounded') return 'is-shape-rounded';
        return 'is-shape-circle';
    }

    function renderSocialIconInner(item) {
        var normalized = normalizeSocialItem(item);
        if (!normalized) return '';
        if (normalized.icon === 'custom' && normalized.iconUrl) {
            return '<img src="' + escapeHtml(normalized.iconUrl) + '" alt="" class="social-icon-img">';
        }
        if (normalized.icon === 'letter' || ICON_SVGS[normalized.icon] == null) {
            return '<span class="social-icon-letter">' + escapeHtml(normalized.iconText || normalized.label.charAt(0)) + '</span>';
        }
        return ICON_SVGS[normalized.icon];
    }

    function socialIconClassName(item, extra) {
        var normalized = normalizeSocialItem(item);
        if (!normalized) return 'social-icon';
        return [
            'social-icon',
            shapeClass(normalized.shape),
            normalized.icon !== 'letter' && normalized.icon !== 'custom' ? ('is-icon-' + normalized.icon) : '',
            extra || ''
        ].filter(Boolean).join(' ');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function iconOptionsHtml(selected) {
        return ICON_OPTIONS.map(function (opt) {
            return '<option value="' + escapeHtml(opt.id) + '"' + (opt.id === selected ? ' selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
        }).join('');
    }

    function shapeOptionsHtml(selected) {
        return SHAPE_OPTIONS.map(function (opt) {
            return '<option value="' + escapeHtml(opt.id) + '"' + (opt.id === selected ? ' selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
        }).join('');
    }

    function iconPickerHtml(selected) {
        return ICON_OPTIONS.map(function (opt) {
            var preview = opt.id === 'letter'
                ? '<span class="social-icon-letter">A</span>'
                : (opt.id === 'custom'
                    ? '<span class="social-icon-letter">+</span>'
                    : (ICON_SVGS[opt.id] || ''));
            return [
                '<button type="button" class="social-icon-pick-btn' + (opt.id === selected ? ' is-selected' : '') + '"',
                ' data-social-icon-pick="' + escapeHtml(opt.id) + '" title="' + escapeHtml(opt.label) + '">',
                preview,
                '</button>'
            ].join('');
        }).join('');
    }

    window.anytransportSocialIcons = {
        SHAPE_OPTIONS: SHAPE_OPTIONS,
        ICON_OPTIONS: ICON_OPTIONS,
        normalizeSocialItem: normalizeSocialItem,
        shapeClass: shapeClass,
        renderSocialIconInner: renderSocialIconInner,
        socialIconClassName: socialIconClassName,
        iconOptionsHtml: iconOptionsHtml,
        shapeOptionsHtml: shapeOptionsHtml,
        iconPickerHtml: iconPickerHtml,
        inferIconFromLabel: inferIconFromLabel
    };
})();
