FROM thebapi/ubuntu-base:latest

COPY . /pd_build

RUN mkdir -p /etc/service/redis

RUN cp /pd_build/runit/redis.sh /etc/service/redis/run
RUN chmod +x /etc/service/redis/run


RUN cp /pd_build/config/redis.conf /etc/service/redis/redis.conf

RUN mkdir -p /etc/my_init.d/
COPY rc.local /etc/my_init.d/rc.local
COPY limit.conf /etc/my_init/10_limit.conf


WORKDIR /pd_build

RUN chmod +x redissetup.sh
RUN ./redissetup.sh



COPY somaxconn /proc/sys/net/core/somaxconn

#VOLUME ["/proc/sys/net/core/somaxconn"]

##WORKDIR /proc/sys/net/core/

WORKDIR  /redis

RUN ulimit -Hn -Sn

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*