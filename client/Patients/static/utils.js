export function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

export function calculateHeading(point1, point2) {
    const dLon = (point2.lng - point1.lng);
    const y = Math.sin(dLon) * Math.cos(point2.lat);
    const x = Math.cos(point1.lat) * Math.sin(point2.lat) -
        Math.sin(point1.lat) * Math.cos(point2.lat) * Math.cos(dLon);
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    heading = (heading + 360) % 360;
    return heading;
}
