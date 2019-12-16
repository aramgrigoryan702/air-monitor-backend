let isDev = process.env.NODE_ENV !== 'production';
const config = {
	isTestMode: () => process.env.NODE_ENV === 'test',
	appEmail: 'Project Canary<app@projectcanary.com>',
	devAppEmail: 'Project Canary<app@projectcanary.io>',
	alertEmail: 'Project Canary Alert<alert@projectcanary.io>',
	system: {
		page_size: 20,
		default_timezone: '+00:00',
		upload_directory: './.temp/uploads/',
		redis_cache_default_duration: 600000 * 3, // 30 min,
		base_url: 'https://api.projectcanary.io',
		unassignedSiteName: 'Unassigned',
		logoUrl:
			'https://projectcanarypublicimages.s3.us-east-2.amazonaws.com/project_canary_logo.png',
	},
	authorization: {
		rate_limit_window_duration: 900000, // 15 min
		rate_limit_max_requests: 1000, // 100 request during the window
		auth_rate_limit_window_duration: 600000, // 10 min
		auth_rate_limit_max_requests: isDev ? 500 : 50, // 3 request during the window
		access_token_duration: 60, //  expires every 15 mins
		verification_code_expiry_duration: 48, //  2  days
	},
	alerts: {
		dev_ops_email: isDev
			? ['thebapi@gmail.com', 'sajibsarkar@gmail.com']
			: ['thebapi@gmail.com', 'sajibsarkar@gmail.com'],
		support_team_email: isDev
			? ['thebapi@gmail.com', 'sajibsarkar@gmail.com']
			: ['thebapi@gmail.com', 'charlie.losche@projectcanary.us'],
		sales_team_email: isDev
			? ['thebapi@gmail.com', 'sajibsarkar@gmail.com']
			: [
					'thebapi@gmail.com',
					'charlie.losche@projectcanary.us',
					'sales@projectcanary.com',
			  ],
		management_team_email: isDev
			? ['thebapi@gmail.com']
			: ['thebapi@gmail.com', 'charlie.losche@projectcanary.us'],
	},
	dbBackupBucketName: 'projectcanary-db-backup',
};

module.exports = config;
