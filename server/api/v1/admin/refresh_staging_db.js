const express = require('express');
const router = express.Router();
const authMiddleware = require('../../../middlewares/authMiddleware');
const QueueManager = require('../../../task-queue/QueueManager');

router.post('/refresh', authMiddleware.authenticateAsAdminUser, async function(
    req,
    res,
    next,
) {
    try {
        let results = await QueueManager.addStagingDbSyncTask();
        res.json(results);
    } catch (ex) {
        next(ex);
    }
});

module.exports = router;
