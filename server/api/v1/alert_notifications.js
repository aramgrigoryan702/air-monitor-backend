const express = require('express');
const router = express.Router();
const alertNotificationService = require('../../services/alertNotificationService');
const authMiddleware = require('../../middlewares/authMiddleware');

/***
 * Get Request /
 */

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
    try {
        let params = req.query;
        let results = await alertNotificationService.query(params, req.user);
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
