const modelInstance = require('../models/index');
const { Site, Map, Device, Collection, Lookup, DomainLookup } = modelInstance;
const QueueManager = require('../task-queue/QueueManager');
const _ = require('lodash');
const config = require('../config');
const ErrorMessageTypes = require('../error-messages/ErrorMessageTypes');
const redisService = require('./common/redisService');
const activityHelper = require('../helpers/activityHelper');
const activityService = require('./activityService');
const permissionChecker = require('./common/permissionChecker');
const userTypes = require('../types/UserTypes');

const editableFieldNames = [
	'name',
	'collection_ID',
	'type_Class',
	'description',
];

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
		let companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		if (companyId) {
			whereCondition['$operational_unit.parentID$'] = companyId;
		}
		let foundData = await Site.findAndCountAll({
			include: [
				{ model: Map, as: 'site_map' },
				{
					attributes: ['parentID'],
					model: Collection,
					as: 'operational_unit',
					require: true,
				},
			],
			where: whereCondition,
			limit,
			offset,
		});

		let result = {
			data: foundData.rows.map(item => item.toJSON()),
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
		let companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		let whereClause = {
			id: id,
		};
		if (companyId) {
			whereClause['$operational_unit.parentID$'] = companyId;
		}
		let data = await Site.findOne({
			where: whereClause,
			include: [
				{ model: Map, as: 'site_map' },
				{
					model: Collection,
					as: 'operational_unit',
					require: true,
				},
			],
		});
		if (data) {
			return { data: data.toJSON() };
		} else {
			return Promise.reject({ ...ErrorMessageTypes.SITE_NOT_FOUND });
		}
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.findSitesByOperationalUnit = async function(
	params,
	sessionUser,
) {
	try {
		if (!params || !params.collection_ID) {
			return Promise.reject({
				status: 400,
				message: 'Missing parameter collection_ID',
			});
		}
		let limit = params.limit || config.system.pageSize,
			offset = params.offset || 0;
		let whereCondition = {
			collection_ID: params.collection_ID,
		};
		if (sessionUser && sessionUser.groupName !== userTypes.ADMIN) {
			let companyId = sessionUser.companyId;
			if (!companyId) {
				return { data: [] };
			}
			whereCondition['$operational_unit.parentID$'] = companyId;
		}

		let foundData = await Site.findAll({
			attributes: ['id', 'name'],
			include: [
				{
					model: Collection,
					as: 'operational_unit',
					require: true,
					attributes: [],
				},
			],
			where: whereCondition,
			order: [['name', 'asc']],
			raw: true,
			logging: true,
			limit,
			offset,
		});

		let result = {
			data: foundData,
		};
		return result;
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.findSitesByCompany = async function(params, sessionUser) {
	try {
		if (!params || !params.companyId) {
			return Promise.reject({
				status: 400,
				message: 'Missing parameter companyId',
			});
		}
		let limit = params.limit || config.system.pageSize,
			offset = params.offset || 0;
		let whereCondition = {
			'$operational_unit.parentID$': params.companyId,
		};
		let companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);

		if (companyId) {
			whereCondition['$operational_unit.parentID$'] = companyId;
		}

		let foundData = await Site.findAll({
			attributes: ['id', 'name'],
			include: [
				{
					model: Collection,
					as: 'operational_unit',
					attributes: [],
					require: true,
				},
			],
			where: whereCondition,
			raw: true,
			limit,
			offset,
		});

		let result = {
			data: foundData,
		};
		return result;
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
		};
		if (toBeInsertedData.name) {
			toBeInsertedData.name = toBeInsertedData.name.toString().trim();
		}
		if (toBeInsertedData.site_map && toBeInsertedData.site_map.name) {
			toBeInsertedData.site_map.name = toBeInsertedData.site_map.name
				.toString()
				.trim();
		}
		let result;
		if (!toBeInsertedData.collection_ID) {
			return Promise.reject({
				...ErrorMessageTypes.OPERATIONAL_UNIT_NOT_FOUND,
			});
		}
		let companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		if (companyId) {
			let company = await Collection.findOne({
				attributes: ['id'],
				where: {
					id: toBeInsertedData.collection_ID,
					parentID: companyId,
				},
				raw: true,
			});
			if (!company) {
				return Promise.reject({
					...ErrorMessageTypes.PERMISSION_DENIED,
				});
			}
		}
		let transaction = await modelInstance.sequelize.transaction({
			isolationLevel:
				modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
					.READ_COMMITTED,
		});
		try {
			let domainIdData = await DomainLookup.findOne({
				where: { name: 'SITE' },
				raw: true,
				transaction: transaction,
			});
			if (!domainIdData) {
				throw new Error(`domainLookupData for 'SITE'  not found`);
			}

			toBeInsertedData.lookup_ID = domainIdData.id;

			let insertedData = await Site.create(toBeInsertedData, {
				include: [{ model: Map, as: 'site_map', required: false }],
				transaction: transaction,
			});
			await activityService.handleActivityTracking(
				'SITE_CREATE',
				'SITE',
				{ id: insertedData.id, notes: 'Site created' },
				{ sessionUser: sessionUser, transaction: transaction },
			);
			result = insertedData.toJSON();
			await transaction.commit();
			await redisService.delete('global_menu_data');
		} catch (ex) {
			await transaction.rollback();
			throw ex;
		}
		return { data: result };
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
		let isLocationChanged = false;

		let savedData;
		let toBeUpdatedData = {
			...data,
		};

		let changedAttributes;
		let changedKeys;
		let siteMapCahngedAttributes;
		let whereClause = {
			id: toBeUpdatedData.id,
		};
		let companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		if (companyId) {
			whereClause['$operational_unit.parentID$'] = companyId;
		}

		let foundData = await Site.findOne({
			where: whereClause,
			include: [
				{ model: Map, as: 'site_map', required: false },
				{
					model: Collection,
					as: 'operational_unit',
					required: false,
				},
			],
			// transaction: transaction,
		});
		if (foundData) {
			let _editableFieldNames = [...editableFieldNames];
			if (foundData.get('isAdminDefault') === true) {
				_editableFieldNames = _editableFieldNames.filter(
					item => item !== 'name',
				);
			}
			Object.keys(toBeUpdatedData).forEach(key => {
				if (_editableFieldNames.indexOf(key) > -1) {
					foundData.set(key, toBeUpdatedData[key]);
				}
			});

			if (foundData.changed()) {
				changedKeys = foundData.changed();
				changedAttributes = activityHelper.getChangedState(foundData);
			}

			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});
			try {
				if (data.site_map) {
					if (foundData.site_map) {
						Object.keys(data.site_map).forEach(key => {
							foundData.site_map.set(key, data.site_map[key]);
						});
						if (foundData.site_map.changed()) {
							siteMapCahngedAttributes = activityHelper.getChangedState(
								foundData.site_map,
								{
									nested: true,
									propertyName: 'lat, lng',
									allowedProperties: ['lat', 'lng'],
								},
							);
						}
						isLocationChanged = true;

						await Map.update(
							{
								lat: foundData.site_map.get('lat'),
								lng: foundData.site_map.get('lng'),
							},
							{
								where: {
									id: foundData.site_map.get('id'),
								},
								transaction: transaction,
							},
						);

						if (siteMapCahngedAttributes) {
							await activityService.handleActivityTracking(
								'SITE_LOCATION_CHANGED',
								'SITE',
								{
									id: foundData.id,
									notes: 'Site location changed',
									changes: siteMapCahngedAttributes,
								},
								{
									sessionUser: sessionUser,
									transaction: transaction,
								},
							);
						}
					} else {
						let newMap = Map.build(data.site_map);

						siteMapCahngedAttributes = activityHelper.getChangedState(
							newMap,
						);

						let siteMapValue = await Map.build(data.site_map).save({
							transaction: transaction,
						});
						isLocationChanged = true;
						await foundData.setSite_map(siteMapValue, {
							transaction: transaction,
						});

						if (siteMapCahngedAttributes) {
							await activityService.handleActivityTracking(
								'SITE_LOCATION_ADDED',
								'SITE',
								{
									id: foundData.id,
									notes: 'Site location added',
									changes: {
										property: 'lat, lng',
										from: undefined,
										to: [newMap.lat, newMap.lng].join(', '),
									},
								},
								{
									sessionUser: sessionUser,
									transaction: transaction,
								},
							);
						}
					}
				}
				if (foundData.changed()) {
					await foundData.save({
						transaction: transaction,
						returning: false,
					});

					savedData = await Site.findByPk(foundData.id, {
						include: [
							{ model: Map, as: 'site_map', required: false },
							{
								model: Collection,
								as: 'operational_unit',
								required: false,
							},
						],
						transaction: transaction,
					});

					if (
						changedKeys &&
						changedKeys.indexOf('collection_ID') > -1
					) {
						changedAttributes = changedAttributes.filter(
							item => item.property !== 'collection_ID',
						);

						let newChanges = activityHelper.getChangedState(
							savedData.operational_unit,
							{
								nested: true,
								propertyName: 'operational_unit',
								allowedProperties: ['name'],
								oldModel: foundData.operational_unit,
							},
						);

						if (newChanges) {
							changedAttributes = [
								...changedAttributes,
								...newChanges,
							];
						}

						await activityService.handleActivityTracking(
							'SITE_MOVED',
							'SITE',
							{
								id: savedData.id,
								notes: 'Site MOVED',
								changes: changedAttributes,
							},
							{
								sessionUser: sessionUser,
								transaction: transaction,
							},
						);
					} else {
						await activityService.handleActivityTracking(
							'SITE_EDIT',
							'SITE',
							{
								id: savedData.id,
								notes: 'Site  EDITED',
								changes: changedAttributes,
							},
							{
								sessionUser: sessionUser,
								transaction: transaction,
							},
						);
					}
				}

				await transaction.commit();
			} catch (ex) {
				transaction.rollback();
				throw ex;
			}
			setImmediate(async () => {
				if (isLocationChanged) {
					let devices = await Device.findAll({
						attributes: ['id'],
						where: { site_ID: foundData.id },
						raw: true,
					});
					if (devices) {
						let _promises = [];
						devices.forEach(device => {
							_promises.push(
								QueueManager.addDeviceBearingAndDistanceSyncTask(
									device,
								),
							);
						});
						await Promise.all(_promises);
					}
				}
			});
			await redisService.delete('global_menu_data');
			let result = savedData ? savedData.toJSON() : foundData.toJSON();
			return { data: result };
		} else {
			return Promise.reject({ ...ErrorMessageTypes.SITE_NOT_FOUND });
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

		if (sessionUser && sessionUser.groupName === userTypes.VIEWER) {
			return Promise.reject({
				status: 400,
				message: 'Permission denied',
			});
		}

		if (sessionUser && sessionUser.groupName !== userTypes.ADMIN) {
			let companyId = sessionUser.companyId;
			if (!companyId) {
				return Promise.reject({
					...ErrorMessageTypes.PERMISSION_DENIED
				});
			}
			whereClause['$operational_unit.parentID$'] = companyId;
		}
		let foundData = await Site.findOne({
			where: whereClause,
			include: [
				{
					model: Collection,
					as: 'operational_unit',
					required: true,
				},
			],
		});
		if (foundData) {
			if (foundData.isAdminDefault) {
				return Promise.reject({
					status: 400,
					message: 'Unable to delete default site',
				});
			}
			await foundData.destroy();
			await redisService.delete('global_menu_data');
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
					'Unable to remove The site as it has referenced devices.',
			});
		} else {
			console.log(ex);
		}
		return Promise.reject(ex);
	}
};

module.exports.findAdminDefaultSite = async function(params) {
	try {
		let defaultSite = await Site.findOne({
			where: {
				isAdminDefault: true,
			},
			attributes: ['name', 'id'],
			raw: true,
			transaction:
				params && params.transaction ? params.transaction : undefined,
		});
		return defaultSite;
	} catch (ex) {
		return Promise.reject(ex);
	}
};
