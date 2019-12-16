const _ = require('lodash');
const config = require('../config');
const modelInstance = require('../models/index');
const windrose = require('windrose');
const { subHours, subMinutes, isBefore, isAfter } = require('date-fns');
const eventService = require('./eventService');
const siteService = require('./siteService');
const redisService = require('./common/redisService');
const { round } = require('../helpers/numberHelper');
const activityHelper = require('../helpers/activityHelper');
const logService = require('../services/common/loggerService');
const locationCalculationHelper = require('../helpers/locationCalculationHelper');
const activityService = require('./activityService');
const QueueManager = require('../task-queue/QueueManager');
const userTypes = require('../types/UserTypes');
const { isNil } = require('lodash');

const {
	Event,
	LatestEvent,
	Device,
	Activity,
	Lookup,
	Site,
	Collection,
	DomainLookup,
	Map,
	Sequelize,
	sequelize,
	FailedProcessLog,
	DeviceLog,
	Diagnostic,
} = modelInstance;

const { Op } = Sequelize;
const editableFieldNames = ['active', 'notes', 'position'];

function getDefaultAssociation() {
	return [
		{
			model: Site,
			attributes: ['name', 'id', 'collection_ID'],
			as: 'site',
			required: false,
			include: [
				{
					model: Collection,
					attributes: ['name', 'id', 'parentID'],
					as: 'operational_unit',
					required: false,
				},
			],
		},
		{
			model: Lookup,
			attributes: ['name'],
			as: 'positionLookup',
			required: false,
		},
		{
			model: LatestEvent,
			as: 'last_event',
			required: false,
			attributes: ['id'],
			include: [
				{
					model: Event,
					as: 'event',
					required: false,
				},
			],
		},
	];
}

/***
 * Search and  get data  as paginated
 * @param params
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.query = async function(params, sessionUser) {
	try {
		let limit = params.limit || config.system.pageSize,
			offset = params.offset || 0;
		let whereCondition = params.whereCondition || {};
		if (typeof whereCondition === 'string') {
			try {
				whereCondition = JSON.parse(whereCondition);
			} catch (err) {
				console.log(err);
				return Promise.reject({
					status: 400,
					message: 'Invalid search query',
				});
			}
		}
		let idParam = whereCondition ? whereCondition.id : null;

		/* if (
            !idParam &&
            (sessionUser.groupName === userTypes.VIEWER ||
                sessionUser.groupName === userTypes.EDITOR)
        ) {
            return {
                data: [],
                paging: {
                    offset,
                    limit,
                    count: 0,
                },
            };
        }*/
		let containerType = whereCondition.containerType;
		let whereClause = {};
		if (containerType) {
			switch (containerType) {
				case 'company':
					whereClause['$site.operational_unit.parentID$'] = idParam;
					break;
				case 'division':
					whereClause['$site.collection_ID$'] = idParam;
					break;
				default:
					whereClause.site_ID = idParam;
					break;
			}
		} else {
			//whereClause.site_ID = idParam;
		}

		if (
			sessionUser.groupName === userTypes.VIEWER ||
			sessionUser.groupName === userTypes.EDITOR
		) {
			let companyId = sessionUser.companyId;
			if (!companyId) {
				return {
					data: [],
					paging: {
						offset,
						limit,
						count: 0,
					},
				};
			}
			whereClause['$site.operational_unit.parentID$'] = companyId;
		}
		let sort_column = params.sort_column;
		let sort_order = params.sort_order;
		let sortObj = undefined;
		if (sort_column && sort_order) {
			if (sort_column.toLowerCase() === 'last_event->event.tempc') {
				sort_column = 'last_event->event.TempF';
			} else if (
				sort_column.toLowerCase() === 'last_event->event.windspeedms'
			) {
				sort_column = 'last_event->event.WindSpeed';
			}
			sortObj = [
				[
					modelInstance.Sequelize.col(sort_column),
					sort_order.toString().toUpperCase(),
				],
			];
		}

		let foundData = await Device.findAndCountAll({
			include: getDefaultAssociation(sortObj),
			where: whereClause,
			order: sortObj,
			limit,
			offset,
			raw: true,
			// logging:true
		});
		//.map(item => item.toJSON())

		let result = {
			data: foundData.rows,
			paging: {
				offset,
				limit,
				count: foundData.count,
			},
		};
		return result;
	} catch (ex) {
		console.log(ex);
		return Promise.reject({ status: 400, message: ex.message });
	}
};

/***
 * Find One by id?
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.findOne = async function(id, sessionUser) {
	try {
		let data = await Device.findByPk(id, {
			include: getDefaultAssociation({}),
			raw: true,
		});
		if (data) {
			return { data: data };
		} else {
			return Promise.reject({
				status: 400,
				message: 'Record not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.receive = async function(body) {
	try {
		let isBearingSyncRequired = false;
		let deviceMapChangedAttributes;
		let { data, userid, ...rest } = body;
		if (_.isUndefined(data) || _.isNull(data)) {
			return new Error('Invalid data parameter');
		}
		let modelData = {
			...data,
			...rest,
			customer_ID: userid,
			received_at: new Date(),
		};
		try {
			await QueueManager.addDeviceDataUploadToS3Task({
				...body,
				timestamp: new Date(),
			});
		} catch (ex) {
			console.log(ex);
		}
		//console.log('at device receive for ', modelData.coreid);
		//console.log('Data Received as', body);
		let insertedData;
		if (modelData.coreid) {
			modelData.id = modelData.coreid;
			modelData.coreid = null;
		}

		if (modelData.HDOP) {
			modelData.HDOP = parseFloat(modelData.HDOP.toString());
		}

		if (modelData.board && !modelData.boardRev) {
			modelData.boardRev = modelData.board;
		}

		if (modelData.Latitude) {
			modelData.Latitude = round(parseFloat(modelData.Latitude), 5);
		}

		if (modelData.Longitude) {
			modelData.Longitude = round(parseFloat(modelData.Longitude), 5);
		}

		let foundDevice = await Device.findByPk(modelData.id);
		let transaction = await modelInstance.sequelize.transaction({
			isolationLevel:
				modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
					.READ_COMMITTED,
		});
		try {
			if (foundDevice) {
				foundDevice.set('last_reported_time', new Date());
				if (modelData.firmware) {
					let firmware = modelData.firmware.toString().trim();
					if (firmware && firmware !== foundDevice.get('firmware')) {
						await activityService.handleActivityTracking(
							'FIRMWARE_UPDATE',
							'DEVICE',
							{
								device_id: foundDevice.id,
								notes: 'Firmware Updated ',
								changes: [
									{
										from: foundDevice.get('firmware'),
										to: firmware,
										property: 'firmware',
									},
								],
							},
							{
								sessionUser: { email: 'SYSTEM' },
								transaction: transaction,
							},
						);
					}
					foundDevice.set(
						'firmware',
						modelData.firmware.toString().trim(),
					);
				}

				if (modelData.boardRev) {
					let boardRev = modelData.boardRev.toString().trim();
					if (boardRev) {
						if (
							boardRev &&
							boardRev !== foundDevice.get('boardRev')
						) {
							await activityService.handleActivityTracking(
								'BOARD_REV_UPDATE',
								'DEVICE',
								{
									device_id: foundDevice.id,
									notes: 'Board Revision Updated ',
									changes: [
										{
											from: foundDevice.get('boardRev'),
											to: boardRev,
											property: 'boardRev',
										},
									],
								},
								{
									sessionUser: { email: 'SYSTEM' },
									transaction: transaction,
								},
							);
						}
					}
				}

				if (modelData.HDOP) {
					foundDevice.set('HDOP', modelData.HDOP);
				}

				if (modelData.iccid) {
					foundDevice.set('iccid', modelData.iccid);
				}
				if (modelData.imei) {
					foundDevice.set('imei', modelData.imei);
				}
				if (modelData.CCS_Version) {
					foundDevice.set('CCS_Version', modelData.CCS_Version);
				}
				if (modelData.C3_Version) {
					foundDevice.set('C3_Version', modelData.C3_Version);
				}

				if (foundDevice.get('isLocationLocked') === false) {
					if (
						!isNil(modelData.Latitude) &&
						modelData.Latitude !== 0 &&
						!isNil(modelData.Longitude) &&
						modelData.Longitude !== 0 &&
						modelData.HDOP !== 100
					) {
						if (modelData.Latitude !== foundDevice.get('lat')) {
							foundDevice.set('lat', modelData.Latitude);
							isBearingSyncRequired = true;
						}

						if (modelData.Longitude !== foundDevice.get('lng')) {
							foundDevice.set('lng', modelData.Longitude);
							isBearingSyncRequired = true;
						}
						if (isBearingSyncRequired) {
							deviceMapChangedAttributes = activityHelper.getChangedState(
								foundDevice,
								{
									//nested: true,
									propertyName: 'lat, lng',
									allowedProperties: ['lat', 'lng'],
								},
							);
							isBearingSyncRequired = true;
						}
					}
				}
				let _changedKeys = foundDevice.changed();
				if (_changedKeys.length > 0) {
					let changedObj = {};
					_changedKeys.forEach(keyName => {
						changedObj[keyName] = foundDevice.get(keyName);
					});
					let res = await Device.update(changedObj, {
						where: { id: foundDevice.id },
						transaction: transaction,
					});
					console.log('Device updated', res);
				}

				// console.log('foundDevice changes', foundDevice.changed());
				// await foundDevice.save({ transaction: transaction });
				if (deviceMapChangedAttributes) {
					await activityService.handleActivityTracking(
						'DEVICE_LOCATION_CHANGED',
						'DEVICE',
						{
							device_id: foundDevice.id,
							notes: 'DEVICE location added',
							changes: deviceMapChangedAttributes,
						},
						{
							sessionUser: 'SYSTEM',
							transaction: transaction,
						},
					);
				}
			} else {
				if (modelData.firmware) {
					modelData.firmware = modelData.firmware.toString().trim();
				}
				if (modelData.boardRev) {
					modelData.boardRev = modelData.boardRev.toString().trim();
				}
				modelData.last_reported_time = new Date();

				let defaultSite = await siteService.findAdminDefaultSite({
					transaction: transaction,
				});
				if (defaultSite) {
					modelData.site_ID = defaultSite.id;
				}
				if (
					!isNil(modelData.Latitude) &&
					modelData.Latitude !== 0 &&
					!isNil(modelData.Longitude) &&
					modelData.Longitude !== 0 &&
					modelData.HDOP !== 100
				) {
					modelData.lat = modelData.Latitude;
					modelData.lng = modelData.Longitude;
					isBearingSyncRequired = true;
				}

				insertedData = await Device.create(modelData, {
					transaction: transaction,
				});
				await activityService.handleActivityTracking(
					'DEVICE_RECEIVE',
					'DEVICE',
					{ device_id: insertedData.id, notes: 'Initial Entry' },
					{
						sessionUser: { email: 'SYSTEM' },
						transaction: transaction,
					},
				);
			}
			await transaction.commit();
			await QueueManager.addDeviceHealthSyncTask({ id: modelData.id });
			if (isBearingSyncRequired && insertedData && insertedData.site_ID) {
				await QueueManager.addDeviceBearingAndDistanceSyncTask({
					id: modelData.id,
				});
			} else if (
				isBearingSyncRequired &&
				foundDevice &&
				foundDevice.site_ID
			) {
				await QueueManager.addDeviceBearingAndDistanceSyncTask({
					id: foundDevice.id,
				});
			}
			await redisService.delete('global_menu_data');
		} catch (ex) {
			console.log(ex);
			console.log('Error for the body', body);
			await transaction.rollback();
			throw ex;
		}
		return { success: true };
	} catch (ex) {
		console.log(ex);
		FailedProcessLog.build({
			event: 'DEVICE_RECEIVE',
			body: JSON.stringify(body, 4),
			TimeStamp: new Date(),
		})
			.save()
			.catch(err => {
				console.log(err);
			});
		logService.logFatalError(ex);
		return Promise.reject(ex);
	}
};

module.exports.findAndSetFirmware = async function(modelData, { transaction }) {
	let domainData = await DomainLookup.findOne({
		where: { name: 'FIRMWARE' },
		raw: true,
	});
	if (!domainData) {
		return Promise.reject({
			status: 400,
			message: 'FIRMWARE domain lookup not found',
		});
	}
	let [firmWarelookupData] = await Lookup.findOrCreate({
		where: {
			name: modelData.firmware.toString(),
			domainID: domainData.id,
		},
		defaults: {
			name: modelData.firmware.toString(),
			domainID: domainData.id,
		},
		raw: true,
		transaction: transaction,
	});

	return firmWarelookupData;
};

module.exports.findAndSetBoardRev = async function(modelData, { transaction }) {
	let domainData = await DomainLookup.findOne({
		where: { name: 'BOARDREV' },
		raw: true,
	});
	if (!domainData) {
		return Promise.reject({
			status: 400,
			message: 'BOARDREV domain lookup not found',
		});
	}
	let [boardRevLookupData] = await Lookup.findOrCreate({
		where: {
			name: modelData.boardRev.toString(),
			domainID: domainData.id,
		},
		defaults: {
			name: modelData.boardRev.toString(),
			domainID: domainData.id,
		},
		raw: true,
		transaction: transaction,
	});

	return boardRevLookupData;
};

/***
 * Update  Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.update = async function(data, sessionUser) {
	try {
		if (!data || (data && (!data.activity_ID || !data.notes))) {
			return Promise.reject({
				status: 400,
				message: 'activity and notes required',
			});
		}
		let toBeUpdatedData = {
			...data,
		};
		let result;
		let foundData = await Device.findByPk(toBeUpdatedData.id);
		if (foundData) {
			Object.keys(toBeUpdatedData).forEach(key => {
				if (editableFieldNames.indexOf(key) > -1) {
					foundData.set(key, toBeUpdatedData[key]);
				}
			});

			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});
			try {
				await foundData.save({ transaction });
				await activityService.handleActivityTracking(
					'DEVICE_EDIT',
					'DEVICE',
					{ device_id: foundData.id, notes: 'Device Edited' },
					{ sessionUser: sessionUser, transaction: transaction },
				);

				result = await Device.findByPk(foundData.id, {
					include: getDefaultAssociation({}),
					raw: true,
					transaction: transaction,
				});
				await transaction.commit();
			} catch (ex) {
				await transaction.rollback();
				throw ex;
			}
			await module.exports.syncDistanceAndBearingData(foundData.id);
			await redisService.delete('global_menu_data');
			return { data: result };
		} else {
			return Promise.reject({
				status: 400,
				message: 'Record not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.updateSiteId = async function(data, sessionUser) {
	try {
		let toBeUpdatedData = {
			...data,
		};
		let result;
		let toBeMovedSite;
		let site_ID = toBeUpdatedData.site_ID;
		if (!site_ID) {
			return Promise.reject({
				status: 400,
				message: 'site_ID parameter  required',
			});
		}

		const isUnAssigned = site_ID === 'unassigned';

		if (isUnAssigned) {
			let defaultSite = await siteService.findAdminDefaultSite({});
			if (defaultSite) {
				site_ID = defaultSite.id;
			} else {
				site_ID = null;
			}
		} else {
			toBeMovedSite = await Site.findByPk(site_ID);
			if (!toBeMovedSite) {
				return Promise.reject({
					status: 400,
					message: 'Requested site not found in the system',
				});
			}
		}

		let foundData = await Device.findByPk(toBeUpdatedData.id, {
			include: [
				{
					model: Site,
					as: 'site',
					required: false,
				},
			],
		});
		let transaction = await modelInstance.sequelize.transaction({
			isolationLevel:
				modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
					.READ_COMMITTED,
		});
		if (foundData) {
			try {
				if (!isUnAssigned) {
					await activityService.handleActivityTracking(
						'DEVICE_REMOVED',
						'SITE',
						{
							id: foundData.get('site_ID'),
							notes: `Device ${foundData.id} (moved to site ${
								toBeMovedSite.name
							})`,
						},
						{ sessionUser: sessionUser, transaction: transaction },
					);

					await activityService.handleActivityTracking(
						'DEVICE_ASSIGNED',
						'SITE',
						{
							id: site_ID,
							notes: `Device ${foundData.id} assigned to site ${
								toBeMovedSite.name
							} (moved from the site ${
								foundData.site && foundData.site.name
									? foundData.site.name
									: '-'
							})`,
						},
						{
							sessionUser: sessionUser,
							transaction: transaction,
						},
					);
				} else {
					if (
						foundData.get('site_ID') &&
						foundData.get('site_ID').toString() !==
							site_ID.toString()
					) {
						await activityService.handleActivityTracking(
							'DEVICE_REMOVED',
							'SITE',
							{
								id: foundData.get('site_ID'),
								notes: toBeUpdatedData.message,
							},
							{
								sessionUser: sessionUser,
								transaction: transaction,
							},
						);
						await activityService.handleActivityTracking(
							'DEVICE_ASSIGNED',
							'SITE',
							{
								id: site_ID,
								notes: toBeUpdatedData.message,
							},
							{
								sessionUser: sessionUser,
								transaction: transaction,
							},
						);
					}
				}
				foundData.set('site_ID', site_ID);
				foundData.set('dataMissedInHours', 0);
				foundData.set('dataMissedHint', null);
				foundData.set('isLocationLocked', false);
				await Device.update(
					{
						site_ID: site_ID,
						dataMissedInHours: 0,
						dataMissedHint: null,
					},
					{
						where: { id: toBeUpdatedData.id },
						transaction: transaction,
						omitNull: false,
					},
				);

				let deviceNote = '';

				if (foundData.site && foundData.site.name) {
					deviceNote = `Device ${foundData.id} assigned to site ${
						toBeMovedSite.name
					} (moved from site ${
						foundData.site && foundData.site.name
							? foundData.site.name
							: '-'
					})`;
				} else {
					deviceNote = `Device ${foundData.id} assigned to site ${
						toBeMovedSite.name
					}`;
				}

				await activityService.handleActivityTracking(
					'DEVICE_ASSIGNED_TO_SITE',
					'DEVICE',
					{
						device_id: toBeUpdatedData.id,
						notes: deviceNote,
					},
					{ sessionUser: sessionUser, transaction: transaction },
				);
				await transaction.commit();
				await module.exports.syncDistanceAndBearingData(foundData.id);
				result = await Device.findByPk(foundData.id, {
					include: getDefaultAssociation({}),
					raw: true,
				});
				await redisService.delete('global_menu_data');
				return { data: result };
			} catch (ex) {
				await transaction.rollback();
				throw ex;
			}
		} else {
			return Promise.reject({
				status: 400,
				message: 'Record not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.syncInActiveHealthData = async function() {
	try {
		let foundData = await Device.findAll({
			where: {
				'$last_event.TimeStamp$': {
					[Op.lte]: subHours(new Date(), 1),
				},
			},
			include: [
				{
					model: LatestEvent,
					as: 'last_event',
					required: false,
				},
			],
		});
		if (foundData) {
			foundData.forEach(async item => {
				await QueueManager.addDeviceHealthSyncTask({
					id: item.get('id'),
				});
			});
		}
		return { success: true };
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.updateLocation = async function(id, modelData, sessionUser) {
	try {
		let isBearingSyncRequired = false;
		let deviceMapChangedAttributes;

		let foundData = await Device.findByPk(id, {});
		if (foundData) {
			if (foundData.get('isLocationLocked') === false) {
				if (
					!isNil(modelData.lat) &&
					modelData.lat !== 0 &&
					!isNil(modelData.lng) &&
					modelData.lng !== 0
				) {
					if (modelData.lat !== foundData.get('lat')) {
						foundData.set('lat', modelData.lat);
						isBearingSyncRequired = true;
					}

					if (modelData.lng !== foundData.get('lng')) {
						foundData.set('lng', modelData.lng);
						isBearingSyncRequired = true;
					}
					if (isBearingSyncRequired) {
						deviceMapChangedAttributes = activityHelper.getChangedState(
							foundData,
							{
								//nested: true,
								propertyName: 'lat, lng',
								allowedProperties: ['lat', 'lng'],
							},
						);

						await Device.update(
							{
								isLocationLocked: true,
								lat: round(foundData.get('lat'), 5),
								lng: round(foundData.get('lng'), 5),
							},
							{
								where: { id: foundData.get('id') },
							},
						);
						if (deviceMapChangedAttributes) {
							await activityService.handleActivityTracking(
								'DEVICE_LOCATION_CHANGED',
								'DEVICE',
								{
									device_id: foundData.id,
									notes: 'DEVICE location added',
									changes: deviceMapChangedAttributes,
								},
								{
									sessionUser: sessionUser,
								},
							);

							await activityService.handleActivityTracking(
								'DEVICE_LOCATION_LOCKED',
								'DEVICE',
								{
									device_id: foundData.id,
									notes: 'DEVICE location Locked',
									changes: [{ from: false, to: true }],
								},
								{
									sessionUser: sessionUser,
								},
							);
							if (isBearingSyncRequired && foundData.site_ID) {
								await QueueManager.addDeviceBearingAndDistanceSyncTask(
									{
										id: foundData.id,
									},
								);
							}
						}
						return {
							success: true,
						};
					} else {
						return {
							success: true,
						};
					}
				}
			} else {
				return Promise.reject({
					status: 400,
					message: 'Device  is locked',
				});
			}
		} else {
			return Promise.reject({
				status: 400,
				message: 'Device  not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.unlockDeviceLocation = async function(id, sessionUser) {
	try {
		let foundData = await Device.findByPk(id, {});
		if (foundData) {
			await Device.update(
				{
					isLocationLocked: false,
				},
				{
					where: { id: foundData.get('id') },
				},
			);

			await activityService.handleActivityTracking(
				'DEVICE_LOCATION_UNLOCKED',
				'DEVICE',
				{
					device_id: foundData.id,
					notes: 'DEVICE location unlocked',
					changes: [
						{ from: foundData.get('isLocationLocked'), to: false },
					],
				},
				{
					sessionUser: sessionUser,
				},
			);
			await QueueManager.addDeviceSyncTask({
				coreid: foundData.get('id'),
			});
			return {
				success: true,
			};
		} else {
			return Promise.reject({
				status: 400,
				message: 'Device  not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.syncHealthData = async function(id, sessionUser) {
	try {
		let foundData = await Device.findByPk(id, {
			include: [
				{
					model: LatestEvent,
					as: 'last_event',
					required: false,
					attributes: ['id'],
					include: [
						{
							model: Event,
							as: 'event',
							required: false,
						},
					],
				},
			],
		});
		if (foundData) {
			let result = foundData.toJSON();
			let type = 'Canary-C';
			if (
				result.last_event &&
				result.last_event.event &&
				(result.last_event.event.TVOC_PID > 0 ||
					result.last_event.event.PM1_0 > 0 ||
					result.last_event.event.PM2_5 > 0 ||
					result.last_event.event.PM10 > 0)
			) {
				type = 'Canary-S';
			}
			let dataMissedInHours = 0;
			let dataMissedHint = '';
			let lastHour = subHours(new Date(), 1);
			let eventCount = await Event.count({
				where: {
					coreid: id,
					TimeStamp: { [Op.gte]: lastHour },
				},
			});

			let logsCount = await DeviceLog.count({
				where: {
					coreid: id,
					TimeStamp: { [Op.gte]: lastHour },
				},
			});

			let diagnosticCount = await Diagnostic.count({
				where: {
					coreid: id,
					TimeStamp: { [Op.gte]: lastHour },
				},
			});

			eventCount += logsCount + diagnosticCount;
			if (
				foundData.get('last_reported_time') &&
				isAfter(foundData.get('last_reported_time'), lastHour)
			) {
				eventCount += 1;
			}

			if (eventCount >= 4) {
				let eventCountIn24Hour = await Event.count({
					where: {
						coreid: id,
						TimeStamp: { [Op.gte]: subHours(new Date(), 24) },
					},
				});

				if (eventCountIn24Hour >= 24 * 4) {
					let eventCountIn48Hour = await Event.count({
						where: {
							coreid: id,
							TimeStamp: { [Op.gte]: subHours(new Date(), 48) },
						},
					});
					if (eventCountIn48Hour >= 48 * 4) {
						let eventCountIn72Hour = await Event.count({
							where: {
								coreid: id,
								TimeStamp: {
									[Op.gte]: subHours(new Date(), 72),
								},
							},
						});
						if (eventCountIn72Hour < 72 * 4) {
							dataMissedInHours = 72;
							dataMissedHint = `Reported ${eventCountIn72Hour}, missed ${72 *
								4 -
								eventCountIn72Hour} times in last 72 hour`;
						}
					} else {
						dataMissedInHours = 48;
						dataMissedHint = `Reported ${eventCountIn48Hour}, missed ${48 *
							4 -
							eventCountIn48Hour} times in last 48 hour`;
					}
				} else {
					dataMissedInHours = 24;
					dataMissedHint = `Reported ${eventCountIn24Hour}, missed ${24 *
						4 -
						eventCountIn24Hour} times in last 48 hour`;
				}
			} else {
				dataMissedInHours = 1;
				dataMissedHint = `Reported ${eventCount} times in last hour`;
			}

			let healthValue = 0;
			let healthHint = '';
			let battery =
				result.last_event &&
				result.last_event.event &&
				result.last_event.event.Battery
					? result.last_event.event.Battery
					: 0;

			let hdop =
				result.last_event &&
				result.last_event.event &&
				result.last_event.event.HDOP
					? result.last_event.event.HDOP
					: result.HDOP;

			if (
				isBefore(result.created_at, subHours(new Date(), 1)) &&
				eventCount <= 0
			) {
				healthValue = 2;
				healthHint = `Device reported ${eventCount} times in last one hour`;
			} else if (battery <= 10) {
				healthValue = 2;
				healthHint = 'Battery level <= 10%';
			} else if (hdop >= 10) {
				healthValue = 2;
				healthHint = 'No GPS Fix';
			}

			/*else if (
                    isBefore(result.created_at, subMinutes(new Date(), 1)) &&
                    eventCount < 4
                ) {
                    healthValue = 2;
                    healthHint = `Device reported ${eventCount} times in last one hour`;
                } */

			if (healthValue === 0) {
				if (
					isBefore(result.created_at, subMinutes(new Date(), 1)) &&
					eventCount > 0
				) {
					healthValue = 0;
					healthHint = `Device reported ${eventCount} times in last one hour`;
				} else if (battery <= 20) {
					healthValue = 1;
					healthHint = 'Battery level <= 20%';
				}
				if (hdop >= 5) {
					healthValue = 1;
					healthHint = 'Device HDOP >= 5';
				}
			}

			let _updateObj = {
				health: healthValue,
				healthHint: healthHint,
				dataMissedInHours: dataMissedInHours,
				dataMissedHint: dataMissedHint,
			};
			if (type === 'Canary-S' && result.type !== type) {
				_updateObj['type'] = type;
			}
			await Device.update(_updateObj, {
				where: { id: id },
			});
			return { success: true };
		} else {
			return Promise.reject({
				status: 400,
				message: 'Record not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.syncDistanceAndBearingData = async function(id, sessionUser) {
	try {
		let foundData = await Device.findByPk(id, {
			include: [
				{
					model: Site,
					as: 'site',
					include: [
						{
							model: Map,
							as: 'site_map',
						},
					],
				},
			],
		});
		if (foundData) {
			let result = foundData.toJSON();
			const {
				bearing,
				distance,
				compassDirection,
			} = module.exports.measureDistanceAndBearing(result);

			// console.log('result', result);

			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});
			let positionLookupId = undefined;
			try {
				if (compassDirection && compassDirection.symbol) {
					let [deviceDomain] = await DomainLookup.findOrCreate({
						where: { name: 'POSITION' },
						defaults: { name: 'POSITION' },
						raw: true,
						transaction: transaction,
					});

					let [lookupData] = await Lookup.findOrCreate({
						where: {
							name: compassDirection.symbol,
							domainID: deviceDomain.id,
						},
						defaults: {
							name: compassDirection.symbol,
							description: compassDirection.name,
							domainID: deviceDomain.id,
						},
						attributes: ['id'],
						raw: true,
						transaction: transaction,
					});

					//console.log('lookupData', lookupData);
					if (lookupData && lookupData.id) {
						positionLookupId = lookupData.id;
					}
				}

				console.log('bearing', bearing);
				console.log('distance', distance);
				console.log('compassDirection', compassDirection);
				console.log('positionLookupId', positionLookupId);

				let updatedData = await Device.update(
					{
						bearing: bearing,
						distance: distance,
						position: positionLookupId,
					},
					{
						where: {
							id: foundData.id,
						},
						omitNull: false,
						transaction: transaction,
						returing: true,
					},
				);
				console.log('updatedData at Bearing and distance', updatedData);
				await transaction.commit();
			} catch (ex) {
				await transaction.rollback();
				throw ex;
			}
			await redisService.delete('global_menu_data');
			return { success: true };
		} else {
			return Promise.reject({
				status: 400,
				message: 'Record not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.measureDistanceAndBearing = function(result) {
	let bearing = null;
	let distance = null;
	let compassDirection = null;

	if (result) {
		const Latitude = result.lat;
		const Longitude = result.lng;
		if (result.site && result.site.site_map) {
			const { lat, lng } = result.site.site_map;
			if (Latitude && Longitude && lat && lng) {
				const destPosition = {
					lat: Latitude,
					lng: Longitude,
				};
				const sourcePosition = { lat: lat, lng: lng };
				bearing = locationCalculationHelper.calculateBearing(
					sourcePosition,
					destPosition,
				);
				distance = locationCalculationHelper.measureDistance(
					sourcePosition,
					destPosition,
				);
				compassDirection = windrose.getPoint(bearing, { depth: 2 });
			}
		}
	}

	return {
		bearing,
		distance,
		compassDirection,
	};
};

/***
 * Delete  Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.delete = async function(id, sessionUser) {
	try {
		let foundData = await Device.findByPk(id);
		if (foundData) {
			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});

			try {
				let activityPromises = [];
				await activityService.handleActivityTracking(
					'SITE_CHANGE',
					'DEVICE',
					{
						device_id: foundData.id,
						notes: `Device removed from the site`,
					},
					{ sessionUser: sessionUser, transaction: transaction },
				);

				if (foundData.site_ID) {
					await activityService.handleActivityTracking(
						'DEVICE_REMOVED',
						'SITE',
						{
							id: foundData.get('site_ID'),
							site_ID: foundData.site_ID,
							notes: `Device ${
								foundData.id
							} removed from the site`,
						},
						{ sessionUser: sessionUser, transaction: transaction },
					);
				}

				let defaultSite = await siteService.findAdminDefaultSite({});
				if (defaultSite) {
					foundData.set('site_ID', defaultSite.id);
				} else {
					await transaction.rollback();
					return Promise.reject({
						status: 400,
						message: 'Default Site not found',
					});
				}
				//  foundData.set('active', false);
				foundData.set('bearing', null);
				foundData.set('distance', null);
				foundData.set('position', null);
				await foundData.save({
					transaction: transaction,
					omitNull: false,
				});
				await transaction.commit();
				await redisService.delete('global_menu_data');
				return { success: true };
			} catch (ex) {
				await transaction.rollback();
				throw ex;
			}
		} else {
			return Promise.reject({
				status: 400,
				message: 'Record not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.deviceExists = async function(coreid) {
	try {
		let count = await Device.count({ where: { id: coreid } });
		return count > 0;
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.findUnassignedDeviceCount = async function(coreid) {
	try {
		let count = await Device.count({ where: { site_ID: null } });
		return { data: count };
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.syncDeviceFromEvent = async function(coreid) {
	let isBearingSyncRequired = false;
	let count = await Device.count({ where: { id: coreid } });
	if (count === 0) {
		let result = await eventService.findLastEventByCoreId(coreid);
		if (result && result.data && result.data.event) {
			let eventData = result.data.event;
			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});

			try {
				let newDevice = {
					id: eventData.coreid,
					customer_ID: eventData.product_userid,
					active: true,
					imei: undefined,
					bearing: undefined,
					distance: undefined,
					boardRev: undefined,
					site_ID: undefined,
					position: null,
					last_reported_time: new Date(),
				};

				let defaultSite = await siteService.findAdminDefaultSite({
					transaction: transaction,
				});
				if (defaultSite) {
					newDevice.site_ID = defaultSite.id;
				}

				let insertedData = await Device.create(newDevice, {
					transaction: transaction,
				});

				let lookupData = await Lookup.findOne({
					where: { name: 'ADD_DEVICE' },
					raw: true,
					transaction: transaction,
				});

				if (!lookupData) {
					let [deviceDomain] = await DomainLookup.findOrCreate({
						where: { name: 'DEVICE' },
						defaults: { name: 'DEVICE' },
						raw: true,
						transaction: transaction,
					});

					lookupData = await Lookup.create(
						{
							name: 'ADD_DEVICE',
							domainID: deviceDomain.id,
						},
						{
							raw: true,
							transaction: transaction,
						},
					);
				}

				await Activity.create(
					{
						userID: 'SYSTEM',
						lookup_ID: lookupData.id,
						timestamp: new Date(),
						coreid: insertedData.id,
						notes: `Auto imported`,
					},
					{
						transaction: transaction,
					},
				);
				await transaction.commit();
				await redisService.delete('global_menu_data');
				return {
					success: true,
					data: insertedData.toJSON(),
				};
			} catch (ex) {
				await transaction.rollback();
				throw ex;
			}
		} else {
			return Promise.reject({
				status: 400,
				message: `No latest data found for coreid  ${coreid}`,
			});
		}
	} else {
		let foundDevice = await Device.findByPk(coreid, {
			include: [
				{
					model: LatestEvent,
					as: 'last_event',
					required: false,
					attributes: ['id'],
					include: [
						{
							model: Event,
							as: 'event',
							required: false,
						},
					],
				},
			],
		});
		if (foundDevice) {
			let result = foundDevice.toJSON();
			let hdop =
				result.last_event &&
				result.last_event.event &&
				result.last_event.event.HDOP
					? result.last_event.event.HDOP
					: result.HDOP;

			let Latitude =
				result.last_event &&
				result.last_event.event &&
				result.last_event.event.Latitude
					? round(parseFloat(result.last_event.event.Latitude), 5)
					: result.Latitude;

			let Longitude =
				result.last_event &&
				result.last_event.event &&
				result.last_event.event.Longitude
					? round(parseFloat(result.last_event.event.Longitude), 5)
					: result.Longitude;
			let deviceMapChangedAttributes;

			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});
			try {
				if (foundDevice.get('isLocationLocked') === false) {
					if (
						!isNil(Latitude) &&
						Latitude !== 0 &&
						!isNil(Longitude) &&
						Longitude !== 0 &&
						hdop !== 100
					) {
						console.log(
							"Latitude && Longitude && hdop, foundDevice.get'HDOP'",
							Latitude,
							Longitude,
							hdop,
							foundDevice.get('HDOP'),
						);
					}
					if (
						!isNil(Latitude) &&
						Latitude !== 0 &&
						!isNil(Longitude) &&
						Longitude !== 0 &&
						hdop !== 100
					) {
						if (Latitude !== foundDevice.get('lat')) {
							foundDevice.set('lat', Latitude);
							isBearingSyncRequired = true;
						}

						if (Longitude !== foundDevice.get('lng')) {
							foundDevice.set('lng', Longitude);
							isBearingSyncRequired = true;
						}
						if (isBearingSyncRequired) {
							await Device.update(
								{
									lat: foundDevice.get('lat'),
									lng: foundDevice.get('lng'),
								},
								{
									where: { id: foundDevice.id },
									transaction: transaction,
								},
							);
							deviceMapChangedAttributes = activityHelper.getChangedState(
								foundDevice,
								{
									// nested: true,
									propertyName: 'lat, lng',
									allowedProperties: ['lat', 'lng'],
								},
							);
						}
					}
				}
				await transaction.commit();
				if (foundDevice) {
					if (deviceMapChangedAttributes) {
						await activityService.handleActivityTracking(
							'DEVICE_LOCATION_CHANGED',
							'DEVICE',
							{
								device_id: foundDevice.id,
								notes: 'DEVICE location added',
								changes: deviceMapChangedAttributes,
							},
							{
								sessionUser: 'SYSTEM',
							},
						);
						if (isBearingSyncRequired && foundDevice.site_ID) {
							await QueueManager.addDeviceBearingAndDistanceSyncTask(
								{
									id: foundDevice.id,
								},
							);
						}
					}
				}
				return {
					success: true,
				};
			} catch (ex) {
				console.log(ex);
				await transaction.rollback();
				//throw ex;
				return Promise.reject(ex);
			}
		} else {
			return Promise.reject({
				status: 400,
				message: `No latest data found for coreid  ${coreid}`,
			});
		}
	}
};

module.exports.refreshDeviceViewAll = function() {
	return sequelize.queryInterface.sequelize
		.query(
			`SELECT * from events.update_rollup_events_hourly();`,
			{
				logging: console.log,
			},
			//`REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view_hourly WITH DATA;`,
		)
		.then(() => {
			return sequelize.queryInterface.sequelize.query(
				`SELECT * from events.update_rollup_events_daily()`,
				{
					logging: console.log,
				},
				//`REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view_daily WITH DATA;`,
			);
		});
};

module.exports.refreshDeviceViewMonthly = function() {
	return sequelize.queryInterface.sequelize
		.query(
			`SELECT * from events.update_rollup_events_weekly()`,
			{
				logging: console.log,
			},
			//`REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view_weekly WITH DATA;`,
		)
		.then(() => {
			return sequelize.queryInterface.sequelize.query(
				`SELECT * from events.update_rollup_events_monthly()`,
				{
					logging: console.log,
				},
				//`REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view_monthly WITH DATA;`,
			);
		})
		.then(() => {
			return sequelize.queryInterface.sequelize.query(
				`SELECT * from events.update_rollup_events_quarterly()`,
				{
					//logging: console.log,
				},
				// `REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view_quarterly WITH DATA;`,
			);
		});
};

module.exports.listAvailableDeviceTypes = async function(query, sessionUser) {
	try {
		let { id, containerType } = query;

		let whereClauseStr = ` where `;

		switch (containerType) {
			case 'companies':
			case 'company':
				whereClauseStr += ` c."parentID" = ${id}`;
				break;
			case 'divisions':
			case 'division':
				whereClauseStr += `  c.id = ${id}`;
				break;
			case 'site':
			case 'sites':
				whereClauseStr += `  s.id = ${id}`;
				break;
		}

		let sqlQuery = `select distinct type, s.name, c.name, c."parentID" 
					from events.devices d 
					join events.sites s on s.id = d."site_ID"
					join events.collections c on c.id = s."collection_ID"
					${whereClauseStr}`;
		const results = await sequelize.queryInterface.sequelize.query(
			sqlQuery,
			{ type: sequelize.QueryTypes.SELECT },
		);
		return {
			data: results,
		};
	} catch (err) {
		console.log(err);
		return Promise.reject(err);
	}
};

module.exports.refreshDeviceView = function() {
	return sequelize.queryInterface.sequelize.query(
		`SELECT * from events.update_rollup_events();`,
		{
			//logging: console.log,
		},
	);
};

function buildSingleDataRow(row) {
	if (row) {
		let _item = row.toJSON();
		_item.last_event = _item.last_event ? _item.last_event.event : {};
		return _item;
	} else {
		return row;
	}
}
