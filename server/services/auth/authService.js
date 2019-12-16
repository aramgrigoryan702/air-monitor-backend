const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;
const AWS = require('aws-sdk');
const request = require('request');
const jwkToPem = require('jwk-to-pem');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const userManagementService = require('../admin/userManagementService');
const userTypes = require('../../types/UserTypes');
const CacheKeys = require('../../types/CacheKeys');
const logService = require('../common/loggerService');
const cryptoService = require('../common/cryptoService');
const redisService = require('../common/redisService');
const QueueManager = require('../../task-queue/QueueManager');
const emailTemplates = require('../../email-templates/emailTemplates');

global.fetch = require('node-fetch');

let storedPems;

const poolData = {
	UserPoolId: process.env.COGNITO_POOL_ID,
	ClientId: process.env.COGNITO_CLIENT_ID,
};

const pool_region = 'us-east-2';

const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

const userRegistrationFieldLists = ['name', 'email', 'custom:userID', ''];

module.exports.registerUser = async function(userData = {}) {
	return new Promise(async (resolve, reject) => {
		if (!userData || !userData.email) {
			return reject({ status: 400, message: 'email address required' });
		}
		let email = userData.email.toString().trim();
		try {
			let existingUser = await userManagementService.findUserByEmail({
				email,
			});
			if (existingUser) {
				return reject({
					status: 400,
					message: `User with email ${email} already exists.`,
				});
			} else {
				const { organization, name, phone } = userData;
				let msgBody = emailTemplates.buildUserSignupRequestReceived({
					email,
					organization,
					name,
					phone,
				});
				await QueueManager.addSendMailTask({
					to: config.alerts.sales_team_email,
					body: msgBody,
					subject: `A user ${email} has requested access to the Project Canary Dashboard.`,
				});
				resolve({
					data: { success: true },
				});
			}
		} catch (err) {
			console.log(err);
			return reject(err);
		}
	});
};

module.exports.acceptInvitation = async function(userData = {}) {
	return new Promise(async (resolve, reject) => {
		let email;
		if (userData.email) {
			email = userData.email.toString().trim();
		}

		const attributeList = [];
		userRegistrationFieldLists.forEach(fieldName => {
			if (userData[fieldName]) {
				attributeList.push(
					new AmazonCognitoIdentity.CognitoUserAttribute({
						Name: fieldName,
						Value: userData[fieldName],
					}),
				);
			}
		});
		let foundUser = await userManagementService.findUserByEmail({
			email: email,
		});

		if (!foundUser) {
			return reject({ status: 400, message: 'Invalid user invitation.' });
		}

		if (foundUser.UserStatus !== 'FORCE_CHANGE_PASSWORD') {
			return reject({
				status: 400,
				message: 'Invalid user invitation.',
			});
		}

		const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(
			{
				Username: email,
				Password: userData.password,
				Attributes: attributeList,
			},
		);
		const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
			Username: email,
			Pool: userPool,
		});
		cognitoUser.authenticateUser(authenticationDetails, {
			onSuccess: function(result, userConfirmationNecessary) {
				if (userConfirmationNecessary === true) {
					reject({
						status: 400,
						message:
							'Please complete the email verification then try login.',
					});
				} else {
					resolve({
						data: {
							id_token: result.getIdToken().getJwtToken(),
							access_token: result.getAccessToken().getJwtToken(),
							refresh_token: result.getRefreshToken().getToken(),
							user_data: result.getIdToken().decodePayload(),
						},
					});
				}
			},
			onFailure: function(err) {
				console.log(err);
				reject({ status: 400, message: err.message });
			},
			newPasswordRequired: async function(
				userAttributes,
				requiredAttributes,
			) {
				//console.log('userAttributes', userAttributes);
				//console.log('requiredAttributes', requiredAttributes);
				userAttributes.name = userData.name;
				// userAttributes.email_verified = 'true';

				cognitoUser.completeNewPasswordChallenge(
					userData.newPassword,
					userAttributes,
					{
						onSuccess: async result => {
							try {
								await userManagementService.confirmUserEmail({
									Username: email,
								});
							} catch (ex) {
								console.log(ex);
							}

							resolve({
								data: {
									id_token: result.getIdToken().getJwtToken(),
									access_token: result
										.getAccessToken()
										.getJwtToken(),
									refresh_token: result
										.getRefreshToken()
										.getToken(),
									user_data: result
										.getIdToken()
										.decodePayload(),
								},
							});
							setImmediate(async () => {
								try {
									await userManagementService.clearAllUserCache();
								} catch (err) {
									console.log(err);
								}
								let mailBody = emailTemplates.buildUserInvitationAccepted(
									{ email },
								);
								QueueManager.addSendMailTask({
									to: config.alerts.management_team_email,
									body: mailBody,
									subject: `${email} has accepted the Project Canary Invitation.`,
								});
							});
						},
						onFailure: ex => {
							console.log(ex);
							reject(ex);
						},
					},
				);
				// reject({ status: 400, message: 'New password required' });
			},
		});
	});
};

module.exports.login = async function(userData = {}) {
	return new Promise(async (resolve, reject) => {
		if (!userData || !userData.email) {
			return reject({ status: 400, message: 'email address required' });
		}

		if (!userData || !userData.password) {
			return reject({ status: 400, message: 'password required' });
		}

		userData.email = userData.email.toString().trim();
		userData.password = userData.password.toString().trim();

		const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(
			{
				Username: userData.email,
				Password: userData.password,
			},
		);
		const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
			Username: userData.email,
			Pool: userPool,
		});
		cognitoUser.authenticateUser(authenticationDetails, {
			onSuccess: function(result, userConfirmationNecessary) {
				if (userConfirmationNecessary === true) {
					setImmediate(() => {
						QueueManager.addSendMailTask({
							to: config.alerts.support_team_email,
							body: `${
								userData.email
							} has failed to signed-in to  the project  canary. Reason ${'User need to confirm email verification first. Then try login.'} ${new Date()}`,
							subject: `${
								userData.email
							} has failed to signed-in to the Project Canary.`,
						});
					});
					reject({
						status: 400,
						message:
							'Please complete the email verification then try login.',
					});
				} else {
					resolve({
						data: {
							id_token: result.getIdToken().getJwtToken(),
							access_token: result.getAccessToken().getJwtToken(),
							refresh_token: result.getRefreshToken().getToken(),
							user_data: result.getIdToken().decodePayload(),
						},
					});
					setImmediate(() => {
						/* console.log(
                            'user data at login',
                            result.getAccessToken().decodePayload(),
                            result.getIdToken().decodePayload(),
                        );*/
						QueueManager.addSendMailTask({
							to: config.alerts.support_team_email,
							body: `${
								userData.email
							} has signed-in to the Project Canary ${new Date()}`,
							subject: `${
								userData.email
							} has signed-in to the Project Canary.`,
						});
					});
				}
			},
			onFailure: function(err) {
				setImmediate(() => {
					QueueManager.addSendMailTask({
						to: config.alerts.support_team_email,
						body: `${
							userData.email
						} has failed to sign-in to the project  canary. Reason ${
							err ? err.message : err
						} ${new Date()}`,
						subject: `${
							userData.email
						} has failed to sign-in to the Project Canary.`,
					});
				});
				if (err.message === 'User is disabled') {
					reject({
						status: 400,
						message: 'Your account is not active',
					});
				} else {
					reject({ status: 400, message: err.message });
				}
			},
			newPasswordRequired: function() {
				setImmediate(() => {
					QueueManager.addSendMailTask({
						to: config.alerts.support_team_email,
						body: `${
							userData.email
						} has failed to sign-in to the project  canary. Reason New password required ${new Date()}`,
						subject: `${
							userData.email
						} has failed to sign-in to the Project Canary.`,
					});
				});
				reject({ status: 400, message: 'New password required' });
			},
		});
	});
};

module.exports.changePassword = async function(
	{ password, newPassword },
	sessionUser,
) {
	return new Promise((resolve, reject) => {
		let email = sessionUser.email;

		const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(
			{
				Username: email,
				Password: password,
			},
		);

		const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
			Username: email,
			Pool: userPool,
		});

		cognitoUser.authenticateUser(authenticationDetails, {
			onFailure: err => {
				console.log(err);
				reject({ status: 400, message: err.message });
			},
			onSuccess: () => {
				cognitoUser.changePassword(
					password,
					newPassword,
					(err, result) => {
						if (err) {
							console.log(err);
							reject({ status: 400, message: err.message });
						} else {
							resolve(result);
						}
					},
				);
			},
		});
	});
};

module.exports.forgotPassword = function({ email }) {
	return new Promise(async (resolve, reject) => {
		try {
			if (email) {
				email = email.toString().trim();
			}
			let foundUser = await userManagementService.findUserByEmail({
				email: email,
			});

			if (!foundUser) {
				return reject({ status: 400, message: 'Account not found' });
			}
			const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
				Username: foundUser.Username,
				Pool: userPool,
			});

			cognitoUser.forgotPassword({
				onSuccess: () => {
					resolve({ success: true });
				},
				onFailure: err => {
					console.log(err);
					reject({ status: 400, message: err.message });
				},
			});
		} catch (ex) {
			console.log(ex);
			reject({ status: 400, message: ex.message });
		}
	});
};

module.exports.confirmPassword = function({
	verificationCode,
	email,
	newPassword,
}) {
	return new Promise(async (resolve, reject) => {
		try {
			if (email) {
				email = email.toString().trim();
			}

			let foundUser = await userManagementService.findUserByEmail({
				email: email,
			});

			if (!foundUser) {
				return reject({ status: 400, message: 'Account not found' });
			}
			const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
				Username: foundUser.Username,
				Pool: userPool,
			});
			cognitoUser.confirmPassword(verificationCode, newPassword, {
				onSuccess: () => {
					module.exports
						.login({ email, password: newPassword })
						.then(result => resolve(result))
						.catch(err => {
							reject({ status: 400, message: err.message });
						});
				},
				onFailure: err => {
					reject({ status: 400, message: err.message });
				},
			});
		} catch (ex) {
			console.log(ex);
			reject({ status: 400, message: ex.message });
		}
	});
};

module.exports.retrieveJwtPermissionFile = async function() {
	return new Promise((resolve, reject) => {
		request(
			{
				url: `https://cognito-idp.${pool_region}.amazonaws.com/${
					poolData.UserPoolId
				}/.well-known/jwks.json`,
				json: true,
			},
			function(error, response, body) {
				if (!error && response.statusCode === 200) {
					let pems = {};
					let keys = body['keys'];
					let len = keys.length;
					for (let i = 0; i < len; i++) {
						//Convert each key to PEM
						let key_id = keys[i].kid;
						let modulus = keys[i].n;
						let exponent = keys[i].e;
						let key_type = keys[i].kty;
						let jwk = { kty: key_type, n: modulus, e: exponent };
						let pem = jwkToPem(jwk);
						pems[key_id] = pem;
					}
					storedPems = pems;
					//validate the token
					resolve(pems);
				} else {
					console.log('Error! Unable to download JWKs', error);
					reject(new Error('Error! Unable to download JWKs'));
				}
			},
		);
	});
};

module.exports.verifyToken = async function(token) {
	return new Promise((resolve, reject) => {
		if (!token) {
			return reject({ status: 400, message: 'token_expired' });
		}
		const decodedJwt = jwt.decode(token, { complete: true });
		if (!decodedJwt) {
			console.log('Not a valid JWT token');
			return reject({ status: 400, message: 'token_expired' });
		}
		let kid = decodedJwt.header.kid;
		let pem = storedPems && storedPems[kid];
		if (!pem) {
			return reject({ status: 400, message: 'token_expired' });
		}
		jwt.verify(token, pem, async function(err, payload) {
			if (err) {
				console.log('Invalid Token.', err);
				/* setImmediate(() => {
                    QueueManager.addSendMailTask({
                        to: config.alerts.dev_ops_email,
                        body: `A REFRESH TOKEN request has been failed to be executed. ${
                            err ? err.message : err
                        } ${new Date()}`,
                        subject: `A REFRESH TOKEN request has been failed to be executed`,
                    });
                });*/
				let msg = err.message;
				if (err.name && err.name === 'TokenExpiredError') {
					msg = 'token_expired';
				}
				reject({ status: 400, message: msg });
			} else {
				try {
					if (payload && payload.email) {
						const isDisabled = 0;
						if (isDisabled) {
							return reject({
								status: 401,
								message: 'access_token_expired',
							});
						}
					}
					if (payload && !payload.groupName) {
						payload.groupName = userTypes.VIEWER;
					}
					if (payload.companyId) {
						payload.companyId = parseInt(payload.companyId);
					}
					resolve(payload);
					/* let _user = await userManagementService.getUser({
                        userName: payload.email,
                    });
                    if (_user && _user.Enabled === true) {
                        resolve(payload);
                    } else {
                        reject({ status: 400, message: 'token_expired' });
                    }*/
				} catch (ex) {
					console.log(ex);
					/*setImmediate(() => {
                        QueueManager.addSendMailTask({
                            to: config.alerts.dev_ops_email,
                            body: `A REFRESH TOKEN request has been failed to be executed. ${
                                ex && ex.message ? ex.message : ex
                            } ${new Date()}`,
                            subject: `A REFRESH TOKEN request has been failed to be executed`,
                        });
                    });*/
					reject(ex);
				}
			}
		});
	});
};

module.exports.refresh_token = async function({ id_token, refresh_token }) {
	return new Promise(async (resolve, reject) => {
		if (!id_token || !refresh_token) {
			return reject({ status: 401, message: 'Invalid parameters' });
		}
		const RefreshToken = new AmazonCognitoIdentity.CognitoRefreshToken({
			RefreshToken: refresh_token,
		});
		const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);
		let decoded = jwt.decode(id_token, { complete: true });
		if (!decoded) {
			return reject({ status: 401, message: 'access_token_expired' });
		}
		if (!decoded.payload) {
			return reject({ status: 401, message: 'access_token_expired' });
		}
		const userData = {
			Username: decoded.payload.email,
			Pool: userPool,
		};

		try {
			/*let _user = await userManagementService.getUser({
				userName: decoded.payload.email,
			});
			if (!_user) {
				return reject({ status: 400, message: 'access_token_expired' });
			}
			if (_user && _user.Enabled !== true) {
				return reject({ status: 400, message: 'access_token_expired' });
			}*/
			const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);
			cognitoUser.refreshSession(RefreshToken, (err, session) => {
				if (err) {
					console.log(err);
					return reject({
						status: 401,
						message: 'access_token_expired',
					});
				} else {
					let retObj = {
						access_token: session.accessToken.jwtToken,
						id_token: session.idToken.jwtToken,
						refresh_token: session.refreshToken.token,
						user_data: session.getIdToken().decodePayload(),
					};
					resolve({ data: retObj });
				}
			});
		} catch (err) {
			console.log(err);
			if (err && err.code === 'UserNotFoundException') {
				return reject({ status: 401, message: 'access_token_expired' });
			} else if (err && err.code === 'UnknownEndpoint') {
				throw err;
				//return reject({ status: 400, message: 'token_expired' });
			} else {
				reject(err);
			}
		}
	});
};
