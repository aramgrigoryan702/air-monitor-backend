const { AlertConfig } = require('../models/index');
const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const activityHelper = require('../helpers/activityHelper');
const activityService = require('../services/activityService');

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
		let companyId = params.companyId;
		if (!companyId) {
			return Promise.reject({
				status: 400,
				message: 'Invalid search query. companyId required.',
			});
		}
		let whereCondition = params.whereCondition || {};
		/*if (typeof whereCondition === 'string') {
            try {
                whereCondition = JSON.parse(whereCondition);
            } catch (err) {
                console.log(err);
                return Promise.reject({
                    status: 400,
                    message: 'Invalid search query',
                });
            }
        }*/
		//whereCondition.created_by = sessionUser.email;
		whereCondition.collection_id = companyId;
		let foundData = await AlertConfig.findAndCountAll({
			where: whereCondition,
			limit,
			offset,
			raw: true,
			order: [],
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

module.exports.queryByCompanyId = async function(companyId, sessionUser) {
	try {
		let whereCondition = {
			collection_id: companyId,
		};

		let foundData = await AlertConfig.findAll({
			where: whereCondition,
			raw: true,
			order: [],
		});

		return foundData;
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
			created_by: sessionUser.email,
			created_at: new Date(),
		};
		let insertedData = await AlertConfig.create(toBeInsertedData);
		await activityService.handleActivityTracking(
			`ALERT_CONFIG_CREATE`,
			'COMPANY',
			{
				id: insertedData.get('collection_id'),
				notes: `ALERT_CONFIG created`,
			},
			{ sessionUser: sessionUser },
		);
		return { data: insertedData.toJSON() };
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
module.exports.update = async function(data, sessionUser) {
	try {
		let toBeUpdatedData = {
			...data,
			created_by: sessionUser.email,
			created_at: new Date(),
		};

		let foundData = await AlertConfig.findByPk(toBeUpdatedData.id, {});
		if (foundData) {
			let _editableFieldNames = ['email_addresses', 'conditions'];
			Object.keys(toBeUpdatedData).forEach(key => {
				if (_editableFieldNames.indexOf(key) > -1) {
					foundData.set(key, toBeUpdatedData[key]);
				}
			});
			const changedAttributes = foundData.changed();
			const changedState = activityHelper.getChangedState(foundData);
			let result = await foundData.save({});
			await activityService.handleActivityTracking(
				`ALERT_CONFIG_EDIT`,
				'COMPANY',
				{
					id: result.get('collection_id'),
					notes: `ALERT_CONFIG edited`,
					changes: changedState,
				},
				{ sessionUser: sessionUser },
			);
			return { data: result.toJSON() };
		} else {
			return Promise.reject({
				status: 400,
				message: 'Alert config not found',
			});
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

/***
 * Delete  Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.delete = async function(id, sessionUser) {
	try {
		let whereClause = {
			id: id,
		};

		/*if (sessionUser && sessionUser.groupName === userTypes.VIEWER) {
            return Promise.reject({
                status: 400,
                message: 'Permission denied',
            });
        }

        if (sessionUser && sessionUser.groupName !== userTypes.ADMIN) {
            let companyId = sessionUser.companyId;
            if (!companyId) {
                return Promise.reject({
                    status: 400,
                    message: 'Permission denied',
                });
            }
            whereClause['$operational_unit.parentID$'] = companyId;
        }
        console.log('whereClause', whereClause);*/
		let foundData = await AlertConfig.findOne({
			where: whereClause,
		});
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
		if (ex && ex.name && ex.name === 'SequelizeForeignKeyConstraintError') {
			console.log('Found SequelizeForeignKeyConstraintError error ');
			return Promise.reject({
				status: 400,
				message:
					'Unable to remove the record as it has referenced devices.',
			});
		} else {
			console.log(ex);
		}
		return Promise.reject(ex);
	}
};
