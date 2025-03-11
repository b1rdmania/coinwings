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
            
        case 'handoff_with_details':
            return Markup.keyboard([
                ['Yes, add more details'],
                ['No, proceed without additional details']
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
        console.log('Starting agent notification process...');
        
        // Calculate lead score
        const conversationData = conversation.getDataForScoring();
        const leadScore = calculateLeadScore(conversationData);
        console.log('Lead score calculated:', leadScore);
        
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
        
        console.log('Lead data prepared:', JSON.stringify(leadData));
        
        const leadId = await storeLead(leadData);
        console.log('Lead stored with ID:', leadId);
        
        // Notify agent channel if configured
        if (config.telegram.agentChannel) {
            console.log('Agent channel configured:', config.telegram.agentChannel);
            
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
                
                console.log('Sending message to agent channel...');
                
                // Convert channel ID to number if it's a string
                let channelId = config.telegram.agentChannel;
                if (typeof channelId === 'string') {
                    channelId = parseInt(channelId, 10);
                }
                
                console.log('Using channel ID:', channelId);
                
                await bot.telegram.sendMessage(channelId, agentMessage, { parse_mode: 'Markdown' });
                console.log(`Successfully sent notification to agent channel for lead ${leadId}`);
                return true;
            } catch (channelError) {
                console.error('Error sending to agent channel:', channelError);
                console.error('Error details:', channelError.message);
                console.error('Please ensure the bot is added as an admin to the channel with ID:', config.telegram.agentChannel);
                return false;
            }
        } else {
            console.warn('Agent channel not configured. Set AGENT_CHANNEL environment variable to enable notifications.');
            return false;
        }
    } catch (error) {
        console.error('Error sending agent notification:', error);
        console.error('Error stack:', error.stack);
        return false;
    }
}

// Agent command
bot.command('agent', async (ctx) => {
    try {
        console.log('Agent command triggered by user:', ctx.from.username);
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        
        // Get conversation summary
        const summary = conversation.getSummary();
        console.log('Conversation summary:', summary);
        
        // Always mark as handoff requested to ensure notification is sent
        conversation.handoffRequested = true;
        
        // Send notification to agent channel
        const success = await sendAgentNotification(ctx, conversation, 'manual');
        
        // Reply to user
        if (success) {
            console.log('Agent notification sent successfully via /agent command');
            
            // Create a confirmation message with the summary
            const confirmationMessage = `Thanks for your interest in CoinWings!\n\n` +
                `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                `Here's a summary of the information we've sent to our team:\n\n` +
                `${summary || 'Your flight inquiry details'}\n\n` +
                `Feel free to ask any other questions you might have while waiting.`;
            
            await ctx.reply(confirmationMessage);
            conversation.addMessage(confirmationMessage, 'assistant');
        } else {
            console.error('Failed to send agent notification via /agent command');
            ctx.reply('Sorry, there was an error connecting you with an agent. Please try again later.');
        }
    } catch (error) {
        console.error('Error in agent command:', error);
        console.error('Error stack:', error.stack);
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
        console.log('Received message:', ctx.message.text, 'from user:', ctx.from.username || ctx.from.id);
        
        // Get or create conversation
        const conversation = getConversation(ctx.from.id, ctx.from.username);
        console.log('Conversation retrieved for user:', ctx.from.username || ctx.from.id);
        
        // Add user message to conversation
        conversation.addMessage(ctx.message.text);
        console.log('Message added to conversation');
        
        // Handle "I prefer not to say" response for name
        if (ctx.message.text === 'I prefer not to say' && conversation.askedName && !conversation.firstName) {
            console.log('User prefers not to provide name');
            conversation.firstName = 'Anonymous';
            await ctx.reply(`No problem! How can I help you today?`);
            console.log('Sent anonymous response');
            return;
        }
        
        // Check if we should ask for name early in the conversation
        if (!conversation.firstName && !conversation.askedName && conversation.messages.length <= 3) {
            console.log('Asking for name early in conversation');
            conversation.askedName = true;
            await ctx.reply(`What's your name? This helps us personalize your experience.`, createKeyboardOptions('name_response'));
            console.log('Sent name request');
            return;
        }
        
        // If this is the first message after asking for name, try to extract name
        if (conversation.askedName && !conversation.firstName && conversation.messages.length >= 2) {
            console.log('Trying to extract name from message');
            // The extractName method will be called in analyzeMessage, but let's check if it worked
            if (!conversation.firstName) {
                // Try to extract name directly from this message
                conversation.extractName(ctx.message.text);
                
                // If we got a name, acknowledge it
                if (conversation.firstName && conversation.firstName !== 'Anonymous') {
                    console.log('Name extracted:', conversation.firstName);
                    await ctx.reply(`Thanks, ${conversation.firstName}! How can I help you with private aviation today?`);
                    console.log('Sent name acknowledgement');
                    return;
                }
            }
        }
        
        // Check if user requested agent
        if (conversation.handoffRequested) {
            console.log('User requested agent handoff');
            // Automatically send to agent without requiring /agent command
            const success = await sendAgentNotification(ctx, conversation, 'auto');
            
            if (success) {
                console.log('Agent notification sent successfully');
                
                // Get conversation summary
                const summary = conversation.getSummary();
                
                // Create a confirmation message with the summary
                const confirmationMessage = `Thanks for your interest in CoinWings!\n\n` +
                    `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                    `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                    `Here's a summary of the information we've sent to our team:\n\n` +
                    `${summary || 'Your flight inquiry details'}\n\n` +
                    `Feel free to ask any other questions you might have while waiting.`;
                
                await ctx.reply(confirmationMessage);
                conversation.handoffRequested = false; // Reset to prevent multiple notifications
            } else {
                console.log('Failed to send agent notification');
                await ctx.reply('I\'ll connect you with one of our aviation specialists. Please try again in a moment.');
            }
            return;
        }
        
        // Check if conversation has enough information for lead scoring
        const conversationData = conversation.getDataForScoring();
        const leadScore = calculateLeadScore(conversationData);
        console.log(`Lead score for ${ctx.from.username}: ${leadScore}`);
        
        // If we have basic information (origin/destination, pax, or timing), automatically suggest handoff
        const hasBasicInfo = (
            (conversation.origin && conversation.destination) || 
            conversation.pax || 
            conversation.exactDate || 
            conversation.dateRange || 
            conversation.mentionedTiming
        );
        
        // Check if we have enough information for a quote (score >= 70)
        if (shouldEscalateToAgent(leadScore) && !conversation.handoffSuggested && conversation.messages.length >= 3) {
            console.log(`Lead score high enough for handoff: ${ctx.from.username} (score: ${leadScore})`);
            
            // Get conversation summary
            const summary = conversation.getSummary();
            
            // Ask the customer if they want to add more information before sending to an agent
            conversation.handoffSuggested = true;
            
            await ctx.reply(
                `I have enough information to connect you with our aviation specialist who can provide exact pricing and availability.\n\n` +
                `Here's what I'll send to our team:\n\n` +
                `${summary || 'Your flight inquiry details'}\n\n` +
                `Would you like to add any other details before I connect you with a specialist?`,
                createKeyboardOptions('handoff_with_details')
            );
            return;
        }
        
        // If we have some but not all essential information, ask for the missing pieces
        if (hasBasicInfo && !shouldEscalateToAgent(leadScore) && !conversation.handoffSuggested && conversation.messages.length >= 3) {
            console.log(`Asking for missing information: ${ctx.from.username} (score: ${leadScore})`);
            
            // Check what information is missing and ask for it
            let missingInfoMessage = '';
            
            if (!conversation.origin && !conversation.destination) {
                missingInfoMessage = `To provide you with accurate pricing, could you please let me know your departure and arrival locations?`;
            } else if (!conversation.origin) {
                missingInfoMessage = `Could you please let me know your departure location?`;
            } else if (!conversation.destination) {
                missingInfoMessage = `Could you please let me know your destination?`;
            } else if (!conversation.pax) {
                missingInfoMessage = `How many passengers will be traveling? This helps us recommend the right aircraft.`;
            } else if (!conversation.exactDate && !conversation.dateRange && !conversation.mentionedTiming) {
                missingInfoMessage = `When are you planning to travel? This helps us check aircraft availability.`;
            } else {
                // If we have the essential info but score is still below threshold, ask about preferences
                missingInfoMessage = `Do you have any specific aircraft preferences or special requirements for your journey?`;
            }
            
            await ctx.reply(missingInfoMessage);
            conversation.addMessage(missingInfoMessage, 'assistant');
            return;
        }
        
        // Check for positive response to handoff suggestion or direct agent request
        const messageText = ctx.message.text.toLowerCase();
        if (
            (conversation.handoffSuggested && !conversation.handoffRequested) ||
            messageText === 'yes' || 
            messageText === 'yes please' || 
            messageText === 'sure' || 
            messageText === 'ok' || 
            messageText === 'okay' ||
            messageText.includes('connect') || 
            messageText.includes('speak') || 
            messageText.includes('talk to') ||
            messageText.includes('yes, connect') ||
            messageText.includes('agent') ||
            messageText.includes('human') ||
            messageText.includes('specialist') ||
            messageText.includes('send')
        ) {
            console.log('Detected request to connect with agent:', messageText);
            
            // Automatically send to agent
            const success = await sendAgentNotification(ctx, conversation, 'auto');
            
            if (success) {
                console.log('Agent notification sent successfully');
                
                // Create a confirmation message with the summary
                const summary = conversation.getSummary();
                
                // Create a confirmation message with the summary
                const confirmationMessage = `Thanks for your interest in CoinWings!\n\n` +
                    `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                    `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                    `Here's a summary of the information we've sent to our team:\n\n` +
                    `${summary || 'Your flight inquiry details'}\n\n` +
                    `Feel free to ask any other questions you might have while waiting.`;
                
                await ctx.reply(confirmationMessage);
                conversation.handoffRequested = false; // Reset to prevent multiple notifications
            } else {
                console.log('Failed to send agent notification');
                await ctx.reply('I\'ll connect you with one of our aviation specialists. Please use the /agent command to submit your inquiry.');
            }
            return;
        }
        
        // Handle responses to handoff_with_details keyboard
        if (messageText === 'yes, add more details') {
            console.log('User wants to add more details before handoff');
            
            // Ask for additional details
            await ctx.reply(
                `What additional details would you like to add? For example:\n\n` +
                `• Special catering requirements\n` +
                `• Ground transportation needs\n` +
                `• Specific aircraft preferences\n` +
                `• Payment method preferences\n` +
                `• Any other special requests`
            );
            
            // Mark that we're waiting for additional details
            conversation.waitingForAdditionalDetails = true;
            conversation.handoffSuggested = false; // Reset so we can suggest again after getting details
            return;
        }
        
        if (messageText === 'no, proceed without additional details' || 
            (conversation.handoffSuggested && (
                messageText === 'yes' || 
                messageText === 'yes please' || 
                messageText === 'sure' || 
                messageText === 'ok' || 
                messageText === 'okay' ||
                messageText.includes('connect') || 
                messageText.includes('speak') || 
                messageText.includes('talk to') ||
                messageText.includes('yes, connect') ||
                messageText.includes('agent') ||
                messageText.includes('human') ||
                messageText.includes('specialist') ||
                messageText.includes('send')
            ))
        ) {
            console.log('Proceeding with agent handoff:', messageText);
            
            // Get conversation summary
            const summary = conversation.getSummary();
            
            // Send to agent
            const success = await sendAgentNotification(ctx, conversation, 'auto');
            
            if (success) {
                console.log('Agent notification sent successfully');
                
                // Create a confirmation message with the summary
                const confirmationMessage = `Thanks for your interest in CoinWings!\n\n` +
                    `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                    `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                    `Here's a summary of the information we've sent to our team:\n\n` +
                    `${summary || 'Your flight inquiry details'}\n\n` +
                    `Feel free to ask any other questions you might have while waiting.`;
                
                await ctx.reply(confirmationMessage);
                conversation.handoffRequested = false; // Reset to prevent multiple notifications
                conversation.handoffSuggested = false; // Reset handoff suggestion
            } else {
                console.log('Failed to send agent notification');
                await ctx.reply('I\'ll connect you with one of our aviation specialists. Please try again in a moment.');
            }
            return;
        }
        
        // Handle additional details provided by the user
        if (conversation.waitingForAdditionalDetails) {
            console.log('Received additional details:', messageText);
            
            // Add the details to the conversation
            conversation.additionalDetails = messageText;
            conversation.waitingForAdditionalDetails = false;
            
            // Get updated conversation summary
            const summary = conversation.getSummary();
            
            // Send to agent with the additional details
            const success = await sendAgentNotification(ctx, conversation, 'auto');
            
            if (success) {
                console.log('Agent notification sent successfully with additional details');
                
                // Create a confirmation message with the summary
                const confirmationMessage = `Thanks for providing those additional details!\n\n` +
                    `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
                    `We aim to reply within 15 minutes between 9am and 9pm GMT from our London office.\n\n` +
                    `Here's a summary of the information we've sent to our team:\n\n` +
                    `${summary || 'Your flight inquiry details'}\n\n` +
                    `Feel free to ask any other questions you might have while waiting.`;
                
                await ctx.reply(confirmationMessage);
                conversation.handoffRequested = false; // Reset to prevent multiple notifications
            } else {
                console.log('Failed to send agent notification with additional details');
                await ctx.reply('I\'ll connect you with one of our aviation specialists. Please try again in a moment.');
            }
            return;
        }
        
        // Check for specific keywords that might trigger keyboard options
        const lowerText = messageText;
        
        // Handle keyboard responses for aircraft types
        if (['light jet (4-6 pax)', 'mid-size jet (7-9 pax)', 'heavy jet (10-16 pax)'].includes(messageText)) {
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
            }
            
            if (response) {
                await ctx.reply(response);
                conversation.addMessage(response, 'assistant');
                return;
            }
        }
        
        try {
            // Attempt OpenAI response
            console.log('Attempting OpenAI response');
            const completion = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    {
                        role: "system",
                        content: `You are CoinWings' private aviation expert. Use Hemingway-like brevity: short sentences, simple words, active voice. Be friendly but direct.

                        ${conversation.firstName && conversation.firstName !== 'Anonymous' ? `Address the user by their name: ${conversation.firstName}` : ''}

                        Focus on:
                        - Route information
                        - Aircraft recommendations
                        - Approximate pricing
                        - Next steps
                        
                        Use multiple-choice options for key questions. For example:
                        
                        "What type of aircraft are you interested in?
                        • Light Jet (4-6 passengers)
                        • Mid-size Jet (7-9 passengers)
                        • Heavy Jet (10-16 passengers)"
                        
                        "Have you flown private before?
                        • Yes, regularly
                        • Yes, occasionally
                        • No, first time"
                        
                        Ask about the client's country if not mentioned. This helps with aircraft options and regulations.
                        
                        Build rapport with lead-in questions:
                        - Have they flown private before?
                        - Would they like to know about crypto payment options?
                        - What's most important in their travel experience?
                        
                        IMPORTANT: After gathering basic information (route, passengers, timing), ALWAYS suggest connecting with our team for exact pricing and availability. Tell the user they can connect with a specialist by replying with "yes" or typing "agent".
                        
                        If the user mentions specific routes, dates, or shows clear interest in booking, IMMEDIATELY suggest connecting them with an agent by saying: "Based on your requirements, I'd like to connect you with one of our aviation specialists who can provide exact pricing and availability. Would you like me to do that now?"

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
            console.log('OpenAI response received');

            const response = completion.choices[0].message.content;
            console.log('Sending response to user:', response.substring(0, 50) + '...');
            await ctx.reply(response);
            console.log('Response sent to user');
            
            // Add bot response to conversation
            conversation.addMessage(response, 'assistant');
            console.log('Response added to conversation');
            
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
            
            console.log('Sending fallback response:', response.substring(0, 50) + '...');
            await ctx.reply(response);
            console.log('Fallback response sent');
            
            // Add fallback response to conversation
            conversation.addMessage(response, 'assistant');
            console.log('Fallback response added to conversation');
        }
    } catch (error) {
        console.error('Error in message handling:', error);
        console.error('Error stack:', error.stack);
        ctx.reply('Sorry, there was an error processing your request.');
    }
});

// Set up webhook
const PORT = process.env.PORT || 3000;

// Start bot with webhook
bot.launch({
    webhook: {
        domain: 'https://coinwings-app-adaf631c80ba.herokuapp.com',
        port: PORT
    }
}).then(() => {
    console.log('CoinWings bot is running with webhook on port', PORT);
}).catch((err) => {
    console.error('Error starting bot:', err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));