const deviceService = require('../../services/deviceService');

class REFRESH_DEVICE_VIEW {
    constructor(data = {}) {
        this.data = { ...data };
    }
    async process() {
        try {
            //let data = this.data;
            let resp = await deviceService.refreshDeviceView();
            console.log('Refresh Device View Done', new Date().toDateString());
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = REFRESH_DEVICE_VIEW;
