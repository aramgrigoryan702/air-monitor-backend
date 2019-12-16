const Sequelize = require('sequelize');

const RollupEventGroupChartSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	CoreId: {
		type: Sequelize.STRING(50),
		unique: 'siteid_coreid_timestamp',
	},
	TimeStamp: {
		type: Sequelize.DATE,
		unique: 'siteid_coreid_timestamp',
	},
	tVOC1: { type: Sequelize.FLOAT },
	tVOC2: { type: Sequelize.FLOAT },
	PM1_0: { type: Sequelize.FLOAT }, //Particulate Matter 1.0 (ug/m^3)
	PM2_5: { type: Sequelize.FLOAT }, //Particulate Matter 2.5 (ug/m^3)
	PM10: { type: Sequelize.FLOAT }, //Particulate Matter 10 (ug/m^3)
	TVOC_PID: { type: Sequelize.FLOAT }, //The Canary-S TVOC sensor is different so will need a new field
	CH4_S: { type: Sequelize.FLOAT },
	siteID: {
		type: Sequelize.INTEGER,
		unique: 'siteid_coreid_timestamp',
	},
};

module.exports = sequelize => {
	let model = sequelize.define(
		'RollupEventGroupChart',
		RollupEventGroupChartSchema,
		{
			underscored: false,
			schema: 'events',
			lowercase: true,
			freezeTableName: true,
			tableName: 'rollup_events_group_chart',
			version: false,
			timestamps: false,
		},
	);

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
