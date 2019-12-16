const Sequelize = require('sequelize');

const LatestEventSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	coreid: { type: Sequelize.STRING(50), unique: true },
	event_ID: {
		type: Sequelize.INTEGER,
	},
	TimeStamp: { type: Sequelize.DATE, allowNull: false },
};

module.exports = sequelize => {
	let model = sequelize.define('LatestEvent', LatestEventSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'latest_events',
	});

	model.associate = function(models) {
		model.belongsTo(models.Event, {
			foreignKey: 'event_ID',
			as: 'event',
			constraints: true,
		});
		model.belongsTo(models.Device, {
			foreignKey: 'coreid',
			as: 'device',
			constraints: false,
		});
	};
	return model;
};
