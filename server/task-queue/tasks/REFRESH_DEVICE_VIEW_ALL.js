const deviceService = require('../../services/deviceService');

class REFRESH_DEVICE_VIEW_ALL {
    constructor(data = {}) {
        this.data = { ...data };
    }
    async process() {
        try {
            //let data = this.data;
            let resp = await deviceService.refreshDeviceViewAll();
            console.log(
                'Refresh Device View Hourly/Daily  Done',
                new Date().toDateString(),
            );
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = REFRESH_DEVICE_VIEW_ALL;
