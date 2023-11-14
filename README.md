# rpl_stake_watcher
Monitor RPL stake and alert to a discord webhook if running low

# dependencies
nodejs 18.x or docker and docker-compose

# quick start
1) Copy the env-template to .env: `cp env-template .env`
2) Edit .env with YOUR beaconcha.in api key, discord webhook, and validator indices (or public keys).

## nodejs
1) Install dependencies: `npm install`
2) Start the app: `node app.js`

## docker
1) Build the image: `docker-compose build`
2) Start with docker-compose: `docker-compose up`

