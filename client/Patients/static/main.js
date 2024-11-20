var map = L.map("map").setView([51.505, -0.09], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18,
}).addTo(map);

let selectedSeverity = null;
let selectedEmergencyType = null;

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

class TrafficLight {
  constructor(id, lat, lon, status, lights) {
    this.id = id;
    this.lat = lat;
    this.lon = lon;
    this.status = status;
    this.lights = lights; // ["red", "yellow", "green"]
  }
}

class Trigger {
  constructor(id, lat, lon) {
    this.id = id;
    this.lat = lat;
    this.lon = lon;
    this.status = false;
  }
}

const trafficLights = [
  new TrafficLight(1, 12.885495, 74.838782, "RED", ["red", "yellow", "green"]),
  new TrafficLight(2, 12.885514, 74.838943, "RED", ["red", "yellow", "green"]),
  new TrafficLight(3, 12.885383, 74.838970, "RED", ["red", "yellow", "green"]),
  new TrafficLight(4, 12.885419, 74.838777, "RED", ["red", "yellow", "green"]),
  new TrafficLight(5, 12.885393, 74.838986, "RED", ["red", "yellow", "green"]),
];

const triggers = [
  new Trigger(1, 12.885067, 74.838862),
  new Trigger(2, 12.886133, 74.838792),
  new Trigger(5, 12.885430, 74.839345),
];





// Key-value pairs mapping triggers to traffic lights
const triggerTrafficLightMap = {
  1: [1], // Trigger 1 activates Traffic Light 1
  5: [5], // Trigger 5 activates Traffic Lights 4 and 5
  2: [2], // Trigger 2 activates Traffic Lights 2 and 3
};

// Function to activate traffic lights based on a triggered trigger
function activateTrafficLightsForTrigger(triggerId) {
  console.log(`Trigger ${triggerId} activated.`);

  const trafficLightsToActivate = triggerTrafficLightMap[triggerId];

  if (trafficLightsToActivate) {
    trafficLightsToActivate.forEach((lightId) => {
      const trafficLight = trafficLights.find((light) => light.id === lightId);
      if (trafficLight) {
        trafficLight.status = "GREEN";
        console.log(`Traffic Light ${trafficLight.id} is now ${trafficLight.status}.`);

        // Update the map marker to reflect the new status
        L.marker([trafficLight.lat, trafficLight.lon])
          .addTo(map)
          .bindPopup(`Traffic Light ${trafficLight.id} is now GREEN!`)
          .openPopup();
      }
    });
  } else {
    console.log(`No traffic lights associated with Trigger ${triggerId}.`);
  }
}






function addMarkers(map, trafficLights) {
  trafficLights.forEach((light) => {
    L.marker([light.lat, light.lon])
      .addTo(map)
      .bindPopup(`Traffic Light ${light.id}`)
      .openPopup();
    // console.log(`DEBUG: Added traffic light at ${light.lat}, ${light.lon}`);
  });
}

function addTriggers(map, triggers) {
  triggers.forEach((trigger) => {
    const marker = L.marker([trigger.lat, trigger.lon])
      .addTo(map)
      .bindPopup(`Trigger ${trigger.id}`)
      .openPopup();
    // console.log(`DEBUG: Added trigger at ${trigger.lat}, ${trigger.lon}`);
  });
}


function getLocation() {
  // ! replace with your current location in future
  // const lat = 12.884392; // facing light 1
  // const lon = 74.839044;
  const lat = 12.885809; // facing light 5
  const lon = 74.841689;

  map.setView([lat, lon], 13);

  L.marker([lat, lon]).addTo(map).bindPopup("You are here.").openPopup();

  addMarkers(map, trafficLights);
  addTriggers(map, triggers);
  findNearestHospital(lat, lon);
}

function findNearestHospital(lat, lon) {
  const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json];node[amenity=hospital](around:5000,${lat},${lon});out;`;

  fetch(overpassUrl)
    .then((response) => response.json())
    .then((data) => {
      if (data.elements.length > 0) {
        let nearestHospital = null;
        let minDistance = Infinity;

        data.elements.forEach((hospital) => {
          const hospitalLat = hospital.lat;
          const hospitalLon = hospital.lon;

          const distance = haversine(lat, lon, hospitalLat, hospitalLon);

          if (distance < minDistance) {
            minDistance = distance;
            nearestHospital = {
              lat: hospitalLat,
              lon: hospitalLon,
              name: hospital.tags.name || "Unnamed Hospital",
            };
          }
        });

        L.marker([nearestHospital.lat, nearestHospital.lon])
          .addTo(map)
          .bindPopup(nearestHospital.name)
          .openPopup();

        showRoute(
          lat,
          lon,
          nearestHospital.lat,
          nearestHospital.lon,
          nearestHospital.name
        );
      } else {
        alert("No hospital found  5km.");
      }
    })
    .catch((error) => {
      console.error("Error finding hospitals:", error);
    });
}

// Function to check if a traffic light is within 11 meters of the route
function checkTrafficLightsInRange(route, trafficLights) {
    const trafficLightsInRange = [];
  
    trafficLights.forEach((light) => {
      let isInRange = false;
  
      for (let i = 0; i < route.length - 1; i++) {
        const pointA = route[i];
        const pointB = route[i + 1];
  
        const distance = calculateDistanceToLineSegment(
          pointA.lat,
          pointA.lon,
          pointB.lat,
          pointB.lon,
          light.lat,
          light.lon
        );
  
        if (distance <= 0.01) {
          isInRange = true;
          break;
        }
      }
  
      if (isInRange) {
        trafficLightsInRange.push(light);
      }
    });
  
    return trafficLightsInRange;
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = degreesToRadians(lat2 - lat1);
  const dLon = degreesToRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

function calculateDistanceToLineSegment(x1, y1, x2, y2, x3, y3) {
    // Calculate the line segment length squared
    const lineLengthSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  
    if (lineLengthSq === 0) return haversine(x1, y1, x3, y3); // If points A and B are the same, return point distance
  
    // Project point C onto the line defined by points A and B
    let t = ((x3 - x1) * (x2 - x1) + (y3 - y1) * (y2 - y1)) / lineLengthSq;
  
    // Clamp t to the range [0, 1]
    t = Math.max(0, Math.min(1, t));
  
    // Find the closest point on the line segment to the traffic light
    const closestPointX = x1 + t * (x2 - x1);
    const closestPointY = y1 + t * (y2 - y1);
  
    // Return the haversine distance between the closest point and the traffic light
    return haversine(closestPointX, closestPointY, x3, y3) * 1000; // Convert km to meters
}

function showRoute(lat1, lon1, lat2, lon2, hospitalName) {
  L.Routing.control({
    waypoints: [L.latLng(lat1, lon1), L.latLng(lat2, lon2)],
    routeWhileDragging: false,
    addWaypoints: false,
    lineOptions: {
      styles: [{ color: "blue", weight: 5 }],
    },
    draggableWaypoints: false,
    createMarker: function () {
      return null;
    },
  })
    .on("routesfound", function (e) {
      const route = e.routes[0];
      const time = route.summary.totalTime;
      const eta = (time / 60).toFixed(0);

      displayHospitalInfo(
        hospitalName,
        selectedSeverity,
        selectedEmergencyType,
        eta
      );
      sendEmergency(hospitalName, selectedSeverity, selectedEmergencyType, eta);

      const routeCoordinates = route.coordinates.map((point) => ({
        lat: point.lat,
        lon: point.lng,
      }));

      // Check for traffic lights in range of the route
      const lightsInRange = checkTrafficLightsInRange(routeCoordinates, trafficLights);

      if (lightsInRange.length > 0) {
        // console.log("DEBUG: Traffic lights within 11 meters of the route:", lightsInRange);
        lightsInRange.forEach((light) => {
          light.status = "GREEN";
          // console.log(`Traffic Light ${light.id} Status: ${light.status}!`);
        });

        lightsInRange.forEach((light) => {
          L.marker([light.lat, light.lon])
            .addTo(map)
            .bindPopup(`Traffic Light ${light.id} is within range!`)
            .openPopup();
        });
      } else {
        console.log("No traffic lights within 11 meters of the route.");
      }

      triggers.forEach((trigger) => {
        const isInPath = routeCoordinates.some((point) => {
          const distance = haversine(point.lat, point.lon, trigger.lat, trigger.lon);
          return distance <= 0.015; // Adjust this threshold if necessary
        });
      
        if (isInPath) {
          console.log(`Trigger ${trigger.id} is in the vehicle's path.`);
          activateTrafficLightsForTrigger(trigger.id);
        }
      });            
    })
    .addTo(map);
}


function displayHospitalInfo(hospitalName, severity, emergencyType, eta) {
  document.getElementById("hospital-info").style.display = "block";
  document.getElementById(
    "hospital-name"
  ).textContent = `Hospital Name: ${hospitalName}`;
  document.getElementById(
    "hospital-severity"
  ).textContent = `Severity: ${severity}`;
  document.getElementById(
    "hospital-condition"
  ).textContent = `Emergency Type: ${emergencyType}`;
  document.getElementById(
    "hospital-eta"
  ).textContent = `Estimated Time of Arrival: ${eta} minutes`;
}

function sendEmergency(hospitalName, severity, emergencyType, eta) {
  const emergencyInfo = {
    hospitalName: hospitalName,
    severity: severity,
    emergencyType: emergencyType,
    eta: eta,
  };

  fetch("http://localhost:5000/submit-patient", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(emergencyInfo),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.message) {
        console.log("Success:", data.message);
      } else {
        console.error("Error:", data.error);
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

document.getElementById("ambulance-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (selectedSeverity && selectedEmergencyType) {
      getLocation();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert("Please select both severity and emergency type.");
    }
});
