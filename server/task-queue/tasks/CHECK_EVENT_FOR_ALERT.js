const eventService = require('../../services/eventService');
const deviceService = require('../../services/deviceService');
const QueueManager = require('../QueueManager');

class CHECK_EVENT_FOR_ALERT {
	constructor(data) {
		console.log(data);
		if (!data || !data.coreid) {
			throw new Error('Invalid CHECK_EVENT_FOR_ALERT data');
		}
		this.data = { ...data };
	}
	async process() {
		try {
			let data = this.data;
			let resp = await eventService.checkEventForAlert(data.coreid);
			console.log('CHECK_EVENT_FOR_ALERT done', resp);
			return resp;
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

module.exports = CHECK_EVENT_FOR_ALERT;
