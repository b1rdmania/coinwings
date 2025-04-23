require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./src/config/config');

// Initialize the bot with the real token
const bot = new Telegraf(config.telegram.token);

// Get the agent channel ID from config
const channelId = config.telegram.agentChannel;
console.log('Agent channel ID:', channelId);

// Create a test notification message
const message = `🤖 REAL TEST NOTIFICATION - ${new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}

Contact: Test User (@test_user)

Lead Details:
🛫 Route: London to Paris
👥 Passengers: 4
📅 Date: Next Friday
✈️ Aircraft: Citation XLS
📝 Reason for Handoff: User requested to speak with a specialist

Conversation History:
👤 Yes please connect me with a specialist
🤖 For a London to Paris trip with 4 passengers, I would recommend a midsize jet like a Citation XLS...
👤 Something comfortable for 4 people
🤖 Great! For your trip from London to Paris with 4 passengers, we have several excellent options...
👤 Next Friday, 4 people
🤖 When would you like to travel and how many passengers will there be?
👤 I need a private jet from London to Paris
🤖 I can help with that! London to Paris is a popular route for private jets.

Trigger: User Requested

Reply to this user: https://t.me/user?id=7809201568`;

// Function to send the notification
async function sendRealNotification() {
  try {
    console.log('Attempting to send real notification to channel:', channelId);
    
    // Send the message to the agent channel
    const result = await bot.telegram.sendMessage(channelId, message);
    
    console.log('✅ Successfully sent notification!');
    console.log('Telegram API response:', JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Error sending notification:', error);
    
    // Log more details about the error
    if (error.response) {
      console.error('Error response:', JSON.stringify(error.response, null, 2));
    }
    
    return false;
  } finally {
    // Stop the bot
    bot.stop();
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