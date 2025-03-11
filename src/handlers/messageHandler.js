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
            'would you like to connect',
            'pass your inquiry',
            'get you a quote',
            'exact quote'
          ];
          
          for (const pattern of suggestHandoffPatterns) {
            if (lastBotText.includes(pattern)) {
              suggestedHandoff = true;
              break;
            }
          }
        }
      }
      
      // Handle humor for time-wasters with light-hearted responses
      const isJokeOrTimeWaster = checkForJokeOrTimeWaster(messageText);
      if (isJokeOrTimeWaster) {
        const humorResponse = generateHumorResponse(messageText);
        await ctx.reply(humorResponse);
        conversation.addMessage(humorResponse, 'assistant');
        return;
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
        const confirmationMessage = `Thanks for your interest in CoinWings! ✨

I've notified our aviation team, and a specialist will contact you shortly to discuss your requirements in detail. They typically respond within 15 minutes during business hours.

Here's a summary of what I've sent to our team:

${formatSummary(summary || 'Your flight inquiry')}

Feel free to ask any other questions while you wait. Is there anything specific you'd like the specialist to address when they reach out?`;
        
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
 * Format the conversation summary with emoji and better structure
 * @param {string} summary - The conversation summary
 * @returns {string} - Formatted summary
 */
function formatSummary(summary) {
  if (!summary) return '';
  
  // Add emoji to common patterns
  let formatted = summary
    .replace(/Route:/gi, '✈️ **Route:**')
    .replace(/Origin:/gi, '🛫 **Origin:**')
    .replace(/Destination:/gi, '🛬 **Destination:**')
    .replace(/Passengers:/gi, '👥 **Passengers:**')
    .replace(/Date:/gi, '📅 **Date:**')
    .replace(/Dates:/gi, '📅 **Dates:**')
    .replace(/Aircraft:/gi, '🛩 **Aircraft:**')
    .replace(/Special requests:/gi, '✨ **Special requests:**')
    .replace(/Payment:/gi, '💰 **Payment:**');
  
  return formatted;
}

/**
 * Check if message is a joke or time-waster
 * @param {string} text - Message text
 * @returns {boolean} - Whether message is a joke
 */
function checkForJokeOrTimeWaster(text) {
  const lowerText = text.toLowerCase();
  
  const jokePatterns = [
    /can (my|a) (dog|cat|pet) fly (alone|by (itself|himself|herself))/i,
    /send (my|a) (dog|cat|pet) on a jet/i,
    /fly (me|us) to (the moon|mars|space)/i,
    /cheapest possible/i,
    /free flight/i,
    /discount/i,
    /how much for a submarine/i,
    /teleport/i,
    /time travel/i,
    /invisible jet/i
  ];
  
  return jokePatterns.some(pattern => pattern.test(lowerText));
}

/**
 * Generate a humorous response for time-wasters
 * @param {string} text - Message text
 * @returns {string} - Humorous response
 */
function generateHumorResponse(text) {
  const lowerText = text.toLowerCase();
  
  if (/can (my|a) (dog|cat|pet) fly (alone|by (itself|himself|herself))/i.test(lowerText) || 
      /send (my|a) (dog|cat|pet) on a jet/i.test(lowerText)) {
    return "Technically, yes. But I doubt your pet has a crypto wallet for payment. 🐶💳\n\nJokes aside, we do accommodate pets with their owners! Many clients bring their furry friends along. Would you like information about pet-friendly private jet options?";
  }
  
  if (/fly (me|us) to (the moon|mars|space)/i.test(lowerText)) {
    return "Our jets are impressive, but not quite that impressive! 🚀🌙\n\nFor now, we're limited to Earth-based destinations. But I can help you get to some pretty amazing places here on the ground. Where were you actually thinking of traveling?";
  }
  
  if (/cheapest possible/i.test(lowerText) || /free flight/i.test(lowerText) || /discount/i.test(lowerText)) {
    return "The words 'cheapest' and 'private jet' don't usually appear in the same sentence! 😄\n\nBut we do work to find the most cost-effective options for your specific needs. What's your route? I can provide some realistic pricing ranges.";
  }
  
  if (/how much for a submarine/i.test(lowerText)) {
    return "We specialize in aircraft that fly above water, not under it! 🛩️≠🚢\n\nBut if you're looking for unique travel experiences, a private jet charter might still impress you. Where were you hoping to travel?";
  }
  
  if (/teleport/i.test(lowerText) || /time travel/i.test(lowerText)) {
    return "Our jets are fast, but teleportation is still in beta testing! ⚡\n\nIn the meantime, we can get you there almost as quickly with a private jet. Where are you looking to travel in the conventional space-time continuum?";
  }
  
  if (/invisible jet/i.test(lowerText)) {
    return "Wonder Woman might have an invisible jet, but ours are very much visible - and quite beautiful! ✨\n\nThough our discreet service might make it feel like you're traveling invisibly. What type of aircraft were you actually interested in?";
  }
  
  return "That's an interesting request! While I can't help with that specifically, I can definitely assist with private jet charters to real-world destinations. What were you actually looking to arrange?";
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