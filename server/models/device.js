const Sequelize = require('sequelize');

const DeviceSchema = {
	id: { type: Sequelize.STRING(50), allowNull: false, primaryKey: true },
	imei: { type: Sequelize.STRING(24) },
	bearing: {
		type: Sequelize.FLOAT,
		validate: { min: 0, max: 360 },
	},
	distance: {
		type: Sequelize.FLOAT,
	},
	//mapID: { type: Sequelize.INTEGER },
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
	HDOP: { type: Sequelize.FLOAT },
	iccid: { type: Sequelize.STRING(50), allowNull: true },
	boardRev: { type: Sequelize.STRING(5), allowNull: true },
	firmware: { type: Sequelize.STRING(5), allowNull: true },
	site_ID: { type: Sequelize.INTEGER },
	//mapID: { type: Sequelize.INTEGER },
	health: {
		type: Sequelize.INTEGER,
		defaultValue: 0,
		validate: { isIn: [[0, 1, 2]] },
	},
	healthHint: {
		type: Sequelize.STRING(50),
	},
	isLocationLocked: {
		type: Sequelize.BOOLEAN,
		allowNull: false,
		defaultValue: false,
	},
	dataMissedInHours: { defaultValue: 0, type: Sequelize.INTEGER }, // data missed within last 3 days
	dataMissedHint: { type: Sequelize.STRING(50) },
	retiredDate: { type: Sequelize.DATE },
	//lookup_ID: { type: Sequelize.INTEGER },
	CCS_Version: { type: Sequelize.STRING(50) },
	C3_Version: { type: Sequelize.STRING(50) },
	position: { type: Sequelize.INTEGER },
	type: { type: Sequelize.STRING(50), defaultValue: 'Canary-C' },
	last_reported_time: {
		type: Sequelize.DATE,
		defaultValue: () => new Date(),
	},
	created_at: {
		type: Sequelize.DATE,
		defaultValue: () => new Date(),
	},
};

module.exports = sequelize => {
	let model = sequelize.define('Device', DeviceSchema, {
		version: true,
		timestamps: false,
		underscored: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		omitNull: false,
		tableName: 'devices',
		strict: true,
	});

	model.associate = function(models) {
		model.belongsTo(models.Site, {
			foreignKey: 'site_ID',
			as: 'site',
			constraints: true,
		});

		model.belongsTo(models.Lookup, {
			foreignKey: 'position',
			as: 'positionLookup',
			constraints: true,
		});

		model.hasOne(models.LatestEvent, {
			foreignKey: 'coreid',
			as: 'last_event',
			constraints: false,
		});

		model.hasMany(models.Event, {
			foreignKey: 'coreid',
			as: 'events',
			constraints: false,
		});

		model.hasMany(models.Activity, {
			foreignKey: 'device_id',
			as: 'activites',
			constraints: false,
		});
	};

	return model;
};
