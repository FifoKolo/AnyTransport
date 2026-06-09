(function () {
    const STANDARD_TRANSPORT_MODES = ['Car', 'Motorbike', 'Bicycle', 'Van', 'Truck', 'Trailer'];
    const STANDARD_PAYMENT_METHOD_KEYS = ['cash', 'cheque', 'visa', 'mastercard', 'paypal', 'americanExpress', 'bankTransfer', 'revolut'];
    let editorCustomTransportModes = [];
    let profileEditorLiveUserRef = null;
    let profileEditActionsBound = false;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        ensureProfileEditActions();
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

        const viewer = getViewer();
        if (!viewer || !viewer.id) {
            renderError('Sign in to view transport provider profiles.');
            return;
        }

        if (window.auth && typeof window.auth.refreshSessionUserFromServer === 'function' && String(viewer.id) === String(userId)) {
            try {
                window.auth.refreshSessionUserFromServer();
            } catch (_refreshError) {
                /* continue with cached session */
            }
        }

        loadProvider(userId).then(function (user) {
            if (!user) {
                renderError('Provider not found.');
                return;
            }
            const isOwn = viewer && String(viewer.id) === String(user.id);
            applyProfilePageChrome(user, isOwn);
            renderProvider(user, isOwn);
            renderJobHistory(user.id, isOwn);
        }).catch(function (err) {
            console.error(err);
            renderError('Failed to load provider.');
        });
    }

    function applyProfilePageChrome(user, isOwn) {
        const name = firstText(user.businessName, user.name, user.nickname, user.username, 'Transport provider');
        const titleEl = document.querySelector('.profile-page-title');
        const introEl = document.querySelector('.profile-page-intro');
        if (titleEl) {
            titleEl.textContent = isOwn ? 'My Profile' : name;
        }
        if (introEl) {
            introEl.textContent = isOwn
                ? 'Keep your provider profile current with business details, services, payment options, and photos. When you save, changes are sent to an admin for review before they go live.'
                : 'View this transport provider\'s public profile, customer reviews, and job history before you hire.';
        }
        document.body.classList.toggle('provider-profile-public-view', !isOwn);
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
            const fleetApi = getFleetApi();
            const fleet = fleetApi ? fleetApi.normalizeFleetFromUser(u, getTransportModes) : [];
            const fleetHtml = fleetApi && fleet.length
                ? fleetApi.renderPublicFleetHtml(fleet)
                : 'Not provided';
            const insuranceApi = getInsuranceApi();
            const insurance = insuranceApi ? insuranceApi.normalizeInsuranceFromUser(u) : [];
            const insuranceHtml = insuranceApi && insurance.length
                ? insuranceApi.renderPublicInsuranceHtml(insurance)
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
                '<div style="margin-top:8px;"><span class="label">Vehicles</span><div class="profile-value">' + fleetHtml + '</div></div>' +
                '<div style="margin-top:8px;"><span class="label">Insurance</span><div class="profile-value">' + insuranceHtml + '</div></div>' +
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
        const apiUrl = apiBase + sep + 'action=users.get&id=' + encodeURIComponent(String(userId || '').trim()) + '&_=' + Date.now();

        return fetch(apiUrl, { credentials: 'include', cache: 'no-store' }).then(function (res) {
            if (!res.ok) throw new Error('Network');
            return res.json();
        }).then(function (payload) {
            return payload && payload.user ? payload.user : null;
        });
    }

    function renderProvider(u, isOwn) {
        const ownProfile = isOwn !== false && canEditProfile(u);
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
        const contactEl = document.getElementById('provider-contact');
        if (contactEl) {
            if (ownProfile) {
                const contact = revealContact(u) || '';
                if (contact) contactEl.textContent = contact;
                else contactEl.innerHTML = '<span class="provider-empty-hint">Not provided</span>';
            } else {
                contactEl.innerHTML = '<span class="provider-empty-hint">Contact details are shared through AnyTransport messages after you connect.</span>';
            }
        }
        const aboutCombined = firstText(u.bio, u.summary, descText, '');
        const aboutEl = document.getElementById('provider-about');
        if (aboutEl) {
            if (aboutCombined) aboutEl.textContent = aboutCombined;
            else aboutEl.innerHTML = '<span class="provider-empty-hint">Tell customers what makes your service reliable and professional.</span>';
        }

        renderServices(u);
        renderVehicleFleet(u);
        renderInsuranceList(u);
        renderPayments(u);
        renderPhotos(u);
        renderActions(u, ownProfile);
        syncPendingProviderNav(u, ownProfile);
        renderAvatar(u);
        if (ownProfile) {
            renderEditor(u, getProfileEditorUser(u));
        } else {
            const editRoot = document.getElementById('provider-edit');
            if (editRoot) editRoot.innerHTML = '';
        }
        renderReviews(u);
    }

    function renderJobHistory(providerId, isOwn) {
        const section = document.getElementById('provider-job-history-section');
        const summaryEl = document.getElementById('provider-job-history-summary');
        const listEl = document.getElementById('provider-job-history-list');
        if (!section || !listEl) return;

        section.style.display = '';

        function paint(payload) {
            const history = payload && Array.isArray(payload.jobHistory) ? payload.jobHistory : [];
            const stats = payload && payload.stats ? payload.stats : {};
            const completed = Number(stats.completedJobs) || 0;
            const quoted = Number(stats.quotedJobs) || history.length;
            if (summaryEl) {
                if (!history.length) {
                    summaryEl.textContent = isOwn
                        ? 'When you complete jobs on AnyTransport, they appear here for customers to see.'
                        : 'This provider has no recorded job history on AnyTransport yet.';
                } else {
                    summaryEl.textContent = completed + ' completed · ' + quoted + ' total on platform'
                        + (isOwn ? ' (visible to customers on your profile).' : '.');
                }
            }
            if (!history.length) {
                listEl.innerHTML = '<p class="provider-empty-hint" style="margin:0;">No jobs to show yet.</p>';
                return;
            }
            listEl.innerHTML = history.map(function (job) {
                const service = escapeHtml(firstText(job.service, 'Transport job'));
                const route = escapeHtml(firstText(job.route, 'Route not listed'));
                const when = escapeHtml(formatReviewWhen(job.date) || 'Date unknown');
                const formId = job.formId ? ('Listing #' + escapeHtml(String(job.formId))) : '';
                const amount = job.bidAmount != null && Number(job.bidAmount) > 0
                    ? (' · €' + escapeHtml(String(Number(job.bidAmount).toFixed(2))))
                    : '';
                const status = String(job.status || 'Quoted');
                const statusClass = status === 'Completed'
                    ? 'provider-job-history-status--completed'
                    : (status === 'Awarded' ? 'provider-job-history-status--awarded' : 'provider-job-history-status--quoted');
                return [
                    '<article class="provider-job-history-item">',
                    '<h4>' + service + '</h4>',
                    '<p class="provider-job-history-meta">' + route + (formId ? (' · ' + formId) : '') + ' · ' + when + amount + '</p>',
                    '<span class="provider-job-history-status ' + statusClass + '">' + escapeHtml(status) + '</span>',
                    '</article>'
                ].join('');
            }).join('');
        }

        if (window.anytransportApi && typeof window.anytransportApi.getProviderPublicProfile === 'function') {
            try {
                paint(window.anytransportApi.getProviderPublicProfile(providerId));
                return;
            } catch (_e) {
                /* fetch fallback */
            }
        }

        const apiBase = String(window.ANYTRANSPORT_API_URL || 'api/index.php').trim();
        const sep = apiBase.indexOf('?') >= 0 ? '&' : '?';
        const apiUrl = apiBase + sep + 'action=providers.publicProfile&providerId=' + encodeURIComponent(String(providerId || ''));
        fetch(apiUrl, { credentials: 'include' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (payload) {
                if (!payload || !payload.ok) {
                    if (summaryEl) summaryEl.textContent = 'Job history is unavailable right now.';
                    listEl.innerHTML = '';
                    return;
                }
                paint(payload);
            })
            .catch(function () {
                if (summaryEl) summaryEl.textContent = 'Job history is unavailable right now.';
                listEl.innerHTML = '';
            });
    }

    function renderReviews(u) {
        const summaryEl = document.getElementById('provider-review-summary');
        const listEl = document.getElementById('provider-reviews-list');
        if (!summaryEl && !listEl) return;

        const providerId = String(u && u.id || '').trim();
        if (!providerId) {
            if (summaryEl) summaryEl.textContent = 'No reviews yet.';
            if (listEl) listEl.innerHTML = '';
            return;
        }

        function paint(payload) {
            const stats = payload && payload.stats ? payload.stats : { count: 0, average: 0 };
            const reviews = payload && Array.isArray(payload.reviews) ? payload.reviews : [];
            const count = Number(stats.count) || 0;
            const average = Number(stats.average) || 0;
            if (summaryEl) {
                summaryEl.textContent = count > 0
                    ? (average.toFixed(1) + ' ★ average · ' + count + ' review' + (count === 1 ? '' : 's'))
                    : 'No reviews yet.';
            }
            if (!listEl) return;
            if (!reviews.length) {
                listEl.innerHTML = '<p class="provider-empty-hint" style="margin:0;">Reviews appear here after customers complete a job and leave feedback.</p>';
                return;
            }
            const top = reviews.slice(0, 6);
            listEl.innerHTML = '<ul class="provider-services-list" style="padding-left:1rem;">' + top.map(function (review) {
                const rating = Math.max(1, Math.min(5, parseInt(review.rating, 10) || 0));
                const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
                const who = escapeHtml(firstText(review.customerName, 'Customer'));
                const when = review.createdAt ? escapeHtml(formatReviewWhen(review.createdAt)) : '';
                const text = escapeHtml(firstText(review.text, ''));
                const formId = review.formId ? (' · Listing #' + escapeHtml(String(review.formId))) : '';
                return '<li style="margin-bottom:10px;"><strong>' + stars + '</strong> ' + who
                    + (when ? (' · ' + when) : '') + formId
                    + (text ? ('<div style="margin-top:4px;color:#475569;">' + text + '</div>') : '')
                    + '</li>';
            }).join('') + '</ul>';
        }

        if (window.anytransportApi && typeof window.anytransportApi.listProviderReviews === 'function') {
            try {
                paint(window.anytransportApi.listProviderReviews(providerId, ''));
                return;
            } catch (_e) {
                /* fall through to fetch */
            }
        }

        const apiBase = String(window.ANYTRANSPORT_API_URL || 'api/index.php').trim();
        const sep = apiBase.indexOf('?') >= 0 ? '&' : '?';
        const apiUrl = apiBase + sep + 'action=reviews.list&providerId=' + encodeURIComponent(providerId);
        fetch(apiUrl, { credentials: 'include' })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (payload) { paint(payload || {}); })
            .catch(function () {
                if (summaryEl) summaryEl.textContent = 'Reviews unavailable.';
                if (listEl) listEl.innerHTML = '';
            });
    }

    function formatReviewWhen(iso) {
        try {
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return '';
            return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (_e) {
            return '';
        }
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

    function getFleetApi() {
        return window.anytransportProviderVehicles || null;
    }

    function getInsuranceApi() {
        return window.anytransportProviderInsurance || null;
    }

    function renderVehicleFleet(u) {
        const el = document.getElementById('provider-vehicle-fleet');
        if (!el) return;
        const fleetApi = getFleetApi();
        const fleet = fleetApi ? fleetApi.normalizeFleetFromUser(u, getTransportModes) : [];
        if (fleet.length && fleetApi) {
            el.innerHTML = fleetApi.renderPublicFleetHtml(fleet);
            return;
        }
        el.innerHTML = '<span class="provider-empty-hint">Add your vehicles in the editor below so customers know what you operate.</span>';
    }

    function renderInsuranceList(u) {
        const el = document.getElementById('provider-insurance-list');
        if (!el) return;
        const insuranceApi = getInsuranceApi();
        const insurance = insuranceApi ? insuranceApi.normalizeInsuranceFromUser(u) : [];
        if (insurance.length && insuranceApi) {
            el.innerHTML = insuranceApi.renderPublicInsuranceHtml(insurance);
            return;
        }
        el.innerHTML = '<span class="provider-empty-hint">Add your insurance details in the editor below so customers know what cover you hold.</span>';
    }

    function renderTransportModes(u) {
        renderVehicleFleet(u);
    }

    function renderVehicleCount(u) {
        /* legacy hook — fleet display is unified in renderVehicleFleet */
    }

    function formatVehicleCountLabel(u) {
        const raw = u && (u.vehicleCount ?? u.vehiclesAvailable ?? u.fleetSize);
        if (raw === null || raw === undefined || raw === '') {
            return '';
        }
        const count = parseInt(raw, 10);
        if (!Number.isFinite(count) || count < 0) {
            return '';
        }
        return count + (count === 1 ? ' vehicle' : ' vehicles');
    }

    function parseVehicleCountFromInput() {
        const fleetApi = getFleetApi();
        const editorRoot = document.getElementById('profile-vehicle-fleet-editor');
        if (fleetApi && editorRoot) {
            const legacy = fleetApi.deriveLegacyFromFleet(fleetApi.collectFleetFromEditor(editorRoot));
            return legacy.vehicleCount;
        }
        return null;
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

    function getProfileEditorUser(u) {
        if (!u || typeof u !== 'object') {
            return u;
        }
        const status = String(u.profileChangeStatus || '').trim().toLowerCase();
        const pending = u.profileChangePending;
        if (status === 'pending_review' && pending && typeof pending === 'object' && Object.keys(pending).length) {
            return Object.assign({}, u, pending);
        }
        return u;
    }

    function clearPendingProfileReviewClientState(user) {
        if (!user || typeof user !== 'object') {
            return user;
        }
        user.profileChangeStatus = 'none';
        user.profileChangePending = {};
        user.profileChangeSubmittedAt = '';
        user._pendingReview = false;
        delete user._profileSaveMessage;
        return user;
    }

    function buildProfilePayloadFromRecord(user) {
        if (!user || typeof user !== 'object') {
            return {};
        }
        const fleetApi = getFleetApi();
        const insuranceApi = getInsuranceApi();
        const services = Array.isArray(user.services) ? user.services.slice()
            : Array.isArray(user.categories) ? user.categories.slice()
                : Array.isArray(user.skills) ? user.skills.slice() : [];
        const paymentMethods = normalizePaymentMethods(user);
        const paymentMethodsCustom = getCustomPaymentMethods(user);
        const fleet = fleetApi ? fleetApi.normalizeFleetFromUser(user, getTransportModes) : [];
        const fleetLegacy = fleetApi
            ? fleetApi.deriveLegacyFromFleet(fleet)
            : { providerVehicles: [], transportModes: getTransportModes(user), vehicleCount: null };
        const insurance = insuranceApi ? insuranceApi.normalizeInsuranceFromUser(user) : [];
        const city = firstText(user.serviceAreaCity, user.city, user.town, user.location, '');
        const businessName = firstText(user.businessName, user.name, user.nickname, user.username, '');
        const photos = normalizePhotos(user.photos || user.images || user.media || []);
        return {
            id: user.id,
            email: user.email,
            role: user.role,
            businessName: businessName,
            name: businessName || firstText(user.name, ''),
            nickname: firstText(user.nickname, businessName, user.username, ''),
            companyType: firstText(user.companyType, user.company, user.businessType, 'Sole trader'),
            city: city,
            location: city,
            serviceAreaCity: city,
            serviceAreaAddress: firstText(user.serviceAreaAddress, ''),
            serviceAreaLat: Number(user.serviceAreaLat) || 0,
            serviceAreaLng: Number(user.serviceAreaLng) || 0,
            showExactAddressOnMap: !!user.showExactAddressOnMap,
            phone: firstText(user.phone, user.contact, ''),
            contact: firstText(user.phone, user.contact, ''),
            website: firstText(user.website, user.url, ''),
            description: firstText(user.description, user.businessDescription, user.about, user.bio, user.summary, ''),
            businessDescription: firstText(user.description, user.businessDescription, user.about, user.bio, user.summary, ''),
            about: firstText(user.description, user.businessDescription, user.about, user.bio, user.summary, ''),
            services: services,
            categories: services,
            skills: services,
            transportModes: fleetLegacy.transportModes,
            providerVehicles: fleetLegacy.providerVehicles,
            vehicleCount: fleetLegacy.vehicleCount,
            providerInsurance: insuranceApi
                ? insurance.map(function (entry) { return insuranceApi.normalizeInsuranceEntry(entry); }).filter(Boolean)
                : insurance,
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
            blockInvites: !!user.blockInvites,
            muteInviteEmails: !!user.muteInviteEmails,
            avatar: firstText(user.avatar, ''),
            photos: photos.filter(Boolean)
        };
    }

    function buildProfileChangeStatusBanner(u) {
        const status = String(u && u.profileChangeStatus || '').trim().toLowerCase();
        if (status === 'pending_review') {
            const submitted = u.profileChangeSubmittedAt ? formatDateTime(u.profileChangeSubmittedAt) : '';
            return [
                '<div class="profile-pending-review-banner">',
                '  <p class="profile-pending-review-text">',
                '    <strong>Changes awaiting admin review.</strong> Your public profile still shows the previous approved details',
                (submitted ? (' (submitted ' + escapeHtml(submitted) + ').') : '.'),
                '    You will receive an email when an admin approves or declines them.',
                '  </p>',
                '  <div class="profile-pending-review-actions">',
                '    <button type="button" id="profile-cancel-pending-btn" class="btn btn-outline profile-cancel-pending-btn">Undo profile changes</button>',
                '  </div>',
                '</div>'
            ].join('');
        }
        if (status === 'rejected') {
            const notes = String(u.profileChangeReviewNotes || '').trim();
            return '<div class="signup-mode-note" style="margin:0 0 14px; padding:12px 14px; border-radius:10px; background:#fef2f2; border:1px solid #fecaca; color:#991b1b;">' +
                '<strong>Your last profile changes were declined.</strong>' +
                (notes ? (' Reason: ' + escapeHtml(notes) + '.') : '') +
                ' Update your profile and save again to submit for another review.</div>';
        }
        const lastDecision = u.profileChangeLastDecision && typeof u.profileChangeLastDecision === 'object'
            ? u.profileChangeLastDecision
            : null;
        const rejectedItems = lastDecision && Array.isArray(lastDecision.rejected) ? lastDecision.rejected : [];
        const approvedItems = lastDecision && Array.isArray(lastDecision.approved) ? lastDecision.approved : [];
        if (lastDecision && rejectedItems.length) {
            const decisionNotes = String(lastDecision.notes || u.profileChangeReviewNotes || '').trim();
            return [
                '<div class="signup-mode-note" style="margin:0 0 14px; padding:12px 14px; border-radius:10px; background:#eff6ff; border:1px solid #bfdbfe; color:#1e3a8a;">',
                '<strong>Some of your profile changes were approved.</strong>',
                approvedItems.length ? (' Approved: ' + escapeHtml(approvedItems.join(', ')) + '.') : '',
                ' Not approved: ' + escapeHtml(rejectedItems.join(', ')) + '.',
                decisionNotes ? (' Reason: ' + escapeHtml(decisionNotes) + '.') : '',
                ' You can edit your profile and submit again for anything that was not approved.',
                '</div>'
            ].join('');
        }
        return '';
    }

    function setProfileEditorLiveUser(user) {
        if (user && typeof user === 'object' && user.id) {
            profileEditorLiveUserRef = user;
        }
    }

    function resolveProfileEditorLiveUser(fallback) {
        let candidate = fallback || profileEditorLiveUserRef || null;
        try {
            const viewer = getViewer();
            if (viewer && viewer.id) {
                if (!candidate || String(candidate.id) !== String(viewer.id)) {
                    candidate = Object.assign({}, viewer, candidate || {});
                } else {
                    candidate = Object.assign({}, candidate, viewer);
                }
            }
        } catch (_e) {
            /* ignore */
        }
        return candidate;
    }

    function ensureProfileEditActions() {
        if (profileEditActionsBound) {
            return;
        }
        profileEditActionsBound = true;
        document.addEventListener('click', function (event) {
            const btn = event.target.closest('#profile-cancel-pending-btn');
            if (!btn) {
                return;
            }
            const editRoot = document.getElementById('provider-edit');
            if (!editRoot || !editRoot.contains(btn)) {
                return;
            }
            event.preventDefault();
            withdrawPendingProfileChanges(resolveProfileEditorLiveUser());
        });
    }

    function mountProfileReviewBanner(bannerHost, liveUser) {
        if (!bannerHost || !liveUser) {
            return;
        }
        const existingBanner = bannerHost.querySelector('[data-profile-review-banner]');
        if (existingBanner) {
            existingBanner.remove();
        }
        const bannerHtml = buildProfileChangeStatusBanner(liveUser);
        if (!bannerHtml) {
            return;
        }
        const wrap = document.createElement('div');
        wrap.setAttribute('data-profile-review-banner', '1');
        wrap.innerHTML = bannerHtml;
        const bannerNode = wrap.firstElementChild;
        if (bannerNode) {
            bannerHost.insertBefore(bannerNode, bannerHost.querySelector('.profile-editor-subtitle')?.nextSibling || null);
        }
    }

    function formatDateTime(value) {
        if (!value) return '';
        try {
            const date = new Date(value);
            if (Number.isNaN(date.getTime())) return '';
            return date.toLocaleString();
        } catch (_e) {
            return '';
        }
    }

    function withdrawPendingProfileChanges(liveUser) {
        const user = resolveProfileEditorLiveUser(liveUser);
        if (!user || !user.id) {
            alert('Could not resolve your profile session. Please refresh the page and try again.');
            return;
        }
        const status = String(user.profileChangeStatus || '').trim().toLowerCase();
        if (status !== 'pending_review') {
            alert('There are no profile changes awaiting review to withdraw.');
            return;
        }
        if (!window.confirm('Withdraw your pending profile changes? Your live profile will stay as it is now and the admin review request will be cancelled.')) {
            return;
        }

        const userId = String(user.id);
        Promise.resolve().then(function () {
            if (window.anytransportApi && typeof window.anytransportApi.cancelProviderProfileReview === 'function') {
                return window.anytransportApi.cancelProviderProfileReview(userId);
            }
            throw new Error('Profile withdraw is not available right now.');
        }).then(function (updated) {
            if (!updated || !updated.id) {
                throw new Error('Could not withdraw profile changes. Please try again.');
            }
            clearPendingProfileReviewClientState(updated);
            if (window.auth) {
                if (typeof window.auth.mergeUserIntoLocalCache === 'function') {
                    window.auth.mergeUserIntoLocalCache(updated);
                }
                if (window.auth.getUser && String(window.auth.getUser().id) === String(updated.id)) {
                    window.auth.currentUser = Object.assign({}, updated);
                    if (typeof window.auth.setStoredCurrentUser === 'function') {
                        window.auth.setStoredCurrentUser(updated);
                    }
                }
            }
            renderProvider(updated, true);
            setProfileEditorLiveUser(updated);
            return loadProvider(userId).then(function (freshUser) {
                if (freshUser && freshUser.id) {
                    clearPendingProfileReviewClientState(freshUser);
                    renderProvider(freshUser, true);
                    if (window.auth && typeof window.auth.mergeUserIntoLocalCache === 'function') {
                        window.auth.mergeUserIntoLocalCache(freshUser);
                    }
                }
            });
        }).then(function () {
            alert('Your pending profile changes were withdrawn. Your live profile is unchanged.');
        }).catch(function (err) {
            alert(err && err.message ? err.message : 'Could not withdraw profile changes.');
        });
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

    function renderActions(u, isOwnProfile) {
        const root = document.getElementById('provider-actions');
        if (!root) return;
        root.innerHTML = '';

        const reviewStatus = String(u.identityReviewStatus || '').trim();
        const stripeComplete = String(u.stripeOnboardingStatus || '').trim().toLowerCase() === 'complete';
        const statusBadge = document.createElement('div');
        statusBadge.style.marginBottom = '10px';
        if (stripeComplete || reviewStatus === 'approved' || u.verified) {
            statusBadge.className = 'provider-verified-badge';
            statusBadge.innerHTML = '<span aria-hidden="true">\u2713</span> Verified by AnyTransport';
        } else if (reviewStatus === 'rejected') {
            statusBadge.className = 'provider-verified-badge provider-verified-badge--rejected';
            statusBadge.textContent = 'Identity review rejected';
        } else if (isOwnProfile) {
            statusBadge.className = 'provider-verified-badge provider-verified-badge--pending';
            statusBadge.textContent = 'Verification pending — check your email for the Stripe verification link';
        }
        if (statusBadge.textContent || statusBadge.innerHTML) {
            root.appendChild(statusBadge);
        }

        const viewer = getViewer();
        const isOwn = isOwnProfile !== false && viewer && String(viewer.id) === String(u.id);

        if (!isOwn) {
            const btnMessage = document.createElement('a');
            btnMessage.className = 'btn btn-primary';
            btnMessage.href = 'messages.html?to=' + encodeURIComponent(u.id);
            btnMessage.textContent = 'Message provider';
            root.appendChild(btnMessage);

            const btnBack = document.createElement('a');
            btnBack.className = 'btn btn-outline';
            btnBack.href = 'customer-dashboard.html';
            btnBack.textContent = 'Back to My Listings';
            root.appendChild(btnBack);
            return;
        }

        const btnListings = document.createElement('a');
        btnListings.className = 'btn btn-primary';
        btnListings.href = 'dashboard.html';
        btnListings.textContent = 'Provider dashboard';
        root.appendChild(btnListings);
    }

    function canEditProfile(u) {
        const viewer = getViewer();
        if (!viewer || !u) return false;
        return String(viewer.id) === String(u.id) || String(viewer.role || '').toLowerCase() === 'admin';
    }

    function renderEditor(liveUser, editorUser) {
        ensureProfileEditActions();
        setProfileEditorLiveUser(liveUser);
        const u = editorUser || liveUser;
        const root = document.getElementById('provider-edit');
        if (!root) return;
        root.innerHTML = '';

        const isEditable = canEditProfile(liveUser);
        const disabledAttr = isEditable ? '' : ' disabled aria-disabled="true"';
        const readOnlyNote = isEditable ? '' : '<div class="profile-section-note"><strong>Read only view.</strong> This profile is public. Sign in as the owner or an admin to edit the details below.</div>';
        const reviewBanner = isEditable ? buildProfileChangeStatusBanner(liveUser) : '';

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
        const fleetApi = getFleetApi();
        let editorFleet = fleetApi ? fleetApi.normalizeFleetFromUser(u, getTransportModes) : [];
        let vehiclesEditMode = false;
        let editorFleetSnapshot = editorFleet.slice();
        const insuranceApi = getInsuranceApi();
        let editorInsurance = insuranceApi ? insuranceApi.normalizeInsuranceFromUser(u) : [];
        let insuranceEditMode = false;
        let editorInsuranceSnapshot = editorInsurance.slice();
        let pendingPhotos = [];

        root.innerHTML = [
            '<div class="profile-editor-shell">',
            '  <div class="profile-editor-header">',
            '    <div>',
            '      <div class="profile-editor-kicker">Profile settings</div>',
            '      <h3 class="profile-editor-title">Edit your profile</h3>',
            '      <p class="profile-editor-subtitle">Update your business details, services, payment options, and photos below. Click Save profile to submit changes for admin review before they appear on your public profile.</p>',
            reviewBanner,
            readOnlyNote,
            '    </div>',
            '  </div>',
            '  <div id="profile-changes-panel" class="profile-changes-panel" hidden>',
            '    <h4 class="profile-changes-panel-title">Unsaved changes</h4>',
            '    <ul id="profile-changes-list" class="profile-changes-list" aria-live="polite"></ul>',
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
            '        <div id="profile-location-status" class="profile-help" style="margin-top:8px;" aria-live="polite"></div>',
            '        <div class="profile-form-row">',
            '          <div class="profile-form-label">Contact</div>',
            '          <div><input id="profile-contact" class="form-input" type="text" value="' + escapeAttribute(firstText(u.phone, u.contact, u.email, '')) + '"' + disabledAttr + '></div>',
            '        </div>',
            '        <div class="profile-footer-actions">',
            '          <button type="button" id="profile-save-btn" class="btn btn-primary" disabled>Save profile</button>',
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
            '      <div class="profile-vehicle-section">',
            '        <div class="profile-vehicle-section-header">',
            '          <h3 class="profile-section-title profile-vehicle-section-title">Vehicles</h3>',
            (isEditable ? '          <button type="button" id="profile-vehicle-edit-toggle" class="btn btn-outline profile-vehicle-edit-btn">Edit vehicles</button>' : ''),
            '        </div>',
            '        <div class="profile-muted">These are shown on your public profile. Use Edit vehicles to change type, capacity, or quantity.</div>',
            '        <div id="profile-vehicle-fleet-overview" class="profile-vehicle-fleet-overview"></div>',
            '        <div id="profile-vehicle-fleet-editor-wrap" class="profile-vehicle-fleet-editor-wrap" hidden>',
            '          <div id="profile-vehicle-fleet-editor"></div>',
            (isEditable ? '          <div class="profile-vehicle-edit-actions"><button type="button" id="profile-vehicle-edit-done" class="btn btn-primary">Done</button><button type="button" id="profile-vehicle-edit-cancel" class="btn btn-outline">Cancel</button></div>' : ''),
            '        </div>',
            '      </div>',
            '      <div class="profile-insurance-section">',
            '        <div class="profile-insurance-section-header">',
            '          <h3 class="profile-section-title profile-insurance-section-title">Insurance</h3>',
            (isEditable ? '          <button type="button" id="profile-insurance-edit-toggle" class="btn btn-outline profile-insurance-edit-btn">Edit insurance</button>' : ''),
            '        </div>',
            '        <div class="profile-muted">Tell customers what insurance you hold and the maximum value each policy covers.</div>',
            '        <div id="profile-insurance-overview" class="profile-insurance-overview"></div>',
            '        <div id="profile-insurance-editor-wrap" class="profile-insurance-editor-wrap" hidden>',
            '          <div id="profile-insurance-editor"></div>',
            (isEditable ? '          <div class="profile-insurance-edit-actions"><button type="button" id="profile-insurance-edit-done" class="btn btn-primary">Done</button><button type="button" id="profile-insurance-edit-cancel" class="btn btn-outline">Cancel</button></div>' : ''),
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
            (isEditable ? [
                '  <section class="profile-account-security" id="profile-account-security" aria-labelledby="profile-account-security-title">',
                '    <h3 id="profile-account-security-title" class="profile-section-title">Account &amp; password</h3>',
                '    <p class="profile-muted">Update your login password here. Your new password is saved immediately after you submit.</p>',
                '    <form id="profile-account-form" class="profile-account-form" autocomplete="off">',
                '      <div class="profile-form-row">',
                '        <div class="profile-form-label">Login email</div>',
                '        <div><input id="profile-account-email" class="form-input" type="email" value="' + escapeAttribute(firstText(liveUser.email, u.email, '')) + '" readonly autocomplete="off" tabindex="-1"></div>',
                '      </div>',
                '      <div class="profile-form-row">',
                '        <div class="profile-form-label">Login password</div>',
                '        <div><input id="profile-account-login-password" class="form-input profile-password-plain" type="text" readonly autocomplete="off" spellcheck="false" value="Loading…"></div>',
                '      </div>',
                '      <div class="profile-form-row">',
                '        <div class="profile-form-label">New password</div>',
                '        <div>',
                '          <input id="profile-account-new-password" class="form-input profile-password-plain" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" required minlength="6" placeholder="At least 6 characters">',
                '          <p class="profile-help">Password must be at least 6 characters long.</p>',
                '          <p id="profile-account-password-hint" class="profile-account-password-hint" aria-live="polite"></p>',
                '        </div>',
                '      </div>',
                '      <div class="profile-form-row">',
                '        <div class="profile-form-label">Confirm new password</div>',
                '        <div><input id="profile-account-confirm-password" class="form-input profile-password-plain" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore="true" required placeholder="Re-enter new password"></div>',
                '      </div>',
                '      <div class="profile-account-actions">',
                '        <button type="submit" id="profile-account-submit-btn" class="btn btn-primary" disabled>Update password</button>',
                '      </div>',
                '      <p id="profile-account-status" class="profile-account-status" aria-live="polite"></p>',
                '    </form>',
                '  </section>'
            ].join('') : ''),
            '  <div id="profile-save-popup" class="profile-save-popup" hidden>',
            '    <div class="profile-save-popup-card" role="status" aria-live="polite">',
            '      <p class="profile-save-popup-text">Unsaved changes</p>',
            '      <ul id="profile-save-popup-changes" class="profile-changes-list"></ul>',
            '      <button type="button" id="profile-save-popup-btn" class="btn btn-primary">Save profile</button>',
            '    </div>',
            '  </div>',
            '  <div id="profile-save-success-modal" class="profile-save-success-modal" hidden role="dialog" aria-modal="true" aria-labelledby="profile-save-success-title">',
            '    <div class="profile-save-success-card">',
            '      <h4 id="profile-save-success-title">Changes submitted</h4>',
            '      <p id="profile-save-success-text">Your profile changes were submitted for admin review. You will receive an email once they are approved or declined.</p>',
            '      <button type="button" id="profile-save-success-dismiss" class="btn btn-primary">OK</button>',
            '    </div>',
            '  </div>',
            '</div>',
            '</div>'
        ].join('');

        const form = document.getElementById('provider-profile-form');
        const photoInput = document.getElementById('profile-photo-input');
        const previewRoot = document.getElementById('profile-photo-previews');
        const saveStatusEl = document.getElementById('profile-save-status');
        const saveBtn = document.getElementById('profile-save-btn');
        const savePopup = document.getElementById('profile-save-popup');
        const savePopupBtn = document.getElementById('profile-save-popup-btn');
        const saveSuccessModal = document.getElementById('profile-save-success-modal');
        const saveSuccessDismiss = document.getElementById('profile-save-success-dismiss');
        const changesPanel = document.getElementById('profile-changes-panel');
        const changesList = document.getElementById('profile-changes-list');
        const popupChangesList = document.getElementById('profile-save-popup-changes');
        const aboutField = document.getElementById('profile-about');
        const aboutWordCountEl = document.getElementById('profile-about-wordcount');
        let lastSavedPayload = null;
        let lastSavedSignature = '';
        const liveBaselineSignature = payloadSignature(buildProfilePayloadFromRecord(liveUser));

        function snapshotPayload(payload) {
            return JSON.parse(JSON.stringify(payload || {}));
        }

        function syncSavedSnapshot(payload) {
            lastSavedPayload = snapshotPayload(payload);
            lastSavedSignature = payloadSignature(payload);
        }

        function formatArrayChange(label, before, after) {
            const prev = Array.isArray(before) ? before.slice() : [];
            const next = Array.isArray(after) ? after.slice() : [];
            if (JSON.stringify(prev) === JSON.stringify(next)) {
                return null;
            }
            const added = next.filter(function (item) { return prev.indexOf(item) === -1; });
            const removed = prev.filter(function (item) { return next.indexOf(item) === -1; });
            const parts = [];
            if (added.length) parts.push('added ' + added.join(', '));
            if (removed.length) parts.push('removed ' + removed.join(', '));
            return parts.length ? label + ': ' + parts.join('; ') : label + ' updated';
        }

        function formatTextChange(label, before, after) {
            const prev = String(before || '').trim();
            const next = String(after || '').trim();
            if (prev === next) return null;
            if (!prev) return label + ': set to "' + next + '"';
            if (!next) return label + ': cleared (was "' + prev + '")';
            return label + ': "' + prev + '" → "' + next + '"';
        }

        function formatBooleanChange(label, before, after) {
            if (!!before === !!after) return null;
            return label + ': ' + (after ? 'enabled' : 'disabled');
        }

        function formatPaymentMethodsChange(before, after) {
            const labels = {
                cash: 'Cash',
                cheque: 'Cheque',
                visa: 'Visa card',
                mastercard: 'Mastercard',
                paypal: 'Paypal',
                americanExpress: 'American Express',
                bankTransfer: 'Bank Transfer',
                revolut: 'Revolut'
            };
            const prevKeys = Object.keys(labels).filter(function (key) {
                return !!(before && before.paymentMethods && before.paymentMethods[key]);
            });
            const nextKeys = Object.keys(labels).filter(function (key) {
                return !!(after && after.paymentMethods && after.paymentMethods[key]);
            });
            const lines = [];
            const standardChange = formatArrayChange(
                'Payment methods',
                prevKeys.map(function (key) { return labels[key]; }),
                nextKeys.map(function (key) { return labels[key]; })
            );
            if (standardChange) lines.push(standardChange);
            const customChange = formatArrayChange(
                'Custom payment methods',
                before && before.paymentMethodsCustom,
                after && after.paymentMethodsCustom
            );
            if (customChange) lines.push(customChange);
            return lines;
        }

        function collectProfileChanges() {
            if (!lastSavedPayload) return [];
            const current = buildPayload();
            const saved = lastSavedPayload;
            const changes = [];

            [
                ['Business name', saved.businessName, current.businessName],
                ['Business description', saved.description, current.description],
                ['Type of company', saved.companyType, current.companyType],
                ['Town / city area', saved.serviceAreaCity || saved.city, current.serviceAreaCity || current.city],
                ['Contact', saved.phone || saved.contact, current.phone || current.contact]
            ].forEach(function (entry) {
                const line = formatTextChange(entry[0], entry[1], entry[2]);
                if (line) changes.push(line);
            });

            const servicesChange = formatArrayChange('Jobs you specialise in', saved.services, current.services);
            if (servicesChange) changes.push(servicesChange);

            const transportChange = fleetApi
                ? fleetApi.formatFleetChange(saved.providerVehicles, current.providerVehicles)
                : formatArrayChange('Modes of transport', saved.transportModes, current.transportModes);
            if (transportChange) changes.push(transportChange);

            const insuranceChange = insuranceApi
                ? insuranceApi.formatInsuranceChange(saved.providerInsurance, current.providerInsurance)
                : null;
            if (insuranceChange) changes.push(insuranceChange);

            formatPaymentMethodsChange(saved, current).forEach(function (line) {
                changes.push(line);
            });

            const inviteChange = formatBooleanChange('Stop job invitations', saved.blockInvites, current.blockInvites);
            if (inviteChange) changes.push(inviteChange);

            const emailChange = formatBooleanChange('Mute invitation emails', saved.muteInviteEmails, current.muteInviteEmails);
            if (emailChange) changes.push(emailChange);

            const savedPhotos = Array.isArray(saved.photos) ? saved.photos.length : 0;
            const currentPhotos = Array.isArray(current.photos) ? current.photos.length : 0;
            if (savedPhotos !== currentPhotos) {
                changes.push('Photos: ' + savedPhotos + ' → ' + currentPhotos);
            } else if (JSON.stringify(saved.photos || []) !== JSON.stringify(current.photos || [])) {
                changes.push('Photos updated');
            }

            return changes;
        }

        function renderChangeSummaries() {
            const changes = collectProfileChanges();
            const html = changes.map(function (line) {
                return '<li>' + escapeHtml(line) + '</li>';
            }).join('');
            if (changesList) changesList.innerHTML = html;
            if (popupChangesList) popupChangesList.innerHTML = html;
            if (changesPanel) changesPanel.hidden = !changes.length;
        }

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
            const city = String(document.getElementById('profile-city')?.value || '').trim();
            const query = city;
            if (!query) return null;
            const coords = await geocodeServiceAreaQuery(query);
            if (coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lng)) {
                cachedCoords = coords;
            }
            return coords;
        }

        function getCurrentEditorFleet() {
            const fleetRoot = document.getElementById('profile-vehicle-fleet-editor');
            if (vehiclesEditMode && fleetRoot && fleetApi) {
                return fleetApi.collectFleetFromEditor(fleetRoot);
            }
            return editorFleet;
        }

        function getCurrentEditorInsurance() {
            const insuranceRoot = document.getElementById('profile-insurance-editor');
            if (insuranceEditMode && insuranceRoot && insuranceApi) {
                return insuranceApi.collectInsuranceFromEditor(insuranceRoot);
            }
            return editorInsurance;
        }

        function buildPayload() {
            const services = collectCheckedServices();
            const paymentMethods = collectPaymentMethods();
            const paymentMethodsCustom = collectCheckedCustomPaymentMethods();
            const fleet = getCurrentEditorFleet();
            const fleetLegacy = fleetApi
                ? fleetApi.deriveLegacyFromFleet(fleet)
                : { providerVehicles: [], transportModes: collectCheckedTransportModes(), vehicleCount: null };
            const insurance = getCurrentEditorInsurance();
            const city = String(document.getElementById('profile-city')?.value || '').trim();
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
                serviceAreaAddress: '',
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
                transportModes: fleetLegacy.transportModes,
                providerVehicles: fleetLegacy.providerVehicles,
                vehicleCount: fleetLegacy.vehicleCount,
                providerInsurance: insuranceApi
                    ? insurance.map(function (entry) { return insuranceApi.normalizeInsuranceEntry(entry); }).filter(Boolean)
                    : insurance,
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

        function updateSaveUi() {
            const dirty = hasPendingChanges();
            if (saveBtn) {
                saveBtn.disabled = !dirty;
            }
            if (savePopup) {
                savePopup.hidden = !dirty;
            }
            renderChangeSummaries();
            if (dirty && saveStatusEl && !saveStatusEl.classList.contains('is-saving')) {
                const count = collectProfileChanges().length;
                setSaveBadge(count ? ('You have ' + count + ' unsaved change' + (count === 1 ? '' : 's')) : 'You have unsaved changes', '');
            } else if (!dirty && saveStatusEl && !saveStatusEl.classList.contains('is-error')) {
                setSaveBadge('All changes saved', 'saved');
            }
        }

        function markProfileDirty() {
            updateSaveUi();
        }

        function showSaveSuccessModal() {
            if (!saveSuccessModal) return;
            saveSuccessModal.hidden = false;
        }

        function hideSaveSuccessModal() {
            if (!saveSuccessModal) return;
            saveSuccessModal.hidden = true;
        }

        function triggerManualSave() {
            saveProfile({ silent: false }).then(function () {
                showSaveSuccessModal();
            }).catch(function (error) {
                alert(error && error.message ? error.message : 'Unable to save profile.');
            });
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

            const differsFromLiveProfile = signature !== liveBaselineSignature;
            if (signature === lastSavedSignature && !differsFromLiveProfile) {
                setSaveBadge('All changes saved', 'saved');
                updateSaveUi();
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
                console.info('[Provider Profile] save payload', {
                    userId: payload.id,
                    services: payload.services,
                    transportModes: payload.transportModes,
                    paymentMethods: payload.paymentMethods,
                    blockInvites: payload.blockInvites,
                    muteInviteEmails: payload.muteInviteEmails
                });
            } catch (_err) {}

            return Promise.resolve(window.anytransportApi.saveUser(payload)).then(function (serverUser) {
                const pendingReview = !!(serverUser && (serverUser._pendingReview || String(serverUser.profileChangeStatus || '').toLowerCase() === 'pending_review'));
                const saveMessage = serverUser && serverUser._profileSaveMessage ? String(serverUser._profileSaveMessage) : '';
                if (!pendingReview && /no profile changes/i.test(saveMessage)) {
                    throw new Error(saveMessage || 'No profile changes to submit.');
                }
                syncSavedSnapshot(payload);
                setSaveBadge(pendingReview ? 'Submitted for admin review' : 'All changes saved', pendingReview ? '' : 'saved');
                updateSaveUi();
                if (locationStatus) {
                    if (payload.serviceAreaLat && payload.serviceAreaLng) {
                        locationStatus.textContent = 'Map location saved — customers can find you when they search near your area.';
                    } else if (payload.serviceAreaCity) {
                        locationStatus.textContent = 'Town saved, but map coordinates could not be resolved. Check the spelling and try again.';
                    } else {
                        locationStatus.textContent = 'Add a town/city so customers can find you on the map.';
                    }
                }
                if (serverUser && typeof serverUser === 'object' && serverUser.id) {
                    Object.assign(liveUser, serverUser);
                    if (pendingReview) {
                        liveUser.profileChangeStatus = 'pending_review';
                    }
                    delete liveUser._pendingReview;
                    delete liveUser._profileSaveMessage;
                    if (pendingReview) {
                        liveUser._pendingReview = true;
                    }
                    setProfileEditorLiveUser(liveUser);
                    Object.assign(u, getProfileEditorUser(liveUser));
                    if (fleetApi && payload.providerVehicles) {
                        editorFleet = payload.providerVehicles.map(function (entry) {
                            return fleetApi.normalizeVehicleEntry(entry);
                        }).filter(Boolean);
                        editorFleetSnapshot = JSON.parse(JSON.stringify(editorFleet));
                        renderVehicleFleetOverview();
                        setVehicleEditMode(false);
                    }
                    if (insuranceApi && payload.providerInsurance) {
                        editorInsurance = payload.providerInsurance.map(function (entry) {
                            return insuranceApi.normalizeInsuranceEntry(entry);
                        }).filter(Boolean);
                        editorInsuranceSnapshot = JSON.parse(JSON.stringify(editorInsurance));
                        renderInsuranceOverview();
                        setInsuranceEditMode(false);
                    }
                    try {
                        renderPayments(liveUser);
                        renderServices(liveUser);
                        renderVehicleFleet(liveUser);
                        renderInsuranceList(liveUser);
                    } catch (_e) {}
                    const successText = document.getElementById('profile-save-success-text');
                    const successTitle = document.getElementById('profile-save-success-title');
                    if (successText) {
                        successText.textContent = serverUser._profileSaveMessage
                            || (pendingReview
                                ? 'Your profile changes were submitted for admin review. You will receive an email once they are approved or declined.'
                                : 'Your changes have been saved successfully.');
                    }
                    if (successTitle) {
                        successTitle.textContent = pendingReview ? 'Changes submitted' : 'Profile saved';
                    }
                    const bannerHost = root.querySelector('.profile-editor-header > div');
                    if (bannerHost && isEditable) {
                        mountProfileReviewBanner(bannerHost, liveUser);
                    }
                    try {
                        syncPendingProviderNav(liveUser, true);
                    } catch (_navErr) {
                        /* ignore */
                    }
                    const viewer = getViewer();
                    if (viewer && String(viewer.id) === String(serverUser.id) && window.auth) {
                        const merged = typeof window.auth.mergeUserIntoLocalCache === 'function'
                            ? window.auth.mergeUserIntoLocalCache(Object.assign({}, viewer, liveUser, serverUser))
                            : Object.assign({}, viewer, liveUser, serverUser);
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
                updateSaveUi();
                throw error;
            });
        }

        if (saveBtn && isEditable) {
            saveBtn.addEventListener('click', triggerManualSave);
        }
        if (savePopupBtn && isEditable) {
            savePopupBtn.addEventListener('click', triggerManualSave);
        }
        if (saveSuccessDismiss) {
            saveSuccessDismiss.addEventListener('click', hideSaveSuccessModal);
        }
        if (saveSuccessModal) {
            saveSuccessModal.addEventListener('click', function (event) {
                if (event.target === saveSuccessModal) {
                    hideSaveSuccessModal();
                }
            });
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
                    markProfileDirty();
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
                markProfileDirty();
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
            markProfileDirty();
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
                markProfileDirty();
            });
        }

        const fleetOverviewRoot = document.getElementById('profile-vehicle-fleet-overview');
        const fleetEditorWrap = document.getElementById('profile-vehicle-fleet-editor-wrap');
        const fleetEditorRoot = document.getElementById('profile-vehicle-fleet-editor');
        const fleetEditToggle = document.getElementById('profile-vehicle-edit-toggle');
        const fleetEditDone = document.getElementById('profile-vehicle-edit-done');
        const fleetEditCancel = document.getElementById('profile-vehicle-edit-cancel');

        function renderVehicleFleetOverview() {
            if (!fleetOverviewRoot || !fleetApi) return;
            if (editorFleet.length) {
                fleetOverviewRoot.innerHTML = fleetApi.renderPublicFleetHtml(editorFleet);
            } else {
                fleetOverviewRoot.innerHTML = fleetApi.renderOverviewEmptyHtml();
            }
        }

        function mountVehicleFleetEditor() {
            if (!fleetEditorRoot || !fleetApi) return;
            fleetEditorRoot.innerHTML = fleetApi.renderEditorHtml(editorFleet, false);
            fleetApi.bindEditor(fleetEditorRoot, function (collected) {
                editorFleet = collected || fleetApi.collectFleetFromEditor(fleetEditorRoot);
                markProfileDirty();
            });
        }

        function setVehicleEditMode(editing) {
            vehiclesEditMode = !!editing;
            if (fleetOverviewRoot) fleetOverviewRoot.hidden = vehiclesEditMode;
            if (fleetEditorWrap) fleetEditorWrap.hidden = !vehiclesEditMode;
            if (fleetEditToggle) {
                fleetEditToggle.hidden = vehiclesEditMode;
            }
        }

        function openVehicleEditor() {
            editorFleetSnapshot = JSON.parse(JSON.stringify(editorFleet || []));
            mountVehicleFleetEditor();
            setVehicleEditMode(true);
        }

        function finishVehicleEditor(saveChanges) {
            if (saveChanges && fleetEditorRoot && fleetApi) {
                editorFleet = fleetApi.collectFleetFromEditor(fleetEditorRoot);
                renderVehicleFleetOverview();
                markProfileDirty();
            } else {
                editorFleet = JSON.parse(JSON.stringify(editorFleetSnapshot || []));
                renderVehicleFleetOverview();
            }
            setVehicleEditMode(false);
        }

        renderVehicleFleetOverview();
        setVehicleEditMode(false);

        if (fleetEditToggle && isEditable) {
            fleetEditToggle.addEventListener('click', function (e) {
                e.preventDefault();
                openVehicleEditor();
            });
        }
        if (fleetEditDone && isEditable) {
            fleetEditDone.addEventListener('click', function (e) {
                e.preventDefault();
                finishVehicleEditor(true);
            });
        }
        if (fleetEditCancel && isEditable) {
            fleetEditCancel.addEventListener('click', function (e) {
                e.preventDefault();
                finishVehicleEditor(false);
            });
        }

        const insuranceOverviewRoot = document.getElementById('profile-insurance-overview');
        const insuranceEditorWrap = document.getElementById('profile-insurance-editor-wrap');
        const insuranceEditorRoot = document.getElementById('profile-insurance-editor');
        const insuranceEditToggle = document.getElementById('profile-insurance-edit-toggle');
        const insuranceEditDone = document.getElementById('profile-insurance-edit-done');
        const insuranceEditCancel = document.getElementById('profile-insurance-edit-cancel');

        function renderInsuranceOverview() {
            if (!insuranceOverviewRoot || !insuranceApi) return;
            if (editorInsurance.length) {
                insuranceOverviewRoot.innerHTML = insuranceApi.renderPublicInsuranceHtml(editorInsurance);
            } else {
                insuranceOverviewRoot.innerHTML = insuranceApi.renderOverviewEmptyHtml();
            }
        }

        function mountInsuranceEditor() {
            if (!insuranceEditorRoot || !insuranceApi) return;
            insuranceEditorRoot.innerHTML = insuranceApi.renderEditorHtml(editorInsurance, false);
            insuranceApi.bindEditor(insuranceEditorRoot, function (collected) {
                editorInsurance = collected || insuranceApi.collectInsuranceFromEditor(insuranceEditorRoot);
                markProfileDirty();
            });
        }

        function setInsuranceEditMode(editing) {
            insuranceEditMode = !!editing;
            if (insuranceOverviewRoot) insuranceOverviewRoot.hidden = insuranceEditMode;
            if (insuranceEditorWrap) insuranceEditorWrap.hidden = !insuranceEditMode;
            if (insuranceEditToggle) {
                insuranceEditToggle.hidden = insuranceEditMode;
            }
        }

        function openInsuranceEditor() {
            editorInsuranceSnapshot = JSON.parse(JSON.stringify(editorInsurance || []));
            mountInsuranceEditor();
            setInsuranceEditMode(true);
        }

        function finishInsuranceEditor(saveChanges) {
            if (saveChanges && insuranceEditorRoot && insuranceApi) {
                editorInsurance = insuranceApi.collectInsuranceFromEditor(insuranceEditorRoot);
                renderInsuranceOverview();
                markProfileDirty();
            } else {
                editorInsurance = JSON.parse(JSON.stringify(editorInsuranceSnapshot || []));
                renderInsuranceOverview();
            }
            setInsuranceEditMode(false);
        }

        renderInsuranceOverview();
        setInsuranceEditMode(false);

        if (insuranceEditToggle && isEditable) {
            insuranceEditToggle.addEventListener('click', function (e) {
                e.preventDefault();
                openInsuranceEditor();
            });
        }
        if (insuranceEditDone && isEditable) {
            insuranceEditDone.addEventListener('click', function (e) {
                e.preventDefault();
                finishInsuranceEditor(true);
            });
        }
        if (insuranceEditCancel && isEditable) {
            insuranceEditCancel.addEventListener('click', function (e) {
                e.preventDefault();
                finishInsuranceEditor(false);
            });
        }

        renderPhotoPreviews();
        syncSavedSnapshot(buildPayload());
        updateAboutWordCount();
        updateSaveUi();

        function setAccountStatus(message, isError) {
            const statusEl = document.getElementById('profile-account-status');
            if (!statusEl) return;
            statusEl.textContent = String(message || '');
            statusEl.classList.toggle('is-error', !!isError);
        }

        function getProviderPasswordRequirementError(password) {
            if (window.anytransportApi && typeof window.anytransportApi.getProviderPasswordRequirementError === 'function') {
                return window.anytransportApi.getProviderPasswordRequirementError(password);
            }
            const value = String(password || '');
            if (value.length < 6) {
                return 'Password must be at least 6 characters.';
            }
            return '';
        }

        function getProviderLoginPasswordValue() {
            const loginField = document.getElementById('profile-account-login-password');
            const value = String(loginField && loginField.value || '').trim();
            if (!value || value === 'Loading…' || value === '(no password set)' || value === 'Unable to load password') {
                return '';
            }
            return value;
        }

        function loadProviderLoginPassword() {
            const loginField = document.getElementById('profile-account-login-password');
            if (!loginField) {
                return;
            }
            loginField.value = 'Loading…';
            if (!window.anytransportApi || typeof window.anytransportApi.getOwnAccountPassword !== 'function') {
                loginField.value = 'Unable to load password';
                return;
            }
            try {
                const resp = window.anytransportApi.getOwnAccountPassword();
                loginField.value = resp && resp.hasPassword
                    ? String(resp.password || '')
                    : '(no password set)';
            } catch (_error) {
                loginField.value = 'Unable to load password';
            }
            refreshAccountPasswordFormState();
        }

        function refreshAccountPasswordFormState() {
            const newPassword = String(document.getElementById('profile-account-new-password')?.value || '');
            const confirmPassword = String(document.getElementById('profile-account-confirm-password')?.value || '');
            const submitBtn = document.getElementById('profile-account-submit-btn');
            const hintEl = document.getElementById('profile-account-password-hint');
            const passwordError = newPassword ? getProviderPasswordRequirementError(newPassword) : '';
            const passwordsMatch = !!newPassword && newPassword === confirmPassword;
            const hasLoginPassword = !!getProviderLoginPasswordValue();
            const canSubmit = hasLoginPassword && !!newPassword && !!confirmPassword && !passwordError && passwordsMatch;

            if (submitBtn) {
                submitBtn.disabled = !canSubmit;
            }
            if (hintEl) {
                if (!newPassword) {
                    hintEl.textContent = '';
                    hintEl.classList.remove('is-error', 'is-ok');
                } else if (passwordError) {
                    hintEl.textContent = passwordError;
                    hintEl.classList.add('is-error');
                    hintEl.classList.remove('is-ok');
                } else if (!confirmPassword) {
                    hintEl.textContent = 'Confirm your new password to continue.';
                    hintEl.classList.remove('is-error', 'is-ok');
                } else if (!passwordsMatch) {
                    hintEl.textContent = 'Passwords do not match.';
                    hintEl.classList.add('is-error');
                    hintEl.classList.remove('is-ok');
                } else if (!hasLoginPassword) {
                    hintEl.textContent = 'Your current login password could not be loaded.';
                    hintEl.classList.add('is-error');
                    hintEl.classList.remove('is-ok');
                } else {
                    hintEl.textContent = 'Password meets requirements.';
                    hintEl.classList.add('is-ok');
                    hintEl.classList.remove('is-error');
                }
            }
        }

        function clearAccountPasswordFields() {
            ['profile-account-new-password', 'profile-account-confirm-password'].forEach(function (fieldId) {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.value = '';
                }
            });
            refreshAccountPasswordFormState();
        }

        function wireAccountSecurity(accountUser) {
            const accountForm = document.getElementById('profile-account-form');
            if (!accountForm || !isEditable) {
                return;
            }

            loadProviderLoginPassword();

            accountForm.addEventListener('input', function (event) {
                const target = event.target;
                if (!target || !target.id) return;
                if (
                    target.id === 'profile-account-new-password' ||
                    target.id === 'profile-account-confirm-password'
                ) {
                    refreshAccountPasswordFormState();
                }
            });

            refreshAccountPasswordFormState();

            accountForm.addEventListener('submit', function (event) {
                event.preventDefault();
                setAccountStatus('', false);

                if (!window.anytransportApi || typeof window.anytransportApi.updateAccountSettings !== 'function') {
                    setAccountStatus('Password updates are not available right now. Please try again later.', true);
                    return;
                }

                const currentPassword = getProviderLoginPasswordValue();
                const newPassword = String(document.getElementById('profile-account-new-password')?.value || '');
                const confirmPassword = String(document.getElementById('profile-account-confirm-password')?.value || '');

                if (!currentPassword) {
                    setAccountStatus('Your current login password could not be loaded. Refresh the page and try again.', true);
                    return;
                }
                if (!newPassword) {
                    setAccountStatus('Enter a new password to update your login.', true);
                    return;
                }
                if (!confirmPassword) {
                    setAccountStatus('Please confirm your new password.', true);
                    return;
                }
                const passwordRequirementError = getProviderPasswordRequirementError(newPassword);
                if (passwordRequirementError) {
                    setAccountStatus(passwordRequirementError, true);
                    refreshAccountPasswordFormState();
                    return;
                }
                if (newPassword !== confirmPassword) {
                    setAccountStatus('New password and confirmation do not match.', true);
                    return;
                }

                const submitBtn = document.getElementById('profile-account-submit-btn');
                if (submitBtn) submitBtn.disabled = true;

                try {
                    const updatedUser = window.anytransportApi.updateAccountSettings({
                        name: firstText(accountUser.name, accountUser.businessName, accountUser.username, 'Provider'),
                        username: firstText(accountUser.username, accountUser.nickname, accountUser.email),
                        email: firstText(accountUser.email, ''),
                        currentPassword: currentPassword,
                        newPassword: newPassword
                    });
                    if (!updatedUser || !updatedUser.id) {
                        throw new Error('Unable to update your password.');
                    }
                    if (window.auth) {
                        if (typeof window.auth.mergeUserIntoLocalCache === 'function') {
                            window.auth.mergeUserIntoLocalCache(updatedUser);
                        }
                        window.auth.currentUser = Object.assign({}, window.auth.getUser ? window.auth.getUser() : {}, updatedUser);
                        if (typeof window.auth.setStoredCurrentUser === 'function') {
                            window.auth.setStoredCurrentUser(window.auth.currentUser);
                        }
                    }
                    clearAccountPasswordFields();
                    const emailField = document.getElementById('profile-account-email');
                    if (emailField) {
                        emailField.value = firstText(updatedUser.email, accountUser.email, '');
                    }
                    const loginField = document.getElementById('profile-account-login-password');
                    if (loginField) {
                        loginField.value = newPassword;
                    }
                    setAccountStatus('Your password was updated successfully.', false);
                    refreshAccountPasswordFormState();
                } catch (error) {
                    setAccountStatus(error && error.message ? error.message : 'Unable to update your password.', true);
                } finally {
                    if (submitBtn) submitBtn.disabled = false;
                }
            });
        }

        if (isEditable) {
            wireAccountSecurity(liveUser);
        }

        if (form && isEditable) {
            form.addEventListener('change', function () {
                markProfileDirty();
            });
            form.addEventListener('input', function (event) {
                const target = event.target;
                if (!target) return;
                if (target.id === 'profile-about') {
                    updateAboutWordCount();
                }
                markProfileDirty();
            });
            form.addEventListener('submit', function (event) {
                event.preventDefault();
                triggerManualSave();
            });
            window.addEventListener('beforeunload', function (event) {
                if (!hasPendingChanges()) return;
                event.preventDefault();
                event.returnValue = '';
                if (typeof window.anytransportHidePageLoader === 'function') {
                    window.setTimeout(function () {
                        window.anytransportHidePageLoader();
                    }, 0);
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
