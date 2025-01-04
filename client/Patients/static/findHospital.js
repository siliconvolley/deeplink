import { map } from './map.js';
import { haversine } from './utils.js';
import { displayHospitalInfo, sendEmergency } from './hospitalInfo.js';
import { selectedSeverity, selectedEmergencyType } from './eventListeners.js';
import { checkTriggerPoints, moveVehicleAlongRoute } from './ambulanceSimulation.js';

export function findNearestHospital(lat, lon) {
    let hospitalRange = 10000;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=hospital](around:${hospitalRange},${lat},${lon});out;`;

    fetch(overpassUrl)
        .then(response => response.json())
        .then(data => {
            if (data.elements.length > 0) {
                let nearestHospital = null;
                let minDistance = Infinity;

                data.elements.forEach(hospital => {
                    const distance = haversine(lat, lon, hospital.lat, hospital.lon);
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestHospital = {
                            lat: hospital.lat,
                            lon: hospital.lon,
                            name: hospital.tags.name || "Unnamed Hospital"
                        };
                    }
                });

                showRoute(lat, lon, nearestHospital.lat, nearestHospital.lon, nearestHospital.name);
            } else {
                alert("No hospitals found within 5km");
            }
        })
        .catch(error => console.error("Error:", error));
}

function showRoute(startLat, startLon, endLat, endLon, hospitalName) {
    if (window.routeControl) {
        map.removeControl(window.routeControl);
    }

    window.routeControl = L.Routing.control({
        waypoints: [
            L.latLng(startLat, startLon),
            L.latLng(endLat, endLon)
        ],
        routeWhileDragging: false,
        addWaypoints: false,
        lineOptions: {
            styles: [{ color: "blue", weight: 5 }]
        },
        createMarker: function() {
            return null;
        },
        router: L.Routing.osrmv1({
            serviceUrl: 'http://router.project-osrm.org/route/v1',
            profile: 'driving',
            timeout: 30000
        }),
        show: true
    })
    .on('routesfound', function(e) {
        let route = e.routes[0];
        let time = route.summary.totalTime;
        let eta = Math.round(time / 60);
        displayHospitalInfo(hospitalName, selectedSeverity, selectedEmergencyType, eta);
        sendEmergency(hospitalName, selectedSeverity, selectedEmergencyType, eta);
        checkTriggerPoints(route.coordinates);
        moveVehicleAlongRoute(route.coordinates, endLat, endLon);
    })
    .on('routingerror', function(e) {
        console.error('Routing error:', e.error);
        alert('Error finding route. Please try again.');
    })
    .addTo(map);
}
