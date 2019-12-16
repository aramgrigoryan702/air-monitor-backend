const express = require('express');
const router = express.Router();
const siteService = require('../../services/siteService');
const authMiddleware = require('../../middlewares/authMiddleware');

/***
 * Get Request /
 */

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
	try {
		let params = req.query;
		let results = await siteService.query(params, req.user);
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
		let results = await siteService.findOne(id, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.get(
	'/list/byOperationalUnit',
	authMiddleware.authenticate,
	async function(req, res, next) {
		try {
			let results = await siteService.findSitesByOperationalUnit(
				req.query,
				req.user,
			);
			res.json(results);
		} catch (ex) {
			next(ex);
		}
	},
);

router.get('/list/byCompany', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let results = await siteService.findSitesByCompany(req.query, req.user);
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
		let results = await siteService.create(body, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

/***
 * Put Request to update a single record  /id {...body}
 */
router.put('/:id', authMiddleware.authenticate, async function(req, res, next) {
	try {
		let body = req.body;
		let id = req.params.id;
		body.id = id;
		let results = await siteService.update(body, req.user);
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
		let results = await siteService.delete(id, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

module.exports = router;
