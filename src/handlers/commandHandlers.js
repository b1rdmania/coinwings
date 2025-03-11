const { Markup } = require('telegraf');
const config = require('../config/config');
const { getConversation } = require('../models/conversation');
const { calculateLeadScore, shouldEscalateToAgent } = require('../utils/leadScoring');
const sendAgentNotification = require('./notificationHandler');

/**
 * Register all command handlers for the bot
 * @param {Object} bot - Telegraf bot instance
 */
function registerCommandHandlers(bot) {
  // Start command
  bot.start((ctx) => {
    ctx.reply(config.templates.welcome);
  });

  // Help command
  bot.help((ctx) => {
    ctx.reply(`I can help you with private jet charter inquiries. Just tell me:
- Your route (origin and destination)
- Number of passengers
- Travel dates
- Any specific aircraft preferences

You can also ask about our pricing, booking process, or available aircraft.`);
  });

  // Aircraft selection actions
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

  // Experience level actions
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

  // Contact sharing actions
  bot.action(/share_contact/, (ctx) => {
    ctx.reply('Please share your phone number or email address so our team can contact you.');
  });

  bot.action(/no_contact/, (ctx) => {
    ctx.reply('No problem! You can continue chatting here. What else would you like to know about private jet charters?');
  });

  // General actions
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
}

/**
 * Create keyboard options for different scenarios
 * @param {string} type - Type of keyboard to create
 * @returns {Object} Markup object with inline keyboard
 */
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

module.exports = {
  registerCommandHandlers,
  createKeyboardOptions
}; 