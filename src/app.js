require('dotenv').config();

// Check required environment variables
if (!process.env.VALIDATOR_IDS || !process.env.BEACONCHA_API_KEY || !process.env.DISCORD_WEBHOOK_URL || !process.env.CHECK_INTERVAL) {
  console.error('Missing required environment variable(s). Please check the README for instructions on how to set them.');
  process.exit(1);
}

const axios = require('axios');
const debug = require('debug')('http');
// invoke as `DEBUG=http node app.js` to see HTTP requests and responses
const BigNumber = require('bignumber.js');

const validatorIds = process.env.VALIDATOR_IDS.split(','); // read validator IDs from environment variable
const apiKey = process.env.BEACONCHA_API_KEY; // read API key from environment variable
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; // read Discord webhook URL from environment variable
const checkInterval = Number(process.env.CHECK_INTERVAL); // read check interval from environment variable

// Constants
const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
const lastNotificationTimes = {}; // stores the last notification time for each validator to avoid notification fatigue
const apiUrl = 'https://beaconcha.in/api/v1/rocketpool/validator/'; // API URL

axios.interceptors.request.use(request => {
  debug('Starting Request', request)
  return request
})

axios.interceptors.response.use(response => {
  debug('Response:', response)
  return response
})

/**
 * Sends a Discord notification if 24 hours have passed since the last notification.
 * @param {string} message - The message to send.
 * @param {string} validatorId - The ID of the validator.
 */
const sendDiscordNotification = async (message, validatorId) => {
  const now = Date.now();
  const lastNotificationTime = lastNotificationTimes[validatorId];
  // log the last notification time for debugging
  // console.log(`Last notification time for validatorId ${validatorId}: ${lastNotificationTime}`)
  // only send a notification if 24 hours have passed since the last notification
  if (!lastNotificationTime || now - lastNotificationTime >= oneDayInMilliseconds) {
    console.log(`Sending Discord notification for validatorId: ${validatorId}`);
    try {
      await axios.post(discordWebhookUrl, {
        content: message
      });
      lastNotificationTimes[validatorId] = now; // update the last notification time
      console.log(`Successfully sent Discord notification for validatorId: ${validatorId}`);
    } catch (error) {
      console.error(`Failed to send Discord notification for validatorId: ${validatorId}. Error: ${error.message}`);
      console.log(error.message);
    }
  } else {
    console.log(`Suppressing Discord notification for validatorId: ${validatorId} because 24 hours have not passed since the last notification.`);
  } 
}

/**
 * Checks the RPL stake for a given validator.
 * Sends a Discord notification if the stake is below the minimum required.
 * @param {string} validatorId - The ID of the validator.
 */
const checkStake = async (validatorId) => {
  try {
    const response = await axios.get(`${apiUrl}/${validatorId}`, {
      headers: {
        'apikey': apiKey
      }
    });

    const { data } = response.data;

    // if the API call returns 200 but data[] is empty, then the validator is not a rocketpool minipool
    if (Object.keys(data).length === 0) {
      console.log(`Validator ${validatorId} is not a Rocketpool validator.`);
      return;
    }

    const nodeRplStakeWei = new BigNumber(data.node_rpl_stake);
    const nodeMinRplStakeWei = new BigNumber(data.node_min_rpl_stake);
    const nodeRplStake = nodeRplStakeWei.dividedBy(new BigNumber(10).pow(18));
    const nodeMinRplStake = nodeMinRplStakeWei.dividedBy(new BigNumber(10).pow(18));
    const stakeDifference = nodeRplStake.minus(nodeMinRplStake);
    const stakeDifferencePercentage = stakeDifference.dividedBy(nodeMinRplStake).multipliedBy(100);

    console.log(`Validator ${validatorId}: Current stake = ${nodeRplStake.toFixed(2)}, Minimum stake = ${nodeMinRplStake.toFixed(2)}, Difference = ${stakeDifference.toFixed(2)} (${stakeDifferencePercentage.toFixed(2)}%)`);

    if (nodeRplStake.isLessThan(nodeMinRplStake)) {
      const message = `Alert: The node RPL stake for validator ${validatorId} is below the minimum. Current stake: ${nodeRplStake.toFixed(2)}, Minimum stake: ${nodeMinRplStake.toFixed(2)}`;
      console.log(message);
      sendDiscordNotification(message, validatorId);
    } else {
    console.log(`Validator ${validatorId}: Stake is within acceptable range.`);
  }
  } catch (error) {
    console.error(`Failed to fetch validator data for validatorId: ${validatorId}. Error: ${error.message}`);
    // send a message via Discord if the request to the API fails
    const message = `Failed to fetch validator data for validatorId: ${validatorId}. Error: ${error.message}`;
    sendDiscordNotification(message, validatorId);
  }
}

// Export functions for testing
module.exports = {
  sendDiscordNotification,
  checkStake,
  lastNotificationTimes
};

console.log('Starting RPL Stake Watcher');
console.log("Validator IDs: " + validatorIds);
console.log('lastNotificationTimes:', lastNotificationTimes);
console.log("API key: " + apiKey);
console.log("Discord webhook URL: " + discordWebhookUrl);
console.log("Checking stake every " + checkInterval + " seconds");

// Run the check for monitored validators every checkInterval seconds
setInterval(() => {
  validatorIds.forEach(checkStake);
}, checkInterval * 1000);

