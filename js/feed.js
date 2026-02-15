// Job Feed Manager - Deprecated
// This file is no longer in use. The service is quote-only now.

class JobFeed {
    constructor() {
        this.jobs = [];
        this.filteredJobs = [];
    }

    loadJobs() {
        return JSON.parse(localStorage.getItem('anytransport_jobs') || '[]');
    }

    renderJobs() {
        const container = document.getElementById('jobs-container');
        if (!container) return;
        container.innerHTML = '<p>Job feed is currently disabled. Please use the quote system instead.</p>';
    }

    initEventListeners() {
        // Feed initialization disabled
    }
}

// Initialize on document ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Feed initialization disabled
    });
}
