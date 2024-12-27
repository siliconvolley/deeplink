document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault(); // Prevent the default form submission behavior

    const hospitalName = document.getElementById('hospital-name').value.trim();
    const password = document.getElementById('password').value.trim();
    const errorMessage = document.getElementById('error-message');

    // Clear any previous error messages
    errorMessage.textContent = '';

    if (!hospitalName || !password) {
        errorMessage.textContent = 'Please enter both hospital name and password.';
        return;
    }

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hospitalName, password }) // Send data to the server
        });

        const data = await response.json();

        if (response.ok) {
            // Store the token and redirect to dashboard
            localStorage.setItem('token', data.token);
            window.location.href = 'dashboard.html'; // Redirect to dashboard
        } else {
            // Display error message received from the server
            errorMessage.textContent = data.message || 'Invalid login credentials. Please try again.';
        }
    } catch (error) {
        // Display a fallback error message in case of network issues
        errorMessage.textContent = 'An error occurred while logging in. Please try again later.';
    }
});
