const jose = require('node-jose');
const debug = require('debug');
const fse = require('fs-extra');
const crypto = require('crypto');
const lodash = require('lodash');
const loggerService = require('./loggerService');
const chars = '123456789abcdefghijklmnopqrstuvwxyz'.toUpperCase();

let publicKey, privateKey;

/**
 * Generete a crypto keystore and return
 */
module.exports.generateNewKeyPair = async function() {
    try {
        const keystore = jose.JWK.createKeyStore();
        await keystore.generate('RSA', 2008, {
            kid: process.env.EncryptionKeyID,
        });
        return keystore;
    } catch (ex) {
        debug(ex);
        return ex;
    }
};

/**
 *
 * @param {string} directoryPath
 * @returns {Promise} {publicKey, privateKey}
 */
module.exports.ensureAdminAppKeyPair = async function(
    directoryPath = __dirname + '/../../.ssh',
) {
    try {
        await fse.ensureDir(directoryPath);
        const publicFilePath = directoryPath + '/public.pem';
        const privateFilePath = directoryPath + '/private.pem';
        let keystore, encryptionKey;
        if (
            !fse.pathExistsSync(publicFilePath) ||
            !fse.pathExistsSync(privateFilePath)
        ) {
            keystore = await module.exports.generateNewKeyPair();
            encryptionKey = keystore.get(process.env.EncryptionKeyID);
            privateKey = encryptionKey;
            publicKey = encryptionKey.toJSON();
            fse.outputFileSync(publicFilePath, encryptionKey.toPEM());
            fse.outputFileSync(privateFilePath, encryptionKey.toPEM(true));
            loggerService.log('permission files generated');
        } else {
            let privateFileContent = fse.readFileSync(privateFilePath, 'utf-8');
            let publicFileContent = fse.readFileSync(publicFilePath, 'utf-8');
            publicKey = await jose.JWK.asKey(publicFileContent, 'pem');
            privateKey = await jose.JWK.asKey(privateFileContent, 'pem');
        }
        return {
            publicKey: publicKey,
            privateKey: privateKey,
        };
    } catch (ex) {
        console.log(ex);
        return ex;
    }
};

/**
 * Encrypt data using private or public key
 * @param content
 * @returns {Promise}
 */
module.exports.encrypt = function(content) {
    return new Promise((resolve, reject) => {
        const str = JSON.stringify(content);
        const options = {
            zip: true,
            format: 'compact',
            contentAlg: 'A128CBC-HS256',
        };
        jose.JWE.createEncrypt(options, publicKey)
            .update(str)
            .final()
            .then(encryptedText => resolve(encryptedText))
            .catch(err => {
                loggerService.log(err);
                reject('INVALID_PARAMS');
            });
    });
};

/***
 * Decrypt text using private key
 * @param encryptedText
 * @returns {*}
 */
module.exports.decrypt = function(encryptedText) {
    return new Promise((resolve, reject) => {
        jose.JWE.createDecrypt(privateKey)
            .decrypt(encryptedText)
            .then(result => {
                return JSON.parse(result.plaintext.toString('utf-8'));
            })
            .then(result => {
                resolve(result);
            })
            .catch(err => {
                loggerService.log(err);
                reject('INVALID_PARAMS');
            });
    });
};

/**
 * Get the server admin public key to the client end
 */
module.exports.getPublicKey = async function() {
    if (publicKey) {
        return await Promise.resolve(publicKey);
    } else {
        await module.exports.ensureAdminAppKeyPair();
    }
    return publicKey;
};

/**
 * Get the server admin private key to sign in contents
 */
module.exports.getPrivateKey = async function() {
    if (privateKey) {
        return await Promise.resolve(privateKey);
    } else {
        await module.exports.ensureAdminAppKeyPair();
    }
    return privateKey;
};

module.exports.getPrivateKeyAsPEM = async function() {
    if (privateKey) {
        return await Promise.resolve(privateKey.toPEM(true));
    } else {
        await module.exports.ensureAdminAppKeyPair();
    }
    return privateKey.toPEM(true);
};

/***
 * Encrypting using pbkdf2 algo. Its lots of faster than bcrypt (we are handling brute force attack by ourself just want to get the task fast)
 * @param password
 * @returns {Promise}
 */
module.exports.encryptPassword = function(password, salt) {
    if (!salt) {
        salt = module.exports.generateRandomInteger(4);
    }
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(
            password,
            process.env.EncryptionKeySalt,
            salt,
            512,
            'sha512',
            (err, derivedKey) => {
                if (err) return reject(err);
                resolve({
                    encryptedPassword: derivedKey.toString('hex'),
                    salt,
                });
            },
        );
    });
};

module.exports.generateRandomString = function(length) {
    let rnd = crypto.randomBytes(length),
        value = new Array(length),
        len = Math.min(256, chars.length),
        d = 256 / len;

    for (let i = 0; i < length; i++) {
        value[i] = chars[Math.floor(rnd[i] / d)];
    }

    return value.join('');
};
