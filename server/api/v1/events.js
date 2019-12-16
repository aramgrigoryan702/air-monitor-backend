const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const eventService = require('../../services/eventService');

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
	try {
		let params = req.query;
		let results = await eventService.query(params, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.post('/', function(req, res, next) {
	let body = req.body;
	let sessionUser = req.user;
	eventService
		.receive(body, sessionUser)
		.then(results => {
			res.json(results);
		})
		.catch(err => next(err));
});

router.get('/recent', authMiddleware.authenticate, function(req, res, next) {
	let sessionUser = req.user;
	eventService
		.findRecentEvents({}, sessionUser)
		.then(results => {
			res.json(results);
		})
		.catch(err => next(err));
});

module.exports = router;
