import './map.js';
import './eventListeners.js';
import { trafficLights } from './trafficLight.js';
import { addTriggerMarkers } from './triggerPoints.js';
import './utils.js';
import './hospitalInfo.js';
import { trackUserLocation } from './userLocation.js';
import './ambulanceSimulation.js';
import './formSubmission.js';
import './findHospital.js';

export function initialize() {
    Object.values(trafficLights).forEach(light => light.updateMarker());
    addTriggerMarkers();
}

// trackUserLocation();
initialize();
