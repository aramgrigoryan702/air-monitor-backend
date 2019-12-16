const QueueManager = require('./QueueManager');
const tasksFactory = require('./tasks');
const loggerService = require('../services/common/loggerService');

module.exports.startQueueWorker = function() {
	let queue = QueueManager.getQueue();
	console.log('worker started');
	queue.process(5, async function(job, done) {
		//console.log('received job  at worker', job);
		try {
			const { type, payload } = job.data;
			let taskClass = tasksFactory.getTaskClassByType(type);
			if (taskClass) {
				try {
					let taskInstance = new taskClass(payload);
					let processedResult = await taskInstance.process();
					done(null, processedResult);
				} catch (err) {
					console.log(err);
					loggerService.logFatalError(err);
					done(err);
				}
			} else {
				loggerService.logFatalError({
					message: ` A JOB task type was not deinfed in the system ${JSON.stringify(
						job,
					)}`,
				});
				done(null); // intentionally returning  success as this should  be  development  time issue. All the tasks  must have  their associative classes.
			}
		} catch (ex) {
			loggerService.logFatalError(ex);
			console.log(job);
			done(null);
		}
	});
};

module.exports.graceFullShutdown = function() {
	return new Promise((resolve, reject) => {
		let queue = QueueManager.getQueue();
		queue.close().then(
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
