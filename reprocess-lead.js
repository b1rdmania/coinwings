const { sendAgentNotification } = require('./src/handlers/notificationHandler');

// Create a mock context for the user
const mockCtx = { 
  from: { 
    id: 7809201563, // Real Telegram user ID
    username: 'daphne_user',
    first_name: 'Daphne', 
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
  userId: 7809201563,
  telegramId: 7809201563, // Store the Telegram ID explicitly
  username: 'daphne_user',
  firstName: 'Daphne',
  lastName: 'User',
  messages: [
    { role: 'user', text: 'Hello, I need a private jet', timestamp: new Date() },
    { role: 'assistant', text: 'I can help with that! What route are you interested in?', timestamp: new Date() },
    { role: 'user', text: 'London to Paris', timestamp: new Date() },
    { role: 'assistant', text: 'Great choice! When would you like to travel and how many passengers will there be?', timestamp: new Date() },
    { role: 'user', text: 'Next Friday, 4 people', timestamp: new Date() },
    { role: 'assistant', text: 'Do you have a preference for aircraft type?', timestamp: new Date() },
    { role: 'user', text: 'Something comfortable', timestamp: new Date() },
    { role: 'assistant', text: 'For a London to Paris trip with 4 passengers, I would recommend a light jet like a Citation CJ3 or Phenom 300. These aircraft offer comfort for short routes and typically cost between $8,000-12,000 for this journey. Would you like me to connect you with a specialist who can provide a detailed quote?', timestamp: new Date() },
    { role: 'user', text: 'Yes please', timestamp: new Date() }
  ],
  origin: 'London',
  destination: 'Paris',
  pax: 4,
  exactDate: 'Next Friday',
  aircraftCategory: 'light',
  shouldNotifyAgent: true,
  notificationReason: 'User requested to speak with a specialist',
  notificationSent: false
};

// Run the reprocessing
async function reprocessLead() {
  try {
    console.log('Reprocessing lead for Daphne...');
    
    // Send the notification with the updated format
    const result = await sendAgentNotification(mockCtx, conversation, 'request');
    console.log('Notification result:', result);
    
  } catch (error) {
    console.error('Error reprocessing lead:', error);
  }
}

// Run the reprocessing
reprocessLead(); 