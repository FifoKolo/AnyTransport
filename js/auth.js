// Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = this.loadUser();
        this.initAuth();
    }

    // Initialize authentication UI based on login state
    initAuth() {
        const authMenu = document.getElementById('auth-menu');
        const userMenu = document.getElementById('user-menu');

        if (this.currentUser) {
            if (authMenu) authMenu.style.display = 'none';
            if (userMenu) userMenu.style.display = 'flex';
            this.updateUserDisplay();
        } else {
            if (authMenu) authMenu.style.display = 'flex';
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    // Update user display in navbar
    updateUserDisplay() {
        const userName = document.getElementById('user-name');
        const userEmail = document.getElementById('user-email');
        const navbarUserName = document.getElementById('navbar-user-name');
        const navbarUserAvatar = document.getElementById('navbar-user-avatar');

        if (userName) userName.textContent = this.currentUser.name || 'User';
        if (userEmail) userEmail.textContent = this.currentUser.email || '';
        if (navbarUserName) navbarUserName.textContent = this.currentUser.name || 'Profile';
        if (navbarUserAvatar && this.currentUser.name) {
            navbarUserAvatar.textContent = this.currentUser.name.charAt(0).toUpperCase();
        }
    }

    // Login user
    login(email, password) {
        // Mock authentication - in production, this would call a backend API
        const user = {
            id: Math.random().toString(36).substr(2, 9),
            email: email,
            password: password, // Should NOT be stored client-side in production
            name: email.split('@')[0],
            role: 'customer',
            phone: '',
            city: '',
            createdAt: new Date()
        };

        this.currentUser = user;
        this.saveUser(user);
        this.initAuth();
        return user;
    }

    // Sign up user
    signup(formData) {
        const user = {
            id: Math.random().toString(36).substr(2, 9),
            name: formData.name,
            email: formData.email,
            password: formData.password, // Should NOT be stored client-side in production
            phone: formData.phone,
            city: formData.city,
            role: formData.role,
            createdAt: new Date()
        };

        this.currentUser = user;
        this.saveUser(user);
        this.initAuth();
        return user;
    }

    // Logout user
    logout() {
        this.currentUser = null;
        localStorage.removeItem('anytransport_user');
        this.initAuth();
        window.location.href = 'index.html';
    }

    // Save user to localStorage
    saveUser(user) {
        localStorage.setItem('anytransport_user', JSON.stringify(user));
    }

    // Load user from localStorage
    loadUser() {
        const userData = localStorage.getItem('anytransport_user');
        return userData ? JSON.parse(userData) : null;
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getUser() {
        return this.currentUser;
    }

    // Check if user is provider
    isProvider() {
        const roles = this.currentUser?.roles || [this.currentUser?.role];
        return roles.includes('provider');
    }

    // Check if user is customer
    isCustomer() {
        const roles = this.currentUser?.roles || [this.currentUser?.role];
        return roles.includes('customer');
    }
}

// Initialize auth manager
const auth = new AuthManager();

// Modal Functions
function openLoginModal() {
    try {
        sessionStorage.setItem('anytransport_auth_return_url', window.location.href);
    } catch (_error) {
        // Ignore storage access issues; auth flow still works with default redirect.
    }
    document.getElementById('login-modal').classList.add('show');
}

function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.classList.remove('show');
        // Hide notice when closing
        const notice = document.getElementById('login-modal-notice');
        if (notice) {
            notice.style.display = 'none';
        }
    }
}

function openSignupModal() {
    document.getElementById('signup-modal').classList.add('show');
}

function closeSignupModal() {
    document.getElementById('signup-modal').classList.remove('show');
}

function switchToSignup() {
    closeLoginModal();
    openSignupModal();
}

function switchToLogin() {
    closeSignupModal();
    openLoginModal();
}

// Handle Login Form Submission
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const email = this.querySelector('input[type="email"]').value;
        const password = this.querySelector('input[type="password"]').value;

        if (email && password) {
            auth.login(email, password);
            closeLoginModal();
            
            // Check if we're redirecting after form submission
            const pendingQuote = localStorage.getItem('pending_quote_submission');
            if (pendingQuote) {
                localStorage.removeItem('pending_quote_submission');
                showConfirmationModal();
            } else {
                const returnUrl = sessionStorage.getItem('anytransport_auth_return_url');
                if (returnUrl) {
                    sessionStorage.removeItem('anytransport_auth_return_url');
                    window.location.href = returnUrl;
                    return;
                }
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            }
        }
    });
}

// Handle Signup Form Submission
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const nameInput = this.querySelector('input[name="name"]');
        const emailInput = this.querySelector('#signup-email');
        const emailConfirmInput = this.querySelector('#signup-email-confirm');
        const passwordInput = this.querySelector('#signup-password');
        const passwordConfirmInput = this.querySelector('#signup-password-confirm');
        
        const formData = {
            name: nameInput.value,
            email: emailInput.value,
            emailConfirm: emailConfirmInput.value,
            password: passwordInput.value,
            confirmPassword: passwordConfirmInput.value,
            phone: '',
            city: '',
            role: 'customer'
        };

        // Validate emails match
        if (formData.email !== formData.emailConfirm) {
            alert('Email addresses do not match. Please try again.');
            return;
        }

        // Validate passwords match
        if (formData.password !== formData.confirmPassword) {
            alert('Passwords do not match. Please try again.');
            return;
        }

        if (formData.name && formData.email && formData.password) {
            auth.signup(formData);
            closeSignupModal();
            
            // Check if we're redirecting after form submission
            const pendingQuote = localStorage.getItem('pending_quote_submission');
            if (pendingQuote) {
                localStorage.removeItem('pending_quote_submission');
                showConfirmationModal();
            } else {
                const returnUrl = sessionStorage.getItem('anytransport_auth_return_url');
                if (returnUrl) {
                    sessionStorage.removeItem('anytransport_auth_return_url');
                    window.location.href = returnUrl;
                    return;
                }
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            }
        } else {
            alert('Please fill in all fields');
        }
    });
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.logout();
    }
}

// Toggle password visibility
function togglePasswordVisibility(button) {
    const container = button.parentElement;
    const passwordInput = container.querySelector('input[type="password"], input[type="text"]');
    
    if (passwordInput) {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        button.textContent = isPassword ? 'Hide' : 'Show';
    }
}

// Close modals when clicking outside - track if mousedown started in content
let mouseDownInContent = false;

window.addEventListener('mousedown', function(event) {
    const modalContent = event.target.closest('.modal-content');
    mouseDownInContent = !!modalContent;
});

window.addEventListener('click', function(event) {
    // Only close if mousedown didn't start in modal content
    if (mouseDownInContent) {
        mouseDownInContent = false;
        return;
    }

    const loginModal = document.getElementById('login-modal');
    const signupModal = document.getElementById('signup-modal');
    const confirmationModal = document.getElementById('confirmation-modal');
    const jobDetailsModal = document.getElementById('job-details-modal');

    // Only close if clicking on the modal background itself, not content inside
    if (loginModal && event.target === loginModal) {
        closeLoginModal();
    }
    if (signupModal && event.target === signupModal) {
        closeSignupModal();
    }
    if (confirmationModal && event.target === confirmationModal) {
        closeConfirmationModal();
    }
    if (jobDetailsModal && event.target === jobDetailsModal) {
        closeJobDetails();
    }
});

// Protect pages that require authentication
function requireLogin() {
    if (!auth.isLoggedIn()) {
        alert('Please log in to access this page');
        window.location.href = 'index.html';
    }
}

// Run on page load for protected pages
if (document.body.classList.contains('protected')) {
    requireLogin();
}

// Confirmation Modal Functions
function showConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        const emailSpan = document.getElementById('confirmation-email');
        if (emailSpan) {
            const chosenEmail = String(window.anytransportQuoteContactEmail || '').trim();
            if (chosenEmail) {
                emailSpan.textContent = chosenEmail;
            } else if (auth.currentUser) {
                emailSpan.textContent = auth.currentUser.email;
            }
        }
        modal.classList.add('show');
    }
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmation-modal');
    if (modal) {
        modal.classList.remove('show');
    }
    window.anytransportQuoteContactEmail = '';
}
