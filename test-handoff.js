const { getConversation } = require('./src/models/conversation');
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
      console.log(`\n=== SENDING TO CHANNEL ${channelId} ===\n${message}\n=== END MESSAGE ===\n`); 
      return { message_id: 123 }; 
    } 
  } 
};

// Simulate OpenAI function call
async function testOpenAIHandoff() {
  try {
    console.log('Starting OpenAI handoff test...');
    
    // Get a conversation object
    const conversation = getConversation('12345', 'test_user');
    
    // Add test data
    conversation.origin = 'London';
    conversation.destination = 'Paris';
    conversation.pax = 4;
    conversation.exactDate = '2024-04-15';
    conversation.aircraftCategory = 'midsize';
    conversation.firstName = 'John';
    conversation.lastName = 'Doe';
    conversation.country = 'United Kingdom';
    
    // Add some test messages
    conversation.addMessage('Hi, I need a private jet from London to Paris');
    conversation.addMessage('We can help with that! When are you looking to travel?', 'assistant');
    conversation.addMessage('April 15th with 4 passengers');
    conversation.addMessage('Great! Would you prefer a specific aircraft type?', 'assistant');
    conversation.addMessage('A midsize jet would be fine');
    conversation.addMessage('I want to book now', 'user');
    
    // Simulate OpenAI function call
    console.log('Simulating OpenAI function call...');
    conversation.shouldNotifyAgent = true;
    conversation.notificationReason = 'User wants to book a midsize jet from London to Paris on April 15th with 4 passengers';
    
    // Add the final assistant message
    conversation.addMessage('I\'ll connect you with a specialist who can help with your booking. A specialist will be in touch with you shortly.', 'assistant');
    
    // Send the notification
    console.log('Sending notification...');
    const result = await sendAgentNotification(mockCtx, conversation, 'request');
    console.log('Notification result:', result);
    
    // Verify notification was sent
    console.log('Notification sent flag:', conversation.notificationSent);
    
  } catch (error) {
    console.error('Test failed with error:', error);
  }
}

// Run the test
testOpenAIHandoff(); 