var glob = require('glob');
const path = require('path');
const _ = require('lodash');

let availableApiMap = {};
const api_base_uri = '/api/v1/';
let currPath = path.resolve(__dirname + '/..' + api_base_uri);

/****
 * At first we are pre caching  all  the api files so that in the init method  the router  setup  goes smooth
 */
let apiFiles = glob.sync('/**/*.js', { matchBase: true, root: currPath });
for (let file of apiFiles) {
    availableApiMap[file] = require(file);
}

/**
 *
 * Initiate Routes derived from api
 * @param app
 */
module.exports.init = function(app) {
    apiFiles.map(file => {
        let parsedFile = path.parse(file);
        let basePath = parsedFile.dir.replace(currPath, '');
        let isAuthRoute = false;
        if (parsedFile.name.toLowerCase().startsWith('authorization')) {
            isAuthRoute = true;
        }
        let routeName = `${api_base_uri}${basePath}/${parsedFile.name}`;
        routeName = routeName.replace('//', '/');
        if (!availableApiMap[file] || !_.isFunction(availableApiMap[file])) {
            console.log('route not valid', file);
        }
        app.use(
            routeName,
            //isAuthRoute ? authRateLimiter : defaultRateLimiter,
            availableApiMap[file],
        );
    });
};
