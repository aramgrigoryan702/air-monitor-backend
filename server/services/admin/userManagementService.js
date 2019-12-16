require('dotenv').config('./.env');
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;
const AWS = require('aws-sdk');
const request = require('request');
const util = require('util');
const jwkToPem = require('jwk-to-pem');
const jwt = require('jsonwebtoken');
const uuidv4 = require('uuid/v4');
global.fetch = require('node-fetch');
const config = require('../../config');
const emailTemplate = require('../../email-templates/emailTemplates');
const QueueManager = require('../../task-queue/QueueManager');
const redisService = require('../common/redisService');
const userTypes = require('../../types/UserTypes');
const CacheKeys = require('../../types/CacheKeys');
const cryptoService = require('../common/cryptoService');
AWS.config.region = process.env.AWS_REGION;
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_KEY,
});

AWS.config.apiVersions = {
	cognitosync: '2014-06-30',
	// other service API versions
};

let storedPems;

const poolData = {
	UserPoolId: process.env.COGNITO_POOL_ID,
	ClientId: process.env.COGNITO_CLIENT_ID,
};

const pool_region = 'us-east-2';

var cognitoIdentity = new AWS.CognitoIdentity();
let cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

function fetchUsersFromCognito({ paginationToken }) {
	return new Promise(async (resolve, reject) => {
		let params = {
			UserPoolId: process.env.COGNITO_POOL_ID,
		};
		if (paginationToken) {
			params.PaginationToken = paginationToken;
		}
		cognitoidentityserviceprovider
			.listUsers(params)
			.promise()
			.then(data => {
				let users = data.Users;
				let PaginationToken = data.PaginationToken;
				if (PaginationToken) {
					return fetchUsersFromCognito({
						paginationToken: PaginationToken,
					}).then(newUsers => {
						if (newUsers && Array.isArray(newUsers)) {
							return [...users, ...newUsers];
						} else {
							return users;
						}
					});
				} else {
					return users;
				}
			})
			.then(function(users) {
				resolve(users);
			})
			.catch(err => {
				reject(err);
			});
	});
}


function fetchUsersInGroupFromCognito({ paginationToken, groupName }) {
	return new Promise(async (resolve, reject) => {
		let params = {
			UserPoolId: process.env.COGNITO_POOL_ID,
		};
		if (groupName) {
			params.GroupName = groupName;
		}
		if (paginationToken) {
			params.PaginationToken = paginationToken;
		}
		cognitoidentityserviceprovider
			.listUsersInGroup(params)
			.promise()
			.then(data => {
				let users = data.Users;
				let PaginationToken = data.PaginationToken;
				if (PaginationToken) {
					return fetchUsersInGroupFromCognito({
						paginationToken: PaginationToken,
						groupName: groupName,
					}).then(newUsers => {
						if (newUsers && Array.isArray(newUsers)) {
							return [...users, ...newUsers];
						} else {
							return users;
						}
					});
				} else {
					return users;
				}
			})
			.then(function(users) {
				resolve(users);
			})
			.catch(err => {
				reject(err);
			});
	});
}


module.exports.getUserList = async function() {
	try {
		let userList;
		/*try {
			let multiReaderClient = await redisService.getMultiReaderClient();
			multiReaderClient.smembers(CacheKeys.ALL_USER_LIST);
			let emails = await multiReaderClient.execAsync();
			if (emails && emails.length > 0) {
				emails.map(item => {
					multiReaderClient.hgetall(item);
				});
				userList = await multiReaderClient.execBatchAsync();
			}
		} catch (ex) {
			console.log(ex);
			//lets ignore this and going to fetch direct
		}*/
		if (userList) {
			return { data: userList };
		} else {
			userList = await fetchUsersFromCognito({});
			return { data: userList };
			/*if (userList) {
				try {
					let multiWriterClient = await redisService.getMultiWriterClient();
					if (multiWriterClient) {
						multiWriterClient.sadd(
							CacheKeys.ALL_USER_LIST,
							userList.map(item => {
								return item.email;
							}),
						);
						userList.map(item => {
							const hKeyName = `user:${item.email}`;
							Object.keys(item).forEach(keyName => {
								multiWriterClient.hmset(
									hKeyName,
									keyName,
									JSON.stringify(item[keyName]),
								);
							});
						});
						await multiWriterClient.execAsync();
					}

					//await redisService.set(CacheKeys.ALL_USER_LIST, userList);
				} catch (ex) {
					console.log(ex);
					//lets ignore this and return the user list
				}
			}*/
		}
	} catch (err) {
		return Promise.reject(err);
	}
};

module.exports.listUsersInAdminGroup = async function() {
	try {
		let userList;
		//= await redisService.get('all_user_list_in_admin_group');
		if (userList) {
			return { data: userList };
		} else {
			userList = await fetchUsersInGroupFromCognito({ groupName: 'ADMIN' });
			return { data: userList };
		}
	} catch (err) {
		return Promise.reject(err);
	}
};

module.exports.listUsersInEditorGroup = async function() {
	try {
		let userList = await redisService.get('all_user_list_in_editor_group');
		if (userList) {
			return { data: userList };
		} else {
			userList = await fetchUsersInGroupFromCognito({
				groupName: userTypes.EDITOR,
			});
			return { data: userList };
		}
	} catch (err) {
		return Promise.reject(err);
	}
};

module.exports.listUsersInViewerGroup = async function() {
	try {
		let userList;
		//= await redisService.get('all_user_list_in_viewer_group');
		if (userList) {
			return { data: userList };
		} else {
			userList = await fetchUsersInGroupFromCognito({
				groupName: userTypes.VIEWER,
			});
			return { data: userList };
		}
	} catch (err) {
		return Promise.reject(err);
	}
};

module.exports.moveUserToAdminGroup = async function(params = {}) {
	let _params = {
		//  DatasetName: 'test',
		UserPoolId: process.env.COGNITO_POOL_ID,
		GroupName: userTypes.ADMIN,
		Username: params.Username,
		// ClientId: process.env.COGNITO_CLIENT_ID,
	};
	let Attributes = params.Attributes || params.UserAttributes || [];
	Attributes = Attributes.filter(item => item.Name !== 'sub');
	const hasCompanyId = Attributes.find(
		item => item.Name !== 'custom:companyId',
	);
	if (!hasCompanyId && params.companyId) {
		Attributes.push({
			Name: 'custom:companyId',
			Value: params.companyId,
		});
	}

	return cognitoidentityserviceprovider
		.adminAddUserToGroup(_params)
		.promise()
		.then(() => {
			return Promise.all([
				cognitoidentityserviceprovider
					.adminUpdateUserAttributes({
						UserPoolId: process.env.COGNITO_POOL_ID,
						Username: params.Username,
						UserAttributes: Attributes,
					})
					.promise(),
				module.exports.removeUserFromEditorGroup(params),
				module.exports.removeUserFromViewerGroup(params),
			]);
		})
		.then(() => {
			return module.exports.clearAllUserCache();
		});
};

module.exports.moveUserToEditorGroup = async function(params = {}) {
	let _params = {
		//  DatasetName: 'test',
		UserPoolId: process.env.COGNITO_POOL_ID,
		GroupName: userTypes.EDITOR,
		Username: params.Username,
		// ClientId: process.env.COGNITO_CLIENT_ID,
	};
	let Attributes = params.Attributes || params.UserAttributes || [];
	Attributes = Attributes.filter(item => item.Name !== 'sub');
	const hasCompanyId = Attributes.find(
		item => item.Name !== 'custom:companyId',
	);
	if (!hasCompanyId && params.companyId) {
		Attributes.push({
			Name: 'custom:companyId',
			Value: params.companyId,
		});
	}
	return cognitoidentityserviceprovider
		.adminAddUserToGroup(_params)
		.promise()
		.then(() => {
			return Promise.all([
				cognitoidentityserviceprovider
					.adminUpdateUserAttributes({
						UserPoolId: process.env.COGNITO_POOL_ID,
						Username: params.Username,
						UserAttributes: Attributes,
					})
					.promise(),
				module.exports.removeUserFromAdminGroup(params),
				module.exports.removeUserFromViewerGroup(params),
			]);
		})
		.then(() => {
			return module.exports.clearAllUserCache();
		});
};

module.exports.moveUserToViewerGroup = async function(params = {}) {
	let _params = {
		//  DatasetName: 'test',
		UserPoolId: process.env.COGNITO_POOL_ID,
		GroupName: userTypes.VIEWER,
		Username: params.Username,
		// ClientId: process.env.COGNITO_CLIENT_ID,
	};
	// console.log('params', params);
	let Attributes = params.Attributes || params.UserAttributes || [];
	Attributes = Attributes.filter(item => item.Name !== 'sub');
	const hasCompanyId = Attributes.find(
		item => item.Name !== 'custom:companyId',
	);
	if (!hasCompanyId && params.companyId) {
		Attributes.push({
			Name: 'custom:companyId',
			Value: params.companyId,
		});
	}
	return cognitoidentityserviceprovider
		.adminAddUserToGroup(_params)
		.promise()
		.then(() => {
			return Promise.all([
				cognitoidentityserviceprovider
					.adminUpdateUserAttributes({
						UserPoolId: process.env.COGNITO_POOL_ID,
						Username: params.Username,
						UserAttributes: Attributes,
					})
					.promise(),
				module.exports.removeUserFromAdminGroup(params),
				module.exports.removeUserFromEditorGroup(params),
			]);
		})
		.then(() => {
			return module.exports.clearAllUserCache();
		});
};

module.exports.removeUserFromAdminGroup = async function(params = {}) {
	let _params = {
		//  DatasetName: 'test',
		UserPoolId: process.env.COGNITO_POOL_ID,
		GroupName: userTypes.ADMIN,
		Username: params.Username,
		// ClientId: process.env.COGNITO_CLIENT_ID,
	};

	return cognitoidentityserviceprovider
		.adminRemoveUserFromGroup(_params)
		.promise();
};

module.exports.removeUserFromEditorGroup = async function(params = {}) {
	let _params = {
		UserPoolId: process.env.COGNITO_POOL_ID,
		GroupName: userTypes.EDITOR,
		Username: params.Username,
	};
	return cognitoidentityserviceprovider
		.adminRemoveUserFromGroup(_params)
		.promise();
};

module.exports.removeUserFromViewerGroup = async function(params = {}) {
	let _params = {
		UserPoolId: process.env.COGNITO_POOL_ID,
		GroupName: userTypes.VIEWER,
		Username: params.Username,
	};
	return cognitoidentityserviceprovider
		.adminRemoveUserFromGroup(_params)
		.promise();
};

module.exports.enableUser = async function(params = {}, sessionUser) {
	return new Promise(async (resolve, reject) => {
		let _params = {
			UserPoolId: process.env.COGNITO_POOL_ID,
			Username: params.Username,
		};
		cognitoidentityserviceprovider.adminEnableUser(
			_params,
			async (err, data) => {
				if (err) {
					console.log(err);
					reject(err);
				} else {
					await module.exports.clearAllUserCache();
					setImmediate(async () => {
						try {
							let fuser = await module.exports.getUser({
								userName: params.Username,
							});

							if (
								fuser &&
								fuser.UserAttributes &&
								Array.isArray(fuser.UserAttributes)
							) {
								fuser.UserAttributes.map(item => {
									if (item) {
										fuser[item.Name] = item.Value;
									}
								});
								if (fuser.email) {
									await redisService.srem(
										CacheKeys.DISABLED_USER,
										fuser.email,
									);
								}
								QueueManager.addSendMailTask({
									to: config.alerts.support_team_email,
									body: `${fuser.email} ${
										fuser.name
											? ' ( ' + fuser.name + "'s ) "
											: ''
									} Project Canary Account has been enabled by ${
										sessionUser.email
									} ${new Date()}`,
									subject: `${fuser.email} (${
										fuser.name
									})'s Project Canary Account has been enabled.`,
								});
							}
						} catch (error) {
							console.log(error);
						}
					});
					resolve({ data: data.Users });
				}
			},
		);
	});
};

module.exports.disableUser = async function(params = {}, sessionUser) {
	return new Promise(async (resolve, reject) => {
		let _params = {
			UserPoolId: process.env.COGNITO_POOL_ID,
			Username: params.Username,
		};
		cognitoidentityserviceprovider.adminDisableUser(
			_params,
			async (err, data) => {
				if (err) {
					console.log(err);
					reject(err);
				} else {
					cognitoidentityserviceprovider.adminUserGlobalSignOut(
						{
							UserPoolId: process.env.COGNITO_POOL_ID,
							Username: params.Username,
						},
						function(ex) {
							console.log(ex);
						},
					);

					setImmediate(async () => {
						try {
							await module.exports.clearAllUserCache();
							let fuser = await module.exports.getUser({
								userName: params.Username,
							});

							if (
								fuser &&
								fuser.UserAttributes &&
								Array.isArray(fuser.UserAttributes)
							) {
								fuser.UserAttributes.map(item => {
									if (item) {
										fuser[item.Name] = item.Value;
									}
								});
								if (fuser.email) {
									await redisService.sadd(
										CacheKeys.DISABLED_USER,
										fuser.email,
									);
								}
								QueueManager.addSendMailTask({
									to: config.alerts.support_team_email,
									body: `${fuser.email} ${
										fuser.name
											? ' ( ' + fuser.name + " 's "
											: ''
									} Project Canary Account has been disabled by ${
										sessionUser.email
									} ${new Date()}`,
									subject: `${
										fuser.email
									}'s Project Canary Account has been disabled.`,
								});
							}
						} catch (error) {
							setImmediate(() => {
								QueueManager.addSendMailTask({
									to: config.alerts.support_team_email,
									body: `${
										params.Username
									}'s Project Canary Account has been disabled by ${
										sessionUser.email
									} ${new Date()}`,
									subject: `${
										params.Username
									}'s Project Canary Account has been disabled.`,
								});
							});
						}
					});
					resolve({ data: data.Users });
				}
			},
		);
	});
};

module.exports.deleteUser = async function(params = {}, sessionUser) {
	return new Promise(async (resolve, reject) => {
		let _params = {
			//  DatasetName: 'test',
			UserPoolId: process.env.COGNITO_POOL_ID,
			Username: params.Username,
			// ClientId: process.env.COGNITO_CLIENT_ID,
		};
		let fuser;

		try {
			fuser = await module.exports.getUser({
				userName: params.Username,
			});
		} catch (error) {
			console.log(error);
		}

		cognitoidentityserviceprovider.adminUserGlobalSignOut(
			{
				UserPoolId: process.env.COGNITO_POOL_ID,
				Username: params.Username,
			},
			function(ex) {
				console.log(ex);
			},
		);

		cognitoidentityserviceprovider.adminDeleteUser(
			_params,
			async (err, data) => {
				if (err) {
					console.log(err);
					reject(err);
				} else {
					setImmediate(async () => {
						if (
							fuser &&
							fuser.UserAttributes &&
							Array.isArray(fuser.UserAttributes)
						) {
							fuser.UserAttributes.map(item => {
								if (item) {
									fuser[item.Name] = item.Value;
								}
							});
							if (fuser.email) {
								await redisService.sadd(
									CacheKeys.DISABLED_USER,
									fuser.email,
								);
							}
							QueueManager.addSendMailTask({
								to: config.alerts.support_team_email,
								body: `${fuser.email} ${
									fuser.name
										? ' ( ' + fuser.name + "'s ) "
										: ''
								} Project Canary Account has been removed by ${
									sessionUser.email
								} ${new Date()}`,
								subject: `${fuser.email} (${
									fuser.name
								})'s Project Canary Account has been removed.`,
							});
						}
					});
					//  console.log('data', data);
					await module.exports.clearAllUserCache();
					resolve({ success: true });
				}
			},
		);
	});
};

module.exports.inviteUser = async function(params = {}, sessionUser) {
	return new Promise(async (resolve, reject) => {
		if (!params.email) {
			return reject({ status: 400, message: 'Invalid parameter' });
		}

		if (!params.groupName) {
			return reject({ status: 400, message: 'Invalid parameter' });
		}

		if (!params.companyId) {
			return reject({ status: 400, message: 'Invalid parameter' });
		}

		let email = params.email;
		let groupName = params.groupName;
		let companyId = params.companyId;

		email = email.toString().trim();

		let existingUser = await module.exports.findUserByEmail({
			email: email,
		});
		if (existingUser) {
			setImmediate(() => {
				QueueManager.addSendMailTask({
					to: config.alerts.support_team_email,
					body: `${email} has been failed to be invited to the Project Canary. Reason ${'USER already  exists!'} ${new Date()}`,
					subject: `${email} has failed to be invited to the Project Canary.`,
				});
			});
			return reject({ status: 400, message: 'User already exists' });
		}

		const tempPassword = cryptoService.generateRandomString(8);
		let _params = {
			//  DatasetName: 'test',
			UserPoolId: process.env.COGNITO_POOL_ID,
			Username: email,
			TemporaryPassword: tempPassword,
			MessageAction: 'SUPPRESS',
			UserAttributes: [
				{
					Name: 'email',
					Value: email,
				},
				{
					Name: 'custom:companyId',
					Value: companyId,
				},
			],
			// ClientId: process.env.COGNITO_CLIENT_ID,
		};

		cognitoidentityserviceprovider.adminCreateUser(
			_params,
			async (err, data) => {
				try {
					if (err) {
						console.log(err);
						setImmediate(() => {
							QueueManager.addSendMailTask({
								to: config.alerts.support_team_email,
								body: `${email} has been failed to be Invited to the Project Canary. Reason ${
									err ? err.message : err
								} ${new Date()}`,
								subject: `${email} has failed to be Invited to the Project Canary.`,
							});
						});
						reject(err);
					} else {
						// console.log('user invitation', data);
						await QueueManager.addSendMailTask({
							to: email,
							body: emailTemplate.buildUserInvitationMessage(
								_params,
							),
							subject: `Invitation to join Project Canary`,
						});
						//console.log('emailResp', emailResp);
						switch (groupName) {
							case userTypes.ADMIN:
								await module.exports.moveUserToAdminGroup({
									Username: data.User.Username,
									Attributes: _params.UserAttributes,
								});
								break;
							case userTypes.EDITOR:
								await module.exports.moveUserToEditorGroup({
									Username: data.User.Username,
									Attributes: _params.UserAttributes,
								});
								break;
							default:
								await module.exports.moveUserToViewerGroup({
									Username: data.User.Username,
									Attributes: _params.UserAttributes,
								});
								break;
						}
						await module.exports.clearAllUserCache();
						if (email) {
							await redisService.srem(
								CacheKeys.DISABLED_USER,
								email,
							);
						}
						setImmediate(() => {
							QueueManager.addSendMailTask({
								to: config.alerts.support_team_email,
								body: `${email} has been successfully Invited to the Project Canary. Invitation sent  by ${
									sessionUser.email
								} ${new Date()}`,
								subject: `${email} has been successfully Invited to the Project Canary.`,
							});
						});
						resolve({ data: data.Users });
					}
				} catch (error) {
					console.log(error);
					setImmediate(() => {
						QueueManager.addSendMailTask({
							to: config.alerts.support_team_email,
							body: `${email} has been failed to be Invited to the Project Canary. Reason ${
								error ? error.message : error
							} ${new Date()}`,
							subject: `${email} has been failed to be Invited to the Project Canary.`,
						});
					});
					reject(err);
				}
			},
		);
	});
};

module.exports.submitJoinRequest = async function(params = {}) {
	return new Promise(async (resolve, reject) => {
		let email = params.email;
		email = email.toString().trim();

		let existingUser = await module.exports.findUserByEmail({
			email: email,
		});
		if (existingUser) {
			return reject({ status: 400, message: 'User already exists' });
		}

		cognitoidentityserviceprovider.adminInitiateAuth(
			{
				UserPoolId: process.env.COGNITO_POOL_ID,
				ClientId: process.env.COGNITO_CLIENT_ID,
				AuthFlow: 'USER_PASSWORD_AUTH',
				AuthParameters: {
					Username: email,
					Password: params.password,
				},
			},
			(err, data) => {
				if (err) {
					console.log(err);
					reject(err);
				} else {
					console.log(data);
					resolve(data);
				}
			},
		);
	});
};

module.exports.findUserByEmail = async function(params = {}) {
	return new Promise((resolve, reject) => {
		const _params = {
			UserPoolId: process.env.COGNITO_POOL_ID,
			Filter: `email = \"${params.email.toString().trim()}\"`,
			Limit: 1,
		};
		cognitoidentityserviceprovider.listUsers(_params, (err, data) => {
			if (err) {
				console.log(err);
				reject(err);
			} else {
				if (data && data.Users && data.Users.length > 0) {
					resolve(data.Users[0]);
				} else {
					resolve(false);
				}
			}
		});
	});
};

module.exports.confirmUserEmail = async function(userData) {
	const _params = {
		UserPoolId: process.env.COGNITO_POOL_ID,
		Username: userData.Username,
		UserAttributes: [
			{
				Name: 'email_verified',
				Value: 'true',
			},
		],
	};
	return await cognitoidentityserviceprovider
		.adminUpdateUserAttributes(_params)
		.promise();
};

module.exports.adminInitiateAuth = async function({ userName }) {
	const _params = {
		UserPoolId: process.env.COGNITO_POOL_ID,
		Username: userName,
	};
	return await cognitoidentityserviceprovider
		.adminInitiateAuth(_params)
		.promise();
};

module.exports.getUser = async function({ userName }) {
	const _params = {
		UserPoolId: process.env.COGNITO_POOL_ID,
		Username: userName,
	};
	return await cognitoidentityserviceprovider.adminGetUser(_params).promise();
};

module.exports.clearAllUserCache = async function(params = {}) {
	return redisService
		.deleteByKeys([
			CacheKeys.ALL_USER_LIST,
			CacheKeys.ALL_USER_LIST_IN_VIEWER_GROUP,
			CacheKeys.ALL_USER_LIST_IN_ADMIN_GROUP,
			CacheKeys.ALL_USER_LIST_IN_EDITOR_GROUP,
		])
		.catch(err => {
			console.log('error while clearing all user cache', err);
			return true;
		});
};
