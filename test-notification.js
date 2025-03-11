require('dotenv').config();
const { Telegraf } = require('telegraf');

// Initialize bot with token from environment variables
const bot = new Telegraf(process.env.BOT_TOKEN);

async function sendTestNotification() {
  try {
    const agentChannel = process.env.AGENT_CHANNEL;
    
    if (!agentChannel) {
      console.error('AGENT_CHANNEL environment variable is not set');
      process.exit(1);
    }
    
    console.log(`Attempting to send test notification to channel: ${agentChannel}`);
    
    const message = `🧪 TEST NOTIFICATION 🧪
    
This is a test notification to verify that the bot can send messages to this channel.
    
Timestamp: ${new Date().toISOString()}
    
If you're seeing this message, the bot has the correct permissions to post in this channel.`;
    
    try {
      await bot.telegram.sendMessage(agentChannel, message);
      console.log('Test notification sent successfully to channel!');
    } catch (channelError) {
      console.error('Error sending to channel:', channelError.message);
      
      // Try to get bot info to verify the bot is working
      try {
        const botInfo = await bot.telegram.getMe();
        console.log('Bot info:', botInfo);
        
        // Ask for admin user ID
        console.log('\nThe channel might not exist or the bot might not have permission to post in it.');
        console.log('Please enter your Telegram user ID to receive a test message directly:');
        
        // Read from stdin
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', async (userId) => {
          userId = userId.trim();
          
          if (userId) {
            try {
              console.log(`Attempting to send test message to user ID: ${userId}`);
              await bot.telegram.sendMessage(userId, `Test message from CoinWings bot. The time is ${new Date().toISOString()}`);
              console.log('Test message sent successfully to user!');
            } catch (userError) {
              console.error('Error sending to user:', userError.message);
            }
          }
          
          process.exit(0);
        });
      } catch (botError) {
        console.error('Error getting bot info:', botError.message);
      }
    }
  } catch (error) {
    console.error('Error sending test notification:', error);
    process.exit(1);
  }
}

// Run the test
sendTestNotification(); 