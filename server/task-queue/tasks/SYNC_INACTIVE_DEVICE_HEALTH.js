const deviceService = require('../../services/deviceService');

class SYNC_DEVICE_HEALTH {
    async process() {
        try {
            let resp = await deviceService.syncInActiveHealthData();
            console.log('SYNC_DEVICE_HEALTH done', resp);
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = SYNC_DEVICE_HEALTH;
