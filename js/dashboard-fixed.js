// Dashboard Page (quotes only)
// Handles user info display, tab navigation, and quote listings

document.addEventListener('DOMContentLoaded', () => {
    // Require login
    if (!auth || !auth.isLoggedIn || !auth.isLoggedIn()) {
        alert('You need to sign in to access your dashboard');
        window.location.href = 'index.html';
        return;
    }

    const user = auth.getUser();
    if (!user) {
        alert('Session expired. Please sign in again.');
        window.location.href = 'index.html';
        return;
    }

    loadUserInfo(user);
    wireTabs();

    // Default tab
    showTab('my-quotes');

    // Load data
    loadMyQuotes(user.id);
    loadProfileForm(user);
});

function wireTabs() {
    const tabItems = document.querySelectorAll('.nav-item[data-tab]');
    tabItems.forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');
            showTab(tabName);
        });
    });
}

// Sidebar user info
function loadUserInfo(user) {
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');

    if (userName) userName.textContent = user.name || 'User';
    if (userEmail) userEmail.textContent = user.email || '';
    if (userAvatar && user.name) {
        userAvatar.textContent = user.name.charAt(0).toUpperCase();
    }
}

// Tab switching
function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));

    const target = document.getElementById(tabName);
    if (target) target.classList.add('active');

    const navItem = document.querySelector(`[data-tab="${tabName}"]`);
    if (navItem) navItem.classList.add('active');
}

// Load user's quote requests
function loadMyQuotes(userId) {
    const quotes = JSON.parse(localStorage.getItem('anytransport_quote_requests') || '[]');
    const myQuotes = quotes.filter(q => q.createdBy === userId);

    const container = document.getElementById('my-quotes-list');
    if (!container) return;

    if (myQuotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No quotes requested yet</h3>
                <p>Request your first quote to get started</p>
                <a href="index.html" class="btn btn-primary">Get a Quote</a>
            </div>
        `;
        return;
    }

    container.innerHTML = myQuotes.map(quote => createDashboardQuoteCard(quote)).join('');
}

// Create dashboard card for a quote entry
function createDashboardQuoteCard(quote) {
    const statusClass = quote.status === 'claimed' ? 'claimed' : 'pending';
    const statusLabel = quote.status === 'claimed' ? 'CLAIMED' : 'PENDING';

    let actionButtons = '';
    if (quote.createdBy === auth.getUser().id || !quote.createdBy) {
        actionButtons = `
            <button class="btn btn-secondary" onclick="editQuote('${quote.id}')">Edit</button>
            <button class="btn btn-outline" onclick="deleteQuote('${quote.id}')">Delete</button>
        `;
    }

    return `
        <div class="job-card ${statusClass}">
            <div class="job-header">
                <div>
                    <h3 class="job-title">${quote.title || 'Quote request'}</h3>
                    <div class="job-meta">
                        ${quote.preferredDate ? `<span class="job-meta-item">📅 ${formatDate(quote.preferredDate)}</span>` : ''}
                        ${quote.budget ? `<span class="job-meta-item">💰 €${Number(quote.budget).toFixed(2)}</span>` : ''}
                    </div>
                </div>
                <span class="job-status ${statusClass}">${statusLabel}</span>
            </div>

            ${quote.description ? `<p class="job-description">${quote.description}</p>` : ''}

            <div class="job-locations">
                <div class="location-item">
                    <div class="location-label">📍 From</div>
                    <div class="location-value">${quote.pickupCity || quote.pickupLocation || 'N/A'}</div>
                </div>
                <div class="location-item">
                    <div class="location-label">📍 To</div>
                    <div class="location-value">${quote.deliveryCity || quote.dropoffLocation || 'N/A'}</div>
                </div>
            </div>

            <div class="job-footer">
                <div class="job-actions">
                    ${actionButtons}
                </div>
            </div>
        </div>
    `;
}

// Format date helper
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-IE', options);
}

// Load and handle profile form (roles removed)
function loadProfileForm(user) {
    const nameEl = document.getElementById('profile-name');
    const emailEl = document.getElementById('profile-email');
    const phoneEl = document.getElementById('profile-phone');
    const cityEl = document.getElementById('profile-city');
    const profileForm = document.getElementById('profile-form');

    if (nameEl) nameEl.value = user.name || '';
    if (emailEl) emailEl.value = user.email || '';
    if (phoneEl) phoneEl.value = user.phone || '';
    if (cityEl) cityEl.value = user.city || '';

    if (profileForm) {
        profileForm.addEventListener('submit', e => {
            e.preventDefault();
            user.name = nameEl ? nameEl.value : user.name;
            user.email = emailEl ? emailEl.value : user.email;
            user.phone = phoneEl ? phoneEl.value : user.phone;
            user.city = cityEl ? cityEl.value : user.city;

            auth.saveUser(user);
            alert('Profile updated successfully!');
        });
    }
}

// Placeholder edit
function editQuote(quoteId) {
    alert('Edit feature will be implemented soon');
}

// Delete quote
function deleteQuote(quoteId) {
    if (!confirm('Are you sure you want to delete this request?')) return;
    const quotes = JSON.parse(localStorage.getItem('anytransport_quote_requests') || '[]');
    const filtered = quotes.filter(q => q.id !== quoteId);
    localStorage.setItem('anytransport_quote_requests', JSON.stringify(filtered));
    alert('Request deleted successfully');
    const user = auth.getUser();
    if (user) loadMyQuotes(user.id);
}
