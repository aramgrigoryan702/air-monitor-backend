const _ = require('lodash');
const { isNil, isInteger, isNumber } = require('lodash');
const Uuid = require('uuid');
const validator = require('validator');
const QueueManager = require('../task-queue/QueueManager');
const moment = require('moment');
const { subHours, subMonths, subDays } = require('date-fns');
const config = require('../config');
const { round } = require('../helpers/numberHelper');
const userTypes = require('../types/UserTypes');
const logService = require('../services/common/loggerService');
const alertConfigService = require('../services/alertConfigService');
const alertNotificationService = require('../services/alertNotificationService');
const s3FileServer = require('../services/common/s3FileService');
const sqsService = require('./common/sqsService');
const {
	Event,
	LatestEvent,
	Device,
	Lookup,
	Site,
	Collection,
	Sequelize,
	FailedProcessLog,
} = require('../models/index');
const { Op } = Sequelize;

const fieldAliases = {
	//coreid: ['ICCID'],
	TimeStamp: ['TS', 'Time'],
	Battery: ['BAT'],
	Voltage: ['VDC'],
	Humidity: ['H'],
	Resistance: ['R', 'R1', 'tvoc1_Resistivity'],
	tvoc2_Resistivity: ['R2'],
	TempF: ['TF'],
	WindDirection: ['WD'],
	WindSpeed: ['WS'],
	ChargeDifferential: ['ChargeDiff', 'CD'],
	eCO2: ['CO2'],
	tVOC1: ['VOC1', 'tVOC', 'tVOC_CCS'],
	tVOC2: ['VOC2', 'tVOC_C3'],
	TVOC_PID: ['TVOC'],
	CH4: ['CH4', 'Methane'],
	Pressure: ['P'],
	Latitude: ['LAT', 'Lat'],
	Longitude: ['LON', 'LONG', 'Long'],
};

const fieldAliasKeys = Object.keys(fieldAliases);
const fieldAliasKeysLen = fieldAliasKeys.length;

module.exports.prepareEventModel = async function prepareEventModel(body) {
	let { data, userid, ...rest } = body;
	let isCanarySDevice = false;
	let modelData = {
		...data,
		...rest,
		product_userid: userid,
		received_at: new Date(),
	};

	if (!modelData.TS && modelData.Time) {
		isCanarySDevice = true;
		console.log('canartyS modelData', body);
	}

	for (let i = 0; i < fieldAliasKeysLen; i++) {
		let keyName = fieldAliasKeys[i];
		if (
			typeof modelData[keyName] === 'undefined' ||
			modelData[keyName] === null
		) {
			let _fieldAlias = fieldAliases[keyName];
			for (let j = 0; j < _fieldAlias.length; j++) {
				let _key = _fieldAlias[j];
				if (typeof modelData[_key] !== 'undefined') {
					modelData[keyName] = modelData[_key];
					break;
				}
			}
		}
	}
	if (isCanarySDevice) {
		if (!modelData.TVOC_PID && modelData.tVOC1) {
			modelData.TVOC_PID = modelData.tVOC1;
		}
		modelData.tVOC1 = null;
		if (!modelData.CH4_S && modelData.CH4) {
			modelData.CH4_S = modelData.CH4;
			modelData.CH4 = null;
		}
	}

	Object.keys(Event.fieldRawAttributesMap).forEach(keyName => {
		if (!isNil(modelData[keyName])) {
			switch (Event.fieldRawAttributesMap[keyName].type.toString()) {
				case 'INTEGER':
					if (!isInteger(modelData[keyName])) {
						modelData[keyName] = parseInt(
							modelData[keyName].toString(),
						);
						if (isNaN(modelData[keyName])) {
							modelData[keyName] = null;
						}
					}
					break;
				case 'BIGINT':
					if (!isInteger(modelData[keyName])) {
						modelData[keyName] = parseInt(
							modelData[keyName].toString(),
						);
						if (isNaN(modelData[keyName])) {
							modelData[keyName] = null;
						}
					}
					break;
				case 'SMALLINT':
					if (!isInteger(modelData[keyName])) {
						modelData[keyName] = parseInt(
							modelData[keyName].toString(),
						);
						if (isNaN(modelData[keyName])) {
							modelData[keyName] = null;
						}
					}
					break;
				case 'FLOAT':
					if (!isNumber(modelData[keyName])) {
						modelData[keyName] = parseFloat(
							modelData[keyName].toString(),
						);
						if (isNaN(modelData[keyName])) {
							modelData[keyName] = null;
						}
					}
					break;
			}
		}
	});
	//console.log('Event', Event);
	/*  if (modelData && modelData.coreid === '36003d001147373336373936') {
		console.log('Found the tracking device');
		console.log('Data Received as', body);
	}*/
	/***
	 * Temporary data fix
	 */
	let fw_version = modelData.fw_version;
	if (!modelData.tVOC1raw) {
		modelData.tVOC1raw = modelData.tVOC1;
	}
	if (!modelData.tVOC2raw) {
		modelData.tVOC2raw = modelData.tVOC2;
	}

	//if (fw_version < 89 || fw_version === 98 || fw_version === 100)
	if (fw_version) {
		if (
			modelData.tVOC1 &&
			modelData.tVOC1 > 1000 &&
			modelData.tVOC1 < 5000
		) {
			modelData.tVOC1 = round(modelData.tVOC1 / 32, 0);
		} else if (modelData.tVOC1 && modelData.tVOC1 > 5000) {
			modelData.tVOC1 = round(modelData.tVOC1 / 134, 0);
		}
		if (
			modelData.tVOC2 &&
			modelData.tVOC2 > 1000 &&
			modelData.tVOC2 < 5000
		) {
			modelData.tVOC2 = round(modelData.tVOC2 / 32, 0);
		} else if (modelData.tVOC2 && modelData.tVOC2 > 5000) {
			modelData.tVOC2 = round(modelData.tVOC2 / 134, 0);
		}
	}

	if (modelData.WindDirection) {
		modelData.WindDirection = Math.abs(
			parseFloat(modelData.WindDirection.toString()),
		);
	}

	if (modelData.tvoc2_Resistivity) {
		modelData.tvoc2_Resistivity = Math.abs(
			parseInt(modelData.tvoc2_Resistivity.toString()),
		);
	}
	modelData.id = undefined;
	//console.log('modeldata', modelData);
	let builtEvent = Event.build(modelData);
	if (builtEvent && builtEvent.get('WindSpeed')) {
		if (isCanarySDevice) {
			builtEvent.set('WindSpeed', builtEvent.get('WindSpeed') * 2.23694);
		}

		builtEvent.set('WindSpeed', round(builtEvent.get('WindSpeed'), 1));
	}

	if (builtEvent.get('Latitude')) {
		builtEvent.set('Latitude', round(builtEvent.get('Latitude'), 5));
	}

	if (builtEvent.get('Longitude')) {
		builtEvent.set('Longitude', round(builtEvent.get('Longitude'), 5));
	}

	if (builtEvent.get('Voltage')) {
		builtEvent.set('Voltage', round(builtEvent.get('Voltage'), 3));
	}

	if (builtEvent.get('ChargeDifferential')) {
		builtEvent.set(
			'ChargeDifferential',
			round(builtEvent.get('ChargeDifferential'), 3),
		);
	}

	if (modelData.coreid) {
		let foundDeviceData = await Device.findByPk(modelData.coreid, {
			attributes: ['site_ID', 'position', 'distance'],
			raw: true,
		});

		if (foundDeviceData) {
			builtEvent.set('position', foundDeviceData.position);
			builtEvent.set('distance', foundDeviceData.distance);
		}
		//console.log('foundDeviceData', foundDeviceData);
		if (foundDeviceData && foundDeviceData.site_ID) {
			builtEvent.set('site_ID', foundDeviceData.site_ID);
		}
	}
	return builtEvent;
};

module.exports.receive = async function(body, sessionUser) {
	let builtEvent;
	try {
		// console.log('event body received', body);
		if (!body || !body.data) {
			return new Error('Invalid data parameter');
		}
		try {
			await sqsService.sendEventPayload(body);
		} catch (ex) {
			console.log(ex);
			// if for  any  case queue is unavailable then make  it  directly
		}
		try {
			await QueueManager.addEventUploadToS3Task({
				...body,
				timestamp: new Date(),
			});
		} catch (ex) {
			console.log(ex);
			// if for  any  case queue is unavailable then make  it  directly
		}
		try {
			await QueueManager.checkEventWebhookTask({
				body: { ...body },
				coreid: body.coreid,
			});
		} catch (ex) {
			console.log(ex);
		}

		builtEvent = await module.exports.prepareEventModel(body);
		let createdEvent = await builtEvent.save();
		//console.log('createdEvent.toJSON()', createdEvent.toJSON());
		const { id, TimeStamp, coreid } = createdEvent.toJSON();
		const _latestEvent = {
			event_ID: id,
			coreid: coreid,
			TimeStamp,
		};
		try {
			await QueueManager.addUpdateLatestEventTask(_latestEvent);
		} catch (ex) {
			console.log(ex);
			// if for  any  case queue is unavailable then make  it  directly
			await module.exports.updateRecentEvent(_latestEvent);
		}
		return {
			success: true,
		};
	} catch (ex) {
		logService.logFatalError(ex);
		FailedProcessLog.build({
			event: 'EVENT_RECEIVE',
			body: JSON.stringify(body, 2),
			TimeStamp: new Date(),
		})
			.save()
			.catch(async err => {
				console.log(err);
			});
		return Promise.reject(ex);
	}
};

module.exports.query = async function(query = {}, sessionUser) {
	try {
		let { id, containerType, startTime, endTime } = query;
		if (!id || !containerType) {
			return Promise.reject({
				status: 400,
				message: 'Invalid  parameters',
			});
		}

		let whereClause = {};
		if (startTime && endTime) {
			startTime = new Date(startTime);
			endTime = new Date(endTime);
			whereClause['TimeStamp'] = {
				[Op.and]: [{ [Op.gte]: startTime }, { [Op.lte]: endTime }],
			};
		} else {
			whereClause['TimeStamp'] = { [Op.gte]: subDays(new Date(), 1) };
		}

		switch (containerType) {
			case 'companies':
			case 'company':
				whereClause['$device.site.operational_unit.parentID$'] = id;
				break;
			case 'divisions':
			case 'division':
				whereClause['$device.site.collection_ID$'] = id;
				break;
			default:
				whereClause['$device.site_ID$'] = id;
				break;
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
						count: 0,
					},
				};
			}
			whereClause['$device.site.operational_unit.parentID$'] = companyId;
		}
		let results = await Event.findAll({
			where: whereClause,
			attributes: [
				[
					Sequelize.literal(`date_trunc('min',"TimeStamp")`),
					'TimeStamp',
				],
				/* [Sequelize.literal('avg("tVOC")'), 'tVOC'],
                [Sequelize.literal('avg("Battery")'), 'Battery'],
                [Sequelize.literal('avg("HDOP")'), 'HDOP'],
                [Sequelize.literal('avg("Humidity")'), 'Humidity'],
                [Sequelize.literal('avg("Pressure")'), 'Pressure'],
                [Sequelize.literal('avg("Resistance")'), 'Resistance'],
                [Sequelize.literal('avg("TempF")'), 'TempF'],
                [Sequelize.literal('avg("WindDirection")'), 'WindDirection'],
                [Sequelize.literal('avg("WindDirection")'), 'WindSpeed'],*/
				'id',
				'tVOC1',
				'tVOC2',
				'Battery',
				'Humidity',
				'ChargeDifferential',
				'CH4',
				'TempF',
				'WindDirection',
				'WindSpeed',
				'eCO2',
				'Voltage',
				'ccsFirmware',
				'Pressure',
				'HDOP',
				'Resistance',
				'fw_version',
			],
			/* attributes: {
                exclude: [
                    'published_at',
                    'received_at',
                    'updated_at',
                    'version',
                    'event',
                    'created_at',
                    'ccsBaseline',
                    'ccsFirmware',
                    'Latitude',
                    'Longitude',
                    'ProductVersion',
                    'fw_version',
                    'product_userid',
                    'public',
                ],
            },*/
			include: [
				{
					model: Device,
					as: 'device',
					attributes: ['position'],
					include: [
						{
							model: Lookup,
							attributes: ['name'],
							as: 'positionLookup',
							required: false,
						},
						{
							model: Site,
							attributes: ['name', 'id', 'collection_ID'],
							as: 'site',
							required: true,
							include: [
								{
									model: Collection,
									attributes: ['name', 'id', 'parentID'],
									as: 'operational_unit',
									required: true,
								},
							],
						},
					],
				},
			],
			order: [['TimeStamp', 'ASC']],
			//logging: true,
			/* group: [
                'TimeStamp',
                Sequelize.col('device.id'),
                Sequelize.col('device.position'),
                Sequelize.col('device->positionLookup.id'),
            ],*/
		});
		if (results) {
			results = results.map(row => {
				let item = row.toJSON();
				if (
					item &&
					item.device &&
					item.device.positionLookup &&
					item.device.positionLookup.name
				) {
					item.positionName = item.device.positionLookup.name;
				}
				return item;
			});
		}
		return {
			data: results,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.updateRecentEvent = async function({
	event_ID,
	coreid,
	TimeStamp,
}) {
	try {
		if (event_ID && coreid && TimeStamp) {
			let TimeStampAsDate = new Date(TimeStamp);
			let [_latestEventData, isCreated] = await LatestEvent.findOrCreate({
				where: { coreid: coreid },
				defaults: {
					coreid: coreid,
					TimeStamp: TimeStamp,
					event_ID: event_ID,
				},
			});
			if (!isCreated && _latestEventData) {
				if (
					moment(TimeStampAsDate).isAfter(
						moment(new Date(_latestEventData.TimeStamp)),
					)
				) {
					await LatestEvent.update(
						{
							TimeStamp: TimeStamp,
							event_ID: event_ID,
						},
						{
							where: { id: _latestEventData.id },
						},
					);

					await Device.update(
						{
							last_reported_time: new Date(),
						},
						{
							where: {
								id: coreid,
							},
						},
					);
					await QueueManager.checkEventAlertTask({ coreid: coreid });
					//console.log('device last_reported_time', device);
					return {
						success: true,
					};
				} else {
					return {
						success: true,
					};
				}
			} else {
				return {
					success: true,
				};
			}
		} else {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameters ',
			});
		}
	} catch (err) {
		return Promise.reject(err);
	}
};

module.exports.findRecentEvents = async function(query, sessionUser) {
	try {
		let results = await LatestEvent.findAll({
			//raw: true
			include: [
				{
					model: Event,
					field: 'event_ID',
					as: 'event',
				},
			],
			//logging: console.log,
		});

		if (results) {
			results = results.map(row => row.toJSON());
		}

		return {
			data: results,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.findLastEventByCoreId = async function(coreId, sessionUser) {
	try {
		let result = await LatestEvent.findOne({
			where: { coreid: coreId },
			include: [
				{
					model: Event,
					field: 'event_ID',
					as: 'event',
					require: false,
				},
			],
			//logging: console.log,
		});

		if (result) {
			return {
				data: result.toJSON(),
			};
		} else {
			return Promise.reject({
				status: 400,
				message: `latest event not found for coreid ${coreId}`,
			});
		}
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.checkEventForAlert = async function(coreId, sessionUser) {
	try {
		let _promises = [];
		let result = await LatestEvent.findOne({
			where: { coreid: coreId },
			include: [
				{
					model: Event,
					field: 'event_ID',
					as: 'event',
					require: true,
					include: [
						{
							model: Site,
							as: 'site',
							attributes: ['name', 'id', 'collection_ID'],
							include: [
								{
									model: Collection,
									attributes: ['name', 'id', 'parentID'],
									as: 'operational_unit',
									required: true,
								},
							],
						},
					],
				},
			],
			//logging: console.log,
		});

		if (result) {
			let eventData = result.toJSON().event;
			let companyId;
			if (
				eventData.site &&
				eventData.site.operational_unit &&
				eventData.site.operational_unit.parentID
			) {
				companyId = eventData.site.operational_unit.parentID;
				let result = await alertConfigService.queryByCompanyId(
					companyId,
					sessionUser,
				);

				if (result && Array.isArray(result)) {
					let alertNotifications = [];
					result.map(item => {
						//  console.log(item);
						item.conditions.map(n => {
							//console.log(n.rawValue)
							let propertyVal = eventData[n.property];
							if (
								n.property === 'tVOC1' ||
								n.property === 'tVOC2'
							) {
								propertyVal = round(propertyVal / 1000, 3);
							}
							let compareVal = n.value;
							switch (n.op) {
								case 'GT':
									if (propertyVal > compareVal) {
										let output = {
											alert_config_id: item.id,
											timestamp: eventData.TimeStamp,
											collection_id: companyId,
											device_id: eventData.coreid,
											site_ID: eventData.site_ID,
											alert_values: [
												{
													property: n.property,
													propertyVal: propertyVal,
													compareVal: compareVal,
													op: '>',
												},
											],
										};
										alertNotifications.push(output);
									}
									break;
								case 'GTE':
									if (propertyVal >= compareVal) {
										let output = {
											alert_config_id: item.id,
											timestamp: eventData.TimeStamp,
											collection_id: companyId,
											device_id: eventData.coreid,
											site_ID: eventData.site_ID,
											alert_values: [
												{
													property: n.property,
													propertyVal: propertyVal,
													compareVal: compareVal,
													op: '>=',
												},
											],
										};
										alertNotifications.push(output);
									}
									break;
								case 'LT':
									if (propertyVal < compareVal) {
										let output = {
											alert_config_id: item.id,
											timestamp: eventData.TimeStamp,
											collection_id: companyId,
											device_id: eventData.coreid,
											site_ID: eventData.site_ID,
											alert_values: [
												{
													property: n.property,
													propertyVal: propertyVal,
													compareVal: compareVal,
													op: '<',
												},
											],
										};
										alertNotifications.push(output);
									}
									break;
								case 'LTE':
									if (propertyVal <= compareVal) {
										let output = {
											alert_config_id: item.id,
											timestamp: eventData.TimeStamp,
											collection_id: companyId,
											device_id: eventData.coreid,
											site_ID: eventData.site_ID,
											alert_values: [
												{
													property: n.property,
													propertyVal: propertyVal,
													compareVal: compareVal,
													op: '<=',
												},
											],
										};
										alertNotifications.push(output);
									}
									break;
								case 'EQ':
									if (propertyVal == compareVal) {
										let output = {
											alert_config_id: item.id,
											timestamp: eventData.TimeStamp,
											collection_id: companyId,
											device_id: eventData.coreid,
											site_ID: eventData.site_ID,
											alert_values: [
												{
													property: n.property,
													propertyVal: propertyVal,
													compareVal: compareVal,
													op: '<=',
												},
											],
										};
										alertNotifications.push(output);
									}
									break;
							}
						});
					});
					alertNotifications.forEach(async _notification => {
						_promises.push(
							alertNotificationService.create(_notification),
						);
					});
					await Promise.all(_promises);
					return {
						success: true,
					};
				} else {
					return {
						success: true,
					};
				}
			} else {
				return {
					success: true,
				};
			}
		} else {
			return {
				success: true,
			};
		}
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.checkEventForWebhook = async function(coreId, body) {
	try {
		let _promises = [];
		let result = await Device.findOne({
			where: { id: coreId },
			include: [
				{
					model: Site,
					as: 'site',
					attributes: ['name', 'id', 'collection_ID'],
					required: true,
					include: [
						{
							model: Collection,
							attributes: ['name', 'id', 'parentID'],
							as: 'operational_unit',
							required: true,
							include: [
								{
									model: Collection,
									attributes: ['name', 'id', 'webhook_url'],
									as: 'parent',
									required: true,
								},
							],
						},
					],
				},
			],
			//logging: console.log,
		});

		if (result) {
			let deviceData = result.toJSON();
			let webhook_url, company_id;
			if (
				(deviceData.site &&
					deviceData.site.operational_unit &&
					deviceData.site.operational_unit.parent,
				deviceData.site.operational_unit.parent.webhook_url)
			) {
				webhook_url =
					deviceData.site.operational_unit.parent.webhook_url;
				company_id = deviceData.site.operational_unit.parent.id;
				if (
					validator.isURL(webhook_url, {
						protocols: ['https', 'http'],
						require_protocol: true,
					})
				) {
					await QueueManager.addProcessEventWebhookTask({
						webhook_url: webhook_url,
						company_id: company_id,
						event: {
							...body,
						},
					});
					return {
						success: true,
					};
				}
			} else {
				return {
					success: true,
				};
			}
		} else {
			return {
				success: true,
			};
		}
	} catch (ex) {
		return Promise.reject(ex);
	}
};
