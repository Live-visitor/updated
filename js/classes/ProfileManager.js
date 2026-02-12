class ProfileManager {
    toggleDropdown() {
        const dropdown = document.getElementById('profile-dropdown');
        if (!dropdown) return;
        
        const isShowing = dropdown.classList.contains('show');
        
        const notificationDropdown = document.getElementById('notification-dropdown');
        if (notificationDropdown) {
            notificationDropdown.classList.remove('show');
        }
        
        if (!isShowing) {
            dropdown.classList.add('show');
        } else {
            dropdown.classList.remove('show');
        }
    }

    handleLogout() {
        if (!confirm('Are you sure you want to logout?')) return;

        (async () => {
            try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
            localStorage.removeItem('isLoggedIn');
            localStorage.removeItem('userData');
            window.location.href = 'login.html';
        })();
    }
}

// Expose globally for non-module script tags
window.ProfileManager = ProfileManager;
