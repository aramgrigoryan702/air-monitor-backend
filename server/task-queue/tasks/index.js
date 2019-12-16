const fs = require('fs');
const path = require('path');
const basename = path.basename(__filename);
let taskClasses = {};
fs.readdirSync(__dirname)
    .filter(file => {
        return (
            file.indexOf('.') !== 0 &&
            file !== basename &&
            file.slice(-3) === '.js'
        );
    })
    .forEach(file => {
        taskClasses[file.slice(0, -3)] = require(path.join(__dirname, file));
    });

module.exports.getTaskClassByType = function(taskType) {
    let taskInstane = taskClasses[taskType];
    if (!taskInstane) {
        throw new Error(taskType + ' task handler was not  found');
    }
    return taskInstane;
};
