const express = require('express');
const router = express.Router();
const alertConfigService = require('../../services/alertConfigService');
const authMiddleware = require('../../middlewares/authMiddleware');

/***
 * Get Request /
 */

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let params = req.query;
        let results = await alertConfigService.query(params, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

/***
 * Get Request to  find  a single request
 */
router.get('/:id', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let id = req.params.id;
        let results = await alertConfigService.findOne(id, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

/***
 * Post Request to insert a single record
 */
router.post('/', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let body = req.body;
        let results = await alertConfigService.create(body, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

/***
 * Get Request to  find  a single request
 */
router.put('/:id', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let id = req.params.id;
        let body = req.body;
        body.id = id;
        let results = await alertConfigService.update(body, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

/***
 * Delete Request to remove a single record  /id
 */
router.delete('/:id', authMiddleware.authenticate, async function(
    req,
    res,
    next,
) {
    try {
        let id = req.params.id;
        let results = await alertConfigService.delete(id, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
