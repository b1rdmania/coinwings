require('dotenv').config();
const { Telegraf } = require('telegraf');
const config = require('./config/config');
const OpenAI = require('openai');
const { getConversation } = require('./models/conversation');
const { calculateLeadScore, shouldEscalateToAgent, getLeadPriority } = require('./utils/leadScoring');
const { getAircraftInfo, getRouteInfo, getFAQ, storeLead } = require('./services/firebase');

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

// Agent command
bot.command('agent', async (ctx) => {
    try {
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Store lead in Firebase
        const leadData = {
            username: ctx.from.username,
            telegramId: ctx.from.id,
            origin: conversation.origin,
            destination: conversation.destination,
            date: conversation.exactDate || (conversation.dateRange ? `${conversation.dateRange.start} to ${conversation.dateRange.end}` : null),
            pax: conversation.pax,
            aircraft: conversation.aircraftModel || conversation.aircraftCategory,
            score: calculateLeadScore(conversation.getDataForScoring()),
            notes: conversation.getSummary()
        };
        
        const leadId = await storeLead(leadData);
        
        // Notify agent channel if configured
        if (config.telegram.agentChannel) {
            const priority = getLeadPriority(leadData.score);
            const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
            
            const agentMessage = `${priorityEmoji} **NEW LEAD**\n\n` +
                `**Lead ID:** ${leadId}\n` +
                `**User:** @${ctx.from.username}\n` +
                `**Score:** ${leadData.score}/100\n\n` +
                `**Details:**\n${conversation.getSummary()}\n\n` +
                `**Action Required:** Agent should contact @${ctx.from.username} directly.`;
            
            await bot.telegram.sendMessage(config.telegram.agentChannel, agentMessage, { parse_mode: 'Markdown' });
        }
        
        // Reply to user
        const replyMessage = `Thanks for your interest in CoinWings!\n\n` +
            `One of our aviation specialists will contact you shortly to discuss your requirements in detail.\n\n` +
            `In the meantime, feel free to ask any other questions you might have.`;
        
        await ctx.reply(replyMessage);
        conversation.addMessage(replyMessage, 'bot');
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
            `/agent - Connect with an aviation specialist\n` +
            `/help - Show this help message\n\n` +
            `You can also just chat naturally about your flight requirements!`;
        
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
            // Handle as agent request
            await ctx.reply('I\'ll connect you with one of our aviation specialists. Please use the /agent command to submit your inquiry.');
            return;
        }
        
        // Check if conversation has enough information for lead scoring
        const conversationData = conversation.getDataForScoring();
        const leadScore = calculateLeadScore(conversationData);
        
        // If lead score is high enough, suggest agent handoff
        if (shouldEscalateToAgent(leadScore) && !conversation.handoffSuggested) {
            conversation.handoffSuggested = true;
            
            await ctx.reply(
                `Based on your requirements, I'd like to connect you with one of our aviation specialists who can provide exact pricing and availability.\n\n` +
                `Would you like to speak with a specialist? If so, please use the /agent command.`
            );
            return;
        }
        
        try {
            // Attempt OpenAI response
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are CoinWings' private aviation expert. You help crypto-native clients with private jet inquiries.
                        Keep responses concise and professional. Focus on:
                        - Route information
                        - Aircraft recommendations
                        - Approximate pricing
                        - Next steps
                        
                        If the user shows serious interest, suggest connecting them with our aviation team using the /agent command.
                        
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
// Keep-alive server for Heroku
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('CoinWings Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

// Keep-alive server for Heroku
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('CoinWings Bot is running!\n');
});
server.listen(process.env.PORT || 3000);

// Keep-alive server for Heroku
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end('CoinWings Bot is running!\n');
});
server.listen(process.env.PORT || 3000);
