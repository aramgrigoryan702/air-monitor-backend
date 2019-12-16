const { Activity, Lookup, DomainLookup } = require('../models/index');
const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const { buildPaginatedData } = require('../helpers/paginationHelper');
const lookupService = require('./lookupService');

const editableFieldNames = ['type_CLASS', 'timestamp', 'notes', 'lookup_ID'];

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
		let whereCondition = params.whereCondition || undefined;
		let baseUrl = params.baseUrl;
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
		let foundData = await Activity.findAndCountAll({
			include: [
				{
					model: Lookup,
					attributes: ['name'],
					as: 'lookup',
					required: false,
				},
			],
			where: whereCondition,
			limit,
			offset,
			raw: true,
			order: [['timestamp', 'DESC']],
		});

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
		return Promise.reject(ex);
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
		let data = await Activity.findByPk(id, {
			include: [
				{
					model: Lookup,
					attributes: ['name'],
					as: 'lookup',
					required: false,
				},
			],
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

/***
 * Add  new Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.create = async function(data, sessionUser) {
	try {
		let toBeInsertedData = {
			...data,
			userID: sessionUser.email,
			timestamp: new Date(),
		};
		let insertedData = await Activity.create(toBeInsertedData);
		if (insertedData) {
			insertedData = await Activity.findByPk(insertedData.id, {
				include: [
					{
						model: Lookup,
						attributes: ['name'],
						as: 'lookup',
						required: false,
					},
				],
				raw: true,
			});
		}
		return { data: insertedData };
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

/***
 * Update  Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.update = async function(data, sessionUser) {
	try {
		let savedData;
		let toBeUpdatedData = {
			...data,
		};
		let foundData = await Activity.findByPk(toBeUpdatedData.id);
		if (foundData) {
			Object.keys(toBeUpdatedData).forEach(key => {
				if (editableFieldNames.indexOf(key) > -1) {
					foundData.set(key, toBeUpdatedData[key]);
				}
			});
			savedData = await foundData.save();
			let result = savedData.toJSON();
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

module.exports.handleActivityTracking = async function(
	activityName,
	domainName,
	{ id, device_id, notes, changes, timestamp, show },
	{ sessionUser, transaction },
) {
	const activityLookupData = await lookupService.findOrCreateByActivityName(
		activityName,
		{ domainName, sessionUser, transaction: transaction },
	);
	if (!activityLookupData) {
		throw new Error('activityLookupData not found');
	}

	let domainIdData = await DomainLookup.findOne({
		where: { name: domainName },
		raw: true,
		transaction: transaction,
	});
	if (!domainIdData) {
		throw new Error(`domainLookupData for ${domainName}  not found`);
	}
	let activity = await Activity.create(
		{
			userID:
				sessionUser && sessionUser.email
					? sessionUser.email
					: sessionUser,
			lookup_ID: activityLookupData.id,
			timestamp: timestamp || new Date(),
			reference_id: id || null,
			device_id: device_id || null,
			reference_type: domainIdData.id,
			notes: notes,
			changes: changes,
			show: show,
		},
		{ transaction: transaction },
	);
	//console.log('activity', activity.toJSON());
	return activity;
};
/***
 * Delete  Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.delete = async function(id, sessionUser) {
	try {
		let foundData = await Activity.findByPk(id);
		if (foundData) {
			await foundData.destroy();
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
