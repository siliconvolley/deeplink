var map = L.map("map").setView([12.885809, 74.841689], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
}).addTo(map);

let selectedSeverity = null;
let selectedEmergencyType = null;
let STEP_DURATION = 250;

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
        this.updateMarker(); 
    }

    updateStatus(newStatus) {
        console.log(`Updating status of Traffic Light ${this.id} to ${newStatus}`);
        this.status = newStatus;
        this.updateMarker();
        sendSignalUpdate(this.id, newStatus === "GREEN");
    }

    updateMarker() {
        if (this.marker) {
            map.removeLayer(this.marker);
        }
        const color = this.status === "GREEN" ? "green" : "red";
        console.log(`Updating marker color of Traffic Light ${this.id} to ${color}`);
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
    console.log(`Sending signal update for Traffic Light ${signalId} to ${isGreen ? "GREEN" : "RED"}`);
    fetch("http://127.0.0.1:5001/traffic_signal", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            isGreen: isGreen,
            signalNumber: signalId === 'A1' ? 1 : signalId === 'B1' ? 2 : 3 
        })
    })
    .then(response => response.text()) 
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
        lat: 12.885489,
        lon: 74.839404,
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
    const TRIGGER_RADIUS = 0.01; 
    const processedTriggers = new Set(); 

    Object.values(trafficLights).forEach(light => light.updateStatus("RED"));

    let currentLocation = null;

    function moveAlongRoute(index) {
        if (index >= routeCoordinates.length) return;
    
        currentLocation = routeCoordinates[index];
    
        if (index < routeCoordinates.length - 1) {
            const nextPoint = routeCoordinates[index + 1];
            const heading = calculateHeading(currentLocation, nextPoint);
    
            Object.values(triggerPoints).forEach(trigger => {
                if (processedTriggers.has(trigger.id)) return;
    
                const distance = haversine(currentLocation.lat, currentLocation.lng, trigger.lat, trigger.lon);
    
                if (distance <= TRIGGER_RADIUS) {
                    const headingDiff = Math.abs(heading - trigger.expectedHeading);
                    const isCorrectDirection = headingDiff <= 45 || headingDiff >= 315;
    
                    if (isCorrectDirection) {
                        trafficLights[trigger.controlsSignal].updateStatus("GREEN");
                        processedTriggers.add(trigger.id);
                    }
                }
            });
        }
    
        setTimeout(() => moveAlongRoute(index + 1), STEP_DURATION);
    }

    moveAlongRoute(0); 
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
let vehicleMarker = null;

let currentLat;
let currentLon;

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

// ! ----------------------- TRIGGER CHECKS ------------------------

const closeTriggerPoints = {
    'T1': { lat: 12.885017, lon: 74.838874 },
    'T2': { lat: 12.886133, lon: 74.838792 },
    'T3': { lat: 12.885489, lon: 74.839404 }
};

function hasPassedCloseTrigger(currentLat, currentLon, triggerLat, triggerLon) {
    return haversine(currentLat, currentLon, triggerLat, triggerLon) < TRIGGER_RADIUS;
}

function manageTrafficLights(vehiclePosition, hospitalPosition) {
    const TRIGGER_RADIUS = 0.01; // Radius to consider as crossing a trigger point

    Object.entries(closeTriggerPoints).forEach(([triggerId, triggerPoint]) => {
        // Find the traffic light controlled by the trigger point
        const trigger = triggerPoints[triggerId];
        if (!trigger) {
            console.error(`Trigger ${triggerId} not found in triggerPoints`);
            return;
        }

        const trafficLightId = trigger.controlsSignal; // Get the corresponding traffic light ID
        const trafficLight = trafficLights[trafficLightId];

        if (!trafficLight) {
            console.error(`Traffic Light ${trafficLightId} not found in trafficLights`);
            return;
        }

        // Check if the vehicle has passed the trigger point
        if (
            haversine(vehiclePosition.lat, vehiclePosition.lon, triggerPoint.lat, triggerPoint.lon) <= TRIGGER_RADIUS
        ) {
            // Keep the signal GREEN until the vehicle reaches the hospital
            trafficLight.updateStatus("GREEN");
        }

        // Revert the traffic light to RED once the hospital is reached
        if (
            haversine(vehiclePosition.lat, vehiclePosition.lon, hospitalPosition.lat, hospitalPosition.lon) <= TRIGGER_RADIUS
        ) {
            trafficLight.updateStatus("RED");
        }
    });
}

function checkAndUpdateTrafficLights(currentLat, currentLon, hospitalLat, hospitalLon) {
    Object.keys(closeTriggerPoints).forEach(triggerId => {
        const { lat: triggerLat, lon: triggerLon } = closeTriggerPoints[triggerId];
        const trafficLight = trafficLights[triggerId];

        if (hasPassedCloseTrigger(currentLat, currentLon, triggerLat, triggerLon)) {
            trafficLight.updateStatus("GREEN");
        }

        if (currentLat === hospitalLat && currentLon === hospitalLon) {
            trafficLight.updateStatus("RED");
        }
    });
}

// ! ---------------------------------------------------------------


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
            timeout: 1000
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

// ! ------------------- AMBULANCE SIMULATION ----------------------

function moveVehicleAlongRoute(routeCoordinates, hospitalLat, hospitalLon) {
    const steps = routeCoordinates.length; 
    const stepDuration = STEP_DURATION; 
    let currentStep = 0;

    function updateVehiclePosition() {
        if (currentStep >= steps) {
            console.log("Vehicle has reached the hospital. Resetting all signals to RED.");
            Object.values(trafficLights).forEach(light => light.updateStatus("RED"));
            return; 
        }

        const vehiclePosition = {
            lat: routeCoordinates[currentStep].lat,
            lon: routeCoordinates[currentStep].lng,
        };

        if (vehicleMarker) {
            map.removeLayer(vehicleMarker);
        }

        vehicleMarker = L.marker([vehiclePosition.lat, vehiclePosition.lon], {
            icon: L.divIcon({
                className: 'vehicle-location-icon',
                html: `<div style="background-color: skyblue; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`,
            }),
        }).addTo(map);

        manageTrafficLights(vehiclePosition, { lat: hospitalLat, lon: hospitalLon });

        currentStep++;
        setTimeout(updateVehiclePosition, stepDuration);
    }

    updateVehiclePosition();
}

// ! ---------------------------------------------------------------

// Call trackUserLocation to start tracking the user's location
// trackUserLocation();

document.getElementById("ambulance-form").addEventListener("submit", function(e) {
    e.preventDefault();
    if (selectedSeverity && selectedEmergencyType) {
        if (currentLat !== null && currentLon !== null) {
            // const startLat = currentLat;
            // const startLon = currentLon;

            // Use specified location
            const startLat = 12.883821;
            const startLon = 74.839737;

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

function findNearestHospital(lat, lon) {
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
        const route = e.routes[0];
        const time = route.summary.totalTime;
        const eta = Math.round(time / 60);
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

initialize();