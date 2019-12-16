const { isNil, snakeCase } = require('lodash');
const validator = require('validator');
const modelInstance = require('../models/index');
const QueueManager = require('../task-queue/QueueManager');
const activityService = require('../services/activityService');

const { DeviceLog, Device } = modelInstance;

const deviceLogfieldAliases = {
	device_id: ['coreid'],
	timestamp: ['TS', 'Time'],
	userID: ['user'],
};

const deviceLogfieldAliasesKeys = Object.keys(deviceLogfieldAliases);

module.exports.receive = async function(body, sessionUser) {
	try {
		// console.log('device logs body received', body);
		let { data, ...rest } = body;
		if (typeof data === 'undefined' || data === null) {
			return new Error('Invalid data parameter');
		}
		let modelData = {
			...data,
			...rest,
			received_at: new Date(),
		};
		await DeviceLog.create(modelData);
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
			console.log('error at log event ', err);
		}

		//console.log('Diagnostic Event  created as', createdLog.toJSON());
		return {
			success: true,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.receiveActivity = async function(body, sessionUser) {
	try {
		// console.log('device logs body received', body);
		let { data, ...rest } = body;
		if (typeof data === 'undefined' || data === null) {
			return new Error('Invalid data parameter');
		}
		let modelData = {
			...data,
			...rest,
		};
		for (let i = 0; i < deviceLogfieldAliasesKeys.length; i++) {
			let keyName = deviceLogfieldAliasesKeys[i];
			if (
				typeof modelData[keyName] === 'undefined' ||
				modelData[keyName] === null
			) {
				let _fieldAlias = deviceLogfieldAliases[keyName];
				for (let j = 0; j < _fieldAlias.length; j++) {
					let _key = _fieldAlias[j];
					if (typeof modelData[_key] !== 'undefined') {
						modelData[keyName] = modelData[_key];
						break;
					}
				}
			}
		}

		if (!modelData.activity) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter activity',
			});
		}

		if (!modelData.userID) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter userID',
			});
		}
		if (
			modelData.userID &&
			!validator.isEmail(modelData.userID.toString().trim())
		) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter userID',
			});
		}
		modelData.activity = snakeCase(
			modelData.activity.toString().trim(),
		).toUpperCase();
		if (modelData.timestamp) {
			modelData.timestamp = new Date(modelData.timestamp);
		}
		console.log('modelData at device activity logs', modelData);
		try {
			if (modelData.device_id) {
				await activityService.handleActivityTracking(
					modelData.activity,
					'DEVICE',
					{
						device_id: modelData.coreid,
						notes: modelData.notes,
						show: modelData.show,
						timestamp: modelData.timestamp,
					},
					{ sessionUser: { email: modelData.userID } },
				);
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
			} else if (modelData.site_id) {
				await activityService.handleActivityTracking(
					modelData.activity,
					'SITE',
					{
						id: modelData.site_id,
						notes: modelData.notes,
						show: modelData.show,
					},
					{ sessionUser: { email: modelData.userID } },
				);
			} else {
				return Promise.reject({
					status: 400,
					message: 'Unknown request body!',
				});
			}
		} catch (err) {
			console.log('error at log event ', err);
			return Promise.reject({
				status: 400,
				message: 'Failed to processed!',
			});
		}

		//console.log('Diagnostic Event  created as', createdLog.toJSON());
		return {
			success: true,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};
