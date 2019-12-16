#!/bin/bash
set -e
# docker swarm init
sleep 2
$(aws ecr get-login --no-include-email --region us-east-2)
sleep 2
docker build -t project_canary_api:latest  --compress  --force-rm  --shm-size 2g --ulimit nofile=1024:65536 --ulimit nproc=16384 --ulimit stack=10485760:33554432 --ulimit memlock=137438953472   -f dockerfiles/projectcanary/Dockerfile .
sleep 2
docker build -t project_canary_api:latest  --compress  --force-rm  --shm-size 2g --ulimit nofile=1024:65536 --ulimit nproc=16384 --ulimit stack=10485760:33554432 --ulimit memlock=137438953472   -f dockerfiles/projectcanary/Dockerfile .
ag project_canary_api:latest 254059751411.dkr.ecr.us-east-2.amazonaws.com/project_canary_api:latest
sleep 5
docker push 254059751411.dkr.ecr.us-east-2.amazonaws.com/project_canary_api:latest
