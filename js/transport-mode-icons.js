(function (global) {
    'use strict';

    function normalizeTransportModeKey(mode) {
        return String(mode || '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function transportModeIconSvg(mode) {
        const key = normalizeTransportModeKey(mode);
        const paths = {
            car: '<path d="M18 58h64l-8-18H26z"/><path d="M22 58v8"/><path d="M78 58v8"/><circle cx="30" cy="70" r="8"/><circle cx="70" cy="70" r="8"/><path d="M38 40h24"/>',
            motorbike: '<circle cx="28" cy="68" r="10"/><circle cx="72" cy="68" r="10"/><path d="M28 68 L48 42 L62 42 L72 68"/><path d="M48 42 L52 68"/><path d="M58 36 L64 36"/>',
            bicycle: '<circle cx="30" cy="65" r="12"/><circle cx="70" cy="65" r="12"/><circle cx="52" cy="65" r="3" fill="currentColor" stroke="none"/><polyline points="30,65 48,45 62,45 70,65"/><line x1="48" y1="45" x2="52" y2="65"/><line x1="30" y1="65" x2="40" y2="40"/><line x1="36" y1="40" x2="44" y2="40"/><polyline points="62,45 60,35 66,35"/>',
            van: '<path d="M16 58h68V38H28l-6 20z"/><path d="M22 58v10"/><path d="M78 58v10"/><circle cx="28" cy="72" r="7"/><circle cx="72" cy="72" r="7"/><path d="M34 38h30"/>',
            'luton van': '<path d="M14 58h72V32H26l-4 26z"/><path d="M58 32v26"/><path d="M20 58v10"/><path d="M80 58v10"/><circle cx="26" cy="72" r="7"/><circle cx="74" cy="72" r="7"/><path d="M30 32h22"/>',
            truck: '<path d="M14 58h52l-10-16H22z"/><path d="M66 42h18v16"/><path d="M20 58v10"/><path d="M80 58v10"/><circle cx="28" cy="72" r="7"/><circle cx="74" cy="72" r="7"/>',
            trailer: '<circle cx="24" cy="70" r="8"/><circle cx="76" cy="70" r="8"/><path d="M32 70h44"/><path d="M32 70V48h40v22"/><path d="M20 58h12"/>',
            other: '<circle cx="50" cy="50" r="28"/><path d="M38 50h24"/><path d="M50 38v24"/>'
        };
        const inner = paths[key] || paths.other;
        return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="18" height="18" aria-hidden="true" focusable="false" class="transport-mode-icon">'
            + '<g fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">'
            + inner
            + '</g></svg>';
    }

    global.normalizeTransportModeKey = normalizeTransportModeKey;
    global.transportModeIconSvg = transportModeIconSvg;
})(typeof window !== 'undefined' ? window : this);
