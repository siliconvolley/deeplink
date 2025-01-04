import { map } from "./map.js";
import { initialize } from "./main.js";
import { selectedSeverity, selectedEmergencyType } from "./eventListeners.js";
import { currentLat, currentLon } from "./userLocation.js";
import { findNearestHospital } from "./findHospital.js";

document.getElementById("ambulance-form").addEventListener("submit", function(e) {
    e.preventDefault();
    if (selectedSeverity && selectedEmergencyType) {
        if (currentLat !== null && currentLon !== null) {
            // const startLat = currentLat;
            // const startLon = currentLon;

            // Use specified location
            const startLat = 12.883821;
            const startLon = 74.839737;

            // ! towards Traffic Signal 5 
            // let closeT3Lat = 12.88543; 
            // let closeT3Lon = 74.839345;

            // let farT3Lat = 12.885443;
            // let farT3Lon = 74.840959;

            // ! towards Traffic Signal 1
            // let closeT1Lat = 12.885017;
            // let closeT1Lon = 74.838874;

            // let farT1Lat = 12.882632;
            // let farT1Lon = 74.839147;

            // ! towards Traffic Signal 2
            // let closeT2Lat = 12.886133;
            // let closeT2Lon = 74.838792;

            // let farT2Lat = 12.886675;
            // let farT2Lon = 74.838600;

            // ! B.C. Road
            // let currentLat = 12.878200;
            // let currentLon = 75.034000;

            map.setView([startLat, startLon], 13);
            initialize();
            findNearestHospital(startLat, startLon);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("Unable to retrieve your current location. Please try again.");
        }
    } else {
        alert("Please select both severity and emergency type");
    }
});
