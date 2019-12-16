-- noinspection SqlNoDataSourceInspectionForFile
CREATE EXTENSION IF NOT EXISTS hstore;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
--  CREATE EXTENSION IF NOT EXISTS postgis;
-- Enable DBLink:
CREATE EXTENSION IF NOT EXISTS dblink;
-- Enable pg_buffercache:
CREATE EXTENSION IF NOT EXISTS pg_buffercache;
CREATE EXTENSION IF NOT EXISTS pg_prewarm;
CREATE SCHEMA events;


