const Sequelize = require('sequelize');

const SiteSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	name: { type: Sequelize.STRING(200), unique: true, allowNull: false },
	lookup_ID: { type: Sequelize.INTEGER },
	collection_ID: { type: Sequelize.INTEGER },
	type_Class: { type: Sequelize.FLOAT },
	mapID: { type: Sequelize.INTEGER },
	description: { type: Sequelize.TEXT },
	isAdminDefault: { type: Sequelize.BOOLEAN, defaultValue: false },
};

module.exports = sequelize => {
	let model = sequelize.define('Site', SiteSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		lowercase: true,
		freezeTableName: true,
		schema: 'events',
		tableName: 'sites',
	});

	model.associate = function(models) {
		model.belongsTo(models.Lookup, {
			foreignKey: 'lookup_ID',
			as: 'lookup',
			constraints: true,
		});

		model.belongsTo(models.Collection, {
			foreignKey: 'collection_ID',
			as: 'operational_unit',
			constraints: true,
		});

		model.hasMany(models.Device, {
			foreignKey: 'site_ID',
			as: 'devices',
			constraints: true,
		});

		model.hasMany(models.Device, {
			foreignKey: 'site_ID',
			as: 'active_devices',
			constraints: false,
		});

		model.belongsTo(models.Map, {
			foreignKey: 'mapID',
			as: 'site_map',
			constraints: true,
		});
		model.hasMany(models.Activity, {
			foreignKey: 'reference_id',
			as: 'activites',
			constraints: false,
		});
		model.hasMany(models.DeviceSuccessRate, {
			foreignKey: 'site_id',
			as: 'success_rate',
			constraints: false,
		});
	};

	return model;
};
