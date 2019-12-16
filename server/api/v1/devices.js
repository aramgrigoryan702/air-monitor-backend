const express = require('express');
const router = express.Router();
const deviceService = require('../../services/deviceService');
const authMiddleware = require('../../middlewares/authMiddleware');

/***
 * Get Request /
 */

router.get('/', authMiddleware.authenticate, async function(req, res, next) {
	try {
		let params = req.query;
		let results = await deviceService.query(params, req.user);
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
		let results = await deviceService.findOne(id, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.get(
	'/findUnassignedDevice/count',
	authMiddleware.authenticate,
	async function(req, res, next) {
		try {
			let results = await deviceService.findUnassignedDeviceCount(
				req.user,
			);
			res.json(results);
		} catch (ex) {
			next(ex);
		}
	},
);

router.get('/availableTypes/lists', authMiddleware.authenticate, async function(
	req,
	res,
	next,
) {
	try {
		let params = req.query;
		let results = await deviceService.listAvailableDeviceTypes(
			params,
			req.user,
		);
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
		let results = await deviceService.create(body, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.post('/receive', function(req, res, next) {
	let body = req.body;
	let sessionUser = req.user;
	deviceService
		.receive(body, sessionUser)
		.then(results => {
			res.json(results);
		})
		.catch(err => next(err));
});

/***
 * Put Request to update a single record  /id {...body}
 */
router.put('/:id', authMiddleware.authenticateAsAdminUser, async function(
	req,
	res,
	next,
) {
	try {
		let body = req.body;
		let id = req.params.id;
		body.id = id;
		let results = await deviceService.update(body, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

router.put(
	'/:id/updateSiteId',
	authMiddleware.authenticateAsAdminUser,
	async function(req, res, next) {
		try {
			let body = req.body;
			let id = req.params.id;
			body.id = id;
			let results = await deviceService.updateSiteId(body, req.user);
			res.json(results);
		} catch (ex) {
			next(ex);
		}
	},
);

router.put(
	'/:id/updateLocation',
	authMiddleware.authenticateAsAdminUser,
	async function(req, res, next) {
		try {
			let body = req.body;
			let id = req.params.id;
			body.id = id;
			let results = await deviceService.updateLocation(
				id,
				body,
				req.user,
			);
			res.json(results);
		} catch (ex) {
			next(ex);
		}
	},
);

router.put(
	'/:id/unlockDeviceLocation',
	authMiddleware.authenticateAsAdminUser,
	async function(req, res, next) {
		try {
			let id = req.params.id;
			let results = await deviceService.unlockDeviceLocation(
				id,
				req.user,
			);
			res.json(results);
		} catch (ex) {
			next(ex);
		}
	},
);

/***
 * Delete Request to remove a single record  /id
 */
router.delete('/:id', authMiddleware.authenticateAsAdminUser, async function(
	req,
	res,
	next,
) {
	try {
		let id = req.params.id;
		let results = await deviceService.delete(id, req.user);
		res.json(results);
	} catch (ex) {
		next(ex);
	}
});

module.exports = router;
