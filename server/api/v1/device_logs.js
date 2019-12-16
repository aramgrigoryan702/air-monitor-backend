const express = require('express');
const router = express.Router();
const deviceLogsService = require('../../services/deviceLogsService');

router.post('/', function(req, res, next) {
	let body = req.body;
	let sessionUser = req.user;
	deviceLogsService
		.receive(body, sessionUser)
		.then(results => {
			res.json(results);
		})
		.catch(err => next(err));
});

router.post('/activities', function(req, res, next) {
	let body = req.body;
	console.log('Data received as device_logs/activities');
	console.log(body);
	deviceLogsService
		.receiveActivity(body)
		.then(results => {
			res.json(results);
		})
		.catch(err => next(err));
});

module.exports = router;
