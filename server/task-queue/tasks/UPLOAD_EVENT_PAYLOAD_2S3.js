const moment = require('moment');
const s3FileServer = require('../../services/common/s3FileService');

class UPLOAD_EVENT_PAYLOAD_2S3 {
	constructor(data) {
		console.log(data);
		if (!data) {
			throw new Error('Invalid UPLOAD_EVENT_PAYLOAD_2S3 data');
		}
		this.data = { ...data };
	}
	async process() {
		try {
			let data = this.data;
			if (data && data.coreid) {
				let timeDate = data.timestamp
					? new Date(data.timestamp)
					: new Date();
				let utcTimeString = moment(timeDate)
					.utc()
					.format('YYYY-MM DD-hh:mm a');
				let timestampStr = timeDate.toISOString();
				await s3FileServer.uploadJsonData(data, {
					bucketName: process.env.EVENT_PAYLOAD_BUCKET_NAME,
					key: `${data.coreid}/${utcTimeString}/${timestampStr}`,
				});
				return { success: true };
			} else {
				return { success: false };
			}
		} catch (err) {
			return Promise.reject(err);
		}
	}
}

module.exports = UPLOAD_EVENT_PAYLOAD_2S3;
