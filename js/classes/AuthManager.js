class AuthManager {
    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorMessage = document.getElementById('errorMessage');

        errorMessage.style.display = 'none';
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (data && data.ok) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userData', JSON.stringify({
                    name: data.user.full_name,
                    email: data.user.email,
                    age: data.user.age,
                    user_id: data.user.id,
                    is_admin: !!data.user.is_admin,
                }));
                window.location.href = 'index.html';
            } else {
                if (data && data.error === 'suspended') {
                    const until = data.suspended_until ? ` until ${data.suspended_until}` : '';
                    errorMessage.textContent = `Your account is suspended${until}. Please try again later.`;
                } else {
                    errorMessage.textContent = (data && data.error) ? `Login failed: ${data.error}` : 'Invalid email or password.';
                }
                errorMessage.style.display = 'block';
            }
        } catch (e) {
            errorMessage.textContent = 'Login failed. Please try again.';
            errorMessage.style.display = 'block';
        }
    }

    async handleSignup(event) {
        event.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const age = document.getElementById('age').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorMessage = document.getElementById('errorMessage');
        const successMessage = document.getElementById('successMessage');

        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        if (password !== confirmPassword) {
            errorMessage.textContent = 'Passwords do not match. Please try again.';
            errorMessage.style.display = 'block';
            return;
        }

        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: name,
                    email,
                    age: Number(age || 0) || null,
                    password,
                })
            });
            const data = await res.json();
            if (data && data.ok) {
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userData', JSON.stringify({
                    name: data.user.full_name,
                    email: data.user.email,
                    age: data.user.age,
                    user_id: data.user.id,
                    is_admin: !!data.user.is_admin,
                }));
                successMessage.textContent = 'Account created successfully! Redirecting...';
                successMessage.style.display = 'block';
                setTimeout(() => { window.location.href = 'index.html'; }, 800);
            } else {
                errorMessage.textContent = (data && data.error) ? `Signup failed: ${data.error}` : 'Signup failed.';
                errorMessage.style.display = 'block';
            }
        } catch (e) {
            errorMessage.textContent = 'Signup failed. Please try again.';
            errorMessage.style.display = 'block';
        }
    }
}

// Expose globally for non-module script tags
window.AuthManager = AuthManager;
