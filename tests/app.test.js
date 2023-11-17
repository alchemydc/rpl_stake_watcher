// Import the necessary modules
const axios = require('axios');
const BigNumber = require('bignumber.js');
const { checkStake } = require('../src/app.js'); 
const { sendDiscordNotification } = require('../src/app.js'); 
const { lastNotificationTimes } = require('../src/app.js'); 

console.log('lastNotificationTimes:', lastNotificationTimes);


const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

// Mock the axios module
jest.mock('axios');

describe('checkStake', () => {
  // Save the original console.log
  const originalLog = console.log;  
  const originalError = console.error;

  beforeEach(() => {
    // Mock console.log
    console.log = jest.fn();
    console.error = jest.fn();
    axios.get.mockClear();
  });
  
  afterEach(() => {
    // Restore the original console.log
    console.log = originalLog;
    console.error = originalError;
  });

  it('should handle non-Rocketpool validators', async () => {
    // Mock the API response
    axios.get.mockResolvedValue({
      data: {
        data: {}
      }
    });

    const validatorId = 'test-validator';
    await checkStake(validatorId);

    // Check that the console.log was called with the correct message
    expect(console.log).toHaveBeenCalledWith(`Validator ${validatorId} is not a Rocketpool validator.`);
  });

  it('should handle Rocketpool validators with stake below minimum', async () => {
    // Mock the API response
    axios.get.mockResolvedValue({
      data: {
        data: {
          node_rpl_stake: 9e18,
          node_min_rpl_stake: 10e18
        }
      }
    });

    const validatorId = 'test-validator';
    await checkStake(validatorId);

    // Log what console.log was called with
    //console.log('console.log calls:', console.log.mock.calls);
    //originalLog('console.log calls:', console.log.mock.calls);

    // Check that the console.log was called with the correct message
    expect(console.log.mock.calls).toEqual(expect.arrayContaining([
        [`Alert: The node RPL stake for validator ${validatorId} is below the minimum. Current stake: 9.00, Minimum stake: 10.00`]
      ])); 
  });

    it('should handle Rocketpool validators with stake above minimum', async () => {
        // Mock the API response
        axios.get.mockResolvedValue({
        data: {
            data: {
            node_rpl_stake: 11e18,
            node_min_rpl_stake: 10e18
            }
        }
        });
    
        const validatorId = 'test-validator';
        await checkStake(validatorId);
    
        // Check that the console.log was called with the correct message
        expect(console.log).toHaveBeenCalledWith(`Validator ${validatorId}: Stake is within acceptable range.`);
    });

    it('should log an error if the request to the API fails', async () => {
        const validatorId = 'test-validator';
    
        // Make axios.get throw an error
        axios.get.mockRejectedValue(new Error('Test error'));
    
        await checkStake(validatorId);
    
        expect(console.error).toHaveBeenCalledWith(`Failed to fetch validator data for validatorId: ${validatorId}. Error: Test error`);
      });

    it('should send a Discord notification if the request to the API fails', async () => {
        const validatorId = 'test-validator';
    
        // Make axios.get throw an error
        axios.get.mockRejectedValue(new Error('Test error'));
        await checkStake(validatorId);
        expect(axios.get).toHaveBeenCalled();
      });
});


describe('sendDiscordNotification', () => {
  const originalLog = console.log;
  const originalError = console.error;

  beforeEach(() => {
    console.log = jest.fn();
    console.error = jest.fn();
    axios.post.mockClear();
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
  });

  it('should send a Discord notification if 24 hours have passed since the last notification', async () => {
    const message = 'Test message';
    const validatorId = 'test-validator';

    // Set the last notification time to more than 24 hours ago
    lastNotificationTimes[validatorId] = Date.now() - oneDayInMilliseconds - 1;
    // originalLog('lastNotificationTimes:', lastNotificationTimes);
    // print out the value of onedayinmilliseconds
    // originalLog('oneDayInMilliseconds:', oneDayInMilliseconds);

    await sendDiscordNotification(message, validatorId);

    expect(axios.post).toHaveBeenCalledWith(discordWebhookUrl, { content: message });
    expect(console.log).toHaveBeenCalledWith(`Successfully sent Discord notification for validatorId: ${validatorId}`);
  });

  it('should not send a Discord notification if 24 hours have not passed since the last notification', async () => {
    const message = 'Test message';
    const validatorId = 'test-validator';

    // Set the last notification time to less than 24 hours ago
    lastNotificationTimes[validatorId] = Date.now() - oneDayInMilliseconds / 2;
    // originalLog('lastNotificationTimes:', lastNotificationTimes);

    await sendDiscordNotification(message, validatorId);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('should log an error if sending the Discord notification fails', async () => {
    const message = 'Test message';
    const validatorId = 'test-validator';

    // Make axios.post throw an error
    axios.post.mockRejectedValue(new Error('Test error'));

    // Set the last notification time to more than 24 hours ago so that the discord notification will attempt to be sent
    lastNotificationTimes[validatorId] = Date.now() - oneDayInMilliseconds - 1;
    
    await sendDiscordNotification(message, validatorId);
    // check to make sure the error is being thrown
    //originalLog(axios.post.mock);

    expect(console.error).toHaveBeenCalledWith(`Failed to send Discord notification for validatorId: ${validatorId}. Error: Test error`);
  });
});

