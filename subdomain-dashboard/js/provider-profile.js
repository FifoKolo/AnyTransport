(function () {
    const STANDARD_TRANSPORT_MODES = ['Car', 'Motorbike', 'Bicycle', 'Van', 'Truck', 'Trailer'];
    const STANDARD_PAYMENT_METHOD_KEYS = ['cash', 'cheque', 'visa', 'mastercard', 'paypal', 'americanExpress', 'bankTransfer', 'revolut'];
    let editorCustomTransportModes = [];

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
            const transportModes = getTransportModes(u);
            const transportModesHtml = transportModes.length
                ? '<div style="display:flex; gap:6px; flex-wrap:wrap;">' + transportModes.map(function (mode) {
                    return '<span class="provider-transport-chip">' + escapeHtml(mode) + '</span>';
                }).join('') + '</div>'
                : 'Not provided';
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
                '<div style="margin-top:8px;"><span class="label">Modes of transport</span><div class="profile-value">' + transportModesHtml + '</div></div>' +
                '</div>';
        }

        const syncUser = resolveUserRecordSync(userId);
        if (syncUser) {
            root.innerHTML = buildCompactHtml(syncUser);
            return Promise.resolve(syncUser);
        }

        const apiBase = String(window.ANYTRANSPORT_API_URL || 'api/index.php').trim();
        const sep = apiBase.indexOf('?') >= 0 ? '&' : '?';
        const apiUrl = apiBase + sep + 'action=users.get&id=' + encodeURIComponent(String(userId || '').trim());

        return fetch(apiUrl, { credentials: 'include' }).then(function (res) {
            if (!res.ok) throw new Error('Network');
            return res.json();
        }).then(function (payload) {
            const u = payload && payload.user ? payload.user : null;
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

    function resolveUserRecordSync(userId) {
        const id = String(userId || '').trim();
        if (!id) return null;
        if (window.anytransportApi && typeof window.anytransportApi.getUserById === 'function') {
            try {
                const u = window.anytransportApi.getUserById(id);
                if (u) return u;
            } catch (_e) {
                /* continue */
            }
        }
        if (window.anytransportApi && typeof window.anytransportApi.getUsers === 'function') {
            try {
                const users = window.anytransportApi.getUsers();
                const u = Array.isArray(users) ? users.find(function (x) { return String(x.id) === id; }) : null;
                if (u) return u;
            } catch (_e) {
                /* continue */
            }
        }
        return null;
    }

    function loadProvider(userId) {
        const apiBase = String(window.ANYTRANSPORT_API_URL || '../api/index.php' || 'api/index.php').trim();
        const sep = apiBase.indexOf('?') >= 0 ? '&' : '?';
        const apiUrl = apiBase + sep + 'action=users.get&id=' + encodeURIComponent(String(userId || '').trim());

        return fetch(apiUrl, { credentials: 'include' }).then(function (res) {
            if (!res.ok) throw new Error('Network');
            return res.json();
        }).then(function (payload) {
            return payload && payload.user ? payload.user : null;
        });
    }

    function renderProvider(u) {
        setText('provider-name', firstText(u.businessName, u.name, u.nickname, u.username, u.email));
        setText('provider-role', u.role ? capitalize(String(u.role)) : 'Transport Provider');
        const descEl = document.getElementById('provider-description');
        const descText = firstText(u.description, u.businessDescription, u.about, u.bio, u.summary, '');
        if (descEl) {
            if (descText) {
                descEl.innerHTML = '<p style="margin:0;">' + escapeHtml(descText) + '</p>';
            } else {
                descEl.innerHTML = '<p class="provider-empty-hint" style="margin:0;">No business description yet. Add one in the editor below to help customers choose you with confidence.</p>';
            }
        }
        const loc = firstText(u.city, u.town, u.location, '');
        const cityEl = document.getElementById('provider-city');
        if (cityEl) {
            if (loc) cityEl.textContent = loc;
            else cityEl.innerHTML = '<span class="provider-empty-hint">Not added yet</span>';
        }
        const contact = revealContact(u) || '';
        const contactEl = document.getElementById('provider-contact');
        if (contactEl) {
            if (contact) contactEl.textContent = contact;
            else contactEl.innerHTML = '<span class="provider-empty-hint">Not provided</span>';
        }
        const aboutCombined = firstText(u.bio, u.summary, descText, '');
        const aboutEl = document.getElementById('provider-about');
        if (aboutEl) {
            if (aboutCombined) aboutEl.textContent = aboutCombined;
            else aboutEl.innerHTML = '<span class="provider-empty-hint">Tell customers what makes your service reliable and professional.</span>';
        }

        renderServices(u);
        renderTransportModes(u);
        renderPayments(u);
        renderPhotos(u);
        renderActions(u);
        syncPendingProviderNav(u, canEditProfile(u));
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
            el.innerHTML = '<ul class="provider-services-list">' + services.map(s => '<li>' + escapeHtml(String(s)) + '</li>').join('') + '</ul>';
            return;
        }
        const text = firstText(u.service, u.specialities, '');
        if (text) {
            el.textContent = String(text);
            return;
        }
        el.innerHTML = '<span class="provider-empty-hint">Add specialties in the editor below so customers see what you offer.</span>';
    }

    function renderTransportModes(u) {
        const el = document.getElementById('provider-transport-modes');
        if (!el) return;
        const modes = getTransportModes(u);
        if (modes.length) {
            el.innerHTML = '<div class="provider-transport-chip-list">' + modes.map(function (mode) {
                return '<span class="provider-transport-chip">' + transportModeIconSvg(mode) + '<span>' + escapeHtml(mode) + '</span></span>';
            }).join('') + '</div>';
            return;
        }
        el.innerHTML = '<span class="provider-empty-hint">Add your transport modes in the editor below so customers know what vehicles you operate.</span>';
    }

    function paymentMethodLabel(key) {
        const map = {
            cash: 'Cash',
            cheque: 'Cheque',
            visa: 'Visa',
            mastercard: 'Mastercard',
            paypal: 'PayPal',
            americanExpress: 'American Express',
            bankTransfer: 'Bank transfer',
            revolut: 'Revolut'
        };
        return map[key] || capitalize(String(key || '').replace(/([A-Z])/g, ' $1').trim());
    }

    function paymentMethodNameKey(name) {
        return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }

    function isStandardPaymentMethodName(name) {
        const key = paymentMethodNameKey(name);
        if (!key) return false;
        return STANDARD_PAYMENT_METHOD_KEYS.some(function (entry) {
            return paymentMethodNameKey(entry) === key || paymentMethodNameKey(paymentMethodLabel(entry)) === key;
        });
    }

    function getCustomPaymentMethods(u) {
        if (!u || typeof u !== 'object') return [];
        if (Array.isArray(u.paymentMethodsCustom)) {
            return u.paymentMethodsCustom.map(function (item) { return String(item || '').trim(); }).filter(Boolean);
        }
        const pm = u.paymentMethods && typeof u.paymentMethods === 'object' ? u.paymentMethods : {};
        const standard = {};
        STANDARD_PAYMENT_METHOD_KEYS.forEach(function (key) { standard[key] = true; });
        standard.other = true;
        const names = [];
        Object.keys(pm).forEach(function (key) {
            if (!pm[key] || standard[key]) return;
            names.push(paymentMethodLabel(key));
        });
        return names;
    }

    function getDisplayedPaymentMethods(u) {
        const parts = [];
        const methods = normalizePaymentMethods(u);
        STANDARD_PAYMENT_METHOD_KEYS.forEach(function (key) {
            if (methods[key]) parts.push(paymentMethodLabel(key));
        });
        getCustomPaymentMethods(u).forEach(function (name) {
            parts.push(name);
        });
        return parts;
    }

    function renderPayments(u) {
        const el = document.getElementById('provider-payments');
        if (!el) return;
        const parts = getDisplayedPaymentMethods(u);
        if (parts.length) {
            el.innerHTML = '<div class="provider-transport-chip-list">' + parts.map(function (name) {
                return '<span class="provider-transport-chip"><span>' + escapeHtml(name) + '</span></span>';
            }).join('') + '</div>';
            return;
        }
        const inferred = [];
        if (u.acceptsCash || u.cash) inferred.push('Cash');
        if (u.paypal) inferred.push('PayPal');
        if (u.card || u.visa || u.mastercard) inferred.push('Card');
        if (u.cheque) inferred.push('Cheque');
        if (u.bankTransfer) inferred.push('Bank transfer');
        if (u.americanExpress) inferred.push('American Express');
        if (inferred.length) {
            el.textContent = inferred.join(' · ');
            return;
        }
        el.innerHTML = '<span class="provider-empty-hint">Select how you get paid in the editor below.</span>';
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

    function syncPendingProviderNav(u, ownProfile) {
        if (!ownProfile) return;
        const pending = window.auth
            && typeof window.auth.isProviderPendingReview === 'function'
            && window.auth.isProviderPendingReview(u);
        document.querySelectorAll(
            '.provider-mode-switch a[href*="messages"], .provider-mode-btn[data-mode="messages"], .at-nav-hub-messages, #navbar-hub-messages-link'
        ).forEach(function (el) {
            if (pending) {
                el.style.display = 'none';
                el.setAttribute('aria-hidden', 'true');
            } else {
                el.style.display = '';
                el.removeAttribute('aria-hidden');
            }
        });
    }

    function renderActions(u) {
        const root = document.getElementById('provider-actions');
        if (!root) return;
        root.innerHTML = '';

        const reviewStatus = String(u.identityReviewStatus || '').trim();
        const statusBadge = document.createElement('div');
        statusBadge.style.marginBottom = '10px';
        if (reviewStatus === 'approved') {
            statusBadge.className = 'provider-verified-badge';
            statusBadge.innerHTML = '<span aria-hidden="true">\u2713</span> Verified by AnyTransport';
        } else if (reviewStatus === 'rejected') {
            statusBadge.className = 'provider-verified-badge provider-verified-badge--rejected';
            statusBadge.textContent = 'Identity review rejected';
        } else {
            statusBadge.className = 'provider-verified-badge provider-verified-badge--pending';
            statusBadge.textContent = 'Verification pending — complete onboarding in your dashboard';
        }
        root.appendChild(statusBadge);

        const viewer = getViewer();
        const isOwn = viewer && String(viewer.id) === String(u.id);

        if (!isOwn) {
            const btnMessage = document.createElement('a');
            btnMessage.className = 'btn btn-outline';
            btnMessage.href = 'messages.html?to=' + encodeURIComponent(u.id);
            btnMessage.textContent = 'Message provider';
            root.appendChild(btnMessage);
        }

        const btnListings = document.createElement('a');
        btnListings.className = 'btn btn-primary';
        btnListings.href = 'dashboard.html?provider=' + encodeURIComponent(u.id);
        btnListings.textContent = isOwn ? 'My listings' : 'View listings';
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
        let customPaymentMethods = getCustomPaymentMethods(u);
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
            'Man Power',
            'Pets',
            'Other'
        ];
        const transportModeOptions = STANDARD_TRANSPORT_MODES.slice();
        let customTransportModes = getCustomTransportModes(u);
        editorCustomTransportModes = customTransportModes.slice();
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
            '  <form id="provider-profile-form" class="profile-editor-form profile-workspace-form" novalidate>',
            '  <div class="profile-workspace-grid">',
            '    <div class="profile-workspace-left">',
            '      <h3 class="profile-section-title">My details</h3>',
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
            '            <div id="profile-about-wordcount" class="profile-help">Up to 400 words</div>',
            '          </div>',
            '        </div>',
            '        <div class="profile-form-row profile-upload-card">',
            '          <div class="profile-form-label">Photos</div>',
            '          <div>',
            '            <div class="profile-help">Upload images (JPEG, PNG, GIF, WebP — max 8MB each)</div>',
            '            <div id="profile-photo-previews"></div>',
            isEditable ? '            <label class="profile-button" for="profile-photo-input" style="cursor:pointer; margin-top:10px;">Browse files</label>' : '            <span class="profile-button" style="margin-top:10px; opacity:.65; cursor:not-allowed;">Browse files</span>',
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
            '          <div class="profile-form-label">Town / city area</div>',
            '          <div>',
            '            <input id="profile-city" class="form-input" type="text" placeholder="e.g. Dublin, Cork, Galway" value="' + escapeAttribute(firstText(u.serviceAreaCity, u.city, u.town, u.location, '')) + '"' + disabledAttr + '>',
            '            <div class="profile-help">Shown to customers searching near you. Required for map discovery.</div>',
            '          </div>',
            '        </div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Full address <span style="font-weight:400;color:#64748b;">(optional)</span></div>',
            '          <div>',
            '            <input id="profile-service-address" class="form-input" type="text" placeholder="Street address for more accurate placement" value="' + escapeAttribute(firstText(u.serviceAreaAddress, '')) + '"' + disabledAttr + '>',
            '            <div class="profile-help">Optional. Used for a more precise map pin.</div>',
            '          </div>',
            '        </div>',
            '        <div id="profile-location-status" class="profile-help" style="margin-top:8px;" aria-live="polite"></div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Contact</div>',
            '          <div><input id="profile-contact" class="form-input" type="text" value="' + escapeAttribute(firstText(u.phone, u.contact, u.email, '')) + '"' + disabledAttr + '></div>',
            '        </div>',
            '        <div class="profile-footer-actions">',
            '          <span id="profile-save-status" class="profile-save-status" aria-live="polite"></span>',
            '        </div>',
            '    </div>',
            '    <div class="profile-workspace-right">',
            '      <h3 class="profile-section-title">Payment methods you accept</h3>',
            '      <div class="profile-check-grid" id="profile-payment-methods-grid"></div>',
            '      <div id="profile-custom-payment-wrap" style="margin-top:12px;">',
            '        <div class="profile-help">Add other payment methods you accept (e.g. Apple Pay, Klarna).</div>',
            '        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; align-items:center;">',
            '          <input id="profile-custom-payment-input" class="form-input" type="text" placeholder="Payment method name" maxlength="60" style="flex:1; min-width:180px;"' + disabledAttr + '>',
            (isEditable ? '          <button type="button" id="profile-custom-payment-add" class="btn btn-outline">Add payment method</button>' : ''),
            '        </div>',
            '      </div>',
            '      <h3 class="profile-section-title" style="margin-top:20px;">Jobs you specialise in</h3>',
            '      <div class="profile-muted">These specialties also control which open jobs appear on your provider dashboard. Select the categories you specialise in. Please limit to your top 8 (only due to space - it won\'t affect anything). Leaving them blank we will automatically use your job history.</div>',
            '      <div class="profile-check-grid">',
            serviceOptions.map(function (option) {
                return buildCheckbox('service_' + option.replace(/[^a-z0-9]+/ig, '_').toLowerCase(), option, serviceMatches(option, u), ' data-service-label="' + escapeAttribute(option) + '"' + disabledAttr);
            }).join(''),
            '      </div>',
            '      <h3 class="profile-section-title" style="margin-top:20px;">Modes of transport</h3>',
            '      <div class="profile-muted">Select the types of transport you currently operate so customers can quickly see if you are a fit.</div>',
            '      <div class="profile-check-grid" id="profile-transport-modes-grid"></div>',
            '      <div id="profile-custom-transport-wrap" style="margin-top:12px;">',
            '        <div class="profile-help">Add other vehicle types you operate (e.g. Horse box, 7.5 tonne).</div>',
            '        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; align-items:center;">',
            '          <input id="profile-custom-transport-input" class="form-input" type="text" placeholder="Vehicle name" maxlength="60" style="flex:1; min-width:180px;"' + disabledAttr + '>',
            (isEditable ? '          <button type="button" id="profile-custom-transport-add" class="btn btn-outline">Add vehicle</button>' : ''),
            '        </div>',
            '      </div>',
            '      <h3 class="profile-section-title" style="margin-top:20px;">Don\'t want any more invitations to bid?</h3>',
            '      <div class="profile-muted">Please tick here to prevent customers inviting you to quote.</div>',
            '      <div class="profile-check-grid" style="margin-top:14px;">',
            buildCheckbox('blockInvites', 'Stop allowing customers to invite me to jobs', !!u.blockInvites, disabledAttr),
            buildCheckbox('muteEmails', 'Stop sending me job invitation emails, but allow customers to invite me', !!u.muteInviteEmails, disabledAttr),
            '      </div>',
            '    </div>',
            '  </div>',
            '  </form>',
            '</div>',
            '</div>'
        ].join('');

        const form = document.getElementById('provider-profile-form');
        const photoInput = document.getElementById('profile-photo-input');
        const previewRoot = document.getElementById('profile-photo-previews');
        const saveStatusEl = document.getElementById('profile-save-status');
        const aboutField = document.getElementById('profile-about');
        const aboutWordCountEl = document.getElementById('profile-about-wordcount');
        let lastSavedSignature = '';

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

        const MAPBOX_TOKEN = 'pk.eyJ1IjoiZmlsa28iLCJhIjoiY2x6dmdlODUwMDZsMjJqcGcxY2U2b290dCJ9.9DRj6-luEwljI3xea5ATHQ';
        let cachedCoords = {
            lat: Number(u.serviceAreaLat) || 0,
            lng: Number(u.serviceAreaLng) || 0
        };

        async function geocodeServiceAreaQuery(query) {
            const q = String(query || '').trim();
            if (!q || !MAPBOX_TOKEN) return null;
            const url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/'
                + encodeURIComponent(q)
                + '.json?access_token=' + encodeURIComponent(MAPBOX_TOKEN)
                + '&limit=1&country=ie,gb&types=address,place,locality,postcode';
            try {
                const res = await fetch(url);
                if (!res.ok) return null;
                const data = await res.json();
                const feature = data && data.features && data.features[0];
                if (!feature || !Array.isArray(feature.center) || feature.center.length < 2) return null;
                return { lng: Number(feature.center[0]), lat: Number(feature.center[1]) };
            } catch (_err) {
                return null;
            }
        }

        async function resolveServiceAreaCoords() {
            const address = String(document.getElementById('profile-service-address')?.value || '').trim();
            const city = String(document.getElementById('profile-city')?.value || '').trim();
            const query = address || city;
            if (!query) return null;
            const coords = await geocodeServiceAreaQuery(query);
            if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
                cachedCoords = coords;
            }
            return coords;
        }

        function buildPayload() {
            const services = collectCheckedServices();
            const transportModes = collectCheckedTransportModes();
            const paymentMethods = collectPaymentMethods();
            const paymentMethodsCustom = collectCheckedCustomPaymentMethods();
            const city = String(document.getElementById('profile-city')?.value || '').trim();
            const serviceAddress = String(document.getElementById('profile-service-address')?.value || '').trim();
            const businessName = String(document.getElementById('profile-business-name')?.value || '').trim();
            return {
                id: u.id,
                email: u.email,
                role: u.role,
                businessName: businessName,
                name: businessName || firstText(u.name, ''),
                nickname: firstText(u.nickname, businessName, u.username, ''),
                companyType: String(document.getElementById('profile-company-type')?.value || '').trim(),
                city: city,
                location: city,
                serviceAreaCity: city,
                serviceAreaAddress: serviceAddress,
                serviceAreaLat: cachedCoords.lat || 0,
                serviceAreaLng: cachedCoords.lng || 0,
                showExactAddressOnMap: false,
                phone: String(document.getElementById('profile-contact')?.value || '').trim(),
                contact: String(document.getElementById('profile-contact')?.value || '').trim(),
                website: firstText(u.website, u.url, ''),
                description: String(document.getElementById('profile-about')?.value || '').trim(),
                businessDescription: String(document.getElementById('profile-about')?.value || '').trim(),
                about: String(document.getElementById('profile-about')?.value || '').trim(),
                services: services,
                categories: services,
                skills: services,
                transportModes: transportModes,
                paymentMethods: paymentMethods,
                paymentMethodsCustom: paymentMethodsCustom,
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

        function payloadSignature(payload) {
            return JSON.stringify(payload || {});
        }

        function hasPendingChanges() {
            return payloadSignature(buildPayload()) !== lastSavedSignature;
        }

        function setSaveBadge(text, state) {
            if (!saveStatusEl) return;
            saveStatusEl.textContent = text || '';
            saveStatusEl.classList.remove('is-saving', 'is-error');
            if (state === 'error') saveStatusEl.classList.add('is-error');
            else if (state === 'saving') saveStatusEl.classList.add('is-saving');
        }

        function updateAboutWordCount() {
            if (!aboutField || !aboutWordCountEl) return;
            const raw = String(aboutField.value || '');
            const words = raw.trim() ? raw.trim().split(/\s+/).length : 0;
            const maxWords = 400;
            const left = Math.max(0, maxWords - words);
            aboutWordCountEl.textContent = words > maxWords
                ? (words - maxWords) + ' words over limit — shorten to save cleanly'
                : left + ' words remaining (max ' + maxWords + ')';
        }

        function saveProfile(options) {
            const locationStatus = document.getElementById('profile-location-status');
            const payload = buildPayload();
            const signature = payloadSignature(payload);
            if (!window.anytransportApi || typeof window.anytransportApi.saveUser !== 'function') {
                return Promise.reject(new Error('Profile saving is not available yet.'));
            }

            if (signature === lastSavedSignature) {
                setSaveBadge('All changes saved', 'saved');
                return Promise.resolve();
            }

            setSaveBadge('Saving…', 'saving');
            if (locationStatus) {
                locationStatus.textContent = 'Updating map location…';
            }

            return resolveServiceAreaCoords().then(function () {
                const freshPayload = buildPayload();
                return persistProfile(freshPayload, options);
            }).catch(function () {
                return persistProfile(payload, options);
            });
        }

        function persistProfile(payload, options) {
            const locationStatus = document.getElementById('profile-location-status');
            try {
                console.info('[Provider Profile] autosave payload', {
                    userId: payload.id,
                    services: payload.services,
                    transportModes: payload.transportModes,
                    paymentMethods: payload.paymentMethods,
                    blockInvites: payload.blockInvites,
                    muteInviteEmails: payload.muteInviteEmails
                });
            } catch (_err) {}

            return Promise.resolve(window.anytransportApi.saveUser(payload)).then(function (serverUser) {
                lastSavedSignature = payloadSignature(payload);
                setSaveBadge('All changes saved', 'saved');
                if (locationStatus) {
                    if (payload.serviceAreaLat && payload.serviceAreaLng) {
                        locationStatus.textContent = 'Map location saved — customers can find you when they search near your area.';
                    } else if (payload.serviceAreaCity) {
                        locationStatus.textContent = 'Town saved, but map coordinates could not be resolved. Check spelling or add an address.';
                    } else {
                        locationStatus.textContent = 'Add a town/city so customers can find you on the map.';
                    }
                }
                if (serverUser && typeof serverUser === 'object' && serverUser.id) {
                    Object.assign(u, serverUser);
                    try {
                        renderPayments(u);
                        renderServices(u);
                        renderTransportModes(u);
                    } catch (_e) {}
                    const viewer = getViewer();
                    if (viewer && String(viewer.id) === String(serverUser.id) && window.auth) {
                        const merged = typeof window.auth.mergeUserIntoLocalCache === 'function'
                            ? window.auth.mergeUserIntoLocalCache(Object.assign({}, viewer, serverUser))
                            : Object.assign({}, viewer, serverUser);
                        window.auth.currentUser = merged;
                        if (typeof window.auth.setStoredCurrentUser === 'function') {
                            window.auth.setStoredCurrentUser(merged);
                        }
                        if (typeof window.auth.initAuth === 'function') {
                            window.auth.initAuth();
                        }
                    }
                }
                if (!options || !options.silent) {
                    try {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    } catch (_e) {}
                }
            }).catch(function (error) {
                setSaveBadge(error && error.message ? error.message : 'Save failed — try again', 'error');
                throw error;
            });
        }

        function queueAutosave() {
            if (!hasPendingChanges()) {
                return;
            }
            if (renderEditor._autosaveTimer) {
                clearTimeout(renderEditor._autosaveTimer);
            }
            renderEditor._autosaveTimer = setTimeout(function () {
                saveProfile({ silent: true }).catch(function (error) {
                    console.error(error);
                });
            }, 150);
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

        function readCheckedPaymentMethodKeys() {
            const keys = {};
            const grid = document.getElementById('profile-payment-methods-grid');
            if (!grid) return keys;
            grid.querySelectorAll('input[data-payment-method-label]:checked').forEach(function (input) {
                const key = paymentMethodNameKey(input.getAttribute('data-payment-method-label'));
                if (key) keys[key] = true;
            });
            return keys;
        }

        function renderPaymentMethodsGrid(checkedKeysOverride) {
            const grid = document.getElementById('profile-payment-methods-grid');
            if (!grid) return;
            const checkedKeys = checkedKeysOverride || readCheckedPaymentMethodKeys();
            const hasChecked = Object.keys(checkedKeys).length > 0;
            function isStandardChecked(key) {
                if (hasChecked) return !!checkedKeys[paymentMethodNameKey(paymentMethodLabel(key))];
                return !!paymentMethods[key];
            }
            function isCustomChecked(name) {
                const key = paymentMethodNameKey(name);
                if (hasChecked) return !!checkedKeys[key];
                return customPaymentMethods.some(function (entry) { return paymentMethodNameKey(entry) === key; });
            }
            grid.innerHTML =
                buildCheckbox('cash', 'Cash', isStandardChecked('cash'), disabledAttr) +
                buildCheckbox('cheque', 'Cheque', isStandardChecked('cheque'), disabledAttr) +
                buildCheckbox('visa', 'Visa card', isStandardChecked('visa'), disabledAttr) +
                buildCheckbox('mastercard', 'Mastercard', isStandardChecked('mastercard'), disabledAttr) +
                buildCheckbox('paypal', 'Paypal', isStandardChecked('paypal'), disabledAttr) +
                buildCheckbox('americanExpress', 'American Express', isStandardChecked('americanExpress'), disabledAttr) +
                buildCheckbox('bankTransfer', 'Bank Transfer', isStandardChecked('bankTransfer'), disabledAttr) +
                buildCheckbox('revolut', 'Revolut', isStandardChecked('revolut'), disabledAttr) +
                customPaymentMethods.map(function (name, index) {
                    return buildCustomPaymentMethodCheckbox(name, isCustomChecked(name), disabledAttr, index, isEditable);
                }).join('');
        }

        function addCustomPaymentMethod() {
            const input = document.getElementById('profile-custom-payment-input');
            const name = String(input && input.value || '').trim();
            if (!name) return;
            if (isStandardPaymentMethodName(name)) {
                alert('That payment method is already listed above — tick it there instead.');
                return;
            }
            const key = paymentMethodNameKey(name);
            if (customPaymentMethods.some(function (entry) { return paymentMethodNameKey(entry) === key; })) {
                alert('You already added that payment method.');
                return;
            }
            const checkedKeys = readCheckedPaymentMethodKeys();
            checkedKeys[key] = true;
            customPaymentMethods.push(name);
            if (input) input.value = '';
            renderPaymentMethodsGrid(checkedKeys);
            queueAutosave();
        }

        const customPaymentAddBtn = document.getElementById('profile-custom-payment-add');
        const customPaymentInput = document.getElementById('profile-custom-payment-input');
        const paymentMethodsGrid = document.getElementById('profile-payment-methods-grid');

        renderPaymentMethodsGrid();

        if (customPaymentAddBtn && isEditable) {
            customPaymentAddBtn.addEventListener('click', addCustomPaymentMethod);
        }
        if (customPaymentInput && isEditable) {
            customPaymentInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomPaymentMethod();
                }
            });
        }
        if (paymentMethodsGrid && isEditable) {
            paymentMethodsGrid.addEventListener('click', function (event) {
                const btn = event.target.closest('.profile-payment-remove-btn');
                if (!btn) return;
                event.preventDefault();
                event.stopPropagation();
                const index = Number(btn.getAttribute('data-custom-payment-index'));
                if (!Number.isFinite(index) || index < 0) return;
                customPaymentMethods.splice(index, 1);
                renderPaymentMethodsGrid();
                queueAutosave();
            });
        }

        function readCheckedTransportModeKeys() {
            const keys = {};
            const grid = document.getElementById('profile-transport-modes-grid');
            if (!grid) return keys;
            grid.querySelectorAll('input[data-transport-mode-label]:checked').forEach(function (input) {
                const key = transportModeKey(input.getAttribute('data-transport-mode-label'));
                if (key) keys[key] = true;
            });
            return keys;
        }

        function renderTransportModesGrid() {
            const grid = document.getElementById('profile-transport-modes-grid');
            if (!grid) return;
            const checkedKeys = readCheckedTransportModeKeys();
            const hasChecked = Object.keys(checkedKeys).length > 0;
            function isChecked(option) {
                const key = transportModeKey(option);
                if (hasChecked) return !!checkedKeys[key];
                return transportModeMatches(option, u);
            }
            grid.innerHTML =
                transportModeOptions.map(function (option) {
                    return buildTransportModeCheckbox(option, isChecked(option), disabledAttr);
                }).join('') +
                customTransportModes.map(function (mode, index) {
                    return buildCustomTransportModeCheckbox(mode, isChecked(mode), disabledAttr, index, isEditable);
                }).join('');
            editorCustomTransportModes = customTransportModes.slice();
        }

        function addCustomTransportMode() {
            const input = document.getElementById('profile-custom-transport-input');
            const name = String(input && input.value || '').trim();
            if (!name) return;
            if (isStandardTransportMode(name)) {
                alert('That vehicle is already listed above — tick it there instead.');
                return;
            }
            const key = transportModeKey(name);
            if (customTransportModes.some(function (entry) { return transportModeKey(entry) === key; })) {
                alert('You already added that vehicle.');
                return;
            }
            const checkedKeys = readCheckedTransportModeKeys();
            checkedKeys[key] = true;
            customTransportModes.push(name);
            if (input) input.value = '';
            const grid = document.getElementById('profile-transport-modes-grid');
            if (grid) {
                grid.innerHTML =
                    transportModeOptions.map(function (option) {
                        return buildTransportModeCheckbox(option, !!checkedKeys[transportModeKey(option)], disabledAttr);
                    }).join('') +
                    customTransportModes.map(function (mode, index) {
                        return buildCustomTransportModeCheckbox(mode, !!checkedKeys[transportModeKey(mode)], disabledAttr, index, isEditable);
                    }).join('');
                editorCustomTransportModes = customTransportModes.slice();
            }
            queueAutosave();
        }

        const customTransportAddBtn = document.getElementById('profile-custom-transport-add');
        const customTransportInput = document.getElementById('profile-custom-transport-input');
        const transportModesGrid = document.getElementById('profile-transport-modes-grid');

        renderTransportModesGrid();

        if (customTransportAddBtn && isEditable) {
            customTransportAddBtn.addEventListener('click', addCustomTransportMode);
        }
        if (customTransportInput && isEditable) {
            customTransportInput.addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    addCustomTransportMode();
                }
            });
        }
        if (transportModesGrid && isEditable) {
            transportModesGrid.addEventListener('click', function (event) {
                const btn = event.target.closest('.profile-transport-remove-btn');
                if (!btn) return;
                event.preventDefault();
                event.stopPropagation();
                const index = Number(btn.getAttribute('data-custom-transport-index'));
                if (!Number.isFinite(index) || index < 0) return;
                customTransportModes.splice(index, 1);
                renderTransportModesGrid();
                queueAutosave();
            });
        }
        renderPhotoPreviews();
        lastSavedSignature = payloadSignature(buildPayload());
        updateAboutWordCount();

        if (form && isEditable) {
            form.addEventListener('change', function (event) {
                const target = event.target;
                if (!target) return;
                if (target.matches && target.matches('input[type="checkbox"]')) {
                    saveProfile({ silent: true }).catch(function (error) {
                        console.error(error);
                    });
                    return;
                }
                queueAutosave();
            });
            form.addEventListener('input', function (event) {
                const target = event.target;
                if (!target) return;
                if (target.id === 'profile-about') {
                    updateAboutWordCount();
                }
                if (target.matches && target.matches('#profile-business-name, #profile-about, #profile-company-type, #profile-city, #profile-service-address, #profile-contact')) {
                    queueAutosave();
                }
            });
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                saveProfile({ silent: false }).catch(function (error) {
                    alert(error && error.message ? error.message : 'Unable to save profile.');
                });
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
            cash: !!(methods.cash || u.acceptsCash || u.cash),
            cheque: !!(methods.cheque || u.cheque),
            visa: !!(methods.visa || u.visa),
            mastercard: !!(methods.mastercard || u.mastercard),
            paypal: !!(methods.paypal || u.paypal),
            americanExpress: !!(methods.americanExpress || u.americanExpress),
            bankTransfer: !!(methods.bankTransfer || u.bankTransfer),
            revolut: !!methods.revolut
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

    function buildCheckboxHtml(id, labelHtml, checked, extraAttrs) {
        return '<label><input type="checkbox" id="' + escapeAttribute(id) + '"' + (checked ? ' checked' : '') + (extraAttrs || '') + '> <span>' + labelHtml + '</span></label>';
    }

    function buildCustomPaymentMethodCheckbox(option, checked, disabledAttr, index, editable) {
        const id = 'payment_method_custom_' + String(index) + '_' + option.replace(/[^a-z0-9]+/ig, '_').toLowerCase();
        const removeBtn = editable
            ? '<button type="button" class="profile-payment-remove-btn profile-transport-remove-btn" data-custom-payment-index="' + index + '" aria-label="Remove ' + escapeAttribute(option) + '">×</button>'
            : '';
        const labelHtml = '<span class="provider-transport-custom-label">' +
            '<span>' + escapeHtml(option) + '</span>' +
            removeBtn +
            '</span>';
        return '<label class="profile-transport-custom-row"><input type="checkbox" id="' + escapeAttribute(id) + '"' +
            (checked ? ' checked' : '') +
            ' data-payment-method-label="' + escapeAttribute(option) + '" data-custom-payment="1"' + (disabledAttr || '') +
            '> <span>' + labelHtml + '</span></label>';
    }

    function buildTransportModeCheckbox(option, checked, disabledAttr) {
        const id = 'transport_mode_' + option.replace(/[^a-z0-9]+/ig, '_').toLowerCase();
        const labelHtml = '<span class="provider-transport-option-label">' + transportModeIconSvg(option) + '<span>' + escapeHtml(option) + '</span></span>';
        return buildCheckboxHtml(id, labelHtml, checked, ' data-transport-mode-label="' + escapeAttribute(option) + '"' + (disabledAttr || ''));
    }

    function buildCustomTransportModeCheckbox(option, checked, disabledAttr, index, editable) {
        const id = 'transport_mode_custom_' + String(index) + '_' + option.replace(/[^a-z0-9]+/ig, '_').toLowerCase();
        const removeBtn = editable
            ? '<button type="button" class="profile-transport-remove-btn" data-custom-transport-index="' + index + '" aria-label="Remove ' + escapeAttribute(option) + '">×</button>'
            : '';
        const labelHtml = '<span class="provider-transport-custom-label">' +
            '<span class="provider-transport-option-label">' + transportModeIconSvg(option) + '<span>' + escapeHtml(option) + '</span></span>' +
            removeBtn +
            '</span>';
        return '<label class="profile-transport-custom-row"><input type="checkbox" id="' + escapeAttribute(id) + '"' +
            (checked ? ' checked' : '') +
            ' data-transport-mode-label="' + escapeAttribute(option) + '" data-custom-transport="1"' + (disabledAttr || '') +
            '> <span>' + labelHtml + '</span></label>';
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
                'man power': ['man power only', 'manpower only', 'manpower'],
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

    function collectCheckedTransportModes() {
        const values = [];
        const scoped = document.querySelectorAll('#provider-edit input[data-transport-mode-label]:checked');
        const nodes = scoped.length ? scoped : document.querySelectorAll('input[data-transport-mode-label]:checked');
        nodes.forEach(function (input) {
            values.push(String(input.getAttribute('data-transport-mode-label') || '').trim());
        });
        const seen = {};
        return values.filter(function (mode) {
            const key = String(mode || '').trim().toLowerCase();
            if (!key || key === 'other') return false;
            if (seen[key]) return false;
            seen[key] = true;
            return true;
        });
    }

    function collectPaymentMethods() {
        return {
            cash: !!document.getElementById('cash')?.checked,
            cheque: !!document.getElementById('cheque')?.checked,
            visa: !!document.getElementById('visa')?.checked,
            mastercard: !!document.getElementById('mastercard')?.checked,
            paypal: !!document.getElementById('paypal')?.checked,
            americanExpress: !!document.getElementById('americanExpress')?.checked,
            bankTransfer: !!document.getElementById('bankTransfer')?.checked,
            revolut: !!document.getElementById('revolut')?.checked
        };
    }

    function collectCheckedCustomPaymentMethods() {
        const names = [];
        const grid = document.getElementById('profile-payment-methods-grid');
        if (!grid) return names;
        grid.querySelectorAll('input[data-custom-payment="1"][data-payment-method-label]:checked').forEach(function (input) {
            const name = String(input.getAttribute('data-payment-method-label') || '').trim();
            if (!name) return;
            const key = paymentMethodNameKey(name);
            if (names.some(function (entry) { return paymentMethodNameKey(entry) === key; })) return;
            names.push(name);
        });
        return names;
    }

    function getTransportModes(u) {
        if (!u || typeof u !== 'object') return [];
        const candidates = [];
        if (Array.isArray(u.transportModes)) candidates.push.apply(candidates, u.transportModes);
        if (Array.isArray(u.transportMode)) candidates.push.apply(candidates, u.transportMode);
        if (Array.isArray(u.transportTypes)) candidates.push.apply(candidates, u.transportTypes);
        if (typeof u.transportModes === 'string') candidates.push.apply(candidates, String(u.transportModes).split(/[,;]+/));
        if (typeof u.transportMode === 'string') candidates.push.apply(candidates, String(u.transportMode).split(/[,;]+/));
        const normalized = [];
        candidates.forEach(function (mode) {
            const value = String(mode || '').trim();
            if (!value) return;
            const key = value.toLowerCase();
            if (normalized.some(function (entry) { return entry.toLowerCase() === key; })) return;
            normalized.push(value);
        });
        return normalized;
    }

    function transportModeKey(mode) {
        return typeof window.normalizeTransportModeKey === 'function'
            ? window.normalizeTransportModeKey(mode)
            : String(mode || '').trim().toLowerCase();
    }

    function isStandardTransportMode(mode) {
        const key = transportModeKey(mode);
        return STANDARD_TRANSPORT_MODES.some(function (entry) {
            return transportModeKey(entry) === key;
        });
    }

    function getCustomTransportModes(u) {
        return getTransportModes(u).filter(function (mode) {
            const key = transportModeKey(mode);
            if (!key || key === 'other') return false;
            if (key === 'luton van') return true;
            return !isStandardTransportMode(mode);
        });
    }

    function transportModeMatches(option, u) {
        const target = transportModeKey(option);
        if (!target) return false;
        return getTransportModes(u).some(function (mode) {
            return transportModeKey(mode) === target;
        });
    }

    function transportModeIconSvg(mode) {
        return typeof window.transportModeIconSvg === 'function' ? window.transportModeIconSvg(mode) : '';
    }

    // Utilities
    function setText(id, value) { const el = document.getElementById(id); if (el) el.textContent = String(value || ''); }
    function firstText() { for (let i=0;i<arguments.length;i++) { const v = arguments[i]; if (v !== undefined && v !== null && String(v).trim() !== '') return v; } return ''; }
    function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; }); }
    function escapeAttribute(s) { return String(s || '').replace(/"/g,''); }
    function obscureEmail(email) { if (!email) return ''; const parts = String(email).split('@'); if (parts.length !== 2) return email; return parts[0].substring(0,1) + '***@' + parts[1]; }
    function capitalize(s) { if (!s) return ''; return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

})();
