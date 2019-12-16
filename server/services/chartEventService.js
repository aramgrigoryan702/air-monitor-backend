const _ = require('lodash');
const pgPoolService = require('../services/common/pgPoolService');
const moment = require('moment');
const { differenceInCalendarDays } = require('date-fns');
const userTypes = require('../types/UserTypes');

const {
	sequelize,
	Event,
	Device,
	Site,
	Collection,
} = require('../models/index');

module.exports.query = async function(query = {}, sessionUser) {
	try {
		let { id, containerType, startTime, endTime, chartMode } = query;
		let viewName = 'events.rollup_events';
		if (!id || !containerType) {
			return Promise.reject({
				status: 400,
				message: 'Invalid  parameters',
			});
		}
		if (!startTime) {
			return Promise.reject({
				status: 400,
				message: 'Missing parameter startDate',
			});
		}
		if (!endTime) {
			endTime = moment(new Date()).utc();
		}
		let whereClauseStr = ``;
		let whereClause = {};
		if (startTime && endTime) {
			startTime = moment(new Date(startTime)).utc();
			endTime = moment(new Date(endTime)).utc();
			whereClauseStr = `"TimeStamp" between  '${startTime.format()}'::timestamp with time zone and '${endTime.format()}'::timestamp with time zone`;
		} else if (startTime) {
			startTime = moment(new Date(startTime)).utc();
			whereClauseStr = `"TimeStamp" >=  '${startTime.format()}'::timestamp with time zone`;
		}

		switch (chartMode) {
			case 'hourly':
				viewName = 'events.rollup_events_hourly';
				break;
			case 'daily':
				viewName = 'events.rollup_events_daily';
				break;
			case 'weekly':
				viewName = 'events.rollup_events_weekly';
				break;
			case 'monthly':
				viewName = 'events.rollup_events_monthly';
				break;
			case 'quarterly':
				viewName = 'events.rollup_events_quarterly';
				break;
			default:
				viewName = 'events.rollup_events';
				break;
		}

		switch (containerType) {
			case 'companies':
			case 'company':
				whereClause['$device.site.operational_unit.parentID$'] = id;
				whereClauseStr += ` AND ec."parentID" = ${id}`;
				break;
			case 'divisions':
			case 'division':
				whereClause['$device.site.collection_ID$'] = id;
				whereClauseStr += ` AND ec.id = ${id}`;
				break;
			case 'site':
			case 'sites':
				whereClause['$device.site_ID$'] = id;
				whereClauseStr += ` AND "siteID" = ${id}`;
				break;
			default:
				whereClause['$device.site_ID$'] = id;
				whereClauseStr += ` AND "siteID" = ${id}`;
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
				};
			}
			whereClauseStr += ` AND ec."parentID" = ${companyId}`;
		}
		// console.log('whereClauseStr', whereClauseStr);
		let whereSubQuery =
			whereClauseStr.length > 0 ? `where ${whereClauseStr}` : '';

		let results = await sequelize.queryInterface.sequelize.query(
			`select mview.* from ${viewName} mview JOIN events.sites ev ON mview."siteID" = ev.id 
                JOIN events.collections ec ON ev."collection_ID" = ec.id ${whereSubQuery} order by mview."TimeStamp" asc;`,
			{ type: sequelize.QueryTypes.SELECT },
		);
		//console.log('Total Length', results.length);
		return {
			data: results,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.getFirstEventDate = async function(query = {}, sessionUser) {
	try {
		let { id, containerType } = query;

		if (!id || !containerType) {
			return Promise.reject({
				status: 400,
				message: 'Invalid  parameters',
			});
		}
		let whereClauseStr = ``;
		let whereClause = {};

		switch (containerType) {
			case 'companies':
			case 'company':
				whereClause['$site.operational_unit.parentID$'] = id;
				whereClauseStr += ` ec."parentID" = ${id}`;
				break;
			case 'divisions':
			case 'division':
				whereClause['$site.collection_ID$'] = id;
				whereClauseStr += ` ec.id = ${id}`;
				break;
			case 'site':
			case 'sites':
				whereClause['$site_ID$'] = id;
				whereClauseStr += ` "siteID" = ${id}`;
				break;
			default:
				whereClause['$site_ID$'] = id;
				whereClauseStr += ` "siteID" = ${id}`;
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
			whereClause['$site.operational_unit.parentID$'] = companyId;
			whereClauseStr += ` AND ec."parentID" = ${companyId}`;
		}
		//console.log('whereClauseStr', whereClauseStr);
		let whereSubQuery =
			whereClauseStr.length > 0 ? `where ${whereClauseStr}` : '';

		let result = await sequelize.queryInterface.sequelize.query(
			`select mview."TimeStamp" from events.rollup_events mview JOIN events.sites ev ON mview."siteID" = ev.id 
                JOIN events.collections ec ON ev."collection_ID" = ec.id ${whereSubQuery} order by mview."TimeStamp" asc limit 1`,
			{ type: sequelize.QueryTypes.SELECT },
		);

		if (result && Array.isArray(result)) {
			let firstEvent = result[0];
			if (firstEvent && firstEvent.TimeStamp) {
				return {
					data: { TimeStamp: firstEvent.TimeStamp },
				};
			} else {
				return {
					data: undefined,
				};
			}
		} else {
			return {
				data: undefined,
			};
		}
		// console.log('Total Length', results.length);
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.getStream = async function(query = {}, sessionUser) {
	try {
		let { id, containerType, startTime, endTime, chartMode } = query;
		let viewName = 'events.event_mat_view';
		switch (chartMode) {
			case 'hourly':
				viewName = 'events.event_mat_view_hourly';
				break;
			case 'daily':
				viewName = 'events.event_mat_view_daily';
				break;
			default:
				viewName = 'events.event_mat_view';
				break;
		}

		/* switch (chartMode) {
            case 'one_hour':
                viewName = 'events.event_mat_view_hourly';
                break;
            case 'four_hour':
                viewName = 'events.event_mat_view_last_four_hour';
                break;
            case 'one_day':
                viewName = 'events.event_mat_view_last_day';
                break;
            case 'four_day':
                viewName = 'events.event_mat_view_last_four_day';
                break;
            case 'one_week':
                viewName = 'events.event_mat_view_week';
                break;
            case 'one_month':
                viewName = 'events.event_mat_view_month';
                break;
            case 'one_quarter':
                viewName = 'events.event_mat_view_quarter';
                break;
            default:
                viewName = 'events.event_mat_view_last_hour';
                break;
        }*/

		// console.log('chartMode, viewName', chartMode, viewName);

		if (!id || !containerType) {
			return Promise.reject({
				status: 400,
				message: 'Invalid  parameters',
			});
		}
		if (!startTime) {
			return Promise.reject({
				status: 400,
				message: 'Missing parameter startDate',
			});
		}
		let whereClauseStr = ``;
		let whereClause = {};
		if (!endTime) {
			endTime = moment(new Date()).utc();
		}
		if (startTime && endTime) {
			startTime = moment(new Date(startTime)).utc();
			endTime = moment(new Date(endTime)).utc();
			whereClauseStr = `"TimeStamp" between date '${startTime.format()}'::timestamp with time zone and '${endTime.format()}'::timestamp with time zone`;
		} else if (startTime) {
			startTime = moment(new Date(startTime)).utc();
			whereClauseStr = `"TimeStamp" >=  date '${startTime.format()}'::timestamp with time zone`;
		}

		switch (containerType) {
			case 'companies':
			case 'company':
				whereClause['$device.site.operational_unit.parentID$'] = id;
				whereClauseStr += ` AND ec."parentID" = ${id}`;
				break;
			case 'divisions':
			case 'division':
				whereClause['$device.site.collection_ID$'] = id;
				whereClauseStr += ` AND ec.id = ${id}`;
				break;
			case 'site':
			case 'sites':
				whereClause['$device.site_ID$'] = id;
				whereClauseStr += ` AND "siteID" = ${id}`;
				break;
			default:
				whereClause['$device.site_ID$'] = id;
				whereClauseStr += ` AND "siteID" = ${id}`;
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
			whereClauseStr += ` AND ec."parentID" = ${companyId}`;
		}
		// console.log('whereClauseStr', whereClauseStr);
		let whereSubQuery =
			whereClauseStr.length > 0 ? `where ${whereClauseStr}` : '';

		let stream = await pgPoolService.queryStream(
			`select mview.*, ev.name as "Site" from ${viewName} mview JOIN events.sites ev ON mview."siteID" = ev.id 
                JOIN events.collections ec ON ev."collection_ID" = ec.id ${whereSubQuery}`,
			{ type: sequelize.QueryTypes.SELECT },
		);

		// console.log('Total Length', results.length);
		return stream;
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.queryGroupChartData = async function(query = {}, sessionUser) {
	try {
		let { id, containerType, startTime, endTime, chartMode } = query;
		let viewName = 'events.rollup_events_group_chart';
		if (!id || !containerType) {
			return Promise.reject({
				status: 400,
				message: 'Invalid  parameters',
			});
		}
		if (!startTime) {
			return Promise.reject({
				status: 400,
				message: 'Missing parameter startDate',
			});
		}
		if (!endTime) {
			endTime = moment(new Date()).utc();
		}
		let whereClauseStr = ``;
		let whereClause = {};
		if (startTime && endTime) {
			startTime = moment(new Date(startTime)).utc();
			endTime = moment(new Date(endTime)).utc();
			whereClauseStr = `"TimeStamp" between date '${startTime.format()}'::timestamp with time zone and date '${endTime.format()}'::timestamp with time zone`;
		} else if (startTime) {
			startTime = moment(new Date(startTime)).utc();
			whereClauseStr = `"TimeStamp" >=  date '${startTime.format()}'::timestamp with time zone`;
		}

		let whereSubQuery =
			whereClauseStr.length > 0 ? `where ${whereClauseStr}` : '';

		/*let results = await sequelize.queryInterface.sequelize.query(
			`SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
                    round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
                    to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400)  AS "TimeStamp",
                    "site".id AS "siteID",
                    device.id AS "CoreId"
            FROM events.events "Event"
            JOIN events.sites "site" ON "Event"."site_ID" = site.id
            JOIN events.devices device ON "Event".coreid::text = device.id::text
                ${whereSubQuery}
            GROUP BY  "siteID", device.id, to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400) order by "TimeStamp" asc;`,
			{ type: sequelize.QueryTypes.SELECT, logging: true },
		);*/

		let results = await sequelize.queryInterface.sequelize.query(
			`select mview.* from ${viewName} mview
                ${whereSubQuery} order by mview."TimeStamp" asc;`,
			{ type: sequelize.QueryTypes.SELECT },
		);

		//rollup_events_four_hourly
		// console.log('Total Length', results.length);
		return {
			data: results,
		};
	} catch (ex) {
		return Promise.reject(ex);
	}
};

module.exports.queryStream = async function(query = {}, sessionUser) {
	try {
		let { id, containerType, startTime, endTime, chartMode } = query;
		let viewName = 'events.rollup_events';

		//console.log('chartMode, viewName', chartMode, viewName);

		if (!id || !containerType) {
			return Promise.reject({
				status: 400,
				message: 'Invalid  parameters',
			});
		}
		if (!startTime) {
			return Promise.reject({
				status: 400,
				message: 'Missing parameter startDate',
			});
		}
		if (!endTime) {
			endTime = moment(new Date()).utc();
		}
		let whereClauseStr = ``;
		let whereClause = {};
		if (startTime && endTime) {
			startTime = moment(new Date(startTime)).utc();
			endTime = moment(new Date(endTime)).utc();
			whereClauseStr = `"TimeStamp" between  '${startTime.format()}'::timestamp with time zone and '${endTime.format()}'::timestamp with time zone`;
		} else if (startTime) {
			startTime = moment(new Date(startTime)).utc();
			whereClauseStr = `"TimeStamp" >= '${startTime.format()}'::timestamp with time zone`;
		}

		switch (containerType) {
			case 'companies':
			case 'company':
				whereClause['$device.site.operational_unit.parentID$'] = id;
				whereClauseStr += ` AND ec."parentID" = ${id}`;
				break;
			case 'divisions':
			case 'division':
				whereClause['$device.site.collection_ID$'] = id;
				whereClauseStr += ` AND ec.id = ${id}`;
				break;
			case 'site':
			case 'sites':
				whereClause['$device.site_ID$'] = id;
				whereClauseStr += ` AND "siteID" = ${id}`;
				break;
			default:
				whereClause['$device.site_ID$'] = id;
				whereClauseStr += ` AND "siteID" = ${id}`;
				break;
		}

		if (
			sessionUser.groupName === userTypes.VIEWER ||
			sessionUser.groupName === userTypes.EDITOR
		) {
			let companyId = sessionUser.companyId;
			if (!companyId) {
				return [];
			}
			whereClauseStr += ` AND ec."parentID" = ${companyId}`;
		}
		// console.log('whereClauseStr', whereClauseStr);
		let whereSubQuery =
			whereClauseStr.length > 0 ? `where ${whereClauseStr}` : '';

		switch (chartMode) {
			case 'hourly':
				viewName = 'events.rollup_events_hourly';
				break;
			case 'daily':
				viewName = 'events.rollup_events_daily';
				break;
			default:
				viewName = 'events.rollup_events';
				break;
		}
		console.log('Going to initiate stream');
		let stream = await pgPoolService.queryStream(
			`select mview.*, ev.name as "Site" from ${viewName} mview JOIN events.sites ev ON mview."siteID" = ev.id 
                JOIN events.collections ec ON ev."collection_ID" = ec.id ${whereSubQuery} order by mview."TimeStamp" asc;`,
		);
		/* stream.on('data', data => {
            console.log('data', data);
        });*/
		stream.on('error', error => {
			console.log('error at chart event queryStream ', error);
		});
		stream.on('end', () => {
			console.log('Stream ended');
		});
		// console.log('Total Length', results.length);
		return stream;
	} catch (ex) {
		return Promise.reject(ex);
	}
};
