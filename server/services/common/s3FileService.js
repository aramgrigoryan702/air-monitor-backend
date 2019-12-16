const AWS = require('aws-sdk');
const config = require('../../config');
const fs = require('fs');
const util = require('util');
const mime = require('mime-types');
const zlib = require('zlib');
const path = require('path');
const s3Stream = require('s3-upload-stream')(new AWS.S3());
AWS.config.region = process.env.AWS_REGION;
AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY,
	secretAccessKey: process.env.AWS_SECRET_KEY,
});

const s3 = new AWS.S3();

module.exports.uploadFile = async function(filePath, { key, bucketName }) {
	return new Promise((resolve, reject) => {
		try {
			if (!key) {
				key = path.basename(filePath);
			}
			let read = fs.createReadStream(filePath);
			let compress = zlib.createGzip();
			let upload = s3Stream.upload({
				Bucket: bucketName,
				Key: key,
			});
			upload.maxPartSize(20971520); // 20 MB
			upload.concurrentParts(5);
			upload.on('uploaded', function(details) {
				console.log(details);
				console.log('Upload db backup file done');
				resolve(details);
			});
			upload.on('part', function(details) {
				console.log('uploaded part', details);
			});

			upload.on('error', function(error) {
				console.log(error);
				reject(error);
			});

			read.pipe(compress).pipe(upload);
		} catch (err) {
			reject(err);
		}
	});
};

module.exports.uploadJsonData = async function(data, { key, bucketName }) {
	try {
		let result = await s3
			.putObject({
				Bucket: bucketName,
				Key: key.toString() + '.json',
				Body: JSON.stringify(data, null, 4),
				ContentType: 'application/json',
			})
			.promise();
		return result;
	} catch (err) {
		console.log(err);
		return Promise.reject(err);
	}
};

module.exports.getFileStream = function(fileName, bucketName) {
	let params = { Bucket: bucketName, Key: fileName };
	return s3.getObject(params).createReadStream();
};

module.exports.getFileUrl = function(fileName, bucketName) {
	let params = { Bucket: bucketName, Key: fileName, Expires: 600 };
	let url = s3.getSignedUrl('getObject', params);
	return url;
};
