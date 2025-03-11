require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/config');
const OpenAI = require('openai');
const { getConversation } = require('./models/conversation');
const { calculateLeadScore, shouldEscalateToAgent, getLeadPriority } = require('./utils/leadScoring');
const { getAircraftInfo, getRouteInfo, getFAQ, storeLead } = require('./services/firebase');
const http = require('http');

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
            `We fly fast, book discreetly, and accept crypto. 🚀\n\n` +
            `How can we help?`;
        
        await ctx.reply(welcomeMessage);
        
        // Add bot message to conversation
        conversation.addMessage(welcomeMessage, 'bot');
    } catch (error) {
        console.error('Error in start command:', error);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Aircraft info command
bot.command('aircraft', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Get aircraft categories
        const aircraftInfo = await getAircraftInfo();
        
        if (!aircraftInfo) {
            await ctx.reply('Sorry, I couldn\'t retrieve aircraft information at the moment.');
            return;
        }
        
        const categories = Object.values(aircraftInfo.categories);
        
        let message = '✈️ **Available Aircraft Categories**\n\n';
        
        categories.forEach(category => {
            message += `**${category.name}**\n`;
            message += `• Capacity: ${category.capacity}\n`;
            message += `• Range: ${category.range}\n`;
            message += `• Best for: ${category.best_for}\n`;
            message += `• Hourly rate: ${category.hourly_rate}\n\n`;
        });
        
        message += 'For specific aircraft models or more details, just ask!';
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        conversation.addMessage(message, 'bot');
    } catch (error) {
        console.error('Error in aircraft command:', error);
        ctx.reply('Sorry, there was an error retrieving aircraft information.');
    }
});

// Routes command
bot.command('routes', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Get popular routes
        const routesInfo = await getRouteInfo();
        
        if (!routesInfo) {
            await ctx.reply('Sorry, I couldn\'t retrieve route information at the moment.');
            return;
        }
        
        const routes = Object.values(routesInfo.popular_routes);
        
        let message = '✈️ **Popular Routes**\n\n';
        
        routes.forEach(route => {
            message += `**${route.origin} → ${route.destination}**\n`;
            message += `• Distance: ${route.distance}\n`;
            message += `• Flight time: ${route.flight_time.midsize_jet || route.flight_time.heavy_jet}\n`;
            message += `• Pricing: ${route.pricing.midsize_jet || route.pricing.heavy_jet}\n\n`;
        });
        
        message += 'For specific route pricing or details, just ask!';
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        conversation.addMessage(message, 'bot');
    } catch (error) {
        console.error('Error in routes command:', error);
        ctx.reply('Sorry, there was an error retrieving route information.');
    }
});

// FAQ command
bot.command('faq', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Get FAQ
        const faqInfo = await getFAQ();
        
        if (!faqInfo) {
            await ctx.reply('Sorry, I couldn\'t retrieve FAQ information at the moment.');
            return;
        }
        
        let message = '✈️ **Frequently Asked Questions**\n\n';
        
        message += '**Booking Process**\n';
        message += `• ${faqInfo.booking_process.how_to_book}\n\n`;
        
        message += '**Payment**\n';
        message += `• ${faqInfo.payment.accepted_cryptocurrencies}\n\n`;
        
        message += '**Aircraft**\n';
        message += `• ${faqInfo.aircraft.selection_criteria}\n\n`;
        
        message += '**Safety**\n';
        message += `• ${faqInfo.safety.standards}\n\n`;
        
        message += 'For more detailed information on any topic, just ask!';
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        conversation.addMessage(message, 'bot');
    } catch (error) {
        console.error('Error in faq command:', error);
        ctx.reply('Sorry, there was an error retrieving FAQ information.');
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
            conversation.addMessage(replyMessage, 'bot');
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
        conversation.addMessage(helpMessage, 'bot');
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
            const botMessages = lastFiveMessages.filter(m => m.role === 'assistant' || m.role === 'bot');
            
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
                    `Based on your requirements, I'd like to connect you with one of our aviation specialists who can provide exact pricing and availability.\n\n` +
                    `Would you like me to notify our team? Simply reply with "yes" or tell me more about your requirements.`
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
                lowerText.includes('talk to')
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
        
        try {
            // Attempt OpenAI response
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are CoinWings' private aviation expert. Use Hemingway-like brevity: short sentences, simple words, active voice. Be friendly but direct.

                        Focus on:
                        - Route information
                        - Aircraft recommendations
                        - Approximate pricing
                        - Next steps
                        
                        Ask about the client's country if not mentioned. This helps with aircraft options and regulations.
                        
                        Build rapport with lead-in questions:
                        - Have they flown private before?
                        - Would they like to know about crypto payment options?
                        - What's most important in their travel experience?
                        
                        Only suggest connecting with our team after gathering substantial information. When appropriate, suggest they can connect with a specialist by replying with "yes".
                        
                        Current conversation context:
                        ${conversation.getSummary() || "No specific details yet."}`
                    },
                    ...conversation.messages.slice(-5).map(m => ({
                        role: m.role,
                        content: m.text
                    }))
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            const response = completion.choices[0].message.content;
            await ctx.reply(response);
            
            // Add bot response to conversation
            conversation.addMessage(response, 'assistant');
            
        } catch (aiError) {
            console.error('OpenAI Error:', aiError);
            
            // Determine appropriate fallback response
            let response = fallbackResponses.general;
            const message = ctx.message.text.toLowerCase();
            
            if (message.includes('price') || message.includes('cost') || message.includes('how much')) {
                response = fallbackResponses.pricing;
            } else if (message.includes('process') || message.includes('how does') || message.includes('how do')) {
                response = fallbackResponses.process;
            }
            
            await ctx.reply(response);
            
            // Add fallback response to conversation
            conversation.addMessage(response, 'assistant');
        }
        
    } catch (error) {
        console.error('Error in message handler:', error);
        await ctx.reply(fallbackResponses.general);
    }
});

// Keep-alive server for Heroku
const server = http.createServer((req, res) => {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('CoinWings Bot is running!\n');
});
server.listen(process.env.PORT || 3000);
console.log('Keep-alive server started on port', process.env.PORT || 3000);

// Start bot
bot.launch()
    .then(() => {
        console.log('CoinWings bot is running...');
    })
    .catch((err) => {
        console.error('Error starting bot:', err);
    });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
