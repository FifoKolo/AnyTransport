(function () {
    'use strict';

    var FONT_MAP = {
        '': '',
        'inter': 'Inter',
        'roboto': 'Roboto',
        'open-sans': 'Open Sans',
        'lato': 'Lato',
        'merriweather': 'Merriweather',
        'playfair': 'Playfair Display',
        'georgia': 'Georgia, serif'
    };

    var cachedContent = null;
    var loadPromise = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function isLandingPage() {
        var path = String(window.location.pathname || '').toLowerCase();
        return path === '' || path === '/' || /index\.html?$/.test(path);
    }

    function resolveHref(href) {
        var value = String(href || '').trim();
        if (!value || value === '#') return '#';
        if (/^https?:\/\//i.test(value) || value.indexOf('.html') >= 0) return value;
        if (value.charAt(0) === '#') {
            return isLandingPage() ? value : ('index.html' + value);
        }
        return value;
    }

    function loadSiteContent(force) {
        if (!force && cachedContent) {
            return Promise.resolve(cachedContent);
        }
        if (!force && loadPromise) {
            return loadPromise;
        }
        loadPromise = new Promise(function (resolve) {
            if (!window.anytransportApi || typeof window.anytransportApi.getSiteContent !== 'function') {
                cachedContent = null;
                resolve(null);
                return;
            }
            try {
                var resp = window.anytransportApi.getSiteContent();
                cachedContent = resp && resp.siteContent ? resp.siteContent : null;
                resolve(cachedContent);
            } catch (_e) {
                cachedContent = null;
                resolve(null);
            }
        });
        return loadPromise;
    }

    function injectFonts(theme) {
        if (!theme || typeof theme !== 'object') return;
        var families = [];
        ['headingFont', 'bodyFont'].forEach(function (key) {
            var slug = String(theme[key] || '').trim();
            var family = FONT_MAP[slug] || '';
            if (family && families.indexOf(family) < 0 && family.indexOf('Georgia') < 0) {
                families.push(family);
            }
        });
        if (!families.length) return;
        var id = 'site-content-fonts';
        if (document.getElementById(id)) return;
        var link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        var query = families.map(function (f) {
            return 'family=' + encodeURIComponent(f).replace(/%20/g, '+') + ':wght@400;600;700';
        }).join('&');
        link.href = 'https://fonts.googleapis.com/css2?' + query + '&display=swap';
        document.head.appendChild(link);
    }

    function fontFamily(slug) {
        var key = String(slug || '').trim();
        var family = FONT_MAP[key] || '';
        return family ? ("'" + family.split(',')[0].replace(/'/g, '') + "', sans-serif") : '';
    }

    function applyNavbar(content) {
        var menu = document.getElementById('site-navbar-menu');
        if (!menu || !content || !content.navbar) return;

        var navbar = content.navbar;
        var logoText = document.querySelector('.navbar-logo .logo-text');
        var logoImg = document.querySelector('.navbar-logo .logo-img');
        if (logoText && navbar.logoText) logoText.textContent = navbar.logoText;
        if (logoImg && navbar.logoSrc) logoImg.src = navbar.logoSrc;

        var links = (navbar.links || []).filter(function (l) { return l && l.visible !== false; });
        links.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        menu.innerHTML = links.map(function (link) {
            var href = resolveHref(link.href);
            return '<a href="' + escapeHtml(href) + '" class="nav-link">' + escapeHtml(link.label) + '</a>';
        }).join('');
    }

    function applyFooter(content) {
        var mount = document.getElementById('site-footer-dynamic');
        if (!mount || !content || !content.footer) return;

        var footer = content.footer;
        var brand = footer.brand || {};
        var social = (footer.social || []).filter(function (s) { return s && s.visible !== false; });
        var columns = footer.columns || [];
        var bottomLinks = (footer.bottomLinks || []).filter(function (l) { return l && l.visible !== false; });

        var socialHtml = social.map(function (item) {
            return '<a href="' + escapeHtml(resolveHref(item.href)) + '" class="social-icon" aria-label="' + escapeHtml(item.label) + '"><span>' + escapeHtml(item.label.charAt(0)) + '</span></a>';
        }).join('');

        var columnsHtml = columns.map(function (col) {
            var links = (col.links || []).filter(function (l) { return l && l.visible !== false; });
            return [
                '<div class="footer-column">',
                '<h4>' + escapeHtml(col.title) + '</h4>',
                '<ul>',
                links.map(function (link) {
                    if (link.action === 'provider-signup') {
                        return '<li><a href="#" class="footer-provider-link" onclick="switchToSignup(\'provider\'); return false;">' + escapeHtml(link.label) + '</a></li>';
                    }
                    return '<li><a href="' + escapeHtml(resolveHref(link.href)) + '">' + escapeHtml(link.label) + '</a></li>';
                }).join(''),
                '</ul>',
                '</div>'
            ].join('');
        }).join('');

        var bottomHtml = bottomLinks.map(function (link) {
            if (link.action === 'provider-signup') {
                return '<a href="#" class="footer-provider-link" onclick="switchToSignup(\'provider\'); return false;">' + escapeHtml(link.label) + '</a>';
            }
            return '<a href="' + escapeHtml(resolveHref(link.href)) + '">' + escapeHtml(link.label) + '</a>';
        }).join('');

        mount.innerHTML = [
            '<div class="footer-brand">',
            '<div class="footer-logo-container">',
            '<img src="' + escapeHtml(brand.logoSrc || 'assets/logo.jpeg') + '" alt="AnyTransport Logo" class="footer-logo">',
            '<span class="footer-logo-text">' + escapeHtml(brand.logoText || 'AnyTransport') + '</span>',
            '</div>',
            '<p>' + escapeHtml(brand.description || '') + '</p>',
            '<div class="social-icons">' + socialHtml + '</div>',
            '</div>',
            columnsHtml
        ].join('');

        var copyrightEl = document.getElementById('site-footer-copyright');
        if (copyrightEl) {
            copyrightEl.textContent = footer.copyright || copyrightEl.textContent;
        }
        var bottomEl = document.getElementById('site-footer-bottom-links');
        if (bottomEl) {
            bottomEl.innerHTML = bottomHtml;
        }
    }

    function renderPageBlocks(page) {
        return (page.blocks || []).map(function (block) {
            if (!block || block.type === 'image') {
                var url = block && block.url ? block.url : '';
                if (!url) return '';
                return [
                    '<figure class="site-cms-image-block">',
                    '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(block.alt || page.title || '') + '">',
                    block.caption ? ('<figcaption class="site-cms-image-caption">' + escapeHtml(block.caption) + '</figcaption>') : '',
                    '</figure>'
                ].join('');
            }
            return '<div class="site-cms-body">' + String(block.content || '') + '</div>';
        }).join('');
    }

    function renderPages(content) {
        var mount = document.getElementById('site-pages-mount');
        if (!mount || !content || !content.pages) return;

        var pages = Object.keys(content.pages).map(function (key) {
            return content.pages[key];
        }).filter(function (page) {
            return page && page.visible !== false && page.slug;
        });

        mount.innerHTML = pages.map(function (page) {
            var headingStyle = page.headingFont ? ('font-family:' + fontFamily(page.headingFont) + ';') : '';
            var bodyStyle = page.bodyFont ? ('font-family:' + fontFamily(page.bodyFont) + ';') : '';
            var hero = page.heroImage
                ? ('<img class="site-cms-hero" src="' + escapeHtml(page.heroImage) + '" alt="' + escapeHtml(page.title) + '">')
                : '';
            return [
                '<section class="site-cms-section" id="' + escapeHtml(page.slug) + '">',
                '<div class="site-cms-inner">',
                hero,
                '<h2 class="site-cms-title" style="' + headingStyle + '">' + escapeHtml(page.title) + '</h2>',
                page.subtitle ? ('<p class="site-cms-subtitle" style="' + bodyStyle + '">' + escapeHtml(page.subtitle) + '</p>') : '',
                '<div style="' + bodyStyle + '">' + renderPageBlocks(page) + '</div>',
                '</div>',
                '</section>'
            ].join('');
        }).join('');
    }

    function applySiteContent(content) {
        if (!content) return;
        injectFonts(content.theme);
        applyNavbar(content);
        applyFooter(content);
        renderPages(content);
    }

    function initSiteContent() {
        return loadSiteContent(false).then(function (content) {
            applySiteContent(content);
            return content;
        });
    }

    window.anytransportSiteContent = {
        load: loadSiteContent,
        apply: applySiteContent,
        init: initSiteContent,
        invalidate: function () {
            cachedContent = null;
            loadPromise = null;
        },
        FONT_OPTIONS: Object.keys(FONT_MAP).filter(function (k) { return true; }).map(function (key) {
            return { id: key, label: key ? (FONT_MAP[key] || key) : 'Default (site font)' };
        })
    };

    document.addEventListener('DOMContentLoaded', function () {
        initSiteContent();
    });
})();
