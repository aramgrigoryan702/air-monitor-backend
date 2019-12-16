/* eslint-disable no-undef,no-process-exit,node/no-unpublished-require */
require('dotenv').config({ path: '.env.test' });
const jose = require('node-jose');
const assert = require('assert');
const async = require('neo-async');
const moment = require('moment');
const should = require('chai').should();
const expect = require('chai').expect;
const cryptoService = require('../../server/services/common/cryptoService');
const superagent = require('superagent');

var baseUrl = 'http://localhost:8000';

//baseUrl = "http://3.19.48.143";
//http://ec2-18-191-171-4.us-east-2.compute.amazonaws.com/api/v1/events

//baseUrl= "http://ec2-18-191-171-4.us-east-2.compute.amazonaws.com";

let redisService, server;

const testServer = require('../testServer');
let modelPromises = [];

describe('Project Canary Authentication Rest API Tests ', function(parentDone) {
	this.timeout(400000);
	before(function(done) {
		// return done();
		testServer.startServer().then(_startedServer => {
			server = _startedServer;
			let allModels = require('../../server/models');
			redisService = require('../../server/services/common/redisService');
			let pgEvents = allModels.pgEvents;
			//pgEvents.once('ready', () => {
			console.log('going to remove all redis keys');
			redisService
				.cleanAll()
				.then(() => {
					return Promise.all(modelPromises);
				})
				.then(() => {
					process.nextTick(() => {
						console.log('Test DB Cleaned');
						done();
					});
				})
				.catch(err => {
					console.log(err);
					done(err);
				});
			//});
		});
	});

	let sampleDeviceData = [
		{
			event: 'device',

			data: {
				id: '340040000a47373336373936',

				imei: '352753090662865',

				iccid: '89014103259631150235',

				firmware: 1,

				board: 3,

				HDOP: 0,

				Latitude: 38.786,

				Longitude: -104.789,

				RSSI: -57,

				CCS_Version: '2.0.0',

				C3_Version: 'FIXME',
			},

			coreid: '340040000a47373336373936',

			published_at: '2019-05-31T21:18:39.740Z',

			userid: '5a83059a34f98b3ab3f56b02',

			fw_version: '1',

			public: 'true',
		},
		{
			event: 'device',

			data: {
				id: '340040000a47373336373937',

				imei: '352753090662866',

				iccid: '89014103259631150236',

				firmware: 1,

				board: 3,

				HDOP: 0,

				Latitude: 0,

				Longitude: 0,

				RSSI: -57,

				CCS_Version: '2.0.0',

				C3_Version: 'FIXME',
			},

			coreid: '340040000a47373336373937',

			published_at: '2019-05-31T21:18:39.740Z',

			userid: '5a83059a34f98b3ab3f56b02',

			fw_version: '1',

			public: 'true',
		},
	];

	let sampleDeviceData1 = [
		{
			event: 'device',

			data: {
				id: '340040000a47373336373936',

				imei: '352753090662865',

				iccid: '89014103259631150235',

				firmware: 10,

				board: 30,

				HDOP: 0,

				Latitude: '27.33335',

				Longitude: '-82.57805',

				RSSI: -57,

				CCS_Version: '2.0.0',

				C3_Version: 'FIXME',
			},

			coreid: '340040000a47373336373936',

			published_at: '2019-05-31T21:18:39.740Z',

			userid: '5a83059a34f98b3ab3f56b02',

			fw_version: '1',

			public: 'true',
		},
		{
			event: 'device',

			data: {
				id: '340040000a47373336373937',

				imei: '352753090662866',

				iccid: '89014103259631150236',

				firmware: 8,

				board: 15,

				HDOP: 0,
				LAT: 45.612,
				LON: -114.844551,

				RSSI: -57,

				CCS_Version: '2.0.0',

				C3_Version: 'FIXME',
			},

			coreid: '340040000a47373336373937',

			published_at: '2019-05-31T21:18:39.740Z',

			userid: '5a83059a34f98b3ab3f56b02',

			fw_version: '1',

			public: 'true',
		},
	];

	let sampleData = [
		{
			event: 'JSON_air_quality_v1.0',
			data: {
				TimeStamp: new Date().toISOString(),
				ProductVersion: '48',
				Battery: 66,
				tVOC: 112,
				tVOC_C3: 112,
				CO2: 238,
				TempF: 145,
				Humidity: 50,
				Methane: 30,
				Pressure: 30.231705,
				WindSpeed: 1.789552,
				WindDirection: 0,
				Latitude: 40.612,
				Longitude: -104.844551,
				HDOP: 5.58,
				VDC: 120,
				ccsFirmware: '20',
				ccsBaseline: '94bb',
				Resistance: 0,
			},
			coreid: '340040000a47373336373936',
			published_at: '2019-04-17T11:00:33.455Z',
			userid: '546bcbca907edf076e000de8',
			fw_version: '38',
			public: 'true',
		},
		{
			event: 'JSON_air_quality_v1.0',
			data: {
				TimeStamp: new Date().toISOString(),
				ProductVersion: '38',
				Battery: 62,
				VOC1: 180,
				VOC2: 210,
				eCO2: 1138,
				TempF: 45,
				H: 50,
				CH4: 30,
				P: 39.231705,
				WS: 2.84747477474747477474,
				WD: 9,
				VDC: 320,
				LAT: 40.612,
				LON: -104.844551,
				HDOP: 5.58,
				ccsFirmware: '20',
				R: 10,
			},
			coreid: '340040000a47373336373936',
			published_at: '2019-04-17T11:00:33.455Z',
			userid: '546bcbca907edf076e000de8',
			fw_version: '38',
			public: 'true',
		},
		{
			event: 'JSON_air_quality_v1.0',
			data: {
				TimeStamp: new Date().toISOString(),
				ProductVersion: '38',
				Battery: 62,
				VOC1: 180,
				VOC2: 210,
				eCO2: 1138,
				TempF: 45,
				H: 50,
				CH4: 30,
				VDC: 360,
				P: 39.231705,
				WS: 2.84747477474747477474,
				WD: 0,
				LAT: 40.612,
				LON: -104.844551,
				HDOP: 5.58,
				ccsFirmware: '20',
				R: 10,
			},
			coreid: '340040000a47373336373936',
			published_at: '2019-04-17T11:00:33.455Z',
			userid: '546bcbca907edf076e000de8',
			fw_version: '38',
			public: 'true',
		},
	];

	let sampleDeviceLogsData = [
		{
			event: 'logs',
			data: {
				TimeStamp: new Date().toISOString(),
				message: 'INFO: 1 samples',
			},
			coreid: '340040000a47373336373936',
			published_at: '2019-05-31T21:18:39.740Z',
			public: 'true',
		},
	];

	it('should test the device reciving  service working good', function(done) {
		let agent = superagent.agent();
		let param = sampleDeviceData[0];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/devices/receive')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});

	it('should test the device update  service working good', function(done) {
		let agent = superagent.agent();
		let param = sampleDeviceData1[0];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/devices/receive')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);

			done();
		}
	});

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleData[0];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/events')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);

			done();
		}
	});

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleData[1];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/events')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);

			done();
		}
	});

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleData[2];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/events')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);

			done();
		}
	});

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleData[1];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/events')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleData[2];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/events')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});

	let sampleDiagonsticData = [
		{
			event: 'Diagonstic',
			data: {
				TimeStamp: new Date().toISOString(),
				MipexStatus: 32,
				ccsBaseline: '94bb',
				c3Baseline: '94cb',
			},
			coreid: '99999999999999',
		},
		{
			event: 'Diagonstic',
			data: {
				TimeStamp: new Date().toISOString(),
				MipexStatus: 95,
				ccsBaseline: '14bb',
				c3Baseline: '94cb',
			},
			coreid: '99999999999999',
			published_at: '2019-04-17T11:00:33.455Z',
			userid: '546bcbca907edf076e000de8',
			fw_version: '38',
			public: 'true',
		},
	];

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleDiagonsticData[0];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/diagonstics')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});

	it('Should Device Service logs Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleDeviceLogsData[0];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/device_logs')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});


	it('Should Device Service  activities logs Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleDeviceLogsData[0];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/device_logs/activities')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});

	it('Should Event Service Receiving data working  good', function(done) {
		let agent = superagent.agent();
		let param = sampleDiagonsticData[1];
		param.data.TimeStamp = new Date().toISOString();
		agent
			.post(baseUrl + '/api/v1/diagonstics')
			.send(param)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			done();
		}
	});

	let userData = {
		name: 'Sajib Sarkar',
		email: 'thebapi@gmail.com',
		password: 'sample1234456',
		'custom:userID': '5008',
	};

	let access_token, id_token, user_data;

	it('Should login  the user', function(done) {
		let agent = superagent.agent();
		agent
			.post(baseUrl + '/api/v1/auth/signin')
			.send(userData)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			console.log(res.body);
			access_token = res.body.data.access_token;
			id_token = res.body.data.id_token;
			user_data = res.body.data.user_data;

			done();
		}
	});

	it('Should get  recent Events data', function(done) {
		let agent = superagent.agent();
		agent
			.get(baseUrl + '/api/v1/events/recent')
			.set('Authorization', 'Bearer ' + id_token)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			console.log(res.body);
			done();
		}
	});

	/* it('Should register a new user', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/auth/signup')
            .send(userData)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            done();
        }
    });
*/

	/*it('Should  test the auth  user from authenticated  routes', function(done) {
        let agent = superagent.agent();
        agent
            .get(baseUrl + '/api/v1/auth/test_auth')
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            done();
        }
    });

    let userDataWithNewPassword = {
        ...userData,
        newPassword: 'sample1234567',
    };
    it('Should update  the user  password', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/auth/change_password')
            //.set('Authorization', 'Bearer ' + accessToken)
            .send(userDataWithNewPassword)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            /!*  userDataWithNewPassword.password =
                userDataWithNewPassword.newPassword;
          *!/ done();
        }
    });

    it('Should login  the user  with new password', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/auth/signin')
            .send(userData)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            done();
        }
    });

    it('Should update  the user  password', function(done) {
        userDataWithNewPassword.newPassword = userData.password;
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/auth/change_password')
            .send(userDataWithNewPassword)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            /!*  userDataWithNewPassword.password =
                userDataWithNewPassword.newPassword;*!/
            done();
        }
    });

    let  lookupData = {
        name: 'Any Lookup Name',
        domainID: 45,
        description: 'Wonderful descriptions',
    };

    it('Should  test lookup  data being inserting', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/lookups')
            .set('Authorization', 'Bearer ' + id_token)
            .send(lookupData)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            lookupData = res.body.data;
            done();
        }
    });

    it('Should  test lookup  data being retrievd by  id', function(done) {
        let agent = superagent.agent();
        agent
            .get(baseUrl + `/api/v1/lookups/${lookupData.id}`)
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            expect(lookupData.name).to.be.eq(res.body.data.name);
            expect(lookupData.id).to.be.eq(res.body.data.id);
            lookupData = res.body.data;
            done();
        }
    });

    let newLookupdata = {
        ...lookupData,
        name: 'Changed Lookup Names',
        domainID: 5,
    }
    it('Should  test lookup  data being updating perfect', function(done) {
        let agent = superagent.agent();
        agent
            .put(baseUrl + `/api/v1/lookups/${lookupData.id}`)
            .set('Authorization', 'Bearer ' + id_token)
            .send(newLookupdata)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            lookupData = res.body.data;
            expect(lookupData.name).to.be.eq(newLookupdata.name);
            done();
        }
    });

    it('Should  test lookup  data being deleteing perfect', function(done) {
        let agent = superagent.agent();
        agent
            .delete(baseUrl + `/api/v1/lookups/${lookupData.id}`)
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            done();
        }
    });
*/
	/*

    it('Should get  all listed users', function(done) {
        let agent = superagent.agent();
        agent
            .get(baseUrl + '/api/v1/admin/users/')
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            const data = res.body.data;
            data.forEach(item => {
                console.log(item);
            });

            done();
        }
    });

    it('Should get  all listed admin users', function(done) {
        let agent = superagent.agent();
        agent
            .get(baseUrl + '/api/v1/admin/users/adminUsers')
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            const data = res.body.data;
            data.forEach(item => {
                console.log(item);
            });

            done();
        }
    });

    it('Should get  all listed editor users', function(done) {
        let agent = superagent.agent();
        agent
            .get(baseUrl + '/api/v1/admin/users/editorUsers')
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            const data = res.body.data;
            data.forEach(item => {
                console.log(item);
            });

            done();
        }
    });

    it('Should get  all listed viewer users', function(done) {
        let agent = superagent.agent();
        agent
            .get(baseUrl + '/api/v1/admin/users/viewerUsers')
            .set('Authorization', 'Bearer ' + id_token)
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            const data = res.body.data;
            data.forEach(item => {
                console.log(item);
            });

            done();
        }
    });
*/

	/*it('Should a  user to the  admin group', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/moveUserToAdminGroup')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ Username: '981b75f6-ec7f-489a-9ff8-ed7960d97ba1' })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);

            done();
        }
    });

    it('Should a  move a user to the  viewer group', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/moveUserToViewerGroup')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ Username: '981b75f6-ec7f-489a-9ff8-ed7960d97ba1' })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);

            done();
        }
    });

    it('Should a  move a user to the  editor group', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/moveUserToEditorGroup')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ Username: '981b75f6-ec7f-489a-9ff8-ed7960d97ba1' })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);

            done();
        }
    });

    it('Should a  move a user to the  admin group', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/moveUserToAdminGroup')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ Username: '981b75f6-ec7f-489a-9ff8-ed7960d97ba1' })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);

            done();
        }
    });

    it('Should a  disable a  user', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/disableUser')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ Username: '981b75f6-ec7f-489a-9ff8-ed7960d97ba1' })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);

            done();
        }
    });
*/
	/* it('Should a  enable a user', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/enableUser')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ Username: '981b75f6-ec7f-489a-9ff8-ed7960d97ba1' })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);

            done();
        }
    });*/

	it('Should a invite a exisitng user be  failed', function(done) {
		let agent = superagent.agent();
		agent
			.post(baseUrl + '/api/v1/admin/users/inviteUser')
			.set('Authorization', 'Bearer ' + id_token)
			.send({ email: 'thebapi@gmail.com' })
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.exist(err);
			res.status.should.be.eq(400);
			//should.exist(res);
			//console.log(res.body);
			done();
		}
	});

	/* let newUser = {
        email: 'sajibsarkar@gmail.com',
    };
    it('Should invite a new user', function(done) {
        let agent = superagent.agent();
        agent
            .post(baseUrl + '/api/v1/admin/users/inviteUser')
            .set('Authorization', 'Bearer ' + id_token)
            .send({ email: newUser.email })
            .accept('json')
            .end(onResponse);

        function onResponse(err, res) {
            should.not.exist(err);
            res.status.should.be.eq(200);
            should.exist(res);
            console.log(res.body);
            done();
        }
    });
*/
	it('Should get  all device data', function(done) {
		let agent = superagent.agent();
		agent
			.get(baseUrl + '/api/v1/devices/')
			.set('Authorization', 'Bearer ' + id_token)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			console.log(res.body);
			done();
		}
	});

	it('Should get device  event data for  a  particular device id', function(done) {
		let whereCondition = { id: null };
		let deviceId = '6666666666666';
		let agent = superagent.agent();
		agent
			.get(baseUrl + `/api/v1/device_events/${deviceId}`)
			.set('Authorization', 'Bearer ' + id_token)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			console.log(res.body);
			done();
		}
	});

	it('Should get  all unassigned device data', function(done) {
		let whereCondition = { site_ID: null };
		let agent = superagent.agent();
		agent
			.get(
				baseUrl +
					`/api/v1/devices/?whereCondition=${JSON.stringify(
						whereCondition,
					)}`,
			)
			.set('Authorization', 'Bearer ' + id_token)
			.accept('json')
			.end(onResponse);

		function onResponse(err, res) {
			should.not.exist(err);
			res.status.should.be.eq(200);
			should.exist(res);
			console.log(res.body);
			done();
		}
	});

	after(done => {
		server &&
			server.close(() => {
				done();
			});
	});
});
