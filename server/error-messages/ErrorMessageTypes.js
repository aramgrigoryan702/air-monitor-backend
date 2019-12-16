const messages = {
	COMPANY_NOT_FOUND: {
		status: 400,
		message: 'Company data not available',
	},
	OPERATIONAL_UNIT_NOT_FOUND: {
		status: 400,
		message: 'Unit data not available',
	},
	SITE_NOT_FOUND: {
		status: 400,
		message: 'Site data not available',
	},
	DEVICE_NOT_FOUND: {
		status: 400,
		message: 'Device data not available',
	},
	PERMISSION_DENIED: {
		status: 401,
		message: 'Permission Denied',
	},
	UNAUTHORIZED: {
		status: 401,
		message: 'Unauthorized access',
	},
};

Object.keys(messages).forEach(keyName => {
	messages[keyName].code = keyName;
	if (!messages[keyName].message) {
		messages[keyName].message = keyName;
	}
});

module.exports = messages;
