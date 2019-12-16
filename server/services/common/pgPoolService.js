const JSONStream = require('JSONStream');
let loggerService = require('./loggerService');
const knex = require('knex')({
	client: 'pg',
	connection: process.env.Database_URL,
	acquireConnectionTimeout: 400000,
	pool: {
		min: 2,
		max: 10,
		afterCreate: function(conn, done) {
			// in this example we use pg driver's connection API
			conn.query('SET timezone="UTC";', function(err) {
				if (err) {
					// first query failed, return error and don't try to make next query
					done(err, conn);
				} else {
					done(err, conn);
				}
			});
		},
	},
	searchPath: ['events'],
});

module.exports.queryStream = function(queryStr) {
	return new Promise((success, error) => {
		//console.log('queryStr', queryStr);
		const stream = knex.raw(queryStr).stream();
		let count = 0;
		stream.on('error', error => {
			console.log('Error at knex stream', error);
			//client.end();
		});

		stream.on('end', () => {
			// client.end();
			console.log('knex stream ended');
			console.log('total row count', count);
			//  console.timeEnd('test');
		});
		stream.on('data', data => {
			count++;
			console.log('knex data', count);
		});
		success(stream);
	});
};

module.exports.graceFullShutdown = async function() {
	return new Promise((resolve, reject) => {
		if (knex) {
			if (knex.client) {
				const pool = knex.client.pool;
				if (pool.destroyed === true) {
					return resolve(true);
				}
				pool.destroy()
					.then(() => {
						console.log(
							'Knex Pool disconnected through app termination',
						);
						resolve(true);
					})
					.catch(err => {
						console.log('Knex Pool disconnection error');
						console.log(err);
						resolve(true);
					});
			} else {
				resolve(true);
			}
		} else {
			resolve(true);
		}
	});
};
