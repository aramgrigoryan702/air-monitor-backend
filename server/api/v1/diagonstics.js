const express = require('express');
const router = express.Router();
const diagonsticService = require('../../services/diagonsticService');


router.post('/', function(req, res, next) {
    let body = req.body;
    let sessionUser = req.user;
    diagonsticService
        .receive(body, sessionUser)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

module.exports = router;
