const { generateResponse } = require('../services/openai');
const { getConversation } = require('../models/conversation');
const { calculateLeadScore, shouldEscalateToAgent } = require('../utils/leadScoring');
const { sendAgentNotification } = require('./notificationHandler');

/**
 * Register message handler for the bot
 * @param {Object} bot - Telegram bot instance
 */
function registerMessageHandler(bot) {
  bot.on('message', async (ctx) => {
    try {
      // Skip non-text messages
      if (!ctx.message.text) return;

      const userId = ctx.from.id;
      const username = ctx.from.username || 'no_username';
      const firstName = ctx.from.first_name || '';
      const lastName = ctx.from.last_name || '';
      
      console.log(`New message from ${username ? '@' + username : 'No Username'} (ID: ${userId})`);
      
      // Get or create conversation for this user
      const conversation = getConversation(userId, username);
      
      // Store user details in the conversation object
      conversation.firstName = firstName;
      conversation.lastName = lastName;
      conversation.telegramId = userId;
      
      // Add message to conversation history with correct role
      conversation.addMessage('user', ctx.message.text);
      
      // Get messages for AI
      const messages = conversation.getMessagesForAI();
      
      // Generate response using OpenAI
      const response = await generateResponse(messages, conversation);
      
      // Add AI response to conversation
      conversation.addMessage('assistant', response);
      
      // Send response to user
      await ctx.reply(response);
      
      // Calculate lead score
      const score = calculateLeadScore(conversation);
      
      // Check if we should notify an agent
      const shouldNotify = shouldEscalateToAgent(score);
      
      // Check if the response indicates a handoff
      const handoffIndicators = [
        'specialist will be in touch',
        'connect you with a specialist',
        'arrange a call with our specialist',
        'connect you with our team',
        'put you in touch with our team'
      ];
      
      const responseIndicatesHandoff = handoffIndicators.some(phrase => 
        response.toLowerCase().includes(phrase.toLowerCase())
      );
      
      // Check if user message indicates a handoff request
      const userRequestsHandoff = ctx.message.text.toLowerCase().includes('speak to someone') || 
                                 ctx.message.text.toLowerCase().includes('talk to a human') ||
                                 ctx.message.text.toLowerCase().includes('connect me with') ||
                                 ctx.message.text.toLowerCase().includes('call with specialist');
      
      // Send notification if needed and not already sent
      if ((shouldNotify || responseIndicatesHandoff || userRequestsHandoff) && !conversation.notificationSent) {
        console.log('Sending agent notification...');
        
        // Set notification reason
        if (responseIndicatesHandoff) {
          conversation.notificationReason = 'AI recommended handoff';
        } else if (userRequestsHandoff) {
          conversation.notificationReason = 'User requested handoff';
        } else {
          conversation.notificationReason = 'Lead score threshold reached';
        }
        
        // Set flag to indicate notification should be sent
        conversation.shouldNotifyAgent = true;
        
        // Send notification
        await sendAgentNotification(ctx, conversation);
        
        // Mark notification as sent
        conversation.notificationSent = true;
      }
    } catch (error) {
      console.error('Error processing message:', error);
      ctx.reply('Sorry, I encountered an error processing your message. Please try again.');
    }
  });
}

module.exports = {
  registerMessageHandler
}; 