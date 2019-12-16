#!/bin/sh
set -e
source /pd_build/buildconfig


RUNDIR=/var/run/postgresql
PIDFILE=$RUNDIR/postgresql.pid

mkdir -p $RUNDIR
touch $PIDFILE
#chown postgres:postgres $RUNDIR $PIDFILE
chmod 755 $RUNDIR
#-u postgres
run ls
exec chpst postgres