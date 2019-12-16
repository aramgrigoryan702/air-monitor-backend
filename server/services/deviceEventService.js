const _ = require('lodash');
const config = require('../config');
const modelInstance = require('../models/index');
const { Event, Device, Site, Collection, Sequelize } = modelInstance;
const { Op } = Sequelize;
const moment = require('moment');
const pgPoolService = require('./common/pgPoolService');
const userTypes = require('../types/UserTypes');



const editableFieldNames = ['active', 'notes', 'position'];

const queryAttributes = [
	[Sequelize.literal(`date_trunc('min',"TimeStamp")`), 'TimeStamp'],
	'id',
	'tVOC1',
	'tVOC2',
	'tVOC1raw',
	'tVOC2raw',
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
	'R1',
	'R2',
	'B1',
	'B2',
	'Latitude',
	'Longitude',
	'U',
	'IT',
	'ET',
	'IH',
	'EH',
	'P',
	'TVOC_PID',
	'PM1_0',
	'PM2_5',
	'PM10',
	'CO',
	'CO2',
	'SO2',
	'O2',
	'O3',
	'NO2',
	'H2S',
	'CH4_S',
	'Sig',
];

function buildQuery() {
	return `select ${queryAttributes.join(',')} 
     from "events"."events" AS "Event" 
     "events"."devices" AS "device" ON "Event"."coreid" = "device"."id" LEFT OUTER JOIN 
     "events"."sites" AS "device->site" ON "device"."site_ID" = "device->site"."id"
      LEFT OUTER JOIN "events"."collections" AS "device->site->operational_unit" 
      ON "device->site"."collection_ID" = "device->site->operational_unit"."id"`;
}

function getDefaultAssociation() {
	return [
		{
			model: Device,
			as: 'device',
			attributes: ['site_ID', 'id'],
			include: [
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
			],
		},
		/* {
            model: Lookup,
            attributes: ['name'],
            as: 'firmwareLookup',
            required: false,
        },
        {
            model: Lookup,
            attributes: ['name'],
            as: 'boardRevLookup',
            required: false,
        },
        {
            model: Lookup,
            attributes: ['name'],
            as: 'positionLookup',
            required: false,
        },
        {
            model: Event,
            as: 'events',
            required: false,
        },*/
	];
}

module.exports.parseQuery = function(params, sessionUser) {
	let limit = params.limit || config.system.pageSize,
		offset = params.offset || 0;
	let startTime, endTime, filterValue;
	let idParam = params.id;

	if (params.whereCondition) {
		if (typeof params.whereCondition === 'string') {
			params.whereCondition = JSON.parse(params.whereCondition);
			///console.log('params.whereCondition', params.whereCondition);
			if (params.whereCondition) {
				if (params.whereCondition.startTime) {
					startTime = params.whereCondition.startTime;
				}

				if (params.whereCondition.endTime) {
					endTime = params.whereCondition.endTime;
				}

				if (params.whereCondition.filterValue) {
					filterValue = params.whereCondition.filterValue
						.toString()
						.toLowerCase()
						.trim();
				}
			}
		}
	}

	let whereClause = {
		coreid: idParam,
	};

	let whereClauseStr = ` "Event"."coreid" = '${idParam}'`;

	if (startTime && endTime) {
		startTime = moment(new Date(startTime)).utc();
		endTime = moment(new Date(endTime)).utc();
		whereClause['TimeStamp'] = {
			[Op.and]: [{ [Op.gte]: startTime }, { [Op.lte]: endTime }],
		};
		whereClauseStr += ` and "TimeStamp" between '${startTime.format()}'::timestamp with time zone and '${endTime.format()}'::timestamp with time zone`;
	} else if (startTime) {
		startTime = moment(new Date(startTime)).utc();
		whereClauseStr += `and "TimeStamp" >=  '${startTime.format()}'::timestamp with time zone`;
		whereClause['TimeStamp'] = {
			[Op.and]: [{ [Op.gte]: startTime }],
		};
	}

	if (filterValue) {
		let searchFields = [
			'tVOC1',
			'tVOC2',
			'tVOC1raw',
			'tVOC2raw',
			'eCO2',
			'Battery',
			'Humidity',
			'TempF',
			'ChargeDifferential',
			'CH4',
			'WindDirection',
			'WindSpeed',
			'Voltage',
			'ccsFirmware',
			'Pressure',
			'R1',
			'R2',
			'B1',
			'B2',
			'Latitude',
			'Longitude',
			'U',
			'IT',
			'ET',
			'IH',
			'EH',
			'P',
			'TVOC_PID',
			'PM1_0',
			'PM2_5',
			'PM10',
			'CO',
			'CO2',
			'SO2',
			'O2',
			'O3',
			'NO2',
			'H2S',
			'CH4_S',
			'Sig',
		];

		let orCondition = [];
		searchFields.forEach(item => {
			orCondition.push(
				Sequelize.literal(`text("${item}") ilike '%${filterValue}%' `),
			);
		});
		whereClause[Op.and] = {
			[Op.or]: orCondition,
		};

		if (orCondition.length > 0) {
			whereClauseStr += `and ( ${orCondition.join(' or ')} )`;
		}
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
		whereClause['$device.site.operational_unit.parentID$'] = companyId;
		whereClauseStr += ` AND ec."parentID" = ${companyId}`;
	}
	let sort_column = params.sort_column;
	let sort_order = params.sort_order;
	let sortObj = undefined;

	if (!sort_column) {
		sort_column = 'TimeStamp';
		sort_order = 'desc';
	}

	if (sort_column && sort_order) {
		if (sort_column.toLowerCase() === 'tempc') {
			sort_column = 'TempF';
		} else if (sort_column.toLowerCase() === 'windspeedms') {
			sort_column = 'WindSpeed';
		}
		sortObj = [
			[
				modelInstance.Sequelize.col(sort_column),
				sort_order.toString().toUpperCase(),
			],
		];
	}

	return {
		whereClause,
		whereClauseStr,
		sortObj,
		limit,
		offset,
	};
};

/***
 * Search and  get data  as paginated
 * @param params
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.queryStream = async function(params, sessionUser) {
	try {
		if (!params) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter',
			});
		}
		let idParam = params.id;
		if (!idParam) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter. id missing',
			});
		}

		const {
			whereClause,
			whereClauseStr,
			sortObj,
			limit,
			offset,
		} = module.exports.parseQuery(params, sessionUser);

		//console.log('whereClauseStr', whereClauseStr);

		let queryStr = `select date_trunc('min',"TimeStamp") AS "TimeStamp", "Event"."id", "Event"."tVOC1", "Event"."tVOC2", "Event"."tVOC1raw", "Event"."tVOC2raw", "Event"."Battery", "Event"."Humidity", "Event"."ChargeDifferential", "Event"."CH4", "Event"."TempF", "Event"."WindDirection", "Event"."WindSpeed", "Event"."eCO2", "Event"."Voltage", "Event"."ccsFirmware", "Event"."Pressure", "Event"."HDOP", "Event"."R1","Event"."R2", "Event"."B1", "Event"."B2", "Event"."Latitude", "Event"."Longitude", "Event"."U", "Event"."IT", "Event"."ET", "Event"."IH", "Event"."EH", "Event"."P", "Event"."TVOC_PID", "Event"."PM1_0", "Event"."PM2_5", "Event"."PM10", "Event"."CO", "Event"."CO2", "Event"."SO2", "Event"."O2", "Event"."O3", "Event"."NO2", "Event"."H2S", "Event"."CH4_S", "Event"."Sig", "device"."site_ID" AS "device.site_ID", "device"."id" AS "device.id", "device->site"."name" AS "device.site.name", "device->site"."id" AS "device.site.id", "device->site"."collection_ID" AS "device.site.collection_ID", "device->site->operational_unit"."name" AS "device.site.operational_unit.name", "device->site->operational_unit"."id" AS "device.site.operational_unit.id", "device->site->operational_unit"."parentID" AS "device.site.operational_unit.parentID" 
                    FROM "events"."events" AS "Event" LEFT OUTER JOIN "events"."devices" AS "device" ON "Event"."coreid" = "device"."id" LEFT OUTER JOIN "events"."sites" AS "device->site" ON "device"."site_ID" = "device->site"."id" LEFT OUTER JOIN "events"."collections" AS "device->site->operational_unit" ON "device->site"."collection_ID" = "device->site->operational_unit"."id"
                    where ${whereClauseStr} ORDER BY "TimeStamp";`;
		// console.log('queryStr', queryStr);
		let stream = await pgPoolService.queryStream(queryStr);
		stream.on('error', err => {
			console.log('err at device event', err);
		});
		stream.on('data', data => {
			//console.log('data', data);
		});
		stream.on('end', () => {
			console.log('Stream ended');
		});
		return stream;
	} catch (ex) {
		console.log(ex);
		return Promise.reject({ status: 400, message: ex.message });
	}
};

/***
 * Search and  get data  as paginated
 * @param params
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.query = async function(params, sessionUser) {
	try {
		if (!params) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter',
			});
		}
		let idParam = params.id;
		if (!idParam) {
			return Promise.reject({
				status: 400,
				message: 'Invalid parameter. id missing',
			});
		}

		const {
			whereClause,
			whereClauseStr,
			sortObj,
			limit,
			offset,
		} = module.exports.parseQuery(params, sessionUser);

		//console.log('whereClauseStr', whereClauseStr);
		let foundData = await Event.findAndCountAll({
			include: getDefaultAssociation(sortObj),
			attributes: queryAttributes,
			where: whereClause,
			order: sortObj,
			limit,
			offset,
			//logging: true,
			// raw: true,
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
