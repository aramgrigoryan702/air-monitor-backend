const Sequelize = require('sequelize');

const RollupEventDailySchema = {
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
	CH4_S: { type: Sequelize.FLOAT },
	tVOC1: { type: Sequelize.FLOAT },
	tVOC2: { type: Sequelize.FLOAT },
	PM1_0: { type: Sequelize.FLOAT }, //Particulate Matter 1.0 (ug/m^3)
	PM2_5: { type: Sequelize.FLOAT }, //Particulate Matter 2.5 (ug/m^3)
	PM10: { type: Sequelize.FLOAT }, //Particulate Matter 10 (ug/m^3)
	TVOC_PID: { type: Sequelize.FLOAT }, //The Canary-S TVOC sensor is different so will need a new field
	eCO2: { type: Sequelize.INTEGER },
	TempF: { type: Sequelize.FLOAT },
	Voltage: { type: Sequelize.FLOAT },
	Humidity: { type: Sequelize.INTEGER },
	Pressure: { type: Sequelize.FLOAT },
	WindSpeed: { type: Sequelize.FLOAT },
	WindDirection: { type: Sequelize.FLOAT },
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
	let model = sequelize.define('RollupEventDaily', RollupEventDailySchema, {
		underscored: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'rollup_events_daily',
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
