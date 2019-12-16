const modelInstance = require('../models/index');
const { Lookup, DomainLookup } = modelInstance;
const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const { buildPaginatedData } = require('../helpers/paginationHelper');

const editableFieldNames = ['name', 'description', 'domainID'];

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
        let whereCondition;
        //= params.whereCondition || undefined;
        if (params.search) {
            whereCondition = { name: params.search };
        }
        let sort_column = params.sort_column;
        let sort_order = params.sort_order;
        let sortObj = undefined;

        if (sort_column && sort_order) {
            sortObj = [[sort_column, sort_order.toString().toUpperCase()]];
        }

        let foundData = await Lookup.findAndCountAll({
            where: whereCondition,
            order: sortObj,
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
        let data = await Lookup.findByPk(id, { raw: true });
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
        };
        if (toBeInsertedData.name) {
            toBeInsertedData.name = toBeInsertedData.name
                .toString()
                .trim()
                .toUpperCase();
        }
        let insertedData = await Lookup.create(toBeInsertedData);
        let result = insertedData.toJSON();
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
        let foundData = await Lookup.findByPk(toBeUpdatedData.id);
        if (foundData) {
            Object.keys(toBeUpdatedData).forEach(key => {
                if (editableFieldNames.indexOf(key) > -1) {
                    foundData.set(key, toBeUpdatedData[key]);
                }
            });
            if (foundData.name) {
                foundData.name = foundData.name
                    .toString()
                    .trim()
                    .toUpperCase();
            }
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

/***
// This  service simply  find the lookup  id for  certain type of  activity
*/
module.exports.findOrCreateByActivityName = async function(
    activityName,
    { sessionUser, domainName, transaction },
) {
    try {
        let [activityDomain] = await DomainLookup.findOrCreate({
            where: { name: 'ACTIVITY' },
            defaults: { name: 'ACTIVITY' },
            attributes: ['id'],
            raw: true,
            transaction: transaction,
        });

        let reference_domainId;

        if (domainName) {
            let [refActivityDomain] = await DomainLookup.findOrCreate({
                where: { name: domainName },
                defaults: { name: domainName },
                raw: true,
                attributes: ['id'],
                transaction: transaction,
            });
            if (refActivityDomain) {
                reference_domainId = refActivityDomain.id;
            }
        }

        let [lookupData] = await Lookup.findOrCreate({
            where: {
                name: activityName,
                domainID: activityDomain.id,
                reference_domainID: reference_domainId,
            },
            defaults: {
                name: activityName,
                domainID: activityDomain.id,
                reference_domainID: reference_domainId,
            },
            attributes: ['id'],
            raw: true,
            transaction: transaction,
        });

        if (lookupData) {
            return lookupData;
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
        let foundData = await Lookup.findByPk(id);
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
