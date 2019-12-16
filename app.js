/* eslint-disable no-process-exit */
let isTest = process.env.NODE_ENV === 'test';
if (isTest) {
	require('dotenv').config({ path: '.env.test' });
} else {
	require('dotenv').config();
}
const config = require('./server/config');
const loggerService = require('./server/services/common/loggerService');
const cryptoService = require('./server/services/common/cryptoService');
const authService = require('./server/services/auth/authService');
const errorLoggerMiddleware = require('./server/middlewares/errorLogger');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const util = require('util');
const compression = require('compression');
const dbModels = require('./server/models');
const pgPoolService = require('./server/services/common/pgPoolService');
const redisService = require('./server/services/common/redisService');
const routeManager = require('./server/middlewares/routeManager');
const cors = require('cors');
const stackTrace = require('stack-trace');
//require('./server/passport-strategies/');
const QueueWorker = require('./server/task-queue/QueueWorker');
const QueueManager = require('./server/task-queue/QueueManager');

// setup Redis
redisService.initiate(true).catch(err => {
	console.log('Error while connecting with redis', err);
});

const app = express();

dbModels
	.authenticate()
	.then(() => {
		dbModels.syncDB();
	})
	.then(() => {
		console.log('Database ready. Mode = ', process.env.mode || 'server');
		if (process.env.mode && process.env.mode === 'worker') {
			QueueWorker.startQueueWorker();
		} else {
			QueueManager.startListeningCronJobs();
		}
	})
	.catch(err => {
		console.log('Database connection failed', err);
	});

// define the express app

app.use(morgan('dev'));
// for the APIs
app.use(cors());

app.enable('trust proxy');
//app.disable('etag');

app.use(compression());
//Accept-Encoding
app.use(
	helmet({
		frameguard: false,
		hidePoweredBy: true,
		noSniff: false,
		xssFilter: false,
		referrerPolicy: false,
	}),
);

app.use(
	express.json({ limit: '1mb', type: 'application/json', extended: true }),
);

app.use(
	express.urlencoded({
		limit: '5mb',
		type: 'application/x-www-form-urlencoded',
		extended: true,
	}),
);

routeManager.init(app);
errorLoggerMiddleware.init(app);

authService
	.retrieveJwtPermissionFile(() => {
		console.log('Pems inititated');
		// bootstrap all api routes
	})
	.catch(err => {
		console.log(err);
		process.exit(1);
	});

app.get('*', function(req, res) {
	res.status(404);
	if (req.xhr) {
		res.json({ message: 'Requested resource does not exists!' });
	} else {
		res.send('Requested URL does not exists!');
	}
});

/*// Used to generate crypto keys for JWT
cryptoService.ensureAdminAppKeyPair().then(() => {
    console.log('Admin permission file ensured!');
    console.log('Running in ', process.env.NODE_ENV, 'mode');
    console.log(
        'Started at ',
        new Date().toISOString(),
        '  BDT at ',
        new Date().toLocaleTimeString('bd'),
    );
});*/

module.exports = app;

process.on('uncaughtException', async function(err) {
	console.log('Caught exception: ');
	let trace = stackTrace.parse(err);
	console.log(util.inspect(trace));
	if (err.getStack) {
		console.log(err.getStack());
	} else {
		console.log(err);
	}
	/*if (process.env.mode && process.env.mode === 'worker') {
        try {
            await QueueWorker.graceFullShutdown();
        } catch (err) {
            console.log(err);
        }
    } else {
        try {
            await QueueManager.graceFullShutdown();
        } catch (err) {
            console.log(err);
        }
    }
    try {
        await dbModels.graceFullShutdown();
    } catch (err) {
        console.log(err);
    }
    try {
        await redisService.graceFullShutdown();
    } catch (err) {
        console.log(err);
    }*/
	process.exit(1);
});

process.on('unhandledRejection', function(err) {
	console.log('Caught unhandledRejection: ');
	let trace = stackTrace.parse(err);
	console.log(util.inspect(trace, true, 20, 'red'));
	if (err.getStack) {
		console.log(err.getStack());
	} else {
		console.log('unhandledRejection: ', err);
	}
	console.log(err);
	// process.exit(1);
});

const sigs = ['SIGINT', 'SIGTERM', 'SIGQUIT'];

process.on('SIGTERM', handleKillSignal);

process.on('SIGINT', handleKillSignal);

process.on('SIGQUIT', handleKillSignal);
/*sigs.forEach(function(sig) {

});*/

async function handleKillSignal() {
	console.log('Stopping the server for ', process.exitCode, '  command');
	//console.dir(app);
	setTimeout(() => {
		process.exit(0);
	}, 8000);
	if (global.serverInstance) {
		//console.dir(global.serverInstance);
		await util.promisify(global.serverInstance.close);
		console.log('App Server Closed');
	}
	if (process.env.mode && process.env.mode === 'worker') {
		try {
			await QueueWorker.graceFullShutdown();
		} catch (err) {
			console.log(err);
		}
	}
	try {
		await QueueManager.graceFullShutdown();
	} catch (err) {
		console.log(err);
	}

	try {
		await redisService.graceFullShutdown();
	} catch (err) {
		console.log(err);
	}

	try {
		await dbModels.graceFullShutdown();
	} catch (err) {
		console.log(err);
	}
	try {
		await pgPoolService.graceFullShutdown();
	} catch (err) {
		console.log(err);
	}
	process.exit(0);
}
