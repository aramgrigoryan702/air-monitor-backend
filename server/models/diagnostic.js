const Sequelize = require('sequelize');

const DiagnosticSchema = {
	id: {
		type: Sequelize.BIGINT,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	coreid: { type: Sequelize.STRING(50) },
	TimeStamp: { type: Sequelize.DATE },
	MipexStatus: { type: Sequelize.INTEGER },
	wakeup: { type: Sequelize.INTEGER },
	reset: { type: Sequelize.INTEGER },
	ccsBaseline: { type: Sequelize.STRING(50) },
	c3Baseline: { type: Sequelize.STRING(50) },
	received_at: { type: Sequelize.DATE },
};

module.exports = sequelize => {
	let model = sequelize.define('Diagnostic', DiagnosticSchema, {
		version: true,
		underscored: false,
		createdAt: 'created_at',
		updatedAt: false,
		deletedAt: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'diagnostics',
	});

	model.associate = function(models) {
		model.belongsTo(models.Device, {
			foreignKey: 'coreid',
			as: 'device',
			constraints: false,
		});
	};

	return model;
};
