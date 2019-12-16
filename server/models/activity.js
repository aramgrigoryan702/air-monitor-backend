const Sequelize = require('sequelize');

const ActivitySchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	timestamp: { type: Sequelize.DATE, allowNull: false },
	device_id: { type: Sequelize.STRING(50) },
	userID: { type: Sequelize.STRING(50), allowNull: false },
	lookup_ID: { type: Sequelize.INTEGER, allowNull: false },
	reference_id: { type: Sequelize.INTEGER, allowNull: true }, // actual object property like site.id , collection_id
	reference_type: { type: Sequelize.INTEGER, allowNull: true }, // domain  type like site/collections ets
	company_id: {
		type: Sequelize.INTEGER,
		allowNull: true,
	},
	operational_unit_id: {
		type: Sequelize.INTEGER,
		allowNull: true,
	},
	site_id: {
		type: Sequelize.INTEGER,
		allowNull: true,
	},
	notes: { type: Sequelize.TEXT },
	changes: Sequelize.JSONB({
		action: { type: Sequelize.String },
		property: { type: Sequelize.String },
		from: { type: Sequelize.String },
		to: { type: Sequelize.String },
	}),
	show: { type: Sequelize.BOOLEAN, defaultValue: false }, // if true then show this on chart
};

module.exports = sequelize => {
	let model = sequelize.define('Activity', ActivitySchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		lowercase: true,
		schema: 'events',
		freezeTableName: true,
		tableName: 'activities',
	});

	model.associate = function(models) {
		model.belongsTo(models.Lookup, {
			foreignKey: 'lookup_ID',
			as: 'lookup',
			constraints: true,
		});
		model.belongsTo(models.Device, {
			foreignKey: 'device_id',
			as: 'device',
			constraints: false,
		});
		model.belongsTo(models.DomainLookup, {
			foreignKey: 'reference_type',
			as: 'reference_domain',
			constraints: false,
		});
	};

	return model;
};
