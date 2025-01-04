import {  map } from './map.js';

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
        try {
            const jsonData = JSON.parse(data);
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

export { trafficLights };
