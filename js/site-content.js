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

    var HOMEPAGE_SECTION_SLUGS = ['services', 'how-it-works'];

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

    function isStandaloneCmsPageView() {
        return /page\.html$/i.test(String(window.location.pathname || ''));
    }

    function getRequestedPageSlug() {
        var hash = String(window.location.hash || '').replace(/^#/, '').trim();
        if (hash) {
            return hash.split('?')[0];
        }
        var params = new URLSearchParams(window.location.search || '');
        return String(params.get('page') || '').trim();
    }

    function findCmsPage(content, slug) {
        if (!content || !content.pages || !slug) {
            return null;
        }
        if (content.pages[slug]) {
            return content.pages[slug];
        }
        return Object.keys(content.pages).map(function (key) {
            return content.pages[key];
        }).find(function (page) {
            return page && (page.slug === slug || page.id === slug);
        }) || null;
    }

    function isCmsPageSlug(content, slug) {
        return !!findCmsPage(content, slug);
    }

    function cmsPageHref(slug) {
        return 'page.html#' + slug;
    }

    function resolveHref(href) {
        var value = String(href || '').trim();
        if (!value || value === '#') {
            return '#';
        }
        if (/^https?:\/\//i.test(value) || value.indexOf('.html') >= 0) {
            return value;
        }
        if (value.charAt(0) === '#') {
            var slug = value.slice(1).split('?')[0];
            if (HOMEPAGE_SECTION_SLUGS.indexOf(slug) >= 0) {
                return isLandingPage() ? value : ('index.html' + value);
            }
            if (isCmsPageSlug(cachedContent, slug)) {
                if (isStandaloneCmsPageView()) {
                    return '#' + slug;
                }
                return cmsPageHref(slug);
            }
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
        if (!content || !content.navbar) return;

        var navbar = content.navbar;
        var logoText = document.querySelector('.navbar-logo .logo-text');
        var logoImg = document.querySelector('.navbar-logo .logo-img');
        var logoLink = document.querySelector('.navbar-logo');
        if (logoText && navbar.logoText) logoText.textContent = navbar.logoText;
        if (logoImg && navbar.logoSrc) logoImg.src = navbar.logoSrc;
        if (logoLink && navbar.logoHref) {
            logoLink.href = resolveHref(navbar.logoHref);
        }

        var navEl = document.querySelector('nav.navbar');
        if (navEl) {
            if (navbar.backgroundColor) {
                navEl.style.background = navbar.backgroundColor;
            } else {
                navEl.style.background = '';
            }
        }

        if (menu) {
            var links = (navbar.links || []).filter(function (l) { return l && l.visible !== false; });
            links.sort(function (a, l) { return (a.order || 0) - (l.order || 0); });
            menu.innerHTML = links.map(function (link) {
                var href = resolveHref(link.href);
                var style = navbar.linkColor ? (' style="color:' + navbar.linkColor + ';"') : '';
                return '<a href="' + escapeHtml(href) + '" class="nav-link"' + style + '>' + escapeHtml(link.label) + '</a>';
            }).join('');
        }
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
            var socialApi = window.anytransportSocialIcons;
            var className = socialApi ? socialApi.socialIconClassName(item) : 'social-icon';
            var inner = socialApi ? socialApi.renderSocialIconInner(item) : ('<span>' + escapeHtml(item.label.charAt(0)) + '</span>');
            return '<a href="' + escapeHtml(resolveHref(item.href)) + '" class="' + className + '" aria-label="' + escapeHtml(item.label) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
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

    function elementStyle(el) {
        var style = [
            'left:' + (el.x || 0) + '%',
            'top:' + (el.y || 0) + '%',
            'width:' + (el.width || 50) + '%',
            'z-index:' + (el.zIndex || 1)
        ];
        if (el.font) style.push('font-family:' + fontFamily(el.font));
        if (el.fontSize) style.push('font-size:' + el.fontSize + 'px');
        if (el.color) style.push('color:' + el.color);
        if (el.align) style.push('text-align:' + el.align);
        return style.join(';');
    }

    function getCmsImagesApi() {
        return window.anytransportCmsImages || null;
    }

    function renderPageElement(el, page) {
        if (!el || !el.type) return '';
        if (el.type === 'image') {
            var imgApi = getCmsImagesApi();
            var imageEl = imgApi ? imgApi.normalizeImageFields(el) : el;
            var frameStyle = imgApi ? imgApi.buildImageFrameStyle(imageEl) : elementStyle(el);
            var imgStyle = imgApi ? imgApi.buildImageTagStyle(imageEl) : 'width:100%;height:auto;display:block;';
            var hasUrl = !!(imageEl.url && String(imageEl.url).trim());
            if (!hasUrl) return '';
            return [
                '<div class="site-cms-el site-cms-el-image-wrap" style="' + frameStyle + '">',
                '<img class="site-cms-el site-cms-el-image" style="' + imgStyle + '" src="' + escapeHtml(imageEl.url) + '" alt="' + escapeHtml(imageEl.alt || page.title || '') + '">',
                '</div>'
            ].join('');
        }
        var style = elementStyle(el);
        if (el.type === 'title') {
            return '<h2 class="site-cms-el site-cms-el-title" style="' + style + '">' + escapeHtml(el.content || '') + '</h2>';
        }
        return '<div class="site-cms-el site-cms-el-text" style="' + style + '">' + String(el.content || '') + '</div>';
    }

    function renderSinglePageSection(page) {
        var canvasHeight = page.canvasHeight || 520;
        var bg = page.backgroundColor || '#ffffff';
        var bgImage = page.backgroundImage ? ('background-image:url(' + page.backgroundImage + ');background-size:cover;background-position:center;') : '';
        var elements = (page.elements || []).slice().sort(function (a, b) {
            return (a.zIndex || 1) - (b.zIndex || 1);
        });
        return [
            '<section class="site-cms-section site-cms-canvas-section" id="' + escapeHtml(page.slug) + '">',
            '<div class="site-cms-canvas" style="min-height:' + canvasHeight + 'px;background-color:' + escapeHtml(bg) + ';' + bgImage + '">',
            elements.map(function (el) { return renderPageElement(el, page); }).join(''),
            '</div>',
            '</section>'
        ].join('');
    }

    function renderPages(content) {
        var mount = document.getElementById('site-pages-mount');
        if (!mount || !content || !content.pages) return;

        if (!isStandaloneCmsPageView()) {
            mount.innerHTML = '';
            return;
        }

        var slug = getRequestedPageSlug();
        var pages = Object.keys(content.pages).map(function (key) {
            return content.pages[key];
        }).filter(function (page) {
            return page && page.visible !== false && page.slug;
        });

        if (slug) {
            pages = pages.filter(function (page) {
                return page.slug === slug || page.id === slug;
            });
        }

        if (!pages.length) {
            mount.innerHTML = [
                '<section class="site-cms-section site-cms-page-missing">',
                '<div class="site-cms-page-missing-inner">',
                '<h1>Page not found</h1>',
                '<p>The page you requested is unavailable. Return to the <a href="index.html">homepage</a>.</p>',
                '</div>',
                '</section>'
            ].join('');
            document.title = 'Page not found - AnyTransport';
            return;
        }

        mount.innerHTML = pages.map(renderSinglePageSection).join('');

        var activePage = pages[0];
        if (activePage && activePage.title) {
            document.title = String(activePage.title) + ' - AnyTransport';
        }
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
        cmsPageHref: cmsPageHref,
        FONT_OPTIONS: Object.keys(FONT_MAP).filter(function (k) { return true; }).map(function (key) {
            return { id: key, label: key ? (FONT_MAP[key] || key) : 'Default (site font)' };
        })
    };

    document.addEventListener('DOMContentLoaded', function () {
        initSiteContent();
    });

    window.addEventListener('hashchange', function () {
        if (!isStandaloneCmsPageView()) {
            return;
        }
        loadSiteContent(false).then(function (content) {
            renderPages(content);
        });
    });
})();
