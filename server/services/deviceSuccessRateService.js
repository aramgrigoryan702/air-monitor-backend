const _ = require('lodash');
const pgPoolService = require('../services/common/pgPoolService');
const moment = require('moment');
const { round } = require('../helpers/numberHelper');
const config = require('../config');
const userTypes = require('../types/UserTypes');
const modelInstance = require('../models/index');
const redisService = require('../services/common/redisService');

const {
	Device,
	Activity,
	Lookup,
	Site,
	Collection,
	Sequelize,
	sequelize,
	DeviceSuccessRate,
} = modelInstance;

const { Op } = Sequelize;

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
		let { startTime, endTime, company_id } = params;
		console.log('params', params);
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
		// let idParam = whereCondition ? whereCondition.id : null;

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
		let whereClauseStr = ``;
		let whereClause = {};
		if (startTime && endTime) {
			startTime = moment(new Date(startTime)).toDate();
			endTime = moment(new Date(endTime)).toDate();
			whereClause.TimeStamp = {
				[Op.between]: [startTime, endTime],
			};
			//  whereClauseStr = `"TimeStamp" between date '${startTime.format()}'::timestamp with time zone and '${endTime.format()}'::timestamp with time zone`;
		} else if (startTime) {
			startTime = moment(new Date(startTime)).utc();
			//whereClauseStr = `"TimeStamp" >=  date '${startTime.format()}'::timestamp with time zone`;
		}

		if (company_id) {
			whereClause.company_id = company_id;
		}
		// console.log('whereClause', whereClause);
		if (
			sessionUser.groupName === userTypes.VIEWER ||
			sessionUser.groupName === userTypes.EDITOR
		) {
			//  let companyId = sessionUser.companyId;
			return {
				data: [],
				paging: {
					offset,
					limit,
					count: 0,
				},
			};
			// whereClause['$site.operational_unit.parentID$'] = companyId;
		}
		let sort_column = params.sort_column;
		let sort_order = params.sort_order;
		let sortObj = undefined;
		if (sort_column && sort_order) {
			sortObj = [
				[
					modelInstance.Sequelize.col(sort_column),
					sort_order.toString().toUpperCase(),
				],
			];
		}

		let foundData = await DeviceSuccessRate.findAndCountAll({
			include: [],
			where: whereClause,
			order: sortObj,
			limit,
			offset,
			raw: true,
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

module.exports.getLatestDeviceSuccessRate = async function() {
	let sql = `SELECT sum(total_device_count) as "total_device_count", sum(active_device_count) as "active_device_count", "company_id", "TimeStamp" FROM events.device_success_rate where "TimeStamp" = date_trunc('hour'::text, now()) group by "company_id", "TimeStamp";`;
	let results = await sequelize.queryInterface.sequelize.query(sql, {
		type: sequelize.QueryTypes.SELECT,
	});
	return results;
};

module.exports.getDeviceSuccessRateOf24HourAgo = async function() {
	let startTime = new Date();
	startTime.setSeconds(0);
	startTime.setMilliseconds(0);
	startTime.setMinutes(0);
	let comTime = moment(new Date(startTime)).subtract(24, 'hours');

	let sql = `SELECT sum(total_device_count) as "total_device_count", sum(active_device_count) as "active_device_count", "company_id", "TimeStamp" FROM events.device_success_rate where  "TimeStamp" =  date '${comTime.format()}'::timestamptz group by "company_id", "TimeStamp";`;
	let results = await sequelize.queryInterface.sequelize.query(sql, {
		type: sequelize.QueryTypes.SELECT,
	});
	return results;
};

module.exports.calculateSuccessRate = async function calculateSuccessRate() {
	let startTime = new Date();
	startTime.setSeconds(0);
	startTime.setMilliseconds(0);
	startTime.setMinutes(0);
	console.log('startTime', startTime);
	let comTime = moment(new Date(startTime))
		.subtract(1.5, 'hours')
		.toDate();
	// comTime = moment(new Date(comTime)).utc();
	//console.log('comTime', comTime);
	// comTime =  moment(new Date(comTime)).utc();
	// console.log('comTime', comTime.format());
	// return true;
	let collectionData = await Collection.findAll({
		where: {
			parentID: null,
			isActive: true,
		},
		logging: true,
		attributes: ['id', 'name'],
		include: [
			{
				model: Collection,
				as: 'children',
				attributes: ['id', 'name'],
				include: [
					{
						model: Site,
						as: 'sites',
						attributes: ['id', 'name'],
						include: [
							{
								model: Device,
								as: 'devices',
								required: true,
								attributes: ['id', 'last_reported_time'],
								//separate: true,
							},
							{
								model: Device,
								as: 'active_devices',
								required: false,
								attributes: ['id', 'last_reported_time'],
								//separate: true,
								where: {
									last_reported_time: {
										[Op.gte]: comTime,
									},
								},
							},
						],
					},
				],
			},
		],
	});
	let _collectiondata = collectionData.map(item => {
		let __item = item.toJSON();
		__item.total_device_count = 0;
		__item.active_device_count = 0;
		__item.device_success_rate = 0;
		__item.children = __item.children.map(child => {
			child.total_device_count = 0;
			child.active_device_count = 0;
			child.device_success_rate = 0;
			child.sites = child.sites.map(site => {
				site.total_device_count = 0;
				site.active_device_count = 0;
				site.device_success_rate = 0;
				if (site.devices) {
					site.total_device_count = site.devices.length;
					child.total_device_count += site.total_device_count;
				}
				if (site.active_devices) {
					site.active_device_count = site.active_devices.length;
					child.active_device_count += site.active_device_count;
				}
				if (site.total_device_count > 0) {
					site.device_success_rate = round(
						(site.active_device_count / site.total_device_count) *
							100,
						1,
					);
				}
				//console.log(site);
				return site;
			});
			__item.total_device_count += child.total_device_count;
			__item.active_device_count += child.active_device_count;
			if (child.total_device_count > 0) {
				child.device_success_rate = round(
					(child.active_device_count / child.total_device_count) *
						100,
					1,
				);
			}
			return child;
		});
		if (__item.total_device_count > 0) {
			__item.device_success_rate = round(
				(__item.active_device_count / __item.total_device_count) * 100,
				1,
			);
		}
		return __item;
	});
	let dataToInsert = [];
	_collectiondata.forEach(function(item) {
		item.children &&
			item.children.forEach(function(child) {
				child.sites &&
					child.sites.forEach(function(site) {
						if (site && site.total_device_count > 0) {
							dataToInsert.push({
								company_id: item.id,
								operational_unit_id: child.id,
								site_id: site.id,
								total_device_count: site.total_device_count,
								active_device_count: site.active_device_count,
								device_success_rate: site.device_success_rate,
								TimeStamp: startTime,
							});
						}
					});
			});
	});
	let _promises = [];
	dataToInsert.forEach(function(dataItem) {
		_promises.push(
			DeviceSuccessRate.create(dataItem).catch(err => {
				console.log(err);
				return Promise.reject(true);
			}),
		);
	});
	let results = await Promise.all(_promises);
	dataToInsert = [];
	_collectiondata = [];
	if (results) {
		results = results.map(item => item && item.toJSON());
		try {
			await redisService.set('latest_device_success_rate', {
				data: results,
			});
		} catch (ex) {
			console.log(ex);
		}
	}
	return true;
};
