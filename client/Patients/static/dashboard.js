async function loadDashboardData() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/hospital-login';
        return;
    }

    try {
        const response = await fetch('/api/dashboard-data', {
            method: 'GET',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const emergencies = await response.json();
            displayEmergencies(emergencies);
        } else {
            const error = await response.json();
            console.error('Dashboard error:', error);
            if (response.status === 401) {
                // Token invalid or expired
                localStorage.removeItem('token');
                window.location.href = '/hospital-login';
            }
        }
    } catch (error) {
        console.error('Dashboard error:', error);
        alert('Error loading dashboard data');
    }
}

function displayEmergencies(emergencies) {
    const patientList = document.getElementById('patient-list');
    patientList.innerHTML = '';

    if (emergencies.length === 0) {
        patientList.innerHTML = '<p>No emergencies found</p>';
        return;
    }

    emergencies.forEach(emergency => {
        const emergencyDiv = document.createElement('div');
        emergencyDiv.className = 'emergency-card';
        emergencyDiv.innerHTML = `
            <h3>${emergency.hospitalName}</h3>
            <p>Severity: ${emergency.severity}</p>
            <p>Emergency Type: ${emergency.emergencyType}</p>
            <p>ETA: ${emergency.eta} minutes</p>
            <p>Timestamp: ${emergency.timestamp}</p>
        `;
        patientList.appendChild(emergencyDiv);
    });
}

// Add logout functionality
document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/hospital-login';
});

// Load dashboard data when page loads
document.addEventListener('DOMContentLoaded', loadDashboardData);

function fetchIncomingPatients() {
    fetch('/get_incoming_patients')
        .then(response => response.json())
        .then(cases => {
            console.log('Emergency cases:', cases); // Debug line
            const incomingList = document.getElementById('incoming-list');
            incomingList.innerHTML = '';
            
            if (cases.length === 0) {
                incomingList.innerHTML = '<p>No emergency cases found</p>';
                return;
            }

            cases.forEach(emergency => {
                const emergencyDiv = document.createElement('div');
                emergencyDiv.className = 'emergency-case';
                emergencyDiv.innerHTML = `
                    <h3>${emergency.hospitalName || 'Unknown Hospital'}</h3>
                    <p>Severity: ${emergency.severity || 'Not specified'}</p>
                    <p>Emergency Type: ${emergency.emergencyType || 'Not specified'}</p>
                    <p>ETA: ${emergency.eta || 'Unknown'} minutes</p>
                    <p>Timestamp: ${emergency.timestamp || 'No timestamp'}</p>
                `;
                incomingList.appendChild(emergencyDiv);
            });
        })
        .catch(error => {
            console.error('Error fetching emergency cases:', error);
            const incomingList = document.getElementById('incoming-list');
            incomingList.innerHTML = '<p>Error loading emergency cases</p>';
        });
}

// Call this function when page loads
document.addEventListener('DOMContentLoaded', fetchIncomingPatients);
