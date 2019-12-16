const math = require('mathjs');
const numberHelper = require('./numberHelper');
const { cos, sin, atan2, acos, pow, sqrt } = math;

module.exports.calculateBearing = function(startPosition, endPosition) {
    const lat1 = (startPosition.lat * Math.PI) / 180;
    const lat2 = (endPosition.lat * Math.PI) / 180;
    const lng1 = (startPosition.lng * Math.PI) / 180;
    const lng2 = (endPosition.lng * Math.PI) / 180;

    let dLon = lng2 - lng1;
    let X = math.cos(lat2) * math.sin(dLon);
    let Y = cos(lat1) * sin(lat2) - sin(lat1) * cos(lat2) * cos(dLon);

    if (cos(lat2) * sin(lng2 - lng1) === 0) {
        if (lat2 > lat1) {
            return 0;
        } else {
            return 180;
        }
    } else {
        let BE = atan2(X, Y);
        BE = (BE * 180) / Math.PI;
        BE = (BE + 360) % 360;
        return numberHelper.round(BE, 2);
    }
};
/*

module.exports.measureDistance1 = function(
    startPosition,
    endPosition,
    unit = 'M',
) {
    const lat1 = (startPosition.lat * Math.PI) / 180;
    const lat2 = (endPosition.lat * Math.PI) / 180;
    const lng1 = (startPosition.lng * Math.PI) / 180;
    const lng2 = (endPosition.lng * Math.PI) / 180;

    if (lat1 == lat2 && lng1 == lng2) {
        return 0;
    } else {
        const dLon = lng2 - lng1;
        const dLat = lat2 - lat1;

        let a =
            pow(sin(dLat / 2), 2) +
            cos(lat1) * cos(lat2) * pow(sin(dLon / 2), 2);
        let c = 2 * atan2(sqrt(a), sqrt(1 - a));
        let R = 3958.7613;
        let dist = Math.PI * c;
        //dist = acos(dist);
        //dist = (dist * 180) / Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit == 'K') {
            dist = dist * 1.609344;
        }
        if (unit == 'N') {
            dist = dist * 0.8684;
        }
        return dist;
    }
};
*/

module.exports.measureDistance = function(
    startPosition,
    endPosition,
    unit = 'K',
) {
    const lat1 = (startPosition.lat * Math.PI) / 180;
    const lat2 = (endPosition.lat * Math.PI) / 180;
    const lng1 = (startPosition.lng * Math.PI) / 180;
    const lng2 = (endPosition.lng * Math.PI) / 180;

    if (lat1 == lat2 && lng1 == lng2) {
        return 0;
    } else {
        const dLon = lng2 - lng1;

        let dist = sin(lat1) * sin(lat2) + cos(lat1) * cos(lat2) * cos(dLon);
        if (dist > 1) {
            dist = 1;
        }
        dist = acos(dist);
        dist = (dist * 180) / Math.PI;
        dist = dist * 60 * 1.1515;
        dist = dist * 1.609344 * 1000;
        return numberHelper.round(dist);
    }
};
