    ---November 27, 2019
ALTER TABLE events.activities
	ADD COLUMN company_id integer;

ALTER TABLE events.activities
    ADD COLUMN operational_unit_id integer;

ALTER TABLE events.activities
    ADD COLUMN site_id integer;

UPDATE events.activities AS "Activity"
SET (site_id, operational_unit_id, company_id) =
(
	SELECT "Sites"."id", "Sites"."collection_ID", "Collections"."parentID"
	FROM events.sites AS "Sites", events.collections AS "Collections"
	WHERE
	"Sites"."id" = (
		SELECT "Devices"."site_ID" FROM events.devices AS "Devices"
		WHERE "Devices"."id" = "Activity"."device_id"
	)
	AND
	"Collections"."id" = (
		SELECT "Sites"."collection_ID" FROM events.sites AS "Sites"
		WHERE "Sites"."id" = (
			SELECT "Devices"."site_ID" FROM events.devices AS "Devices"
			WHERE "Devices"."id" = "Activity"."device_id"
		)
	)
)
FROM (
	SELECT DISTINCT ON ("Activities"."device_id")
	"Activities"."updated_at" as updatedAt, "Activities"."device_id" as deviceId
	FROM events.activities as "Activities"
	WHERE "Activities"."lookup_ID" = 57
	order by "Activities"."device_id", "Activities"."updated_at" desc
) as subquery
WHERE "Activity"."updated_at" >= subquery.updatedAt
	AND "Activity"."device_id" = subquery.deviceId;


    --- November 17, 2019

ALTER TABLE events.rollup_events
    ADD COLUMN "CH4_S" double precision;

ALTER TABLE events.rollup_events_hourly
    ADD COLUMN "CH4_S" double precision;

ALTER TABLE events.rollup_events_daily
    ADD COLUMN "CH4_S" double precision;

ALTER TABLE events.rollup_events_group_chart
    ADD COLUMN "CH4_S" double precision;

 --- November 18, 2019

 ALTER TABLE events.rollup_events
    ADD COLUMN "PM1_0" double precision;

ALTER TABLE events.rollup_events_hourly
    ADD COLUMN "PM1_0" double precision;

ALTER TABLE events.rollup_events_daily
    ADD COLUMN "PM1_0" double precision;

ALTER TABLE events.rollup_events_group_chart
    ADD COLUMN "PM1_0" double precision;

ALTER TABLE events.rollup_events
    ADD COLUMN "PM2_5" double precision;

ALTER TABLE events.rollup_events_hourly
    ADD COLUMN "PM2_5" double precision;

ALTER TABLE events.rollup_events_daily
    ADD COLUMN "PM2_5" double precision;

ALTER TABLE events.rollup_events_group_chart
    ADD COLUMN "PM2_5" double precision;

ALTER TABLE events.rollup_events
    ADD COLUMN "PM10" double precision;

ALTER TABLE events.rollup_events_hourly
    ADD COLUMN "PM10" double precision;

ALTER TABLE events.rollup_events_daily
    ADD COLUMN "PM10" double precision;

ALTER TABLE events.rollup_events_group_chart
    ADD COLUMN "PM10" double precision;

--November 19, 2019
ALTER TABLE events.activities
    ADD COLUMN show boolean default false;


-- November 26, 2019

ALTER TABLE events.event_webhook_notifications
    DROP COLUMN "event_ID" cascade;

ALTER TABLE events.event_webhook_notifications
    ADD COLUMN "coreid" character varying(50);

ALTER TABLE events.event_webhook_notifications
    ADD COLUMN "requestBody" json;


UPDATE events.devices set type = 'Canary-S' where id = '290035001950483553353620';
UPDATE events.devices set type = 'Canary-S' where id = '320021000f47373336373936';
UPDATE events.devices set type = 'Canary-S' where id = '2f001f001550483553353620';
