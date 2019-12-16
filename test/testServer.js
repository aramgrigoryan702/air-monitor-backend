/* eslint-disable no-process-exit */
process.env.NODE_ENV = 'test';
const jsonfile = require('jsonfile');
const _ = require('lodash');
const path = require('path');
let domainLookups = jsonfile.readFileSync(
    path.join(__dirname, './data/domain_lookups.json'),
);

let lookups = jsonfile.readFileSync(
    path.join(__dirname, './data/lookups.json'),
);
domainLookups = _.sortBy(domainLookups, 'id');
lookups = _.sortBy(lookups, 'id');
console.log('lookups', lookups);
require('dotenv').config({ path: '.env.test' });

module.exports.startServer = function() {
    return new Promise((resolve, reject) => {
        process.env.NODE_ENV = 'test';
        process.env.port = '8000';
        let app = require('./../app');
        app.set('port', process.env.port);
        const port = process.env.port;
        console.log('port', port);
        const http = require('http');
        const server = http.createServer(app);
        const dbModels = require('./../server/models');

        server.on('error', error => {
            if (error.syscall !== 'listen') {
                throw error;
            }
            const bind =
                typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

            // handle specific listen errors with friendly messages
            switch (error.code) {
                case 'EACCES':
                    console.error(bind + ' requires elevated privileges');
                    process.exit(1);
                case 'EADDRINUSE':
                    console.error(bind + ' is already in use');
                    process.exit(1);
                default:
                    console.log(error);
                    throw error;
            }
        });

        // await module.exports.refreshSequences();
        //  await module.exports.executeBaseLineSqls();

        server.on('listening', () => {
            const addr = server.address();
            const bind =
                typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
            console.log('Listening on ' + bind);

            let pgEvents = dbModels.pgEvents;
            pgEvents.once('ready', () => {
                setTimeout(() => {
                    // const defaultData = require('../server/util/defaultDataUtil');
                    dbModels.sequelize
                        .drop({ cascade: true, force: true })
                        .then(() => {
                            return dbModels.enableRequiredExtensions();
                        })
                        .then(() => {
                            return dbModels.createSchema();
                        })
                        .then(() => {
                            return dbModels.authenticate();
                        })
                        .then(() => {
                            return dbModels.syncDB();
                        })
                        .then(async () => {
                            let LookupModel = dbModels.Lookup;
                            let DomainLookupModel = dbModels.DomainLookup;
                            domainLookups.forEach(async dLookup => {
                                dLookup.id = undefined;
                                await DomainLookupModel.create(dLookup);
                            });
                            lookups.forEach(async dLookup => {
                                dLookup.id = undefined;
                                await LookupModel.create(dLookup);
                            });
                            return true;
                        })
                        .then(() => {
                            resolve(server);
                        });
                }, 3000);
            });
        });
        server.listen(port);
    });
};
