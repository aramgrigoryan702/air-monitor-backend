const emailService = require('../../services/common/emailService');

class SEND_MAIL {
    constructor(data) {
        if (!data || !data.to || !data.body || !data.subject) {
            throw new Error('Invalid  data');
        }
        this.data = { ...data };
    }

    async process() {
        try {
            let resp = await emailService.sendEmail(this.data);
            return resp;
        } catch (err) {
            console.log('Error at sending mail', err);
            return Promise.reject(err);
        }
    }
}

module.exports = SEND_MAIL;
