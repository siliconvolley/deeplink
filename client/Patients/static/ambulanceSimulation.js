import { map } from "./map.js";
import { trafficLights } from "./trafficLight.js";
import { haversine, calculateHeading } from "./utils.js";
import { triggerPoints } from "./triggerPoints.js";

const STEP_DURATION = 250;
let vehicleMarker = null;

export function checkTriggerPoints(routeCoordinates) {
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

export function moveVehicleAlongRoute(routeCoordinates, hospitalLat, hospitalLon) {
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
