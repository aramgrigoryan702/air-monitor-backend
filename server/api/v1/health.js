const express = require('express');
const router = express.Router();
const redisService = require('../../services/common/redisService');
const modelInstance = require('../../models/index');

router.get('/', async function(req, res, next) {
    try {
        /* let _promises = [];
        _promises.push(redisService.ping());
        _promises.push(modelInstance.ping());
        await Promise.all(_promises);*/
        res.status(200);
        res.send('ok');
    } catch (ex) {
        // console.log(ex);
        res.status(500);
        res.end();
    }
});

module.exports = router;
