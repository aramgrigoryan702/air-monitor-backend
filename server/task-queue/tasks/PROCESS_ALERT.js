const alertNotificationService = require('../../services/alertNotificationService');

class PROCESS_ALERT {
    constructor(data) {
        if (!data || !data.id) {
            throw new Error('Invalid  data');
        }
        this.data = { ...data };
    }

    async process() {
        try {
            let resp = await alertNotificationService.processAlert(this.data);
            return resp;
        } catch (err) {
            console.log('Error at sending alert mail', err);
            return Promise.reject(err);
        }
    }
}

module.exports = PROCESS_ALERT;
