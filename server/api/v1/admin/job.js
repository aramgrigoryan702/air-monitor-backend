const express = require('express');
const router = express.Router();
const authMiddleware = require('../../../middlewares/authMiddleware');
const QueueManager = require('../../../task-queue/QueueManager');

router.get('/:id', authMiddleware.authenticateAsAdminUser, async function(req, res, next) {
    try {
        let id = req.params.id;
        let workQueue = QueueManager.getQueue();
        let job = await workQueue.getJob(id);
        if (job === null) {
            res.status(404).end();
        } else {
            let state = await job.getState();
            let progress = job._progress;
            let reason = job.failedReason;
            res.json({ id, state, progress, reason });
        }
    } catch (ex) {
        console.log(ex);
        next({ status: 400, message: ex.message });
    }
});

module.exports = router;
