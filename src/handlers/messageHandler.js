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
      
      // Simplified handoff detection - check both user message and OpenAI response
      const userWantsHandoff = 
        messageText.toLowerCase().includes('connect') || 
        messageText.toLowerCase().includes('agent') || 
        messageText.toLowerCase().includes('specialist') ||
        messageText.toLowerCase() === 'yes please' ||
        messageText.toLowerCase() === 'yes';
      
      const botOfferedHandoff = 
        response.toLowerCase().includes('specialist will be in touch') ||
        response.toLowerCase().includes('will be in touch soon') ||
        response.toLowerCase().includes('connect you with a specialist') ||
        response.toLowerCase().includes('charter specialists will be in touch') ||
        response.toLowerCase().includes('noted down your request') ||
        response.toLowerCase().includes('noted your request');
      
      // Force handoff for testing
      const forceHandoff = messageText.toLowerCase().includes('force handoff');
      
      // Debug logging
      console.log(`User message: "${messageText.substring(0, 50)}..."`);
      console.log(`Bot response: "${response.substring(0, 50)}..."`);
      console.log(`Handoff detection: userWantsHandoff=${userWantsHandoff}, botOfferedHandoff=${botOfferedHandoff}, forceHandoff=${forceHandoff}`);
      console.log(`Notification already sent: ${conversation.notificationSent}`);
      
      // Send notification if handoff is needed and not already sent
      if ((userWantsHandoff || botOfferedHandoff || forceHandoff) && !conversation.notificationSent) {
        console.log(`Sending handoff notification for user ${username}`);
        console.log(`Trigger: userWantsHandoff=${userWantsHandoff}, botOfferedHandoff=${botOfferedHandoff}, forceHandoff=${forceHandoff}`);
        
        try {
          // Send notification to agent
          const notificationResult = await sendAgentNotification(ctx, conversation, 'request');
          console.log(`Notification result: ${notificationResult}`);
          
          // Mark notification as sent
          conversation.notificationSent = true;
          
          // Send confirmation to user
          if (!botOfferedHandoff) {
            await ctx.reply("I've notified our team about your request. A specialist will be in touch with you shortly to discuss your requirements in detail.", { parse_mode: 'Markdown' });
          }
        } catch (notificationError) {
          console.error('Error sending notification:', notificationError);
          // Still mark as sent to prevent repeated attempts
          conversation.notificationSent = true;
          // Inform the user
          await ctx.reply("I'm having trouble connecting you with our team. Please try again later or contact us directly at support@coinwings.com", { parse_mode: 'Markdown' });
        }
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