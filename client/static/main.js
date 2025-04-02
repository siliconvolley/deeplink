import { centralOrchestrator } from "./orchestrator.js";
import { JunctionMaster } from "./junction.js";

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
const SIMULATION_STEPS = 20; // Number of steps to interpolate between points (more steps = smoother animation)
const SIMULATION_SPEED = 50; // milliseconds between each step (lower = faster)

const startLat = 12.875877830329964;
const startLon = 74.84810833846042;

// UI Event Handlers
document.querySelectorAll(".severity-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".severity-btn")
      .forEach((b) => b.classList.remove("active"));
    this.classList.add("active");
    selectedSeverity = this.getAttribute("data-severity");
  });
});

document.querySelectorAll(".emergency-btn").forEach((btn) => {
  btn.addEventListener("click", function () {
    document
      .querySelectorAll(".emergency-btn")
      .forEach((b) => b.classList.remove("active"));
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

  async updateStatus(newStatus) {
    try {
      const response = await fetch(
        `/api/traffic/update?light_id=${this.id}&new_status=${newStatus}`,
        {
          method: "POST",
        }
      );

      if (!response.ok) throw new Error("Failed to update traffic light");

      this.status = newStatus;
      this.updateMarker();
    } catch (error) {
      console.error("Error updating traffic light:", error);
    }
  }

  updateMarker() {
    if (this.marker) map.removeLayer(this.marker);
    const color = this.status === "GREEN" ? "green" : "red";
    this.marker = L.marker([this.lat, this.lon], {
      icon: L.divIcon({
        className: "traffic-light-icon",
        html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid black;"></div>`,
      }),
    })
      .addTo(map)
      .bindPopup(`Traffic Light ${this.id}: ${this.status}`);
  }
}

let trafficLights = {};
let triggerPoints = {};
let junctionConfig = {};

// Load configuration
async function loadTrafficConfig() {
  try {
    // First load config file
    const configResponse = await fetch("/static/traffic-config.json");
    const config = await configResponse.json();

    // Initialize server with config
    await fetch("/api/traffic/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    // Get initial state
    const stateResponse = await fetch("/api/traffic/state");
    const state = await stateResponse.json();

    // Create TrafficLight instances
    Object.entries(state.trafficLights).forEach(([id, light]) => {
      trafficLights[id] = new TrafficLight(
        light.id,
        light.lat,
        light.lon,
        light.status
      );
    });

    triggerPoints = state.triggerPoints;
    junctionConfig = state.junctionConfig;

    initialize();
  } catch (error) {
    console.error("Error initializing traffic system:", error);
  }
}

// System Initialization
function initializeJunctions() {
  Object.entries(junctionConfig).forEach(([jId, config]) => {
    const signals = config.signals.reduce((acc, id) => {
      acc[id] = trafficLights[id];
      return acc;
    }, {});

    const triggers = config.triggers.map((id) => triggerPoints[id]);
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
    for (let j = 0; j <= SIMULATION_STEPS; j++) {
      const fraction = j / SIMULATION_STEPS;
      interpolatedRoute.push({
        lat: start.lat + (end.lat - start.lat) * fraction,
        lng: start.lng + (end.lng - start.lng) * fraction,
      });
    }
  }
  // Add the final point
  interpolatedRoute.push(route.coordinates[route.coordinates.length - 1]);

  const ambulanceMarker = L.circleMarker(
    [interpolatedRoute[0].lat, interpolatedRoute[0].lng],
    {
      radius: 12,
      fillColor: "skyblue",
      fillOpacity: 1,
      color: "#000",
      weight: 2,
      zIndexOffset: 1000,
    }
  ).addTo(map);

  let currentPoint = 0;
  let activeSignals = new Set();

  const moveAmbulance = () => {
    if (currentPoint >= interpolatedRoute.length) {
      console.log(`🏥 Ambulance ${ambulanceId} has reached ${hospitalName}`);
      map.removeLayer(ambulanceMarker);
      return;
    }

    if (currentPoint === 0) {
      console.log(
        `🚑 Ambulance ${ambulanceId} has started its journey to ${hospitalName}`
      );
    }

    const coord = interpolatedRoute[currentPoint];
    ambulanceMarker.setLatLng([coord.lat, coord.lng]);

    // Check for nearby triggers
    Object.values(triggerPoints).forEach((trigger) => {
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
      if (
        distanceToTrigger <= 0.01 &&
        !activeSignals.has(trigger.controlsSignal)
      ) {
        console.log(
          `🚦 Ambulance approaching signal ${trigger.controlsSignal}`
        );
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
            console.log(
              `🔴 Signal ${trigger.controlsSignal} changed to RED after ambulance passed`
            );
          }
        }
      }
    });

    currentPoint++;
    setTimeout(moveAmbulance, SIMULATION_SPEED); // Reduced from 200ms to 50ms for smoother animation
  };

  moveAmbulance();

  centralOrchestrator.handleEmergency(
    ambulanceId,
    { coordinates: route.coordinates },
    selectedSeverity
  );

  const eta = Math.round(route.summary.totalTime / 60);
  displayHospitalInfo(
    hospitalName,
    selectedSeverity,
    selectedEmergencyType,
    eta
  );
  sendEmergency(
    hospitalName,
    selectedSeverity,
    selectedEmergencyType,
    eta,
    additionalInfo
  );
}

function showRoute(
  startLat,
  startLon,
  endLat,
  endLon,
  hospitalName,
  additionalInfo
) {
  if (window.routeControl) map.removeControl(window.routeControl);

  window.routeControl = L.Routing.control({
    waypoints: [L.latLng(startLat, startLon), L.latLng(endLat, endLon)],
    routeWhileDragging: false,
    lineOptions: { styles: [{ color: "blue", weight: 5 }] },
    router: L.Routing.osrmv1({
      serviceUrl: "http://router.project-osrm.org/route/v1",
      profile: "driving",
    }),
  })
    .on("routesfound", function (e) {
      handleRouteFound(e.routes[0], hospitalName, additionalInfo);
    })
    .addTo(map);
}

// Hospital Information Handling
function displayHospitalInfo(hospitalName, severity, emergencyType, eta) {
  document.getElementById(
    "patient-id"
  ).textContent = `Patient ID: ${activeAmbulanceId}`;
  document.getElementById("hospital-info").style.display = "block";
  document.getElementById(
    "hospital-name"
  ).textContent = `Hospital: ${hospitalName}`;
  document.getElementById(
    "hospital-severity"
  ).textContent = `Severity: ${severity}`;
  document.getElementById(
    "hospital-condition"
  ).textContent = `Emergency: ${emergencyType}`;
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

function sendEmergency(
  hospitalName,
  severity,
  emergencyType,
  eta,
  additionalInfo
) {
  fetch("http://127.0.0.1:8000/submit-patient", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      hospitalName: hospitalName,
      severity: severity,
      emergencyType: emergencyType,
      eta: parseInt(eta), // Convert to integer
      additionalInfo: additionalInfo,
      patient_id: activeAmbulanceId, // Use ambulance ID as patient ID
    }),
  })
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => Promise.reject(err));
      }
      return response.json();
    })
    .then((data) => console.log("Emergency sent successfully:", data))
    .catch((error) => console.error("Error sending emergency data:", error));
}

// Map Utilities
function addTriggerMarkers() {
  Object.values(triggerPoints).forEach((trigger) => {
    L.marker([trigger.lat, trigger.lon], {
      icon: L.divIcon({
        className: "trigger-icon",
        html: '<div style="background-color: yellow; width: 15px; height: 15px; border-radius: 50%; border: 2px solid black;"></div>',
      }),
    })
      .addTo(map)
      .bindPopup(`Trigger ${trigger.id} (${trigger.direction})`);
  });
}

// Main Initialization
function initialize() {
  initializeJunctions();
  Object.values(trafficLights).forEach((light) => light.updateMarker());
  addTriggerMarkers();
}

// Form Submission Handler
document
  .getElementById("ambulance-form")
  .addEventListener("submit", function (e) {
    e.preventDefault();
    additionalInfo = document.getElementById("additional-info").value;

    if (selectedSeverity && selectedEmergencyType) {
      map.setView([startLat, startLon], 13);
      initialize();
      findNearestHospital(startLat, startLon, additionalInfo);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert("Please select both severity and emergency type");
    }
  });

// Hospital Search Function
async function findNearestHospital(lat, lon, additionalInfo) {
  try {
    const response = await fetch(`/api/nearest-hospital?lat=${lat}&lon=${lon}`);

    if (!response.ok) {
      throw new Error("Failed to find hospital");
    }

    const data = await response.json();
    const hospital = data.hospital;

    showRoute(
      lat,
      lon,
      hospital.lat,
      hospital.lon,
      hospital.name,
      additionalInfo
    );
  } catch (error) {
    console.error("Hospital search error:", error);
    alert("Failed to find nearby hospitals");
  }
}

// Geographic Utilities
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Start Application
loadTrafficConfig();
