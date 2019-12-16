const modelInstance = require('../models/index');
const { Collection, Map, Lookup, DomainLookup, Sequelize } = modelInstance;
const { Op } = Sequelize;
const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const { buildPaginatedData } = require('../helpers/paginationHelper');
const redisService = require('./common/redisService');
const activityService = require('./activityService');
const activityHelper = require('../helpers/activityHelper');
const editableFieldNames = ['name', 'webhook_url', 'description', 'parentID'];
const userTypes = require('../types/UserTypes');
const validator = require('validator');
const { isNil } = require('lodash');
const permissionChecker = require('./common/permissionChecker');

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
			whereCondition[Op.and] = {
				[Op.or]: [
					{
						$parentID$: companyId,
					},
					{
						id: companyId,
					},
				],
			};
			//whereCondition['$parentID$'] = companyId;
		}
		let foundData = await Collection.findAndCountAll({
			where: whereCondition,
			include: [{ model: Map, as: 'collection_map', require: false }],
			limit,
			offset,
			//raw: true,
		});

		return {
			data: foundData.rows,
			paging: {
				offset,
				limit,
				count: foundData.count,
			},
		};
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
		let dt = await redisService.get('collection_cache:' + id);
		if (dt) {
			return {
				data: dt,
			};
		}
		let data = await Collection.findByPk(id, {
			include: [{ model: Map, as: 'collection_map', require: false }],
		});
		if (data) {
			await redisService.set('collection_cache:' + id, data.toJSON());
			return { data: data.toJSON() };
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
		};
		if (
			toBeInsertedData &&
			toBeInsertedData.webhook_url &&
			!validator.isURL(toBeInsertedData.webhook_url, {
				protocols: ['https', 'http'],
				require_protocol: true,
			})
		) {
			return Promise.reject({
				status: 400,
				message: 'webhook_url is not a valid url.',
			});
		}

		let result;
		let transaction = await modelInstance.sequelize.transaction({
			isolationLevel:
				modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
					.READ_COMMITTED,
		});
		try {
			let insertedData = await Collection.create(toBeInsertedData, {
				transaction: transaction,
			});

			if (insertedData) {
				insertedData = await Collection.findByPk(insertedData.id, {
					include: [
						{ model: Map, as: 'collection_map' },
						{
							model: Lookup,
							attributes: ['name'],
							as: 'lookup',
							required: false,
							include: [
								{
									model: DomainLookup,
									attributes: ['name'],
									as: 'domainLookups',
									required: false,
								},
							],
						},
					],
					transaction: transaction,
				});
			}
			insertedData = insertedData.toJSON();
			if (
				insertedData &&
				insertedData.lookup &&
				insertedData.lookup.domainLookups &&
				insertedData.lookup.domainLookups.name
			) {
				let domainName = insertedData.lookup.domainLookups.name;
				await activityService.handleActivityTracking(
					`${domainName}_CREATE`,
					domainName,
					{ id: insertedData.id, notes: `${domainName} created` },
					{ sessionUser: sessionUser, transaction: transaction },
				);
			}

			result = insertedData;
			await transaction.commit();
		} catch (ex) {
			await transaction.rollback();
			throw ex;
		}
		await redisService.delete('global_menu_data');
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
		let savedData;
		let toBeUpdatedData = {
			...data,
		};

		if (
			toBeUpdatedData &&
			toBeUpdatedData.webhook_url &&
			!validator.isURL(toBeUpdatedData.webhook_url, {
				protocols: ['https', 'http'],
				require_protocol: true,
			})
		) {
			return Promise.reject({
				status: 400,
				message: 'webhook_url is not a valid url.',
			});
		}
		let collectionMapChangedAttributes,
			isFirstMap = false;

		let companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		let foundData = await Collection.findByPk(toBeUpdatedData.id, {
			include: [{ model: Map, as: 'collection_map' }],
		});
		if (foundData) {
			if (companyId) {
				if (foundData.get('parentID')) {
					if (
						foundData.get('parentID').toString() !==
						companyId.toString()
					) {
						return Promise.reject({
							status: 400,
							message: 'Permission denied',
						});
					}
				} else {
					if (
						foundData.get('id').toString() !== companyId.toString()
					) {
						return Promise.reject({
							status: 400,
							message: 'Permission denied',
						});
					}
				}
			}
			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});
			try {
				let _editableFieldNames = [...editableFieldNames];
				if (foundData.get('isAdminDefault') === true) {
					_editableFieldNames = _editableFieldNames.filter(
						item => item !== 'name',
					);
				}

				Object.keys(toBeUpdatedData).forEach(key => {
					if (_editableFieldNames.indexOf(key) > -1) {
						// eslint-disable-next-line security/detect-object-injection
						foundData.set(key, toBeUpdatedData[key]);
					}
				});
				if (toBeUpdatedData.collection_map) {
					if (foundData.collection_map) {
						Object.keys(toBeUpdatedData.collection_map).forEach(
							key => {
								if (key !== 'id') {
									foundData.collection_map.set(
										key,
										toBeUpdatedData.collection_map[key],
									);
								}
							},
						);
						if (foundData.collection_map.changed()) {
							collectionMapChangedAttributes = activityHelper.getChangedState(
								foundData.collection_map,
								{
									nested: true,
									propertyName: 'lat, lng',
									allowedProperties: ['lat', 'lng'],
								},
							);
						}
						await Map.update(
							{
								lat: foundData.collection_map.get('lat'),
								lng: foundData.collection_map.get('lng'),
							},
							{
								where: {
									id: foundData.collection_map.get('id'),
								},
								transaction: transaction,
							},
						);
					} else {
						isFirstMap = true;

						let collMapValue = await Map.build(
							toBeUpdatedData.collection_map,
						).save({ transaction: transaction });

						await foundData.setCollection_map(collMapValue, {
							transaction: transaction,
						});

						collectionMapChangedAttributes = {
							property: 'lat, lng',
							from: undefined,
							to: [
								toBeUpdatedData.collection_map.lat,
								toBeUpdatedData.collection_map.lng,
							].join(', '),
						};
					}
				}
				const changedAttributes = foundData.changed();

				const changedState = activityHelper.getChangedState(foundData);

				savedData = await foundData.save({
					transaction: transaction,
					validate: true,
				});

				savedData = await Collection.findByPk(savedData.id, {
					include: [
						{
							model: Lookup,
							attributes: ['name'],
							as: 'lookup',
							required: false,
							include: [
								{
									model: DomainLookup,
									attributes: ['name'],
									as: 'domainLookups',
									required: false,
								},
							],
						},
					],
					transaction: transaction,
				});

				savedData = savedData.toJSON();

				if (
					savedData &&
					savedData.lookup &&
					savedData.lookup.domainLookups &&
					savedData.lookup.domainLookups.name
				) {
					let domainName = savedData.lookup.domainLookups.name;
					if (changedAttributes) {
						if (changedAttributes.indexOf('parentID') > -1) {
							await activityService.handleActivityTracking(
								`${domainName}_MOVED`,
								domainName,
								{
									id: savedData.id,
									notes: `${domainName} moved`,
									changes: changedState,
								},
								{
									sessionUser: sessionUser,
									transaction: transaction,
								},
							);
						} else {
							await activityService.handleActivityTracking(
								`${domainName}_EDIT`,
								domainName,
								{
									id: savedData.id,
									notes: `${domainName} edited`,
									changes: changedState,
								},
								{
									sessionUser: sessionUser,
									transaction: transaction,
								},
							);
						}
					}
					if (collectionMapChangedAttributes) {
						if (isFirstMap) {
							await activityService.handleActivityTracking(
								`${domainName}_Location_Added`,
								domainName,
								{
									id: savedData.id,
									notes: `Location added`,
									changes: collectionMapChangedAttributes,
								},
								{
									sessionUser: sessionUser,
									transaction: transaction,
								},
							);
						} else {
							await activityService.handleActivityTracking(
								`${domainName}_Location_Changed`,
								domainName,
								{
									id: savedData.id,
									notes: `Location changed`,
									changes: collectionMapChangedAttributes,
								},
								{
									sessionUser: sessionUser,
									transaction: transaction,
								},
							);
						}
					}
				}
				await transaction.commit();
				let result = savedData;
				await redisService.delete('global_menu_data');
				await redisService.delete('collection_cache:' + data.id);
				return { data: result };
			} catch (ex) {
				console.dir(ex);
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

module.exports.updateExceedBaseLine = async function(data, sessionUser) {
	try {
		if (!data) {
			return Promise.reject({ status: 400, message: 'bad value' });
		}
		let savedData;
		let toBeUpdatedData = {
			...data,
		};

		if (isNil(data.exceedBaseLine)) {
			return Promise.reject({
				status: 400,
				message: 'exceedBaseLine parameter is missing',
			});
		}
		if (!data.id) {
			return Promise.reject({
				status: 400,
				message: 'id parameter is missing',
			});
		}

		let domainName;

		let foundData = await Collection.findByPk(toBeUpdatedData.id, {
			include: [
				{
					model: Lookup,
					attributes: ['name'],
					as: 'lookup',
					required: false,
					include: [
						{
							model: DomainLookup,
							attributes: ['name'],
							as: 'domainLookups',
							required: false,
						},
					],
				},
			],
		});
		if (foundData) {
			let companyId = await permissionChecker.findCompanyIdOfSessionUser(
				sessionUser,
			);
			if (companyId) {
				if (foundData.get('parentID')) {
					if (
						foundData.get('parentID').toString() !==
						companyId.toString()
					) {
						return Promise.reject({
							status: 400,
							message: 'Permission denied',
						});
					}
				} else {
					if (
						foundData.get('id').toString() !== companyId.toString()
					) {
						return Promise.reject({
							status: 400,
							message: 'Permission denied',
						});
					}
				}
			}
			if (
				foundData.get('lookup') &&
				foundData.get('lookup').get('domainLookups') &&
				foundData.get('lookup').get('domainLookups').name
			) {
				domainName = foundData.get('lookup').get('domainLookups').name;
			}
			let transaction = await modelInstance.sequelize.transaction({
				isolationLevel:
					modelInstance.Sequelize.Transaction.ISOLATION_LEVELS
						.READ_COMMITTED,
			});
			try {
				foundData.set('exceedBaseLine', data.exceedBaseLine);
				const changedAttributes = foundData.changed();
				const changedState = activityHelper.getChangedState(foundData);
				savedData = await foundData.save({
					transaction: transaction,
				});
				if (changedAttributes) {
					if (changedAttributes.indexOf('exceedBaseLine') > -1) {
						await activityService.handleActivityTracking(
							`EXCEED_BASELINE_CHANGED`,
							domainName,
							{
								id: savedData.id,
								notes: `EXCEED_BASELINE_CHANGED`,
								changes: changedState,
							},
							{
								sessionUser: sessionUser,
								transaction: transaction,
							},
						);
					}
				}
				await transaction.commit();
				await redisService.delete('global_menu_data');
				await redisService.delete('collection_cache:' + data.id);
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
		let companyId;

		if (sessionUser && sessionUser.groupName === userTypes.VIEWER) {
			return Promise.reject({
				status: 400,
				message: 'Permission denied',
			});
		}
		if (sessionUser && sessionUser.groupName !== userTypes.ADMIN) {
			companyId = sessionUser.companyId;
			if (!companyId) {
				return Promise.reject({
					status: 400,
					message: 'Permission denied',
				});
			}
			//  whereClause['$operational_unit.parentID$'] = companyId;
		}
		let foundData = await Collection.findOne({
			where: whereClause,
			include: [
				{
					model: Collection,
					as: 'parent',
					required: false,
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

			if (companyId) {
				if (foundData.parentID) {
					if (
						foundData.parentID.toString() !== companyId.toString()
					) {
						return Promise.reject({
							status: 400,
							message: 'Permission denied',
						});
					}
				} else {
					if (foundData.id.toString() !== companyId.toString()) {
						return Promise.reject({
							status: 400,
							message: 'Permission denied',
						});
					}
				}
			}
			await foundData.destroy();
			await redisService.delete('global_menu_data');
			await redisService.delete('collection_cache:' + id);
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
					'Unable to remove The record as it has referenced data.',
			});
		} else {
			console.log(ex);
		}
		return Promise.reject(ex);
	}
};
