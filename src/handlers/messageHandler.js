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
      
      // Check if this is a handoff request before adding to conversation
      const isHandoffRequest = conversation.checkForHandoffRequest(messageText);
      if (isHandoffRequest) {
        console.log(`Handoff requested detected via pattern: ${messageText}`);
      }
      
      // Add message to conversation history
      conversation.addMessage(messageText);
      console.log('Message added to conversation');
      
      // Calculate lead score
      const score = calculateLeadScore(conversation.getDataForScoring());
      console.log(`Lead score for ${username}: ${score}`);
      
      // Check if the last bot message suggested connecting with a specialist
      let suggestedHandoff = false;
      if (conversation.messages.length >= 2) {
        const lastBotMessage = conversation.messages.slice().reverse().find(m => m.role === 'assistant');
        if (lastBotMessage) {
          const lastBotText = lastBotMessage.text.toLowerCase();
          const suggestHandoffPatterns = [
            'connect you with',
            'connect with our',
            'connect with a specialist',
            'arrange this for you',
            'would you like me to',
            'would you like to speak',
            'would you like to connect'
          ];
          
          for (const pattern of suggestHandoffPatterns) {
            if (lastBotText.includes(pattern)) {
              suggestedHandoff = true;
              break;
            }
          }
        }
      }
      
      // Check if we should escalate to agent (either by score, explicit request, or affirmative response to suggestion)
      const shouldEscalate = shouldEscalateToAgent(score) || 
                            isHandoffRequest || 
                            (suggestedHandoff && /^(yes|sure|ok|okay|definitely|absolutely|of course|please do|go ahead)$/i.test(messageText.trim()));
      
      if (shouldEscalate) {
        console.log(`Escalating to agent for user ${username} (score: ${score}, handoff requested: ${isHandoffRequest}, response to suggestion: ${suggestedHandoff})`);
        
        // Send notification to agent channel
        await sendAgentNotification(ctx, conversation, isHandoffRequest || suggestedHandoff ? 'manual' : 'auto');
        
        // Get conversation summary
        const summary = conversation.getSummary();
        
        // Create a confirmation message with the summary
        const confirmationMessage = `Thanks for your interest in CoinWings!\n\n` +
          `I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail.\n\n` +
          `We aim to reply within 15 minutes during business hours.\n\n` +
          `Here's a summary of the information we've sent to our team:\n\n` +
          `${summary || 'Your flight inquiry details'}\n\n` +
          `Feel free to ask any other questions you might have while waiting.`;
        
        await ctx.reply(confirmationMessage);
        
        // Add confirmation to conversation
        conversation.addMessage(confirmationMessage, 'assistant');
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
    
    // Generate response using OpenAI with conversation context
    const response = await openaiService.generateResponse(messages, conversation);
    
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