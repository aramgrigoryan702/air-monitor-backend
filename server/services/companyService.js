const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const modelInstance = require('../models/index');
const {
	Collection,
	Lookup,
	DomainLookup,
	Site,
	Map,
	Device,
	Sequelize,
} = modelInstance;
const { Op } = Sequelize;
const ErrorMessageTypes = require('../error-messages/ErrorMessageTypes');
const { buildPaginatedData } = require('../helpers/paginationHelper');
const redisService = require('./common/redisService');
const permissionChecker = require('./common/permissionChecker');
const userTypes = require('../types/UserTypes');

module.exports.query = async function(params, sessionUser) {
	try {
		let whereClause = {
			'$lookup.domainLookups.name$': 'COMPANY',
		};
		const companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		if (companyId) {
			whereClause['id'] = companyId;
		}
		let foundData = await Collection.findAll({
			where: whereClause,
			order: [['name', 'asc']],
			include: [
				{
					model: Lookup,
					as: 'lookup',
					require: true,
					attributes: ['id', 'name'],
					include: [
						{
							model: DomainLookup,
							as: 'domainLookups',
							attributes: ['name'],
							require: true,
						},
					],
				},
				// { model: Map, as: 'collection_map', require: false },
			],
		});

		return { data: foundData };
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.findOne = async function(params, sessionUser) {
	try {
		let whereClause = {
			'$lookup.domainLookups.name$': 'COMPANY',
		};
		const companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		if (companyId) {
			whereClause['id'] = companyId;
		}
		let foundData = await Collection.findOne({
			where: whereClause,
			order: [['name', 'asc']],
			include: [
				{
					model: Lookup,
					as: 'lookup',
					require: true,
					attributes: ['id', 'name'],
					include: [
						{
							model: DomainLookup,
							as: 'domainLookups',
							attributes: ['name'],
							require: true,
						},
					],
				},
				// { model: Map, as: 'collection_map', require: false },
			],
		});

		if (!foundData) {
			return Promise.reject({ ...ErrorMessageTypes.COMPANY_NOT_FOUND });
		}

		return { data: foundData };
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.list = async function(params, sessionUser) {
	try {
		if (sessionUser && sessionUser.groupName === userTypes.ADMIN) {
			let menuData = await redisService.get('global_menu_data');
			if (menuData) {
				return { data: menuData };
			}
		}
		let whereClause = {
			'$lookup.domainLookups.name$': 'COMPANY',
		};

		const companyId = await permissionChecker.findCompanyIdOfSessionUser(
			sessionUser,
		);
		if (companyId) {
			whereClause['id'] = companyId;
		}

		let foundData = await Collection.findAll({
			where: whereClause,
			include: [
				{
					model: Collection,
					as: 'children',
					require: false,
					include: [
						{
							model: Site,
							as: 'sites',
							include: [
								{
									model: Map,
									as: 'site_map',
									require: false,
								},
								{
									model: Device,
									as: 'devices',
									require: false,
									attributes: ['id'],
								},
							],
							require: false,
						},
						{ model: Map, as: 'collection_map', require: false },
					],
				},
				{
					model: Lookup,
					as: 'lookup',
					require: true,
					include: [
						{
							model: DomainLookup,
							as: 'domainLookups',
							attributes: ['name'],
							require: true,
							where: { name: 'COMPANY' },
						},
					],
				},
				{ model: Map, as: 'collection_map', require: false },
			],
		});

		let result = foundData.map(row => {
			let item = row.toJSON();
			let itemDeviceCount = 0;
			if (item && item.children) {
				item.children = item.children.map(child => {
					if (child) {
						let childDeviceCount = 0;
						if (child.sites) {
							child.sites = child.sites.map(siteItem => {
								if (siteItem) {
									siteItem.deviceCount =
										siteItem.devices.length || 0;
									childDeviceCount += siteItem.deviceCount;
								}
								return siteItem;
							});
							child.sites = _.sortBy(child.sites, 'name');
						}
						child.deviceCount = childDeviceCount;
					}
					itemDeviceCount += child.deviceCount;
					return child;
				});
				item.children = _.sortBy(item.children, 'name');
			}
			item.deviceCount = itemDeviceCount;
			return item;
		});
		let newResult = _.sortBy(result, 'name');
		if (sessionUser && sessionUser.groupName === userTypes.ADMIN) {
			await redisService.set('global_menu_data', newResult);
		}
		return {
			data: newResult,
		};
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.findDefaultCompany = async function() {
	try {
		let lookup = await Lookup.findOne({
			'$domainLookups.name$': 'COMPANY',
			include: [
				{
					model: DomainLookup,
					as: 'domainLookups',
					attributes: ['name'],
					where: { name: 'COMPANY' },
					require: true,
				},
			],
			raw: true,
		});

		if (!lookup) {
			return Promise.reject({
				status: 400,
				message: 'Company Lookup not found',
			});
		}

		let [foundData] = await Collection.findOrCreate({
			where: {
				name: 'Project Canary',
				lookup_ID: lookup.id,
			},
			defaults: {
				name: 'Project Canary',
				lookup_ID: lookup.id,
			},
		});
		return {
			data: foundData.toJSON(),
		};
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};

module.exports.findDefaultDivision = async function() {
	try {
		let lookup = await Lookup.findOne({
			'$domainLookups.name$': 'DIVISION',
			include: [
				{
					model: DomainLookup,
					as: 'domainLookups',
					attributes: ['name'],
					where: { name: 'DIVISION' },
					require: true,
				},
			],
			raw: true,
		});

		if (!lookup) {
			return Promise.reject({
				status: 400,
				message: 'DIVISION Lookup not found',
			});
		}

		let [foundData, created] = await Collection.findOrCreate({
			where: {
				name: 'Internal',
				lookup_ID: lookup.id,
			},
			defaults: {
				name: 'Internal',
				lookup_ID: lookup.id,
			},
		});

		if (created === true) {
			let defaultCompanyResult = await module.exports.findDefaultCompany();
			if (defaultCompanyResult && defaultCompanyResult.data) {
				foundData.set('parentID', defaultCompanyResult.data.id);
				await foundData.save();
			}
		}
		return {
			data: foundData.toJSON(),
		};
	} catch (ex) {
		console.log(ex);
		return Promise.reject(ex);
	}
};
