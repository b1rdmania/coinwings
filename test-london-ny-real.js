require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./src/config/config');

// Initialize the bot with the real token
const bot = new Telegraf(config.telegram.token);

// Get the agent channel ID from config
const channelId = config.telegram.agentChannel;
console.log('Agent channel ID:', channelId);

// Create a test notification message for London to New York
const message = `🤖 REAL LONDON-NY NOTIFICATION - ${new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}

Contact: London User (@london_ny_user)

Lead Details:
🛫 Route: London to New York
👥 Passengers: 1
📅 Date: May 1st
✈️ Aircraft: Challenger 605
📝 Reason for Handoff: User wants to book a Challenger 605 from London to New York on May 1st

Conversation History:
👤 Yes please arrange a call with the specialist
🤖 A one-way charter from London to New York on a Challenger 605 typically ranges from $70,000 to $80,000...
👤 Challenger 605
🤖 Do you have a preference for aircraft type?
👤 May 1st, just me
🤖 Great choice! When would you like to travel and how many passengers will there be?
👤 London to New York
🤖 I can help with that! What route are you interested in?
👤 I need a private jet

Trigger: User Requested

Reply to this user: https://t.me/user?id=7809201564`;

// Function to send the notification
async function sendRealNotification() {
  try {
    console.log('Attempting to send London-NY notification to channel:', channelId);
    
    // Send the message to the agent channel
    const result = await bot.telegram.sendMessage(channelId, message);
    
    console.log('✅ Successfully sent London-NY notification!');
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