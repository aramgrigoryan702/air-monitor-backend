const AWS = require('aws-sdk');
const config = require('../../config');
const PQueue = require('p-queue');
const queue = new PQueue({ concurrency: 1 });

AWS.config.region = 'us-east-1';
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
});
const ses = new AWS.SES();

function _sendMail({ to, body, subject }) {
    return new Promise((resolve, reject) => {
        console.log('to', to);
        let eParams = {
            Destination: {
                ToAddresses: Array.isArray(to) ? to : [to],
            },
            Message: {
                Body: {
                    Text: {
                        Data: body,
                        Charset: 'utf8',
                    },
                    Html: {
                        Data: body,
                        Charset: 'utf8',
                    },
                },
                Subject: {
                    Data: subject,
                },
            },
            Source: config.appEmail,
        };

        ses.sendEmail(eParams, function(err, data) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                console.log('===EMAIL SENT===');
                resolve();
            }
        });
    });
}

function sendEmail({ to, body, subject }) {
    return new Promise((resolve, reject) => {
        queue
            .add(() => _sendMail({ to, body, subject }))
            .then(e => resolve())
            .catch(err => reject(err));
    });
}

module.exports.sendEmail = sendEmail;
