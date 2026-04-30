(function () {
    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const params = new URLSearchParams(window.location.search);
        let userId = String(params.get('userId') || params.get('id') || params.get('provider') || '').trim();

        // Fallback: if no userId was provided in the URL, use the current logged-in user (owner)
        if (!userId) {
            try {
                const viewer = getViewer();
                if (viewer && viewer.id) {
                    userId = String(viewer.id);
                }
            } catch (e) {
                // ignore
            }
        }

        if (!userId) {
            renderError('No provider specified.');
            return;
        }

        loadProvider(userId).then(function (user) {
            if (!user) {
                renderError('Provider not found.');
                return;
            }
            renderProvider(user);
        }).catch(function (err) {
            console.error(err);
            renderError('Failed to load provider.');
        });
    }

    // Expose a helper to render a compact profile into any container (used by dashboard)
    window.renderProviderProfileInto = function (containerId, userId) {
        const root = document.getElementById(containerId);
        if (!root) return Promise.reject(new Error('Container not found'));

        function buildCompactHtml(u) {
            const name = escapeHtml(firstText(u.businessName, u.name, u.nickname, u.username, u.email));
            const role = escapeHtml(u.role ? capitalize(String(u.role)) : 'Provider');
            const city = escapeHtml(firstText(u.city, u.town, u.location, 'Not provided'));
            const contactVal = revealContact(u);
            const contact = escapeHtml(firstText(contactVal || 'Not provided'));
            const about = escapeHtml(firstText(u.description, u.businessDescription, u.about, 'No description provided.'));
            const services = Array.isArray(u.services) && u.services.length ? '<ul>' + u.services.map(s => '<li>' + escapeHtml(s) + '</li>').join('') + '</ul>' : 'Not provided';
            const initial = escapeHtml(String((u.name || '').toString().charAt(0) || 'P'));
            return '<div class="provider-card">' +
                '<div style="display:flex;gap:12px;align-items:center;">' +
                '<div style="width:64px;height:64px;border-radius:6px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:20px;">' + initial + '</div>' +
                '<div><strong>' + name + '</strong><div style="color:#666;font-size:13px;">' + role + '</div></div>' +
                '</div>' +
                '<div style="margin-top:12px;"><span class="label">Location</span><div class="profile-value">' + city + '</div></div>' +
                '<div style="margin-top:8px;"><span class="label">Contact</span><div class="profile-value">' + contact + '</div></div>' +
                '<div style="margin-top:8px;"><span class="label">About</span><div class="profile-value">' + about + '</div></div>' +
                '<div style="margin-top:8px;"><span class="label">Services</span><div class="profile-value">' + services + '</div></div>' +
                '</div>';
        }

        // reuse anytransportApi if available
        if (window.anytransportApi && typeof window.anytransportApi.getUsers === 'function') {
            try {
                const users = window.anytransportApi.getUsers();
                const u = users.find(u => String(u.id) === String(userId));
                if (!u) {
                    root.innerHTML = '<div class="empty-inventory">Profile not found.</div>';
                    return Promise.resolve(null);
                }
                root.innerHTML = buildCompactHtml(u);
                return Promise.resolve(u);
            } catch (e) {
                // fallback to fetch
            }
        }

        return fetch('api/index.php?action=users.list').then(function (res) {
            if (!res.ok) throw new Error('Network');
            return res.json();
        }).then(function (payload) {
            const u = payload && Array.isArray(payload.users) ? payload.users.find(function (x) { return String(x.id) === String(userId); }) : null;
            if (!u) {
                root.innerHTML = '<div class="empty-inventory">Profile not found.</div>';
                return null;
            }
            root.innerHTML = buildCompactHtml(u);
            return u;
        }).catch(function (err) {
            root.innerHTML = '<div class="empty-inventory">Unable to load profile.</div>';
            return Promise.reject(err);
        });
    };

    function renderError(msg) {
        const main = document.getElementById('provider-main');
        if (main) main.innerHTML = '<div class="empty-inventory">' + escapeHtml(msg) + '</div>';
    }

    function loadProvider(userId) {
        // Use anytransportApi if available, otherwise call API directly
        if (window.anytransportApi && typeof window.anytransportApi.getUsers === 'function') {
            try {
                const users = window.anytransportApi.getUsers();
                return Promise.resolve(users.find(u => String(u.id) === userId) || null);
            } catch (e) {
                // fallback
            }
        }

        return fetch('api/index.php?action=users.list').then(function (res) {
            if (!res.ok) throw new Error('Network');
            return res.json();
        }).then(function (payload) {
            if (!payload || !Array.isArray(payload.users)) return null;
            return payload.users.find(function (u) { return String(u.id) === userId; }) || null;
        });
    }

    function renderProvider(u) {
        setText('provider-name', firstText(u.businessName, u.name, u.nickname, u.username, u.email));
        setText('provider-role', u.role ? capitalize(String(u.role)) : 'Transport Provider');
        setText('provider-description', firstText(u.description, u.businessDescription, u.about, 'No description provided.'));
        setText('provider-city', firstText(u.city, u.town, u.location, 'Not provided'));
        const contact = revealContact(u) || 'Not provided';
        setText('provider-contact', contact);
        setText('provider-about', firstText(u.bio, u.summary, '—'));

        renderServices(u);
        renderPayments(u);
        renderPhotos(u);
        renderActions(u);
        renderAvatar(u);
        renderEditor(u);
    }

    // Viewer helpers — decide whether to reveal full email or mask
    function getViewer() {
        try {
            if (window.auth && typeof auth.getUser === 'function') return auth.getUser();
            if (window.anytransportApi && typeof anytransportApi.getCurrentUser === 'function') return anytransportApi.getCurrentUser();
        } catch (e) {}
        return null;
    }

    function revealEmail(u) {
        if (!u) return '';
        const viewer = getViewer();
        if (viewer && (String(viewer.id) === String(u.id) || (Array.isArray(viewer.roles) && viewer.roles.includes('admin')) || String(viewer.role) === 'admin')) {
            return u.email || '';
        }
        return obscureEmail(u.email);
    }

    function revealContact(u) {
        if (!u) return '';
        if (u.phone && String(u.phone).trim() !== '') return u.phone;
        if (u.contact && String(u.contact).trim() !== '') return u.contact;
        return revealEmail(u);
    }

    function renderServices(u) {
        const el = document.getElementById('provider-services');
        if (!el) return;
        const services = u.services || u.categories || u.skills || [];
        if (Array.isArray(services) && services.length) {
            el.innerHTML = '<ul>' + services.map(s => '<li>' + escapeHtml(String(s)) + '</li>').join('') + '</ul>';
            return;
        }
        // try to infer from user fields
        const text = firstText(u.service, u.specialities, 'Not provided');
        el.textContent = String(text || 'Not provided');
    }

    function renderPayments(u) {
        const el = document.getElementById('provider-payments');
        if (!el) return;
        const pm = u.paymentMethods || {};
        if (typeof pm === 'object' && Object.keys(pm).length) {
            const parts = [];
            Object.keys(pm).forEach(function (k) { if (pm[k]) parts.push(capitalize(k)); });
            el.textContent = parts.length ? parts.join(', ') : 'Not provided';
            return;
        }
        const inferred = [];
        if (u.acceptsCash) inferred.push('Cash');
        if (u.paypal) inferred.push('PayPal');
        if (u.card || u.visa) inferred.push('Card');
        el.textContent = inferred.length ? inferred.join(', ') : 'Not provided';
    }

    function renderPhotos(u) {
        const root = document.getElementById('provider-photos');
        if (!root) return;
        const photos = u.photos || u.images || u.media || [];
        root.innerHTML = '';
        if (typeof photos === 'string' && photos) {
            addPhoto(root, photos);
            root.removeAttribute('aria-hidden');
            return;
        }
        if (Array.isArray(photos) && photos.length) {
            photos.slice(0,6).forEach(function (p) { addPhoto(root, p); });
            root.removeAttribute('aria-hidden');
            return;
        }
        root.setAttribute('aria-hidden', 'true');
    }

    function addPhoto(root, src) {
        try {
            const img = document.createElement('img');
            img.src = String(src || '').trim();
            img.alt = 'Provider photo';
            root.appendChild(img);
        } catch (e) {}
    }

    function renderActions(u) {
        const root = document.getElementById('provider-actions');
        if (!root) return;
        root.innerHTML = '';

        const reviewStatus = String(u.identityReviewStatus || '').trim();
        const reviewLabel = reviewStatus === 'approved'
            ? 'Verified by AnyTransport'
            : reviewStatus === 'rejected'
                ? 'Identity review rejected'
                : 'Identity review pending';
        const statusBadge = document.createElement('div');
        statusBadge.className = 'profile-value';
        statusBadge.style.marginBottom = '8px';
        statusBadge.textContent = reviewLabel;
        root.appendChild(statusBadge);

        const btnMessage = document.createElement('a');
        btnMessage.className = 'btn btn-outline';
        btnMessage.href = 'messages.html?to=' + encodeURIComponent(u.id);
        btnMessage.textContent = 'Message Provider';
        root.appendChild(btnMessage);

        const btnListings = document.createElement('a');
        btnListings.className = 'btn btn-primary';
        btnListings.href = 'dashboard.html?provider=' + encodeURIComponent(u.id);
        btnListings.textContent = 'View Listings';
        root.appendChild(btnListings);
    }

    function canEditProfile(u) {
        const viewer = getViewer();
        if (!viewer || !u) return false;
        return String(viewer.id) === String(u.id) || String(viewer.role || '').toLowerCase() === 'admin';
    }

    function renderEditor(u) {
        const root = document.getElementById('provider-edit');
        if (!root) return;
        root.innerHTML = '';

        const isEditable = canEditProfile(u);
        const disabledAttr = isEditable ? '' : ' disabled aria-disabled="true"';
        const readOnlyNote = isEditable ? '' : '<div class="profile-section-note"><strong>Read only view.</strong> This profile is public. Sign in as the owner or an admin to edit the details below.</div>';

        const existingPhotos = normalizePhotos(u.photos || u.images || u.media || []);
        const currentAvatar = firstText(u.avatar, existingPhotos[0] || '');
        const paymentMethods = normalizePaymentMethods(u);
        const serviceOptions = [
            'House Removals',
            'Customized Items',
            'Campervan/Car Transport',
            'Piano Transport',
            'Caravan/Trailer Transport',
            'Motorbike Transport',
            'Specialist & Antiques',
            'Vehicle Parts',
            'Freight',
            'Clearance',
            'Boats',
            'Office Removals',
            'Industrial',
            'Man Power Only',
            'Pets',
            'Other'
        ];
        let pendingPhotos = [];

        root.innerHTML = [
            '<div class="profile-editor-shell">',
            '  <div class="profile-editor-header">',
            '    <div>',
            '      <div class="profile-editor-kicker">Profile settings</div>',
            '      <h3 class="profile-editor-title">Edit your public profile</h3>',
            '      <p class="profile-editor-subtitle">Keep your business details, services, payment options, and photos polished. Changes save automatically so your profile stays up to date.</p>',
            readOnlyNote,
            '    </div>',
            '    <div class="profile-editor-badges">',
            '      <span class="profile-pill">Auto-save enabled</span>',
            '      <span class="profile-pill">Public profile</span>',
            '      <span class="profile-pill">Photos supported</span>',
            '    </div>',
            '  </div>',
            '<div class="profile-workspace">',
            '  <div class="profile-workspace-grid">',
            '    <div class="profile-workspace-left">',
            '      <h3 class="profile-section-title">My details</h3>',
            '      <form id="provider-profile-form" class="profile-editor-form">',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Business name:</div>',
            '          <div>',
            '            <input id="profile-business-name" class="form-input" type="text" value="' + escapeAttribute(firstText(u.businessName, u.name, u.nickname, u.username, '')) + '"' + disabledAttr + '>',
            '            <div class="profile-help">Please do not enter company names or contact details in your mission statement or business description.</div>',
            '          </div>',
            '        </div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Business description:</div>',
            '          <div>',
            '            <textarea id="profile-about" class="form-input" rows="7"' + disabledAttr + '>' + escapeHtml(firstText(u.description, u.businessDescription, u.about, u.bio, u.summary, '')) + '</textarea>',
            '            <div class="profile-help">You have 400 words left</div>',
            '          </div>',
            '        </div>',
            '        <div class="profile-form-row profile-upload-card">',
            '          <div class="profile-form-label">Photos</div>',
            '          <div>',
            '            <div class="profile-help">Upload an image, formats accepted are JPEG and GIF (max file size: 8MB)</div>',
            '            <div id="profile-photo-previews"></div>',
            isEditable ? '            <label class="profile-button" for="profile-photo-input" style="cursor:pointer; margin-top:10px;">BROWSE</label>' : '            <span class="profile-button" style="margin-top:10px; opacity:.65; cursor:not-allowed;">BROWSE</span>',
            '            <input id="profile-photo-input" type="file" accept="image/*" multiple style="display:none;"' + disabledAttr + '>',
            '          </div>',
            '        </div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Type of Company</div>',
            '          <div>',
            '            <input id="profile-company-type" class="form-input" type="text" value="' + escapeAttribute(firstText(u.companyType, u.company, u.businessType, 'Sole trader')) + '"' + disabledAttr + '>',
            '          </div>',
            '        </div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Location</div>',
            '          <div><input id="profile-city" class="form-input" type="text" value="' + escapeAttribute(firstText(u.city, u.town, u.location, '')) + '"' + disabledAttr + '></div>',
            '        </div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Contact</div>',
            '          <div><input id="profile-contact" class="form-input" type="text" value="' + escapeAttribute(firstText(u.phone, u.contact, u.email, '')) + '"' + disabledAttr + '></div>',
            '        </div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Website</div>',
            '          <div><input id="profile-website" class="form-input" type="url" value="' + escapeAttribute(firstText(u.website, u.url, '')) + '"' + disabledAttr + '></div>',
            '        </div>',
            '        <div class="profile-footer-actions" aria-hidden="true"></div>',
            '    </div>',
            '    <div class="profile-workspace-right">',
            '      <h3 class="profile-section-title">Payment methods you accept</h3>',
            '      <div class="profile-check-grid">',
            buildCheckbox('cash', 'Cash', paymentMethods.cash),
            buildCheckbox('cheque', 'Cheque', paymentMethods.cheque),
            buildCheckbox('visa', 'Visa card', paymentMethods.visa),
            buildCheckbox('mastercard', 'Mastercard', paymentMethods.mastercard),
            buildCheckbox('paypal', 'Paypal', paymentMethods.paypal),
            buildCheckbox('americanExpress', 'American Express', paymentMethods.americanExpress),
            buildCheckbox('bankTransfer', 'Bank Transfer', paymentMethods.bankTransfer),
            '      </div>',
            '      <h3 class="profile-section-title" style="margin-top:20px;">Jobs you specialise in</h3>',
            '      <div class="profile-muted">Select the categories you specialise in. Please limit to your top 8 (only due to space - it won\'t affect anything). Leaving them blank we will automatically use your job history.</div>',
            '      <div class="profile-check-grid">',
            serviceOptions.map(function (option) {
                return buildCheckbox('service_' + option.replace(/[^a-z0-9]+/ig, '_').toLowerCase(), option, serviceMatches(option, u), ' data-service-label="' + escapeAttribute(option) + '"' + disabledAttr);
            }).join(''),
            '      </div>',
            '      <h3 class="profile-section-title" style="margin-top:20px;">Don\'t want any more invitations to bid?</h3>',
            '      <div class="profile-muted">Please tick here to prevent customers inviting you to quote.</div>',
            '      <div class="profile-check-grid" style="margin-top:14px;">',
            buildCheckbox('blockInvites', 'Stop allowing customers to invite me to jobs', !!u.blockInvites, disabledAttr),
            buildCheckbox('muteEmails', 'Stop sending me job invitation emails, but allow customers to invite me', !!u.muteInviteEmails, disabledAttr),
            '      </div>',
            '      </form>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');

        const form = document.getElementById('provider-profile-form');
        const photoInput = document.getElementById('profile-photo-input');
        const previewRoot = document.getElementById('profile-photo-previews');
        const saveBadge = root.querySelector('.profile-pill');
        const checkboxAutosaveSelectors = [
            'input[type="checkbox"]',
            '#profile-business-name',
            '#profile-about',
            '#profile-company-type',
            '#profile-city',
            '#profile-contact',
            '#profile-website'
        ];

        function renderPhotoPreviews() {
            if (!previewRoot) return;
            const photos = existingPhotos.concat(pendingPhotos).filter(Boolean);
            if (!photos.length) {
                previewRoot.innerHTML = '<div class="profile-upload-preview"><span style="color:#777;">No photos yet</span></div>';
                return;
            }
            previewRoot.innerHTML = photos.map(function (src, index) {
                const label = index === 0 ? 'You' : index === 1 ? 'Your van' : 'Photo ' + (index + 1);
                return [
                    '<div style="margin: 0 0 18px;">',
                    '  <div class="profile-upload-preview"><img src="' + escapeAttribute(src) + '" alt="Profile image ' + (index + 1) + '"><span class="profile-upload-badge" data-remove-photo="' + index + '">×</span></div>',
                    '  <a class="profile-mini-link" href="' + escapeAttribute(src) + '" target="_blank" rel="noopener">View full image</a>',
                    '  <div style="font-weight:700; margin-bottom:8px;">' + escapeHtml(label) + '</div>',
                    '</div>'
                ].join('');
            }).join('');
        }

        function buildPayload() {
            const services = collectCheckedServices();
            const paymentMethods = collectPaymentMethods();
            return {
                id: u.id,
                businessName: String(document.getElementById('profile-business-name')?.value || '').trim(),
                name: String(document.getElementById('profile-business-name')?.value || '').trim(),
                nickname: String(document.getElementById('profile-business-name')?.value || '').trim(),
                username: String(document.getElementById('profile-business-name')?.value || '').trim(),
                companyType: String(document.getElementById('profile-company-type')?.value || '').trim(),
                city: String(document.getElementById('profile-city')?.value || '').trim(),
                location: String(document.getElementById('profile-city')?.value || '').trim(),
                phone: String(document.getElementById('profile-contact')?.value || '').trim(),
                contact: String(document.getElementById('profile-contact')?.value || '').trim(),
                website: String(document.getElementById('profile-website')?.value || '').trim(),
                description: String(document.getElementById('profile-about')?.value || '').trim(),
                about: String(document.getElementById('profile-about')?.value || '').trim(),
                services: services,
                categories: services,
                skills: services,
                paymentMethods: paymentMethods,
                acceptsCash: !!paymentMethods.cash,
                paypal: !!paymentMethods.paypal,
                visa: !!paymentMethods.visa,
                mastercard: !!paymentMethods.mastercard,
                bankTransfer: !!paymentMethods.bankTransfer,
                americanExpress: !!paymentMethods.americanExpress,
                cheque: !!paymentMethods.cheque,
                cash: !!paymentMethods.cash,
                blockInvites: !!document.getElementById('blockInvites')?.checked,
                muteInviteEmails: !!document.getElementById('muteEmails')?.checked,
                avatar: firstText(u.avatar, ''),
                photos: existingPhotos.concat(pendingPhotos).filter(Boolean)
            };
        }

        function setSaveBadge(text, isError) {
            if (!saveBadge) return;
            saveBadge.textContent = text;
            saveBadge.style.background = isError ? '#fee2e2' : '';
            saveBadge.style.color = isError ? '#991b1b' : '';
            saveBadge.style.borderColor = isError ? '#fecaca' : '';
        }

        function saveProfile(options) {
            const payload = buildPayload();
            if (!window.anytransportApi || typeof window.anytransportApi.saveUser !== 'function') {
                return Promise.reject(new Error('Profile saving is not available yet.'));
            }

            setSaveBadge('Saving...', false);
            try {
                console.info('[Provider Profile] autosave payload', {
                    userId: payload.id,
                    services: payload.services,
                    paymentMethods: payload.paymentMethods,
                    blockInvites: payload.blockInvites,
                    muteInviteEmails: payload.muteInviteEmails
                });
            } catch (_err) {}

            return Promise.resolve(window.anytransportApi.saveUser(payload)).then(function () {
                setSaveBadge('Saved just now', false);
                if (!options || !options.silent) {
                    alert('Profile updated successfully.');
                    window.location.reload();
                }
            }).catch(function (error) {
                setSaveBadge('Save failed', true);
                throw error;
            });
        }

        function queueAutosave() {
            if (renderEditor._autosaveTimer) {
                clearTimeout(renderEditor._autosaveTimer);
            }
            renderEditor._autosaveTimer = setTimeout(function () {
                saveProfile({ silent: true }).catch(function (error) {
                    console.error(error);
                });
            }, 150);
        }

        function bindAutosave(node) {
            if (!node) return;
            node.addEventListener('change', function () {
                if (node.tagName === 'INPUT' && node.type === 'checkbox') {
                    saveProfile({ silent: true }).catch(function (error) {
                        console.error(error);
                    });
                    return;
                }
                queueAutosave();
            });
            if ((node.tagName === 'INPUT' && node.type === 'text') || node.tagName === 'TEXTAREA') {
                node.addEventListener('blur', function () {
                    queueAutosave();
                });
            }
        }

        if (photoInput && isEditable) {
            photoInput.addEventListener('change', function () {
                const files = Array.from(photoInput.files || []);
                if (!files.length) return;
                const readers = files.map(function (file) {
                    return readFileAsDataUrl(file);
                });
                Promise.all(readers).then(function (urls) {
                    pendingPhotos = pendingPhotos.concat(urls.filter(Boolean));
                    renderPhotoPreviews();
                    photoInput.value = '';
                    queueAutosave();
                }).catch(function () {
                    alert('One or more images could not be read.');
                });
            });
        }

        if (previewRoot && isEditable) {
            previewRoot.addEventListener('click', function (event) {
                const removeIndex = event.target && event.target.getAttribute ? event.target.getAttribute('data-remove-photo') : '';
                if (removeIndex === null || removeIndex === '') return;
                event.preventDefault();
                const idx = Number(removeIndex);
                const combined = existingPhotos.concat(pendingPhotos).filter(Boolean);
                const updated = combined.filter(function (_src, index) { return index !== idx; });
                existingPhotos.splice(0, existingPhotos.length, ...updated);
                pendingPhotos = [];
                renderPhotoPreviews();
                queueAutosave();
            });
        }

        renderPhotoPreviews();

        if (isEditable) {
            root.querySelectorAll(checkboxAutosaveSelectors.join(',')).forEach(bindAutosave);
        }
        root.addEventListener('change', function (event) {
            if (!isEditable) return;
            const target = event.target;
            if (target && target.matches && target.matches('input[data-service-label], #cash, #cheque, #visa, #mastercard, #paypal, #americanExpress, #bankTransfer, #blockInvites, #muteEmails')) {
                saveProfile({ silent: true }).catch(function (error) {
                    console.error(error);
                });
                return;
            }
            if (event.target && event.target.matches && (event.target.matches('#profile-business-name') || event.target.matches('#profile-about') || event.target.matches('#profile-company-type') || event.target.matches('#profile-city') || event.target.matches('#profile-contact') || event.target.matches('#profile-website'))) {
                queueAutosave();
            }
        });

        if (form && isEditable) {
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                try {
                    saveProfile({ silent: false });
                } catch (error) {
                    alert(error && error.message ? error.message : 'Unable to save profile.');
                }
            });
        }
    }

    function renderAvatar(u) {
        const av = document.getElementById('provider-avatar');
        if (!av) return;
        if (u.avatar || (u.photos && u.photos[0])) {
            av.style.backgroundImage = 'url(' + escapeAttribute(firstText(u.avatar, (Array.isArray(u.photos) && u.photos[0]) || '')) + ')';
            av.textContent = '';
            av.style.backgroundSize = 'cover';
            av.style.backgroundPosition = 'center';
            return;
        }
        av.textContent = (firstText(u.name, u.nickname, u.username, 'P') || 'P').substring(0,1).toUpperCase();
    }

    function normalizePaymentMethods(u) {
        const methods = u && typeof u.paymentMethods === 'object' && u.paymentMethods ? u.paymentMethods : {};
        return {
            cash: !!(methods.cash || u.acceptsCash),
            cheque: !!methods.cheque,
            visa: !!(methods.visa || u.visa),
            mastercard: !!(methods.mastercard || u.mastercard),
            paypal: !!(methods.paypal || u.paypal),
            americanExpress: !!(methods.americanExpress || u.americanExpress),
            bankTransfer: !!(methods.bankTransfer || u.bankTransfer)
        };
    }

    function normalizePhotos(value) {
        if (Array.isArray(value)) return value.map(function (item) { return String(item || '').trim(); }).filter(Boolean);
        if (typeof value === 'string' && value.trim()) return [value.trim()];
        return [];
    }

    function readFileAsDataUrl(file) {
        return new Promise(function (resolve, reject) {
            try {
                const reader = new FileReader();
                reader.onload = function () { resolve(String(reader.result || '')); };
                reader.onerror = function () { reject(new Error('Unable to read file')); };
                reader.readAsDataURL(file);
            } catch (error) {
                reject(error);
            }
        });
    }

    function buildCheckbox(id, label, checked, extraAttrs) {
        return '<label><input type="checkbox" id="' + escapeAttribute(id) + '"' + (checked ? ' checked' : '') + (extraAttrs || '') + '> <span>' + escapeHtml(label) + '</span></label>';
    }

    function serviceMatches(option, u) {
        const values = [];
        // Collect array fields
        if (Array.isArray(u.services)) values.push.apply(values, u.services);
        if (Array.isArray(u.categories)) values.push.apply(values, u.categories);
        if (Array.isArray(u.skills)) values.push.apply(values, u.skills);
        // Also accept legacy string fields (comma/semicolon separated)
        if (typeof u.service === 'string' && u.service.trim()) values.push.apply(values, u.service.split(/[,;]+/).map(function(s){return s.trim();}));
        if (typeof u.specialities === 'string' && u.specialities.trim()) values.push.apply(values, u.specialities.split(/[,;]+/).map(function(s){return s.trim();}));

        const normalizedOption = normalizeServiceLabel(option);
        if (!normalizedOption) return false;

        return values.some(function (entry) {
            const normalizedEntry = normalizeServiceLabel(entry);
            if (!normalizedEntry) return false;
            // exact match
            if (normalizedEntry === normalizedOption) return true;
            // alias map for common synonyms
            const aliases = {
                'house removals': ['home removals'],
                'customized items': ['specialized items', 'custom items'],
                'campervan car transport': ['car campervan transport', 'car transport', 'campervan transport'],
                'piano transport': ['piano'],
                'caravan trailer transport': ['caravan transport', 'trailer transport'],
                'motorbike transport': ['motorbike', 'motorbikes'],
                'man power only': ['manpower only'],
                'specialist antiques': ['specialist and antiques'],
                'vehicle parts': ['vehicle part'],
                'office removals': ['office removal'],
                'industrial': ['industrial removals'],
                'clearance': ['house clearance'],
                'boats': ['boat transport'],
                'pets': ['pet transport']
            };
            const optionAliases = aliases[normalizedOption] || [];
            if (optionAliases.indexOf(normalizedEntry) >= 0) return true;
            return false;
        });
    }

    function normalizeServiceLabel(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/&/g, ' and ')
            .replace(/[^a-z0-9]+/g, ' ')
            .trim();
    }

    function collectCheckedServices() {
        const values = [];
        // Read from the editor container first; DOM auto-correction can move these inputs outside the form element.
        const scoped = document.querySelectorAll('#provider-edit input[data-service-label]:checked');
        const nodes = scoped.length ? scoped : document.querySelectorAll('input[data-service-label]:checked');
        nodes.forEach(function (input) {
            values.push(String(input.getAttribute('data-service-label') || '').trim());
        });
        return values.filter(Boolean);
    }

    function collectPaymentMethods() {
        return {
            cash: !!document.getElementById('cash')?.checked,
            cheque: !!document.getElementById('cheque')?.checked,
            visa: !!document.getElementById('visa')?.checked,
            mastercard: !!document.getElementById('mastercard')?.checked,
            paypal: !!document.getElementById('paypal')?.checked,
            americanExpress: !!document.getElementById('americanExpress')?.checked,
            bankTransfer: !!document.getElementById('bankTransfer')?.checked
        };
    }

    // Utilities
    function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = String(value || ''); }
    function firstText() { for (let i=0;i<arguments.length;i++) { const v = arguments[i]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; }
    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }
    function escapeAttribute(s) { return String(s || '').replace(/"/g,''); }
    function obscureEmail(email) { if (!email) return ''; const parts = String(email).split('@'); if (parts.length !== 2) return email; return parts[0].substring(0,1) + '***@' + parts[1]; }
    function capitalize(s) { if (!s) return ''; return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

})();
