const {
    AlertConfig,
    AlertNotification,
    Site,
    Device,
    Lookup,
} = require('../models/index');

const QueueManager = require('../task-queue/QueueManager');

const _ = require('lodash');
const moment = require('moment');
const config = require('../config');
const emailTemplates = require('../email-templates/emailTemplates');

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
        let companyId = whereCondition.companyId;
        if (!companyId) {
            return Promise.reject({
                status: 400,
                message: 'Invalid search query. companyId required.',
            });
        }
        //whereCondition.created_by = sessionUser.email;
        whereCondition.collection_id = whereCondition.companyId;
        delete whereCondition.companyId;
        let foundData = await AlertNotification.findAndCountAll({
            where: whereCondition,
            limit,
            offset,
            raw: true,
            include: [
                {
                    model: Site,
                    as: 'site',
                    attributes: ['collection_ID'],
                },
            ],
            order: [['timestamp', 'desc']],
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
 * Add  new Data
 * @param data
 * @param sessionUser
 * @returns {Promise<*>}
 */
module.exports.create = async function(data, sessionUser) {
    try {
        let toBeInsertedData = {
            ...data,
            created_at: new Date(),
        };
        let insertedData = await AlertNotification.create(toBeInsertedData);
        await QueueManager.addProcessAlertTask({ id: insertedData.get('id') });
        return insertedData.toJSON();
    } catch (ex) {
        console.log(ex);
        return Promise.reject(ex);
    }
};

module.exports.processAlert = async function(data, sessionUser) {
    try {
        let id = data.id;
        let notification = await AlertNotification.findByPk(id, {
            include: [
                {
                    model: AlertConfig,
                    as: 'alert_config',
                    required: true,
                },
                {
                    model: Site,
                    as: 'site',
                    attributes: ['id', 'name'],
                    required: true,
                },
                {
                    model: Device,
                    as: 'device',
                    attributes: ['id', 'position'],
                    include: [
                        {
                            model: Lookup,
                            as: 'positionLookup',
                            //attributes: ['id', 'name'],
                            required: false,
                        },
                    ],
                },
            ],
        });

        if (notification) {
            notification = notification.toJSON();
            let deviceName = notification.device_id;
            if (
                notification.device &&
                notification.device.positionLookup &&
                notification.device.positionLookup.name
            ) {
                deviceName +=
                    ' (' + notification.device.positionLookup.name + ')';
            }

            notification.email_addresses =
                notification.alert_config.email_addresses;
            if (notification) {
                let emailBody = emailTemplates.buildUserAlertMessage({
                    siteName: notification.site.name,
                    deviceName: deviceName,
                    alert_values: notification.alert_values,
                    timestamp: notification.timestamp.toString(),
                });
                console.log(emailBody);
                QueueManager.addSendAlertMailTask({
                    to: notification.email_addresses,
                    body: emailBody,
                    subject:
                        'Project Canary Alert on ' +
                        notification.site.name +
                        ' - ' +
                        deviceName +
                        ' ',
                });
            }

            await AlertNotification.update(
                {
                    notification_sent: true,
                },
                {
                    where: {
                        id: id,
                    },
                },
            );
            return {
                success: true,
            };
        } else {
            return Promise.reject({
                status: 400,
                message: 'Notification not found in the system',
            });
        }
    } catch (ex) {
        console.log(ex);
        return Promise.reject(ex);
    }
};
