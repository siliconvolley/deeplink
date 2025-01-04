export function displayHospitalInfo(hospitalName, severity, emergencyType, eta) {
    document.getElementById("hospital-info").style.display = "block";
    document.getElementById("hospital-name").textContent = `Hospital: ${hospitalName}`;
    document.getElementById("hospital-severity").textContent = `Severity: ${severity}`;
    document.getElementById("hospital-condition").textContent = `Emergency: ${emergencyType}`;
    document.getElementById("hospital-eta").textContent = `ETA: ${eta} minutes`;
}

export function sendEmergency(hospitalName, severity, emergencyType, eta) {
    fetch("http://localhost:5000/submit-patient", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            hospitalName,
            severity,
            emergencyType,
            eta
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            console.log("Success:", data.message);
        } else {
            console.error("Error:", data.error);
        }
    })
    .catch(error => console.error("Error:", error));
}
