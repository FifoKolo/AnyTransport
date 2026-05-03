/**
 * When opening create-job.html?editQuote=<quoteId>, complement the main form hydrate
 * (see create-job.js) with a banner. Full load + overview step is handled in create-job.js.
 */
(function () {
    'use strict';

    function ensureBanner() {
        var bar = document.getElementById('quote-edit-bootstrap-note');
        if (bar) return bar;
        bar = document.createElement('div');
        bar.id = 'quote-edit-bootstrap-note';
        bar.className = 'quote-edit-bootstrap-banner';
        bar.setAttribute('role', 'status');
        bar.style.display = 'none';
        var nav = document.querySelector('nav.navbar');
        if (nav && nav.nextSibling) {
            nav.parentNode.insertBefore(bar, nav.nextSibling);
        } else {
            document.body.insertBefore(bar, document.body.firstChild);
        }
        return bar;
    }

    function tryLoadQuoteFromLocal(id) {
        try {
            var raw = localStorage.getItem('anytransport_quote_requests');
            var list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) return null;
            var found = list.find(function (entry) {
                return entry && String(entry.id || '') === id;
            });
            return found || null;
        } catch (_e) {
            return null;
        }
    }

    function run() {
        var params;
        try {
            params = new URLSearchParams(window.location.search || '');
        } catch (_e) {
            return;
        }
        var id = String(params.get('editQuote') || params.get('resumeQuote') || '').trim();
        if (!id) {
            return;
        }

        if (window.__anytransportEditQuoteHydrated) {
            var ready = ensureBanner();
            ready.style.display = 'block';
            ready.textContent = 'Editing your saved request — you start on step 5 (inventory). Use the steps in the header to move through each section.';
            return;
        }

        var q = null;
        if (window.anytransportApi && typeof window.anytransportApi.getQuote === 'function') {
            try {
                q = window.anytransportApi.getQuote(id);
            } catch (_e) {
                q = null;
            }
        }
        if (!q) {
            q = tryLoadQuoteFromLocal(id);
        }

        ensureBanner();

        if (!q) {
            var err = ensureBanner();
            err.style.display = 'block';
            err.textContent = 'Could not load that request. Sign in with the same account you used to create it, or open the form from My request forms again.';
            return;
        }

        if (typeof window.hydrateCreateJobFormFromSavedQuote === 'function') {
            window.hydrateCreateJobFormFromSavedQuote(q);
        }

        window.__createJobRestoreTargetStep = 5;
        window.__createJobRestoreUnlockedStep = 8;
        window.__createJobMaxReachedStep = 8;
        window.__overviewStepVisited = true;
        window.__anytransportEditQuoteHydrated = true;

        var note = ensureBanner();
        note.style.display = 'block';
        note.textContent = 'Loaded your saved request — you start on step 5 (inventory & assignments). Use the steps in the header to review or change details.';
    }

    document.addEventListener('DOMContentLoaded', run);
})();
