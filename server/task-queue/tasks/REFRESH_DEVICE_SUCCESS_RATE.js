const deviceSuccessRateService = require('../../services/deviceSuccessRateService');

class REFRESH_DEVICE_SUCCESS_RATE {
	constructor(data = {}) {
		this.data = { ...data };
	}
	async process() {
		try {
			let resp = await deviceSuccessRateService.calculateSuccessRate();
			console.log(
				'Refresh REFRESH_DEVICE_SUCCESS_RATE Done',
				new Date().toDateString(),
			);
			return resp;
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

module.exports = REFRESH_DEVICE_SUCCESS_RATE;
