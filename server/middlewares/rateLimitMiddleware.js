const rateLimit = require('express-rate-limit');
const redisRateLimitStore = require('rate-limit-redis');
const config = require('../config');
const redisService = require('../services/common/redisService');

// initiate api rate limiter
const authRateLimiter = new rateLimit({
	windowMs: config.authorization.auth_rate_limit_window_duration,
	max: config.authorization.auth_rate_limit_max_requests,
	statusCode: 429,
	keyGenerator: function(req /*, res*/) {
		return (
			req.body || req.ip // unknown??
		);
	},
	store: new redisRateLimitStore({
		client: redisService.createRateLimiterClient(),
	}),
});

// initiate api rate limiter
const defaultRateLimiter = new rateLimit({
	windowMs: config.authorization.rate_limit_window_duration,
	max: config.authorization.rate_limit_max_requests,
	statusCode: 429,
	keyGenerator: function(req /*, res*/) {
		return req.ip;
	},
	store: new redisRateLimitStore({
		client: redisService.createRateLimiterClient(),
	}),
});

module.exports.defaultRateLimiter = defaultRateLimiter;
module.exports.authRateLimiter = authRateLimiter;
