const { getConversation } = require('../models/conversation');
const { calculateLeadScore } = require('../utils/leadScoring');
const openaiService = require('../services/openai');
const sendAgentNotification = require('./notificationHandler');
const config = require('../config/config');

/**
 * Register message handler for the bot
 * @param {Object} bot - Telegraf bot instance
 */
function registerMessageHandler(bot) {
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
      
      // Calculate lead score for logging purposes
      const score = calculateLeadScore(conversation.getDataForScoring());
      conversation.score = score;
      console.log(`Lead score for ${username}: ${score}`);
      
      // Check if this is a handoff request
      const isHandoffRequest = conversation.checkForHandoffRequest(messageText);
      if (isHandoffRequest) {
        console.log(`Handoff request detected: ${messageText}`);
        conversation.handoffRequested = true;
      }
      
      // Check if this is a summary request
      const isSummaryRequest = messageText.toLowerCase().includes('summary') || 
                              messageText.toLowerCase().includes('recap') ||
                              messageText.toLowerCase().includes('what did i tell you');
      
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
      
      // If handoff was requested or the score is high enough, send notification to agent
      if ((isHandoffRequest || conversation.handoffRequested) && !conversation.notificationSent) {
        console.log(`Sending agent notification for user ${username}`);
        
        // Send notification to agent
        await sendAgentNotification(ctx, conversation, 'request');
        
        // Mark notification as sent
        conversation.notificationSent = true;
        
        // Check if the OpenAI response already contains a confirmation about connecting with a specialist
        const containsConfirmation = response.toLowerCase().includes('specialist') || 
                                    response.toLowerCase().includes('connect you') ||
                                    response.toLowerCase().includes('i\'ll connect you') ||
                                    response.toLowerCase().includes('they\'ll be in touch');
        
        // Only send our confirmation message if the OpenAI response doesn't already include one
        if (!containsConfirmation) {
          const confirmationMessage = `Thanks for your interest in CoinWings! ✨

I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.

Feel free to ask any other questions while you wait.`;
          
          await ctx.reply(confirmationMessage, { parse_mode: 'Markdown' });
          
          // Add confirmation to conversation
          conversation.addMessage(confirmationMessage, 'assistant');
        } else {
          console.log('OpenAI response already contains a confirmation message, skipping additional confirmation');
        }
      }
      
      // Check if score exceeds threshold for auto-escalation
      if (score >= config.leadScoring.escalationThreshold && !conversation.notificationSent) {
        console.log(`Score ${score} exceeds threshold ${config.leadScoring.escalationThreshold}, sending notification`);
        
        // Send notification to agent
        await sendAgentNotification(ctx, conversation, 'score');
        
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