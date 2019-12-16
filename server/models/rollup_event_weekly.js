const Sequelize = require('sequelize');

const RollupEventWeeklySchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	CoreId: {
		type: Sequelize.STRING(50),
		unique: 'siteid_coreid_positionlookupid_timestamp',
	},
	TimeStamp: {
		type: Sequelize.DATE,
		unique: 'siteid_coreid_positionlookupid_timestamp',
	},
	Battery: { type: Sequelize.FLOAT },
	ChargeDifferential: { type: Sequelize.FLOAT },
	CH4: { type: Sequelize.INTEGER },
	tVOC1: { type: Sequelize.FLOAT },
	tVOC2: { type: Sequelize.FLOAT },
	eCO2: { type: Sequelize.INTEGER },
	TempF: { type: Sequelize.FLOAT },
	Voltage: { type: Sequelize.FLOAT },
	Humidity: { type: Sequelize.INTEGER },
	Pressure: { type: Sequelize.FLOAT },
	WindSpeed: { type: Sequelize.FLOAT },
	WindDirection: { type: Sequelize.SMALLINT },
	distance: {
		type: Sequelize.INTEGER,
	},
	siteID: {
		type: Sequelize.INTEGER,
		unique: 'siteid_coreid_positionlookupid_timestamp',
	},
	positionLookupId: {
		type: Sequelize.INTEGER,
		unique: 'siteid_coreid_positionlookupid_timestamp',
	},
	positionLookupName: { type: Sequelize.STRING(50) },
};

module.exports = sequelize => {
	let model = sequelize.define('RollupEventWeekly', RollupEventWeeklySchema, {
		underscored: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'rollup_events_weekly',
		version: false,
		timestamps: false,
	});

	model.associate = function(models) {
		model.belongsTo(models.Site, {
			foreignKey: 'siteID',
			as: 'site',
			constraints: false,
		});

		model.belongsTo(models.Device, {
			foreignKey: 'CoreId',
			as: 'device',
			constraints: false,
		});
	};

	return model;
};
