const express = require('express');
const JSONStream = require('JSONStream');
const router = express.Router();
const deviceEventService = require('../../services/deviceEventService');
const authMiddleware = require('../../middlewares/authMiddleware');

/***
 * Get Request /
 */

router.get('/:id', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let id = req.params.id;
        let params = { id: id, ...req.query };
        let results = await deviceEventService.query(params, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

/***
 * Get Request /
 */

router.get('/:id/stream', authMiddleware.authenticate, async function(
    req,
    res,
    next,
) {
    try {
        let id = req.params.id;
        let params = { id: id, ...req.query };
        let stream = await deviceEventService.queryStream(params, req.user);
        stream.pipe(JSONStream.stringify()).pipe(res);
    } catch (ex) {
        next(ex);
    }
});
module.exports = router;
