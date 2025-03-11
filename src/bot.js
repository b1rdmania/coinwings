require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const config = require('./config/config');
const { getConversation } = require('./models/conversation');
const { calculateLeadScore, shouldEscalateToAgent, getLeadPriority } = require('./utils/leadScoring');
const { getAircraftInfo, getRouteInfo, getFAQ, storeLead } = require('./services/firebase');
const openaiService = require('./services/openai');
const http = require('http');

// Initialize bot
const bot = new Telegraf(config.telegram.token);

// Command handlers
bot.start((ctx) => {
  ctx.reply(config.templates.welcome);
});

bot.help((ctx) => {
  ctx.reply(`I can help you with private jet charter inquiries. Just tell me:
- Your route (origin and destination)
- Number of passengers
- Travel dates
- Any specific aircraft preferences

You can also ask about our pricing, booking process, or available aircraft.`);
});

// Function to create keyboard options
function createKeyboardOptions(type) {
  switch (type) {
    case 'aircraft':
      return Markup.inlineKeyboard([
        [Markup.button.callback('Light Jet (4-6 pax)', 'aircraft_light')],
        [Markup.button.callback('Mid-size Jet (7-9 pax)', 'aircraft_midsize')],
        [Markup.button.callback('Heavy Jet (10+ pax)', 'aircraft_heavy')],
        [Markup.button.callback('Not sure / Need advice', 'aircraft_advice')]
      ]);
    case 'experience':
      return Markup.inlineKeyboard([
        [Markup.button.callback('First time', 'exp_first')],
        [Markup.button.callback('Occasional flyer', 'exp_occasional')],
        [Markup.button.callback('Regular flyer', 'exp_regular')]
      ]);
    case 'contact':
      return Markup.inlineKeyboard([
        [Markup.button.callback('Share my contact', 'share_contact')],
        [Markup.button.callback('Not now', 'no_contact')]
      ]);
    default:
      return Markup.inlineKeyboard([
        [Markup.button.callback('Get a quote', 'get_quote')],
        [Markup.button.callback('Learn more', 'learn_more')],
        [Markup.button.callback('Speak to an agent', 'speak_agent')]
      ]);
  }
}

// Handle aircraft selection
bot.action(/aircraft_(.+)/, (ctx) => {
  const aircraftType = ctx.match[1];
  const userId = ctx.from.id;
  const username = ctx.from.username || 'Anonymous';
  const conversation = getConversation(userId, username);
  
  let responseText = '';
  
  switch (aircraftType) {
    case 'light':
      conversation.aircraftCategory = 'light';
      responseText = 'Light jets are perfect for shorter trips with 4-6 passengers. They offer excellent efficiency and can access smaller airports.';
      break;
    case 'midsize':
      conversation.aircraftCategory = 'midsize';
      responseText = 'Mid-size jets are ideal for domestic flights with 7-9 passengers, offering a good balance of range, comfort, and cost.';
      break;
    case 'heavy':
      conversation.aircraftCategory = 'heavy';
      responseText = 'Heavy jets are designed for long-range travel with 10+ passengers, offering spacious cabins and premium amenities.';
      break;
    case 'advice':
      responseText = 'No problem! To recommend the best aircraft, I need to know more about your trip. Could you share your route and number of passengers?';
      break;
  }
  
  ctx.editMessageText(responseText);
  
  // Calculate lead score after updating conversation
  const score = calculateLeadScore(conversation.getDataForScoring());
  console.log(`Lead score for ${username}: ${score}`);
  
  // Check if we should escalate to agent
  if (shouldEscalateToAgent(score)) {
    sendAgentNotification(ctx, conversation);
    ctx.reply(config.templates.handoff);
  } else {
    // Ask for missing information
    ctx.reply('How many passengers will be traveling?');
  }
});

// Handle experience level selection
bot.action(/exp_(.+)/, (ctx) => {
  const experienceLevel = ctx.match[1];
  const userId = ctx.from.id;
  const username = ctx.from.username || 'Anonymous';
  const conversation = getConversation(userId, username);
  
  let responseText = '';
  
  switch (experienceLevel) {
    case 'first':
      responseText = 'Welcome to private aviation! We\'ll guide you through every step of the process to ensure a smooth experience.';
      break;
    case 'occasional':
      responseText = 'Great! As an occasional private flyer, you\'ll appreciate our streamlined booking process and personalized service.';
      break;
    case 'regular':
      responseText = 'Excellent! For frequent flyers like you, we offer special programs and priority service. Our team will ensure all your preferences are remembered.';
      break;
  }
  
  ctx.editMessageText(responseText);
  
  // Ask follow-up question
  ctx.reply('What route are you interested in flying?');
});

// Handle contact sharing
bot.action(/share_contact/, (ctx) => {
  ctx.reply('Please share your phone number or email address so our team can contact you.');
});

bot.action(/no_contact/, (ctx) => {
  ctx.reply('No problem! You can continue chatting here. What else would you like to know about private jet charters?');
});

// Handle general actions
bot.action(/get_quote/, (ctx) => {
  ctx.reply('To provide an accurate quote, I need a few details:');
  ctx.reply('What is your departure city and destination?');
});

bot.action(/learn_more/, (ctx) => {
  ctx.reply('CoinWings offers premium private jet charter services with crypto payment options. Our fleet ranges from light jets to heavy jets for intercontinental travel. What specific aspect would you like to learn more about?');
});

bot.action(/speak_agent/, async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'Anonymous';
  const conversation = getConversation(userId, username);
  
  await sendAgentNotification(ctx, conversation, 'manual');
  ctx.reply('I\'m connecting you with our aviation specialist who will assist you further.');
});

// Function to send notification to agents
async function sendAgentNotification(ctx, conversation, triggerType = 'auto') {
  try {
    const userData = ctx.from;
    const score = calculateLeadScore(conversation.getDataForScoring());
    const priority = getLeadPriority(score);
    const summary = conversation.getSummary();
    
    // Store lead in database
    const leadData = {
      userId: userData.id,
      username: userData.username || 'Anonymous',
      firstName: userData.first_name || 'Anonymous',
      lastName: userData.last_name || '',
      score: score,
      priority: priority,
      triggerType: triggerType,
      timestamp: new Date().toISOString(),
      summary: summary,
      conversation: conversation.messages
    };
    
    await storeLead(leadData);
    
    // Format notification message
    const priorityEmoji = priority === 'high' ? '🔴' : (priority === 'medium' ? '🟠' : '🟢');
    const triggerEmoji = triggerType === 'manual' ? '👤' : '🤖';
    
    const notificationText = `${triggerEmoji} ${priorityEmoji} NEW LEAD (${score}/100)
    
From: ${userData.first_name || ''} ${userData.last_name || ''} (@${userData.username || 'no username'})

${summary}

Reply to this user: https://t.me/${userData.username}`;
    
    // Send to agent channel if configured
    if (config.telegram.agentChannel) {
      await bot.telegram.sendMessage(config.telegram.agentChannel, notificationText);
      console.log(`Notification sent to agent channel for user ${userData.username || userData.id}`);
    } else {
      console.log('Agent channel not configured. Notification would have been:');
      console.log(notificationText);
    }
    
  } catch (error) {
    console.error('Error sending agent notification:', error);
  }
}

// Handle text messages
bot.on('text', async (ctx) => {
  try {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';
    const messageText = ctx.message.text;
    
    console.log(`Received message: ${messageText} from user: ${username}`);
    
    // Get or create conversation for this user
    const conversation = getConversation(userId, username);
    console.log('Conversation retrieved for user:', username);
    
    // Add message to conversation history
    conversation.addMessage(messageText);
    console.log('Message added to conversation');
    
    // Calculate lead score
    const score = calculateLeadScore(conversation.getDataForScoring());
    console.log(`Lead score for ${username}: ${score}`);
    
    // Check if we should escalate to agent
    if (shouldEscalateToAgent(score)) {
      await sendAgentNotification(ctx, conversation);
      await ctx.reply(config.templates.handoff);
      return;
    }
    
    // If not escalating, continue conversation
    console.log('Asking for missing information:', username, `(score: ${score})`);
    
    try {
      // Get conversation messages in format for OpenAI
      const messages = conversation.messages.map(msg => ({
        role: msg.role,
        content: msg.text
      }));
      
      // Generate response using OpenAI
      const response = await openaiService.generateResponse(messages);
      
      console.log('Sending response to user:', response.substring(0, 50) + '...');
      await ctx.reply(response);
      
      // Add bot response to conversation
      conversation.addMessage(response, 'assistant');
      console.log('Response added to conversation');
      
      return;
    } catch (error) {
      console.error('Error with OpenAI:', error);
      
      // Use fallback response if OpenAI fails
      const fallbackResponse = openaiService.generateFallbackResponse(messageText);
      await ctx.reply(fallbackResponse);
      
      // Add fallback response to conversation
      conversation.addMessage(fallbackResponse, 'assistant');
    }
  } catch (error) {
    console.error('Error processing message:', error);
    ctx.reply('Sorry, I encountered an error processing your message. Please try again.');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Sorry, something went wrong. Our team has been notified.');
});

// Start bot with webhook when deployed
if (process.env.NODE_ENV === 'production' || process.env.APP_URL) {
  // Set webhook
  const domain = config.telegram.webhookDomain;
  const secretPath = config.telegram.webhookPath;
  const port = process.env.PORT || 3000;
  
  // Start webhook
  bot.telegram.setWebhook(`${domain}${secretPath}/${bot.secretPathComponent()}`);
  bot.startWebhook(secretPath, null, port);
  
  console.log(`CoinWings bot is running with webhook on port ${port}`);
  
  // Keep alive
  setInterval(() => {
    http.get(`${domain}/ping`);
  }, 25 * 60 * 1000); // 25 minutes
} else {
  // Start bot with long polling for local development
  bot.launch();
  console.log('CoinWings bot is running with long polling');
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));