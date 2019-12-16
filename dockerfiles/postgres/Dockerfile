FROM thebapi/ubuntu-base:latest

FROM postgres:11.1 as postgres

COPY /dockerfiles/postgres/* ./
RUN ls -a
COPY dockerfiles/postgres/setup.sql /docker-entrypoint-initdb.d/1_setup.sql
#COPY data/sqls/db_schema.sql /docker-entrypoint-initdb.d/2_db_schema.sql
#COPY data/sqls/initial_data.sql /docker-entrypoint-initdb.d/3_initial_data.sql




#COPY --from=base ./* ./
#RUN mkdir -p /var/lib/postgresql
##RUN mkdir -p /var/run/postgresql

COPY /dockerfiles/postgres/* ./

WORKDIR  /

WORKDIR  /
RUN ls

##RUN cp ./runit/postgres.sh  -p /etc/my_init.d/postgres.sh

ENV LANG en_US.utf8

RUN ls
RUN mkdir -p pd_build
RUN mkdir -p runit
# RUN cp ./buildconfig ./pd_build/
# RUN cp ./postgressetup.sh ./pd_build/

# WORKDIR /pd_build

# RUN chmod +x postgressetup.sh
# RUN ./postgressetup.sh
#RUN cp ./entrypoint.sh /bin/docker-entrypoint.sh
#RUN ln -s /bin/entrypoint.sh / # backwards compat
#RUN chmod +x /bin/docker-entrypoint.sh
WORKDIR  /

RUN ls

RUN mkdir -p /etc/service/postgres

RUN cp ./postgres.sh /etc/service/postgres/run
RUN chmod +x /etc/service/postgres/run
#COPY /dockerfiles/postgres/runit/postgres.sh /etc/my_init.d/90_postgres.sh
#RUN chmod +x /etc/my_init.d/90_postgres.sh


RUN ulimit -n

RUN apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

##CMD ["postgres"]
EXPOSE 5432