(function () {
    'use strict';

    var STORAGE_SCHEMA_VERSION = '20260322-2';
    var STORAGE_SCHEMA_KEY = 'anytransport_storage_schema_version';
    var PREFILL_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    // Keep this list focused on transient values so version bumps are safe.
    var TRANSIENT_KEYS = [
        'pending_quote_submission',
        'pending_quote_data',
        'selected_inventory_items'
    ];

    function safeParseJson(raw) {
        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch (error) {
            return null;
        }
    }

    function removeKeyFromBothStorages(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            // Ignore storage access errors.
        }

        try {
            sessionStorage.removeItem(key);
        } catch (error) {
            // Ignore storage access errors.
        }
    }

    function clearTransientStorage() {
        TRANSIENT_KEYS.forEach(removeKeyFromBothStorages);
    }

    function pruneStaleQuotePrefill() {
        var raw = null;

        try {
            raw = localStorage.getItem('anytransport_quote_prefill');
        } catch (error) {
            return;
        }

        var parsed = safeParseJson(raw);
        if (!parsed) {
            // Corrupt values can cause hard-to-debug JSON parse failures later.
            removeKeyFromBothStorages('anytransport_quote_prefill');
            return;
        }

        var savedAt = Number(parsed.savedAt || 0);
        if (!savedAt) {
            removeKeyFromBothStorages('anytransport_quote_prefill');
            return;
        }

        if (Date.now() - savedAt > PREFILL_MAX_AGE_MS) {
            removeKeyFromBothStorages('anytransport_quote_prefill');
        }
    }

    function ensureStorageSchema() {
        var currentVersion = null;

        try {
            currentVersion = localStorage.getItem(STORAGE_SCHEMA_KEY);
        } catch (error) {
            return;
        }

        if (currentVersion !== STORAGE_SCHEMA_VERSION) {
            clearTransientStorage();

            try {
                localStorage.setItem(STORAGE_SCHEMA_KEY, STORAGE_SCHEMA_VERSION);
            } catch (error) {
                // Ignore storage access errors.
            }
        }
    }

    function runMaintenance() {
        ensureStorageSchema();
        pruneStaleQuotePrefill();
    }

    runMaintenance();

    // Optional manual helper for debugging in browser devtools.
    window.AnyTransportCache = {
        version: STORAGE_SCHEMA_VERSION,
        clearTransientStorage: clearTransientStorage,
        runMaintenance: runMaintenance
    };
})();
