const eventWebhookService = require('../../services/eventWebhookService');
class PROCESS_EVENT_WEBHOOK {
	constructor(data) {
		if (!data || !data.webhook_url || !data.event) {
			throw new Error('Invalid  data');
		}
		this.data = { ...data };
	}

	async process() {
		try {
			let resp = await eventWebhookService.processWebhook(this.data);
			return resp;
		} catch (err) {
			console.log('Error at PROCESS_EVENT_WEBHOOK', err);
			return Promise.reject(err);
		}
	}
}

module.exports = PROCESS_EVENT_WEBHOOK;
