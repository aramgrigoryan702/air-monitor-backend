const AWS = require('aws-sdk');
const loggerService = require('./loggerService');

AWS.config.region = process.env.AWS_REGION;
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_KEY,
});

let QueueUrl;

const sqs = new AWS.SQS({ apiVersion: '2012-11-05' });

module.exports.sendEventPayload = async function(payload) {
	try {
		if (!QueueUrl) {
			let results = await sqs
				.getQueueUrl({ QueueName: process.env.SQS_EVENT_BUCKET_NAME })
				.promise();
			if (results && results.QueueUrl) {
				QueueUrl = results.QueueUrl;
			}
		}
		let params = {
			MessageBody: JSON.stringify(payload),
			QueueUrl: QueueUrl,
		};
		await sqs.sendMessage(params).promise();
		return {
			success: true,
		};
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return Promise.reject(err);
	}
};
