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
            'mini van': '<path d="M20 58h60V40H30l-4 18z"/><path d="M24 58v8"/><path d="M76 58v8"/><circle cx="30" cy="70" r="6"/><circle cx="70" cy="70" r="6"/><path d="M36 40h24"/>',
            'transit van delivery van': '<path d="M14 58h72V36H26l-6 22z"/><path d="M56 36v22"/><path d="M20 58v10"/><path d="M80 58v10"/><circle cx="26" cy="72" r="7"/><circle cx="74" cy="72" r="7"/><path d="M30 36h20"/>',
            'luton van': '<path d="M14 58h72V32H26l-4 26z"/><path d="M58 32v26"/><path d="M20 58v10"/><path d="M80 58v10"/><circle cx="26" cy="72" r="7"/><circle cx="74" cy="72" r="7"/><path d="M30 32h22"/>',
            lorry: '<path d="M12 58h56l-12-20H18z"/><path d="M68 38h20v20"/><path d="M18 58v12"/><path d="M84 58v12"/><circle cx="28" cy="74" r="8"/><circle cx="76" cy="74" r="8"/><path d="M68 38h-8"/>',
            truck: '<path d="M14 58h52l-10-16H22z"/><path d="M66 42h18v16"/><path d="M20 58v10"/><path d="M80 58v10"/><circle cx="28" cy="72" r="7"/><circle cx="74" cy="72" r="7"/>',
            'horse box': '<path d="M18 58h64V34H24l-6 24z"/><path d="M22 58v10"/><path d="M78 58v10"/><circle cx="28" cy="72" r="7"/><circle cx="72" cy="72" r="7"/><path d="M30 34h36"/><path d="M42 34v24"/>',
            '7 5 tonne': '<path d="M10 58h60l-14-22H16z"/><path d="M70 36h18v22"/><path d="M16 58v12"/><path d="M86 58v12"/><circle cx="26" cy="74" r="8"/><circle cx="78" cy="74" r="8"/>',
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
