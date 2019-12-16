#!/bin/sh
set -e

RUNDIR=/var/run/redis
PIDFILE=$RUNDIR/redis.pid

mkdir -p $RUNDIR
chmod 755 $RUNDIR

cp -r /redis $RUNDIR
touch $PIDFILE
#-u redis
ulimit -Hn -Sn
exec chpst redis-server /etc/service/redis/redis.conf