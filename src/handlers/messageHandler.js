const { getConversation } = require('../models/conversation');
const { calculateLeadScore, shouldEscalateToAgent } = require('../utils/leadScoring');
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
      console.log('Conversation retrieved for user:', username);
      
      // Add message to conversation history
      conversation.addMessage(messageText);
      console.log('Message added to conversation');
      
      // Calculate lead score
      const score = calculateLeadScore(conversation.getDataForScoring());
      console.log(`Lead score for ${username}: ${score}`);
      
      // Check if we should escalate to agent
      if (shouldEscalateToAgent(score)) {
        await sendAgentNotification(ctx, conversation);
        await ctx.reply(config.templates.handoff);
        return;
      }
      
      // If not escalating, continue conversation
      console.log('Continuing conversation with user:', username, `(score: ${score})`);
      
      await handleOpenAIResponse(ctx, conversation);
    } catch (error) {
      console.error('Error processing message:', error);
      ctx.reply('Sorry, I encountered an error processing your message. Please try again.');
    }
  });
}

/**
 * Handle generating and sending OpenAI response
 * @param {Object} ctx - Telegram context
 * @param {Object} conversation - User conversation
 * @returns {Promise<void>}
 */
async function handleOpenAIResponse(ctx, conversation) {
  try {
    // Get conversation messages in format for OpenAI
    const messages = conversation.messages.map(msg => ({
      role: msg.role,
      content: msg.text
    }));
    
    // Generate response using OpenAI
    const response = await openaiService.generateResponse(messages);
    
    console.log('Sending response to user:', response.substring(0, 50) + '...');
    await ctx.reply(response);
    
    // Add bot response to conversation
    conversation.addMessage(response, 'assistant');
    console.log('Response added to conversation');
  } catch (error) {
    console.error('Error with OpenAI:', error);
    
    // Use fallback response if OpenAI fails
    const fallbackResponse = openaiService.generateFallbackResponse(ctx.message.text);
    await ctx.reply(fallbackResponse);
    
    // Add fallback response to conversation
    conversation.addMessage(fallbackResponse, 'assistant');
  }
}

module.exports = {
  registerMessageHandler
}; 