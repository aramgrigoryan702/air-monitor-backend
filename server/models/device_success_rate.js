const Sequelize = require('sequelize');

const DeviceSuccessRateSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	company_id: {
		type: Sequelize.INTEGER,
		allowNull: false,
		unique: 'company_opunit_siteid_timestamp',
	},
	operational_unit_id: {
		type: Sequelize.INTEGER,
		allowNull: false,
		unique: 'company_opunit_siteid_timestamp',
	},
	site_id: {
		type: Sequelize.INTEGER,
		allowNull: false,
		unique: 'company_opunit_siteid_timestamp',
	},
	TimeStamp: {
		type: Sequelize.DATE,
		unique: 'company_opunit_siteid_timestamp',
		allowNull: false,
	},
	total_device_count: { type: Sequelize.INTEGER, allowNull: false },
	active_device_count: { type: Sequelize.INTEGER, allowNull: false },
	device_success_rate: { type: Sequelize.FLOAT, allowNull: false },
};

module.exports = sequelize => {
	let model = sequelize.define('DeviceSuccessRate', DeviceSuccessRateSchema, {
		version: true,
		underscored: false,
		schema: 'events',
		lowercase: true,
		timestamps: false,
		freezeTableName: true,
		tableName: 'device_success_rate',
	});
	model.associate = function(models) {
		model.belongsTo(models.Site, {
			foreignKey: 'site_id',
			as: 'site',
			constraints: false,
		});
		/*
        model.belongsTo(models.Collection, {
            foreignKey: 'company_id',
            as: 'company',
            constraints: false,
        });
        model.belongsTo(models.Collection, {
            foreignKey: 'operational_unit_id',
            as: 'operational_unit',
            constraints: false,
        });*/
	};
	return model;
};
