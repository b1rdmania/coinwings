const { generateResponse } = require('../services/openai');
const { getConversation } = require('../models/conversation');
const { calculateLeadScore, shouldEscalateToAgent } = require('../utils/leadScoring');
const { sendAgentNotification } = require('./notificationHandler');
const { formatTelegramMarkdownV2 } = require('../utils/formatting');

/**
 * Register message handler for the bot
 * @param {Object} bot - Telegram bot instance
 */
function registerMessageHandler(bot) {
  bot.on('message', async (ctx) => {
    let responseText = '';
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
      responseText = await generateResponse(messages, conversation);
      
      // Add AI response to conversation
      conversation.addMessage('assistant', responseText);
      
      // Format the response for Telegram MarkdownV2
      const formattedResponse = formatTelegramMarkdownV2(responseText);
      console.log(`[MessageHandler] Sending formatted response:
${formattedResponse}`);

      // Send response to user with MarkdownV2 parse mode
      await ctx.reply(formattedResponse, { parse_mode: 'MarkdownV2' });
      
      // Calculate lead score
      const score = calculateLeadScore(conversation);
      
      // Check if we should notify an agent based on score
      const shouldNotify = shouldEscalateToAgent(score);
      console.log(`[MessageHandler] Lead Score: ${score}, Escalate based on score: ${shouldNotify}`);
      
      // Check if the *original* AI response indicates a handoff
      const handoffIndicators = [
        'specialist will be in touch',
        'connect you with a specialist',
        'arrange a call with our specialist',
        'connect you with our team',
        'put you in touch with our team'
      ];
      
      const responseIndicatesHandoff = handoffIndicators.some(phrase => 
        responseText.toLowerCase().includes(phrase.toLowerCase())
      );
      console.log(`[MessageHandler] Response indicates handoff: ${responseIndicatesHandoff}`);
      
      // Check if user message indicates a handoff request
      const userRequestsHandoff = ctx.message.text.toLowerCase().includes('speak to someone') || 
                                 ctx.message.text.toLowerCase().includes('talk to a human') ||
                                 ctx.message.text.toLowerCase().includes('connect me with') ||
                                 ctx.message.text.toLowerCase().includes('call with specialist') ||
                                 ctx.message.text.toLowerCase().includes('yes connect please') || 
                                 ctx.message.text.toLowerCase().includes('pass this over to agent');
      console.log(`[MessageHandler] User requests handoff: ${userRequestsHandoff}`);
      
      // Determine overall trigger
      const handoffTriggered = shouldNotify || responseIndicatesHandoff || userRequestsHandoff || conversation.shouldNotifyAgent;
      console.log(`[MessageHandler] Handoff triggered: ${handoffTriggered}, Notification already sent: ${conversation.notificationSent}`);

      // Send notification if triggered and not already sent
      if (handoffTriggered && !conversation.notificationSent) {
        console.log('[MessageHandler] Preparing to send agent notification...');
        
        // Set notification reason if not already set by OpenAI function call
        if (!conversation.notificationReason) {
          if (responseIndicatesHandoff) {
            conversation.notificationReason = 'AI recommended handoff';
          } else if (userRequestsHandoff) {
            conversation.notificationReason = 'User requested handoff';
          } else { // must be score-based
            conversation.notificationReason = 'Lead score threshold reached';
          }
          console.log(`[MessageHandler] Set notificationReason: ${conversation.notificationReason}`);
        }
        
        // Send notification
        await sendAgentNotification(ctx, conversation);
        
        // Mark notification as sent *after* successful sending
        conversation.notificationSent = true;
        console.log('[MessageHandler] Marked notification as sent.');

      } else if (handoffTriggered && conversation.notificationSent) {
        console.log('[MessageHandler] Handoff triggered, but notification was already sent.');
      }
    } catch (error) {
      console.error('[MessageHandler] Error processing message:', error);
      // Ensure fallback is sent even if error happens during handoff logic
      // Use the unformatted responseText if available, otherwise the generic fallback
      const fallbackMessage = responseText ? formatTelegramMarkdownV2(responseText) : 'Sorry, I encountered an error processing your message. Please try again.';
      ctx.reply(fallbackMessage, { parse_mode: 'MarkdownV2' }).catch(replyError => {
          console.error('[MessageHandler] Error sending fallback reply:', replyError);
      });
    }
  });
}

module.exports = {
  registerMessageHandler
}; 