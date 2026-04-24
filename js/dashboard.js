// Dashboard Page
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
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });

    const target = document.getElementById(tabName);
    if (target) target.classList.add('active');

    const navItem = document.querySelector(`[data-tab="${tabName}"]`);
    if (navItem) navItem.classList.add('active');
}

// Load user's quote requests
function loadMyQuotes(userId) {
    const jobs = JSON.parse(localStorage.getItem('anytransport_quote_requests') || '[]');
    const myQuotes = jobs.filter(job => job.createdBy === userId);

    const container = document.getElementById('my-quotes-list');
    if (!container) return;

    if (myQuotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <h3>No quotes requested yet</h3>
                <p>Request your first quote to get started</p>
                <a href="create-job.html" class="btn btn-primary">Get a Quote</a>
            </div>
        `;
        return;
    }

    container.innerHTML = myQuotes.map(job => createDashboardJobCard(job)).join('');
}

// Create dashboard card for a quote/job entry
function createDashboardJobCard(job) {
    const statusClass = job.status === 'claimed' ? 'claimed' : 'available';
    const statusLabel = job.status === 'claimed' ? 'CLAIMED' : 'PENDING';

    let actionButtons = '';
    if (job.createdBy === auth.getUser().id) {
        actionButtons = `
            <button class="btn btn-secondary" onclick="editJob('${job.id}')">Edit</button>
            <button class="btn btn-outline" onclick="deleteJob('${job.id}')">Delete</button>
        `;
    }

    return `
        <div class="job-card ${statusClass}">
            <div class="job-header">
                <div>
                    <h3 class="job-title">${job.title || 'Quote request'}</h3>
                    <div class="job-meta">
                        ${job.preferredDate ? `<span class="job-meta-item">📅 ${formatDate(job.preferredDate)}</span>` : ''}
                    </div>
                </div>
                <span class="job-status ${statusClass}">${statusLabel}</span>
            </div>

            ${job.description ? `<p class="job-description">${job.description}</p>` : ''}

            <div class="job-locations">
                <div class="location-item">
                    <div class="location-label">📍 From</div>
                    <div class="location-value">${job.pickupCity || 'N/A'}</div>
                </div>
                <div class="location-item">
                    <div class="location-label">📍 To</div>
                    <div class="location-value">${job.deliveryCity || 'N/A'}</div>
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

// Load and handle profile form
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
function editJob(jobId) {
    alert('Edit feature will be implemented soon');
}

// Delete quote/job
function deleteJob(jobId) {
    if (!confirm('Are you sure you want to delete this request?')) return;
    const jobs = JSON.parse(localStorage.getItem('anytransport_quote_requests') || '[]');
    const filtered = jobs.filter(job => job.id !== jobId);
    try {
        localStorage.setItem('anytransport_quote_requests', JSON.stringify(filtered));
    } catch (error) {
        const message = String((error && error.message) || '').toLowerCase();
        if (message.includes('quota')) {
            alert('Storage is full. Please remove old requests or large attachments and try again.');
            return;
        }
        throw error;
    }
    alert('Request deleted successfully');
    const user = auth.getUser();
    if (user) loadMyQuotes(user.id);
}
