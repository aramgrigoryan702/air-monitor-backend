const Sequelize = require('sequelize');

const CollectionSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	name: { type: Sequelize.STRING(100), unique: true, allowNull: false },
	parentID: { type: Sequelize.INTEGER, allowNull: true },
	webhook_url: {
		type: Sequelize.TEXT,
		allowNull: true,
	},
	lookup_ID: { type: Sequelize.INTEGER, allowNull: false },
	mapID: { type: Sequelize.INTEGER },
	description: { type: Sequelize.TEXT },
	exceedBaseLine: {
		type: Sequelize.FLOAT,
		defaultValue: 3.0, // in ppm
	},
	isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
	isAdminDefault: { type: Sequelize.BOOLEAN, defaultValue: false },
};

module.exports = sequelize => {
	let model = sequelize.define('Collection', CollectionSchema, {
		version: true,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		tableName: 'collections',
	});

	model.associate = function(models) {
		model.belongsTo(models.Collection, {
			foreignKey: 'parentID',
			as: 'parent',
			constraints: true,
		});

		model.hasMany(models.Collection, {
			foreignKey: 'parentID',
			as: 'children',
			constraints: true,
		});

		model.belongsTo(models.Lookup, {
			foreignKey: 'lookup_ID',
			as: 'lookup',
			constraints: true,
		});

		model.hasMany(models.Site, {
			foreignKey: 'collection_ID',
			as: 'sites',
			constraints: true,
		});
		model.belongsTo(models.Map, {
			foreignKey: 'mapID',
			as: 'collection_map',
			constraints: true,
		});
	};

	return model;
};
