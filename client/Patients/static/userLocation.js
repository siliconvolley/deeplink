import { map } from "./map.js";

let userMarker = null;

let currentLat;
let currentLon;

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

export function trackUserLocation() {
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

export { currentLat, currentLon };
