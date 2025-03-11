const { sendAgentNotification } = require('./src/handlers/notificationHandler');
const fs = require('fs');
const path = require('path');

// Sample missed conversations - in a real scenario, these would be loaded from a database
const missedConversations = [
  {
    userId: 7809201565,
    telegramId: 7809201565,
    username: 'crypto_traveler',
    firstName: 'Alex',
    lastName: 'Johnson',
    messages: [
      { role: 'user', text: 'Hi, I need a jet from Monaco to London', timestamp: new Date() },
      { role: 'assistant', text: 'Hello! I can certainly help with arranging a private jet from Monaco to London. When are you looking to travel and how many passengers will there be?', timestamp: new Date() },
      { role: 'user', text: 'This weekend, 3 people', timestamp: new Date() },
      { role: 'assistant', text: 'Great! For 3 passengers from Monaco to London this weekend, we have several options. Do you have a preference for aircraft type or any specific requirements for the flight?', timestamp: new Date() },
      { role: 'user', text: 'Something comfortable, we have luggage', timestamp: new Date() },
      { role: 'assistant', text: 'For your trip from Monaco to London with 3 passengers and luggage, I would recommend a midsize jet like a Citation XLS or Learjet 60. These offer excellent comfort, ample luggage space, and typically cost between €15,000-20,000 for this route. Would you like me to connect you with a specialist for a detailed quote?', timestamp: new Date() },
      { role: 'user', text: 'Yes please, that would be great', timestamp: new Date() }
    ],
    origin: 'Monaco',
    destination: 'London',
    pax: 3,
    exactDate: 'This weekend',
    aircraftCategory: 'midsize',
    shouldNotifyAgent: true,
    notificationReason: 'User requested to speak with a specialist',
    notificationSent: false
  },
  {
    userId: 7809201566,
    telegramId: 7809201566,
    username: 'btc_flyer',
    firstName: 'Sarah',
    lastName: 'Williams',
    messages: [
      { role: 'user', text: 'Do you have jets available from Zurich to Ibiza?', timestamp: new Date() },
      { role: 'assistant', text: 'Yes, we certainly do! We can arrange a private jet from Zurich to Ibiza. When would you like to travel and how many passengers will be joining?', timestamp: new Date() },
      { role: 'user', text: 'July 15th, 6 people', timestamp: new Date() },
      { role: 'assistant', text: 'Great! For 6 passengers from Zurich to Ibiza on July 15th, we have several excellent options. Do you have any preferences regarding the type of aircraft?', timestamp: new Date() },
      { role: 'user', text: 'We want something luxurious', timestamp: new Date() },
      { role: 'assistant', text: 'For a luxurious experience from Zurich to Ibiza with 6 passengers, I would recommend a super-midsize or heavy jet like a Challenger 350 or Legacy 500. These offer spacious cabins, stand-up headroom, and premium amenities. The approximate cost would be €25,000-35,000. Would you like me to connect you with a specialist who can provide a detailed quote and discuss the specific luxury options available?', timestamp: new Date() },
      { role: 'user', text: 'Yes connect me please', timestamp: new Date() }
    ],
    origin: 'Zurich',
    destination: 'Ibiza',
    pax: 6,
    exactDate: 'July 15th',
    aircraftCategory: 'heavy',
    shouldNotifyAgent: true,
    notificationReason: 'User requested to speak with a specialist',
    notificationSent: false
  }
];

// Create a mock context for Telegram
function createMockContext(userData) {
  return {
    from: {
      id: userData.telegramId,
      username: userData.username,
      first_name: userData.firstName,
      last_name: userData.lastName
    },
    telegram: {
      sendMessage: async (channelId, message) => {
        console.log(`\n=== SENDING TO CHANNEL ${channelId} ===\n${message}\n=== END MESSAGE ===\n`);
        return { message_id: Math.floor(Math.random() * 1000) };
      }
    },
    reply: async (text) => {
      console.log(`\n=== REPLYING TO USER ===\n${text}\n=== END REPLY ===\n`);
      return { message_id: Math.floor(Math.random() * 1000) };
    }
  };
}

// Process missed notifications
async function processMissedNotifications() {
  console.log(`Processing ${missedConversations.length} missed notifications...`);
  
  // Create a log file for the results
  const logFile = path.join(__dirname, 'missed_notifications_log.txt');
  fs.writeFileSync(logFile, `Missed Notifications Processing - ${new Date().toISOString()}\n\n`);
  
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < missedConversations.length; i++) {
    const conversation = missedConversations[i];
    console.log(`\nProcessing notification ${i+1}/${missedConversations.length} for user ${conversation.username || conversation.telegramId}`);
    
    try {
      // Create a mock context for this user
      const mockCtx = createMockContext(conversation);
      
      // Send the notification
      const result = await sendAgentNotification(mockCtx, conversation, 'request');
      
      // Log the result
      if (result) {
        successCount++;
        console.log(`✅ Successfully sent notification for ${conversation.firstName} ${conversation.lastName}`);
        fs.appendFileSync(logFile, `SUCCESS: Notification sent for ${conversation.firstName} ${conversation.lastName} (${conversation.username || conversation.telegramId}) - Route: ${conversation.origin} to ${conversation.destination}\n`);
      } else {
        failureCount++;
        console.log(`❌ Failed to send notification for ${conversation.firstName} ${conversation.lastName}`);
        fs.appendFileSync(logFile, `FAILURE: Could not send notification for ${conversation.firstName} ${conversation.lastName} (${conversation.username || conversation.telegramId})\n`);
      }
    } catch (error) {
      failureCount++;
      console.error(`Error processing notification for ${conversation.username || conversation.telegramId}:`, error);
      fs.appendFileSync(logFile, `ERROR: Exception while processing ${conversation.firstName} ${conversation.lastName} (${conversation.username || conversation.telegramId}): ${error.message}\n`);
    }
    
    // Add a small delay between notifications to avoid rate limiting
    if (i < missedConversations.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Log summary
  const summary = `\nProcessing complete. Results: ${successCount} successful, ${failureCount} failed.`;
  console.log(summary);
  fs.appendFileSync(logFile, summary);
  
  return { successCount, failureCount };
}

// Run the processing
processMissedNotifications()
  .then(results => {
    console.log(`Finished processing missed notifications. Check missed_notifications_log.txt for details.`);
  })
  .catch(error => {
    console.error('Error in main process:', error);
  }); 