/* eslint-disable no-process-exit */
const Sequelize = require('sequelize');
const Database_URL = process.env.Database_URL;
const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);
const EventEmitter = require('events');
const pgEvents = new EventEmitter();
const config = require('../config');
const async = require('neo-async');

const sequelize = new Sequelize(Database_URL, {
	dialect: 'postgres',
	logging: false,
	timezone: config.system.default_timezone,
	underscored: false,
	createdAt: 'created_at',
	updatedAt: 'updated_at',
	deletedAt: false,
	omitNull: true,
	typeValidation: true,
	benchmark: true,
	quoteIdentifiers: true,
	dialectOptions: {
		ssl:
			process.env === 'production'
				? fs.readFileSync(
						path.join(
							__dirname,
							'../db_certificate/rds-ca-2019-us-east-2.pem',
						),
				  )
				: false,
		native: true,
	},
	ssl: process.env === 'production' ? true : false,
	// lowercase: true,
	pool: {
		max: 10,
		min: 2,
		idle: 20000,
		// @note https://github.com/sequelize/sequelize/issues/8133#issuecomment-359993057
		acquire: 400000,
		handleDisconnects: true,
	},
});

const models = {};

fs.readdirSync(__dirname)
	.filter(file => {
		return (
			file.indexOf('.') !== 0 &&
			file !== basename &&
			file.slice(-3) === '.js'
		);
	})
	.forEach(file => {
		const model = sequelize['import'](path.join(__dirname, file));
		models[model.name] = model;
	});

Object.keys(models).forEach(key => {
	if ('associate' in models[key]) {
		models[key].associate(models);
	}
});

models.sequelize = sequelize;
models.Sequelize = Sequelize;

module.exports = models;

module.exports.pgEvents = pgEvents;
/*
module.exports.authenticate = function() {
    return new Promise((resolve, reject) => {
        sequelize
            .authenticate()
            .then(() => {
                console.log('Postgresql Server Authenticated Successfully.');
                return module.exports.enableRequiredExtensions();
            })
            .then(() => {
                resolve();
            })
            .catch(err => {
                console.log(err);
                if (err && err.name) {
                    if (
                        [
                            'SequelizeConnectionError',
                            'SequelizeConnectionRefusedError',
                            'SequelizeHostNotFoundError',
                            'SequelizeAccessDeniedError',
                            'SequelizeInvalidConnectionError',
                            'SequelizeConnectionTimedOutError',
                        ].indexOf(err.name) > -1
                    ) {
                        process.exit(1);
                    }
                }
                reject(err);
            });
    });
};*/

module.exports.syncDB = function() {
	return new Promise((resolve, reject) => {
		sequelize
			.sync({ force: false })
			.then(async () => {
				console.log('Postgresql Server Synced Successfully.');
				process.nextTick(() => {
					pgEvents.emit('ready');
				});
				resolve();
			})
			.catch(err => {
				console.log(err);
				reject(err);
			});
	});
};

function _auth(callback) {
	sequelize
		.authenticate()
		.then(() => {
			return module.exports.enableRequiredExtensions();
		})
		.then(() => {
			return module.exports.createSchema();
		})
		.then(() => {
			return callback(null);
		})
		.catch(err => {
			console.log('Postgresql waiting for connection.');
			return callback(err);
		});
}

module.exports.ping = function() {
	return sequelize.queryInterface.sequelize
		.query(`SELECT 1+1  `, { type: sequelize.QueryTypes.SELECT })
		.catch(err => {
			console.log(err);
			return Promise.reject(err);
		});
};
module.exports.authenticate = function() {
	return new Promise((resolve, reject) => {
		async.retry(
			{ times: 50, interval: 2000 },
			function(callback) {
				_auth(callback);
			},
			async function(err) {
				if (err) {
					console.error('Giving up for Postgresql');
					if (err && err.name) {
						if (
							[
								'SequelizeConnectionError',
								'SequelizeConnectionRefusedError',
								'SequelizeHostNotFoundError',
								'SequelizeAccessDeniedError',
								'SequelizeInvalidConnectionError',
								'SequelizeConnectionTimedOutError',
							].indexOf(err.name) > -1
						) {
							process.exit(1);
						}
					}
					reject(err);
				} else {
					resolve();
					console.log('Connected to db');
				}
			},
		);
	});
};

/***
 * Loop Through all auto incremented sequences and update the current  value with  corresponding  max id  property
 * @returns {Promise}
 */
module.exports.refreshSequences = function() {
	return new Promise((resolve, reject) => {
		console.log('Going to refresh te sequences');
		sequelize.queryInterface.sequelize
			.query(`SELECT c.relname FROM pg_class c WHERE c.relkind = 'S'; `)
			.then(results => {
				let _promises = [];
				if (results && results.length > 0) {
					let sequences = results[0].map(item => {
						return {
							name: item.relname,
							tableName: item.relname.replace('_id_seq', ''),
						};
					});
					sequences.forEach(seq => {
						_promises.push(
							module.exports.updateMaxSequence(
								seq.tableName,
								'id',
								seq.name,
							),
						);
					});
				}

				return Promise.all(_promises);
			})
			.then(() => {
				console.log('All sequences updated with max value');
				resolve();
			})
			.catch(err => {
				console.log('Failed to auto enabled extensions');
				reject(err);
			});
	});
};

/****
 * Set current sequence id  with  the max column value
 * @param tableName
 * @param columnName
 * @param sequenceName
 * @returns {Promise}
 */
module.exports.updateMaxSequence = function(
	tableName,
	columnName,
	sequenceName,
) {
	return new Promise((resolve, reject) => {
		sequelize.queryInterface.sequelize
			.query(
				` SELECT setval('"${sequenceName}"', (SELECT MAX(id) FROM "${tableName}")); `,
			)
			.then(results => {
				resolve();
			})
			.catch(err => {
				console.log('Failed to update the  sequence', err);
				reject(err);
			});
	});
};

module.exports.createSchema = function() {
	return new Promise((resolve, reject) => {
		sequelize.queryInterface.sequelize
			.query(`CREATE SCHEMA if not exists events;`)
			.then(() => {
				console.log(`schema enabled!`);
				resolve();
			})
			.catch(err => {
				console.log('Failed to auto enable schema');
				reject(err);
			});
	});
};

module.exports.enableRequiredExtensions = function() {
	return new Promise((resolve, reject) => {
		sequelize.queryInterface.sequelize
			.query(`  CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; `)
			.then(() => {
				console.log(`extensions enabled!`);
				resolve();
			})
			.catch(err => {
				console.log('Failed to auto enable extensions');
				reject(err);
			});
	});
};

module.exports.executeBaseLineSqls = function() {
	return new Promise((resolve, reject) => {
		setImmediate(() => resolve());
		/*sequelize.queryInterface.sequelize
            .query(sqlScripts.sql_text())
            .then(() => {
                console.log(`base line sqls executed!`);
                resolve();
            })
            .catch(err => {
                console.log('Failed to run base line sqls');
                reject(err);
            });*/
	});
};

module.exports.graceFullShutdown = async function() {
	if (sequelize && sequelize.connectionManager) {
		return sequelize.connectionManager
			.close()
			.then(() => {
				console.log(
					'Postgresql Server disconnected through app termination',
				);
				return true;
			})
			.catch(err => {
				console.log('Error at terminating Postgresql Server', err);
				return Promise.reject(err);
			});
	} else {
		return true;
	}
};
