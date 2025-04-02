export class JunctionMaster {
    constructor(id, signals, triggers) {
        this.id = id;
        this.signals = signals;
        this.triggers = triggers;
        this.ambulanceQueue = [];
        this.activeCorridor = null;
        this.TRIGGER_RADIUS = 0.01;
    }

    processAmbulance(ambulanceId, priority, coordinates) {
        this.ambulanceQueue.push({
            id: ambulanceId,
            priority,
            coordinates,
            timestamp: Date.now()
        });
        this.optimizeQueue();
    }

    optimizeQueue() {
        this.ambulanceQueue.sort((a, b) => 
            b.priority - a.priority || a.timestamp - b.timestamp
        );
        
        this.ambulanceQueue.forEach((amb, idx) => {
            setTimeout(() => this.activateCorridor(amb), idx * 15000);
        });
    }

    activateCorridor(ambulance) {
        this.resetSignals();
        this.activeCorridor = ambulance.id;
        this.processCoordinates(ambulance.coordinates);
    }

    processCoordinates(coordinates) {
        let currentIndex = 0;
        const processNext = () => {
            if (currentIndex >= coordinates.length) return;

            const currentLocation = coordinates[currentIndex];
            if (currentIndex < coordinates.length - 1) {
                const nextPoint = coordinates[currentIndex + 1];
                const heading = this.calculateHeading(currentLocation, nextPoint);
                
                this.triggers.forEach(trigger => {
                    const distance = this.haversine(
                        currentLocation.lat,
                        currentLocation.lng,
                        trigger.lat,
                        trigger.lon
                    );
                    
                    if (distance <= this.TRIGGER_RADIUS) {
                        const headingDiff = Math.abs(heading - trigger.expectedHeading);
                        const isCorrectDirection = headingDiff <= 45 || headingDiff >= 315;
                        
                        if (isCorrectDirection) {
                            this.signals[trigger.controlsSignal].updateStatus("GREEN");
                        }
                    }
                });
            }
            currentIndex++;
            setTimeout(processNext, 25000);
        };
        processNext();
    }

    haversine(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * 
                  Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }

    calculateHeading(point1, point2) {
        const dLon = (point2.lng - point1.lng);
        const y = Math.sin(dLon) * Math.cos(point2.lat);
        const x = Math.cos(point1.lat) * Math.sin(point2.lat) -
                  Math.sin(point1.lat) * Math.cos(point2.lat) * Math.cos(dLon);
        let heading = Math.atan2(y, x) * 180 / Math.PI;
        return (heading + 360) % 360;
    }

    resetSignals() {
        Object.values(this.signals).forEach(signal => 
            signal.updateStatus("RED")
        );
    }
}