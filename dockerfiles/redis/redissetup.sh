#!/bin/bash
set -e
source /pd_build/buildconfig

header "Installing Redis..."

## Install Redis.
#run apt-get install -y redis-server libhiredis-dev
run wget http://download.redis.io/releases/redis-5.0.3.tar.gz
run tar xzf redis-5.0.3.tar.gz
run ls
run cd redis-5.0.3
#run make
run make install
run cd ./utils
run ./install_server.sh
#run make
run cd ..
run cd ..
run ls
run rm ./redis-5.0.3.tar.gz
##run mkdir  /var/run/redis
#run cp  -r ./ /var/run/redis
#run mkdir /etc/service/redis
#run mkdir /etc/service/redis/run


#run cp /pd_build/runit/redis.sh  /etc/service/redis/run
#run chmod +x /etc/service/redis/run
#run touch /proc/sys/fs/file-max
#run sysctl -p -w fs.file-max=100000