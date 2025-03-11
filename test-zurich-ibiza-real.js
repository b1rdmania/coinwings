require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./src/config/config');

// Initialize the bot with the real token
const bot = new Telegraf(config.telegram.token);

// Get the agent channel ID from config
const channelId = config.telegram.agentChannel;
console.log('Agent channel ID:', channelId);

// Create a test notification message for Zurich to Ibiza
const message = `🤖 REAL ZURICH-IBIZA NOTIFICATION - ${new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}

Contact: Sarah Williams (@btc_flyer)

Lead Details:
🛫 Route: Zurich to Ibiza
👥 Passengers: 6
📅 Date: July 15th
✈️ Aircraft: Challenger 350 (heavy)
📝 Reason for Handoff: User requested to speak with a specialist

Conversation History:
👤 Yes connect me please
🤖 For a luxurious experience from Zurich to Ibiza with 6 passengers, I would recommend a super-midsize or heavy jet like a Challenger 350...
👤 We want something luxurious
🤖 Great! For 6 passengers from Zurich to Ibiza on July 15th, we have several excellent options. Do you have any preferences?
👤 July 15th, 6 people
🤖 Yes, we certainly do! We can arrange a private jet from Zurich to Ibiza. When would you like to travel and how many passengers?
👤 Do you have jets available from Zurich to Ibiza?

Trigger: User Requested

Reply to this user: https://t.me/user?id=7809201566`;

// Function to send the notification
async function sendRealNotification() {
  try {
    console.log('Attempting to send Zurich-Ibiza notification to channel:', channelId);
    
    // Send the message to the agent channel
    const result = await bot.telegram.sendMessage(channelId, message);
    
    console.log('✅ Successfully sent Zurich-Ibiza notification!');
    console.log('Telegram API response:', JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    
    // Log more details about the error
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response, null, 2));
    }
    
    return false;
  }
}

// Run the function
sendRealNotification()
  .then(result => {
    console.log('Notification process completed with result:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  }); 