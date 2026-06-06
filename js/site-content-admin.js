(function () {
    'use strict';

    var FONT_FAMILY_MAP = {
        'inter': 'Inter',
        'roboto': 'Roboto',
        'open-sans': 'Open Sans',
        'lato': 'Lato',
        'merriweather': 'Merriweather',
        'playfair': 'Playfair Display',
        'georgia': 'Georgia, serif'
    };

    var FONT_OPTIONS = [
        { id: '', label: 'Default (site font)' },
        { id: 'inter', label: 'Inter' },
        { id: 'roboto', label: 'Roboto' },
        { id: 'open-sans', label: 'Open Sans' },
        { id: 'lato', label: 'Lato' },
        { id: 'merriweather', label: 'Merriweather' },
        { id: 'playfair', label: 'Playfair Display' },
        { id: 'georgia', label: 'Georgia' }
    ];

    var editorState = {
        content: null,
        activeTab: 'navbar',
        selectedPageId: 'about',
        selectedElementId: '',
        selectedNavbarItem: '',
        selectedFooterItem: ''
    };

    var canvasDragCleanup = null;
    var navbarDragCleanup = null;
    var footerDragCleanup = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function setStatus(el, message, isError) {
        if (!el) return;
        el.textContent = message || '';
        el.classList.toggle('is-error', !!isError);
    }

    function cloneContent(content) {
        return JSON.parse(JSON.stringify(content || {}));
    }

    function loadContent() {
        if (!window.anytransportApi || typeof window.anytransportApi.getSiteContent !== 'function') {
            throw new Error('Site content API is unavailable.');
        }
        var resp = window.anytransportApi.getSiteContent();
        editorState.content = cloneContent(resp && resp.siteContent ? resp.siteContent : null);
        if (!editorState.content) {
            throw new Error('Unable to load site content.');
        }
    }

    function saveContent(statusEl) {
        if (!window.anytransportApi || typeof window.anytransportApi.updateSiteContent !== 'function') {
            throw new Error('Save API is unavailable.');
        }
        var resp = window.anytransportApi.updateSiteContent(editorState.content);
        editorState.content = cloneContent(resp && resp.siteContent ? resp.siteContent : editorState.content);
        if (window.anytransportSiteContent && typeof window.anytransportSiteContent.invalidate === 'function') {
            window.anytransportSiteContent.invalidate();
        }
        setStatus(statusEl, 'Site content saved successfully.', false);
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            var reader = new FileReader();
            reader.onload = function () { resolve(String(reader.result || '')); };
            reader.onerror = function () { reject(reader.error || new Error('Unable to read file.')); };
            reader.readAsDataURL(file);
        });
    }

    function uploadImage(file) {
        if (!window.anytransportApi || typeof window.anytransportApi.uploadSiteMedia !== 'function') {
            throw new Error('Image upload is unavailable.');
        }
        return readFileAsDataUrl(file).then(function (dataUrl) {
            var resp = window.anytransportApi.uploadSiteMedia(dataUrl);
            if (!resp || !resp.url) {
                throw new Error('Upload failed.');
            }
            return resp.url;
        });
    }

    function bindRichToolbar(toolbar, editor) {
        if (!toolbar || !editor) return;
        toolbar.querySelectorAll('[data-cmd]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                var cmd = btn.getAttribute('data-cmd');
                if (cmd === 'formatBlock') {
                    document.execCommand('formatBlock', false, btn.getAttribute('data-value') || 'h3');
                    editor.focus();
                    return;
                }
                if (cmd === 'createLink') {
                    var url = window.prompt('Enter link URL', 'https://');
                    if (url) document.execCommand('createLink', false, url);
                    return;
                }
                if (cmd === 'insertImage') {
                    var input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = function () {
                        var file = input.files && input.files[0];
                        if (!file) return;
                        uploadImage(file).then(function (url) {
                            document.execCommand('insertImage', false, url);
                        }).catch(function (err) {
                            window.alert(err && err.message ? err.message : 'Image upload failed.');
                        });
                    };
                    input.click();
                    return;
                }
                document.execCommand(cmd, false, null);
                editor.focus();
            });
        });
    }

    function getHrefPresetOptions() {
        var options = [
            { label: 'Homepage — Services', value: '#services' },
            { label: 'Homepage — How it Works', value: '#how-it-works' },
            { label: 'Find providers', value: 'find-providers.html' },
            { label: 'Get prices / Create job', value: 'create-job.html' }
        ];
        var pages = editorState.content && editorState.content.pages ? editorState.content.pages : {};
        Object.keys(pages).forEach(function (key) {
            var page = pages[key];
            if (!page || page.visible === false) return;
            var slug = page.slug || page.id || key;
            options.push({
                label: 'Page — ' + (page.title || slug),
                value: 'page.html#' + slug
            });
        });
        return options;
    }

    var EDITOR_BUILD = '20260605-18';

    function getCmsImagesApi() {
        return window.anytransportCmsImages || null;
    }

    function getSocialIconsApi() {
        return window.anytransportSocialIcons || null;
    }

    function normalizeFooterSocialList(list) {
        var api = getSocialIconsApi();
        if (!api) return Array.isArray(list) ? list : [];
        return (list || []).map(function (item) {
            return api.normalizeSocialItem(item);
        }).filter(Boolean);
    }

    function renderSocialChipMarkup(item, selectedKey) {
        var api = getSocialIconsApi();
        var normalized = api ? api.normalizeSocialItem(item) : item;
        if (!normalized || !normalized.id) return '';
        var hidden = normalized.visible === false;
        var selected = selectedKey === ('social:' + normalized.id);
        var extra = 'visual-footer-social-chip' + (hidden ? ' is-hidden-link' : '') + (selected ? ' is-target-selected' : '');
        var className = api ? api.socialIconClassName(normalized, extra) : ('social-icon ' + extra);
        var inner = api ? api.renderSocialIconInner(normalized) : ('<span class="social-icon-letter">' + escapeHtml((normalized.label || 'S').charAt(0)) + '</span>');
        return [
            '<span class="' + className + '" data-footer-social-id="' + escapeHtml(normalized.id) + '" role="button" tabindex="-1">',
            inner,
            hidden ? ' <em class="visual-nav-hidden-badge">hidden</em>' : '',
            '</span>'
        ].join('');
    }

    function switchEditorTab(mount, tabKey) {
        if (!mount) return;
        editorState.activeTab = tabKey;
        mount.querySelectorAll('[data-tab]').forEach(function (t) {
            t.classList.toggle('is-active', t.getAttribute('data-tab') === tabKey);
        });
        mount.querySelectorAll('[data-panel]').forEach(function (panel) {
            panel.classList.toggle('is-active', panel.getAttribute('data-panel') === tabKey);
        });
        if (tabKey === 'navbar') {
            var navbarPanel = mount.querySelector('[data-panel="navbar"]');
            if (navbarPanel) renderNavbarPanel(navbarPanel);
        } else if (tabKey === 'footer') {
            var footerPanel = mount.querySelector('[data-panel="footer"]');
            if (footerPanel) renderFooterPanel(footerPanel);
        }
    }

    function presetOptionsHtml(hrefPresets, selectedHref) {
        var html = '<option value="">Custom URL…</option>';
        hrefPresets.forEach(function (opt) {
            html += '<option value="' + escapeHtml(opt.value) + '" ' + (opt.value === selectedHref ? 'selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
        });
        return html;
    }

    function renderNavbarPanel(root) {
        if (navbarDragCleanup) {
            navbarDragCleanup();
            navbarDragCleanup = null;
        }

        var navbar = editorState.content.navbar || { links: [] };
        navbar.links = Array.isArray(navbar.links) ? navbar.links : [];
        if (!navbar.logoHref) navbar.logoHref = 'index.html';
        var links = navbar.links;
        var hrefPresets = getHrefPresetOptions();
        var linkDragState = null;
        var suppressNavClick = false;

        root.innerHTML = [
            '<div class="visual-page-editor visual-navbar-editor">',
            '<div class="visual-page-toolbar">',
            '<button type="button" class="btn btn-outline" data-add-nav-link>+ Add menu link</button>',
            '<button type="button" class="btn btn-outline" data-select-nav-bar>Edit navbar colours</button>',
            '</div>',
            '<div class="visual-page-layout">',
            '<div>',
            '<p class="visual-canvas-label">Click the logo, a menu link, or the navbar background to edit it in the panel on the right. Drag links to reorder them. Use <strong>+ Add menu link</strong> to add items.</p>',
            '<div class="site-admin-navbar-preview-wrap" data-nav-preview-wrap>',
            '<div class="site-admin-navbar-preview-label">Desktop preview (1400px) · click to select · drag links to move · build ' + EDITOR_BUILD + '</div>',
            '<div class="site-admin-navbar-preview-viewport" data-nav-preview-viewport>',
            '<div class="site-admin-navbar-preview-scaler" data-nav-preview-scaler>',
            '<nav class="navbar site-admin-navbar-preview is-editable" data-nav-canvas>',
            '<div class="navbar-container">',
            '<a class="navbar-logo visual-nav-target" href="#" data-nav-target="logo" role="button">',
            '<img src="' + escapeHtml(navbar.logoSrc || 'assets/logo.jpeg') + '" alt="" class="logo-img" data-preview-logo-img>',
            '<span class="logo-text" data-preview-logo-text>' + escapeHtml(navbar.logoText || 'AnyTransport') + '</span>',
            '</a>',
            '<div class="navbar-menu visual-nav-links-canvas" data-nav-links-canvas></div>',
            '<div class="navbar-right site-admin-navbar-preview-right" aria-hidden="true">',
            '<div style="display:flex;">',
            '<span class="btn btn-outline site-admin-nav-decoy">Login</span>',
            '</div>',
            '</div>',
            '</div>',
            '</nav>',
            '</div>',
            '</div>',
            '</div>',
            '</div>',
            '<aside class="visual-inspector" data-nav-inspector></aside>',
            '</div>',
            '</div>'
        ].join('');

        var navCanvas = root.querySelector('[data-nav-canvas]');
        var linksCanvas = root.querySelector('[data-nav-links-canvas]');
        var inspector = root.querySelector('[data-nav-inspector]');
        var previewWrap = root.querySelector('[data-nav-preview-wrap]');
        var previewViewport = root.querySelector('[data-nav-preview-viewport]');
        var previewScaler = root.querySelector('[data-nav-preview-scaler]');
        var NAV_PREVIEW_WIDTH = 1400;

        function syncNavbarPreviewScale() {
            if (!previewWrap || !previewViewport || !previewScaler || !navCanvas) return;
            var available = previewWrap.clientWidth;
            if (available < 1) return;
            var scale = Math.min(1, available / NAV_PREVIEW_WIDTH);
            previewScaler.style.width = NAV_PREVIEW_WIDTH + 'px';
            previewScaler.style.transform = scale < 0.999 ? ('scale(' + scale + ')') : 'none';
            previewScaler.style.transformOrigin = 'top left';
            var navHeight = navCanvas.offsetHeight || 82;
            previewViewport.style.height = Math.ceil(navHeight * scale) + 'px';
            if (scale < 0.999) {
                previewScaler.style.marginRight = (-NAV_PREVIEW_WIDTH * (1 - scale)) + 'px';
                previewScaler.style.marginBottom = (-navHeight * (1 - scale)) + 'px';
            } else {
                previewScaler.style.marginRight = '';
                previewScaler.style.marginBottom = '';
            }
        }

        function useCustomNavbarColors() {
            return !!(navbar.backgroundColor || navbar.linkColor);
        }

        function paintNavbarCanvas(options) {
            options = options || {};
            var logoEl = root.querySelector('[data-nav-target="logo"]');
            var logoTextEl = root.querySelector('[data-preview-logo-text]');
            var logoImgEl = root.querySelector('[data-preview-logo-img]');
            if (logoTextEl) logoTextEl.textContent = navbar.logoText || 'AnyTransport';
            if (logoImgEl) logoImgEl.src = navbar.logoSrc || 'assets/logo.jpeg';

            if (navCanvas) {
                if (useCustomNavbarColors() && navbar.backgroundColor) {
                    navCanvas.style.background = navbar.backgroundColor;
                } else {
                    navCanvas.style.background = '';
                }
                navCanvas.classList.toggle('is-target-selected', editorState.selectedNavbarItem === 'navbar');
            }
            if (logoEl) {
                logoEl.classList.toggle('is-target-selected', editorState.selectedNavbarItem === 'logo');
            }

            if (!linksCanvas || linkDragState) {
                return;
            }

            if (options.preserveLinksDom && updateNavbarLinkChipsInPlace()) {
                return;
            }

            var linkColor = useCustomNavbarColors() && navbar.linkColor ? navbar.linkColor : '';
            linksCanvas.innerHTML = links.map(function (link) {
                if (!link || !link.id) return '';
                var hidden = link.visible === false;
                var selected = editorState.selectedNavbarItem === ('link:' + link.id);
                var style = linkColor ? ('color:' + linkColor + ';') : '';
                return [
                    '<span class="nav-link visual-nav-link-chip' + (hidden ? ' is-hidden-link' : '') + (selected ? ' is-target-selected' : '') + '"',
                    ' data-nav-link-id="' + escapeHtml(link.id) + '"',
                    ' style="' + style + '"',
                    ' role="button" tabindex="-1">',
                    escapeHtml(link.label || 'Link'),
                    hidden ? ' <em class="visual-nav-hidden-badge">hidden</em>' : '',
                    '</span>'
                ].join('');
            }).join('');
            syncNavbarPreviewScale();
        }

        function updateNavbarLinkChipsInPlace() {
            if (!linksCanvas || links.length !== linksCanvas.children.length) {
                return false;
            }
            var linkColor = useCustomNavbarColors() && navbar.linkColor ? navbar.linkColor : '';
            for (var i = 0; i < links.length; i += 1) {
                var link = links[i];
                if (!link || !link.id) return false;
                var chip = linksCanvas.querySelector('[data-nav-link-id="' + link.id + '"]');
                if (!chip) return false;
                var hidden = link.visible === false;
                var selected = editorState.selectedNavbarItem === ('link:' + link.id);
                chip.className = 'nav-link visual-nav-link-chip' + (hidden ? ' is-hidden-link' : '') + (selected ? ' is-target-selected' : '');
                chip.style.color = linkColor || '';
                if (hidden) {
                    chip.innerHTML = escapeHtml(link.label || 'Link') + ' <em class="visual-nav-hidden-badge">hidden</em>';
                } else {
                    chip.textContent = link.label || 'Link';
                }
            }
            return true;
        }

        function syncNavbarPreview() {
            links.forEach(function (link, i) { link.order = i + 1; });
            editorState.content.navbar = navbar;
            navbar.links = links;
            paintNavbarCanvas({ preserveLinksDom: true });
        }

        function syncNavbarMeta() {
            syncNavbarPreview();
            paintNavbarInspector(true);
        }

        function findLinkById(id) {
            return links.find(function (link) { return link && link.id === id; }) || null;
        }

        function getSelectedNavLink() {
            if (String(editorState.selectedNavbarItem || '').indexOf('link:') !== 0) return null;
            return findLinkById(editorState.selectedNavbarItem.slice(5));
        }

        function inspectorHasFocusedField() {
            var active = document.activeElement;
            return !!(active && inspector && inspector.contains(active) && (
                active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT'
            ));
        }

        function paintNavbarInspector(force) {
            var selection = editorState.selectedNavbarItem || '';
            if (!force && inspectorHasFocusedField() && inspector.dataset.navSelection === selection) {
                return;
            }
            inspector.dataset.navSelection = selection;

            if (selection === 'logo') {
                inspector.innerHTML = [
                    '<h4>Logo</h4>',
                    '<label>Logo text<input type="text" data-nav-logo-text value="' + escapeHtml(navbar.logoText || '') + '"></label>',
                    '<label>Logo link URL<input type="text" data-nav-logo-href value="' + escapeHtml(navbar.logoHref || 'index.html') + '"></label>',
                    '<label>Logo image URL<input type="text" data-nav-logo-src value="' + escapeHtml(navbar.logoSrc || '') + '"></label>',
                    '<input type="file" accept="image/*" data-nav-logo-upload style="display:none;">',
                    '<button type="button" class="btn btn-outline" data-nav-logo-upload-btn style="margin:8px 0;">Upload logo image</button>'
                ].join('');
                bindLogoInspector();
                return;
            }

            if (selection === 'navbar') {
                inspector.innerHTML = [
                    '<h4>Navbar colours</h4>',
                    '<label style="flex-direction:row;align-items:center;gap:8px;margin-bottom:10px;"><input type="checkbox" data-nav-use-custom-colors ' + (useCustomNavbarColors() ? 'checked' : '') + '> Use custom colours</label>',
                    '<label>Background colour<input type="color" data-nav-bg value="' + escapeHtml(navbar.backgroundColor || '#4a90e2') + '"></label>',
                    '<label>Link colour<input type="color" data-nav-link-color value="' + escapeHtml(navbar.linkColor || '#ffffff') + '"></label>',
                    '<p class="visual-inspector-empty">Uncheck custom colours to restore the default site gradient.</p>'
                ].join('');
                bindNavbarStyleInspector();
                return;
            }

            var link = getSelectedNavLink();
            if (link) {
                inspector.innerHTML = [
                    '<h4>Menu link</h4>',
                    '<label>Label<input type="text" data-nav-link-label value="' + escapeHtml(link.label || '') + '"></label>',
                    '<label>Quick pick<select data-nav-link-preset>' + presetOptionsHtml(hrefPresets, link.href || '') + '</select></label>',
                    '<label>URL<input type="text" data-nav-link-href value="' + escapeHtml(link.href || '') + '"></label>',
                    '<label style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" data-nav-link-visible ' + (link.visible !== false ? 'checked' : '') + '> Visible on site</label>',
                    '<div style="display:flex;gap:6px;margin-top:4px;">',
                    '<button type="button" class="btn btn-outline" data-nav-link-move-left>← Move left</button>',
                    '<button type="button" class="btn btn-outline" data-nav-link-move-right>Move right →</button>',
                    '</div>',
                    '<button type="button" class="btn btn-outline" data-nav-link-delete style="margin-top:8px;color:#b91c1c;border-color:#fecaca;">Delete link</button>'
                ].join('');
                bindLinkInspector(link);
                return;
            }

            inspector.innerHTML = [
                '<h4>Navbar editor</h4>',
                '<p class="visual-inspector-empty">Click the <strong>logo</strong>, any <strong>menu link</strong>, or the <strong>navbar background</strong> to edit it here.</p>',
                '<p class="visual-inspector-empty">Drag links left or right to reorder, or use <strong>Move left / Move right</strong> in the link panel. Use <strong>+ Add menu link</strong> to add a new item.</p>'
            ].join('');
        }

        function bindLogoInspector() {
            var textInput = inspector.querySelector('[data-nav-logo-text]');
            var hrefInput = inspector.querySelector('[data-nav-logo-href]');
            var srcInput = inspector.querySelector('[data-nav-logo-src]');
            var uploadBtn = inspector.querySelector('[data-nav-logo-upload-btn]');
            var uploadInput = inspector.querySelector('[data-nav-logo-upload]');
            if (textInput) textInput.addEventListener('input', function (e) { navbar.logoText = e.target.value; syncNavbarPreview(); });
            if (hrefInput) hrefInput.addEventListener('input', function (e) { navbar.logoHref = e.target.value; syncNavbarPreview(); });
            if (srcInput) srcInput.addEventListener('input', function (e) { navbar.logoSrc = e.target.value; syncNavbarPreview(); });
            if (uploadBtn && uploadInput) {
                uploadBtn.addEventListener('click', function () { uploadInput.click(); });
                uploadInput.addEventListener('change', function (e) {
                    var file = e.target.files && e.target.files[0];
                    if (!file) return;
                    uploadImage(file).then(function (url) {
                        navbar.logoSrc = url;
                        if (srcInput) srcInput.value = url;
                        syncNavbarPreview();
                    }).catch(function (err) {
                        window.alert(err && err.message ? err.message : 'Logo upload failed.');
                    });
                });
            }
        }

        function bindNavbarStyleInspector() {
            var useCustom = inspector.querySelector('[data-nav-use-custom-colors]');
            var bgInput = inspector.querySelector('[data-nav-bg]');
            var colorInput = inspector.querySelector('[data-nav-link-color]');
            if (bgInput) {
                bgInput.addEventListener('input', function (e) {
                    navbar.backgroundColor = e.target.value;
                    if (useCustom) useCustom.checked = true;
                    syncNavbarPreview();
                });
            }
            if (colorInput) {
                colorInput.addEventListener('input', function (e) {
                    navbar.linkColor = e.target.value;
                    if (useCustom) useCustom.checked = true;
                    syncNavbarPreview();
                });
            }
            if (useCustom) {
                useCustom.addEventListener('change', function () {
                    if (!useCustom.checked) {
                        navbar.backgroundColor = '';
                        navbar.linkColor = '';
                    } else {
                        navbar.backgroundColor = bgInput ? bgInput.value : '#4a90e2';
                        navbar.linkColor = colorInput ? colorInput.value : '#ffffff';
                    }
                    syncNavbarPreview();
                });
            }
        }

        function bindLinkInspector(link) {
            var labelInput = inspector.querySelector('[data-nav-link-label]');
            var presetSelect = inspector.querySelector('[data-nav-link-preset]');
            var hrefInput = inspector.querySelector('[data-nav-link-href]');
            var visibleInput = inspector.querySelector('[data-nav-link-visible]');
            var deleteBtn = inspector.querySelector('[data-nav-link-delete]');
            if (labelInput) {
                labelInput.addEventListener('input', function (e) {
                    link.label = e.target.value;
                    syncNavbarPreview();
                });
            }
            if (hrefInput) {
                hrefInput.addEventListener('input', function (e) {
                    link.href = e.target.value;
                    syncNavbarPreview();
                });
            }
            if (presetSelect) {
                presetSelect.addEventListener('change', function (e) {
                    if (!e.target.value) return;
                    link.href = e.target.value;
                    if (hrefInput) hrefInput.value = e.target.value;
                    syncNavbarPreview();
                });
            }
            if (visibleInput) {
                visibleInput.addEventListener('change', function (e) {
                    link.visible = e.target.checked;
                    syncNavbarPreview();
                });
            }
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function () {
                    links = links.filter(function (item) { return item.id !== link.id; });
                    navbar.links = links;
                    editorState.selectedNavbarItem = '';
                    syncNavbarMeta();
                });
            }
            var moveLeft = inspector.querySelector('[data-nav-link-move-left]');
            var moveRight = inspector.querySelector('[data-nav-link-move-right]');
            if (moveLeft) {
                moveLeft.addEventListener('click', function () {
                    var idx = links.findIndex(function (item) { return item.id === link.id; });
                    if (idx <= 0) return;
                    var tmp = links[idx - 1];
                    links[idx - 1] = links[idx];
                    links[idx] = tmp;
                    syncNavbarMeta();
                });
            }
            if (moveRight) {
                moveRight.addEventListener('click', function () {
                    var idx = links.findIndex(function (item) { return item.id === link.id; });
                    if (idx < 0 || idx >= links.length - 1) return;
                    var tmp = links[idx + 1];
                    links[idx + 1] = links[idx];
                    links[idx] = tmp;
                    syncNavbarMeta();
                });
            }
        }

        function addNavLink() {
            var newLink = {
                id: 'nav-' + Date.now(),
                label: 'New link',
                href: 'page.html#about',
                visible: true,
                order: links.length + 1,
                pageId: ''
            };
            links.push(newLink);
            editorState.selectedNavbarItem = 'link:' + newLink.id;
            syncNavbarMeta();
        }

        function selectNavbarItem(itemKey) {
            var changed = editorState.selectedNavbarItem !== (itemKey || '');
            editorState.selectedNavbarItem = itemKey || '';
            paintNavbarCanvas();
            if (changed) {
                paintNavbarInspector(true);
            } else {
                updateNavbarLinkChipsInPlace();
            }
        }

        root.querySelector('[data-add-nav-link]').addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            addNavLink();
        });

        inspector.addEventListener('mousedown', function (e) {
            e.stopPropagation();
        });

        inspector.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        root.querySelector('[data-select-nav-bar]').addEventListener('click', function () {
            selectNavbarItem('navbar');
        });

        function swapNavLinksInDom(dragEl, targetEl) {
            if (!linksCanvas || !dragEl || !targetEl || dragEl === targetEl) return;
            var children = Array.prototype.slice.call(linksCanvas.children);
            var fromIdx = children.indexOf(dragEl);
            var toIdx = children.indexOf(targetEl);
            if (fromIdx < 0 || toIdx < 0) return;
            if (fromIdx < toIdx) {
                linksCanvas.insertBefore(dragEl, targetEl.nextSibling);
            } else {
                linksCanvas.insertBefore(dragEl, targetEl);
            }
        }

        function swapNavLinksInData(dragId, targetId) {
            if (!dragId || !targetId || dragId === targetId) return false;
            var fromIdx = links.findIndex(function (l) { return l.id === dragId; });
            var toIdx = links.findIndex(function (l) { return l.id === targetId; });
            if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return false;
            var moved = links.splice(fromIdx, 1)[0];
            links.splice(toIdx, 0, moved);
            return true;
        }

        function syncNavLinksDomOrder() {
            if (!linksCanvas) return;
            links.forEach(function (link) {
                if (!link || !link.id) return;
                var chip = linksCanvas.querySelector('[data-nav-link-id="' + link.id + '"]');
                if (chip) linksCanvas.appendChild(chip);
            });
        }

        function computeNavDropIndex(clientX) {
            if (!linksCanvas) return 0;
            var chips = Array.prototype.slice.call(linksCanvas.querySelectorAll('[data-nav-link-id]'));
            for (var i = 0; i < chips.length; i += 1) {
                var rect = chips[i].getBoundingClientRect();
                var mid = rect.left + rect.width / 2;
                if (clientX < mid) return i;
            }
            return Math.max(0, chips.length - 1);
        }

        function moveNavLinkToIndex(linkId, toIndex) {
            var fromIdx = links.findIndex(function (l) { return l.id === linkId; });
            if (fromIdx < 0 || toIndex < 0) return false;
            toIndex = Math.max(0, Math.min(links.length - 1, toIndex));
            if (fromIdx === toIndex) return false;
            var item = links.splice(fromIdx, 1)[0];
            var insertAt = toIndex;
            if (fromIdx < toIndex) insertAt = toIndex - 1;
            links.splice(insertAt, 0, item);
            syncNavLinksDomOrder();
            return true;
        }

        var navPointerMoveHandler = null;
        var navPointerUpHandler = null;
        var navMouseMoveHandler = null;
        var navMouseUpHandler = null;

        function clearNavPointerHandlers() {
            if (navPointerMoveHandler) {
                window.removeEventListener('pointermove', navPointerMoveHandler);
            }
            if (navPointerUpHandler) {
                window.removeEventListener('pointerup', navPointerUpHandler);
                window.removeEventListener('pointercancel', navPointerUpHandler);
            }
            if (navMouseMoveHandler) {
                window.removeEventListener('mousemove', navMouseMoveHandler);
            }
            if (navMouseUpHandler) {
                window.removeEventListener('mouseup', navMouseUpHandler);
            }
        }

        function onNavDragMove(e, pointerId) {
            if (!linkDragState || linkDragState.pointerId !== pointerId) return;
            if (Math.abs(e.clientX - linkDragState.startX) > 4 || Math.abs(e.clientY - linkDragState.startY) > 4) {
                linkDragState.moved = true;
            }
            if (!linkDragState.moved) return;
            e.preventDefault();
            if (linkDragState.chip) {
                linkDragState.chip.style.transform = 'translateX(' + (e.clientX - linkDragState.startX) + 'px)';
            }
            var dropIdx = computeNavDropIndex(e.clientX);
            if (dropIdx !== linkDragState.lastTargetIndex) {
                linkDragState.lastTargetIndex = dropIdx;
                if (moveNavLinkToIndex(linkDragState.linkId, dropIdx)) {
                    linkDragState.chip = linksCanvas.querySelector('[data-nav-link-id="' + linkDragState.linkId + '"]');
                    if (linkDragState.chip) {
                        linkDragState.chip.classList.add('is-dragging-chip');
                        linkDragState.chip.style.transform = 'translateX(' + (e.clientX - linkDragState.startX) + 'px)';
                    }
                }
            }
        }

        navPointerMoveHandler = function (e) {
            onNavDragMove(e, e.pointerId);
        };

        navMouseMoveHandler = function (e) {
            onNavDragMove(e, 'mouse');
        };

        navPointerUpHandler = function (e) {
            if (!linkDragState || e.pointerId !== linkDragState.pointerId) return;
            clearNavPointerHandlers();
            finishNavLinkDrag(e);
        };

        navMouseUpHandler = function (e) {
            if (!linkDragState || linkDragState.pointerId !== 'mouse') return;
            clearNavPointerHandlers();
            finishNavLinkDrag(e);
        };

        function finishNavLinkDrag(e) {
            if (!linkDragState) return;
            if (e && linkDragState.pointerId !== 'mouse' && e.pointerId != null && linkDragState.pointerId != null && e.pointerId !== linkDragState.pointerId) {
                return;
            }
            var savedLinkId = linkDragState.linkId;
            var wasMoved = !!linkDragState.moved;
            if (linkDragState.chip) {
                if (linkDragState.pointerId !== 'mouse') {
                    try {
                        linkDragState.chip.releasePointerCapture(linkDragState.pointerId);
                    } catch (_e) {}
                }
                linkDragState.chip.classList.remove('is-dragging-chip');
                linkDragState.chip.style.transform = '';
            }
            linkDragState = null;
            if (navCanvas) navCanvas.classList.remove('is-dragging-links');
            if (wasMoved) {
                suppressNavClick = true;
                editorState.selectedNavbarItem = 'link:' + savedLinkId;
                syncNavbarPreview();
                paintNavbarInspector();
            } else {
                selectNavbarItem('link:' + savedLinkId);
            }
        }

        function beginNavLinkDrag(e, chip, pointerId) {
            e.preventDefault();
            e.stopPropagation();
            var linkId = chip.getAttribute('data-nav-link-id');
            if (navCanvas) navCanvas.classList.add('is-dragging-links');
            chip.classList.add('is-dragging-chip');
            linkDragState = {
                linkId: linkId,
                chip: chip,
                pointerId: pointerId,
                startX: e.clientX,
                startY: e.clientY,
                moved: false,
                lastTargetIndex: links.findIndex(function (l) { return l.id === linkId; })
            };
            clearNavPointerHandlers();
            if (pointerId === 'mouse') {
                window.addEventListener('mousemove', navMouseMoveHandler);
                window.addEventListener('mouseup', navMouseUpHandler);
            } else {
                try {
                    chip.setPointerCapture(pointerId);
                } catch (_captureErr) {}
                window.addEventListener('pointermove', navPointerMoveHandler, { passive: false });
                window.addEventListener('pointerup', navPointerUpHandler);
                window.addEventListener('pointercancel', navPointerUpHandler);
            }
        }

        navCanvas.addEventListener('pointerdown', function (e) {
            var chip = e.target.closest('[data-nav-link-id]');
            if (!chip) return;
            beginNavLinkDrag(e, chip, e.pointerId);
        });

        navCanvas.addEventListener('mousedown', function (e) {
            if (e.button !== 0 || linkDragState) return;
            var chip = e.target.closest('[data-nav-link-id]');
            if (!chip) return;
            if (window.PointerEvent) return;
            beginNavLinkDrag(e, chip, 'mouse');
        });

        navCanvas.addEventListener('click', function (e) {
            if (suppressNavClick) {
                suppressNavClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (linkDragState && linkDragState.moved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            var linkChip = e.target.closest('[data-nav-link-id]');
            if (linkChip) {
                e.preventDefault();
                selectNavbarItem('link:' + linkChip.getAttribute('data-nav-link-id'));
                return;
            }
            if (e.target.closest('[data-nav-target="logo"]')) {
                e.preventDefault();
                selectNavbarItem('logo');
                return;
            }
            if (e.target.closest('.navbar-menu') || e.target === navCanvas || e.target.closest('.navbar-container')) {
                if (e.target.closest('.site-admin-navbar-preview-right')) return;
                selectNavbarItem('navbar');
            }
        });

        navbarDragCleanup = function () {
            clearNavPointerHandlers();
            if (navbarPreviewResizeObserver) {
                navbarPreviewResizeObserver.disconnect();
                navbarPreviewResizeObserver = null;
            }
            window.removeEventListener('resize', syncNavbarPreviewScale);
            linkDragState = null;
        };

        var navbarPreviewResizeObserver = null;
        if (previewWrap && typeof ResizeObserver !== 'undefined') {
            navbarPreviewResizeObserver = new ResizeObserver(function () {
                syncNavbarPreviewScale();
            });
            navbarPreviewResizeObserver.observe(previewWrap);
        }
        window.addEventListener('resize', syncNavbarPreviewScale);

        syncNavbarMeta();
        syncNavbarPreviewScale();
    }

    function renderFooterPanel(root) {
        if (footerDragCleanup) {
            footerDragCleanup();
            footerDragCleanup = null;
        }

        var footer = editorState.content.footer || {};
        footer.brand = footer.brand || {};
        footer.social = normalizeFooterSocialList(footer.social);
        footer.columns = Array.isArray(footer.columns) ? footer.columns : [];
        footer.bottomLinks = Array.isArray(footer.bottomLinks) ? footer.bottomLinks : [];
        editorState.content.footer = footer;

        var brand = footer.brand;
        var columns = footer.columns;
        var hrefPresets = getHrefPresetOptions();
        var linkDragState = null;
        var suppressFooterClick = false;
        var FOOTER_PREVIEW_WIDTH = 1200;

        root.innerHTML = [
            '<div class="visual-page-editor visual-footer-editor">',
            '<div class="visual-page-toolbar">',
            '<button type="button" class="btn btn-outline" data-add-footer-social>+ Add social icon</button>',
            '<button type="button" class="btn btn-outline" data-add-footer-column>+ Add column</button>',
            '<button type="button" class="btn btn-outline" data-add-footer-link>+ Add column link</button>',
            '<button type="button" class="btn btn-outline" data-add-footer-bottom-link>+ Add bottom link</button>',
            '</div>',
            '<div class="visual-page-layout">',
            '<div>',
            '<p class="visual-canvas-label">Click the <strong>logo/brand</strong>, <strong>social icons</strong>, <strong>column titles</strong>, <strong>links</strong>, <strong>copyright</strong>, or <strong>bottom links</strong> to edit them in the panel on the right. Drag links within a column to reorder.</p>',
            '<div class="site-admin-footer-preview-wrap" data-footer-preview-wrap>',
            '<div class="site-admin-footer-preview-label">Desktop preview (1200px) · click to select · drag links to move · build ' + EDITOR_BUILD + '</div>',
            '<div class="site-admin-footer-preview-viewport" data-footer-preview-viewport>',
            '<div class="site-admin-footer-preview-scaler" data-footer-preview-scaler>',
            '<footer class="footer site-admin-footer-preview is-editable" data-footer-canvas>',
            '<div class="footer-container">',
            '<div class="footer-content" data-footer-content>',
            '<div class="footer-brand visual-footer-target" data-footer-target="brand" role="button" tabindex="-1">',
            '<div class="footer-logo-container">',
            '<img src="' + escapeHtml(brand.logoSrc || 'assets/logo.jpeg') + '" alt="" class="footer-logo" data-preview-footer-logo>',
            '<span class="footer-logo-text" data-preview-footer-logo-text>' + escapeHtml(brand.logoText || 'AnyTransport') + '</span>',
            '</div>',
            '<p data-preview-footer-description>' + escapeHtml(brand.description || '') + '</p>',
            '<div class="social-icons" data-footer-social-canvas></div>',
            '</div>',
            '<div data-footer-columns-canvas></div>',
            '</div>',
            '<div class="footer-bottom">',
            '<p class="visual-footer-target" data-footer-target="copyright" role="button" tabindex="-1" data-preview-footer-copyright>' + escapeHtml(footer.copyright || '') + '</p>',
            '<div class="footer-links" data-footer-bottom-canvas></div>',
            '</div>',
            '</div>',
            '</footer>',
            '</div>',
            '</div>',
            '</div>',
            '</div>',
            '<aside class="visual-inspector" data-footer-inspector></aside>',
            '</div>',
            '</div>'
        ].join('');

        var footerCanvas = root.querySelector('[data-footer-canvas]');
        var columnsCanvas = root.querySelector('[data-footer-columns-canvas]');
        var socialCanvas = root.querySelector('[data-footer-social-canvas]');
        var bottomCanvas = root.querySelector('[data-footer-bottom-canvas]');
        var inspector = root.querySelector('[data-footer-inspector]');
        var previewWrap = root.querySelector('[data-footer-preview-wrap]');
        var previewViewport = root.querySelector('[data-footer-preview-viewport]');
        var previewScaler = root.querySelector('[data-footer-preview-scaler]');

        function syncFooterPreviewScale() {
            if (!previewWrap || !previewViewport || !previewScaler || !footerCanvas) return;
            var available = previewWrap.clientWidth;
            if (available < 1) return;
            var scale = Math.min(1, available / FOOTER_PREVIEW_WIDTH);
            previewScaler.style.width = FOOTER_PREVIEW_WIDTH + 'px';
            previewScaler.style.transform = scale < 0.999 ? ('scale(' + scale + ')') : 'none';
            previewScaler.style.transformOrigin = 'top left';
            var footerHeight = footerCanvas.offsetHeight || 320;
            previewViewport.style.height = Math.ceil(footerHeight * scale) + 'px';
            if (scale < 0.999) {
                previewScaler.style.marginRight = (-FOOTER_PREVIEW_WIDTH * (1 - scale)) + 'px';
                previewScaler.style.marginBottom = (-footerHeight * (1 - scale)) + 'px';
            } else {
                previewScaler.style.marginRight = '';
                previewScaler.style.marginBottom = '';
            }
        }

        function findColumnById(id) {
            return columns.find(function (col) { return col && col.id === id; }) || null;
        }

        function findFooterLink(columnId, linkId) {
            var col = findColumnById(columnId);
            if (!col || !Array.isArray(col.links)) return null;
            return col.links.find(function (link) { return link && link.id === linkId; }) || null;
        }

        function findBottomLinkById(id) {
            return footer.bottomLinks.find(function (link) { return link && link.id === id; }) || null;
        }

        function findSocialById(id) {
            return footer.social.find(function (item) { return item && item.id === id; }) || null;
        }

        function getSelectedFooterColumnId() {
            var sel = editorState.selectedFooterItem || '';
            if (sel.indexOf('column:') === 0) return sel.slice(7);
            if (sel.indexOf('link:') === 0) {
                var parts = sel.split(':');
                return parts.length >= 3 ? parts[1] : '';
            }
            return '';
        }

        function paintFooterCanvas(options) {
            options = options || {};
            var logoTextEl = root.querySelector('[data-preview-footer-logo-text]');
            var logoImgEl = root.querySelector('[data-preview-footer-logo]');
            var descEl = root.querySelector('[data-preview-footer-description]');
            var copyrightEl = root.querySelector('[data-preview-footer-copyright]');
            if (logoTextEl) logoTextEl.textContent = brand.logoText || 'AnyTransport';
            if (logoImgEl) logoImgEl.src = brand.logoSrc || 'assets/logo.jpeg';
            if (descEl) descEl.textContent = brand.description || '';
            if (copyrightEl) copyrightEl.textContent = footer.copyright || '';

            root.querySelector('[data-footer-target="brand"]')?.classList.toggle(
                'is-target-selected',
                editorState.selectedFooterItem === 'brand'
            );
            root.querySelector('[data-footer-target="copyright"]')?.classList.toggle(
                'is-target-selected',
                editorState.selectedFooterItem === 'copyright'
            );

            if (!linkDragState && socialCanvas) {
                socialCanvas.innerHTML = footer.social.map(function (item) {
                    return renderSocialChipMarkup(item, editorState.selectedFooterItem || '');
                }).join('');
            }

            if (!linkDragState && bottomCanvas) {
                bottomCanvas.innerHTML = footer.bottomLinks.map(function (link) {
                    if (!link || !link.id) return '';
                    var hidden = link.visible === false;
                    var selected = editorState.selectedFooterItem === ('bottom:' + link.id);
                    return [
                        '<span class="visual-footer-bottom-chip' + (hidden ? ' is-hidden-link' : '') + (selected ? ' is-target-selected' : '') + (link.action === 'provider-signup' ? ' footer-provider-link' : '') + '"',
                        ' data-footer-bottom-id="' + escapeHtml(link.id) + '" role="button" tabindex="-1">',
                        escapeHtml(link.label || 'Link'),
                        hidden ? ' <em class="visual-nav-hidden-badge">hidden</em>' : '',
                        '</span>'
                    ].join('');
                }).join('');
            }

            if (!linkDragState && columnsCanvas) {
                columnsCanvas.innerHTML = columns.map(function (col) {
                    if (!col || !col.id) return '';
                    var colSelected = editorState.selectedFooterItem === ('column:' + col.id);
                    var linksHtml = (col.links || []).map(function (link) {
                        if (!link || !link.id) return '';
                        var hidden = link.visible === false;
                        var selected = editorState.selectedFooterItem === ('link:' + col.id + ':' + link.id);
                        return [
                            '<li><span class="visual-footer-link-chip' + (hidden ? ' is-hidden-link' : '') + (selected ? ' is-target-selected' : '') + '"',
                            ' data-footer-link-id="' + escapeHtml(link.id) + '"',
                            ' data-footer-column-id="' + escapeHtml(col.id) + '"',
                            ' role="button" tabindex="-1">',
                            escapeHtml(link.label || 'Link'),
                            hidden ? ' <em class="visual-nav-hidden-badge">hidden</em>' : '',
                            '</span></li>'
                        ].join('');
                    }).join('');
                    return [
                        '<div class="footer-column visual-footer-column' + (colSelected ? ' is-target-selected' : '') + '" data-footer-column-id="' + escapeHtml(col.id) + '">',
                        '<h4 class="visual-footer-column-title" data-footer-column-id="' + escapeHtml(col.id) + '" role="button" tabindex="-1">' + escapeHtml(col.title || 'Column') + '</h4>',
                        '<ul class="visual-footer-links-canvas" data-footer-links-canvas="' + escapeHtml(col.id) + '">',
                        linksHtml,
                        '</ul>',
                        '</div>'
                    ].join('');
                }).join('');
            }

            syncFooterPreviewScale();
        }

        function syncFooterPreview() {
            editorState.content.footer = footer;
            paintFooterCanvas();
        }

        function footerInspectorHasFocus() {
            var active = document.activeElement;
            return !!(active && inspector && inspector.contains(active) && (
                active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT'
            ));
        }

        function paintFooterInspector(force) {
            var selection = editorState.selectedFooterItem || '';
            if (!force && footerInspectorHasFocus() && inspector.dataset.footerSelection === selection) {
                return;
            }
            inspector.dataset.footerSelection = selection;

            if (selection === 'brand') {
                inspector.innerHTML = [
                    '<h4>Footer brand</h4>',
                    '<label>Logo text<input type="text" data-footer-brand-text value="' + escapeHtml(brand.logoText || '') + '"></label>',
                    '<label>Logo image URL<input type="text" data-footer-brand-src value="' + escapeHtml(brand.logoSrc || '') + '"></label>',
                    '<input type="file" accept="image/*" data-footer-brand-upload style="display:none;">',
                    '<button type="button" class="btn btn-outline" data-footer-brand-upload-btn style="margin:8px 0;">Upload logo image</button>',
                    '<label>Description<textarea rows="4" data-footer-brand-description>' + escapeHtml(brand.description || '') + '</textarea></label>'
                ].join('');
                bindFooterBrandInspector();
                return;
            }

            if (selection === 'copyright') {
                inspector.innerHTML = [
                    '<h4>Copyright</h4>',
                    '<label>Copyright text<input type="text" data-footer-copyright-text value="' + escapeHtml(footer.copyright || '') + '"></label>'
                ].join('');
                var copyInput = inspector.querySelector('[data-footer-copyright-text]');
                if (copyInput) {
                    copyInput.addEventListener('input', function (e) {
                        footer.copyright = e.target.value;
                        syncFooterPreview();
                    });
                }
                return;
            }

            if (selection.indexOf('social:') === 0) {
                var social = findSocialById(selection.slice(7));
                var socialApi = getSocialIconsApi();
                if (social) {
                    var socialIcon = social.icon || 'letter';
                    var socialShape = social.shape || 'circle';
                    inspector.innerHTML = [
                        '<h4>Social icon</h4>',
                        '<label>Shape<select data-footer-social-shape>' + (socialApi ? socialApi.shapeOptionsHtml(socialShape) : '') + '</select></label>',
                        '<label>Icon preset<div class="social-icon-picker" data-footer-social-icon-picker>' + (socialApi ? socialApi.iconPickerHtml(socialIcon) : '') + '</div></label>',
                        '<div data-footer-social-letter-field style="' + (socialIcon === 'letter' ? '' : 'display:none;') + '">',
                        '<label>Letter / initials<input type="text" maxlength="2" data-footer-social-letter value="' + escapeHtml(social.iconText || '') + '"></label>',
                        '</div>',
                        '<div data-footer-social-custom-field style="' + (socialIcon === 'custom' ? '' : 'display:none;') + '">',
                        '<label>Icon image URL<input type="text" data-footer-social-icon-url value="' + escapeHtml(social.iconUrl || '') + '"></label>',
                        '<input type="file" accept="image/*" data-footer-social-icon-upload style="display:none;">',
                        '<button type="button" class="btn btn-outline" data-footer-social-icon-upload-btn style="margin:8px 0;">Upload icon image</button>',
                        '</div>',
                        '<label>Accessibility label<input type="text" data-footer-social-label value="' + escapeHtml(social.label || '') + '"></label>',
                        '<label>Link URL<input type="text" data-footer-social-href value="' + escapeHtml(social.href || '') + '"></label>',
                        '<label style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" data-footer-social-visible ' + (social.visible !== false ? 'checked' : '') + '> Visible on site</label>',
                        '<div style="display:flex;gap:6px;margin-top:4px;">',
                        '<button type="button" class="btn btn-outline" data-footer-social-move-left>← Move left</button>',
                        '<button type="button" class="btn btn-outline" data-footer-social-move-right>Move right →</button>',
                        '</div>',
                        '<button type="button" class="btn btn-outline" data-footer-social-delete style="margin-top:8px;color:#b91c1c;border-color:#fecaca;">Delete social icon</button>'
                    ].join('');
                    bindFooterSocialInspector(social);
                }
                return;
            }

            if (selection.indexOf('column:') === 0) {
                var column = findColumnById(selection.slice(7));
                if (column) {
                    var colIdx = columns.findIndex(function (c) { return c.id === column.id; });
                    inspector.innerHTML = [
                        '<h4>Footer column</h4>',
                        '<label>Column title<input type="text" data-footer-col-title value="' + escapeHtml(column.title || '') + '"></label>',
                        '<div style="display:flex;gap:6px;margin-top:4px;">',
                        '<button type="button" class="btn btn-outline" data-footer-col-move-left' + (colIdx <= 0 ? ' disabled' : '') + '>← Move left</button>',
                        '<button type="button" class="btn btn-outline" data-footer-col-move-right' + (colIdx >= columns.length - 1 ? ' disabled' : '') + '>Move right →</button>',
                        '</div>',
                        '<button type="button" class="btn btn-outline" data-footer-col-delete style="margin-top:8px;color:#b91c1c;border-color:#fecaca;">Delete column</button>'
                    ].join('');
                    bindFooterColumnInspector(column);
                }
                return;
            }

            if (selection.indexOf('link:') === 0) {
                var linkParts = selection.split(':');
                if (linkParts.length >= 3) {
                    var link = findFooterLink(linkParts[1], linkParts[2]);
                    if (link) {
                        inspector.innerHTML = [
                            '<h4>Column link</h4>',
                            '<label>Label<input type="text" data-footer-link-label value="' + escapeHtml(link.label || '') + '"></label>',
                            '<label>Quick pick<select data-footer-link-preset>' + presetOptionsHtml(hrefPresets, link.href || '') + '</select></label>',
                            '<label>URL<input type="text" data-footer-link-href value="' + escapeHtml(link.href || '') + '"></label>',
                            '<label style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" data-footer-link-visible ' + (link.visible !== false ? 'checked' : '') + '> Visible on site</label>',
                            '<div style="display:flex;gap:6px;margin-top:4px;">',
                            '<button type="button" class="btn btn-outline" data-footer-link-move-up>↑ Move up</button>',
                            '<button type="button" class="btn btn-outline" data-footer-link-move-down>Move down ↓</button>',
                            '</div>',
                            '<button type="button" class="btn btn-outline" data-footer-link-delete style="margin-top:8px;color:#b91c1c;border-color:#fecaca;">Delete link</button>'
                        ].join('');
                        bindFooterLinkInspector(linkParts[1], link);
                    }
                }
                return;
            }

            if (selection.indexOf('bottom:') === 0) {
                var bottomLink = findBottomLinkById(selection.slice(7));
                if (bottomLink) {
                    inspector.innerHTML = [
                        '<h4>Bottom link</h4>',
                        '<label>Label<input type="text" data-footer-bottom-label value="' + escapeHtml(bottomLink.label || '') + '"></label>',
                        '<label>Quick pick<select data-footer-bottom-preset>' + presetOptionsHtml(hrefPresets, bottomLink.href || '') + '</select></label>',
                        '<label>URL<input type="text" data-footer-bottom-href value="' + escapeHtml(bottomLink.href || '') + '"></label>',
                        '<label style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" data-footer-bottom-visible ' + (bottomLink.visible !== false ? 'checked' : '') + '> Visible on site</label>',
                        '<label style="flex-direction:row;align-items:center;gap:8px;"><input type="checkbox" data-footer-bottom-provider ' + (bottomLink.action === 'provider-signup' ? 'checked' : '') + '> Provider sign-up action</label>',
                        '<div style="display:flex;gap:6px;margin-top:4px;">',
                        '<button type="button" class="btn btn-outline" data-footer-bottom-move-left>← Move left</button>',
                        '<button type="button" class="btn btn-outline" data-footer-bottom-move-right>Move right →</button>',
                        '</div>',
                        '<button type="button" class="btn btn-outline" data-footer-bottom-delete style="margin-top:8px;color:#b91c1c;border-color:#fecaca;">Delete link</button>'
                    ].join('');
                    bindFooterBottomInspector(bottomLink);
                }
                return;
            }

            inspector.innerHTML = [
                '<h4>Footer editor</h4>',
                '<p class="visual-inspector-empty">Click the <strong>brand</strong>, <strong>social icons</strong>, a <strong>column title</strong>, any <strong>link</strong>, <strong>copyright</strong>, or <strong>bottom links</strong> to edit them here.</p>',
                '<p class="visual-inspector-empty">Use <strong>+ Add social icon</strong> for new shapes. Drag column links to reorder them.</p>'
            ].join('');
        }

        function syncFooterMeta() {
            syncFooterPreview();
            paintFooterInspector(true);
        }

        function selectFooterItem(itemKey) {
            var changed = editorState.selectedFooterItem !== (itemKey || '');
            editorState.selectedFooterItem = itemKey || '';
            paintFooterCanvas();
            if (changed) {
                paintFooterInspector(true);
            }
        }

        function bindFooterBrandInspector() {
            var textInput = inspector.querySelector('[data-footer-brand-text]');
            var srcInput = inspector.querySelector('[data-footer-brand-src]');
            var descInput = inspector.querySelector('[data-footer-brand-description]');
            var uploadBtn = inspector.querySelector('[data-footer-brand-upload-btn]');
            var uploadInput = inspector.querySelector('[data-footer-brand-upload]');
            if (textInput) textInput.addEventListener('input', function (e) { brand.logoText = e.target.value; syncFooterPreview(); });
            if (srcInput) srcInput.addEventListener('input', function (e) { brand.logoSrc = e.target.value; syncFooterPreview(); });
            if (descInput) descInput.addEventListener('input', function (e) { brand.description = e.target.value; syncFooterPreview(); });
            if (uploadBtn && uploadInput) {
                uploadBtn.addEventListener('click', function () { uploadInput.click(); });
                uploadInput.addEventListener('change', function (e) {
                    var file = e.target.files && e.target.files[0];
                    if (!file) return;
                    uploadImage(file).then(function (url) {
                        brand.logoSrc = url;
                        if (srcInput) srcInput.value = url;
                        syncFooterPreview();
                    }).catch(function (err) {
                        window.alert(err && err.message ? err.message : 'Logo upload failed.');
                    });
                });
            }
        }

        function bindFooterSocialInspector(social) {
            function toggleSocialExtraFields() {
                var letterField = inspector.querySelector('[data-footer-social-letter-field]');
                var customField = inspector.querySelector('[data-footer-social-custom-field]');
                if (letterField) letterField.style.display = social.icon === 'letter' ? '' : 'none';
                if (customField) customField.style.display = social.icon === 'custom' ? '' : 'none';
            }

            inspector.querySelector('[data-footer-social-shape]')?.addEventListener('change', function (e) {
                social.shape = e.target.value;
                syncFooterPreview();
            });

            inspector.querySelectorAll('[data-social-icon-pick]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    social.icon = btn.getAttribute('data-social-icon-pick') || 'letter';
                    inspector.querySelectorAll('[data-social-icon-pick]').forEach(function (pick) {
                        pick.classList.toggle('is-selected', pick === btn);
                    });
                    toggleSocialExtraFields();
                    syncFooterPreview();
                });
            });

            inspector.querySelector('[data-footer-social-letter]')?.addEventListener('input', function (e) {
                social.iconText = e.target.value;
                syncFooterPreview();
            });

            var iconUrlInput = inspector.querySelector('[data-footer-social-icon-url]');
            if (iconUrlInput) {
                iconUrlInput.addEventListener('input', function (e) {
                    social.iconUrl = e.target.value;
                    syncFooterPreview();
                });
            }
            var iconUploadBtn = inspector.querySelector('[data-footer-social-icon-upload-btn]');
            var iconUploadInput = inspector.querySelector('[data-footer-social-icon-upload]');
            if (iconUploadBtn && iconUploadInput) {
                iconUploadBtn.addEventListener('click', function () { iconUploadInput.click(); });
                iconUploadInput.addEventListener('change', function (e) {
                    var file = e.target.files && e.target.files[0];
                    if (!file) return;
                    uploadImage(file).then(function (url) {
                        social.icon = 'custom';
                        social.iconUrl = url;
                        if (iconUrlInput) iconUrlInput.value = url;
                        paintFooterInspector(true);
                        syncFooterPreview();
                    }).catch(function (err) {
                        window.alert(err && err.message ? err.message : 'Icon upload failed.');
                    });
                });
            }

            inspector.querySelector('[data-footer-social-label]')?.addEventListener('input', function (e) {
                social.label = e.target.value;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-social-href]')?.addEventListener('input', function (e) {
                social.href = e.target.value;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-social-visible]')?.addEventListener('change', function (e) {
                social.visible = e.target.checked;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-social-move-left]')?.addEventListener('click', function () {
                var idx = footer.social.findIndex(function (item) { return item.id === social.id; });
                if (idx <= 0) return;
                var tmp = footer.social[idx - 1];
                footer.social[idx - 1] = footer.social[idx];
                footer.social[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-social-move-right]')?.addEventListener('click', function () {
                var idx = footer.social.findIndex(function (item) { return item.id === social.id; });
                if (idx < 0 || idx >= footer.social.length - 1) return;
                var tmp = footer.social[idx + 1];
                footer.social[idx + 1] = footer.social[idx];
                footer.social[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-social-delete]')?.addEventListener('click', function () {
                footer.social = footer.social.filter(function (item) { return item.id !== social.id; });
                editorState.selectedFooterItem = 'brand';
                syncFooterMeta();
            });
        }

        function bindFooterColumnInspector(column) {
            inspector.querySelector('[data-footer-col-title]')?.addEventListener('input', function (e) {
                column.title = e.target.value;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-col-move-left]')?.addEventListener('click', function () {
                var idx = columns.findIndex(function (c) { return c.id === column.id; });
                if (idx <= 0) return;
                var tmp = columns[idx - 1];
                columns[idx - 1] = columns[idx];
                columns[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-col-move-right]')?.addEventListener('click', function () {
                var idx = columns.findIndex(function (c) { return c.id === column.id; });
                if (idx < 0 || idx >= columns.length - 1) return;
                var tmp = columns[idx + 1];
                columns[idx + 1] = columns[idx];
                columns[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-col-delete]')?.addEventListener('click', function () {
                columns.splice(columns.findIndex(function (c) { return c.id === column.id; }), 1);
                editorState.selectedFooterItem = '';
                syncFooterMeta();
            });
        }

        function bindFooterLinkInspector(columnId, link) {
            inspector.querySelector('[data-footer-link-label]')?.addEventListener('input', function (e) {
                link.label = e.target.value;
                syncFooterPreview();
            });
            var hrefInput = inspector.querySelector('[data-footer-link-href]');
            if (hrefInput) {
                hrefInput.addEventListener('input', function (e) {
                    link.href = e.target.value;
                    syncFooterPreview();
                });
            }
            inspector.querySelector('[data-footer-link-preset]')?.addEventListener('change', function (e) {
                if (!e.target.value) return;
                link.href = e.target.value;
                if (hrefInput) hrefInput.value = e.target.value;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-link-visible]')?.addEventListener('change', function (e) {
                link.visible = e.target.checked;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-link-move-up]')?.addEventListener('click', function () {
                var col = findColumnById(columnId);
                if (!col) return;
                var idx = col.links.findIndex(function (l) { return l.id === link.id; });
                if (idx <= 0) return;
                var tmp = col.links[idx - 1];
                col.links[idx - 1] = col.links[idx];
                col.links[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-link-move-down]')?.addEventListener('click', function () {
                var col = findColumnById(columnId);
                if (!col) return;
                var idx = col.links.findIndex(function (l) { return l.id === link.id; });
                if (idx < 0 || idx >= col.links.length - 1) return;
                var tmp = col.links[idx + 1];
                col.links[idx + 1] = col.links[idx];
                col.links[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-link-delete]')?.addEventListener('click', function () {
                var col = findColumnById(columnId);
                if (!col) return;
                col.links = col.links.filter(function (l) { return l.id !== link.id; });
                editorState.selectedFooterItem = 'column:' + columnId;
                syncFooterMeta();
            });
        }

        function bindFooterBottomInspector(bottomLink) {
            inspector.querySelector('[data-footer-bottom-label]')?.addEventListener('input', function (e) {
                bottomLink.label = e.target.value;
                syncFooterPreview();
            });
            var hrefInput = inspector.querySelector('[data-footer-bottom-href]');
            if (hrefInput) {
                hrefInput.addEventListener('input', function (e) {
                    bottomLink.href = e.target.value;
                    syncFooterPreview();
                });
            }
            inspector.querySelector('[data-footer-bottom-preset]')?.addEventListener('change', function (e) {
                if (!e.target.value) return;
                bottomLink.href = e.target.value;
                if (hrefInput) hrefInput.value = e.target.value;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-bottom-visible]')?.addEventListener('change', function (e) {
                bottomLink.visible = e.target.checked;
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-bottom-provider]')?.addEventListener('change', function (e) {
                bottomLink.action = e.target.checked ? 'provider-signup' : '';
                syncFooterPreview();
            });
            inspector.querySelector('[data-footer-bottom-move-left]')?.addEventListener('click', function () {
                var idx = footer.bottomLinks.findIndex(function (l) { return l.id === bottomLink.id; });
                if (idx <= 0) return;
                var tmp = footer.bottomLinks[idx - 1];
                footer.bottomLinks[idx - 1] = footer.bottomLinks[idx];
                footer.bottomLinks[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-bottom-move-right]')?.addEventListener('click', function () {
                var idx = footer.bottomLinks.findIndex(function (l) { return l.id === bottomLink.id; });
                if (idx < 0 || idx >= footer.bottomLinks.length - 1) return;
                var tmp = footer.bottomLinks[idx + 1];
                footer.bottomLinks[idx + 1] = footer.bottomLinks[idx];
                footer.bottomLinks[idx] = tmp;
                syncFooterMeta();
            });
            inspector.querySelector('[data-footer-bottom-delete]')?.addEventListener('click', function () {
                footer.bottomLinks = footer.bottomLinks.filter(function (l) { return l.id !== bottomLink.id; });
                editorState.selectedFooterItem = 'copyright';
                syncFooterMeta();
            });
        }

        root.querySelector('[data-add-footer-social]').addEventListener('click', function (e) {
            e.preventDefault();
            var api = getSocialIconsApi();
            var newSocial = {
                id: 'social-' + Date.now(),
                label: 'Facebook',
                href: '#',
                visible: true,
                icon: 'facebook',
                shape: 'circle',
                iconText: 'F',
                iconUrl: ''
            };
            footer.social.push(api ? api.normalizeSocialItem(newSocial) : newSocial);
            editorState.selectedFooterItem = 'social:' + newSocial.id;
            syncFooterMeta();
        });

        root.querySelector('[data-add-footer-column]').addEventListener('click', function (e) {
            e.preventDefault();
            var col = { id: 'col-' + Date.now(), title: 'New column', links: [] };
            columns.push(col);
            editorState.selectedFooterItem = 'column:' + col.id;
            syncFooterMeta();
        });

        root.querySelector('[data-add-footer-link]').addEventListener('click', function (e) {
            e.preventDefault();
            var columnId = getSelectedFooterColumnId();
            var col = columnId ? findColumnById(columnId) : columns[0];
            if (!col) {
                col = { id: 'col-' + Date.now(), title: 'New column', links: [] };
                columns.push(col);
            }
            var newLink = { id: 'fl-' + Date.now(), label: 'New link', href: 'page.html#about', visible: true };
            col.links = col.links || [];
            col.links.push(newLink);
            editorState.selectedFooterItem = 'link:' + col.id + ':' + newLink.id;
            syncFooterMeta();
        });

        root.querySelector('[data-add-footer-bottom-link]').addEventListener('click', function (e) {
            e.preventDefault();
            var newLink = { id: 'bl-' + Date.now(), label: 'New link', href: 'page.html#about', visible: true };
            footer.bottomLinks.push(newLink);
            editorState.selectedFooterItem = 'bottom:' + newLink.id;
            syncFooterMeta();
        });

        inspector.addEventListener('mousedown', function (e) { e.stopPropagation(); });
        inspector.addEventListener('click', function (e) { e.stopPropagation(); });

        function swapFooterLinksInDom(dragEl, targetEl) {
            var dragLi = dragEl.closest('li');
            var targetLi = targetEl.closest('li');
            if (!dragLi || !targetLi || dragLi === targetLi) return;
            var list = dragLi.parentNode;
            if (!list || list !== targetLi.parentNode) return;
            var fromIdx = Array.prototype.indexOf.call(list.children, dragLi);
            var toIdx = Array.prototype.indexOf.call(list.children, targetLi);
            if (fromIdx < 0 || toIdx < 0) return;
            if (fromIdx < toIdx) {
                list.insertBefore(dragLi, targetLi.nextSibling);
            } else {
                list.insertBefore(dragLi, targetLi);
            }
        }

        function swapFooterLinksInData(columnId, dragId, targetId) {
            var col = findColumnById(columnId);
            if (!col || !Array.isArray(col.links)) return false;
            var fromIdx = col.links.findIndex(function (l) { return l.id === dragId; });
            var toIdx = col.links.findIndex(function (l) { return l.id === targetId; });
            if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return false;
            var moved = col.links.splice(fromIdx, 1)[0];
            col.links.splice(toIdx, 0, moved);
            return true;
        }

        function findFooterDropTargetChip(clientY, dragChip, columnId) {
            var list = root.querySelector('[data-footer-links-canvas="' + columnId + '"]');
            if (!list) return null;
            var chips = Array.prototype.slice.call(list.querySelectorAll('[data-footer-link-id]'));
            var over = null;
            chips.forEach(function (chip) {
                if (chip === dragChip) return;
                var rect = chip.getBoundingClientRect();
                if (clientY >= rect.top && clientY <= rect.bottom) {
                    over = chip;
                }
            });
            if (over) return over;
            var best = null;
            var bestDist = Infinity;
            chips.forEach(function (chip) {
                if (chip === dragChip) return;
                var rect = chip.getBoundingClientRect();
                var center = rect.top + rect.height / 2;
                var dist = Math.abs(clientY - center);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = chip;
                }
            });
            return best;
        }

        var footerPointerMoveHandler = null;
        var footerPointerUpHandler = null;

        function clearFooterPointerHandlers() {
            if (footerPointerMoveHandler) {
                window.removeEventListener('pointermove', footerPointerMoveHandler);
                footerPointerMoveHandler = null;
            }
            if (footerPointerUpHandler) {
                window.removeEventListener('pointerup', footerPointerUpHandler);
                window.removeEventListener('pointercancel', footerPointerUpHandler);
                footerPointerUpHandler = null;
            }
        }

        footerPointerMoveHandler = function (e) {
            if (!linkDragState || e.pointerId !== linkDragState.pointerId) return;
            if (Math.abs(e.clientY - linkDragState.startY) > 5) {
                linkDragState.moved = true;
            }
            if (!linkDragState.moved) return;
            e.preventDefault();
            var targetChip = findFooterDropTargetChip(e.clientY, linkDragState.chip, linkDragState.columnId);
            if (!targetChip || targetChip === linkDragState.chip) return;
            var targetId = targetChip.getAttribute('data-footer-link-id');
            if (!targetId || targetId === linkDragState.lastTargetId) return;
            linkDragState.lastTargetId = targetId;
            if (swapFooterLinksInData(linkDragState.columnId, linkDragState.linkId, targetId)) {
                swapFooterLinksInDom(linkDragState.chip, targetChip);
            }
        };

        footerPointerUpHandler = function (e) {
            if (!linkDragState || e.pointerId !== linkDragState.pointerId) return;
            clearFooterPointerHandlers();
            finishFooterLinkDrag(e);
        };

        function finishFooterLinkDrag(e) {
            if (!linkDragState) return;
            var saved = {
                columnId: linkDragState.columnId,
                linkId: linkDragState.linkId,
                moved: !!linkDragState.moved
            };
            if (linkDragState.chip) {
                try {
                    linkDragState.chip.releasePointerCapture(linkDragState.pointerId);
                } catch (_e) {}
                linkDragState.chip.classList.remove('is-dragging-chip');
            }
            linkDragState = null;
            if (footerCanvas) footerCanvas.classList.remove('is-dragging-links');
            if (saved.moved) {
                suppressFooterClick = true;
                editorState.selectedFooterItem = 'link:' + saved.columnId + ':' + saved.linkId;
                syncFooterPreview();
                paintFooterInspector();
            } else {
                selectFooterItem('link:' + saved.columnId + ':' + saved.linkId);
            }
        }

        footerCanvas.addEventListener('pointerdown', function (e) {
            var chip = e.target.closest('[data-footer-link-id]');
            if (!chip) return;
            e.preventDefault();
            e.stopPropagation();
            var columnId = chip.getAttribute('data-footer-column-id');
            var linkId = chip.getAttribute('data-footer-link-id');
            try {
                chip.setPointerCapture(e.pointerId);
            } catch (_e) {}
            footerCanvas.classList.add('is-dragging-links');
            chip.classList.add('is-dragging-chip');
            linkDragState = {
                columnId: columnId,
                linkId: linkId,
                chip: chip,
                pointerId: e.pointerId,
                startY: e.clientY,
                moved: false,
                lastTargetId: ''
            };
            clearFooterPointerHandlers();
            window.addEventListener('pointermove', footerPointerMoveHandler, { passive: false });
            window.addEventListener('pointerup', footerPointerUpHandler);
            window.addEventListener('pointercancel', footerPointerUpHandler);
        });

        footerCanvas.addEventListener('click', function (e) {
            if (suppressFooterClick) {
                suppressFooterClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (linkDragState && linkDragState.moved) return;

            var linkChip = e.target.closest('[data-footer-link-id]');
            if (linkChip) {
                e.preventDefault();
                selectFooterItem('link:' + linkChip.getAttribute('data-footer-column-id') + ':' + linkChip.getAttribute('data-footer-link-id'));
                return;
            }
            var colTitle = e.target.closest('.visual-footer-column-title');
            if (colTitle) {
                e.preventDefault();
                selectFooterItem('column:' + colTitle.getAttribute('data-footer-column-id'));
                return;
            }
            var socialChip = e.target.closest('[data-footer-social-id]');
            if (socialChip) {
                e.preventDefault();
                selectFooterItem('social:' + socialChip.getAttribute('data-footer-social-id'));
                return;
            }
            var bottomChip = e.target.closest('[data-footer-bottom-id]');
            if (bottomChip) {
                e.preventDefault();
                selectFooterItem('bottom:' + bottomChip.getAttribute('data-footer-bottom-id'));
                return;
            }
            if (e.target.closest('[data-footer-target="brand"]')) {
                e.preventDefault();
                selectFooterItem('brand');
                return;
            }
            if (e.target.closest('[data-footer-target="copyright"]')) {
                e.preventDefault();
                selectFooterItem('copyright');
            }
        });

        var footerPreviewResizeObserver = null;
        footerDragCleanup = function () {
            clearFooterPointerHandlers();
            if (footerPreviewResizeObserver) {
                footerPreviewResizeObserver.disconnect();
                footerPreviewResizeObserver = null;
            }
            window.removeEventListener('resize', syncFooterPreviewScale);
            linkDragState = null;
        };

        if (previewWrap && typeof ResizeObserver !== 'undefined') {
            footerPreviewResizeObserver = new ResizeObserver(syncFooterPreviewScale);
            footerPreviewResizeObserver.observe(previewWrap);
        }
        window.addEventListener('resize', syncFooterPreviewScale);

        syncFooterMeta();
        syncFooterPreviewScale();
    }

    function getSelectedPage() {
        var pages = editorState.content.pages || {};
        var pageId = editorState.selectedPageId;
        if (!pages[pageId]) {
            pageId = Object.keys(pages)[0] || 'about';
            editorState.selectedPageId = pageId;
        }
        return pages[pageId];
    }

    function fontOptionsHtml(selected) {
        return FONT_OPTIONS.map(function (opt) {
            return '<option value="' + escapeHtml(opt.id) + '" ' + (opt.id === selected ? 'selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
        }).join('');
    }

    function ensurePageElements(page) {
        page.elements = Array.isArray(page.elements) ? page.elements : [];
        if (!page.canvasHeight) page.canvasHeight = 520;
        if (!page.backgroundColor) page.backgroundColor = '#ffffff';
        var imgApi = getCmsImagesApi();
        if (imgApi) {
            page.elements = page.elements.map(function (el) {
                if (el && el.type === 'image') {
                    return imgApi.normalizeImageFields(el);
                }
                return el;
            });
        }
        return page;
    }

    function makeElement(type, x, y) {
        var id = 'el-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
        if (type === 'image') {
            var imgApi = getCmsImagesApi();
            if (imgApi) {
                return imgApi.defaultImageElement({ id: id, x: x != null ? x : 12, y: y != null ? y : 12 });
            }
            return {
                id: id,
                type: 'image',
                x: x != null ? x : 12,
                y: y != null ? y : 12,
                width: 40,
                height: 28,
                zIndex: 1,
                url: '',
                alt: '',
                shape: 'rounded',
                borderRadius: 12,
                objectFit: 'cover',
                font: '',
                fontSize: 16,
                color: '#0f172a',
                align: 'left',
                content: ''
            };
        }
        return {
            id: id,
            type: type,
            x: x != null ? x : 10,
            y: y != null ? y : 10,
            width: type === 'title' ? 80 : 55,
            zIndex: 1,
            content: type === 'title' ? 'New title' : (type === 'text' ? '<p>New paragraph — double-click to edit.</p>' : ''),
            url: '',
            alt: '',
            font: '',
            fontSize: type === 'title' ? 32 : 16,
            color: type === 'title' ? '#0f172a' : '#334155',
            align: 'left'
        };
    }

    function getSelectedElement(page) {
        if (!page || !editorState.selectedElementId) return null;
        return (page.elements || []).find(function (el) { return el.id === editorState.selectedElementId; }) || null;
    }

    function scrollPreviewToPage(iframe, slug) {
        if (!iframe || !slug) return;
        try {
            var doc = iframe.contentDocument || iframe.contentWindow.document;
            if (!doc) return;
            var target = doc.getElementById(slug);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } catch (_e) {}
    }

    function renderVisualPagesPanel(root) {
        if (canvasDragCleanup) {
            canvasDragCleanup();
            canvasDragCleanup = null;
        }

        var pages = editorState.content.pages || {};
        var pageIds = Object.keys(pages);
        var page = ensurePageElements(getSelectedPage());
        pages[editorState.selectedPageId] = page;

        var pageOptions = pageIds.map(function (id) {
            var p = pages[id];
            return '<option value="' + escapeHtml(id) + '" ' + (id === editorState.selectedPageId ? 'selected' : '') + '>' + escapeHtml(p.title || id) + '</option>';
        }).join('');

        var previewBase = String(window.location.pathname || '').indexOf('subdomain-dashboard') >= 0 ? '../page.html' : 'page.html';
        var previewSlug = encodeURIComponent(page.slug || page.id || 'about');
        var previewSrc = previewBase + '#' + previewSlug;

        root.innerHTML = [
            '<div class="visual-page-editor">',
            '<div class="visual-page-toolbar">',
            '<label>Page <select data-page-select>' + pageOptions + '</select></label>',
            '<label>Anchor <input type="text" data-page-slug value="' + escapeHtml(page.slug || page.id || '') + '" style="width:120px;"></label>',
            '<label><input type="checkbox" data-page-visible ' + (page.visible !== false ? 'checked' : '') + '> Visible</label>',
            '<label>Height <input type="number" min="320" max="2400" step="20" data-page-height value="' + (page.canvasHeight || 520) + '" style="width:90px;"> px</label>',
            '<button type="button" class="btn btn-outline" data-add-title>+ Title</button>',
            '<button type="button" class="btn btn-outline" data-add-text>+ Text</button>',
            '<button type="button" class="btn btn-outline" data-add-image>+ Image</button>',
            '<button type="button" class="btn btn-outline" data-edit-navbar>Edit navbar</button>',
            '</div>',
            '<div class="visual-page-layout">',
            '<div>',
            '<div class="visual-preview-wrap">',
            '<iframe data-page-preview src="' + previewSrc + '" title="Live page preview"></iframe>',
            '</div>',
            '<p class="visual-canvas-label">This is your editable page area — click anywhere to add content, or drag elements to reposition them. The preview above shows how the section appears on the live site.</p>',
            '<div class="visual-canvas-wrap">',
            '<div class="visual-canvas" data-visual-canvas style="min-height:' + (page.canvasHeight || 520) + 'px;background-color:' + escapeHtml(page.backgroundColor || '#ffffff') + ';' + (page.backgroundImage ? 'background-image:url(' + page.backgroundImage + ');background-size:cover;background-position:center;' : '') + '"></div>',
            '</div>',
            '</div>',
            '<aside class="visual-inspector" data-visual-inspector></aside>',
            '</div>',
            '</div>'
        ].join('');

        var canvas = root.querySelector('[data-visual-canvas]');
        var inspector = root.querySelector('[data-visual-inspector]');
        var iframe = root.querySelector('[data-page-preview]');
        var dragState = null;
        var resizeState = null;

        inspector.addEventListener('mousedown', function (e) {
            e.stopPropagation();
        });
        inspector.addEventListener('click', function (e) {
            e.stopPropagation();
        });

        function syncPageMeta() {
            page.slug = root.querySelector('[data-page-slug]').value || page.id;
            page.visible = root.querySelector('[data-page-visible]').checked;
            page.canvasHeight = parseInt(root.querySelector('[data-page-height]').value, 10) || 520;
            pages[editorState.selectedPageId] = page;
            editorState.content.pages = pages;
        }

        function renderCanvasImageElement(el, selectedClass) {
            var imgApi = getCmsImagesApi();
            var imageEl = imgApi ? imgApi.normalizeImageFields(el) : el;
            if (imgApi) {
                Object.assign(el, {
                    width: imageEl.width,
                    height: imageEl.height,
                    shape: imageEl.shape,
                    borderRadius: imageEl.borderRadius,
                    objectFit: imageEl.objectFit
                });
            } else if (!el.height || el.height < 5) {
                el.height = 28;
                if (!el.width || el.width < 5) el.width = 40;
            }
            var frameStyle = imgApi ? imgApi.buildImageFrameStyle(imageEl) : ('left:' + el.x + '%;top:' + el.y + '%;width:' + (el.width || 40) + '%;height:' + (el.height || 28) + '%;overflow:hidden;border-radius:12px;');
            var hasUrl = !!(imageEl.url && String(imageEl.url).trim());
            var inner = hasUrl
                ? '<img class="visual-canvas-image" src="' + escapeHtml(imageEl.url) + '" alt="' + escapeHtml(imageEl.alt || '') + '" style="' + (imgApi ? imgApi.buildImageTagStyle(imageEl) : 'width:100%;height:100%;object-fit:cover;display:block;') + '">'
                : [
                    '<div class="visual-image-placeholder">',
                    '<strong>No image yet</strong>',
                    '<span>Upload or paste a URL in the panel →</span>',
                    '</div>'
                ].join('');
            var isSelected = selectedClass.indexOf('is-selected') >= 0;
            var resizeHandle = isSelected
                ? '<span class="visual-image-resize-handle" data-image-resize-handle data-el-id="' + escapeHtml(el.id) + '" title="Drag to resize"></span>'
                : '';
            return [
                '<div class="visual-canvas-element is-image' + (hasUrl ? '' : ' is-image-empty') + selectedClass + '"',
                ' data-el-id="' + escapeHtml(el.id) + '" style="' + frameStyle + '">',
                inner,
                resizeHandle,
                '</div>'
            ].join('');
        }

        function syncCanvasElementDom(el) {
            if (!el || !canvas) return;
            var node = canvas.querySelector('[data-el-id="' + el.id + '"]');
            if (!node) return;
            node.style.left = el.x + '%';
            node.style.top = el.y + '%';
            if (el.width != null) node.style.width = el.width + '%';
            if (el.type === 'image' && el.height != null) node.style.height = el.height + '%';
        }

        function paintCanvas(options) {
            options = options || {};
            canvas.style.minHeight = (page.canvasHeight || 520) + 'px';
            canvas.style.backgroundColor = page.backgroundColor || '#ffffff';
            canvas.innerHTML = (page.elements || []).map(function (el) {
                var style = 'left:' + el.x + '%;top:' + el.y + '%;width:' + el.width + '%;z-index:' + (el.zIndex || 1) + ';';
                if (el.font) style += 'font-family:' + (FONT_FAMILY_MAP[el.font] || el.font) + ';';
                if (el.fontSize) style += 'font-size:' + el.fontSize + 'px;';
                if (el.color) style += 'color:' + el.color + ';';
                if (el.align) style += 'text-align:' + el.align + ';';
                var selected = el.id === editorState.selectedElementId ? ' is-selected' : '';
                if (el.type === 'image') {
                    return renderCanvasImageElement(el, selected);
                }
                if (el.type === 'title') {
                    return '<div class="visual-canvas-element is-title' + selected + '" data-el-id="' + escapeHtml(el.id) + '" style="' + style + '">' + escapeHtml(el.content || '') + '</div>';
                }
                return '<div class="visual-canvas-element is-text' + selected + '" data-el-id="' + escapeHtml(el.id) + '" style="' + style + '">' + String(el.content || '') + '</div>';
            }).join('');
            if (!options.skipInspector) {
                paintInspector();
            }
        }

        function pageInspectorHasFocusedField() {
            var active = document.activeElement;
            return !!(active && inspector && inspector.contains(active) && (
                active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT'
            ));
        }

        function paintInspector(force) {
            var el = getSelectedElement(page);
            if (!el) {
                inspector.innerHTML = '<h4>Element settings</h4><p class="visual-inspector-empty">Click an element on the canvas, or add a new title, text block, or image.</p>';
                inspector.dataset.pageSelection = '';
                return;
            }
            if (!force && pageInspectorHasFocusedField() && inspector.dataset.pageSelection === el.id) {
                return;
            }
            inspector.dataset.pageSelection = el.id;

            if (el.type === 'image') {
                var imgApi = getCmsImagesApi();
                if (imgApi) {
                    var normalized = imgApi.normalizeImageFields(el);
                    Object.assign(el, normalized);
                }
                var shape = el.shape || 'rounded';
                inspector.innerHTML = [
                    '<h4>Edit image</h4>',
                    imgApi ? imgApi.inspectorPreviewHtml(el) : '',
                    '<input type="file" accept="image/*" data-el-upload style="display:none;">',
                    '<button type="button" class="btn btn-outline" data-el-upload-btn style="margin-bottom:8px;">Upload image</button>',
                    '<label>Image URL<input type="text" data-el-url value="' + escapeHtml(el.url || '') + '" placeholder="https://… or upload above"></label>',
                    '<label>Alt text<input type="text" data-el-alt value="' + escapeHtml(el.alt || '') + '" placeholder="Describe the image"></label>',
                    '<label>Width %<input type="number" min="5" max="100" step="1" data-el-width value="' + el.width + '"></label>',
                    '<label data-el-height-field style="' + (shape === 'circle' ? 'display:none;' : '') + '">Height %<input type="number" min="5" max="95" step="1" data-el-height value="' + (el.height || 28) + '"></label>',
                    '<label>Shape<div class="cms-image-shape-picker">' + (imgApi ? imgApi.shapePickerHtml(shape) : '') + '</div></label>',
                    '<label data-el-radius-field style="' + (shape === 'rounded' ? '' : 'display:none;') + '">Corner radius (px)<input type="number" min="0" max="999" step="1" data-el-radius value="' + (el.borderRadius == null ? 12 : el.borderRadius) + '"></label>',
                    '<label>Image fit<select data-el-fit>' + (imgApi ? imgApi.fitOptionsHtml(el.objectFit || 'cover') : '') + '</select></label>',
                    '<p class="visual-inspector-empty" style="margin:8px 0 0;">Tip: drag the corner handle on the canvas to resize. Circle uses width as diameter.</p>',
                    '<label>Layer<input type="number" min="1" max="20" data-el-z value="' + (el.zIndex || 1) + '"></label>',
                    '<button type="button" class="btn btn-outline" data-el-delete style="margin-top:6px;color:#b91c1c;border-color:#fecaca;">Delete image</button>'
                ].join('');
                bindImageInspector(el);
                return;
            }

            inspector.innerHTML = [
                '<h4>Edit ' + escapeHtml(el.type) + '</h4>',
                '<label>Content<textarea data-el-content>' + escapeHtml(el.content || '') + '</textarea></label>',
                '<label>Width %<input type="number" min="10" max="100" data-el-width value="' + el.width + '"></label>',
                '<label>Font<select data-el-font>' + fontOptionsHtml(el.font || '') + '</select></label>',
                '<label>Size (px)<input type="number" min="10" max="96" data-el-size value="' + el.fontSize + '"></label>',
                '<label>Colour<input type="color" data-el-color value="' + escapeHtml(el.color || '#0f172a') + '"></label>',
                '<label>Align<select data-el-align><option value="left"' + (el.align === 'left' ? ' selected' : '') + '>Left</option><option value="center"' + (el.align === 'center' ? ' selected' : '') + '>Center</option><option value="right"' + (el.align === 'right' ? ' selected' : '') + '>Right</option></select></label>',
                '<label>Layer<input type="number" min="1" max="20" data-el-z value="' + (el.zIndex || 1) + '"></label>',
                '<button type="button" class="btn btn-outline" data-el-delete style="margin-top:6px;color:#b91c1c;border-color:#fecaca;">Delete element</button>'
            ].join('');

            var contentInput = inspector.querySelector('[data-el-content]');
            if (contentInput) {
                contentInput.addEventListener('input', function (e) {
                    el.content = e.target.value;
                    paintCanvas({ skipInspector: true });
                });
            }
            inspector.querySelector('[data-el-width]')?.addEventListener('input', function (e) {
                el.width = parseFloat(e.target.value) || el.width;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-font]')?.addEventListener('change', function (e) {
                el.font = e.target.value;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-size]')?.addEventListener('input', function (e) {
                el.fontSize = parseInt(e.target.value, 10) || el.fontSize;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-color]')?.addEventListener('input', function (e) {
                el.color = e.target.value;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-align]')?.addEventListener('change', function (e) {
                el.align = e.target.value;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-z]')?.addEventListener('input', function (e) {
                el.zIndex = parseInt(e.target.value, 10) || 1;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-delete]')?.addEventListener('click', function () {
                page.elements = (page.elements || []).filter(function (item) { return item.id !== el.id; });
                editorState.selectedElementId = '';
                paintCanvas();
            });
        }

        function bindImageInspector(el) {
            var imgApi = getCmsImagesApi();

            function applyImageShape(shape) {
                el.shape = shape;
                if (shape === 'rectangle') el.borderRadius = 0;
                if (shape === 'rounded' && (!el.borderRadius || el.borderRadius < 1)) el.borderRadius = 12;
                if (shape === 'pill') el.borderRadius = 9999;
                if (shape === 'circle' && imgApi) {
                    var n = imgApi.normalizeImageFields(el);
                    el.height = n.width;
                }
            }

            function toggleImageFields() {
                var shape = el.shape || 'rounded';
                var heightField = inspector.querySelector('[data-el-height-field]');
                var radiusField = inspector.querySelector('[data-el-radius-field]');
                if (heightField) heightField.style.display = shape === 'circle' ? 'none' : '';
                if (radiusField) radiusField.style.display = shape === 'rounded' ? '' : 'none';
            }

            function syncImagePreview() {
                var preview = inspector.querySelector('.cms-image-inspector-preview');
                if (!preview || !imgApi) return;
                preview.outerHTML = imgApi.inspectorPreviewHtml(el);
            }

            var urlInput = inspector.querySelector('[data-el-url]');
            if (urlInput) {
                urlInput.addEventListener('input', function (e) {
                    el.url = e.target.value;
                    syncImagePreview();
                    paintCanvas({ skipInspector: true });
                });
            }
            inspector.querySelector('[data-el-alt]')?.addEventListener('input', function (e) {
                el.alt = e.target.value;
            });
            inspector.querySelector('[data-el-width]')?.addEventListener('input', function (e) {
                el.width = parseFloat(e.target.value) || el.width;
                if (el.shape === 'circle') el.height = el.width;
                syncImagePreview();
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-height]')?.addEventListener('input', function (e) {
                el.height = parseFloat(e.target.value) || el.height;
                syncImagePreview();
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelectorAll('[data-el-shape-pick]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    applyImageShape(btn.getAttribute('data-el-shape-pick') || 'rounded');
                    inspector.querySelectorAll('[data-el-shape-pick]').forEach(function (pick) {
                        pick.classList.toggle('is-selected', pick === btn);
                    });
                    toggleImageFields();
                    syncImagePreview();
                    paintCanvas({ skipInspector: true });
                });
            });
            inspector.querySelector('[data-el-radius]')?.addEventListener('input', function (e) {
                el.borderRadius = parseInt(e.target.value, 10) || 0;
                el.shape = 'rounded';
                inspector.querySelectorAll('[data-el-shape-pick]').forEach(function (pick) {
                    pick.classList.toggle('is-selected', pick.getAttribute('data-el-shape-pick') === 'rounded');
                });
                syncImagePreview();
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-fit]')?.addEventListener('change', function (e) {
                el.objectFit = e.target.value;
                syncImagePreview();
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-z]')?.addEventListener('input', function (e) {
                el.zIndex = parseInt(e.target.value, 10) || 1;
                paintCanvas({ skipInspector: true });
            });
            inspector.querySelector('[data-el-delete]')?.addEventListener('click', function () {
                page.elements = (page.elements || []).filter(function (item) { return item.id !== el.id; });
                editorState.selectedElementId = '';
                paintCanvas();
            });
            var uploadBtn = inspector.querySelector('[data-el-upload-btn]');
            var uploadInput = inspector.querySelector('[data-el-upload]');
            if (uploadBtn && uploadInput) {
                uploadBtn.addEventListener('click', function () { uploadInput.click(); });
                uploadInput.addEventListener('change', function (e) {
                    var file = e.target.files && e.target.files[0];
                    if (!file) return;
                    uploadImage(file).then(function (url) {
                        el.url = url;
                        if (urlInput) urlInput.value = url;
                        syncImagePreview();
                        paintCanvas({ skipInspector: true });
                    }).catch(function (err) {
                        window.alert(err && err.message ? err.message : 'Image upload failed.');
                    });
                });
            }
            toggleImageFields();
        }

        function addElement(type) {
            syncPageMeta();
            var el = makeElement(type, 12, 12 + (page.elements.length * 8));
            page.elements.push(el);
            editorState.selectedElementId = el.id;
            if (type === 'image') {
                var input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = function () {
                    var file = input.files && input.files[0];
                    if (!file) return;
                    uploadImage(file).then(function (url) {
                        el.url = url;
                        paintCanvas({ skipInspector: true });
                    }).catch(function (err) {
                        window.alert(err && err.message ? err.message : 'Image upload failed.');
                    });
                };
                input.click();
            }
            paintCanvas();
        }

        function showPlacementMenu(clientX, clientY, percentX, percentY) {
            var existing = root.querySelector('.visual-placement-menu');
            if (existing) existing.remove();

            var menu = document.createElement('div');
            menu.className = 'visual-placement-menu';
            menu.innerHTML = [
                '<span class="visual-placement-menu-label">Add here</span>',
                '<button type="button" data-place="title">Title</button>',
                '<button type="button" data-place="text">Text</button>',
                '<button type="button" data-place="image">Image</button>'
            ].join('');
            menu.style.left = clientX + 'px';
            menu.style.top = clientY + 'px';
            document.body.appendChild(menu);

            function closeMenu() {
                menu.remove();
                document.removeEventListener('click', onDocClick, true);
            }

            function onDocClick(e) {
                if (!menu.contains(e.target)) closeMenu();
            }

            setTimeout(function () {
                document.addEventListener('click', onDocClick, true);
            }, 0);

            menu.querySelectorAll('[data-place]').forEach(function (btn) {
                btn.addEventListener('click', function (e) {
                    e.stopPropagation();
                    var type = btn.getAttribute('data-place');
                    closeMenu();
                    syncPageMeta();
                    var el = makeElement(type, percentX, percentY);
                    page.elements.push(el);
                    editorState.selectedElementId = el.id;
                    if (type === 'image') {
                        var input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = function () {
                            var file = input.files && input.files[0];
                            if (!file) return;
                            uploadImage(file).then(function (url) {
                                el.url = url;
                                paintCanvas();
                            });
                        };
                        input.click();
                    }
                    paintCanvas();
                });
            });
        }

        function updateCanvasSelectionClasses(selectedId) {
            canvas.querySelectorAll('[data-el-id]').forEach(function (node) {
                node.classList.toggle('is-selected', node.getAttribute('data-el-id') === selectedId);
            });
        }

        var canvasPointerId = null;
        var suppressCanvasClick = false;

        function clearCanvasPointerHandlers() {
            window.removeEventListener('pointermove', onCanvasPointerMove);
            window.removeEventListener('pointerup', finishCanvasPointer);
            window.removeEventListener('pointercancel', finishCanvasPointer);
        }

        function armCanvasPointerHandlers() {
            clearCanvasPointerHandlers();
            window.addEventListener('pointermove', onCanvasPointerMove, { passive: false });
            window.addEventListener('pointerup', finishCanvasPointer);
            window.addEventListener('pointercancel', finishCanvasPointer);
        }

        function finishCanvasPointer(e) {
            if (canvasPointerId != null && e && e.pointerId != null && e.pointerId !== canvasPointerId) {
                return;
            }
            clearCanvasPointerHandlers();
            if (resizeState) {
                resizeState = null;
                canvas.classList.remove('is-resizing-image');
                canvasPointerId = null;
                syncPageMeta();
                paintCanvas({ skipInspector: true });
                return;
            }
            if (!dragState) {
                canvasPointerId = null;
                return;
            }
            var didMove = !!dragState.moved;
            suppressCanvasClick = didMove;
            dragState = null;
            canvasPointerId = null;
            canvas.classList.remove('is-dragging');
            syncPageMeta();
            if (didMove) {
                paintCanvas({ skipInspector: true });
            } else {
                paintCanvas();
            }
        }

        function onCanvasPointerMove(e) {
            if (canvasPointerId != null && e.pointerId !== canvasPointerId) return;
            if (resizeState) {
                var dw = ((e.clientX - resizeState.startX) / resizeState.canvasW) * 100;
                var dh = ((e.clientY - resizeState.startY) / resizeState.canvasH) * 100;
                var el = resizeState.el;
                el.width = Math.max(5, Math.min(100, resizeState.origW + dw));
                if (el.shape === 'circle') {
                    el.height = el.width;
                } else {
                    el.height = Math.max(5, Math.min(95, resizeState.origH + dh));
                }
                syncCanvasElementDom(el);
                return;
            }
            if (!dragState) return;
            var dx = ((e.clientX - dragState.startX) / dragState.width) * 100;
            var dy = ((e.clientY - dragState.startY) / dragState.height) * 100;
            if (Math.abs(e.clientX - dragState.startX) > 4 || Math.abs(e.clientY - dragState.startY) > 4) {
                dragState.moved = true;
            }
            dragState.el.x = Math.max(0, Math.min(95, dragState.origX + dx));
            dragState.el.y = Math.max(0, Math.min(95, dragState.origY + dy));
            syncCanvasElementDom(dragState.el);
        }

        canvas.addEventListener('pointerdown', function (e) {
            if (e.target.closest('[data-image-resize-handle]')) {
                e.preventDefault();
                e.stopPropagation();
                var handle = e.target.closest('[data-image-resize-handle]');
                var elId = handle.getAttribute('data-el-id');
                var el = (page.elements || []).find(function (item) { return item.id === elId; });
                if (!el || el.type !== 'image') return;
                editorState.selectedElementId = el.id;
                updateCanvasSelectionClasses(el.id);
                var rect = canvas.getBoundingClientRect();
                canvasPointerId = e.pointerId;
                try {
                    handle.setPointerCapture(e.pointerId);
                } catch (_captureErr) {}
                resizeState = {
                    el: el,
                    startX: e.clientX,
                    startY: e.clientY,
                    origW: el.width || 40,
                    origH: el.height || 28,
                    canvasW: rect.width,
                    canvasH: rect.height
                };
                canvas.classList.add('is-resizing-image');
                armCanvasPointerHandlers();
                return;
            }

            var node = e.target.closest('[data-el-id]');
            if (!node) {
                if (editorState.selectedElementId) {
                    editorState.selectedElementId = '';
                    paintCanvas();
                }
                return;
            }
            e.preventDefault();
            var elId = node.getAttribute('data-el-id');
            var el = (page.elements || []).find(function (item) { return item.id === elId; });
            if (!el) return;
            editorState.selectedElementId = el.id;
            updateCanvasSelectionClasses(el.id);
            var rect = canvas.getBoundingClientRect();
            canvasPointerId = e.pointerId;
            try {
                node.setPointerCapture(e.pointerId);
            } catch (_captureErr2) {}
            dragState = {
                el: el,
                startX: e.clientX,
                startY: e.clientY,
                origX: el.x,
                origY: el.y,
                width: rect.width,
                height: rect.height,
                moved: false
            };
            canvas.classList.add('is-dragging');
            paintInspector();
            armCanvasPointerHandlers();
        });

        canvas.addEventListener('click', function (e) {
            if (suppressCanvasClick) {
                suppressCanvasClick = false;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (dragState && dragState.moved) {
                return;
            }
            var node = e.target.closest('[data-el-id]');
            if (node) {
                return;
            }
            if (e.target !== canvas && e.target.closest('[data-visual-canvas]') !== canvas) {
                return;
            }
            var rect = canvas.getBoundingClientRect();
            var percentX = Math.max(0, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
            var percentY = Math.max(0, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
            showPlacementMenu(e.clientX, e.clientY, percentX, percentY);
        });

        canvas.addEventListener('dblclick', function (e) {
            var node = e.target.closest('[data-el-id]');
            if (!node) return;
            var elId = node.getAttribute('data-el-id');
            var el = (page.elements || []).find(function (item) { return item.id === elId; });
            if (!el || el.type === 'image') return;
            var next = window.prompt('Edit content (HTML allowed for text blocks):', el.content || '');
            if (next != null) {
                el.content = next;
                paintCanvas();
            }
        });

        canvasDragCleanup = function () {
            clearCanvasPointerHandlers();
            dragState = null;
            resizeState = null;
            canvasPointerId = null;
            suppressCanvasClick = false;
        };

        root.querySelector('[data-page-select]').addEventListener('change', function (e) {
            syncPageMeta();
            editorState.selectedPageId = e.target.value;
            editorState.selectedElementId = '';
            editorState.activeTab = 'pages';
            renderVisualPagesPanel(root);
        });
        root.querySelector('[data-page-slug]').addEventListener('input', syncPageMeta);
        root.querySelector('[data-page-visible]').addEventListener('change', syncPageMeta);
        root.querySelector('[data-page-height]').addEventListener('input', function () {
            syncPageMeta();
            paintCanvas();
        });
        root.querySelector('[data-add-title]').addEventListener('click', function () { addElement('title'); });
        root.querySelector('[data-add-text]').addEventListener('click', function () { addElement('text'); });
        root.querySelector('[data-add-image]').addEventListener('click', function () { addElement('image'); });
        root.querySelector('[data-edit-navbar]').addEventListener('click', function () {
            var editor = root.closest('.site-admin-editor');
            editorState.selectedNavbarItem = 'logo';
            switchEditorTab(editor, 'navbar');
            var navbarPanel = editor && editor.querySelector('[data-panel="navbar"]');
            if (navbarPanel) renderNavbarPanel(navbarPanel);
            if (editor) {
                editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });

        iframe.addEventListener('load', function () {
            scrollPreviewToPage(iframe, page.slug || page.id);
        });
        scrollPreviewToPage(iframe, page.slug || page.id);

        paintCanvas();
    }

    function renderPagesPanel(root) {
        renderVisualPagesPanel(root);
    }

    function renderEditor(mount) {
        var activeTab = editorState.activeTab || 'navbar';

        mount.innerHTML = [
            '<div class="site-admin-editor" data-site-content-build="' + EDITOR_BUILD + '">',
            '<p class="muted-text" style="margin:0 0 12px;">Click elements to edit them — navbar, footer, and page content work like a visual site builder. Save when you&apos;re done.</p>',
            '<div class="site-admin-tabs">',
            '<button type="button" class="site-admin-tab' + (activeTab === 'navbar' ? ' is-active' : '') + '" data-tab="navbar">Navbar</button>',
            '<button type="button" class="site-admin-tab' + (activeTab === 'footer' ? ' is-active' : '') + '" data-tab="footer">Footer</button>',
            '<button type="button" class="site-admin-tab' + (activeTab === 'pages' ? ' is-active' : '') + '" data-tab="pages">Visual page builder</button>',
            '</div>',
            '<div class="site-admin-panel' + (activeTab === 'navbar' ? ' is-active' : '') + '" data-panel="navbar"></div>',
            '<div class="site-admin-panel' + (activeTab === 'footer' ? ' is-active' : '') + '" data-panel="footer"></div>',
            '<div class="site-admin-panel' + (activeTab === 'pages' ? ' is-active' : '') + '" data-panel="pages"></div>',
            '<div class="site-admin-actions">',
            '<button type="button" class="btn btn-primary" data-site-save>Save site content</button>',
            '<a href="page.html" target="_blank" rel="noopener" class="btn btn-outline">Preview page</a>',
            '</div>',
            '<div class="site-admin-status" data-site-admin-status></div>',
            '</div>'
        ].join('');

        var statusEl = mount.querySelector('[data-site-admin-status]');
        var panels = {
            navbar: mount.querySelector('[data-panel="navbar"]'),
            footer: mount.querySelector('[data-panel="footer"]'),
            pages: mount.querySelector('[data-panel="pages"]')
        };

        renderNavbarPanel(panels.navbar);
        renderFooterPanel(panels.footer);
        renderPagesPanel(panels.pages);

        mount.querySelectorAll('[data-tab]').forEach(function (tab) {
            tab.addEventListener('click', function () {
                switchEditorTab(mount, tab.getAttribute('data-tab'));
            });
        });

        mount.querySelector('[data-site-save]').addEventListener('click', function () {
            try {
                saveContent(statusEl);
            } catch (err) {
                setStatus(statusEl, err && err.message ? err.message : 'Save failed.', true);
            }
        });
    }

    window.initSiteContentAdmin = function initSiteContentAdmin(mountEl) {
        if (!mountEl) return;
        try {
            loadContent();
            renderEditor(mountEl);
        } catch (err) {
            mountEl.innerHTML = '<div class="empty-inventory">' + escapeHtml(err && err.message ? err.message : 'Unable to load site content editor.') + '</div>';
        }
    };
})();
