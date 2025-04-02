async function fetchPatients() {
  const token = localStorage.getItem("token");

  if (!token) {
    console.error("No token found, redirecting to login...");
    window.location.href = "hospital-login";
    return;
  }

  try {
    const response = await fetch("/api/patients", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 403) {
      console.error("Token expired or invalid, redirecting to login...");
      localStorage.removeItem("token");
      window.location.href = "hospital-login";
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const patients = await response.json();
    updatePatientList(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    if (error.message.includes("token")) {
      localStorage.removeItem("token");
      window.location.href = "hospital-login";
    }
  }
}

function updatePatientList(patients) {
  const patientList = document.getElementById("patient-list");
  patientList.innerHTML = ""; // Clear any existing content

  if (patients.length === 0) {
    patientList.innerHTML = "<p>No incoming patients 🚑</p>";
  } else {
    patients.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Sort patients by timestamp in descending order

    patients.forEach((patient) => {
      const patientDiv = document.createElement("div");
      patientDiv.classList.add("patient-div"); // Add class for styling

      // Determine the hospital name color based on severity
      let severityClass = "";
      switch (patient.severity.toLowerCase()) {
        case "low":
          severityClass = "hospital-low";
          break;
        case "moderate":
          severityClass = "hospital-medium";
          break;
        case "high":
          severityClass = "hospital-high";
          break;
        default:
          severityClass = ""; // Default if severity isn't recognized
      }

      patientDiv.innerHTML = `
                <h3 class="${severityClass}">${patient.hospitalName}</h3>
                <p>Patient ID: ${patient["patient-id"] || "N/A"}</p>
                <p>Severity: ${patient.severity}</p>
                <p>Emergency Type: ${patient.emergencyType}</p>
                <p>ETA: ${patient.eta} minutes</p>
                <p>Timestamp: ${new Date(
                  patient.timestamp
                ).toLocaleString()}</p>
            `;

      patientList.appendChild(patientDiv); // Append each patient to the list
    });
  }
}

// Logout button functionality
document.getElementById("logout-button").addEventListener("click", function () {
  localStorage.removeItem("token");
  window.location.href = "hospital-login";
});

// Auto-refresh patients every 30 seconds
setInterval(fetchPatients, 30000);

// Initial fetch
fetchPatients();
