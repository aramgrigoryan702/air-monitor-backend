const _ = require('lodash');
const config = require('../config');
const modelInstance = require('../models/index');
const QueueManager = require('../task-queue/QueueManager');

const { Diagnostic, Device } = modelInstance;

module.exports.receive = async function(body, sessionUser) {
	try {
		//console.log('diagnostic body received', body);
		let { data, ...rest } = body;
		if (_.isUndefined(data) || _.isNull(data)) {
			return new Error('Invalid data parameter');
		}
		let modelData = {
			...data,
			...rest,
			received_at: new Date(),
		};
		await Diagnostic.create(modelData);
		try {
			if (modelData.coreid) {
				await Device.update(
					{
						last_reported_time: new Date(),
					},
					{
						where: {
							id: modelData.coreid,
						},
						// transaction: transaction,
					},
				);
				await QueueManager.addDeviceHealthSyncTask({
					id: modelData.coreid,
				});
			}
		} catch (err) {
			console.log('error at diagonstic event ', err);
		}

		//console.log('Diagnostic Event  created as', createdDiagonstic.toJSON());
		return {
			success: true,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};
