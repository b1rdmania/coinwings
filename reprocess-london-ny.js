const { sendAgentNotification } = require('./src/handlers/notificationHandler');

// Create a mock context for the user
const mockCtx = { 
  from: { 
    id: 7809201564, // Real Telegram user ID
    username: 'london_ny_user',
    first_name: 'London', 
    last_name: 'User' 
  }, 
  telegram: { 
    sendMessage: async (channelId, message) => { 
      console.log(`\n=== SENDING TO CHANNEL ${channelId} ===\n${message}\n=== END MESSAGE ===\n`); 
      return { message_id: 123 }; 
    } 
  } 
};

// Create a mock conversation with real user data
const conversation = { 
  userId: 7809201564,
  telegramId: 7809201564, // Store the Telegram ID explicitly
  username: 'london_ny_user',
  firstName: 'London',
  lastName: 'User',
  messages: [
    { role: 'user', text: 'I need a private jet', timestamp: new Date() },
    { role: 'assistant', text: 'I can help with that! What route are you interested in?', timestamp: new Date() },
    { role: 'user', text: 'London to New York', timestamp: new Date() },
    { role: 'assistant', text: 'Great choice! When would you like to travel and how many passengers will there be?', timestamp: new Date() },
    { role: 'user', text: 'May 1st, just me', timestamp: new Date() },
    { role: 'assistant', text: 'Do you have a preference for aircraft type?', timestamp: new Date() },
    { role: 'user', text: 'Challenger 605', timestamp: new Date() },
    { role: 'assistant', text: 'A one-way charter from London to New York on a Challenger 605 typically ranges from $70,000 to $80,000. I\'d recommend speaking with a specialist who can provide a more precise quote and answer any other questions you may have. Would you like me to arrange a call with our specialist?', timestamp: new Date() },
    { role: 'user', text: 'Yes please arrange a call with the specialist', timestamp: new Date() }
  ],
  origin: 'London',
  destination: 'New York',
  pax: 1,
  exactDate: 'May 1st',
  aircraftModel: 'Challenger 605',
  aircraftCategory: 'heavy',
  shouldNotifyAgent: true,
  notificationReason: 'User wants to book a Challenger 605 from London to New York on May 1st',
  notificationSent: false
};

// Run the reprocessing
async function reprocessLead() {
  try {
    console.log('Reprocessing London to NY lead...');
    
    // Send the notification with the updated format
    const result = await sendAgentNotification(mockCtx, conversation, 'request');
    console.log('Notification result:', result);
    
  } catch (error) {
    console.error('Error reprocessing lead:', error);
  }
}

// Run the reprocessing
reprocessLead(); 