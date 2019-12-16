const adminTools = require('../../services/admin/adminTools');

class SYNC_STAGING_DB {
    constructor(data = {}) {
        this.data = { ...data };
    }
    async process() {
        try {
            let resp = await adminTools.refreshStagingDB();
            return resp;
        } catch (err) {
            return Promise.reject(err);
        }
    }
}

module.exports = SYNC_STAGING_DB;
