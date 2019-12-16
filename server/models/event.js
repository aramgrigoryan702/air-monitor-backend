const Sequelize = require('sequelize');

const EventSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	coreid: { type: Sequelize.STRING(50) },
	site_ID: { type: Sequelize.INTEGER },
	event: { type: Sequelize.STRING(50) },
	distance: { type: Sequelize.FLOAT },
	position: {
		type: Sequelize.INTEGER,
	},
	TimeStamp: { type: Sequelize.DATE },
	Battery: { type: Sequelize.INTEGER },
	ChargeDifferential: { type: Sequelize.FLOAT },
	CH4: { type: Sequelize.INTEGER },
	tVOC1: { type: Sequelize.FLOAT },
	tVOC2: { type: Sequelize.FLOAT },
	tVOC1raw: { type: Sequelize.FLOAT },
	tVOC2raw: { type: Sequelize.FLOAT },
	eCO2: { type: Sequelize.INTEGER },
	TempF: { type: Sequelize.FLOAT },
	Voltage: { type: Sequelize.FLOAT },
	Humidity: { type: Sequelize.INTEGER },
	Pressure: { type: Sequelize.FLOAT },
	WindSpeed: { type: Sequelize.FLOAT },
	WindDirection: { type: Sequelize.FLOAT },
	Latitude: {
		type: Sequelize.FLOAT,
		//validate: { min: -90, max: 90 },
	},
	Longitude: {
		type: Sequelize.FLOAT,
		//validate: { min: -180, max: 180 },
	},
	HDOP: { type: Sequelize.FLOAT },
	RSSI: { type: Sequelize.STRING(50) },
	ccsFirmware: { type: Sequelize.STRING(50) },
	QUAL: { type: Sequelize.INTEGER }, // is a number in UMTS RAT indicating the Energy per Chip/Noise ratio in dB levels of the current cell. This value ranges from 0 to 49, higher numbers indicate higher signal quality
	R1: { type: Sequelize.INTEGER },
	R2: { type: Sequelize.INTEGER },
	B1: { type: Sequelize.INTEGER },
	B2: { type: Sequelize.INTEGER },
	U: { type: Sequelize.INTEGER }, // Uncertainty for location based cellular triangulation (m)
	IT: { type: Sequelize.INTEGER }, //Internal Temperature (°F)
	ET: { type: Sequelize.INTEGER }, // External Temperature (°F)
	IH: { type: Sequelize.INTEGER }, // Internal Relative Humidity (%)
	EH: { type: Sequelize.INTEGER }, // External Relative Humidity (%)
	P: { type: Sequelize.FLOAT }, // Pressure (mb)
	TVOC_PID: { type: Sequelize.FLOAT }, //The Canary-S TVOC sensor is different so will need a new field
	PM1_0: { type: Sequelize.FLOAT }, //Particulate Matter 1.0 (ug/m^3)
	PM2_5: { type: Sequelize.FLOAT }, //Particulate Matter 2.5 (ug/m^3)
	PM10: { type: Sequelize.FLOAT }, //Particulate Matter 10 (ug/m^3)
	CO: { type: Sequelize.FLOAT }, // Carbon Monoxide (ppm)
	CO2: { type: Sequelize.FLOAT }, // Carbon Dioxide (ppm)
	SO2: { type: Sequelize.FLOAT }, // Sulfur Dioxide (ppm)
	O2: { type: Sequelize.FLOAT }, // Oxygen (ppm)
	O3: { type: Sequelize.FLOAT }, // Ozone (ppm)
	NO2: { type: Sequelize.FLOAT }, // Nitrogen Dioxide (ppm),
	H2S: { type: Sequelize.FLOAT }, // Hydrogen Sulfide (ppm)
	CH4_S: { type: Sequelize.FLOAT }, // A CH4 field may exist in the database already but the sensor on the Canary-S may not match our existing sensor
	Sig: { type: Sequelize.FLOAT }, // Signal Strength in dB
	published_at: { type: Sequelize.DATE },
	received_at: { type: Sequelize.DATE },
	product_userid: { type: Sequelize.STRING(50) },
	fw_version: { type: Sequelize.STRING(50) },
	ProductVersion: { type: Sequelize.STRING(50) },
};

module.exports = sequelize => {
	let model = sequelize.define('Event', EventSchema, {
		version: true,
		underscored: false,
		timestamps: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'events',
	});

	model.associate = function(models) {
		model.hasOne(models.LatestEvent, {
			foreignKey: 'event_ID',
			as: 'latest_events',
			constraints: true,
		});

		model.belongsTo(models.Device, {
			foreignKey: 'coreid',
			as: 'device',
			constraints: false,
		});
		model.belongsTo(models.Site, {
			foreignKey: 'site_ID',
			as: 'site',
			constraints: false,
		});
	};

	return model;
};
