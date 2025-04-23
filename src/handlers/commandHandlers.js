const { Markup } = require('telegraf');
const config = require('../config/config');
const { getConversation, Conversation } = require('../models/conversation');
const { calculateLeadScore, shouldEscalateToAgent } = require('../utils/leadScoring');
const sendAgentNotification = require('./notificationHandler');
const { responses } = require('../config/responses');

// Store active conversations
const conversations = new Map();

/**
 * Register all command handlers for the bot
 * @param {Object} bot - Telegraf bot instance
 */
function registerCommandHandlers(bot) {
  // Start command
  bot.start((ctx) => {
    handleStart(ctx);
  });

  // Help command
  bot.help((ctx) => {
    handleHelp(ctx);
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
        responseText = `🛩 **Light Jets** are perfect for shorter trips with 4-6 passengers.

- ✅ **Best for**: Trips under 3 hours, small groups
- 💺 **Typical capacity**: 4-6 passengers
- 🛣️ **Range**: ~1,500 miles
- 💰 **Hourly rate**: $4,000-5,500
- ✨ **Popular models**: Citation CJ3, Phenom 300

They're efficient, cost-effective, and can access smaller airports that larger jets cannot.`;
        break;
      case 'midsize':
        conversation.aircraftCategory = 'midsize';
        responseText = `✈️ **Mid-size Jets** offer a great balance for domestic flights with 7-9 passengers.

- ✅ **Best for**: Flights of 3-5 hours, medium groups
- 💺 **Typical capacity**: 7-9 passengers
- 🛣️ **Range**: ~2,000 miles
- 💰 **Hourly rate**: $5,500-7,000
- ✨ **Popular models**: Citation XLS, Learjet 60

They typically feature stand-up cabins, enclosed lavatories, and good luggage capacity.`;
        break;
      case 'heavy':
        conversation.aircraftCategory = 'heavy';
        responseText = `🚀 **Heavy Jets** are designed for long-range travel with larger groups.

- ✅ **Best for**: International flights, 6+ hours, luxury travel
- 💺 **Typical capacity**: 10-16 passengers
- 🛣️ **Range**: 4,000+ miles
- 💰 **Hourly rate**: $8,000-12,000
- ✨ **Popular models**: Gulfstream G550, Falcon 7X

They offer spacious cabins, premium amenities, and can fly non-stop on intercontinental routes.`;
        break;
      case 'advice':
        responseText = `No problem! Finding the right aircraft is all about matching it to your specific needs.

To recommend the best option, I'd need to know:
- ✈️ Your route (origin and destination)
- 👥 Number of passengers
- 🧳 Luggage requirements
- ✨ Any specific preferences (like stand-up cabin, WiFi, etc.)

What route are you considering? No pressure - just exploring options is perfectly fine too.`;
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
    } else if (!conversation.pax && aircraftType !== 'advice') {
      // Ask for missing information in a natural way
      ctx.reply("How many passengers would be traveling with you? This helps me recommend the right aircraft options.");
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
        responseText = `🎉 **Welcome to private aviation!**

First time flying private is always exciting. Here are some quick benefits you'll enjoy:
- ⏱️ No waiting in long security lines
- 🛫 Arrive just 15 minutes before departure
- 🏢 Access to thousands of airports, not just major ones
- 🛋️ Complete privacy and comfort

I'll guide you through every step of the process to ensure a smooth experience. Any questions about how it all works?`;
        break;
      case 'occasional':
        responseText = `✨ **Great to have you back in private aviation!**

As an occasional private flyer, you'll appreciate:
- 🔄 Our streamlined booking process
- 🎯 Personalized service tailored to your preferences
- 💼 Flexibility for business or leisure travel
- 💰 Crypto payment options for convenience

Is there anything specific about the private jet experience you'd like to know more about this time?`;
        break;
      case 'regular':
        responseText = `🌟 **Excellent! Always good to chat with an experienced flyer.**

For frequent flyers like you, we offer:
- 🔑 Priority access to aircraft during high-demand periods
- 💾 Saved preferences for all your trips
- 🏆 VIP handling at all airports
- 💎 Special rates for regular clients

I'm sure you know the drill, but is there anything specific you're looking for on your next journey?`;
        break;
    }
    
    ctx.editMessageText(responseText);
    
    // Ask follow-up question in a natural way
    ctx.reply("What route are you interested in flying? Just exploring options is perfectly fine too.");
  });

  // Contact sharing actions
  bot.action(/share_contact/, (ctx) => {
    ctx.reply("If you'd like our team to reach out directly, feel free to share your preferred contact method (phone or email). Your information is kept private and only used to discuss your charter needs.");
  });

  bot.action(/no_contact/, (ctx) => {
    ctx.reply("No problem at all! You can continue chatting here whenever you're ready. What else would you like to know about private jet charters?");
  });

  // General actions
  bot.action(/get_quote/, (ctx) => {
    ctx.reply(`💬 **Let's get you a quote estimate**

To provide the most accurate information, I'll need a few details:

1️⃣ What's your departure city and destination?
2️⃣ When are you looking to travel?
3️⃣ How many passengers will be traveling?

Just start by letting me know your route, and we'll go from there. No pressure!`);
  });

  bot.action(/learn_more/, (ctx) => {
    ctx.reply(`✈️ **About CoinWings Private Aviation**

CoinWings offers premium private jet charter services with some unique advantages:

- 💰 **Crypto-native**: Pay with BTC, ETH, or USDC
- 🌐 **Global access**: Fly to/from thousands of airports worldwide
- 🛩️ **Full fleet range**: From light jets to heavy jets for any journey
- 🔒 **Privacy focused**: Discreet service for high-profile clients
- 🎯 **Personalized experience**: Tailored to your exact preferences

What specific aspect of private aviation would you like to learn more about?`, createKeyboardOptions('topics'));
  });

  bot.action(/speak_agent/, async (ctx) => {
    const userId = ctx.from.id;
    const username = ctx.from.username || 'Anonymous';
    const conversation = getConversation(userId, username);
    
    await sendAgentNotification(ctx, conversation, 'manual');
    ctx.reply("I'm connecting you with one of our aviation specialists who will assist you further. They typically respond within 15 minutes during business hours. Is there anything specific you'd like them to address when they reach out?");
  });
  
  // Topic selection actions
  bot.action(/topic_(.+)/, (ctx) => {
    const topic = ctx.match[1];
    let responseText = '';
    
    switch (topic) {
      case 'pricing':
        responseText = `💰 **Private Jet Pricing Explained**

Private jet pricing is based on several factors:

- ✈️ **Aircraft type**: Larger jets cost more but offer better amenities
- 📏 **Distance**: Longer flights require more fuel and crew time
- 📅 **Seasonality**: High-demand periods (holidays, events) increase prices
- 🏢 **Airport fees**: Some airports charge higher landing and handling fees
- ⏱️ **Positioning**: If aircraft needs to be repositioned, this adds cost

For example, a 2-hour flight on a light jet might cost **$8,000-$12,000** total, while a transatlantic flight on a heavy jet could be **$80,000-$100,000**.

Would you like to discuss pricing for a specific route?`;
        break;
      case 'process':
        responseText = `📋 **The Private Jet Charter Process**

Booking with CoinWings is straightforward:

1️⃣ **Inquiry**: Share your trip details (route, dates, passengers)
2️⃣ **Options**: We present suitable aircraft with pricing ranges
3️⃣ **Selection**: Choose your preferred aircraft and confirm details
4️⃣ **Payment**: Secure with crypto (BTC, ETH, USDC) or traditional methods
5️⃣ **Preparation**: We handle all logistics, catering, and ground transport
6️⃣ **Travel**: Arrive 15 minutes before departure and enjoy your flight

The entire process can be completed in as little as 3 hours for urgent flights, though 24-48 hours notice is ideal.

Would you like to start an inquiry or have questions about any step?`;
        break;
      case 'aircraft':
        responseText = `✈️ **Private Aircraft Categories**

Private jets generally fall into these categories:

- 🛩 **Light Jets** (4-6 passengers)
  Perfect for shorter trips (2-3 hours)
  Examples: Citation CJ3, Phenom 300
  Hourly rate: **$4,000-5,500**

- ✈️ **Mid-size Jets** (7-9 passengers)
  Great for domestic flights (4-5 hours)
  Examples: Citation XLS, Learjet 60
  Hourly rate: **$5,500-7,000**

- 🚀 **Heavy Jets** (10-16 passengers)
  Ideal for international travel (6+ hours)
  Examples: Gulfstream G550, Falcon 7X
  Hourly rate: **$8,000-12,000**

Would you like details on a specific aircraft type?`;
        break;
      case 'crypto':
        responseText = `💰 **Crypto Payments at CoinWings**

We accept these cryptocurrencies:
- ₿ **Bitcoin (BTC)**
- Ξ **Ethereum (ETH)**
- 💵 **USDC**

The payment process is simple and secure:
1️⃣ Once you confirm your booking, we provide wallet addresses
2️⃣ You send the payment from your wallet
3️⃣ After transaction confirmation, your flight is secured

We also accept traditional payment methods if you prefer.

Any questions about our crypto payment process?`;
        break;
    }
    
    ctx.editMessageText(responseText, createKeyboardOptions('default'));
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
        [Markup.button.callback('🛩 Light Jet (4-6 pax)', 'aircraft_light')],
        [Markup.button.callback('✈️ Mid-size Jet (7-9 pax)', 'aircraft_midsize')],
        [Markup.button.callback('🚀 Heavy Jet (10+ pax)', 'aircraft_heavy')],
        [Markup.button.callback('🤔 Not sure / Need advice', 'aircraft_advice')]
      ]);
    case 'experience':
      return Markup.inlineKeyboard([
        [Markup.button.callback('🆕 First time', 'exp_first')],
        [Markup.button.callback('🔄 Occasional flyer', 'exp_occasional')],
        [Markup.button.callback('✨ Regular flyer', 'exp_regular')]
      ]);
    case 'contact':
      return Markup.inlineKeyboard([
        [Markup.button.callback('📱 Share my contact', 'share_contact')],
        [Markup.button.callback('⏱ Not now', 'no_contact')]
      ]);
    case 'topics':
      return Markup.inlineKeyboard([
        [Markup.button.callback('💰 Pricing', 'topic_pricing')],
        [Markup.button.callback('📋 Booking Process', 'topic_process')],
        [Markup.button.callback('✈️ Aircraft Types', 'topic_aircraft')],
        [Markup.button.callback('₿ Crypto Payments', 'topic_crypto')],
        [Markup.button.callback('👨‍✈️ Speak to an Agent', 'speak_agent')]
      ]);
    default:
      return Markup.inlineKeyboard([
        [Markup.button.callback('💬 Get a Quote', 'get_quote')],
        [Markup.button.callback('ℹ️ Learn More', 'learn_more')],
        [Markup.button.callback('👨‍✈️ Speak to an Agent', 'speak_agent')]
      ]);
  }
}

/**
 * Handle the /start command
 * @param {Object} ctx - Telegram context
 */
const handleStart = async (ctx) => {
  try {
    const userId = ctx.from.id;
    const startParam = ctx.startPayload; // Get affiliate code from deep link
    
    // Create or get conversation
    let conversation = conversations.get(userId);
    if (!conversation) {
      conversation = new Conversation(userId);
      conversations.set(userId, conversation);
    }

    // Store affiliate ID if present
    if (startParam) {
      conversation.affiliateId = startParam;
      console.log(`Affiliate tracking started: ${startParam} for user ${userId}`);
    }

    // Store user information
    conversation.firstName = ctx.from.first_name;
    conversation.lastName = ctx.from.last_name || '';
    conversation.username = ctx.from.username || '';
    conversation.telegramId = userId;

    // Send welcome message
    await ctx.reply(config.messages.welcome);
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('Sorry, there was an error starting the conversation. Please try again.');
  }
};

/**
 * Handle the /help command
 * @param {Object} ctx - Telegram context
 */
const handleHelp = async (ctx) => {
  try {
    await ctx.reply(config.messages.help);
  } catch (error) {
    console.error('Error in help command:', error);
    await ctx.reply('Sorry, there was an error. Please try again.');
  }
};

/**
 * Handle the /reset command
 * @param {Object} ctx - Telegram context
 */
const handleReset = async (ctx) => {
  try {
    const userId = ctx.from.id;
    conversations.delete(userId);
    await ctx.reply('Conversation reset. How can I help you today?');
  } catch (error) {
    console.error('Error in reset command:', error);
    await ctx.reply('Sorry, there was an error resetting the conversation. Please try again.');
  }
};

module.exports = {
  registerCommandHandlers,
  createKeyboardOptions,
  handleStart,
  handleHelp,
  handleReset
}; 