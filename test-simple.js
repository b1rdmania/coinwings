const sendAgentNotification = require('./src/handlers/notificationHandler');

// Create a mock context
const mockCtx = { 
  from: { 
    id: 12345, 
    username: 'test_user', 
    first_name: 'Test', 
    last_name: 'User' 
  }, 
  telegram: { 
    sendMessage: async (channelId, message) => { 
      console.log('SENDING TO CHANNEL ' + channelId + ':\n' + message); 
      return { message_id: 123 }; 
    } 
  } 
};

// Create a mock conversation
const conversation = { 
  userId: 12345, 
  username: 'test_user', 
  messages: [
    { role: 'user', text: 'I need a jet from London to Paris', timestamp: new Date() },
    { role: 'assistant', text: 'When would you like to travel?', timestamp: new Date() },
    { role: 'user', text: 'April 15th with 4 passengers', timestamp: new Date() }
  ], 
  origin: 'London', 
  destination: 'Paris', 
  pax: 4, 
  exactDate: '2024-04-15', 
  firstName: 'Test', 
  lastName: 'User', 
  country: 'UK', 
  shouldNotifyAgent: true, 
  notificationReason: 'User requested quote for London to Paris',
  notificationSent: false
};

// Run the test
async function runTest() {
  try {
    console.log('Running notification test...');
    const result = await sendAgentNotification(mockCtx, conversation, 'test');
    console.log('Notification sent:', result);
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTest();
