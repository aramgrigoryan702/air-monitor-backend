const authService = require('../services/auth/authService');
const userTypes = require('../types/UserTypes');

module.exports.authenticate = function(req, res, next) {
	console.log(req.headers.authorization);
	if (
		req.headers.authorization &&
		req.headers.authorization.split(' ')[0] === 'Bearer'
	) {
		const splittedHeader = req.headers.authorization.split(' ');
		if (splittedHeader.length > 1) {
			let token = splittedHeader[1];
			authService
				.verifyToken(token)
				.then(user => {
					// let expireTime = new Date(user.exp * 1000);
					req.user = user;
					next();
				})
				.catch(err => {
					next(err);
				});
		} else {
			next({ message: 'Unathorized', status: 401 });
		}
	} else {
		next({ message: 'Unathorized', status: 401 });
	}
};

module.exports.authenticateAsAdminUser = function(req, res, next) {
	if (
		req.headers.authorization &&
		req.headers.authorization.split(' ')[0] === 'Bearer'
	) {
		const splittedHeader = req.headers.authorization.split(' ');
		if (splittedHeader.length > 1) {
			let token = splittedHeader[1];
			authService
				.verifyToken(token)
				.then(user => {
					// let expireTime = new Date(user.exp * 1000);
					if (user && user.groupName === userTypes.ADMIN) {
						req.user = user;
						next();
					} else {
						next({ message: 'Unathorized', status: 401 });
					}
				})
				.catch(err => {
					next(err);
				});
		} else {
			next({ message: 'Unathorized', status: 401 });
		}
	} else {
		next({ message: 'Unathorized', status: 401 });
	}
};

module.exports.authenticateAsEditorUser = function(req, res, next) {
	if (
		req.headers.authorization &&
		req.headers.authorization.split(' ')[0] === 'Bearer'
	) {
		const splittedHeader = req.headers.authorization.split(' ');
		if (splittedHeader.length > 1) {
			let token = splittedHeader[1];
			authService
				.verifyToken(token)
				.then(user => {
					// let expireTime = new Date(user.exp * 1000);
					if (user && user.groupName === userTypes.EDITOR) {
						req.user = user;
						next();
					} else {
						next({ message: 'Unathorized', status: 401 });
					}
				})
				.catch(err => {
					next(err);
				});
		} else {
			next({ message: 'Unathorized', status: 401 });
		}
	} else {
		next({ message: 'Unathorized', status: 401 });
	}
};

module.exports.authenticateAsViewerUser = function(req, res, next) {
	if (
		req.headers.authorization &&
		req.headers.authorization.split(' ')[0] === 'Bearer'
	) {
		const splittedHeader = req.headers.authorization.split(' ');
		if (splittedHeader.length > 1) {
			let token = splittedHeader[1];
			authService
				.verifyToken(token)
				.then(user => {
					// let expireTime = new Date(user.exp * 1000);
					if (user && user.groupName === userTypes.VIEWER) {
						req.user = user;
						next();
					} else {
						next({ message: 'Unathorized', status: 401 });
					}
				})
				.catch(err => {
					next(err);
				});
		} else {
			next({ message: 'Unathorized', status: 401 });
		}
	} else {
		next({ message: 'Unathorized', status: 401 });
	}
};
