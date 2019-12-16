const userTypes = require('../../types/UserTypes');
const ErrorMessageTypes = require('../../error-messages/ErrorMessageTypes');

module.exports.checkPermission = async function(sessionUser, data, {}) {
	try {
	} catch (err) {
		console.log(err);
		return Promise.reject({ status: 400, message: err.message });
	}
};

module.exports.findCompanyIdOfSessionUser = async function(sessionUser) {
	try {
		if (sessionUser && sessionUser.groupName !== userTypes.ADMIN) {
			if (!sessionUser.companyId) {
				throw new Error({ ...ErrorMessageTypes.PERMISSION_DENIED });
			}
			return sessionUser.companyId;
		} else {
			return undefined;
		}
	} catch (err) {
		console.log(err);
		return Promise.reject({ status: 400, message: err.message });
	}
};
