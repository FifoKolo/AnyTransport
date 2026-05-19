(function () {
    'use strict';

    function resolveReturnUrl() {
        var params = new URLSearchParams(window.location.search || '');
        var explicit = String(params.get('return') || '').trim();
        if (explicit) {
            try {
                var parsedExplicit = new URL(explicit, window.location.origin);
                if (parsedExplicit.origin === window.location.origin) {
                    return parsedExplicit.href;
                }
            } catch (_e) {}
        }

        try {
            var stored = sessionStorage.getItem('anytransport_nav_return_url');
            if (stored) {
                var parsedStored = new URL(stored, window.location.origin);
                if (parsedStored.origin === window.location.origin &&
                    !/messages\.html$/i.test(parsedStored.pathname)) {
                    return parsedStored.href;
                }
            }
        } catch (_e2) {}

        if (document.referrer) {
            try {
                var ref = new URL(document.referrer);
                if (ref.origin === window.location.origin &&
                    !/messages\.html$/i.test(ref.pathname)) {
                    return ref.href;
                }
            } catch (_e3) {}
        }

        if (window.auth && typeof window.auth.isLoggedIn === 'function' && window.auth.isLoggedIn()) {
            var user = window.auth.getUser && window.auth.getUser();
            var role = user && String(user.role || '').toLowerCase();
            if (role === 'provider' || role === 'admin') {
                return 'dashboard.html';
            }
            return 'customer-dashboard.html';
        }

        return 'index.html';
    }

    function initNavbarReturn(forceShow) {
        var btn = document.getElementById('navbar-return-btn');
        if (!btn) return;

        var show = !!forceShow || document.body.hasAttribute('data-navbar-return');
        if (!show) {
            btn.hidden = true;
            return;
        }

        btn.href = resolveReturnUrl();
        btn.hidden = false;
    }

    function wireNavbarAuth() {
        if (window.auth && typeof window.auth.initAuth === 'function') {
            window.auth.initAuth();
        }
    }

    function mountSharedNavbar() {
        var mount = document.getElementById('site-navbar-mount');
        if (!mount) {
            initNavbarReturn();
            wireNavbarAuth();
            return;
        }

        var showReturn = mount.hasAttribute('data-return');
        fetch('fragments/site-navbar.html', { cache: 'no-cache' })
            .then(function (response) {
                if (!response.ok) throw new Error('Navbar fragment missing');
                return response.text();
            })
            .then(function (html) {
                mount.outerHTML = html;
                if (showReturn) {
                    document.body.setAttribute('data-navbar-return', 'true');
                }
                initNavbarReturn(true);
                wireNavbarAuth();
            })
            .catch(function () {
                initNavbarReturn(showReturn);
                wireNavbarAuth();
            });
    }

    window.setNavbarReturnUrl = function (url) {
        try {
            sessionStorage.setItem('anytransport_nav_return_url', String(url || ''));
        } catch (_e) {}
    };

    window.initNavbarReturn = initNavbarReturn;

    document.addEventListener('DOMContentLoaded', mountSharedNavbar);
})();
