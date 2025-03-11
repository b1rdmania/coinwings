const sendAgentNotification = require('./src/handlers/notificationHandler');

// Create a mock context for the user
const mockCtx = { 
  from: { 
    id: 7809201563, // The ID from the screenshot
    username: null, // No username in the screenshot
    first_name: 'Daphne', // Name from the screenshot
    last_name: '' 
  }, 
  telegram: { 
    sendMessage: async (channelId, message) => { 
      console.log(`\n=== SENDING TO CHANNEL ${channelId} ===\n${message}\n=== END MESSAGE ===\n`); 
      return { message_id: 123 }; 
    } 
  } 
};

// Create a mock conversation with the Bombardier Challenger 605 details
const conversation = { 
  userId: 7809201563,
  username: null,
  messages: [
    { role: 'user', text: 'Would you like to know anything else about these aircraft or the private jet experience?', timestamp: new Date() },
    { role: 'user', text: 'Yes, I would like to secure the bombardier Challenger 605', timestamp: new Date() },
    { role: 'assistant', text: "That's a fantastic choice! The Bombardier Challenger 605 is known for its spacious cabin and long-range capabilities. Perfect for both business and leisure travels. 🛫 ✈️", timestamp: new Date() },
    { role: 'assistant', text: "Before we proceed, may I ask a few more details? It would be great to know your name, your base country, and the intended route for your trip. Also, have you ever chartered a private jet before?\n\nThese details will help me assist you better and connect you with the right specialist when you're ready.", timestamp: new Date() }
  ],
  origin: null, // Not provided yet
  destination: null, // Not provided yet
  pax: null, // Not provided yet
  exactDate: null, // Not provided yet
  aircraftModel: 'Bombardier Challenger 605', // From the conversation
  aircraftCategory: 'heavy', // Assuming heavy jet category
  firstName: 'Daphne',
  lastName: '',
  country: null, // Not provided yet
  shouldNotifyAgent: true,
  notificationReason: 'User wants to secure a Bombardier Challenger 605',
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