const config = require('../../config');
const QueueManager = require('../../task-queue/QueueManager');
module.exports.log = function(err) {
    console.log('Logger service', err);
};

module.exports.logFatalError = async function(err = {}, req = {}, status) {
    try {
        if (process.env.NODE_ENV === 'production') {
            if (
                (req.query && Object.keys(req.query).length > 0) ||
                (req.body && Object.keys(req.body).length > 0)
            ) {
                await QueueManager.addSendDevMailTask({
                    to: config.alerts.dev_ops_email,
                    body: `Error occurred!
                Status: ${status} 
                ${err.getStack ? err.getStack() : JSON.stringify(err)}  <br/>
        Req.Body was ${req.body ? JSON.stringify(req.body) : ''} query was ${
                        req.query ? JSON.stringify(req.query) : ''
                    } 
         <br/><br/> 
         Regards,<br/>
         @devTeam `,
                    subject: `Error at project canary api ${
                        process.env.BASE_URL
                    }`,
                });
            }
        }
        console.log('Error found', err);
    } catch (ex) {
        console.log(ex);
    }
};
