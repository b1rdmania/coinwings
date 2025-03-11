require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/config');
const OpenAI = require('openai');
const { getConversation } = require('./models/conversation');
const { calculateLeadScore, shouldEscalateToAgent, getLeadPriority } = require('./utils/leadScoring');
const { getAircraftInfo, getRouteInfo, getFAQ, storeLead } = require('./services/firebase');
const http = require('http');
const { Markup } = require('telegraf');

// Initialize OpenAI
const openai = new OpenAI({
    apiKey: config.openai.apiKey
});

// Fallback responses when OpenAI is unavailable
const fallbackResponses = {
    pricing: `Here's our typical pricing structure:

✈️ Light Jet (4-6 pax)
• 2-3 hour flights: $15-25k
• Cross-country: $25-35k
• Transatlantic: $45-65k

✈️ Mid-size Jet (7-8 pax)
• Add ~30% to above prices

Would you like to connect with our aviation team for exact quotes?`,
    
    process: `Our process is straightforward:

1. Tell us your route and requirements
2. We provide aircraft options and pricing
3. Connect with our aviation team for final details
4. Book with crypto or fiat
5. Take off ✈️

What route are you interested in?`,
    
    general: `Thanks for your message! Our team typically responds with:

• Route-specific pricing
• Aircraft recommendations
• Booking process details

Would you like information about any of these?`
};

// Initialize bot
const bot = new Telegraf(config.telegram.token);

// Error handling
bot.catch((err, ctx) => {
    console.error(`Error for ${ctx.updateType}`, err);
    ctx.reply('An error occurred while processing your request.');
});

// Welcome message
bot.command('start', async (ctx) => {
    try {
        // Get or create conversation
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        const welcomeMessage = `✈️ Welcome to CoinWings – private aviation for the crypto jet set.\n\n` +
            `We fly fast, book discreetly, and accept crypto. 🚀`;
        
        await ctx.reply(welcomeMessage);
        
        // Add bot message to conversation
        conversation.addMessage(welcomeMessage, 'assistant');
        
        // Ask for name if we don't have it yet
        if (!conversation.firstName && !conversation.askedName) {
            conversation.askedName = true;
            setTimeout(async () => {
                const nameQuestion = `What's your name? This helps us personalize your experience.`;
                await ctx.reply(nameQuestion, createKeyboardOptions('name_response'));
                conversation.addMessage(nameQuestion, 'assistant');
            }, 1000);
        } else {
            // If we already have the name, ask how we can help
            setTimeout(async () => {
                const helpQuestion = `How can we help you today${conversation.firstName ? ', ' + conversation.firstName : ''}?`;
                await ctx.reply(helpQuestion);
                conversation.addMessage(helpQuestion, 'assistant');
            }, 1000);
        }
    } catch (error) {
        console.error('Error in start command:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

/**
 * Create keyboard options for common questions
 * @param {string} type - Type of keyboard to create
 * @returns {Object} Telegram keyboard markup
 */
function createKeyboardOptions(type) {
    switch (type) {
        case 'aircraft':
            return Markup.keyboard([
                ['Light Jet (4-6 pax)'],
                ['Mid-size Jet (7-9 pax)'],
                ['Heavy Jet (10-16 pax)']
            ]).oneTime().resize();
        
        case 'experience':
            return Markup.keyboard([
                ['Yes, regularly'],
                ['Yes, occasionally'],
                ['No, first time']
            ]).oneTime().resize();
        
        case 'payment':
            return Markup.keyboard([
                ['Tell me about crypto payments'],
                ['Tell me about traditional payments'],
                ['Tell me about both options']
            ]).oneTime().resize();
        
        case 'timing':
            return Markup.keyboard([
                ['Within a week'],
                ['Within a month'],
                ['Just exploring options']
            ]).oneTime().resize();
            
        case 'handoff':
            return Markup.keyboard([
                ['Yes, connect me with a specialist'],
                ['No, I have more questions']
            ]).oneTime().resize();
            
        case 'popular_routes':
            return Markup.keyboard([
                ['New York to Miami'],
                ['London to Dubai'],
                ['San Francisco to Austin'],
                ['Custom route']
            ]).oneTime().resize();
            
        case 'faq':
            return Markup.keyboard([
                ['Booking Process'],
                ['Payment Options'],
                ['Aircraft Information'],
                ['Safety Standards']
            ]).oneTime().resize();
            
        case 'name_response':
            return Markup.keyboard([
                ['I prefer not to say']
            ]).oneTime().resize();
            
        default:
            return Markup.removeKeyboard();
    }
}

// Aircraft command with keyboard options
bot.command('aircraft', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        const message = `What type of private jet are you interested in?`;
        
        await ctx.reply(message, createKeyboardOptions('aircraft'));
        conversation.addMessage(message, 'assistant');
    } catch (error) {
        console.error('Error in aircraft command:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Routes command
bot.command('routes', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        const message = `Which popular route are you interested in?`;
        
        await ctx.reply(message, createKeyboardOptions('popular_routes'));
        conversation.addMessage(message, 'assistant');
    } catch (error) {
        console.error('Error in routes command:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// FAQ command
bot.command('faq', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        const message = `What would you like to know more about?`;
        
        await ctx.reply(message, createKeyboardOptions('faq'));
        conversation.addMessage(message, 'assistant');
    } catch (error) {
        console.error('Error in faq command:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

/**
 * Send notification to agent channel
 * @param {Object} ctx - Telegram context
 * @param {Object} conversation - User conversation
 * @param {string} triggerType - What triggered the notification (auto/manual)
 * @returns {Promise<boolean>} Success status
 */
async function sendAgentNotification(ctx, conversation, triggerType = 'auto') {
    try {
        // Calculate lead score
        const conversationData = conversation.getDataForScoring();
        const leadScore = calculateLeadScore(conversationData);
        
        // Store lead in Firebase
        const leadData = {
            username: ctx.from.username,
            telegramId: ctx.from.id,
            firstName: conversation.firstName,
            lastName: conversation.lastName,
            origin: conversation.origin,
            destination: conversation.destination,
            date: conversation.exactDate || (conversation.dateRange ? `${conversation.dateRange.start} to ${conversation.dateRange.end}` : null),
            pax: conversation.pax,
            aircraft: conversation.aircraftModel || conversation.aircraftCategory,
            score: leadScore,
            notes: conversation.getSummary(),
            triggerType: triggerType
        };
        
        const leadId = await storeLead(leadData);
        
        // Notify agent channel if configured
        if (config.telegram.agentChannel) {
            try {
                const priority = getLeadPriority(leadData.score);
                const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
                
                // Get conversation summary
                const summary = conversation.getSummary();
                
                // Get recent messages (last 5)
                const recentMessages = conversation.messages.slice(-5).map(m => 
                    `${m.role === 'user' ? '👤' : '🤖'} ${m.text.substring(0, 100)}${m.text.length > 100 ? '...' : ''}`
                ).join('\n\n');
                
                // Create a more comprehensive message
                const agentMessage = `${priorityEmoji} **NEW LEAD**\n\n` +
                    `**Lead ID:** ${leadId}\n` +
                    `**User:** @${ctx.from.username}\n` +
                    `**Name:** ${conversation.firstName ? (conversation.lastName ? `${conversation.firstName} ${conversation.lastName}` : conversation.firstName) : 'Not provided'}\n` +
                    `**Score:** ${leadData.score}/100\n` +
                    `**Trigger:** ${triggerType === 'auto' ? 'Automatic' : 'User requested'}\n\n` +
                    `**Details:**\n${summary || 'No specific details extracted'}\n\n` +
                    `**Recent Conversation:**\n${recentMessages}\n\n` +
                    `**Action Required:** Agent should contact @${ctx.from.username} directly.`;
                
                await bot.telegram.sendMessage(config.telegram.agentChannel, agentMessage, { parse_mode: 'Markdown' });
                console.log(`Successfully sent notification to agent channel for lead ${leadId}`);
                return true;
            } catch (channelError) {
                console.error('Error sending to agent channel:', channelError.message);
                console.error('Please ensure the bot is added as an admin to the channel with ID:', config.telegram.agentChannel);
                return false;
            }
        } else {
            console.warn('Agent channel not configured. Set AGENT_CHANNEL environment variable to enable notifications.');
            return false;
        }
    } catch (error) {
        console.error('Error sending agent notification:', error);
        return false;
    }
}

// Agent command
bot.command('agent', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Send notification to agent channel
        const success = await sendAgentNotification(ctx, conversation, 'manual');
        
        // Reply to user
        if (success) {
            const replyMessage = `Thanks for your interest in CoinWings!\n\n` +
                `One of our aviation specialists will contact you shortly to discuss your requirements in detail.\n\n` +
                `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                `In the meantime, feel free to ask any other questions you might have.`;
            
            await ctx.reply(replyMessage);
            conversation.addMessage(replyMessage, 'assistant');
        } else {
            ctx.reply('Sorry, there was an error connecting you with an agent. Please try again later.');
        }
    } catch (error) {
        console.error('Error in agent command:', error);
        ctx.reply('Sorry, there was an error connecting you with an agent. Please try again later.');
    }
});

// Help command
bot.command('help', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        const helpMessage = `✈️ **CoinWings Commands**\n\n` +
            `/start - Welcome message\n` +
            `/aircraft - View aircraft options\n` +
            `/routes - View popular routes\n` +
            `/faq - Frequently asked questions\n` +
            `/help - Show this help message\n\n` +
            `You can also just chat naturally about your flight requirements! When you're ready to book, I'll connect you with one of our aviation specialists.`;
        
        await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
        conversation.addMessage(helpMessage, 'assistant');
    } catch (error) {
        console.error('Error in help command:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Message handling with fallback responses
bot.on('text', async (ctx) => {
    try {
        console.log('Received message:', ctx.message.text);
        
        // Get or create conversation
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Add user message to conversation
        conversation.addMessage(ctx.message.text);
        
        // Handle "I prefer not to say" response for name
        if (ctx.message.text === 'I prefer not to say' && conversation.askedName && !conversation.firstName) {
            conversation.firstName = 'Anonymous';
            await ctx.reply(`No problem! How can I help you today?`);
            return;
        }
        
        // Check if we should ask for name early in the conversation
        if (!conversation.firstName && !conversation.askedName && conversation.messages.length <= 3) {
            conversation.askedName = true;
            await ctx.reply(`What's your name? This helps us personalize your experience.`, createKeyboardOptions('name_response'));
            return;
        }
        
        // If this is the first message after asking for name, try to extract name
        if (conversation.askedName && !conversation.firstName && conversation.messages.length >= 2) {
            // The extractName method will be called in analyzeMessage, but let's check if it worked
            if (!conversation.firstName) {
                // Try to extract name directly from this message
                conversation.extractName(ctx.message.text);
                
                // If we got a name, acknowledge it
                if (conversation.firstName && conversation.firstName !== 'Anonymous') {
                    await ctx.reply(`Thanks, ${conversation.firstName}! How can I help you with private aviation today?`);
                    return;
                }
            }
        }
        
        // Check if user requested agent
        if (conversation.handoffRequested) {
            // Automatically send to agent without requiring /agent command
            const success = await sendAgentNotification(ctx, conversation, 'auto');
            
            if (success) {
                await ctx.reply(
                    `Thanks for your interest in CoinWings!\n\n` +
                    `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                    `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                    `In the meantime, feel free to ask any other questions you might have.`
                );
                conversation.handoffRequested = false; // Reset to prevent multiple notifications
            } else {
                await ctx.reply('I\'ll connect you with one of our aviation specialists. Please use the /agent command to submit your inquiry.');
            }
            return;
        }
        
        // Check if conversation has enough information for lead scoring
        const conversationData = conversation.getDataForScoring();
        const leadScore = calculateLeadScore(conversationData);
        
        // If lead score is high enough, suggest agent handoff, but only after lead-in questions
        if (shouldEscalateToAgent(leadScore) && !conversation.handoffSuggested && conversation.messages.length >= 6) {
            // Check message content for evidence of lead-in questions being asked
            const lastFiveMessages = conversation.messages.slice(-5);
            const botMessages = lastFiveMessages.filter(m => m.role === 'assistant');
            
            // Look for lead-in questions in bot messages
            let hasAskedLeadInQuestions = false;
            for (const message of botMessages) {
                const text = message.text.toLowerCase();
                if (
                    (text.includes('flown') && text.includes('before')) ||
                    (text.includes('payment') && (text.includes('system') || text.includes('crypto'))) ||
                    (text.includes('how') && text.includes('jet') && text.includes('travel')) ||
                    (text.includes('important') && text.includes('experience'))
                ) {
                    hasAskedLeadInQuestions = true;
                    break;
                }
            }
            
            // Only suggest handoff if lead-in questions have been asked
            if (hasAskedLeadInQuestions) {
                conversation.handoffSuggested = true;
                
                await ctx.reply(
                    `Based on your requirements, I'd like to connect you with one of our aviation specialists who can provide exact pricing and availability.`,
                    createKeyboardOptions('handoff')
                );
                return;
            }
        }
        
        // Check for positive response to handoff suggestion
        if (conversation.handoffSuggested && !conversation.handoffRequested) {
            const lowerText = ctx.message.text.toLowerCase();
            if (
                lowerText === 'yes' || 
                lowerText === 'yes please' || 
                lowerText === 'sure' || 
                lowerText === 'ok' || 
                lowerText === 'okay' ||
                lowerText.includes('connect') || 
                lowerText.includes('speak') || 
                lowerText.includes('talk to') ||
                lowerText.includes('yes, connect')
            ) {
                // Automatically send to agent
                const success = await sendAgentNotification(ctx, conversation, 'auto');
                
                if (success) {
                    await ctx.reply(
                        `Thanks for your interest in CoinWings!\n\n` +
                        `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                        `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                        `In the meantime, feel free to ask any other questions you might have.`
                    );
                    conversation.handoffRequested = false; // Reset to prevent multiple notifications
                    return;
                }
            }
        }
        
        // Check for specific keywords that might trigger keyboard options
        const lowerText = ctx.message.text.toLowerCase();
        
        // Handle keyboard responses for aircraft types
        if (['light jet (4-6 pax)', 'mid-size jet (7-9 pax)', 'heavy jet (10-16 pax)'].includes(ctx.message.text.toLowerCase())) {
            try {
                const aircraftInfo = await getAircraftInfo();
                let category = '';
                
                if (lowerText.includes('light')) {
                    category = 'light';
                } else if (lowerText.includes('mid-size') || lowerText.includes('midsize')) {
                    category = 'midsize';
                } else if (lowerText.includes('heavy')) {
                    category = 'heavy';
                }
                
                if (aircraftInfo && aircraftInfo.categories && aircraftInfo.categories[category]) {
                    const info = aircraftInfo.categories[category];
                    const message = `**${info.name}**\n\n` +
                        `• Capacity: ${info.capacity}\n` +
                        `• Range: ${info.range}\n` +
                        `• Speed: ${info.speed}\n` +
                        `• Examples: ${info.examples.join(', ')}\n` +
                        `• Hourly rate: ${info.hourly_rate}\n\n` +
                        `${info.description}\n\n` +
                        `Would you like to know about specific routes with this aircraft type?`;
                    
                    await ctx.reply(message, { parse_mode: 'Markdown' });
                    conversation.aircraftCategory = category;
                    return;
                }
            } catch (error) {
                console.error('Error handling aircraft selection:', error);
            }
        }
        
        // Handle keyboard responses for experience
        if (['yes, regularly', 'yes, occasionally', 'no, first time'].includes(ctx.message.text.toLowerCase())) {
            let response = '';
            
            if (lowerText.includes('regularly')) {
                response = `Great! As an experienced private jet traveler, you'll appreciate our streamlined booking process and flexible options.\n\nWhat's your next destination?`;
            } else if (lowerText.includes('occasionally')) {
                response = `Perfect. We'll make sure your next private flight is as smooth as your previous experiences.\n\nWhere are you looking to fly?`;
            } else if (lowerText.includes('first time')) {
                response = `Welcome to private aviation! You'll love the convenience and luxury.\n\nPrivate jets offer:\n• No security lines\n• Direct boarding\n• Custom catering\n• Flexible scheduling\n\nWhere would you like to fly?`;
            }
            
            if (response) {
                await ctx.reply(response);
                return;
            }
        }
        
        // Handle keyboard responses for payment options
        if (['tell me about crypto payments', 'tell me about traditional payments', 'tell me about both options'].includes(ctx.message.text.toLowerCase())) {
            let response = '';
            
            if (lowerText.includes('crypto')) {
                response = `**Crypto Payments**\n\n` +
                    `We accept BTC, ETH, and USDC for all bookings.\n\n` +
                    `Benefits:\n` +
                    `• Fast transactions\n` +
                    `• No bank delays\n` +
                    `• Privacy\n` +
                    `• No currency conversion fees for international flights\n\n` +
                    `We provide wallet addresses after booking confirmation.`;
            } else if (lowerText.includes('traditional')) {
                response = `**Traditional Payments**\n\n` +
                    `We accept wire transfers, credit cards, and bank transfers.\n\n` +
                    `Options:\n` +
                    `• Wire transfer (preferred for larger amounts)\n` +
                    `• Credit card (2.9% fee)\n` +
                    `• Bank transfer (free for international flights)`;
            } else if (lowerText.includes('both')) {
                response = `**Payment Options**\n\n` +
                    `We accept BTC, ETH, USDC, wire transfers, credit cards, and bank transfers.\n\n` +
                    `Crypto benefits:\n` +
                    `• Fast transactions\n` +
                    `• No bank delays\n` +
                    `• Privacy\n` +
                    `• No currency conversion fees for international flights\n\n` +
                    `Credit card fee: 2.9%\n` +
                    `Bank transfer fee: Free for international flights`;
            }
            
            if (response) {
                await ctx.reply(response, { parse_mode: 'Markdown' });
                return;
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Start bot
bot.launch();

// Keep-alive server for Heroku
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('CoinWings Bot is running!\n');
});
server.listen(process.env.PORT || 3000);
console.log('Keep-alive server started on port', process.env.PORT || 3000);

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));