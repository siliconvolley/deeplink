import { map } from './map.js';

const triggerPoints = {
    'T1': {
        id: 'T1',
        lat: 12.885033,
        lon: 74.838820,
        controlsSignal: 'A1',
        road: 'MG_ROAD',
        direction: 'NORTH',
        expectedHeading: 0
    },
    'T2': {
        id: 'T2',
        lat: 12.886133,
        lon: 74.838792,
        controlsSignal: 'B1',
        road: 'MG_ROAD',
        direction: 'SOUTH',
        expectedHeading: 180
    },
    'T3': {
        id: 'T3',
        lat: 12.885489,
        lon: 74.839404,
        controlsSignal: 'C1',
        road: 'BEJAI_ROAD',
        direction: 'WEST',
        expectedHeading: 270
    }
};

export function addTriggerMarkers() {
    Object.values(triggerPoints).forEach(trigger => {
        L.marker([trigger.lat, trigger.lon], {
            icon: L.divIcon({
                className: 'trigger-icon',
                html: `<div style="background-color: yellow; width: 15px; height: 15px; border-radius: 50%; border: 2px solid black;"></div>`
            })
        })
        .addTo(map)
        .bindPopup(`Trigger ${trigger.id} (${trigger.direction})`);
    });
}

export { triggerPoints };
