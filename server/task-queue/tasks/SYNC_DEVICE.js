const deviceService = require('../../services/deviceService');

class SYNC_DEVICE {
    constructor(data) {
        console.log(data);
        if (!data || !data.coreid) {
            throw new Error('Invalid SYNC_DEVICE data');
        }
        this.data = { ...data };
    }
    async process() {
        try {
            let data = this.data;
            let resp = await deviceService.syncDeviceFromEvent(data.coreid);
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = SYNC_DEVICE;
