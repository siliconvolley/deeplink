import { centralOrchestrator } from './orchestrator.js';
import { JunctionMaster } from './junction.js';

// Map Initialization
var map = L.map("map").setView([12.885809, 74.841689], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
}).addTo(map);

// State Management
let selectedSeverity = null;
let selectedEmergencyType = null;
let additionalInfo = "";
let activeAmbulanceId = null;

// Simulation Parameters
const SIMUATION_STEPS = 20; // Number of steps to interpolate between points (more steps = smoother animation)
const SIMUATION_SPEED = 50; // milliseconds between each step (lower = faster)


// UI Event Handlers
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

// Traffic Light Class
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
        // TODO: Add server communication
        // if (this.status === "GREEN") {
        //     sendSignalUpdate(this.id, true);
        // }
    }

    updateMarker() {
        if (this.marker) map.removeLayer(this.marker);
        const color = this.status === "GREEN" ? "green" : "red";
        this.marker = L.marker([this.lat, this.lon], {
            icon: L.divIcon({
                className: 'traffic-light-icon',
                html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`
            })
        }).addTo(map).bindPopup(`Traffic Light ${this.id}: ${this.status}`);
    }
}

// Traffic Light Instances
const trafficLights = {
    'A1': new TrafficLight('A1', 12.885420, 74.838777, "RED"),
    'B1': new TrafficLight('B1', 12.885809, 74.838835, "RED"),
    'C1': new TrafficLight('C1', 12.885393, 74.838986, "RED"),

    // New traffic signals
    'A2': new TrafficLight('A2', 12.87594583674387, 74.84202494151472, "RED"),
    'B2': new TrafficLight('B2', 12.876069726067968, 74.84198822807944, "RED"),
    'C2': new TrafficLight('C2', 12.875983696473902, 74.84187902052817, "RED"),

    'A3': new TrafficLight('A3', 12.885891470980964, 74.84113141764564, "RED"),
    'B3': new TrafficLight('B3', 12.885974060584818, 74.84129804006379, "RED"),
    'C3': new TrafficLight('C3', 12.88583332464578, 74.84129590569128, "RED"),

    'A4': new TrafficLight('A4', 12.890729255496968, 74.85386350992287, "RED"),
    'B4': new TrafficLight('B4', 12.890658031652887, 74.8541383551607, "RED"),
    'C4': new TrafficLight('C4', 12.890773491171014, 74.85420243851222, "RED"),
    'D4': new TrafficLight('D4', 12.890773491171014, 74.85420243851222, "RED"),

    'A5': new TrafficLight('A5', 12.883696286375436, 74.86384946423456, "RED"),
    'B5': new TrafficLight('B5', 12.88375934419841, 74.86354490566589, "RED"),
    'C5': new TrafficLight('C5', 12.884080324064884, 74.86376490517848, "RED"),
    'D5': new TrafficLight('D5', 12.883843212785768, 74.86395449821671, "RED"),

    'A6': new TrafficLight('A6', 12.876609263150268, 74.84785907004957, "RED"),
    'B6': new TrafficLight('B6', 12.876559582753755, 74.84795965287798, "RED"),
    'C6': new TrafficLight('C6', 12.876683021749818, 74.84810960713288, "RED")
};

// Trigger Points Configuration
const triggerPoints = {
    'T1': {    
        id: 'T1',
        lat: 12.88495654771792,
        lon: 74.83885393383015,
        controlsSignal: 'A1',
        road: 'MG_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T2': {        
        id: 'T2',
        lat: 12.88628966075962,
        lon: 74.83874387433278,
        controlsSignal: 'B1',
        road: 'MG_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T3': {       
        id: 'T3',
        lat: 12.885438656220224,
        lon: 74.83914941352691,
        controlsSignal: 'C1',
        road: 'BEJAI_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    },

    // New trigger points
    'T4': {
        id: 'T4',
        // lat: 12.875899034095628,
        // lon: 74.84321953973553, 
        lat: 12.875917166934594, 
        lon : 74.84312540725419,
        controlsSignal: 'A2',
        road: 'NEW_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T5': {
        id: 'T5',
        lat: 12.87719298638698,
        lon: 74.84180183688376,
        controlsSignal: 'B2',
        road: 'NEW_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T6': {
        id: 'T6',
        // lat: 12.875405545613049,
        // lon: 74.8409668332341, 
        lat : 12.875389798809515, 
        lon : 74.840990935319,
        controlsSignal: 'C2',
        road: 'NEW_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    },
    'T7': {     
        id: 'T7',
        lat: 12.885779240570491,
        lon: 74.8406019732182,
        controlsSignal: 'A3',
        road: 'NEW_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T8': {
        id: 'T8',
        lat: 12.887278489781236,
        lon: 74.84156984659629,
        controlsSignal: 'B3',
        road: 'NEW_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    }, 
    'T9': {       
        id: 'T9',
        lat: 12.885813717600039, 
        lon: 74.8413382910157,
        controlsSignal: 'C3',
        road: 'NEW_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    },
    'T10': {
        id: 'T10',
        lat: 12.890236386714921,
        lon: 74.85319529392879,
        controlsSignal: 'A4',
        road: 'NEW_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T11': {
        id: 'T11',
        lat: 12.890196574714347,
        lon: 74.85559378810629,
        controlsSignal: 'B4',
        road: 'NEW_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T12': {
        id: 'T12',
        lat: 12.891296474429344,
        lon: 74.85519562296714,
        controlsSignal: 'C4',
        road: 'NEW_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    },
    'T13': {
        id: 'T13',
        lat: 12.882672034440871,
        lon: 74.86425713028501,
        controlsSignal: 'A5',
        road: 'NEW_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T14': {
        id: 'T14',
        lat: 12.882375920681337,
        lon: 74.86323814948915,
        controlsSignal: 'B5',
        road: 'NEW_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T15': {
        id: 'T15',
        lat: 12.885499026826007,
        lon: 74.862842801463,
        controlsSignal: 'C5',
        road: 'NEW_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    },
    'T16': {
        id: 'T16',
        lat: 12.884811657561222,
        lon: 74.86596543526811,
        controlsSignal: 'D5',
        road: 'NEW_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T17': {
        id: 'T17',
        lat: 12.876439240548477,
        lon: 74.84753736346088,
        controlsSignal: 'A6',
        road: 'NEW_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T18': {
        id: 'T18',
        lat: 12.87604118039173,
        lon: 74.84816594064537,
        controlsSignal: 'B6',
        road: 'NEW_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T19': {
        id: 'T19',
        lat: 12.877103478436702,
        lon: 74.8487398383215,
        controlsSignal: 'C6',
        road: 'NEW_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    }
};

// Junction Configuration
const junctionConfig = {
    'J1': {
        signals: ['A1', 'B1', 'C1'],
        triggers: ['T1', 'T2', 'T3']
    },
    'J2': {
        signals: ['A2', 'B2', 'C2'],
        triggers: ['T4', 'T5', 'T6']
    },
    'J3': {
        signals: ['A3', 'B3', 'C3'],
        triggers: ['T7', 'T8', 'T9']
    },
    'J4': {
        signals: ['A4', 'B4', 'C4'],
        triggers: ['T10', 'T11', 'T12']
    },
    'J5': {
        signals: ['A5', 'B5', 'C5', 'D5'],
        triggers: ['T13', 'T14', 'T15', 'T16']
    },
    'J6': {
        signals: ['A6', 'B6', 'C6'],
        triggers: ['T17', 'T18', 'T19']
    }
};

// System Initialization
function initializeJunctions() {
    Object.entries(junctionConfig).forEach(([jId, config]) => {
        const signals = config.signals.reduce((acc, id) => {
            acc[id] = trafficLights[id];
            return acc;
        }, {});
        
        const triggers = config.triggers.map(id => triggerPoints[id]);
        const junction = new JunctionMaster(jId, signals, triggers);
        centralOrchestrator.registerJunction(junction);
    });
}

// Routing and Emergency Handling
function handleRouteFound(route, hospitalName, additionalInfo) {
    const ambulanceId = `amb-${Date.now()}`;
    activeAmbulanceId = ambulanceId;
    
    // Interpolate additional points between route coordinates
    const interpolatedRoute = [];
    for (let i = 0; i < route.coordinates.length - 1; i++) {
        const start = route.coordinates[i];
        const end = route.coordinates[i + 1];
        
        // Add 20 intermediate points between each pair of coordinates
        for (let j = 0; j <= SIMUATION_STEPS; j++) {
            const fraction = j / SIMUATION_STEPS;
            interpolatedRoute.push({
                lat: start.lat + (end.lat - start.lat) * fraction,
                lng: start.lng + (end.lng - start.lng) * fraction
            });
        }
    }
    // Add the final point
    interpolatedRoute.push(route.coordinates[route.coordinates.length - 1]);
    
    const ambulanceMarker = L.circleMarker([interpolatedRoute[0].lat, interpolatedRoute[0].lng], {
        radius: 12,
        fillColor: 'skyblue',
        fillOpacity: 1,
        color: '#000',
        weight: 2,
        zIndexOffset: 1000
    }).addTo(map);

    let currentPoint = 0;
    let activeSignals = new Set();

    const moveAmbulance = () => {
        if (currentPoint >= interpolatedRoute.length) {
            console.log(`🏥 Ambulance ${ambulanceId} has reached ${hospitalName}`);
            map.removeLayer(ambulanceMarker);
            return;
        }

        if (currentPoint === 0) {
            console.log(`🚑 Ambulance ${ambulanceId} has started its journey to ${hospitalName}`);
        }

        const coord = interpolatedRoute[currentPoint];
        ambulanceMarker.setLatLng([coord.lat, coord.lng]);
        
        // Check for nearby triggers
        Object.values(triggerPoints).forEach(trigger => {
            const distanceToTrigger = haversine(
                coord.lat, 
                coord.lng, 
                trigger.lat, 
                trigger.lon
            );
            
            const associatedSignal = trafficLights[trigger.controlsSignal];
            const distanceToSignal = haversine(
                coord.lat,
                coord.lng,
                associatedSignal.lat,
                associatedSignal.lon
            );

            // If ambulance is within =10 meters of trigger point
            if (distanceToTrigger <= 0.01 && !activeSignals.has(trigger.controlsSignal)) {
                console.log(`🚦 Ambulance approaching signal ${trigger.controlsSignal}`);
                trafficLights[trigger.controlsSignal].updateStatus("GREEN");
                activeSignals.add(trigger.controlsSignal);
                console.log(`🟢 Signal ${trigger.controlsSignal} changed to GREEN`);
            }
            
            // Check if ambulance has crossed the traffic light
            if (activeSignals.has(trigger.controlsSignal)) {
                // Calculate if ambulance has passed the signal
                // Using a small buffer distance (0.01 km or 10 meters) after crossing
                if (distanceToSignal > 0.01) {
                    const prevCoord = interpolatedRoute[Math.max(0, currentPoint - 1)];
                    const prevDistanceToSignal = haversine(
                        prevCoord.lat,
                        prevCoord.lng,
                        associatedSignal.lat,
                        associatedSignal.lon
                    );
                    
                    // If previous position was closer to signal than current position,
                    // it means we've crossed the signal
                    if (prevDistanceToSignal < distanceToSignal) {
                        trafficLights[trigger.controlsSignal].updateStatus("RED");
                        activeSignals.delete(trigger.controlsSignal);
                        console.log(`🔴 Signal ${trigger.controlsSignal} changed to RED after ambulance passed`);
                    }
                }
            }
        });

        currentPoint++;
        setTimeout(moveAmbulance, SIMUATION_SPEED); // Reduced from 200ms to 50ms for smoother animation
    };

    moveAmbulance();
    
    centralOrchestrator.handleEmergency(
        ambulanceId,
        { coordinates: route.coordinates },
        selectedSeverity
    );

    const eta = Math.round(route.summary.totalTime / 60);
    displayHospitalInfo(hospitalName, selectedSeverity, selectedEmergencyType, eta);
    sendEmergency(hospitalName, selectedSeverity, selectedEmergencyType, eta, additionalInfo);
}

function showRoute(startLat, startLon, endLat, endLon, hospitalName, additionalInfo) {
    if (window.routeControl) map.removeControl(window.routeControl);

    window.routeControl = L.Routing.control({
        waypoints: [L.latLng(startLat, startLon), L.latLng(endLat, endLon)],
        routeWhileDragging: false,
        lineOptions: { styles: [{ color: "blue", weight: 5 }] },
        router: L.Routing.osrmv1({
            serviceUrl: 'http://router.project-osrm.org/route/v1',
            profile: 'driving'
        })
    }).on('routesfound', function(e) {
        handleRouteFound(e.routes[0], hospitalName, additionalInfo);
    }).addTo(map);
}

// Hospital Information Handling
function displayHospitalInfo(hospitalName, severity, emergencyType, eta) {
    document.getElementById("hospital-info").style.display = "block";
    document.getElementById("hospital-name").textContent = `Hospital: ${hospitalName}`;
    document.getElementById("hospital-severity").textContent = `Severity: ${severity}`;
    document.getElementById("hospital-condition").textContent = `Emergency: ${emergencyType}`;
    document.getElementById("hospital-eta").textContent = `ETA: ${eta} minutes`;
}

// TODO: Add server communication
// function sendSignalUpdate(signalId, isGreen) {
//     fetch("http://127.0.0.1:5001/traffic_signal", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//             isGreen: isGreen,
//             signalNumber: signalId === 'A1' ? 1 : signalId === 'B1' ? 2 : 3
//         })
//     }).catch(error => console.error("Error sending signal update:", error));
// }

function sendEmergency(hospitalName, severity, emergencyType, eta, additionalInfo) {
    fetch("http://localhost:5000/submit-patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            hospitalName,
            severity,
            emergencyType,
            eta,
            additionalInfo,
            ambulanceId: activeAmbulanceId
        })
    }).catch(error => console.error("Error sending emergency data:", error));
}

// Map Utilities
function addTriggerMarkers() {
    Object.values(triggerPoints).forEach(trigger => {
        L.marker([trigger.lat, trigger.lon], {
            icon: L.divIcon({
                className: 'trigger-icon',
                html: '<div style="background-color: yellow; width: 15px; height: 15px; border-radius: 50%; border: 2px solid black;"></div>'
            })
        }).addTo(map).bindPopup(`Trigger ${trigger.id} (${trigger.direction})`);
    });
}

// Main Initialization
function initialize() {
    initializeJunctions();
    Object.values(trafficLights).forEach(light => light.updateMarker());
    addTriggerMarkers();
}

// Form Submission Handler
document.getElementById("ambulance-form").addEventListener("submit", function(e) {
    e.preventDefault();
    additionalInfo = document.getElementById("additional-info").value;

    if (selectedSeverity && selectedEmergencyType) {
        const startLat = 12.876483446326933; 
        const startLon = 74.84683733695195;
        
        map.setView([startLat, startLon], 13);
        initialize();
        findNearestHospital(startLat, startLon, additionalInfo);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        alert("Please select both severity and emergency type");
    }
});

// Hospital Search Function
function findNearestHospital(lat, lon, additionalInfo) {
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=hospital](around:13000,${lat},${lon});out;`;
    
    fetch(overpassUrl)
        .then(response => response.json())
        .then(data => {
            if (data.elements.length > 0) {
                let nearest = data.elements.reduce((closest, current) => {
                    const dist = haversine(lat, lon, current.lat, current.lon);
                    return dist < closest.distance ? 
                        { distance: dist, hospital: current } : closest;
                }, { distance: Infinity, hospital: null });
                
                if (nearest.hospital) {
                    showRoute(lat, lon, nearest.hospital.lat, nearest.hospital.lon, 
                            nearest.hospital.tags.name || "Hospital", additionalInfo);
                }
            } else {
                alert("No hospitals found within 5km");
            }
        }).catch(error => console.error("Hospital search error:", error));
}

// Geographic Utilities
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Start Application
initialize();