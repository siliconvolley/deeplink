class CentralOrchestrator {
    constructor() {
        this.junctions = new Map();
        this.activeAmbulances = new Map();
    }

    registerJunction(junction) {
        this.junctions.set(junction.id, junction);
    }

    handleEmergency(ambulanceId, route, severity) {
        const priority = this.calculatePriority(severity);
        const pathJunctions = this.detectJunctionsInPath(route);
        
        pathJunctions.forEach(jId => {
            const junction = this.junctions.get(jId);
            if (junction) {
                junction.processAmbulance(
                    ambulanceId,
                    priority,
                    route.coordinates
                );
            }
        });
        
        this.activeAmbulances.set(ambulanceId, {
            route,
            priority,
            startTime: Date.now()
        });
    }

    detectJunctionsInPath(route) {
        const junctions = [];
        const coord = route.coordinates[0];
        
        this.junctions.forEach((junction, id) => {
            junction.triggers.forEach(trigger => {
                const distance = junction.haversine(
                    coord.lat,
                    coord.lng,
                    trigger.lat,
                    trigger.lon
                );
                if (distance < 0.5) junctions.push(id);
            });
        });
        
        return Array.from(new Set(junctions));
    }

    calculatePriority(severity) {
        const levels = {low: 1, medium: 2, high: 3};
        return levels[severity.toLowerCase()] || 1;
    }
}

export const centralOrchestrator = new CentralOrchestrator();