const Sequelize = require('sequelize');

const LookupSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	domainID: { type: Sequelize.INTEGER },
	reference_domainID: { type: Sequelize.INTEGER },
	name: {
		type: Sequelize.STRING(100),
		upperCase: true,
		unique: false,
		allowNull: false,
	},
	description: { type: Sequelize.TEXT },
};

module.exports = sequelize => {
	let model = sequelize.define('Lookup', LookupSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'lookups',
	});

	model.associate = function(models) {
		model.hasMany(models.Activity, {
			foreignKey: 'lookup_ID',
			as: 'activities',
			constraints: true,
		});

		model.belongsTo(models.DomainLookup, {
			foreignKey: 'domainID',
			as: 'domainLookups',
			constraints: true,
		});

		model.belongsTo(models.DomainLookup, {
			foreignKey: 'reference_domainID',
			as: 'referenceDomainLookups',
			constraints: true,
		});

		/* model.belongsTo(models.Device, {
            foreignKey: 'firmware',
            as: 'firmwareDevices',
            constraints: false,
        });

        model.belongsTo(models.Device, {
            foreignKey: 'boardRev',
            as: 'boardRevDevices',
            constraints: false,
        });

        model.belongsTo(models.Device, {
            foreignKey: 'position',
            as: 'positionDevices',
            constraints: false,
        });
*/
		model.hasMany(models.Collection, {
			foreignKey: 'lookup_ID',
			as: 'collections',
			constraints: true,
		});

		model.hasMany(models.Site, {
			foreignKey: 'lookup_ID',
			as: 'sites',
			constraints: true,
		});
	};

	return model;
};
