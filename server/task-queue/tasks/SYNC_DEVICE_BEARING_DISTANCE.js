const deviceService = require('../../services/deviceService');

class SYNC_DEVICE_BEARING_DISTANCE {
    constructor(data) {
        console.log(data);
        if (!data || !data.id) {
            throw new Error('Invalid SYNC_DEVICE_BEARING_DISTANCE data');
        }
        this.data = { ...data };
    }
    async process() {
        try {
            let data = this.data;
            let resp = await deviceService.syncDistanceAndBearingData(data.id);
            console.log('SYNC_DEVICE_BEARING_DISTANCE done', resp);
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = SYNC_DEVICE_BEARING_DISTANCE;
