var map = L.map("map").setView([12.885809, 74.841689], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
}).addTo(map);

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

class TrafficLight {
    constructor(id, lat, lon, status) {
        this.id = id;
        this.lat = lat;
        this.lon = lon;
        this.status = status;
        this.marker = null;
    }

    updateStatus(newStatus) {
        this.status = newStatus;
        this.updateMarker();
    }

    updateMarker() {
        if (this.marker) {
            map.removeLayer(this.marker);
        }
        const color = this.status === "GREEN" ? "green" : "red";
        this.marker = L.marker([this.lat, this.lon], {
            icon: L.divIcon({
                className: 'traffic-light-icon',
                html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`
            })
        }).addTo(map);
        this.marker.bindPopup(`Traffic Light ${this.id}: ${this.status}`);
        console.log(`Traffic Light ${this.id}: ${this.status}`);
    }
}

function sendSignalUpdate(signalId, isGreen) {
    fetch("http://127.0.0.1:5001/traffic_signal", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            isGreen: isGreen,
            signalNumber: signalId === 'A1' ? 1 : signalId === 'B1' ? 2 : 3 // Map signal IDs to numbers
        })
    })
    .then(response => response.text()) // Use .text() to log the raw response
    .then(data => {
        console.log("Raw server response:", data);
        try {
            const jsonData = JSON.parse(data);
            console.log("Parsed JSON:", jsonData);
        } catch (error) {
            console.error("Error parsing JSON:", error);
        }
    })
    .catch(error => console.error("Error sending traffic signal update:", error));
    
}

const trafficLights = {
    'A1': new TrafficLight('A1', 12.885420, 74.838777, "RED"),
    'B1': new TrafficLight('B1', 12.885809, 74.838835, "RED"),
    'C1': new TrafficLight('C1', 12.885393, 74.838986, "RED")
};

const triggerPoints = {
    'T1': {
        id: 'T1',
        lat: 12.885033,
        lon: 74.838820,
        controlsSignal: 'A1',
        road: 'MG_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T2': {
        id: 'T2',
        lat: 12.886133,
        lon: 74.838792,
        controlsSignal: 'B1',
        road: 'MG_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T3': {
        id: 'T3',
        lat: 12.885420,
        lon: 74.839394,
        controlsSignal: 'C1',
        road: 'BEJAI_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    }
};

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

function calculateHeading(point1, point2) {
    const dLon = (point2.lng - point1.lng);
    const y = Math.sin(dLon) * Math.cos(point2.lat);
    const x = Math.cos(point1.lat) * Math.sin(point2.lat) -
        Math.sin(point1.lat) * Math.cos(point2.lat) * Math.cos(dLon);
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    heading = (heading + 360) % 360;
    return heading;
}

function checkTriggerPoints(routeCoordinates) {
    const TRIGGER_RADIUS = 0.01; // Define a radius for trigger activation
    const processedTriggers = new Set(); // Track processed triggers

    // Reset all traffic lights to RED at the start
    Object.values(trafficLights).forEach(light => light.updateStatus("RED"));

    let currentLocation = null;

    function moveAlongRoute(index) {
        if (index >= routeCoordinates.length) return; // End of route

        currentLocation = routeCoordinates[index];

        if (index < routeCoordinates.length - 1) {
            const nextPoint = routeCoordinates[index + 1];
            const heading = calculateHeading(currentLocation, nextPoint);

            Object.values(triggerPoints).forEach(trigger => {
                if (processedTriggers.has(trigger.id)) return; // Skip already processed triggers

                const distance = haversine(currentLocation.lat, currentLocation.lng, trigger.lat, trigger.lon);
                
                if (distance <= TRIGGER_RADIUS) { // Check if within trigger radius
                    const headingDiff = Math.abs(heading - trigger.expectedHeading);
                    const isCorrectDirection = headingDiff <= 45 || headingDiff >= 315;

                    // Check specific conditions for each traffic signal
                    if (trigger.controlsSignal === 'A1') {
                        // Ensure A1 only turns GREEN under specific conditions
                        if (isCorrectDirection) {
                            trafficLights[trigger.controlsSignal].updateStatus("GREEN");
                            processedTriggers.add(trigger.id); // Mark this trigger as processed
                        }
                    } else if (isCorrectDirection) {
                        trafficLights[trigger.controlsSignal].updateStatus("GREEN");
                        processedTriggers.add(trigger.id);
                    }
                }
            });
        }

        setTimeout(() => moveAlongRoute(index + 1), 1000); // Move to next point after delay
    }

    moveAlongRoute(0); // Start moving along the route
}


function addRoutePoints(routeCoordinates, hospitalName) {
    if (routeCoordinates.length > 0) {
        const start = routeCoordinates[0].latLng;
        const end = routeCoordinates[routeCoordinates.length - 1].latLng;

        L.marker([start.lat, start.lng])
            .addTo(map)
            .bindPopup(`You are here`)
            .openPopup(); 

        L.marker([end.lat, end.lng])
            .addTo(map)
            .bindPopup(`${hospitalName}`)
            .openPopup(); 
    } else {
        console.error("No route coordinates available.");
    }
}

function addTriggerMarkers() {
    Object.values(triggerPoints).forEach(trigger => {
        L.marker([trigger.lat, trigger.lon], {
            icon: L.divIcon({
                className: 'trigger-icon',
                html: `<div style="background-color: yellow; width: 15px; height: 15px; border-radius: 50%; border: 2px solid black;"></div>`
            })
        })
        .addTo(map)
        .bindPopup(`Trigger ${trigger.id} (${trigger.direction})`);
    });
}

function findNearestHospital(lat, lon) {
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=hospital](around:5000,${lat},${lon});out;`;
    
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
        const route = e.routes[0];
        const time = route.summary.totalTime;
        const eta = Math.round(time / 60);
        displayHospitalInfo(hospitalName, selectedSeverity, selectedEmergencyType, eta);
        sendEmergency(hospitalName, selectedSeverity, selectedEmergencyType, eta);
        checkTriggerPoints(route.coordinates);
    })
    .on('routingerror', function(e) {
        console.error('Routing error:', e.error);
        alert('Error finding route. Please try again.');
    })
    .addTo(map);
}

function displayHospitalInfo(hospitalName, severity, emergencyType, eta) {
    document.getElementById("hospital-info").style.display = "block";
    document.getElementById("hospital-name").textContent = `Hospital: ${hospitalName}`;
    document.getElementById("hospital-severity").textContent = `Severity: ${severity}`;
    document.getElementById("hospital-condition").textContent = `Emergency: ${emergencyType}`;
    document.getElementById("hospital-eta").textContent = `ETA: ${eta} minutes`;
}

function sendEmergency(hospitalName, severity, emergencyType, eta) {
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

function initialize() {
    Object.values(trafficLights).forEach(light => light.updateMarker());
    addTriggerMarkers();
}

let userMarker = null;
// let currentLat = null;
// let currentLon = null;

// ! towards Traffic Signal 5 
// let currentLat = 12.88543; 
// let currentLon = 74.839345;

let currentLat = 12.885443;
let currentLon = 74.840959;

// ! towards Traffic Signal 1
// let currentLat = 12.885017;
// let currentLon = 74.838874;

// let currentLat = 12.882632;
// let currentLon = 74.839147;

// ! towards Traffic Signal 2
// let currentLat = 12.886675;
// let currentLon = 74.838600;

// let currentLat =  12.886133;
// let currentLon = 74.838792;

// ! B.C. Road
// let currentLat = 12.878200;
// let currentLon = 75.034000;

function updateUserLocation(position) {
    currentLat = position.coords.latitude;
    currentLon = position.coords.longitude;

    console.log(`Updated location: Latitude ${currentLat}, Longitude ${currentLon}`);

    if (userMarker) {
        map.removeLayer(userMarker);
    }

    userMarker = L.marker([currentLat, currentLon], {
        icon: L.divIcon({
            className: 'user-location-icon',
            html: `<div style="background-color: blue; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`
        })
    }).addTo(map);
    userMarker.bindPopup(`Your Location`).openPopup();

    map.setView([currentLat, currentLon], 13);
}

function handleLocationError(error) {
    console.error("Error getting location:", error);
    alert("Unable to retrieve your location. Please check your location settings.");
}

function trackUserLocation() {
    if (navigator.geolocation) {
        console.log("Starting to track user location...");
        navigator.geolocation.watchPosition(updateUserLocation, handleLocationError, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 2000
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// Call trackUserLocation to start tracking the user's location
// trackUserLocation();

document.getElementById("ambulance-form").addEventListener("submit", function(e) {
    e.preventDefault();
    if (selectedSeverity && selectedEmergencyType) {
        if (currentLat !== null && currentLon !== null) {
            // Use current location
            const startLat = currentLat;
            const startLon = currentLon;

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

initialize();