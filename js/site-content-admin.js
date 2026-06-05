(function () {
    'use strict';

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
        selectedPageId: 'about'
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

    function renderPagesPanel(root) {
        var pages = editorState.content.pages || {};
        var pageIds = Object.keys(pages);
        var page = getSelectedPage();
        var htmlBlock = (page.blocks || []).find(function (b) { return b && b.type === 'html'; }) || { type: 'html', content: '' };

        var pageOptions = pageIds.map(function (id) {
            var p = pages[id];
            return '<option value="' + escapeHtml(id) + '" ' + (id === editorState.selectedPageId ? 'selected' : '') + '>' + escapeHtml(p.title || id) + '</option>';
        }).join('');

        var fontOptions = function (selected) {
            return FONT_OPTIONS.map(function (opt) {
                return '<option value="' + escapeHtml(opt.id) + '" ' + (opt.id === selected ? 'selected' : '') + '>' + escapeHtml(opt.label) + '</option>';
            }).join('');
        };

        root.innerHTML = [
            '<div class="site-admin-card">',
            '<div class="site-admin-row">',
            '<label>Page<select data-page-select>' + pageOptions + '</select></label>',
            '<label>Section ID / anchor<input type="text" data-page-slug value="' + escapeHtml(page.slug || page.id || '') + '"></label>',
            '<label style="flex-direction:row;align-items:center;gap:6px;margin-top:22px;"><input type="checkbox" data-page-visible ' + (page.visible !== false ? 'checked' : '') + '> Visible on site</label>',
            '</div>',
            '<div class="site-admin-row">',
            '<label>Page title<input type="text" data-page-title value="' + escapeHtml(page.title || '') + '"></label>',
            '<label>Subtitle<input type="text" data-page-subtitle value="' + escapeHtml(page.subtitle || '') + '"></label>',
            '</div>',
            '<div class="site-admin-row">',
            '<label>Heading font<select data-page-heading-font>' + fontOptions(page.headingFont || '') + '</select></label>',
            '<label>Body font<select data-page-body-font>' + fontOptions(page.bodyFont || '') + '</select></label>',
            '</div>',
            '<label>Hero image URL<input type="text" data-page-hero value="' + escapeHtml(page.heroImage || '') + '"></label>',
            '<div style="margin:8px 0;"><input type="file" accept="image/*" data-page-hero-upload style="display:none;"><button type="button" class="btn btn-outline" data-page-hero-upload-btn>Upload hero image</button></div>',
            '<div class="site-admin-toolbar" data-rich-toolbar>',
            '<button type="button" data-cmd="bold">Bold</button>',
            '<button type="button" data-cmd="italic">Italic</button>',
            '<button type="button" data-cmd="underline">Underline</button>',
            '<button type="button" data-cmd="insertUnorderedList">Bullet list</button>',
            '<button type="button" data-cmd="formatBlock" data-value="h3">Heading</button>',
            '<button type="button" data-cmd="createLink">Link</button>',
            '<button type="button" data-cmd="insertImage">Image</button>',
            '</div>',
            '<div class="site-admin-rich" contenteditable="true" data-page-editor>' + String(htmlBlock.content || '') + '</div>',
            '<button type="button" class="btn btn-outline" data-add-image-block style="margin-top:8px;">Add image block below text</button>',
            '</div>'
        ].join('');

        var editor = root.querySelector('[data-page-editor]');
        var toolbar = root.querySelector('[data-rich-toolbar]');
        bindRichToolbar(toolbar, editor);

        function syncPageFromForm() {
            page.title = root.querySelector('[data-page-title]').value;
            page.subtitle = root.querySelector('[data-page-subtitle]').value;
            page.slug = root.querySelector('[data-page-slug]').value || page.id;
            page.headingFont = root.querySelector('[data-page-heading-font]').value;
            page.bodyFont = root.querySelector('[data-page-body-font]').value;
            page.heroImage = root.querySelector('[data-page-hero]').value;
            page.visible = root.querySelector('[data-page-visible]').checked;
            htmlBlock.content = editor.innerHTML;
            page.blocks = [htmlBlock].concat((page.blocks || []).filter(function (b) { return b && b.type === 'image'; }));
            pages[editorState.selectedPageId] = page;
            editorState.content.pages = pages;
        }

        root.querySelector('[data-page-select]').addEventListener('change', function (e) {
            syncPageFromForm();
            editorState.selectedPageId = e.target.value;
            renderPagesPanel(root);
        });
        ['[data-page-title]', '[data-page-subtitle]', '[data-page-slug]', '[data-page-heading-font]', '[data-page-body-font]', '[data-page-hero]'].forEach(function (sel) {
            root.querySelector(sel).addEventListener('input', syncPageFromForm);
            root.querySelector(sel).addEventListener('change', syncPageFromForm);
        });
        root.querySelector('[data-page-visible]').addEventListener('change', syncPageFromForm);
        editor.addEventListener('input', syncPageFromForm);

        root.querySelector('[data-page-hero-upload-btn]').addEventListener('click', function () {
            root.querySelector('[data-page-hero-upload]').click();
        });
        root.querySelector('[data-page-hero-upload]').addEventListener('change', function (e) {
            var file = e.target.files && e.target.files[0];
            if (!file) return;
            uploadImage(file).then(function (url) {
                root.querySelector('[data-page-hero]').value = url;
                syncPageFromForm();
            }).catch(function (err) {
                window.alert(err && err.message ? err.message : 'Upload failed.');
            });
        });

        root.querySelector('[data-add-image-block]').addEventListener('click', function () {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = function () {
                var file = input.files && input.files[0];
                if (!file) return;
                uploadImage(file).then(function (url) {
                    page.blocks = page.blocks || [];
                    page.blocks.push({ type: 'image', url: url, caption: '', alt: page.title || '' });
                    pages[editorState.selectedPageId] = page;
                    syncPageFromForm();
                    setStatus(root.closest('.site-admin-editor').querySelector('[data-site-admin-status]'), 'Image block added. Save to publish.', false);
                });
            };
            input.click();
        });
    }

    function renderEditor(mount) {
        mount.innerHTML = [
            '<div class="site-admin-editor">',
            '<p class="muted-text" style="margin:0 0 12px;">Edit navbar links, footer columns, and page content shown on the landing site. Use the rich editor for text, links, and images.</p>',
            '<div class="site-admin-tabs">',
            '<button type="button" class="site-admin-tab is-active" data-tab="navbar">Navbar</button>',
            '<button type="button" class="site-admin-tab" data-tab="footer">Footer</button>',
            '<button type="button" class="site-admin-tab" data-tab="pages">Page content</button>',
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
                if (editorState.activeTab === 'pages') {
                    var pagesPanel = panels.pages;
                    var editor = pagesPanel.querySelector('[data-page-editor]');
                    if (editor) {
                        var page = getSelectedPage();
                        var htmlBlock = (page.blocks || []).find(function (b) { return b && b.type === 'html'; }) || { type: 'html', content: '' };
                        htmlBlock.content = editor.innerHTML;
                        page.blocks = [htmlBlock].concat((page.blocks || []).filter(function (b) { return b && b.type === 'image'; }));
                        editorState.content.pages[editorState.selectedPageId] = page;
                    }
                }
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
