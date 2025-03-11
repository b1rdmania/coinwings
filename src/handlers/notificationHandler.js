const config = require('../config/config');
const { calculateLeadScore, getLeadPriority } = require('../utils/leadScoring');
const { storeLead } = require('../services/firebase');

/**
 * Send notification to agent channel about a potential lead
 * @param {Object} ctx - Telegram context
 * @param {Object} conversation - User conversation
 * @param {string} triggerType - What triggered the notification (auto/manual)
 * @returns {Promise<void>}
 */
async function sendAgentNotification(ctx, conversation, triggerType = 'auto') {
  try {
    const userData = ctx.from;
    const score = calculateLeadScore(conversation.getDataForScoring());
    const priority = getLeadPriority(score);
    const summary = conversation.getSummary();
    
    // Log notification attempt
    console.log(`Sending ${triggerType} notification for user ${userData.username || userData.id} with score ${score}`);
    
    // Store lead in database
    const leadData = {
      userId: userData.id,
      username: userData.username || 'Anonymous',
      firstName: userData.first_name || 'Anonymous',
      lastName: userData.last_name || '',
      score: score,
      priority: priority,
      triggerType: triggerType,
      timestamp: new Date().toISOString(),
      summary: summary,
      conversation: conversation.messages
    };
    
    await storeLead(leadData);
    console.log('Lead data stored in database');
    
    // Format notification message
    const priorityEmoji = priority === 'high' ? '🔴' : (priority === 'medium' ? '🟠' : '🟢');
    const triggerEmoji = triggerType === 'manual' ? '👤' : '🤖';
    
    const notificationText = formatNotificationMessage(userData, score, summary, priorityEmoji, triggerEmoji);
    
    // Send to agent channel if configured
    if (config.telegram.agentChannel) {
      await ctx.telegram.sendMessage(config.telegram.agentChannel, notificationText);
      console.log(`Notification sent to agent channel for user ${userData.username || userData.id}`);
    } else {
      console.log('Agent channel not configured. Notification would have been:');
      console.log(notificationText);
    }
    
  } catch (error) {
    console.error('Error sending agent notification:', error);
    // Don't throw the error - we don't want to break the user experience if notification fails
  }
}

/**
 * Format the notification message for agents
 * @param {Object} userData - User data from Telegram
 * @param {number} score - Lead score
 * @param {string} summary - Conversation summary
 * @param {string} priorityEmoji - Emoji indicating priority
 * @param {string} triggerEmoji - Emoji indicating trigger type
 * @returns {string} Formatted notification message
 */
function formatNotificationMessage(userData, score, summary, priorityEmoji, triggerEmoji) {
  return `${triggerEmoji} ${priorityEmoji} NEW LEAD (${score}/100)
    
From: ${userData.first_name || ''} ${userData.last_name || ''} (@${userData.username || 'no username'})

${summary}

Reply to this user: https://t.me/${userData.username}`;
}

module.exports = sendAgentNotification; 