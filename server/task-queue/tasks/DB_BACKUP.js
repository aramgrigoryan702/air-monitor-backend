const adminTools = require('../../services/admin/adminTools');

class DB_BACKUP {
    constructor(data = {}) {
        this.data = { ...data };
    }
    async process() {
        try {
            let resp = await adminTools.backupDBIntoS3();
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = DB_BACKUP;
