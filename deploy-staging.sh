#!/bin/bash
set -e

# docker swarm init
# docker service rm registry
# docker service create --name registry --publish published=5000,target=5000 registry:2
# sleep 2
# docker stack rm services projectcanary
sleep 2
docker-compose build --force-rm
sleep 2
docker stack deploy  -c docker-compose-staging.yml projectcanary --resolve-image "never" --prune
#docker stack deploy  -c docker-compose.yml projectcanary --prune
#sleep 10
#docker kill $(docker ps -f name=projectcanary-app -q)
#sleep 2
#docker kill $(docker ps -f name=projectcanary-worker -q)
sleep 10
#docker system prune --volumes -f
#docker system prune dangling=true -f
#sleep 5
docker stack services projectcanary
