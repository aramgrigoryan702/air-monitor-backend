const DomainLookup = require('../models/index').DomainLookup;
const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const { buildPaginatedData } = require('../helpers/paginationHelper');

const editableFieldNames = ['name', 'description'];

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
        let foundData = await DomainLookup.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            raw: true,
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
        let data = await DomainLookup.findByPk(id, { raw: true });
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
        let insertedData = await DomainLookup.create(toBeInsertedData);
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
        let foundData = await DomainLookup.findByPk(toBeUpdatedData.id);
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
 * Delete  Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.delete = async function(id, sessionUser) {
    try {
        let foundData = await DomainLookup.findByPk(id);
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
