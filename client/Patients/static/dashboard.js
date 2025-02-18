async function fetchPatients() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        console.error("No token found, redirecting to login...");
        window.location.href = 'hospital-login'; // Redirect to login if no token
        return;
    }

    try {
        const response = await fetch('/api/patients', {
            method: 'GET',
            headers: {
                'Authorization': token
            }
        });

        if (!response.ok) {
            throw new Error("Failed to fetch patients, please try again.");
        }

        const patients = await response.json();
        
        // Sort patients by timestamp in descending order (newest first)
        patients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        const patientList = document.getElementById('patient-list');
        patientList.innerHTML = '';  // Clear any existing content

        if (patients.length === 0) {
            patientList.innerHTML = '<p>No incoming patients.</p>';
        } else {
            patients.forEach(patient => {
                const patientDiv = document.createElement('div');
                patientDiv.classList.add('patient-div'); // Add class for styling

                // Determine the hospital name color based on severity
                let severityClass = '';
                switch (patient.severity.toLowerCase()) {
                    case 'low':
                        severityClass = 'hospital-low';
                        break;
                    case 'moderate':
                        severityClass = 'hospital-medium';
                        break;
                    case 'high':
                        severityClass = 'hospital-high';
                        break;
                    default:
                        severityClass = ''; // Default if severity isn't recognized
                }

                patientDiv.innerHTML = `
                    <h3 class="${severityClass}">${patient.hospitalName}</h3>
                    <p>Patient ID: ${patient['patient-id'] || 'N/A'}</p>
                    <p>Severity: ${patient.severity}</p>
                    <p>Emergency Type: ${patient.emergencyType}</p>
                    <p>ETA: ${patient.eta} minutes</p>
                    <p>Timestamp: ${new Date(patient.timestamp).toLocaleString()}</p>
                `;

                patientList.appendChild(patientDiv); // Append each patient to the list
            });
        }

    } catch (error) {
        console.error(error.message);
        document.getElementById('patient-list').innerHTML = '<p>Error fetching patients. Please try again.</p>';
    }
}

// Logout button functionality
document.getElementById('logout-button').addEventListener('click', function() {
    localStorage.removeItem('token'); // Remove the token
    window.location.href = 'hospital-login'; // Redirect to the login page
});

// Fetch patients when the dashboard loads
fetchPatients();
