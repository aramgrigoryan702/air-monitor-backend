const Sequelize = require('sequelize');

const EventWebhookNotificationSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	status: { type: Sequelize.INTEGER },
	webhook_url: { type: Sequelize.TEXT },
	company_id: { type: Sequelize.INTEGER },
	timestamp: {
		type: Sequelize.DATE,
		allowNull: false,
	},
	coreid: { type: Sequelize.STRING(50) },
	requestBody: {
		type: Sequelize.JSON,
	},
	responseBody: {
		type: Sequelize.JSON,
	},
};

module.exports = sequelize => {
	let model = sequelize.define(
		'EventWebhookNotification',
		EventWebhookNotificationSchema,
		{
			version: true,
			underscored: false,
			createdAt: 'created_at',
			updatedAt: false,
			deletedAt: false,
			lowercase: true,
			schema: 'events',
			freezeTableName: true,
			tableName: 'event_webhook_notifications',
		},
	);

	model.associate = function(models) {
		model.belongsTo(models.Collection, {
			foreignKey: 'company_id',
			as: 'company',
			constraints: true,
		});
	};

	return model;
};
