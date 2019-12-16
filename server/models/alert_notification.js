const Sequelize = require('sequelize');

const AlertNotificationSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	alert_config_id: { type: Sequelize.INTEGER, unique: 'alertid_timestamp' },
	timestamp: {
		type: Sequelize.DATE,
		allowNull: false,
		unique: 'alertid_timestamp',
	},
	collection_id: { type: Sequelize.INTEGER, allowNull: false },
	device_id: { type: Sequelize.STRING(50), allowNull: false },
	site_ID: { type: Sequelize.INTEGER, allowNull: false },
	alert_values: { type: Sequelize.ARRAY(Sequelize.JSON) },
	notification_sent: { type: Sequelize.BOOLEAN, defaultValue: false },
};

module.exports = sequelize => {
	let model = sequelize.define('AlertNotification', AlertNotificationSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: false,
		deletedAt: false,
		lowercase: true,
		schema: 'events',
		freezeTableName: true,
		tableName: 'alert_notifications',
	});

	model.associate = function(models) {
		model.belongsTo(models.Collection, {
			foreignKey: 'collection_id',
			as: 'company',
			constraints: false,
		});

		model.belongsTo(models.Site, {
			foreignKey: 'site_ID',
			as: 'site',
			constraints: false,
		});

		model.belongsTo(models.Device, {
			foreignKey: 'device_id',
			as: 'device',
			constraints: false,
		});

		model.belongsTo(models.AlertConfig, {
			foreignKey: 'alert_config_id',
			as: 'alert_config',
			constraints: false,
		});
	};

	return model;
};
