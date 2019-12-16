const Sequelize = require('sequelize');

const FailedProcessLogSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	event: { type: Sequelize.STRING(50) },
	TimeStamp: { type: Sequelize.DATE },
	body: { type: Sequelize.TEXT },
};

module.exports = sequelize => {
	let model = sequelize.define('FailedProcessLog', FailedProcessLogSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: false,
		deletedAt: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'failed_process_logs',
	});
	return model;
};
