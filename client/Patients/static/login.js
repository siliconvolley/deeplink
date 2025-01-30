document.getElementById('login-form').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const formData = {
        hospitalName: document.getElementById('hospitalName').value,
        password: document.getElementById('password').value
    };

    try {
        console.log('Attempting login with:', formData.hospitalName);
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        
        if (response.ok) {
            console.log('Login successful');
            localStorage.setItem('token', data.token);
            window.location.href = '/dashboard';
        } else {
            console.error('Login failed:', data.message);
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error details:', error);
        alert('Login error: ' + error.message);
    }
});
