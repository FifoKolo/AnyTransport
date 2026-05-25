(function () {
    'use strict';

    var SITE_NAVBAR_HTML = [
        '<nav class="navbar">',
        '  <div class="navbar-container">',
        '    <a class="navbar-logo" href="index.html" aria-label="Go to landing page">',
        '      <img src="assets/logo.jpeg" alt="AnyTransport Logo" class="logo-img">',
        '      <span class="logo-text">AnyTransport</span>',
        '    </a>',
        '    <div class="navbar-menu">',
        '      <a href="index.html#about" class="nav-link">About Us</a>',
        '      <a href="index.html#services" class="nav-link">Our Services</a>',
        '      <a href="index.html#how-it-works" class="nav-link">How it Works</a>',
        '      <a href="index.html#pricing" class="nav-link">Pricing</a>',
        '      <a href="index.html#faq" class="nav-link">FAQ</a>',
        '      <a href="index.html#contact" class="nav-link">Contact Us</a>',
        '    </div>',
        '    <div class="navbar-right">',
        '      <a id="navbar-return-btn" class="btn btn-outline navbar-return-btn" href="#" hidden>Return</a>',
        '      <div id="auth-menu" style="display: flex;">',
        '        <button class="btn btn-outline" type="button" onclick="openLoginModal()">Login</button>',
        '      </div>',
        '      <div id="user-menu" style="display: none;">',
        '        <div class="navbar-notification-bell">',
        '          <button class="notification-bell-btn" id="notification-bell" type="button" title="View notifications" aria-label="View notifications">',
        '            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
        '              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>',
        '              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>',
        '            </svg>',
        '            <span class="notification-badge" id="notification-badge" style="display: none;">0</span>',
        '          </button>',
        '          <div class="notification-dropdown" id="notification-dropdown" style="display: none;">',
        '            <div class="notification-header">',
        '              <h3>Notifications</h3>',
        '              <button class="notification-close" id="notification-close" type="button" aria-label="Close notifications">&times;</button>',
        '            </div>',
        '            <div class="notification-list" id="notification-list">',
        '              <div class="notification-empty">No notifications yet</div>',
        '            </div>',
        '          </div>',
        '        </div>',
        '        <div class="nav-dropdown" id="navbar-avatar-dropdown" style="display:inline-block;">',
        '          <button type="button" class="nav-toggle" aria-haspopup="true" aria-expanded="false">',
        '            <div class="navbar-avatar" id="navbar-user-avatar">U</div>',
        '          </button>',
        '          <div class="dropdown-menu" role="menu" aria-label="User menu" data-profile-menu-ready="1">',
        '            <a href="dashboard.html" class="nav-item navbar-hub-link at-nav-hub-dashboard" id="navbar-hub-dashboard-link" role="menuitem">Dashboard</a>',
        '            <a href="customer-dashboard.html?tab=forms" class="nav-item navbar-hub-link at-nav-hub-forms" id="navbar-hub-forms-link" role="menuitem">Forms</a>',
        '            <a href="customer-dashboard.html?tab=settings" class="nav-item navbar-hub-link at-nav-hub-settings" id="navbar-hub-settings-link" role="menuitem">Profile settings</a>',
        '            <a href="messages.html" class="nav-item navbar-hub-link at-nav-hub-messages" id="navbar-hub-messages-link" role="menuitem">Messages</a>',
        '            <a href="find-providers.html" class="nav-item navbar-hub-link at-nav-find-providers" id="navbar-find-providers-link" role="menuitem">Find providers</a>',
        '          </div>',
        '        </div>',
        '        <button class="btn btn-primary" type="button" onclick="logout()" style="margin-left: 10px;">Logout</button>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</nav>'
    ].join('\n');

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
            if (window.auth && typeof window.auth.resolveDefaultHomeHref === 'function') {
                return window.auth.resolveDefaultHomeHref();
            }
            if (role === 'provider' || role === 'admin') {
                return 'dashboard.html#provider-board';
            }
            return 'customer-dashboard.html?tab=forms';
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
        if (mount) {
            var showReturn = mount.hasAttribute('data-return');
            mount.outerHTML = SITE_NAVBAR_HTML;
            if (showReturn) {
                document.body.setAttribute('data-navbar-return', 'true');
            }
        }

        initNavbarReturn();
        wireNavbarAuth();
    }

    window.setNavbarReturnUrl = function (url) {
        try {
            sessionStorage.setItem('anytransport_nav_return_url', String(url || ''));
        } catch (_e) {}
    };

    window.initNavbarReturn = initNavbarReturn;

    document.addEventListener('DOMContentLoaded', mountSharedNavbar);
})();
