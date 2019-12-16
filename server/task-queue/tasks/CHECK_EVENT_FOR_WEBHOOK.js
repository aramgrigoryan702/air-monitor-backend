const eventService = require('../../services/eventService');
const deviceService = require('../../services/deviceService');
const QueueManager = require('../QueueManager');

class CHECK_EVENT_FOR_WEBHOOK {
	constructor(data) {
		if (!data || !data.coreid || !data.body) {
			throw new Error('Invalid CHECK_EVENT_FOR_WEBHOOK data');
		}
		this.data = { ...data };
	}
	async process() {
		try {
			let data = this.data;
			let resp = await eventService.checkEventForWebhook(
				data.coreid,
				data.body,
			);
			console.log('CHECK_EVENT_FOR_WEBHOOK done', resp);
			return resp;
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

module.exports = CHECK_EVENT_FOR_WEBHOOK;
