const Queue = require('bull');
const _ = require('lodash');
const TaskTypes = require('../types/TaskTypes');
const loggerService = require('../services/common/loggerService');

const ProjectCanaryQueue = new Queue('canary_queue', {
	redis: {
		host: process.env.REDIS_HOST,
		port: process.env.REDIS_PORT,
		family: 4,
		keepAlive: true,
		enableReadyCheck: true,
		removeOnComplete: true,
		removeOnFailure: false,
		//reconnectOnError: 2,
		connectTimeout: 30000,
		retryStrategy: function(times) {
			let delay = Math.min(times * 50, 2000);
			return delay;
		},
	},
});

ProjectCanaryQueue.on('completed', function(job, result) {
	// console.log(job, result);
	console.log(`Job ${job.id} completed! Result: `, job.returnvalue);
	/*ProjectCanaryQueue.getJob(jobId).then(function(job) {
        if (job && _.isFunction(job.remove)) {
            job.remove().catch(err => {
                loggerService.logFatalError(err);
            });
        }
    });*/
});

ProjectCanaryQueue.on('stalled', function(job) {
	console.log(`Job ${job.id} STALLED! Result:`);
	//job.releaseLock();
	if (job && job.id) {
		ProjectCanaryQueue.getJob(job.id)
			.then(function(job) {
				if (job && _.isFunction(job.moveToFailed)) {
					/*console.log(
                        'job.id ',
                        job.id,
                        ' going  to  be move to failed',
                        job,
                    );*/
					return job
						.moveToFailed({ message: 'Retry the job' }, true)
						.then(() => {
							console.log('Moved to the failed successfully');
						})
						.catch(err => {
							loggerService.logFatalError(err);
						});
				} else {
					return false;
				}
			})
			.catch(err => {
				loggerService.logFatalError(err);
			});
	}
});

ProjectCanaryQueue.on('error', function(job, err) {
	if (err && err.message && err.message.contains('Missing lock')) {
		console.log('Missing lock Found!', job);
	}
	loggerService.logFatalError(err);
	//console.log(`Job ${job.id} returned  error! Result: ${err}`);
});

ProjectCanaryQueue.on('failed', function(job, err) {
	console.log(`Job ${job.id} Failed! Result: `, err);
	loggerService.logFatalError(err);
	//job.
	//  throw new Error(err)
	//job.re();
});

let cronJobInitialized = false;

module.exports.startListeningCronJobs = async function() {
	if (!cronJobInitialized) {
		//at  first  hour '1 0 * * *'/ '15 3 * * *'every day at 3:15 (am)/ check for http://cronexpressiondescriptor.azurewebsites.net
		//0 30 10-13 ? * WED,FRI   == At 30 minutes past the hour, between 10:00 AM and 01:59 PM, only on Wednesday and Friday

		await ProjectCanaryQueue.add(
			//'SYNC_INACTIVE_DEVICE_HEALTH',
			{ type: TaskTypes.SYNC_INACTIVE_DEVICE_HEALTH },
			{
				priority: 20,
				jobId: 'SYNC_INACTIVE_DEVICE_HEALTH',
				repeat: {
					cron: `3 * * * *`,
				},
			},
		);

		await ProjectCanaryQueue.add(
			//'REFRESH_DEVICE_VIEW_ALL',
			{ type: TaskTypes.REFRESH_DEVICE_VIEW_ALL },
			{
				priority: 24,
				jobId: 'REFRESH_DEVICE_VIEW_ALL',
				repeat: {
					cron: '1,16,31,46 * * * *',
				},
			},
		);

		await ProjectCanaryQueue.add(
			//'REFRESH_DEVICE_VIEW',
			{
				type: TaskTypes.REFRESH_DEVICE_VIEW,
			},
			{
				priority: 30,
				id: 'REFRESH_DEVICE_VIEW',
				jobId: 'REFRESH_DEVICE_VIEW',
				repeat: {
					every: 1000 * 60 * 2,
					//cron: '1,6,11,16,21,26,31,36,41,46,51,56 5-23 * * *',
				},
			},
		);

		/*await ProjectCanaryQueue.add(
            //'REFRESH_DEVICE_VIEW',
            {
                type: TaskTypes.REFRESH_DEVICE_VIEW_MONTHLY,
            },
            {
                priority: 30,
                id: 'REFRESH_DEVICE_VIEW_MONTHLY',
                jobId: 'REFRESH_DEVICE_VIEW_MONTHLY',
                timeout: 1000 * 60 * 10,
                repeat: {
                    //every: 1000 * 60 * 2,
                    cron: '1 5 * * *',
                },
            },
        );*/

		await ProjectCanaryQueue.add(
			//'REFRESH_DEVICE_VIEW',
			{
				type: TaskTypes.REFRESH_DEVICE_SUCCESS_RATE,
			},
			{
				priority: 10,
				id: 'REFRESH_DEVICE_SUCCESS_RATE',
				jobId: 'REFRESH_DEVICE_SUCCESS_RATE',
				timeout: 1000 * 60 * 10,
				repeat: {
					//every: 1000 * 60 * 2,
					cron: '0 * * * *',
				},
			},
		);

		cronJobInitialized = true;
	} else {
		loggerService.log('Cronjob  all ready  started');
	}
};

module.exports.addSendMailTask = async function(data) {
	try {
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.SEND_MAIL, payload: { ...data } },
			{ priority: 5, attempts: 25, removeOnComplete: true },
		);
	} catch (err) {
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addSendDevMailTask = async function(data) {
	try {
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.SEND_DEV_MAIL, payload: { ...data } },
			{ priority: 55, attempts: 2, removeOnComplete: true },
		);
	} catch (err) {
		console.log(err);
		//loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addSendAlertMailTask = async function(data) {
	try {
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.SEND_ALERT_MAIL, payload: { ...data } },
			{ priority: 60, attempts: 20, removeOnComplete: true },
		);
	} catch (err) {
		console.log(err);
		//loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addProcessAlertTask = async function(data) {
	try {
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.PROCESS_ALERT, payload: { ...data } },
			{ priority: 55, attempts: 20, removeOnComplete: true },
		);
	} catch (err) {
		console.log(err);
		//loggerService.logFatalError(err);
		return err;
	}
};

module.exports.checkEventAlertTask = async function(data) {
	try {
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.CHECK_EVENT_FOR_ALERT, payload: { ...data } },
			{ priority: 45, attempts: 20, removeOnComplete: true },
		);
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.checkEventWebhookTask = async function(data) {
	try {
		console.log('checkEventWebhookTask', data);
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.CHECK_EVENT_FOR_WEBHOOK, payload: { ...data } },
			{ priority: 55, attempts: 20, removeOnComplete: true },
		);
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addProcessEventWebhookTask = async function(data) {
	try {
		return ProjectCanaryQueue.add(
			{ type: TaskTypes.PROCESS_EVENT_WEBHOOK, payload: { ...data } },
			{ priority: 60, attempts: 20, removeOnComplete: true },
		);
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addUpdateLatestEventTask = async function(data) {
	try {
		await ProjectCanaryQueue.add(
			{ type: TaskTypes.UPDATE_LATEST_EVENT, payload: { ...data } },
			{ priority: 1, attempts: 50, removeOnComplete: true },
		);
		return true;
	} catch (err) {
		loggerService.logFatalError(err);
		return Promise.reject(err);
	}
};

module.exports.addDeviceSyncTask = async function(data) {
	try {
		await ProjectCanaryQueue.add(
			{ type: TaskTypes.SYNC_DEVICE, payload: { ...data } },
			{ priority: 10, attempts: 30, removeOnComplete: true },
		);
		return true;
	} catch (err) {
		//console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addDeviceHealthSyncTask = async function(data) {
	try {
		await ProjectCanaryQueue.add(
			{ type: TaskTypes.SYNC_DEVICE_HEALTH, payload: { ...data } },
			{ priority: 2, attempts: 30, removeOnComplete: true },
		);
		return true;
	} catch (err) {
		//console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addDeviceBearingAndDistanceSyncTask = async function(data) {
	try {
		await ProjectCanaryQueue.add(
			{
				type: TaskTypes.SYNC_DEVICE_BEARING_DISTANCE,
				payload: { ...data },
			},
			{ priority: 2, attempts: 30, removeOnComplete: true },
		);
		return true;
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addStagingDbSyncTask = async function() {
	try {
		let result = await ProjectCanaryQueue.add(
			{
				type: TaskTypes.SYNC_STAGING_DB,
				payload: {},
			},
			{ priority: 1, attempts: 5, removeOnComplete: true },
		);
		return result;
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addEventUploadToS3Task = async function(data) {
	try {
		let result = await ProjectCanaryQueue.add(
			{
				type: TaskTypes.UPLOAD_EVENT_PAYLOAD_2S3,
				payload: { ...data },
			},
			{ priority: 70, delay: 1500, attempts: 5, removeOnComplete: true },
		);
		return result;
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addDeviceDataUploadToS3Task = async function(data) {
	try {
		let result = await ProjectCanaryQueue.add(
			{
				type: TaskTypes.UPLOAD_DEVICE_PAYLOAD_2S3,
				payload: { ...data },
			},
			{ priority: 75, delay: 1500, attempts: 5, removeOnComplete: true },
		);
		return result;
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.addDbBackupTask = async function() {
	try {
		let result = await ProjectCanaryQueue.add(
			{
				type: TaskTypes.DB_BACKUP,
				payload: {},
			},
			{ priority: 1, attempts: 5, removeOnComplete: true },
		);
		return result;
	} catch (err) {
		console.log(err);
		loggerService.logFatalError(err);
		return err;
	}
};

module.exports.process = function(...arg) {
	return ProjectCanaryQueue.process.bind(ProjectCanaryQueue, arg);
};

module.exports.getQueue = function() {
	return ProjectCanaryQueue;
};

module.exports.graceFullShutdown = function() {
	return new Promise((resolve, reject) => {
		ProjectCanaryQueue.close().then(
			function() {
				console.log('Worker Manager shutdown gracefully.');
				resolve();
			},
			function(err) {
				console.log(
					'Worker Manager closed with error "' + err.message + '".',
				);
				reject(err);
			},
		);
	});
};

/*
process.once('SIGINT', function () {

});*/
