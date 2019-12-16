const Sequelize = require('sequelize');

const MapSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	metadata: {
		type: Sequelize.JSON,
	},
	name: {
		type: Sequelize.STRING(100),
		upperCase: true,
		allowNull: true,
	},
	lat: {
		type: Sequelize.DataTypes.FLOAT,
		allowNull: true,
		defaultValue: 0,
		// validate: { min: -90, max: 90 },
	},
	lng: {
		type: Sequelize.DataTypes.FLOAT,
		allowNull: true,
		defaultValue: 0,
		// validate: { min: -180, max: 180 },
	},
	initialZoom: {
		type: Sequelize.INTEGER,
		defaultValue: 16,
	},
};

module.exports = sequelize => {
	let model = sequelize.define('Map', MapSchema, {
		version: true,
		schema: 'events',
		lowercase: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		freezeTableName: true,
		tableName: 'maps',
	});

	model.associate = function(models) {
		model.hasMany(models.Collection, {
			foreignKey: 'mapID',
			as: 'collections',
			constraints: false,
		});
		model.hasMany(models.Site, {
			foreignKey: 'mapID',
			as: 'sites',
			constraints: false,
		});
	};

	return model;
};
