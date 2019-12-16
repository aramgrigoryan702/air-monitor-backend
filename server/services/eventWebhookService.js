const axios = require('axios');

const { Sequelize, EventWebhookNotification } = require('../models/index');
const { Op } = Sequelize;

module.exports.processWebhook = async function({
	event,
	company_id,
	webhook_url,
}) {
	try {
		let result;
		if (webhook_url && webhook_url.search(process.env.BASE_URL) === -1) {
			try {
				result = await axios.post(webhook_url, event);
			} catch (error) {
				if (
					error &&
					error.response &&
					error.response.status >= 400 &&
					error.response.status <= 501
				) {
					await EventWebhookNotification.create({
						webhook_url: webhook_url,
						status: error.response.status,
						timestamp: new Date(),
						company_id: company_id,
						requestBody: event,
						coreid: event.coreid,
						responseBody: null,
					});
				} else {
					return Promise.reject(error);
				}
			}
			try {
				await EventWebhookNotification.create({
					webhook_url: webhook_url,
					status: result.status,
					timestamp: new Date(),
					company_id: company_id,
					coreid: event.coreid,
					requestBody: event,
					responseBody: result.data,
				});
			} catch (err) {
				console.log(err);
			}
			return {
				success: true,
			};
		} else {
			console.log(
				'Webhook can not post data to its own server. So skipping',
			);
			return {
				success: true,
			};
		}
	} catch (ex) {
		console.log('error at processEventWebhook', ex);
		return Promise.reject(ex);
	}
};
