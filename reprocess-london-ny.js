const sendAgentNotification = require('./src/handlers/notificationHandler');

// Create a mock context for the user
const mockCtx = { 
  from: { 
    id: 7809201564, // Using a different ID for this test
    username: 'test_london_ny',
    first_name: 'Test', 
    last_name: 'User' 
  }, 
  telegram: { 
    sendMessage: async (channelId, message) => { 
      console.log(`\n=== SENDING TO CHANNEL ${channelId} ===\n${message}\n=== END MESSAGE ===\n`); 
      return { message_id: 123 }; 
    } 
  } 
};

// Create a mock conversation with the London to New York details
const conversation = { 
  userId: 7809201564,
  username: 'test_london_ny',
  messages: [
    { role: 'user', text: 'I need a private jet', timestamp: new Date() },
    { role: 'assistant', text: 'I can help with that! What route are you interested in?', timestamp: new Date() },
    { role: 'user', text: 'London to New York', timestamp: new Date() },
    { role: 'assistant', text: 'Great choice! When would you like to travel and how many passengers will there be?', timestamp: new Date() },
    { role: 'user', text: 'May 1st, just me', timestamp: new Date() },
    { role: 'assistant', text: 'Do you have a preference for aircraft type?', timestamp: new Date() },
    { role: 'user', text: 'Challenger 605', timestamp: new Date() },
    { role: 'assistant', text: 'A one-way charter from London to New York on a Challenger 605 typically ranges from $70,000 to $80,000. I\'d recommend speaking with a specialist who can provide a more precise quote and answer any other questions you may have. Would you like me to arrange a call with our specialist?', timestamp: new Date() },
    { role: 'user', text: 'Yes please arrange a call with the specialist', timestamp: new Date() },
    { role: 'assistant', text: 'Sure, I\'d be happy to connect you with a specialist! But before that, could you please provide a little more information about your travel needs? Details such as your desired destination, dates, and previous private jet experience would be really helpful. It will enable our specialists to provide you with the best possible service.', timestamp: new Date() },
    { role: 'user', text: 'I\'ve just told you all of this', timestamp: new Date() },
    { role: 'assistant', text: 'I\'m sorry for any confusion. It seems I may have missed some details in our conversation. Could you please reconfirm your travel details? Your destination, preferred travel dates, and any specific requirements for the flight would be really helpful.', timestamp: new Date() },
    { role: 'user', text: 'London to New York. 1st of May one way', timestamp: new Date() }
  ],
  origin: 'London',
  destination: 'New York',
  pax: 1,
  exactDate: 'May 1st',
  aircraftModel: 'Challenger 605',
  aircraftCategory: 'heavy',
  firstName: 'Test',
  lastName: 'User',
  country: null,
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