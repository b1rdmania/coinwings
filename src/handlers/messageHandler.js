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
      
      // Check for explicit handoff request
      const explicitHandoffRequest = 
        messageText.toLowerCase().includes('connect me') || 
        messageText.toLowerCase().includes('speak to agent') || 
        messageText.toLowerCase().includes('talk to specialist') ||
        messageText.toLowerCase().includes('connect with specialist') ||
        messageText.toLowerCase() === 'connect please' ||
        messageText.toLowerCase() === 'connect' ||
        messageText.toLowerCase() === 'yes please' ||
        (response.toLowerCase().includes('connect you with a specialist') && 
         (messageText.toLowerCase() === 'yes' || messageText.toLowerCase() === 'ok' || 
          messageText.toLowerCase() === 'sure' || messageText.toLowerCase() === 'all good'));
      
      // Send notification to agent if explicitly requested and not already sent
      if (explicitHandoffRequest && !conversation.notificationSent) {
        console.log(`Explicit handoff request detected, sending agent notification for user ${username}`);
        
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