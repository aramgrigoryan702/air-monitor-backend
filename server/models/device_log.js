const Sequelize = require('sequelize');

const DeviceLogSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	coreid: { type: Sequelize.STRING(50) },
	TimeStamp: { type: Sequelize.DATE },
	message: { type: Sequelize.TEXT },
	received_at: { type: Sequelize.DATE },
};

module.exports = sequelize => {
	let model = sequelize.define('DeviceLog', DeviceLogSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: false,
		deletedAt: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'device_logs',
	});
	model.associate = function(models) {
		model.belongsTo(models.Device, {
			foreignKey: 'coreid',
			as: 'device',
			constraints: false,
		});
	};
	return model;
};
