const config = require('../config/config');
const { calculateLeadScore, getLeadPriority } = require('../utils/leadScoring');
const { storeLead } = require('../services/firebase');

/**
 * Send notification to agent channel about a potential lead
 * @param {Object} ctx - Telegram context
 * @param {Object} conversation - User conversation
 * @param {string} triggerType - What triggered the notification (auto/manual)
 * @returns {Promise<boolean>} Success status
 */
async function sendAgentNotification(ctx, conversation, triggerType = 'auto') {
  try {
    const userData = ctx.from;
    const score = calculateLeadScore(conversation.getDataForScoring());
    const priority = getLeadPriority(score);
    const summary = conversation.getSummary();
    
    // Use the name from the conversation object if available
    if (conversation.firstName) {
      userData.first_name = conversation.firstName;
    }
    if (conversation.lastName) {
      userData.last_name = conversation.lastName;
    }
    
    console.log(`Sending ${triggerType} notification for user ${userData.username || userData.id} with score ${score}`);
    
    // Format notification message
    const notificationText = formatNotificationMessage(userData, score, summary, priority, triggerType);
    
    // Try to store lead in database
    try {
      const leadData = {
        userId: userData.id,
        username: userData.username || 'Anonymous',
        firstName: conversation.firstName || userData.first_name || 'Anonymous',
        lastName: conversation.lastName || userData.last_name || '',
        score: score,
        priority: priority,
        triggerType: triggerType,
        timestamp: new Date().toISOString(),
        summary: summary,
        conversation: conversation.messages,
        origin: conversation.origin,
        destination: conversation.destination,
        pax: conversation.pax,
        date: conversation.exactDate || (conversation.dateRange ? `${conversation.dateRange.start} to ${conversation.dateRange.end}` : null),
        aircraft: conversation.aircraftModel || conversation.aircraftCategory
      };
      
      await storeLead(leadData);
      console.log('Lead data stored in database');
    } catch (dbError) {
      console.error('Error storing lead in database:', dbError);
      // Continue with notification even if database storage fails
    }
    
    // Send to agent channel if configured
    if (config.telegram.agentChannel) {
      try {
        console.log(`Sending notification to channel: ${config.telegram.agentChannel}`);
        
        // Log the notification text for debugging
        console.log(`Notification text: ${notificationText.substring(0, 100)}...`);
        
        // Send without parse_mode to avoid formatting errors
        await ctx.telegram.sendMessage(config.telegram.agentChannel, notificationText);
        
        console.log(`Notification sent to agent channel for user ${userData.username || userData.id}`);
        
        // Mark notification as sent
        conversation.notificationSent = true;
        
        return true;
      } catch (channelError) {
        console.error('Error sending to agent channel:', channelError);
        console.error('Error details:', JSON.stringify(channelError, null, 2));
        
        // Try sending to admin as fallback
        if (process.env.ADMIN_USER_ID) {
          try {
            console.log(`Sending notification to admin: ${process.env.ADMIN_USER_ID}`);
            await ctx.telegram.sendMessage(process.env.ADMIN_USER_ID, 
              `Failed to send to agent channel. Here's the notification:\n\n${notificationText}`);
            console.log('Notification sent to admin as fallback');
            return true;
          } catch (adminError) {
            console.error('Error sending to admin:', adminError);
          }
        }
        
        console.log('Agent channel notification failed');
        return false;
      }
    } else {
      console.log('Agent channel not configured');
      return false;
    }
  } catch (error) {
    console.error('Error sending agent notification:', error);
    return false;
  }
}

/**
 * Format the notification message for agents
 * @param {Object} userData - User data from Telegram
 * @param {number} score - Lead score
 * @param {string} summary - Conversation summary
 * @param {string} priority - Priority level (high, medium, low)
 * @param {string} triggerType - What triggered the notification (auto/manual)
 * @returns {string} Formatted notification message
 */
function formatNotificationMessage(userData, score, summary, priority, triggerType) {
  const priorityEmoji = priority === 'high' ? '🔴' : (priority === 'medium' ? '🟠' : '🟢');
  const triggerEmoji = triggerType === 'manual' ? '👤' : '🤖';
  
  // Format the summary
  let formattedSummary = summary || 'No detailed information provided';
  
  // Add emoji to common patterns in summary
  formattedSummary = formattedSummary
    .replace(/Route:/gi, '✈️ Route:')
    .replace(/Origin:/gi, '🛫 Origin:')
    .replace(/Destination:/gi, '🛬 Destination:')
    .replace(/Passengers:/gi, '👥 Passengers:')
    .replace(/Date:/gi, '📅 Date:')
    .replace(/Dates:/gi, '📅 Dates:')
    .replace(/Aircraft:/gi, '🛩 Aircraft:')
    .replace(/Special requests:/gi, '✨ Special requests:')
    .replace(/Payment:/gi, '💰 Payment:');
  
  // Get current date and time
  const now = new Date();
  const dateTimeStr = now.toLocaleString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  // Create a notification message
  return `${triggerEmoji} ${priorityEmoji} NEW LEAD (${score}/100) - ${dateTimeStr}
    
Contact: ${userData.first_name || ''} ${userData.last_name || ''} ${userData.username ? `(@${userData.username})` : '(no username)'}

Lead Details:
${formattedSummary}

Lead Score: ${score}/100 (${priorityEmoji} ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority)
Trigger: ${triggerType === 'manual' ? 'User Requested' : 'Auto-escalated'}

Reply to this user: https://t.me/${userData.username || `user?id=${userData.id}`}`;
}

module.exports = sendAgentNotification; 