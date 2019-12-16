const eventService = require('../../services/eventService');
const deviceService = require('../../services/deviceService');
const QueueManager = require('../QueueManager');

class UPDATE_LATEST_EVENT {
	constructor(data) {
		console.log(data);
		if (!data || !data.event_ID || !data.coreid || !data.TimeStamp) {
			throw new Error('Invalid UPDATE_LATEST_EVENT data');
		}
		this.data = { ...data };
	}
	async process() {
		try {
			let data = this.data;
			let resp = await eventService.updateRecentEvent(data);
			if (data.coreid) {
				let exists = await deviceService.deviceExists(data.coreid);
				await QueueManager.addDeviceSyncTask({ coreid: data.coreid });
				if (exists) {
					await QueueManager.addDeviceHealthSyncTask({
						id: data.coreid,
					});
				}
				console.log('device UPDATE_LATEST_EVENT done', resp);
				return { success: true };
			}
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

module.exports = UPDATE_LATEST_EVENT;
