const Sequelize = require('sequelize');

const AlertConfigSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	email_addresses: { type: Sequelize.ARRAY(Sequelize.STRING(50)) },
	collection_id: { type: Sequelize.INTEGER, allowNull: false },
	created_by: { type: Sequelize.STRING(50), allowNull: false },
	conditions: { type: Sequelize.JSON },
};

module.exports = sequelize => {
	let model = sequelize.define('AlertConfig', AlertConfigSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		lowercase: true,
		schema: 'events',
		freezeTableName: true,
		tableName: 'alert_configs',
	});
	model.associate = function(models) {
		model.belongsTo(models.Collection, {
			foreignKey: 'collection_id',
			as: 'collection',
			constraints: true,
		});
		model.hasMany(models.AlertNotification, {
			foreignKey: 'alert_config_id',
			as: 'alerts',
			constraints: true,
		});
	};

	return model;
};
