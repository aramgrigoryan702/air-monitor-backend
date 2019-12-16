const devEmailService = require('../../services/common/devEmailService');

class SEND_DEV_MAIL {
    constructor(data) {
        if (!data || !data.to || !data.body || !data.subject) {
            throw new Error('Invalid  data');
        }
        this.data = { ...data };
    }

    async process() {
        try {
            let resp = await devEmailService.sendEmail(this.data);
            return resp;
        } catch (err) {
            console.log('Error at sending mail', err);
            return Promise.reject(err);
        }
    }
}

module.exports = SEND_DEV_MAIL;
