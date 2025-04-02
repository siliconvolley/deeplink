import { centralOrchestrator } from "./orchestrator.js";
import { JunctionMaster } from "./junction.js";

let ws = null;
let ambulanceMarkers = {};

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

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "signal_state",
            signal_id: this.id,
            state: newStatus,
          })
        );
      }

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

  let currentPoint = 0;
  let activeSignals = new Set();

  const moveAmbulance = () => {
    if (currentPoint >= interpolatedRoute.length) {
      console.log(`🏥 Ambulance ${ambulanceId} has reached ${hospitalName}`);
      if (ambulanceMarkers[ambulanceId]) {
        map.removeLayer(ambulanceMarkers[ambulanceId]);
        delete ambulanceMarkers[ambulanceId];
      }
      return;
    }

    const coord = interpolatedRoute[currentPoint];

    // Send position update through WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(
        JSON.stringify({
          type: "ambulance_position",
          ambulance_id: ambulanceId,
          position: coord,
        })
      );
    }

    updateAmbulanceOnMap(ambulanceId, coord);
    currentPoint++;
    setTimeout(moveAmbulance, SIMULATION_SPEED);
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

// WebSocket connection function
async function connectToJunction(junctionId) {
  updateConnectionStatus("connecting");

  if (ws) {
    ws.close();
  }

  ws = new WebSocket(`ws://localhost:8000/ws/${junctionId}`);

  ws.onopen = function () {
    updateConnectionStatus("connected");
    console.log("Connected to junction:", junctionId);
  };

  ws.onmessage = function (event) {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };

  ws.onerror = function (error) {
    console.error("WebSocket error:", error);
    updateConnectionStatus("disconnected");
  };

  ws.onclose = function () {
    console.log("WebSocket connection closed");
    updateConnectionStatus("disconnected");
    // Try to reconnect after 5 seconds
    setTimeout(() => connectToJunction(junctionId), 5000);
  };
}

// Add connection status management
function updateConnectionStatus(status) {
  const statusElement = document.getElementById("connection-status");
  const statusText = document.getElementById("status-text");

  statusElement.className = "connection-status";

  switch (status) {
    case "connected":
      statusElement.classList.add("status-connected");
      statusText.textContent = "Connected";
      break;
    case "disconnected":
      statusElement.classList.add("status-disconnected");
      statusText.textContent = "Disconnected - Retrying...";
      break;
    case "connecting":
      statusElement.classList.add("status-connecting");
      statusText.textContent = "Connecting...";
      break;
  }
}

// WebSocket message handler
function handleWebSocketMessage(data) {
  switch (data.type) {
    case "ambulance_update":
      updateAmbulanceOnMap(data.ambulance_id, data.position);
      break;
    case "signal_update":
      updateTrafficLightState(data.signal_id, data.state);
      break;
  }
}

// Add this function after handleWebSocketMessage

function updateTrafficLightState(signalId, state) {
  if (trafficLights[signalId]) {
    trafficLights[signalId].status = state;
    trafficLights[signalId].updateMarker();
  }
}

// Update ambulance movement function
function updateAmbulanceOnMap(ambulanceId, position) {
  if (!ambulanceMarkers[ambulanceId]) {
    ambulanceMarkers[ambulanceId] = L.circleMarker(
      [position.lat, position.lng],
      {
        radius: 12,
        fillColor: ambulanceId === activeAmbulanceId ? "skyblue" : "orange",
        fillOpacity: 1,
        color: "#000",
        weight: 2,
      }
    ).addTo(map);
  } else {
    ambulanceMarkers[ambulanceId].setLatLng([position.lat, position.lng]);
  }
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

// Initialize WebSocket connection when page loads
document.addEventListener("DOMContentLoaded", () => {
  navigator.geolocation.getCurrentPosition(
    (position) => {
      fetch(
        `/api/nearest-junction?lat=${position.coords.latitude}&lon=${position.coords.longitude}`
      )
        .then((response) => response.json())
        .then((data) => {
          connectToJunction(data.junctionId);
        })
        .catch((error) => {
          console.error("Error finding nearest junction:", error);
          // Fallback to default junction
          connectToJunction("junction1");
        });
    },
    (error) => {
      console.error("Geolocation error:", error);
      // Fallback to default junction
      connectToJunction("junction1");
    }
  );
});
