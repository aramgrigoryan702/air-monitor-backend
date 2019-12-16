const deviceService = require('../../services/deviceService');

class SYNC_DEVICE_HEALTH {
	constructor(data) {
		console.log(data);
		if (!data || !data.id) {
			throw new Error('Invalid SYNC_DEVICE_HEALTH data');
		}
		this.data = { ...data };
	}
	async process() {
		try {
			let data = this.data;
			let resp = await deviceService.syncHealthData(data.id);
			return resp;
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

module.exports = SYNC_DEVICE_HEALTH;
