const Sequelize = require('sequelize');

const DomainLookupSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	name: {
		type: Sequelize.STRING(100),
		upperCase: true,
		unique: true,
		allowNull: false,
	},
	description: { type: Sequelize.TEXT },
};

module.exports = sequelize => {
	let model = sequelize.define('DomainLookup', DomainLookupSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: 'updated_at',
		deletedAt: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'domain_lookups',
	});

	model.associate = function(models) {
		model.hasMany(models.Lookup, {
			foreignKey: 'lookup_ID',
			as: 'lookups',
			constraints: true,
		});
	};

	return model;
};
