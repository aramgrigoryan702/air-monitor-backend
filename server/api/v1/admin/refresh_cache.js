const express = require('express');
const router = express.Router();
const authMiddleware = require('../../../middlewares/authMiddleware');
const adminTools = require('../../../services/admin/adminTools');

router.post(
    '/refresh_chart_views',
    authMiddleware.authenticateAsAdminUser,
    async function(req, res, next) {
        try {
            let results = await adminTools.refreshViews();
            res.json(results);
        } catch (ex) {
            next(ex);
        }
    },
);

module.exports = router;
