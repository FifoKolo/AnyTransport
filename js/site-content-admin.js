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
        selectedElementId: ''
    };

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

    function renderNavbarPanel(root) {
        var navbar = editorState.content.navbar || { links: [] };
        var links = navbar.links || [];
        root.innerHTML = [
            '<div class="site-admin-card">',
            '<div class="site-admin-row">',
            '<label>Logo text<input type="text" data-nav-logo-text value="' + escapeHtml(navbar.logoText || '') + '"></label>',
            '<label>Logo image URL<input type="text" data-nav-logo-src value="' + escapeHtml(navbar.logoSrc || '') + '"></label>',
            '</div>',
            '</div>',
            '<div class="site-admin-card">',
            '<h4 style="margin:0 0 10px;">Navbar links</h4>',
            '<div data-nav-links></div>',
            '<button type="button" class="btn btn-outline" data-add-nav-link>Add link</button>',
            '</div>'
        ].join('');

        var linksWrap = root.querySelector('[data-nav-links]');
        function paintLinks() {
            linksWrap.innerHTML = links.map(function (link, idx) {
                return [
                    '<div class="site-admin-link-row" data-nav-index="' + idx + '">',
                    '<label>Label<input type="text" data-field="label" value="' + escapeHtml(link.label || '') + '"></label>',
                    '<label>URL<input type="text" data-field="href" value="' + escapeHtml(link.href || '') + '"></label>',
                    '<label style="flex-direction:row;align-items:center;gap:6px;"><input type="checkbox" data-field="visible" ' + (link.visible !== false ? 'checked' : '') + '> Visible</label>',
                    '<button type="button" class="btn btn-outline" data-remove-nav>Remove</button>',
                    '</div>'
                ].join('');
            }).join('');
        }
        paintLinks();

        root.querySelector('[data-nav-logo-text]').addEventListener('input', function (e) {
            navbar.logoText = e.target.value;
        });
        root.querySelector('[data-nav-logo-src]').addEventListener('input', function (e) {
            navbar.logoSrc = e.target.value;
        });
        root.querySelector('[data-add-nav-link]').addEventListener('click', function () {
            links.push({
                id: 'nav-' + Date.now(),
                label: 'New link',
                href: '#',
                visible: true,
                order: links.length + 1,
                pageId: ''
            });
            paintLinks();
        });
        linksWrap.addEventListener('input', function (e) {
            var row = e.target.closest('[data-nav-index]');
            if (!row) return;
            var idx = parseInt(row.getAttribute('data-nav-index'), 10);
            var field = e.target.getAttribute('data-field');
            if (!field || !links[idx]) return;
            if (field === 'visible') links[idx].visible = e.target.checked;
            else links[idx][field] = e.target.value;
        });
        linksWrap.addEventListener('click', function (e) {
            var removeBtn = e.target.closest('[data-remove-nav]');
            if (!removeBtn) return;
            var row = removeBtn.closest('[data-nav-index]');
            var idx = parseInt(row.getAttribute('data-nav-index'), 10);
            links.splice(idx, 1);
            links.forEach(function (link, i) { link.order = i + 1; });
            paintLinks();
        });
        editorState.content.navbar = navbar;
        navbar.links = links;
    }

    function renderFooterPanel(root) {
        var footer = editorState.content.footer || {};
        var brand = footer.brand || {};
        root.innerHTML = [
            '<div class="site-admin-card">',
            '<h4 style="margin:0 0 10px;">Footer brand</h4>',
            '<div class="site-admin-row">',
            '<label>Logo text<input type="text" data-footer-logo-text value="' + escapeHtml(brand.logoText || '') + '"></label>',
            '<label>Logo URL<input type="text" data-footer-logo-src value="' + escapeHtml(brand.logoSrc || '') + '"></label>',
            '</div>',
            '<label>Description<textarea rows="3" data-footer-description>' + escapeHtml(brand.description || '') + '</textarea></label>',
            '<label>Copyright<input type="text" data-footer-copyright value="' + escapeHtml(footer.copyright || '') + '"></label>',
            '</div>',
            '<div class="site-admin-card" data-footer-columns></div>',
            '<button type="button" class="btn btn-outline" data-add-footer-column>Add footer column</button>'
        ].join('');

        root.querySelector('[data-footer-logo-text]').addEventListener('input', function (e) { brand.logoText = e.target.value; });
        root.querySelector('[data-footer-logo-src]').addEventListener('input', function (e) { brand.logoSrc = e.target.value; });
        root.querySelector('[data-footer-description]').addEventListener('input', function (e) { brand.description = e.target.value; });
        root.querySelector('[data-footer-copyright]').addEventListener('input', function (e) { footer.copyright = e.target.value; });
        footer.brand = brand;
        editorState.content.footer = footer;

        var columnsWrap = root.querySelector('[data-footer-columns]');
        function paintColumns() {
            columnsWrap.innerHTML = (footer.columns || []).map(function (col, cidx) {
                var linksHtml = (col.links || []).map(function (link, lidx) {
                    return [
                        '<div class="site-admin-link-row" data-col="' + cidx + '" data-link="' + lidx + '">',
                        '<label>Label<input type="text" data-field="label" value="' + escapeHtml(link.label || '') + '"></label>',
                        '<label>URL<input type="text" data-field="href" value="' + escapeHtml(link.href || '') + '"></label>',
                        '<label style="flex-direction:row;align-items:center;gap:6px;"><input type="checkbox" data-field="visible" ' + (link.visible !== false ? 'checked' : '') + '> Visible</label>',
                        '<button type="button" class="btn btn-outline" data-remove-link>Remove</button>',
                        '</div>'
                    ].join('');
                }).join('');
                return [
                    '<div class="site-admin-card" style="margin-top:10px;">',
                    '<div class="site-admin-row">',
                    '<label>Column title<input type="text" data-col-title value="' + escapeHtml(col.title || '') + '"></label>',
                    '<button type="button" class="btn btn-outline" data-remove-column>Remove column</button>',
                    '</div>',
                    linksHtml,
                    '<button type="button" class="btn btn-outline" data-add-link data-col="' + cidx + '">Add link</button>',
                    '</div>'
                ].join('');
            }).join('');
        }
        paintColumns();

        root.querySelector('[data-add-footer-column]').addEventListener('click', function () {
            footer.columns = footer.columns || [];
            footer.columns.push({ id: 'col-' + Date.now(), title: 'New column', links: [] });
            paintColumns();
        });
        columnsWrap.addEventListener('input', function (e) {
            var field = e.target.getAttribute('data-field');
            var row = e.target.closest('[data-col]');
            if (!row) return;
            var cidx = parseInt(row.getAttribute('data-col'), 10);
            var lidx = row.hasAttribute('data-link') ? parseInt(row.getAttribute('data-link'), 10) : -1;
            if (e.target.hasAttribute('data-col-title')) {
                footer.columns[cidx].title = e.target.value;
                return;
            }
            if (lidx < 0 || !footer.columns[cidx].links[lidx]) return;
            if (field === 'visible') footer.columns[cidx].links[lidx].visible = e.target.checked;
            else footer.columns[cidx].links[lidx][field] = e.target.value;
        });
        columnsWrap.addEventListener('click', function (e) {
            var addLink = e.target.closest('[data-add-link]');
            if (addLink) {
                var cidx = parseInt(addLink.getAttribute('data-col'), 10);
                footer.columns[cidx].links.push({ id: 'fl-' + Date.now(), label: 'New link', href: '#', visible: true });
                paintColumns();
                return;
            }
            var removeLink = e.target.closest('[data-remove-link]');
            if (removeLink) {
                var row = removeLink.closest('[data-col]');
                var cidx = parseInt(row.getAttribute('data-col'), 10);
                var lidx = parseInt(row.getAttribute('data-link'), 10);
                footer.columns[cidx].links.splice(lidx, 1);
                paintColumns();
                return;
            }
            var removeCol = e.target.closest('[data-remove-column]');
            if (removeCol) {
                var card = removeCol.closest('.site-admin-card');
                var index = Array.prototype.indexOf.call(columnsWrap.children, card);
                footer.columns.splice(index, 1);
                paintColumns();
            }
        });
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
        return page;
    }

    function makeElement(type, x, y) {
        return {
            id: 'el-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            type: type,
            x: x != null ? x : 10,
            y: y != null ? y : 10,
            width: type === 'image' ? 35 : (type === 'title' ? 80 : 55),
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
        var pages = editorState.content.pages || {};
        var pageIds = Object.keys(pages);
        var page = ensurePageElements(getSelectedPage());
        pages[editorState.selectedPageId] = page;

        var pageOptions = pageIds.map(function (id) {
            var p = pages[id];
            return '<option value="' + escapeHtml(id) + '" ' + (id === editorState.selectedPageId ? 'selected' : '') + '>' + escapeHtml(p.title || id) + '</option>';
        }).join('');

        var previewSrc = String(window.location.pathname || '').indexOf('subdomain-dashboard') >= 0 ? '../index.html' : 'index.html';

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

        function syncPageMeta() {
            page.slug = root.querySelector('[data-page-slug]').value || page.id;
            page.visible = root.querySelector('[data-page-visible]').checked;
            page.canvasHeight = parseInt(root.querySelector('[data-page-height]').value, 10) || 520;
            pages[editorState.selectedPageId] = page;
            editorState.content.pages = pages;
        }

        function paintCanvas() {
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
                    return '<div class="visual-canvas-element is-image' + selected + '" data-el-id="' + escapeHtml(el.id) + '" style="' + style + '"><img src="' + escapeHtml(el.url || '') + '" alt=""></div>';
                }
                if (el.type === 'title') {
                    return '<div class="visual-canvas-element is-title' + selected + '" data-el-id="' + escapeHtml(el.id) + '" style="' + style + '">' + escapeHtml(el.content || '') + '</div>';
                }
                return '<div class="visual-canvas-element is-text' + selected + '" data-el-id="' + escapeHtml(el.id) + '" style="' + style + '">' + String(el.content || '') + '</div>';
            }).join('');
            paintInspector();
        }

        function paintInspector() {
            var el = getSelectedElement(page);
            if (!el) {
                inspector.innerHTML = '<h4>Element settings</h4><p class="visual-inspector-empty">Click an element on the canvas, or add a new title, text block, or image.</p>';
                return;
            }
            inspector.innerHTML = [
                '<h4>Edit ' + escapeHtml(el.type) + '</h4>',
                el.type !== 'image'
                    ? '<label>Content<textarea data-el-content>' + escapeHtml(el.content || '') + '</textarea></label>'
                    : '<label>Image URL<input type="text" data-el-url value="' + escapeHtml(el.url || '') + '"></label><label>Alt text<input type="text" data-el-alt value="' + escapeHtml(el.alt || '') + '"></label><input type="file" accept="image/*" data-el-upload style="display:none;"><button type="button" class="btn btn-outline" data-el-upload-btn style="margin-bottom:8px;">Upload image</button>',
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
                    paintCanvas();
                });
            }
            var urlInput = inspector.querySelector('[data-el-url]');
            if (urlInput) {
                urlInput.addEventListener('input', function (e) {
                    el.url = e.target.value;
                    paintCanvas();
                });
            }
            inspector.querySelector('[data-el-alt]')?.addEventListener('input', function (e) {
                el.alt = e.target.value;
            });
            inspector.querySelector('[data-el-width]')?.addEventListener('input', function (e) {
                el.width = parseFloat(e.target.value) || el.width;
                paintCanvas();
            });
            inspector.querySelector('[data-el-font]')?.addEventListener('change', function (e) {
                el.font = e.target.value;
                paintCanvas();
            });
            inspector.querySelector('[data-el-size]')?.addEventListener('input', function (e) {
                el.fontSize = parseInt(e.target.value, 10) || el.fontSize;
                paintCanvas();
            });
            inspector.querySelector('[data-el-color]')?.addEventListener('input', function (e) {
                el.color = e.target.value;
                paintCanvas();
            });
            inspector.querySelector('[data-el-align]')?.addEventListener('change', function (e) {
                el.align = e.target.value;
                paintCanvas();
            });
            inspector.querySelector('[data-el-z]')?.addEventListener('input', function (e) {
                el.zIndex = parseInt(e.target.value, 10) || 1;
                paintCanvas();
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
                        paintCanvas();
                    });
                });
            }
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
                        paintCanvas();
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

        canvas.addEventListener('mousedown', function (e) {
            var node = e.target.closest('[data-el-id]');
            if (!node) {
                if (e.target === canvas || e.target.closest('[data-visual-canvas]') === canvas) {
                    var rect = canvas.getBoundingClientRect();
                    var percentX = Math.max(0, Math.min(92, ((e.clientX - rect.left) / rect.width) * 100));
                    var percentY = Math.max(0, Math.min(92, ((e.clientY - rect.top) / rect.height) * 100));
                    showPlacementMenu(e.clientX, e.clientY, percentX, percentY);
                }
                editorState.selectedElementId = '';
                paintCanvas();
                return;
            }
            e.preventDefault();
            var elId = node.getAttribute('data-el-id');
            var el = (page.elements || []).find(function (item) { return item.id === elId; });
            if (!el) return;
            editorState.selectedElementId = el.id;
            paintCanvas();
            var rect = canvas.getBoundingClientRect();
            dragState = {
                el: el,
                startX: e.clientX,
                startY: e.clientY,
                origX: el.x,
                origY: el.y,
                width: rect.width,
                height: rect.height
            };
            canvas.classList.add('is-dragging');
        });

        window.addEventListener('mousemove', function onMove(e) {
            if (!dragState) return;
            var dx = ((e.clientX - dragState.startX) / dragState.width) * 100;
            var dy = ((e.clientY - dragState.startY) / dragState.height) * 100;
            dragState.el.x = Math.max(0, Math.min(95, dragState.origX + dx));
            dragState.el.y = Math.max(0, Math.min(95, dragState.origY + dy));
            paintCanvas();
        });

        window.addEventListener('mouseup', function onUp() {
            if (!dragState) return;
            dragState = null;
            canvas.classList.remove('is-dragging');
            syncPageMeta();
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

        root.querySelector('[data-page-select]').addEventListener('change', function (e) {
            syncPageMeta();
            editorState.selectedPageId = e.target.value;
            editorState.selectedElementId = '';
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
        mount.innerHTML = [
            '<div class="site-admin-editor">',
            '<p class="muted-text" style="margin:0 0 12px;">Edit navbar and footer links, then use the visual page builder to place titles, text, and images anywhere on each page section.</p>',
            '<div class="site-admin-tabs">',
            '<button type="button" class="site-admin-tab is-active" data-tab="navbar">Navbar</button>',
            '<button type="button" class="site-admin-tab" data-tab="footer">Footer</button>',
            '<button type="button" class="site-admin-tab" data-tab="pages">Visual page builder</button>',
            '</div>',
            '<div class="site-admin-panel is-active" data-panel="navbar"></div>',
            '<div class="site-admin-panel" data-panel="footer"></div>',
            '<div class="site-admin-panel" data-panel="pages"></div>',
            '<div class="site-admin-actions">',
            '<button type="button" class="btn btn-primary" data-site-save>Save site content</button>',
            '<a href="index.html" target="_blank" rel="noopener" class="btn btn-outline">Preview homepage</a>',
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
                var key = tab.getAttribute('data-tab');
                editorState.activeTab = key;
                mount.querySelectorAll('[data-tab]').forEach(function (t) {
                    t.classList.toggle('is-active', t.getAttribute('data-tab') === key);
                });
                Object.keys(panels).forEach(function (panelKey) {
                    panels[panelKey].classList.toggle('is-active', panelKey === key);
                });
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
