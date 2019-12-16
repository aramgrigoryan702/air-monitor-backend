const express = require('express');
const router = express.Router();
const authService = require('../../services/auth/authService');
const authMiddleware = require('../../middlewares/authMiddleware');

router.post('/signup', function(req, res, next) {
    let body = req.body;
    authService
        .registerUser(body)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

router.post('/signin', function(req, res, next) {
    let body = req.body;
    authService
        .login(body)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

router.post('/acceptInvitation', function(req, res, next) {
    let body = req.body;
    authService
        .acceptInvitation(body)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

router.post('/change_password', authMiddleware.authenticate, function(
    req,
    res,
    next,
) {
    let body = req.body;
    authService
        .changePassword(body, req.user)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

router.post('/forgot_password', function(req, res, next) {
    let body = req.body;
    authService
        .forgotPassword(body)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

router.post('/confirm_password', function(req, res, next) {
    let body = req.body;
    authService
        .confirmPassword(body)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

router.get('/test_auth', authMiddleware.authenticate, function(req, res, next) {
    res.json({ data: req.user });
});

router.get('/ping', authMiddleware.authenticate, function(req, res, next) {
    res.json({ data: { success: true } });
});

router.post('/refresh_token', function(req, res, next) {
    let body = req.body;
    authService
        .refresh_token(body)
        .then(results => {
            res.json(results);
        })
        .catch(err => next(err));
});

module.exports = router;
