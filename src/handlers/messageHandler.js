const { getConversation, removeConversation } = require('../models/conversation');
const openaiService = require('../services/openai');
const sendAgentNotification = require('./notificationHandler');

/**
 * Register message handler for the bot
 * @param {Object} bot - Telegraf bot instance
 */
function registerMessageHandler(bot) {
  // Handle text messages
  bot.on('text', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const username = ctx.from.username || 'Anonymous';
      const messageText = ctx.message.text;
      
      console.log(`Received message: ${messageText} from user: ${username}`);
      
      // Get or create conversation for this user
      const conversation = getConversation(userId, username);
      
      // Store user information
      conversation.userId = userId;
      conversation.username = username;
      
      // Add message to conversation history
      conversation.addMessage(messageText);
      
      // Check for reset command
      if (messageText.toLowerCase() === '/reset') {
        removeConversation(userId);
        await ctx.reply('Conversation has been reset. How can I help you today?');
        return;
      }
      
      // Generate response using OpenAI
      const response = await openaiService.generateResponse(
        conversation.getMessagesForAI(),
        conversation
      );
      
      console.log('Sending response to user:', response.substring(0, 50) + '...');
      
      // Send with Markdown parse mode for formatting
      await ctx.reply(response, { parse_mode: 'Markdown' });
      
      // Add bot response to conversation
      conversation.addMessage(response, 'assistant');
      
      // Simple handoff detection - trust OpenAI's response
      const handoffIndicator = "a specialist will be in touch with you shortly";
      const handoffRequested = response.toLowerCase().includes(handoffIndicator);
      
      // Debug logging
      console.log(`🔍 HANDOFF DEBUG: Checking for handoff indicator: "${handoffIndicator}"`);
      console.log(`🔍 HANDOFF DEBUG: Bot response (first 100 chars): "${response.substring(0, 100)}..."`);
      console.log(`🔍 HANDOFF DEBUG: Bot response lowercase (first 100 chars): "${response.toLowerCase().substring(0, 100)}..."`);
      console.log(`🔍 HANDOFF DEBUG: Handoff detected: ${handoffRequested}`);
      console.log(`🔍 HANDOFF DEBUG: Notification already sent: ${conversation.notificationSent}`);
      
      // Also check for partial matches to help debug
      const partialMatches = [
        "specialist will be in touch",
        "will be in touch with you",
        "will be in touch shortly",
        "specialist will contact you"
      ];
      
      for (const partial of partialMatches) {
        const matches = response.toLowerCase().includes(partial);
        console.log(`🔍 HANDOFF DEBUG: Partial match "${partial}": ${matches}`);
      }
      
      // Send notification if handoff is indicated and not already sent
      if (handoffRequested && !conversation.notificationSent) {
        console.log(`🔍 HANDOFF DEBUG: Handoff detected, sending notification for user ${username}`);
        
        // Send notification to agent
        await sendAgentNotification(ctx, conversation, 'request');
        
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