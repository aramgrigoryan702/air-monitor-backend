const deviceService = require('../deviceService');
const util = require('util');
const path = require('path');
const config = require('../../config');
const _ = require('lodash');
const s3FileServer = require('../common/s3FileService');
const modelInstance = require('../../models/index');
const { Collection, Lookup, DomainLookup, Site, Map, Device } = modelInstance;
const exec = util.promisify(require('child_process').spawn);
const fs = require('fs');
const fse = require('fs-extra');
const { spawn } = require('child_process');

//events.rollup_events_monthly, events.rollup_events_quarterly, events.rollup_events_weekly
module.exports.refreshViews = async function() {
	try {
		await modelInstance.sequelize.queryInterface.sequelize.query(
			`TRUNCATE events.rollup_events, events.rollup_events_daily, events.rollup_events_hourly, events.rollup_view_stat RESTART IDENTITY;`,
		);
		//await deviceService.refreshDeviceView();
		await deviceService.refreshDeviceViewAll();
		//await deviceService.refreshDeviceViewMonthly();
		return { success: true };
	} catch (err) {
		return Promise.reject(err);
	}
};

module.exports.refreshStagingDB = async function() {
	return new Promise((resolve, reject) => {
		try {
			let fileName = path.join(__dirname, '../../staging_db_up.sh');
			console.log('fileName', fileName);
			const ls = spawn(
				`PGPASSWORD="Terrafirma1" pg_dump  --clean -T "events.rollup_*"  --schema "events" -h projectcanary-new.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -p 5432  -U darmitage projectcanary > ~/projectcanary.bak && cat  ~/projectcanary.bak  | PGPASSWORD="Terrafirma1"  psql -p 5432  -U darmitage -h projectcanary-staging.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -d projectcanary`,
				[],
				{
					cwd: path.join(__dirname, '../../'),
					shell: true,
				},
			);
			ls.stdout.on('data', data => {
				console.log(`stdout: ${data}`);
			});

			ls.stderr.on('data', data => {
				console.log(`stderr: ${data}`);
			});

			ls.on('close', code => {
				console.log(`child process exited with code ${code}`);
				if (code === 0) {
					if (
						process.env.BASE_URL ===
						'https://api-staging.projectcanary.io'
					) {
						module.exports
							.renameStagingDB()
							.then(() => {
								setImmediate(async () => {
									await deviceService.refreshDeviceView();
									await deviceService.refreshDeviceViewAll();
									await deviceService.refreshDeviceViewMonthly();
								});
								resolve();
							})
							.catch(err => {
								reject(err);
							});
					} else {
						resolve();
					}
				} else {
					reject({
						message: `child process exited with code ${code}`,
					});
				}
			});
		} catch (err) {
			console.log(err);
			reject(err);
		}
	});
};

module.exports.backupDBIntoS3 = async function() {
	return new Promise((resolve, reject) => {
		try {
			console.log('Going to take db backup');
			let bcCopyPath = path.join(
				__dirname,
				'../../',
				'projectcanary.bak',
			);
			fse.ensureFileSync(bcCopyPath);
			fs.truncateSync(bcCopyPath);
			let fileBuffer = [];
			const ls = spawn(
				`PGPASSWORD="Terrafirma1" pg_dump  --clean  -T "events.rollup_*"  --schema "events" -h projectcanary-new.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -p 5432  -U darmitage projectcanary > ~/projectcanary.bak && cat  ~/projectcanary.bak`,
				//`PGPASSWORD="Terrafirma1" pg_dump  --clean  -T "rollup_*"  -h localhost -p 5432  -U darmitage projectcanary > ~/projectcanary.bak && cat  ~/projectcanary.bak`,
				[],
				{
					cwd: path.join(__dirname, '../../'),
					shell: true,
				},
			);
			ls.stdout.on('data', data => {
				//fileBuffer.push(data);
				// console.log(`stdout: ${data}`);
				fs.appendFileSync(bcCopyPath, data);
			});

			ls.stderr.on('data', data => {
				console.log(`stderr: ${data}`);
			});

			ls.on('close', code => {
				console.log(`child process exited with code ${code}`);
				if (code === 0) {
					console.log('Going to upload at s3');
					s3FileServer
						.uploadFile(bcCopyPath, {
							bucketName: config.dbBackupBucketName,
						})
						.then(result => {
							resolve(result);
						})
						.catch(err => {
							console.log(err);
							reject({
								message: `child process exited with code ${code}`,
							});
						});
				} else {
					reject({
						message: `child process exited with code ${code}`,
					});
				}
			});
		} catch (err) {
			console.log(err);
			reject(err);
		}
	});
};

module.exports.renameStagingDB = async function() {
	try {
		let companies = [];
		let collections = [];
		let sites = [];

		let foundData = await Collection.findAll({
			where: {},
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

		let collectionCount = 1;
		let companyCount = 1;
		let siteCount = 1;
		let _promises = [];
		let result = foundData.map(row => {
			let item = row.toJSON();
			if (item && item.children) {
				item.children = item.children.map(child => {
					if (child) {
						let childDeviceCount = 0;
						if (child.sites) {
							child.sites = child.sites.map(siteItem => {
								if (siteItem) {
									sites.push({
										id: siteItem.id,
										name: 'Site ' + siteCount,
									});
								}
								siteCount++;
								return siteItem;
							});
							child.sites = _.sortBy(child.sites, 'name');
						}
						child.deviceCount = childDeviceCount;
						collections.push({
							name: 'Operational Unit ' + collectionCount,
							id: child.id,
						});
					}
					collectionCount++;
					return child;
				});
				item.children = _.sortBy(item.children, 'name');
			}
			companies.push({
				name: 'Company ' + companyCount,
				id: item.id,
			});

			companyCount++;
			return item;
		});

		companies.forEach(function(companyItem) {
			_promises.push(
				Collection.update(
					{
						name: companyItem.name,
					},
					{
						where: {
							id: companyItem.id,
						},
					},
				),
			);
		});
		collections.forEach(function(collectionItem) {
			_promises.push(
				Collection.update(
					{
						name: collectionItem.name,
					},
					{
						where: {
							id: collectionItem.id,
						},
					},
				),
			);
		});

		sites.forEach(function(siteItem) {
			_promises.push(
				Site.update(
					{
						name: siteItem.name,
					},
					{
						where: {
							id: siteItem.id,
						},
					},
				),
			);
		});

		_promises.push(
			modelInstance.sequelize.queryInterface.sequelize.query(
				`TRUNCATE events.rollup_events, events.rollup_events_daily, events.rollup_events_hourly, events.rollup_events_monthly, events.rollup_events_quarterly, events.rollup_events_weekly, events.rollup_view_stat RESTART IDENTITY;`,
			),
		);

		return await Promise.all(_promises);
	} catch (err) {
		console.log(err);
		return Promise.reject(err);
	}
};

function getColumnAlphabetIndex(val) {
	let base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
		i,
		j,
		result = 0;

	for (i = 0, j = val.length - 1; i < val.length; i += 1, j -= 1) {
		result += Math.pow(base.length, j) * (base.indexOf(val[i]) + 1);
	}

	return result - 1;
}
