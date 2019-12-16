/* eslint-disable no-process-exit */

const morgan = require('morgan');
const util = require('util');
const stackTrace = require('stack-trace');
const loggerService = require('../services/common/loggerService');

module.exports.init = function(app) {
	app.use(errorLoggerMiddleware);
};

function handleError(err = {}) {
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
		console.log(err);
		process.exit(1);
	} else if (['SequelizeUniqueConstraintError'].indexOf(err.name) > -1) {
		err.status = 400;
		if (err.errors && err.errors.length > 0) {
			let tmsg = err.errors.map(item => item.path).join(', ');
			err.message = ['found non-unique values for:', tmsg].join(' ');
		}
	} else if (['SequelizeValidationError'].indexOf(err.name) > -1) {
		err.status = 400;
		if (err.errors && err.errors.length > 0) {
			let tmsg = err.errors.map(item => item.path).join(', ');
			err.message = ['found invalid params:', tmsg].join(' ');
		}
	} else if (['SequelizeOptimisticLockError'].indexOf(err.name) > -1) {
		err.status = 400;
		if (err.errors && err.errors.length > 0) {
			err.message = 'VERSION_MITCH_MATCH_ERROR';
		}
	} else if (['SequelizeForeignKeyConstraintError'].indexOf(err.name) > -1) {
		err.status = 400;
		err.message = 'ASSOCIATED_OBJECT_NOT_FOUND';
		if (err.errors && err.errors.length > 0) {
			err.message = [
				'invalid value:',
				...err.errors.map(item => item.detail),
			].join(' ');
		} else if (err.original && err.original.detail) {
			err.message = ['invalid value:', err.original.detail].join(' ');
		}
	}
	return err;
}

function errorLoggerMiddleware(err, req, res, next) {
	if (err) {
		//let trace = stackTrace.parse(err);

		//console.error(trace);
		if (err.name) {
			err = handleError(err);
		}
		// render the error page
		let status = 500;
		let errorMsg = 'An error occurred on server';

		if (err.status && err.status >= 400 && err.status < 500) {
			status = err.status;
			if (err.message) {
				if (err.message.search('ENOTFOUND') > -1) {
					errorMsg =
						'Unable to process the request. Please try again after few minute.';
				} else {
					errorMsg = err.message;
				}
			}
		}

		if (err.getStack) {
			console.log(err.getStack());
		} else {
			console.log(err);
		}

		if (status && (status !== 400 && status !== 401)) {
			setImmediate(() => {
				loggerService.logFatalError(err, req, status);
			});
		}
		console.log('***Error at: Global Error Handler', errorMsg);
		if (req.body) {
			console.log('req.body was ');
			console.log(req.body);
		}

		if (req.query) {
			console.log('req.query was ', req.query);
		}
		let errorObj = { message: errorMsg };
		if (err.code) {
			errorObj.code = err.code;
		}
		res.status(status).json(errorObj);
	} else {
		next(err);
	}
}
