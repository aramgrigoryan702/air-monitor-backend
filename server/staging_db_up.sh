#!/bin/bash
set -e

docker run -it --rm postgres:11.4  /bin/bash -c 'PGPASSWORD="Terrafirma1" pg_dump  --clean  -T "events.rollup_*"  --schema "events" --verbose -h projectcanary-new.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -p 5432  -U darmitage projectcanary > ~/projectcanary.bak && cat  ~/projectcanary.bak  | PGPASSWORD="Terrafirma1"  psql -p 5432  -U darmitage -h projectcanary-staging.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -d projectcanary'

docker run -it --rm postgres:11.5  /bin/bash -c 'PGPASSWORD="Terrafirma1" pg_dump  --clean -T "events.rollup_*"  --schema "events" --verbose -h projectcanary-new.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -p 5432  -U darmitage projectcanary > ~/projectcanary.bak && cat  ~/projectcanary.bak  | PGPASSWORD="Terrafirma1"  psql -p 5432  -U darmitage -h projectcanary-staging.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -d projectcanary'


docker run -it --rm postgres:11.5  /bin/bash -c 'PGPASSWORD="Terrafirma1" pg_dump  --clean  --schema "events" --verbose -h projectcanary-new.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -p 5432  -U darmitage projectcanary > ~/projectcanary.bak && cat  ~/projectcanary.bak  | PGPASSWORD="Terrafirma1"  psql -p 5432  -U darmitage -h projectcanary-staging.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -d projectcanary'

PGPASSWORD="Terrafirma1" pg_dump  --clean  --schema "events" --verbose -h projectcanary-staging.c9k4o2ye2hkg.us-east-2.rds.amazonaws.com -p 5432  -U darmitage projectcanary > ~/projectcanary.bak
