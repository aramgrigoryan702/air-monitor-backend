const express = require('express');
const JSONStream = require('JSONStream');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const deviceSuccessRateService = require('../../services/deviceSuccessRateService');

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let params = req.query;
        let results = await deviceSuccessRateService.query(params, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

router.get('/latest', authMiddleware.authenticate, async function(
    req,
    res,
    next,
) {
    try {
        let params = req.query;
        let results = await deviceSuccessRateService.getLatestDeviceSuccessRate(
            params,
            req.user,
        );
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

router.get('/24hour_ago', authMiddleware.authenticate, async function(
    req,
    res,
    next,
) {
    try {
        let params = req.query;
        let results = await deviceSuccessRateService.getDeviceSuccessRateOf24HourAgo(
            params,
            req.user,
        );
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
