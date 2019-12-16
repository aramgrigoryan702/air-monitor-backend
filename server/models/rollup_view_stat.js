const Sequelize = require('sequelize');

const RollupViewStatSchema = {
	id: {
		type: Sequelize.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	name: { type: Sequelize.STRING(100), unique: true, allowNull: false },
	TimeStamp: { type: Sequelize.DATE },
};

module.exports = sequelize => {
	let model = sequelize.define('RollupViewStat', RollupViewStatSchema, {
		underscored: false,
		schema: 'events',
		lowercase: true,
		freezeTableName: true,
		tableName: 'rollup_view_stat',
		version: false,
		timestamps: false,
	});

	return model;
};
