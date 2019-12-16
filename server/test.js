require('dotenv').config({ path: './.env' });
const AmazonCognitoIdentity = require('amazon-cognito-identity-js');
const CognitoUserPool = AmazonCognitoIdentity.CognitoUserPool;
const AWS = require('aws-sdk');
const async = require('neo-async');
const request = require('request');
const jwkToPem = require('jwk-to-pem');
const jwt = require('jsonwebtoken');
const jsonfile = require('jsonfile');
const { isDate, round, isNil } = require('lodash');
const windrose = require('windrose');
global.fetch = require('node-fetch');
const dbModels = require('./models');
const s3FileServer = require('./services/common/s3FileService');
const { Event, LatestEvent } = dbModels;
const {
	Device,
	Lookup,
	Site,
	Map,
	Collection,
	Activity,
	Sequelize,
	DomainLookup,
	FailedProcessLog,
	DeviceSuccessRate,
	DeviceLog,
	Diagnostic,
	AlertNotification,
} = dbModels;
const { Op } = Sequelize;
const moment = require('moment');
const path = require('path');
const locationCalculationHelper = require('./helpers/locationCalculationHelper');
const userManagementService = require('./services/admin/userManagementService');
const collectionService = require('./services/collectionService');
const deviceLogsService = require('./services/deviceLogsService');
const math = require('mathjs');
const redisService = require('./services/common/redisService');
const JSONStream = require('JSONStream');
const { subHours, subMonths, subDays } = require('date-fns');
const emailService = require('./services/common/emailService');
const pgPoolService = require('./services/common/pgPoolService');
const eventService = require('./services/eventService');
const deviceService = require('./services/deviceService');
const alertConfigService = require('./services/alertConfigService');
const alertNotificationService = require('./services/alertNotificationService');
const deviceSuccessRateService = require('./services/deviceSuccessRateService');
const config = require('./config');
const { from, of, pipe } = require('rxjs');
const devEmailService = require('./services/common/devEmailService');

const { map, catchError, withLatestFrom } = require('rxjs/operators');

const adminTools = require('./services/admin/adminTools');

(async () => await dbModels.authenticate())();

redisService.initiate(true).catch(err => {
	console.log('Error while connecting with redis', err);
});

const QueueManager = require('./task-queue/QueueManager');
/*const QueueWorker = require('./task-queue/QueueWorker');
QueueWorker.startQueueWorker();*/

`
create or replace function events.times_in_every_fifteen_min(the_date_time timestamptz=now())
returns table(the_date_time timestamptz) as $$
select d::timestamptz from generate_series(
    date_trunc('hour',the_date_time+ '-1 month'),
    now(),
    '15 min'
) as series(d);
$$
language sql;



 create or replace function events.timestamp_in_each_four_days(the_date_time timestamptz=now())
returns timestamptz as $$
declare
    year integer;
    month text;
    day text;
    time text;
    temp_time text;
BEGIN
select EXTRACT(year from the_date_time) into year;
select LPAD(EXTRACT(month from the_date_time)::text, 2 , '0') into month;
select LPAD(EXTRACT(day from the_date_time)::text, 2 , '0') into day;
select LPAD(trunc(EXTRACT(hour from the_date_time) / 6)::text, 2, '0') into time;
select CONCAT_WS('-', year, month, day) into temp_time;
return CONCAT(CONCAT_WS(' ', temp_time, time),':00:00')::timestamptz;
END $$
LANGUAGE plpgsql;


create or replace function events.timestamp_in_each_six_hour(the_date_time timestamptz=now())
returns timestamptz as $$
declare
    year integer;
    month text;
    day text;
    time text;
    temp_time text;
BEGIN
select  EXTRACT(year from the_date_time) into year;
select LPAD(EXTRACT(month from the_date_time)::text, 2 , '0') into month;
select LPAD(EXTRACT(day from the_date_time)::text, 2 , '0') into day;
select LPAD(trunc(EXTRACT(hour from the_date_time) / 6)::text, 2, '0') into time;
select CONCAT_WS('-', year, month, day) into temp_time;
return CONCAT(CONCAT_WS(' ', temp_time, time),':00:00')::timestamptz;
END $$
LANGUAGE plpgsql;


create or replace function events.timestamp_in_each_fifteen_min(the_date_time timestamptz=now())
returns timestamptz as $$
declare
    year integer;
    month text;
    day text;
    time text;
    hour text;
    min text;
    temp_time text;
BEGIN
select  EXTRACT(year from the_date_time) into year;
select LPAD(EXTRACT(month from the_date_time)::text, 2 , '0') into month;
select LPAD(EXTRACT(day from the_date_time)::text, 2 , '0') into day;
select LPAD(EXTRACT(hour from the_date_time)::text, 2 , '0') into hour;
select LPAD(trunc((EXTRACT(minute from "TimeStamp") / 15)* 15)::text, 2, '0') into min;
select CONCAT_WS('-', year, month, day) into temp_time;
return CONCAT(CONCAT_WS(' ', temp_time, hour), ':', min, ':00')::timestamptz;
END $$
LANGUAGE plpgsql;

//00:00:00+06
create or replace function events.times_in_every_fifteen_min_of_last_day(the_date_time timestamptz=now())
returns table(the_date_time timestamptz) as $$
select d::timestamptz from generate_series(
    date_trunc('hour',the_date_time+ '-1 day'),
    now(),
    '15 min'
) as series(d);
$$
language sql;


create or replace function events.times_in_every_min_of_last_day(the_date_time timestamptz=now())
returns table(the_date_time timestamptz) as $$
select d::timestamptz from generate_series(
    date_trunc('hour',the_date_time+ '-1 day'),
    now(),
    '1 min'
) as series(d);
$$
language sql;
    
    create or replace function events.times_in_every_min_of_last_hour(the_date_time timestamptz=now())
returns table(the_date_time timestamptz) as $$
select d::timestamptz from generate_series(
    date_trunc('hour',the_date_time+ '-1 hour'),
    now(),
    '1 min'
) as series(d);
$$
language sql;


create or replace function events.times_in_every_hour(the_date_time timestamptz=now())
returns table(the_date_time timestamptz) as $$
select d::timestamptz from generate_series(
    date_trunc('hour',the_date_time+ '-1 month'),
    now(),
    '1 hour'
) as series(d);
$$
language sql;


create  or replace view  events.event_view_in_fifteen_min as
select date_trunc('min', "TimeStamp") as timeline, * from events.events;

create  or replace view  events.event_view as
select date_trunc('min', "TimeStamp") as timeline, * from events.events;


create or replace view events.times_in_every_fifteen_min_of_last_day_view as select the_date_time as timeline from events.times_in_every_fifteen_min_of_last_day()

create or replace view events.times_in_every_fifteen_min_of_last_day_view as select the_date_time as timeline from events.times_in_every_fifteen_min_of_last_day()

create or replace view events.times_in_every_min_of_last_day_view as select the_date_time as timeline from events.times_in_every_min_of_last_day();



events.times_in_every_fifteen_min_of_last_day
select *  from  events.times_in_every_fifteen_min_of_last_day_view time_in_last_day
left join  events.event_view_in_fifteen_min ev on time_in_last_day.timeline = ev.timeline;


/*
const poolData = {
    UserPoolId: process.env.COGNITO_POOL_ID, // Your user pool id here
    ClientId: process.env.COGNITO_CLIENT_ID, // Your client id here
};

const pool_region = 'us-east-2';

let latestEvents = require('../latest_events.json');
let events = require('../events.json');

dbModels
    .authenticate()
    .then(() => {
        return dbModels.syncDB();
    })
    .then(() => {
        console.log('Database ready.');
        return 1;
    })
    .then(() => {
       // let newEvents = events.map(item => Event.build(item));
        console.log('events', latestEvents);
        return LatestEvent.bulkCreate(latestEvents, { validate: true });
        //return true;
    })
    .then(() => {
        console.log('Import done');
    })
    .catch(err => {
        console.log('Database connection failed', err);
    });

const startPosition = { lat: 39.099912, lng: -94.581213 };

const endPosition = { lat: 38.627089, lng: -90.200203 };

console.log(
    'the BE is  ',
    locationCalculationHelper.calculateBearing(startPosition, endPosition),
);

const newyork = {
    lat: 40.7143,
    lng: -74.006,
};

const sanfransco = {
    lat: 37.7749,
    lng: -122.4194,
};

console.log(
    'again Distance is',
    locationCalculationHelper.measureDistance(newyork, sanfransco),
);

console.log(
    'again bearing is',
    locationCalculationHelper.calculateBearing(newyork, sanfransco),
);

CREATE OR REPLACE VIEW events.event_view_hourly AS
SELECT avg("Event"."tVOC1") AS "tVOC1",
    avg("Event"."tVOC2") AS "tVOC2",
    avg("Event"."Battery"::double precision) AS "Battery",
    avg("Event"."Humidity"::double precision) AS "Humidity",
    avg("Event"."ChargeDifferential"::double precision) AS "ChargeDifferential",
    avg("Event"."CH4"::double precision) AS "CH4",
    avg("Event"."TempF") AS "TempF",
    avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END) AS "WindDirection",
    avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END)) AS "WindSpeed",
    avg("Event"."eCO2"::double precision) AS "eCO2",
    date_trunc('hour'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    "device->site".id AS "siteID"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
 WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY   "siteID", "positionLookupId", "positionLookupName", date_trunc('hour'::text, "TimeStamp")
 ORDER BY "siteID", "TimeStamp";



	   CREATE OR REPLACE VIEW events.event_view AS
 SELECT round(avg("Event"."tVOC1")::numeric, 3) AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3) AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3) AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3) AS "Humidity",
    round(avg("Event"."ChargeDifferential"::double precision)::numeric, 3) AS "ChargeDifferential",
    round(avg("Event"."CH4"::double precision)::numeric, 3) AS "CH4",
    round(avg("Event"."TempF")::numeric, 3) AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3) AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3) AS "WindSpeed",
    round(avg("Event"."eCO2"::double precision)::numeric, 3) AS "eCO2",
    date_trunc('minute'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    "device->site".id AS "siteID",
     "device->site".name AS "siteName",
     device.id AS "core_id"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
   WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
   GROUP BY   "core_id", "siteID", "siteName", "positionLookupId", "positionLookupName", date_trunc('minute'::text, "TimeStamp")
   order by "siteID", "TimeStamp";

-- View: events.event_mat_view

DROP MATERIALIZED VIEW events.event_mat_view_all_data;

CREATE MATERIALIZED VIEW events.event_mat_view_all_data
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."ChargeDifferential"::double precision)::numeric, 3)::double precision AS "ChargeDifferential",
    round(avg("Event"."CH4"::double precision)::numeric, 3)::double precision AS "CH4",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."eCO2"::double precision)::numeric, 3)::double precision AS "eCO2",
    date_trunc('minute'::text, "Event"."TimeStamp") AS "TimeStamp",
    device.distance AS "distance",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
     "device->site".id AS "siteID",
    "device->site".name AS "SiteName",
     device.id AS "CoreId"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
  WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY   "siteID","SiteName", device.id, device.distance, "positionLookupId", "positionLookupName", date_trunc('minute'::text, "TimeStamp")
   order by  "siteID", "TimeStamp", "positionLookupName"
WITH DATA;

ALTER TABLE events.event_mat_view_all_data
    OWNER TO darmitage;


CREATE UNIQUE INDEX event_mat_view_all_data_key
    ON events.event_mat_view_all_data USING btree
    ("CoreId", "siteID", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;


DROP MATERIALIZED VIEW events.event_mat_view;

CREATE MATERIALIZED VIEW events.event_mat_view
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    date_trunc('minute'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    "device->site".id AS "siteID",
    device.id AS "CoreId",
    round((device.distance * 3.280839895)::numeric, 3)  AS "distance"
    FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
      WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY   "siteID", device.id,  "positionLookupId", "positionLookupName", device.distance, date_trunc('minute'::text, "TimeStamp")
   order by "siteID", "TimeStamp"
WITH DATA;

ALTER TABLE events.event_mat_view
    OWNER TO darmitage;


CREATE UNIQUE INDEX event_matview_key
    ON events.event_mat_view USING btree
    ("siteID", "CoreId", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;

DROP MATERIALIZED VIEW events.event_mat_view_hourly;

CREATE MATERIALIZED VIEW events.event_mat_view_hourly
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    date_trunc('hour'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    "device->site".id AS "siteID",
    device.id AS "CoreId",
    round((device.distance * 3.280839895)::numeric, 0)  AS "distance"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
      WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY   "siteID",device.id, "positionLookupId", "positionLookupName",device.distance, date_trunc('hour'::text, "TimeStamp")
   order by "siteID", "TimeStamp"
WITH DATA;

ALTER TABLE events.event_mat_view_hourly
    OWNER TO darmitage;


CREATE UNIQUE INDEX event_mat_view_hourly_key
    ON events.event_mat_view_hourly USING btree
    ("siteID","CoreId", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;



DROP MATERIALIZED VIEW events.event_mat_view_weekly;

CREATE MATERIALIZED VIEW events.event_mat_view_weekly
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."ChargeDifferential"::double precision)::numeric, 3)::double precision AS "ChargeDifferential",
    round(avg("Event"."CH4"::double precision)::numeric, 3)::double precision AS "CH4",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."eCO2"::double precision)::numeric, 3)::double precision AS "eCO2",
   date_trunc('week'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
     "device->site".id AS "siteID",
    device.id AS "CoreId",
   round((device.distance * 3.280839895)::numeric, 0)  AS "distance"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
 WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY  "siteID", device.id, "positionLookupId", "positionLookupName",device.distance, date_trunc('week'::text, "TimeStamp")
   order by "siteID", "TimeStamp"
WITH DATA;

ALTER TABLE events.event_mat_view_weekly
    OWNER TO darmitage;


CREATE UNIQUE INDEX event_mat_view_weekly_key
    ON events.event_mat_view_weekly USING btree
    ("siteID","CoreId", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;




DROP MATERIALIZED VIEW events.event_mat_view_daily;

CREATE MATERIALIZED VIEW events.event_mat_view_daily
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."ChargeDifferential"::double precision)::numeric, 3)::double precision AS "ChargeDifferential",
    round(avg("Event"."CH4"::double precision)::numeric, 3)::double precision AS "CH4",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."eCO2"::double precision)::numeric, 3)::double precision AS "eCO2",
   date_trunc('day'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    "device->site".id AS "siteID",
    device.id AS "CoreId",
    round((device.distance * 3.280839895)::numeric, 3)  AS "distance"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
 WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY   "siteID", device.id, "positionLookupId", "positionLookupName", device.distance, date_trunc('day'::text, "TimeStamp")
   order by "siteID", "TimeStamp"
WITH DATA;

ALTER TABLE events.event_mat_view_daily
    OWNER TO darmitage;


CREATE UNIQUE INDEX event_mat_view_daily_key
    ON events.event_mat_view_daily USING btree
    ("siteID", "CoreId", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;


DROP MATERIALIZED VIEW events.event_mat_view_monthly;

 CREATE MATERIALIZED VIEW events.event_mat_view_monthly
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."eCO2"::double precision)::numeric, 3)::double precision AS "eCO2",
   date_trunc('month'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
     "device->site".id AS "siteID",
    device.id AS "CoreId",
    round((device.distance * 3.280839895)::numeric, 0)  AS "distance"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
 WHERE "Event"."TimeStamp" >= current_date - interval '6 MONTH'
 GROUP BY    "siteID", device.id, "positionLookupId", "positionLookupName", device.distance, date_trunc('month'::text, "TimeStamp")
   order by "siteID", "TimeStamp"
WITH DATA;

ALTER TABLE events.event_mat_view_monthly
    OWNER TO darmitage;



CREATE UNIQUE INDEX event_mat_view_monthly_key
    ON events.event_mat_view_monthly USING btree
    ("siteID","CoreId", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;



DROP MATERIALIZED VIEW events.event_mat_view_quarterly;

CREATE MATERIALIZED VIEW events.event_mat_view_quarterly
TABLESPACE pg_default
AS
 SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."ChargeDifferential"::double precision)::numeric, 3)::double precision AS "ChargeDifferential",
    round(avg("Event"."CH4"::double precision)::numeric, 3)::double precision AS "CH4",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."eCO2"::double precision)::numeric, 3)::double precision AS "eCO2",
    date_trunc('quarter'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    "device->site".id AS "siteID",
    device.id AS "CoreId",
   round((device.distance * 3.280839895)::numeric, 0)  AS "distance"
   FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
 WHERE "Event"."TimeStamp" >= current_date - interval '1 YEAR'
 GROUP BY    "siteID", device.id, "positionLookupId", "positionLookupName", device.distance, date_trunc('quarter'::text, "TimeStamp")
   order by "siteID", "TimeStamp"
WITH DATA;

ALTER TABLE events.event_mat_view_quarterly
    OWNER TO darmitage;


CREATE UNIQUE INDEX event_mat_view_quartery_key
    ON events.event_mat_view_quarterly USING btree
    ("siteID","CoreId", "positionLookupId", "TimeStamp")
    TABLESPACE pg_default;



 REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view_hourly WITH DATA;


 REFRESH MATERIALIZED VIEW CONCURRENTLY events.event_mat_view WITH DATA;

ON CONFLICT ON CONSTRAINT distributors_pkey DO NOTHING;


INSERT INTO events.rollup_events ("tVOC1", "tVOC2", "Battery","Humidity", "TempF",   "WindDirection", "WindSpeed", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId", "distance")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round(avg("Event"."tVOC2")::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    "device->positionLookup".id AS "positionLookupId",
    "device->positionLookup".name AS "positionLookupName",
    date_trunc('minute'::text, "Event"."TimeStamp") AS "TimeStamp",
    "device->site".id AS "siteID",
    device.id AS "CoreId",
    round((device.distance * 3.280839895)::numeric, 0)  AS "distance"
    FROM events.events "Event"
     JOIN (events.devices device
     JOIN events.lookups "device->positionLookup" ON device."position" = "device->positionLookup".id
     JOIN events.sites "device->site" ON device."site_ID" = "device->site".id)
      ON "Event".coreid::text = device.id::text
      WHERE "Event"."TimeStamp" > current_date - interval '6 MONTH'
 GROUP BY   "siteID", device.id,  "positionLookupId", "positionLookupName", device.distance, date_trunc('minute'::text, "TimeStamp")
   order by "siteID", "TimeStamp"

DROP TABLE IF EXISTS events.rollup_view_stat;
DROP TABLE IF EXISTS events.rollup_events;
DROP TABLE IF EXISTS events.rollup_events_hourly;
DROP TABLE IF EXISTS events.rollup_events_daily;
DROP TABLE IF EXISTS events.rollup_events_weekly;
DROP TABLE IF EXISTS events.rollup_events_monthly;
DROP TABLE IF EXISTS events.rollup_events_quarterly;

DROP function IF EXISTS events.update_rollup_events;
DROP function IF EXISTS events.update_rollup_events_daily;
DROP function IF EXISTS events.update_rollup_events_hourly;
DROP function IF EXISTS events.update_rollup_events_weekly;
DROP function IF EXISTS events.update_rollup_events_monthly;
DROP function IF EXISTS events.update_rollup_events_quarterly;


to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400)   as "newtime",

SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400)  AS "TimeStamp",
    "site".id AS "siteID",
device.id AS "CoreId"
    FROM events.events "Event"
JOIN events.sites "site" ON "Event"."site_ID" = site.id
JOIN events.devices device ON "Event".coreid::text = device.id::text
   WHERE   "TimeStamp"::date > date '2019-09-10' 
   GROUP BY  "siteID", device.id,   to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400)

create or replace function events.getlastTime(rollupName text)
returns timestamptz as $$
declare
    lastTime timestamptz;
BEGIN
SELECT "TimeStamp"
FROM events.rollup_view_stat where events.rollup_view_stat.name = rollupName INTO lastTime;
IF lastTime IS NULL THEN
    lastTime := current_date - interval '6 MONTH';
    insert into events.rollup_view_stat (name, "TimeStamp") values (rollupName, lastTime);
END IF;
return lastTime;
END $$
LANGUAGE plpgsql;

create or replace function events.update_rollup_events()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('minute'::text, (lastTime - interval '2 MINUTE'));

execTime := date_trunc('minute'::text, now());

INSERT INTO events.rollup_events ("tVOC1", "tVOC2", "TVOC_PID", "Battery","Humidity", "TempF", "WindDirection", "WindSpeed", "CH4_S", "PM1_0", "PM2_5", "PM10", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."TVOC_PID")::numeric, 3)::double precision AS "TVOC_PID",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."CH4_S")::numeric, 3)::double precision AS "CH4_S",
    round(avg("Event"."PM1_0")::numeric, 3)::double precision AS "PM1_0",
    round(avg("Event"."PM2_5")::numeric, 3)::double precision AS "PM2_5",
    round(avg("Event"."PM10")::numeric, 3)::double precision AS "PM10",
    "positionLookup".id as "positionLookupId",
	"positionLookup".name as "positionLookupName",
	 date_trunc('minute'::text, "Event"."TimeStamp") AS "TimeStamp",
    "site".id AS "siteID",
	device.id AS "CoreId"
    FROM events.events "Event"
	JOIN events.sites "site" ON "Event"."site_ID" = site.id
	JOIN events.devices device ON "Event".coreid::text = device.id::text
	JOIN events.lookups "positionLookup" ON device."position" = "positionLookup".id
   WHERE  "TimeStamp" between queryTime and execTime
   GROUP BY  "siteID", device.id,  "positionLookupId", "positionLookupName", date_trunc('minute'::text, "TimeStamp")
   ON CONFLICT ("siteID", "CoreId", "positionLookupId", "TimeStamp") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "TVOC_PID" = EXCLUDED."TVOC_PID",
   "Battery" = EXCLUDED."Battery",
   "Humidity" = EXCLUDED."Humidity",
   "TempF" = EXCLUDED."TempF",
   "CH4_S" =  EXCLUDED."CH4_S",
   "PM1_0" =  EXCLUDED."PM1_0",
   "PM2_5" =  EXCLUDED."PM2_5",
   "PM10" =  EXCLUDED."PM10",
   "WindDirection" = EXCLUDED."WindDirection",
   "WindSpeed" = EXCLUDED."WindSpeed";

UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;




create or replace function events.update_rollup_events_hourly()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS_HOURLY';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('hour'::text, (lastTime - interval '1 HOUR'));

execTime := date_trunc('hour'::text, now());

INSERT INTO events.rollup_events_hourly ("tVOC1", "tVOC2", "TVOC_PID", "Battery","Humidity", "TempF", "WindDirection", "WindSpeed", "CH4_S",  "PM1_0", "PM2_5", "PM10", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."TVOC_PID")::numeric, 3)::double precision AS "TVOC_PID",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."CH4_S")::numeric, 3)::double precision AS "CH4_S",
    round(avg("Event"."PM1_0")::numeric, 3)::double precision AS "PM1_0",
    round(avg("Event"."PM2_5")::numeric, 3)::double precision AS "PM2_5",
    round(avg("Event"."PM10")::numeric, 3)::double precision AS "PM10",
    "positionLookup".id as "positionLookupId",
	"positionLookup".name as "positionLookupName",
	 date_trunc('hour'::text, "Event"."TimeStamp") AS "TimeStamp",
    "site".id AS "siteID",
	device.id AS "CoreId"
    FROM events.events "Event"
	JOIN events.sites "site" ON "Event"."site_ID" = site.id
	JOIN events.devices device ON "Event".coreid::text = device.id::text
	JOIN events.lookups "positionLookup" ON device."position" = "positionLookup".id
   WHERE  "TimeStamp" between queryTime and execTime
   GROUP BY  "siteID", device.id,  "positionLookupId", "positionLookupName", date_trunc('hour'::text, "TimeStamp")
   ON CONFLICT ("siteID", "CoreId", "positionLookupId", "TimeStamp") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "TVOC_PID" = EXCLUDED."TVOC_PID",
   "Battery" = EXCLUDED."Battery",
   "Humidity" = EXCLUDED."Humidity",
   "CH4_S" =  EXCLUDED."CH4_S",
   "PM1_0" =  EXCLUDED."PM1_0",
   "PM2_5" =  EXCLUDED."PM2_5",
   "PM10" =  EXCLUDED."PM10",
   "TempF" = EXCLUDED."TempF",
   "WindDirection" = EXCLUDED."WindDirection",
   "WindSpeed" = EXCLUDED."WindSpeed";


UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;


create or replace function events.update_rollup_events_group_chart()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS_GROUP_CHART';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('hour'::text, (lastTime - interval '4 HOUR'));

execTime := date_trunc('hour'::text, now());

INSERT INTO events.rollup_events_group_chart ("tVOC1", "tVOC2", "TVOC_PID", "CH4_S",  "PM1_0", "PM2_5", "PM10", "TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
                    round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
                    round(avg("Event"."TVOC_PID")::numeric, 3)::double precision AS "TVOC_PID",
                     round(avg("Event"."CH4_S")::numeric, 3)::double precision AS "CH4_S",
                     round(avg("Event"."PM1_0")::numeric, 3)::double precision AS "PM1_0",
    				 round(avg("Event"."PM2_5")::numeric, 3)::double precision AS "PM2_5",
    				round(avg("Event"."PM10")::numeric, 3)::double precision AS "PM10",
                    to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400)  AS "TimeStamp",
                    "site".id AS "siteID",
                    device.id AS "CoreId"
            FROM events.events "Event"
            JOIN events.sites "site" ON "Event"."site_ID" = site.id
            JOIN events.devices device ON "Event".coreid::text = device.id::text
            WHERE  "TimeStamp" between queryTime and execTime
            GROUP BY  "siteID", device.id, to_timestamp(round(extract(EPOCH from "TimeStamp"::timestamp with time zone)/ 14400)* 14400) order by "TimeStamp" asc
   ON CONFLICT ("siteID", "CoreId","TimeStamp") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "CH4_S" =  EXCLUDED."CH4_S",
   "PM1_0" =  EXCLUDED."PM1_0",
   "PM2_5" =  EXCLUDED."PM2_5",
   "PM10" =  EXCLUDED."PM10",
   "TVOC_PID"= EXCLUDED."TVOC_PID";

UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;


create or replace function events.update_rollup_events_daily()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS_DAILY';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('day'::text, (lastTime - interval '1 DAY'));

execTime := date_trunc('day'::text, now());

INSERT INTO events.rollup_events_daily ("tVOC1", "tVOC2", "TVOC_PID", "Battery","Humidity", "TempF", "WindDirection", "WindSpeed", "CH4_S",  "PM1_0", "PM2_5", "PM10", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
    round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."TVOC_PID")::numeric, 3)::double precision AS "TVOC_PID",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    round(avg("Event"."CH4_S")::numeric, 3)::double precision AS "CH4_S",
    round(avg("Event"."PM1_0")::numeric, 3)::double precision AS "PM1_0",
    round(avg("Event"."PM2_5")::numeric, 3)::double precision AS "PM2_5",
    round(avg("Event"."PM10")::numeric, 3)::double precision AS "PM10",
    "positionLookup".id as "positionLookupId",
	"positionLookup".name as "positionLookupName",
	 date_trunc('day'::text, "Event"."TimeStamp") AS "TimeStamp",
    "site".id AS "siteID",
	device.id AS "CoreId"
    FROM events.events "Event"
	JOIN events.sites "site" ON "Event"."site_ID" = site.id
	JOIN events.devices device ON "Event".coreid::text = device.id::text
	JOIN events.lookups "positionLookup" ON device."position" = "positionLookup".id
    WHERE  "TimeStamp" between queryTime and execTime
    GROUP BY   "siteID", device.id,  "positionLookupId", "positionLookupName", date_trunc('day'::text, "TimeStamp")
   ON CONFLICT ("siteID", "CoreId", "positionLookupId", "TimeStamp") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "TVOC_PID" =  EXCLUDED."TVOC_PID",
   "Battery" = EXCLUDED."Battery",
   "Humidity" = EXCLUDED."Humidity",
   "CH4_S" =  EXCLUDED."CH4_S",
   "PM1_0" =  EXCLUDED."PM1_0",
   "PM2_5" =  EXCLUDED."PM2_5",
   "PM10" =  EXCLUDED."PM10",
   "TempF" = EXCLUDED."TempF",
   "WindDirection" = EXCLUDED."WindDirection",
   "WindSpeed" = EXCLUDED."WindSpeed";


UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;


create or replace function events.update_rollup_events_weekly()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS_WEEKLY';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('week'::text, (lastTime - interval '1 WEEK'));

execTime := date_trunc('week'::text, now());

INSERT INTO events.rollup_events_weekly ("tVOC1", "tVOC2", "Battery","Humidity", "TempF", "WindDirection", "WindSpeed", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
     round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    "positionLookup".id as "positionLookupId",
	"positionLookup".name as "positionLookupName",
	 date_trunc('week'::text, "Event"."TimeStamp") AS "TimeStamp",
    "site".id AS "siteID",
	device.id AS "CoreId"
    FROM events.events "Event"
	JOIN events.sites "site" ON "Event"."site_ID" = site.id
	JOIN events.devices device ON "Event".coreid::text = device.id::text
	JOIN events.lookups "positionLookup" ON device."position" = "positionLookup".id
   WHERE  "TimeStamp" between queryTime and execTime
   GROUP BY   "siteID",  device.id,  "positionLookupId", "positionLookupName", date_trunc('week'::text, "TimeStamp")
   ON CONFLICT ("siteID", "CoreId", "positionLookupId", "TimeStamp", "distance") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "Battery" = EXCLUDED."Battery",
   "Humidity" = EXCLUDED."Humidity",
   "TempF" = EXCLUDED."TempF",
   "WindDirection" = EXCLUDED."WindDirection",
   "WindSpeed" = EXCLUDED."WindSpeed";


UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;


create or replace function events.update_rollup_events_monthly()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS_MONTHLY';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('month'::text, (lastTime - interval '1 MONTH'));

execTime := date_trunc('month'::text, now());

INSERT INTO events.rollup_events_monthly ("tVOC1", "tVOC2", "Battery","Humidity", "TempF", "WindDirection", "WindSpeed", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
     round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
    "positionLookup".id as "positionLookupId",
	"positionLookup".name as "positionLookupName",
	 date_trunc('month'::text, "Event"."TimeStamp") AS "TimeStamp",
    "site".id AS "siteID",
	device.id AS "CoreId"
    FROM events.events "Event"
	JOIN events.sites "site" ON "Event"."site_ID" = site.id
	JOIN events.devices device ON "Event".coreid::text = device.id::text
	JOIN events.lookups "positionLookup" ON device."position" = "positionLookup".id
   WHERE  "TimeStamp" between queryTime and execTime
   GROUP BY   "siteID", device.id,  "positionLookupId", "positionLookupName", date_trunc('month'::text, "TimeStamp")
   ON CONFLICT ("siteID", "CoreId", "positionLookupId", "TimeStamp", "distance") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "Battery" = EXCLUDED."Battery",
   "Humidity" = EXCLUDED."Humidity",
   "TempF" = EXCLUDED."TempF",
   "WindDirection" = EXCLUDED."WindDirection",
   "WindSpeed" = EXCLUDED."WindSpeed";


UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;



create or replace function events.update_rollup_events_quarterly()
returns void as $$
declare
    lastTime timestamptz;
    queryTime timestamptz;
    execTime timestamptz;
    lookupName text;
BEGIN

lookupName := 'ROLLUP_EVENTS_QUARTERLY';

SELECT *
FROM events.getlastTime(lookupName) as timestamp
INTO lastTime;

queryTime := date_trunc('quarter'::text, (lastTime - interval '4 MONTH'));

execTime := date_trunc('quarter'::text, now());

INSERT INTO events.rollup_events_quarterly ("tVOC1", "tVOC2", "Battery","Humidity", "TempF", "WindDirection", "WindSpeed", "positionLookupId", "positionLookupName","TimeStamp", "siteID", "CoreId")
SELECT round((avg("Event"."tVOC1") / 1000)::numeric, 3)::double precision AS "tVOC1",
     round((avg("Event"."tVOC2") / 1000)::numeric, 3)::double precision AS "tVOC2",
    round(avg("Event"."Battery"::double precision)::numeric, 3)::double precision AS "Battery",
    round(avg("Event"."Humidity"::double precision)::numeric, 3)::double precision AS "Humidity",
    round(avg("Event"."TempF")::numeric, 3)::double precision AS "TempF",
    round(avg(case "Event"."WindDirection" when -9999 then 0 else "Event"."WindDirection"::double precision END)::numeric, 3)::double precision AS "WindDirection",
    round(avg((case "Event"."WindSpeed" when -9999 then 0 else "Event"."WindSpeed" END))::numeric, 3)::double precision AS "WindSpeed",
   "positionLookup".id as "positionLookupId",
	"positionLookup".name as "positionLookupName",
	 date_trunc('quarter'::text, "Event"."TimeStamp") AS "TimeStamp",
    "site".id AS "siteID",
	device.id AS "CoreId",
	round(("Event".distance * 3.280839895)::numeric, -1)  AS "distance"
    FROM events.events "Event"
	JOIN events.sites "site" ON "Event"."site_ID" = site.id
	JOIN events.devices device ON "Event".coreid::text = device.id::text
	JOIN events.lookups "positionLookup" ON device."position" = "positionLookup".id
   WHERE  "TimeStamp" between queryTime and execTime
   GROUP BY   "siteID", device.id,  "positionLookupId", "positionLookupName", date_trunc('quarter'::text, "TimeStamp")
   ON CONFLICT ("siteID", "CoreId", "positionLookupId", "TimeStamp") DO UPDATE
   SET "tVOC1" = EXCLUDED."tVOC1",
   "tVOC2" = EXCLUDED."tVOC2",
   "Battery" = EXCLUDED."Battery",
   "Humidity" = EXCLUDED."Humidity",
   "TempF" = EXCLUDED."TempF",
   "WindDirection" = EXCLUDED."WindDirection",
   "WindSpeed" = EXCLUDED."WindSpeed";

UPDATE events.rollup_view_stat  SET "TimeStamp" = execTime WHERE name = lookupName;

END $$
LANGUAGE plpgsql;

select * from events.update_rollup_events();

	alter table events.devices drop column IF EXISTS company_id CASCADE;
	alter table events.devices drop column IF EXISTS coreid CASCADE;
	alter table events.devices drop column IF EXISTS updated_at CASCADE;
	alter table events.devices drop column IF EXISTS RSSI CASCADE;
    alter table events.devices drop column IF EXISTS "mapID" CASCADE;

ALTER TABLE events.devices
    ADD COLUMN lat double precision NOT NULL DEFAULT 0;
	ALTER TABLE events.devices
    ADD COLUMN lng double precision NOT NULL DEFAULT 0;

ALTER TABLE events.devices
    ADD COLUMN board_version character varying(10);
ALTER TABLE events.devices
    ADD COLUMN firmware_version character varying(10);
    
    alter table events.devices drop column IF EXISTS "boardRev" CASCADE;
    alter table events.devices drop column IF EXISTS firmware CASCADE;
    
    ALTER TABLE events.devices
    RENAME COLUMN board_version to "boardRev";
ALTER TABLE events.devices
    RENAME COLUMN firmware_version to firmware;
    
    
    ALTER TABLE events.events
    ADD COLUMN "B1" integer;
	ALTER TABLE events.events
    ADD COLUMN "B2" integer;
    
    ALTER TABLE events.events
    RENAME COLUMN "Resistance" to "R1";
ALTER TABLE events.events
    RENAME COLUMN "tvoc2_Resistivity" to "R2";
    
     ALTER TABLE events.events
    ADD COLUMN "tVOC1raw" double precision;
     ALTER TABLE events.events
    ADD COLUMN "tVOC2raw" double precision;
    
   ALTER TABLE events.collections
    ADD COLUMN "isActive" boolean default true;
    
     ALTER TABLE events.devices
    ADD COLUMN "isLocationLocked" boolean default false;
    
    update  events.devices set type = 'Canary-S' where id = '55002c001850483553353620';
    update  events.devices set type = 'Canary-S' where id = '260025000f47373336373936';
    update  events.devices set type = 'Canary-S' where id = '440034000547373336373936';
    
    update  events.collections set "isActive" = false where id = 7;
    update  events.collections set "isActive" = false where id = 35;
    update  events.collections set "isActive" = false where id = 11;
     update  events.collections set "isActive" = false where id = 9;
      update  events.collections set "isActive" = false where id = 17;
 
 
   alter table events.devices drop column IF EXISTS "lookup_ID" CASCADE;
   alter table events.devices drop column IF EXISTS "active" CASCADE;
   alter table events.devices drop column IF EXISTS "customer_ID" CASCADE;
     ALTER TABLE events.collections
    ADD COLUMN "exceedBaseLine" double precision default 3;
   
   ALTER TABLE events.collections
    ADD COLUMN webhook_url text;
   
----------
 
 ALTER TABLE events.events
    ADD COLUMN "U" integer;
	ALTER TABLE events.events
    ADD COLUMN "IT" integer;
    ALTER TABLE events.events
    ADD COLUMN "ET" integer;
    ALTER TABLE events.events
    ADD COLUMN "IH" integer;
    ALTER TABLE events.events
    ADD COLUMN "EH" integer;
    
   
     ALTER TABLE events.events
    ADD COLUMN "TVOC_PID" double precision;
    
    
    
    ALTER TABLE events.events
    ADD COLUMN "PM1_0" double precision;
     ALTER TABLE events.events
    ADD COLUMN "PM1_5" double precision;
    ALTER TABLE events.events
    ADD COLUMN "PM10" double precision;
    
   
     ALTER TABLE events.events
    ADD COLUMN "TVOC_PID" double precision;
    
    
    ALTER TABLE events.events
    ADD COLUMN "CO" double precision;
     ALTER TABLE events.events
    ADD COLUMN "CO2" double precision;
    ALTER TABLE events.events
    ADD COLUMN "SO2" double precision;
    ALTER TABLE events.events
    ADD COLUMN "O2" double precision;
    ALTER TABLE events.events
    ADD COLUMN "O3" double precision;
    ALTER TABLE events.events
    ADD COLUMN "NO2" double precision;
    ALTER TABLE events.events
    ADD COLUMN "H2S" double precision;
    ALTER TABLE events.events
    ADD COLUMN "CH4_S" double precision;
    ALTER TABLE events.events
    ADD COLUMN "Sig" double precision;
   
   ALTER TABLE events.devices DROP COLUMN IF EXISTS "device_type" CASCADE;
   
   ALTER TABLE events.devices
    ADD COLUMN type character varying(15) default 'Canary-C';
  
   	
   	 ALTER TABLE events.collections
    ADD COLUMN webhook_url text;
    
   
    ALTER TABLE events.events
    RENAME COLUMN "PM1_5" to "PM2_5";
    
    ALTER TABLE events.events
    DROP COLUMN IF EXISTS "created_at" cascade;
    
    ALTER TABLE events.events
    DROP COLUMN  IF EXISTS "updated_at" cascade;
    
    ALTER TABLE events.diagnostics
    DROP COLUMN IF EXISTS "updated_at" cascade;
    
    ALTER TABLE events.alert_notifications
    DROP COLUMN IF EXISTS "updated_at" cascade;
    
    ALTER TABLE events.event_webhook_notifications
    DROP COLUMN IF EXISTS "updated_at" cascade;
    
    ALTER TABLE events.failed_process_logs
    DROP COLUMN IF EXISTS "updated_at" cascade;
    
     ALTER TABLE events.events
    DROP COLUMN IF EXISTS "public" cascade;
 
`;
let canarySData = {
	public: 'false',
	fw_version: 'v0',
	userid: 'Project Canary',
	published_at: '2019-11-08T00:07:04.751Z',
	coreid: '1e0038000247373336373936',
	data: {
		ICCID: '200034000e47373334363431',
		Lat: '39.74157',
		Long: '-105.20193',
		IH: '18.19',
		IT: '78.3',
		P: '831.45',
		Sig: '-103',
		Time: new Date().toISOString(),
		PM1_0: '2.6',
		PM2_5: '4.07',
		PM10: '4.38',
		CO: '2.48',
		CO2: '3.57',
		SO2: '3.6',
	},
	event: 'telemetry',
};

async function getUserList() {
	try {
		let results = await userManagementService.getUserList();
		results.data.forEach(async user => {
			console.log(user);
			if (user.Enabled === true && user.UserStatus === 'CONFIRMED') {
				if (user.Attributes) {
					const emailVerified = user.Attributes.find(
						item => item.Name === 'email_verified',
					);
					if (!emailVerified) {
						console.log('This user is not email verified');
						const emailRow = user.Attributes.find(
							item => item.Name === 'email',
						);
						await userManagementService.confirmUserEmail({
							Username: emailRow.Value,
						});
					}
				}
			}
		});
		console.log('results', 'done');
	} catch (ex) {
		console.log(ex);
	}
}

function sendMail() {
	/*  emailService.sendEmail({
        to: ,
        body: 'Hi How Are You?',
        subject: 'Test Mail',
    });

     QueueManager.addSendMailTask({
        to: config.alerts.support_team_email,
        body: 'Hi How Are You?',
        subject: 'Test Mail',
    });
*/
}

//sendMail();

//getUserList();

async function testStream() {
	let totalCount = 0;
	// console.time('test');
	let stream = await pgPoolService.queryStream(
		'SELECT * FROM events.events limit 10000',
	);
	stream.on('error', error => {
		console.log('Error at pgpool stream', error);
	});
	stream.on('data', () => {
		totalCount++;
	});
	stream.on('end', () => {
		//client.end();
		console.log('stream ended');
		console.log('total row count', totalCount);
		// console.timeEnd('test');
	});
	//stream.pipe(JSONStream.stringify()).pipe(process.stdout);

	//pool

	// await client1.connect();
}

async function updateEventSiteIds() {
	return new Promise(async (resolve, reject) => {
		let deviceMap = {};
		let siteMap = {};
		let positionLookupMap = {};

		let deviceDomain = await DomainLookup.findOne({
			where: { name: 'POSITION' },
			//defaults: { name: 'POSITION' },
			raw: true,
		});

		let lookupData = await Lookup.findAll({
			where: {
				// name: compassDirection.symbol,
				domainID: deviceDomain.id,
			},
			// attributes: ['id'],
			raw: true,
		});

		lookupData.map(item => {
			positionLookupMap[item.name.toString()] = item;
		});
		//console.dir(positionLookupMap);
		//return;
		let sites = await Site.findAll({
			include: [
				{
					model: Map,
					as: 'site_map',
					// where: { lookup_ID: 57 },
					//orderBy: ['timestamp', 'desc'],
					//limit: 1,
				},
			],
		});
		sites = sites.map(item => item.toJSON());
		sites.map(item => {
			siteMap[item.id.toString()] = item;
		});
		//console.log('siteMap', siteMap);
		let devices = await Device.findAll({
			include: [
				{
					model: Site,
					//attributes: ['name', 'id', 'collection_ID'],
					as: 'site',
				},
				{
					model: Activity,
					as: 'activites',
					where: { lookup_ID: 57 },
					orderBy: ['timestamp', 'desc'],
					//limit: 1,
				},
			],
			where: {
				id: '32002e000d50483553353920',
			},
		});
		devices.forEach(async device => {
			let deviceItem = device.toJSON();
			// console.log('deviceItem', deviceItem);
			deviceMap[deviceItem.id] = deviceItem;
			if (!deviceItem.last_reported_time) {
				// console.log('last_reported_time is null');
				//console.log(deviceItem, time);
				/*let result = await Device.update(
                {
                    last_reported_time: deviceItem.created_at,
                },
                {
                    where: {
                        id: deviceItem.id,
                    },
                },
            );
            console.log('result', result);
            console.log(deviceItem.id);*/
			}
			/* if (deviceItem.site) {
            let time = deviceItem.created_at;
            if (
                moment(deviceItem.site.created_at).isAfter(
                    moment(deviceItem.created_at),
                )
            ) {
                time = deviceItem.created_at;
            }
            if (deviceItem.activites && deviceItem.activites.length > 0) {
                time =
                    deviceItem.activites[deviceItem.activites.length - 1]
                        .timestamp;
            }
            /!*  if (deviceItem.id === '420031000947373336373936') {
                console.log(deviceItem, time);
                // console.log('result', result);
                deviceMap[device.id] = deviceItem;
            } else {
                console.log(deviceItem.id, time);
                // console.log('result', result);
                deviceMap[device.id] = deviceItem;
            }*!/
        }*/
		});
		//console.dir(deviceMap);
		//let devCount = await Event.count({ site_ID: null });
		//console.log('devCount', devCount);
		let totalCount = 0;
		let tobeUpdatedList = [];
		//and coreid = '32002e000d50483553353920'
		let stream = await pgPoolService.queryStream(
			`SELECT * FROM events.events where events."site_ID" is not null and distance is null and position is null  order by "TimeStamp" desc limit 1000`,
		);
		stream.on('error', error => {
			console.log('Error at pgpool stream', error);
		});

		stream.on('data', async data => {
			totalCount++;
			let bearing = null;
			let distance = null;
			let compassDirection = null;
			//console.log('data', data);
			let siteItem = data.site_ID && siteMap[data.site_ID.toString()];
			// console.log(siteItem);
			let lat, lng;
			lat = siteItem && siteItem.site_map && siteItem.site_map.lat;
			lng = siteItem && siteItem.site_map && siteItem.site_map.lng;
			const Latitude = data.Latitude;
			const Longitude = data.Longitude;
			console.log(
				'Latitude && Longitude && lat && lng',
				Latitude,
				Longitude,
				lat,
				lng,
			);
			if (Latitude && Longitude && lat && lng) {
				const destPosition = {
					lat: Latitude,
					lng: Longitude,
				};
				const sourcePosition = { lat: lat, lng: lng };
				bearing = locationCalculationHelper.calculateBearing(
					sourcePosition,
					destPosition,
				);
				distance = locationCalculationHelper.measureDistance(
					sourcePosition,
					destPosition,
				);
				compassDirection = windrose.getPoint(bearing, { depth: 2 });
				if (
					compassDirection &&
					compassDirection.symbol &&
					positionLookupMap[compassDirection.symbol]
				) {
					tobeUpdatedList.push({
						id: data.id,
						distance: distance,
						position: positionLookupMap[compassDirection.symbol].id,
					});
				}
				console.log(
					'bearing, distance, compassDirection',
					bearing,
					distance,
					compassDirection,
				);
			}

			/* let deviceitem = deviceMap[data.coreid.toString()];

        if (
            deviceitem &&
            deviceitem.activites &&
            deviceitem.activites.length > 0
        ) {
            let TimeStamp = new Date(data.TimeStamp);
        }
        if (data.site_ID === null) {
            if (
                data.coreid &&
                deviceMap[data.coreid] &&
                deviceMap[data.coreid].site
            ) {
                if (
                    moment(new Date(data.TimeStamp)).isAfter(
                        moment(deviceMap[data.coreid].site.created_at),
                    )
                ) {
                    tobeUpdatedList.push({
                        id: data.id,
                        site_ID: deviceMap[data.coreid].site.id,
                    });
                    //return true;

                    // console.log('data', data, deviceMap[data.coreid]);
                } else {
                    // console.log('isAfter condition failed');
                }
            }
        }*/
		});
		stream.on('end', () => {
			//client.end();
			let _promises = [];
			console.log(
				'stream ended',
				tobeUpdatedList.length,
				'to update found',
			);
			tobeUpdatedList.forEach(function(listItem) {
				console.log('listItem', listItem);
				_promises.push(
					Event.update(
						{
							position: listItem.position,
							distance: listItem.distance,
						},
						{
							where: {
								id: listItem.id,
							},
							//transaction: transaction,
						},
					),
				);
			});

			// await transaction.commit();
			// console.log('total row count', totalCount, ' All ended');
			Promise.all(_promises)
				.then(() => {
					console.log('total row count', totalCount, ' All ended');
					//return transaction.commit();
					tobeUpdatedList = [];
					_promises = [];
					resolve();
				})
				.catch(err => {
					//transaction.rollback();
					console.log('Error at execution', err);
					reject(err);
				});

			// console.timeEnd('test');
		});
	});
}

/*
setTimeout(() => {
    testStream();
}, 100);

setTimeout(() => {
    testStream();
}, 500);

setTimeout(() => {
    testStream();
}, 700);

setTimeout(() => {
    testStream();
}, 800);

setTimeout(() => {
    testStream();
}, 900);
*/

//testQuery();
/*
setTimeout(() => {
    let ranges = new Array(5000);

    for (let i = 0; i < 5000; i++) {
        ranges[i] = i;
    }
    console.log(ranges);
    async.forEachOfSeries(
        ranges,
        function(dt, done) {
            setImmediate(() => {
                console.log('loop', dt);
                updateEventSiteIds()
                    .then(() => {
                        done();
                    })
                    .catch(err => {
                        done();
                    });
            });
        },
        function(err) {
            console.log('All done', err);
        },
    );
}, 10000);*/

// await updateEventSiteIds();

async function testDevMail() {
	let _promises = [];
	_promises.push(redisService.ping());
	_promises.push(dbModels.ping());
	await Promise.all(_promises).catch(err => {
		console.log('Error at pinging: ', err);
	});
	console.log('Pinging worked!');
}

async function updateFailedProcesses() {
	let _promises = [];
	let results = await FailedProcessLog.findAll({ raw: true });
	results.forEach(function(item) {
		if (item.event === 'EVENT_RECEIVE') {
			let body = JSON.parse(item.body);
			//console.log('body', body);
			_promises.push(
				eventService
					.receive(body)
					.then(() =>
						FailedProcessLog.destroy({ where: { id: item.id } }),
					),
			);
		} else if (item.event === 'DEVICE_RECEIVE') {
			let body = JSON.parse(item.body);
			//console.log('body', body);
			_promises.push(
				deviceService
					.receive(body)
					.then(() =>
						FailedProcessLog.destroy({ where: { id: item.id } }),
					)
					.catch(err => {
						console.log(err);
						return Promise.resolve(true);
					}),
			);
		}
		// console.log(item);
	});
	await Promise.all(_promises)
		.then(() => {
			console.log('All data inserted');
		})
		.catch(err => {
			console.log('Error at pinging: ', err);
		});
}

async function updateDeviceLatLng() {
	let _promises = [];
	let results = await Device.findAll({
		include: [
			{ model: Lookup, as: 'firmwareLookup', required: false },
			{ model: Lookup, as: 'boardRevLookup', required: false },
		],
	});
	results.forEach(function(item) {
		let _item = item.toJSON();
		console.log(_item);
		let updateObj = {};

		if (_item.firmwareLookup && _item.firmwareLookup.name) {
			updateObj.firmware_version = _item.firmwareLookup.name;
		}

		if (_item.boardRevLookup && _item.boardRevLookup.name) {
			updateObj.board_version = _item.boardRevLookup.name;
		}

		_promises.push(
			Device.update(
				updateObj,
				{
					where: {
						id: _item.id,
					},
					omitNull: false,
				},
				//transaction: transaction,
			),
		);
	});
	await Promise.all(_promises)
		.then(() => {
			console.log('All data inserted');
		})
		.catch(err => {
			console.log('Error at pinging: ', err);
		});
}

async function updateFirstStageBadEventDataTvoc1() {
	return new Promise(async (resolve, reject) => {
		let rowCount = 0;
		//and (fw_version::int < 89 or fw_version::int = 98)
		let stream = await pgPoolService.queryStream(
			`SELECT * FROM events.events where "TimeStamp" > '2019-10-17' and "tVOC1" > 1000 AND "tVOC1" < 5000`,
		);
		stream.on('error', error => {
			console.log('Error at pgpool stream', error);
			resolve();
		});
		stream.on('data', async function(data) {
			console.log(data.tVOC1);
			rowCount++;
			await Event.update(
				{
					// tVOC1: data.tVOC1 / 32,
					tVOC1: data.tVOC1 / 32,
				},
				{
					where: {
						id: data.id,
					},
				},
			);
			console.log('done');
		});
		stream.on('end', () => {
			//client.end();
			console.log('stream ended');
			console.log('total row count', rowCount);
			// console.timeEnd('test');
			resolve();
		});
	});

	//`SELECT * FROM events.events where "TimeStamp" > '2019-10-4' AND "tVOC1" > 1000 AND "tVOC1" < 5000`,
	// tVOC1: data.tVOC1 / 32,

	// SELECT * FROM events.events WHERE “TimeStamp” > ‘2019-10-4’ AND “tVOC1" > ‘1000’ AND “tVOC1” < ‘5000’ ;
}

async function updateSecondStageBadEventDataTvoc1() {
	return new Promise(async (resolve, reject) => {
		let rowCount = 0;
		//and (fw_version::int < 89 or fw_version::int = 98)
		let stream = await pgPoolService.queryStream(
			`SELECT * FROM events.events where "TimeStamp" > '2019-10-17' and "tVOC1" > 5000`,
		);
		stream.on('error', error => {
			console.log('Error at pgpool stream', error);
			resolve();
		});
		stream.on('data', async function(data) {
			console.log(data.tVOC1);
			rowCount++;
			await Event.update(
				{
					tVOC1: data.tVOC1 / 134,
				},
				{
					where: {
						id: data.id,
					},
				},
			);
			console.log('done');
		});
		stream.on('end', () => {
			//client.end();
			console.log('stream ended');
			console.log('total row count', rowCount);
			// console.timeEnd('test');
			resolve();
		});
	});

	//`SELECT * FROM events.events where "TimeStamp" > '2019-10-4' AND "tVOC1" > 1000 AND "tVOC1" < 5000`,
	// tVOC1: data.tVOC1 / 32,

	// SELECT * FROM events.events WHERE “TimeStamp” > ‘2019-10-4’ AND “tVOC1" > ‘1000’ AND “tVOC1” < ‘5000’ ;
}

async function updateFirstStageBadEventData() {
	return new Promise(async (resolve, reject) => {
		let rowCount = 0;
		// and (fw_version::int < 89 or fw_version::int = 98)
		let stream = await pgPoolService.queryStream(
			`SELECT * FROM events.events where "TimeStamp" > '2019-10-17' and "tVOC2" > 1000 AND "tVOC2" < 5000`,
		);
		stream.on('error', error => {
			console.log('Error at pgpool stream', error);
			resolve();
		});
		stream.on('data', async function(data) {
			console.log(data.tVOC2);
			rowCount++;
			await Event.update(
				{
					// tVOC1: data.tVOC1 / 32,
					tVOC2: data.tVOC2 / 32,
				},
				{
					where: {
						id: data.id,
					},
				},
			);
			console.log('done');
		});
		stream.on('end', () => {
			//client.end();
			console.log('stream ended');
			console.log('total row count', rowCount);
			// console.timeEnd('test');
			resolve();
		});
	});

	//`SELECT * FROM events.events where "TimeStamp" > '2019-10-4' AND "tVOC1" > 1000 AND "tVOC1" < 5000`,
	// tVOC1: data.tVOC1 / 32,

	// SELECT * FROM events.events WHERE “TimeStamp” > ‘2019-10-4’ AND “tVOC1" > ‘1000’ AND “tVOC1” < ‘5000’ ;
}

async function updateSecondStageBadEventData() {
	return new Promise(async (resolve, reject) => {
		let rowCount = 0;
		//and (fw_version::int < 89 or fw_version::int = 98)
		let stream = await pgPoolService.queryStream(
			`SELECT * FROM events.events where "TimeStamp" > '2019-10-17' and "tVOC2" > 5000`,
		);
		stream.on('error', error => {
			console.log('Error at pgpool stream', error);
			resolve();
		});
		stream.on('data', async function(data) {
			console.log(data.tVOC2);
			rowCount++;
			await Event.update(
				{
					tVOC2: data.tVOC2 / 134,
				},
				{
					where: {
						id: data.id,
					},
				},
			);
			console.log('done');
		});
		stream.on('end', () => {
			//client.end();
			console.log('stream ended');
			console.log('total row count', rowCount);
			// console.timeEnd('test');
			resolve();
		});
	});

	//`SELECT * FROM events.events where "TimeStamp" > '2019-10-4' AND "tVOC1" > 1000 AND "tVOC1" < 5000`,
	// tVOC1: data.tVOC1 / 32,

	// SELECT * FROM events.events WHERE “TimeStamp” > ‘2019-10-4’ AND “tVOC1" > ‘1000’ AND “tVOC1” < ‘5000’ ;
}

setTimeout(() => {
	// updateFailedProcesses();
}, 10000);

//testDevMail();
//updateDeviceLatLng();

setTimeout(async () => {
	/*updateFailedProcesses();
    console.log('running updateFirstStageBadEventDataTvoc1')
    await updateFirstStageBadEventDataTvoc1();
    console.log('running updateSecondStageBadEventDataTvoc1')
    await updateSecondStageBadEventDataTvoc1();
    console.log('running updateFirstStageBadEventData')
    await updateFirstStageBadEventData();
    console.log('running updateSecondStageBadEventData');
    await updateSecondStageBadEventData();
    console.log('finished running data correction')
    await adminTools.refreshViews();
    console.log('All Process done');*/
}, 10000);
/*
setTimeout(async () => {
	await deviceSuccessRateService.calculateSuccessRate();
	let lastHour = subHours(new Date(), 1);
	let eventCount = await Event.count({
		where: {
			coreid: '2e0043000750483553353520',
			TimeStamp: { [Op.gte]: lastHour },
		},
	});

	let device = await Device.findByPk('2e0043000750483553353520');
	console.log('Device', device.toJSON());
	let logsCount = await DeviceLog.count({
		where: {
			coreid: '2e0043000750483553353520',
			TimeStamp: { [Op.gte]: lastHour },
		},
	});

	let diagnosticCount = await Diagnostic.count({
		where: {
			coreid: '2e0043000750483553353520',
			TimeStamp: { [Op.gte]: lastHour },
		},
	});

	console.log(
		'eventCount, logsCount, diagnosticCount',
		eventCount,
		logsCount,
		diagnosticCount,
	);
}, 5000);*/

async function testAlertConfig() {
	let sessionUser = {
		email: 'thebapi@gmail.com',
	};
	let testData = {
		email_addresses: ['thebapi@gmail.com', 'sajibsarkar@gmail.com'],
		notes: '',
		company_id: 1,
		templateBody: 'Test Data',
		conditions: [
			{
				property: 'TempF',
				op: 'GTE',
				value: 10,
				rawValue: 4000,
			},
		],
	};
	await AlertNotification.destroy({ where: {} });
	let params = { coreid: '45004d001050483553353520' };
	QueueManager.checkEventAlertTask(params);
}

async function testDeviceDataS3Upload() {
	let data = {
		event: 'device',
		data: {
			id: '21004c000b50483553353520',
			imei: '352753095608186',
			iccid: '89014103271229669716',
			firmware: 83,
			board: 4,
		},
		coreid: '21004c000b50483553353520',
		published_at: '2019-11-04T20:10:19.286Z',
		userid: '546bcbca907edf076e000de8',
		fw_version: '83',
		public: 'false',
	};

	let result = await s3FileServer.uploadJsonData(data, {
		bucketName: 'device-payloads',
		key: data.coreid,
	});
	console.log('result', result);
}

async function testEventDataS3Upload() {
	let data = {
		public: 'false',
		fw_version: 'v0',
		userid: 'Project Canary',
		published_at: '2019-11-09T18:03:02.201Z',
		coreid: '17002b001147373336373936',
		data: {
			ICCID: '3f0024000647373432363837',
			Time: '2019-11-09T18:02:01Z',
			Sig: '-73',
			WD: '-1',
			WS: '-1',
			Long: '-105.19942',
			Lat: '39.74061',
			IH: '6.37',
			IT: '86.77',
			P: '824.74',
			CH4: '',
			TVOC: '0.153',
		},
		event: 'telemetry',
	};
	await eventService.receive(data, {});
}
setTimeout(async () => {
	//	let data = await eventService.receive(canarySData, {});
	//console.log('data', data);
}, 2000);
//testAlertConfig();
/*

s3FileServer
    .uploadFile(path.join(__dirname, 'config.js'), {
        bucketName: config.dbBackupBucketName,
    })
    .then(result => {
        console.log(result);
    });
*/

let keys = [
	'U',
	'IT',
	'ET',
	'IH',
	'EH',
	'P',
	'TVOC_PID',
	'PM1_0',
	'PM1_5',
	'PM10',
	'CO',
	'CO2',
	'SO2',
	'O2',
	'O3',
	'NO2',
	'H2S',
	'CH4_S',
	'Sig',
];

let newFieldArray = keys.map(item => {
	return {
		name: `${item}`,
		sortName: `${item}`,
		isVisible: false,
		label: `${item}`,
		type: 'number',
		align: 'center',
		isAdminOnly: true,
	};
});
console.log(newFieldArray);

async function testActivityPayload() {
	let firstPayload = {
		data: {
			coreid: '250043001850483553353620',
			TS: '2019-11-18T20:56:32Z',
			user: 'darmitage@projectcanary.com',
			activity: 'POWER_DOWN',
			notes: 'Had to power it down for maintenance',
			show: 'true',
		},
	};

	let secondPayload = {
		data: {
			site_id: '112',
			TS: '2019-11-18T20:56:32Z',
			user: 'darmitage@projectcanary.com',
			activity: 'DEVICE_POWERED_DOWN',
			notes: 'site activity note',
			show: 'true',
		},
	};

	let resultOne = await deviceLogsService.receiveActivity(firstPayload);
	console.log('resultOne', resultOne);
	let resultTwo = await deviceLogsService.receiveActivity(secondPayload);
	console.log('resultTwo', resultTwo);
}

setTimeout(async () => {
	//await testEventDataS3Upload();
	// QueueManager.addDbBackupTask();
	//await adminTools.backupDBIntoS3();
	await testEventDataS3Upload();
	/*
	await collectionService.findOne(19, {});
	console.time('coll_cache');
	let companyData = await redisService.get(`collection_cache:${19}`);
	console.timeEnd('coll_cache');*/
	//await updateFailedProcesses();
	//await testActivityPayload();
}, 10000);

process.on('uncaughtException', function(err) {
	console.log('Caught uncaughtException: ');
	console.log(err);
	process.exit(1);
});

process.on('unhandledRejection', function(err) {
	console.log('Caught unhandledRejection: ');
	console.log(err);
	// process.exit(1);
});
