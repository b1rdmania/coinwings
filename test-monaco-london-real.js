require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./src/config/config');

// Initialize the bot with the real token
const bot = new Telegraf(config.telegram.token);

// Get the agent channel ID from config
const channelId = config.telegram.agentChannel;
console.log('Agent channel ID:', channelId);

// Create a test notification message for Monaco to London
const message = `🤖 REAL MONACO-LONDON NOTIFICATION - ${new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}

Contact: Alex Johnson (@crypto_traveler)

Lead Details:
🛫 Route: Monaco to London
👥 Passengers: 3
📅 Date: This weekend
✈️ Aircraft: Citation XLS (midsize)
📝 Reason for Handoff: User requested to speak with a specialist

Conversation History:
👤 Yes please, that would be great
🤖 For your trip from Monaco to London with 3 passengers and luggage, I would recommend a midsize jet like a Citation XLS or Learjet 60...
👤 Something comfortable, we have luggage
🤖 Great! For 3 passengers from Monaco to London this weekend, we have several options. Do you have any specific requirements?
👤 This weekend, 3 people
🤖 Hello! I can certainly help with arranging a private jet from Monaco to London. When are you looking to travel and how many passengers?
👤 Hi, I need a jet from Monaco to London

Trigger: User Requested

Reply to this user: https://t.me/user?id=7809201565`;

// Function to send the notification
async function sendRealNotification() {
  try {
    console.log('Attempting to send Monaco-London notification to channel:', channelId);
    
    // Send the message to the agent channel
    const result = await bot.telegram.sendMessage(channelId, message);
    
    console.log('✅ Successfully sent Monaco-London notification!');
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