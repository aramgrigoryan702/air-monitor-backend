#!/bin/bash
set -e
source /pd_build/buildconfig

header "Installing Postgres..."

## Install Redis.
#run go get github.com/chzyer/readline
run ls
#run apt-get install libjson0-dev
#run apt-get install libprotobuf-c-dev protobuf-c-compiler
run minimal_apt_get_install build-essential
## Bundler has to be able to pull dependencies from git.
run minimal_apt_get_install g++ \
  gcc \
  wget \
  git \
  sudo \
  libc6-dev \
  make

run wget https://download.osgeo.org/postgis/source/postgis-2.5.2.tar.gz
run tar -xvzf postgis-2.5.2.tar.gz
run cd postgis-2.5.2
run ./configure
run make
run make install
##run mkdir /etc/service/postgres
##run cp /runit/postgres.sh -p /etc/service/postgres/run
#run cd ./utils
#run ./install_server.sh
#run make
#run mkdir /var/run/redis
#run cp -avr /pd_build/redis-5.0.3/ /var/run/redis
#run cp /pd_build/runit/redis.sh -p /etc/my_init.d/
#run mkdir /etc/service/redis
#run cp /pd_build/config/redis.conf /etc/redis/redis.conf
#run touch /proc/sys/fs/file-max
#run sysctl -p -w fs.file-max=100000