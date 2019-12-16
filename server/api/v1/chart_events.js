const express = require('express');
const JSONStream = require('JSONStream');
const oppressor = require('oppressor');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const chartEventService = require('../../services/chartEventService');

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
	try {
		let params = req.query;
		let results = await chartEventService.query(params, req.user);
		res.json(results);
		res.on('end', () => {
			setImmediate(() => {
				results = undefined;
			});
		});
	} catch (ex) {
		next(ex);
	}
});

router.get('/getFirstEventDate', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let params = req.query;
		let results = await chartEventService.getFirstEventDate(
			params,
			req.user,
		);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.get('/stream', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let params = req.query;
		let stream = await chartEventService.queryStream(params, req.user);
		stream.pipe(JSONStream.stringify()).pipe(res);
		req.on('close', stream.end.bind(stream));
	} catch (ex) {
		next(ex);
	}
});

router.get('/hourly', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let params = req.query;
		let results = await chartEventService.queryHourlyData(params, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.get('/group_chart_data', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let params = req.query;
		let results = await chartEventService.queryGroupChartData(
			params,
			req.user,
		);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

module.exports = router;
