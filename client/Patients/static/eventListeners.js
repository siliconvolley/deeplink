let selectedSeverity = null;
let selectedEmergencyType = null;

document.querySelectorAll(".severity-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".severity-btn").forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        selectedSeverity = this.getAttribute("data-severity");
    });
});

document.querySelectorAll(".emergency-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
        document.querySelectorAll(".emergency-btn").forEach((b) => b.classList.remove("active"));
        this.classList.add("active");
        selectedEmergencyType = this.getAttribute("data-emergency");
    });
});

export { selectedSeverity, selectedEmergencyType };
