/* eslint-disable no-process-exit */
const redis = require('redis');
const _ = require('lodash');
const bluebird = require('bluebird');
const config = require('../../config');
const loggerService = require('./loggerService');
let lastCommandTime = Date.now();

bluebird.promisifyAll(redis);

var redisReaderClient;
var redisWriterClient;

let allRedisConnections = [];
let pingInterval;

/****
 * Initiate Redis  Client
 * @param callback
 * @returns {RedisClient}
 */
module.exports.initiate = function() {
	return new Promise((resolve, reject) => {
		let redisPassword,
			options = {
				host: process.env.REDIS_HOST,
				port: process.env.REDIS_PORT,
				no_ready_check: false,
				db: 0,
				disable_resubscribing: false,
				retry_unfulfilled_commands: true,
				retry_strategy: module.exports.getRetryStrategy,
				socket_keepalive: true,
				reconnectOnError: true,
			};

		redisReaderClient = redis.createClient(options);
		redisWriterClient = redis.createClient(options);
		handleConnecctionnEvents(redisReaderClient);
		handleConnecctionnEvents(redisWriterClient);
		redisPassword = process.env.REDIS_PASSWORD;

		if (redisPassword) {
			redisReaderClient.auth(redisPassword, function(err) {
				if (err) {
					reject(err);
				} else {
					resolve(redisReaderClient);
				}
				console.log('Authenticated Redis');
			});

			redisWriterClient.auth(redisPassword, function(err) {
				if (err) {
					console.log(err);
				}
			});
		}
		return redisReaderClient;
	});
};

/****
 * Initiate Redis  Client
 * @param callback
 * @returns {RedisClient}
 */
module.exports.createRateLimiterClient = function() {
	let redisPassword,
		options = {
			port: process.env.REDIS_PORT,
			host: process.env.REDIS_HOST,
			no_ready_check: false,
			db: 0,
			disable_resubscribing: false,
			retry_strategy: module.exports.getRetryStrategy,
			socket_keepalive: true,
			reconnectOnError: true,
		};

	let rateLimitRedisClient = redis.createClient(options);
	redisPassword = process.env.REDIS_PASSWORD;

	/*if (redisPassword) {
            rateLimitRedisClient.auth(redisPassword, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(rateLimitRedisClient);
                }
            });
        }
*/
	handleConnecctionnEvents(rateLimitRedisClient);
	return rateLimitRedisClient;
};

module.exports.createQueManagerClient = function(callback) {
	let redisPassword,
		options = {
			port: process.env.REDIS_PORT,
			host: process.env.REDIS_HOST,
			no_ready_check: false,
			db: 0,
			disable_resubscribing: false,
			retry_strategy: module.exports.getRetryStrategy,
			socket_keepalive: true,
		};

	let queueManagerRedisClient = redis.createClient(options);
	redisPassword = process.env.REDIS_PASSWORD;
	handleConnecctionnEvents(queueManagerRedisClient);
	if (redisPassword) {
		queueManagerRedisClient.auth(redisPassword, function(err) {
			if (err) {
				throw err;
			}
			console.log('Authenticated Redis');
		});
	}

	queueManagerRedisClient.on('connect', function() {
		console.log('Redis for queueManagerRedisClient Connected!');
		if (callback) {
			callback();
		}
	});

	queueManagerRedisClient.on('error', function(err) {
		console.log('Redis Connection error!', err);
	});

	queueManagerRedisClient.on('reconnecting', function() {
		console.log('Redis Client reconnecting!');
	});

	allRedisConnections.push(queueManagerRedisClient);
	return queueManagerRedisClient;
};

/***
 * Set value  for specified key
 * @param key
 * @param value
 * @param expireAfter
 * @returns {Promise}
 */
module.exports.set = function(
	key,
	value,
	expireAfter = config.system.redis_cache_default_duration,
) {
	return new Promise((resolve, reject) => {
		let valAsJson = JSON.stringify(value);

		redisWriterClient.set(
			key,
			valAsJson,
			'EX',
			expireAfter > 0
				? expireAfter
				: config.system.redis_cache_default_duration,
			(err, savedData) => {
				if (err) {
					reject(err);
				} else {
					lastCommandTime = Date.now();
					resolve(savedData);
				}
			},
		);
	});
};

/***
 * Set value  for specified key
 * @param key
 * @param value
 * @param expireAfter
 * @returns {Promise}
 */
module.exports.sadd = function(
	key,
	value,
	expireAfter = config.system.redis_cache_default_duration,
) {
	return new Promise((resolve, reject) => {
		let valAsJson = value;
		redisWriterClient.sadd(
			key,
			valAsJson,
			'EX',
			expireAfter > 0
				? expireAfter
				: config.system.redis_cache_default_duration,
			(err, savedData) => {
				if (err) {
					reject(err);
				} else {
					lastCommandTime = Date.now();
					resolve(savedData);
				}
			},
		);
	});
};

/***
 * Get the  value  for  specified key
 * @param key
 * @returns {Promise}
 */
module.exports.get = function(key) {
	return new Promise((resolve, reject) => {
		redisReaderClient.get(key, (err, foundData) => {
			if (err) {
				loggerService.logFatalError(err);
				reject(err);
			} else {
				if (foundData) {
					foundData = JSON.parse(foundData);
				}
				lastCommandTime = Date.now();
				resolve(foundData);
			}
		});
	});
};

module.exports.sismember = function(key, val) {
	return new Promise((resolve, reject) => {
		redisReaderClient.sismember(key, val, (err, foundData) => {
			if (err) {
				loggerService.logFatalError(err);
				reject(err);
			} else {
				if (foundData) {
					foundData = JSON.parse(foundData);
				}
				lastCommandTime = Date.now();
				resolve(foundData);
			}
		});
	});
};

module.exports.srem = function(key, val) {
	return new Promise((resolve, reject) => {
		redisReaderClient.srem(key, val, (err, foundData) => {
			if (err) {
				loggerService.logFatalError(err);
				reject(err);
			} else {
				if (foundData) {
					foundData = JSON.parse(foundData);
				}
				lastCommandTime = Date.now();
				resolve(foundData);
			}
		});
	});
};

/***
 * Get the  value  for  specified key
 * @param key
 * @returns {Promise}
 */
module.exports.hmget = function(key) {
	return new Promise((resolve, reject) => {
		redisReaderClient.hmget(key, (err, foundData) => {
			if (err) {
				loggerService.logFatalError(err);
				reject(err);
			} else {
				if (foundData) {
					foundData = JSON.parse(foundData);
				}
				lastCommandTime = Date.now();
				resolve(foundData);
			}
		});
	});
};

/***
 * Delete the key  value  pair
 * @param key
 * @returns {Promise}
 */
module.exports.delete = function(key) {
	return new Promise((resolve, reject) => {
		redisWriterClient.del(key, err => {
			if (err) {
				loggerService.logFatalError(err);
				reject(err);
			} else {
				lastCommandTime = Date.now();
				resolve();
			}
		});
	});
};

/***
 * Delete the key  value  pair
 * @param key
 * @returns {Promise}
 */
module.exports.deleteByKeys = function(keys) {
	return new Promise((resolve, reject) => {
		let multiClient = redisWriterClient.multi();
		keys.forEach(keyName => {
			multiClient.del(keyName);
		});
		multiClient.exec(err => {
			if (err) {
				loggerService.logFatalError(err);
				reject(err);
			} else {
				lastCommandTime = Date.now();
				resolve();
			}
		});
	});
};

module.exports.getMultiWriterClient = function() {
	return new Promise((resolve, reject) => {
		let multiClient = redisWriterClient.multi();
		setImmediate(() => {
			resolve(multiClient);
		});
	});
};

module.exports.getMultiReaderClient = function() {
	return new Promise((resolve, reject) => {
		let multiClient = redisReaderClient.multi();
		setImmediate(() => {
			resolve(multiClient);
		});
	});
};

/***
 * Settle the retry strategy
 * @param options
 * @returns {*}
 */
module.exports.getRetryStrategy = function(options) {
	if (options.error && options.error.code === 'ECONNREFUSED') {
		// End reconnecting on a specific error and flush all commands with
		// a individual error
		console.log(
			'The redis server refused the connection.',
			options.attempt,
		);
		if (options.attempt > 100) {
			loggerService.logFatalError(
				new Error(' Redis client died ' + JSON.stringify(options)),
			);
			throw new Error('The server refused the connection');
		}
	}
	if (options.total_retry_time > 100 * 60) {
		// End reconnecting after a specific timeout and flush all commands
		// with a individual error
		loggerService.logFatalError(
			new Error(' Redis client died ' + JSON.stringify(options)),
		);
		throw new Error('Redis server Retry time exhausted');
	}
	if (options.attempt > 100) {
		// End reconnecting with built in error
		loggerService.logFatalError(
			new Error(' Redis client died ' + JSON.stringify(options)),
		);
		throw new Error('Retry attempt exhausted');
	}

	options.attempt = options.attempt || 20;
	// try to reconnect after
	return Math.min(options.attempt * 100, 200);
};

/***
 * Redis connection will cause short network blips if connection has long periods of inactivity.
 *  For example: like in a long straight road driver might fall asleep
 *  Well we  are  keeping them awake by regular talking
 */
module.exports.startPinging = function() {
	if (Date.now() - lastCommandTime > 2000) {
		if (pingInterval) {
			clearInterval(pingInterval);
		}
		setInterval(function() {
			// console.log('redisClient => Sending Ping...');
			allRedisConnections.map(con => {
				if (con && con.connected) {
					con.ping();
				}
			});
			lastCommandTime = Date.now();
		}, 6000); // 6 seconds
	}
};

module.exports.ping = function() {
	return redisReaderClient.ping();
};
module.exports.stopPinging = function() {
	if (pingInterval) {
		clearInterval(pingInterval);
	}
};

/***
 * Delete all keys from  redis  cache
 * @returns {Promise}
 */
module.exports.cleanAll = function() {
	return new Promise((resolve, reject) => {
		let _promises = [];
		allRedisConnections.forEach(client => {
			client.keys('*', function(err, keys) {
				if (Array.isArray(keys)) {
					keys.forEach(key =>
						_promises.push(module.exports.delete(key)),
					);
				}
			});
		});

		Promise.all(_promises)
			.then(() => resolve())
			.catch(err => reject(err));
	});
};

module.exports.graceFullShutdown = async function() {
	return new Promise((resolve, reject) => {
		try {
			module.exports.stopPinging();
			console.log(
				'redisClient connection shutting down.  Flushing offline queue.',
			);
			if (allRedisConnections && allRedisConnections.length > 0) {
				allRedisConnections.map(item => {
					if (item) {
						if (item.connected) {
							item.send_offline_queue();
							//item.BGSAVE();
							item.quit();
						}
					}
				});
			}
		} catch (err) {
			console.log(err);
		}
		resolve();
	});
};

/*process.on('SIGINT', function() {
    module.exports.stopPinging();
});*/

function handleConnecctionnEvents(redisClient) {
	redisClient.on('connect', function() {
		console.log('Redis Connected!');
		setImmediate(() => module.exports.startPinging());
	});

	redisClient.on('error', function(err) {
		loggerService.log('Redis connection error!', err);
		//throw err;
	});

	redisClient.on('ready', function(err) {
		loggerService.log('Redis connection ready!');
		//throw err;
	});

	redisClient.on('reconnecting', function() {
		loggerService.log('Redis client reconnecting!');
	});

	allRedisConnections.push(redisClient);
}
