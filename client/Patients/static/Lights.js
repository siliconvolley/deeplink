export default class TrafficLight {
    constructor(id, lat, lon, status, lights) {
        this.id = id;
        this.lat = lat;
        this.lon = lon;
        this.status = status;
        this.lights = lights; // ["red", "yellow", "green"]
    }
}