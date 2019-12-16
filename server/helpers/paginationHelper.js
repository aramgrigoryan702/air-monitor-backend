const config = require('../config');

module.exports.buildPaginatedData = function(data, baseUrl) {
    if (typeof data.limit === 'undefined') {
        data.limit = config.system.page_size;
    }
    return {
        offset: data.offset,
        limit: data.limit,
        total_counts: data.count,
        // total_pages:  Math.ceil(data.count / data.limit),
    };
};
