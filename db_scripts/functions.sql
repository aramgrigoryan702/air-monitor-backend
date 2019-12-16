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