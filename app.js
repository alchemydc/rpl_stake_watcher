require('dotenv').config();

const axios = require('axios');
const debug = require('debug')('http');
// invoke as `DEBUG=http node checkrplstake.js` to see HTTP requests and responses

const BigNumber = require('bignumber.js');

const validatorIds = process.env.VALIDATOR_IDS.split(','); // read validator IDs from environment variable
const apiKey = process.env.BEACONCHA_API_KEY; // read API key from environment variable
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL; // read Discord webhook URL from environment variable
const checkInterval = Number(process.env.CHECK_INTERVAL); // read check interval from environment variable

const lastNotificationTimes = {}; // stores the last notification time for each validator

axios.interceptors.request.use(request => {
  debug('Starting Request', request)
  return request
})

axios.interceptors.response.use(response => {
  debug('Response:', response)
  return response
})

const sendDiscordNotification = async (message, validatorId) => {
  const now = Date.now();
  const lastNotificationTime = lastNotificationTimes[validatorId];
  const oneDayInMilliseconds = 24 * 60 * 60 * 1000;

  // only send a notification if 24 hours have passed since the last notification
  if (!lastNotificationTime || now - lastNotificationTime >= oneDayInMilliseconds) {
    try {
      await axios.post(discordWebhookUrl, {
        content: message
      });
      lastNotificationTimes[validatorId] = now; // update the last notification time
    } catch (error) {
      console.error(`Failed to send Discord notification: ${error.message}`);
    }
  }
}

const checkStake = async (validatorId) => {
  try {
    const response = await axios.get(`https://beaconcha.in/api/v1/rocketpool/validator/${validatorId}`, {
      headers: {
        'apikey': apiKey
      }
    });

    const { data } = response.data;
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
    }
  } catch (error) {
    console.error(`Failed to fetch validator data: ${error.message}`);
  }
}

console.log('Starting checkrplstake.js');
console.log("Validator IDs: " + validatorIds);
console.log("API key: " + apiKey);
console.log("Discord webhook URL: " + discordWebhookUrl);
console.log("Checking stake every " + checkInterval + " seconds");

// Run the check for each validator every checkInterval seconds
setInterval(() => {
  validatorIds.forEach(checkStake);
}, checkInterval * 1000);


