const express = require('express');
const router = express.Router();
const companyService = require('../../services/companyService');
const authMiddleware = require('../../middlewares/authMiddleware');

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
	try {
		let params = req.params;
		let results = await companyService.query(params, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

/***
 * Get Request /
 */

router.get('/list', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let params = req.params;
		let results = await companyService.list(params, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

module.exports = router;
