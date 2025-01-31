export class GPSTracker {
    constructor(updateCallback) {
      this.watchId = null;
      this.updateCallback = updateCallback;
    }
  
    start() {
      if (navigator.geolocation) {
        this.watchId = navigator.geolocation.watchPosition(
          (position) => {
            this.updateCallback({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              heading: position.coords.heading
            });
          },
          (error) => console.error("GPS Error:", error),
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
          }
        );
      } else {
        console.error("Geolocation not supported");
      }
    }
  
    stop() {
      if (this.watchId) navigator.geolocation.clearWatch(this.watchId);
    }
  }