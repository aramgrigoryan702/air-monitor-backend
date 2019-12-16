const alertEmailService = require('../../services/common/alertEmailService');

class SEND_ALERT_MAIL {
    constructor(data) {
        if (!data || !data.to || !data.body || !data.subject) {
            throw new Error('Invalid  data');
        }
        this.data = { ...data };
    }

    async process() {
        try {
            let resp = await alertEmailService.sendEmail(this.data);
            return resp;
        } catch (err) {
            console.log('Error at sending alert mail', err);
            return Promise.reject(err);
        }
    }
}

module.exports = SEND_ALERT_MAIL;
