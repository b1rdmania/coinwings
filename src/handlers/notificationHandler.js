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
    console.log('Starting notification process...');
    const userData = ctx.from;
    const score = calculateLeadScore(conversation.getDataForScoring());
    const priority = getLeadPriority(score);
    
    // Use the name from the conversation object if available
    const firstName = conversation.firstName || userData.first_name || 'Anonymous';
    const lastName = conversation.lastName || userData.last_name || '';
    const username = userData.username || `ID: ${userData.id}`;
    
    console.log(`Preparing notification for user ${username} with score ${score}`);
    
    // Create a clean summary of the conversation
    let summary = '';
    
    // Add route information
    if (conversation.origin && conversation.destination) {
      summary += `Route: ${conversation.origin} to ${conversation.destination}\n`;
    } else if (conversation.origin) {
      summary += `Origin: ${conversation.origin}\n`;
    } else if (conversation.destination) {
      summary += `Destination: ${conversation.destination}\n`;
    }
    
    // Add passenger information
    if (conversation.pax) {
      summary += `Passengers: ${conversation.pax}\n`;
    }
    
    // Add date information
    if (conversation.exactDate) {
      summary += `Date: ${conversation.exactDate}\n`;
    } else if (conversation.dateRange) {
      summary += `Date Range: ${conversation.dateRange.start} to ${conversation.dateRange.end}\n`;
    }
    
    // Add aircraft information
    if (conversation.aircraftModel) {
      summary += `Aircraft: ${conversation.aircraftModel}\n`;
    } else if (conversation.aircraftCategory) {
      summary += `Aircraft Category: ${conversation.aircraftCategory}\n`;
    }
    
    // Add country information
    if (conversation.country) {
      summary += `Country: ${conversation.country}\n`;
    }
    
    // Add conversation history (last 5 messages)
    summary += '\nConversation History:\n';
    const recentMessages = conversation.messages.slice(-10);
    recentMessages.forEach(message => {
      const role = message.role === 'user' ? '👤' : '🤖';
      // Truncate long messages
      const text = message.text.length > 100 ? message.text.substring(0, 100) + '...' : message.text;
      summary += `${role} ${text}\n`;
    });
    
    // Format notification message
    const triggerEmoji = triggerType === 'manual' ? '👤' : '🤖';
    const priorityEmoji = priority === 'high' ? '🔴' : (priority === 'medium' ? '🟠' : '🟢');
    
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
    let message = `${triggerEmoji} ${priorityEmoji} NEW LEAD (${score}/100) - ${dateTimeStr}\n\n`;
    
    // Add contact info
    message += `Contact: ${firstName} ${lastName} (@${username})\n\n`;
    
    // Add lead details
    message += `Lead Details:\n${summary}\n`;
    
    // Add additional information if available
    if (conversation.flownPrivateBefore) {
      message += `Flown Private Before: ${conversation.flownPrivateBefore}\n`;
    }
    
    // Add lead score and trigger
    message += `Lead Score: ${score}/100 (${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority)\n`;
    message += `Trigger: ${triggerType === 'manual' ? 'User Requested' : 'Auto-escalated'}\n`;
    
    // Add reply link
    message += `\nReply to this user: https://t.me/${userData.username || `user?id=${userData.id}`}`;
    
    // Try to store lead in database
    try {
      const leadData = {
        userId: userData.id,
        username: userData.username || 'Anonymous',
        firstName: firstName,
        lastName: lastName,
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
        aircraft: conversation.aircraftModel || conversation.aircraftCategory,
        flownPrivateBefore: conversation.flownPrivateBefore
      };
      
      await storeLead(leadData);
      console.log('Lead data stored in database');
    } catch (dbError) {
      console.error('Error storing lead in database:', dbError);
      // Continue with notification even if database storage fails
    }
    
    // Send to agent channel
    const channelId = config.telegram.agentChannel;
    if (!channelId) {
      console.error('❌ Agent channel not configured');
      return false;
    }
    
    console.log(`Sending notification to channel ID: ${channelId}`);
    
    try {
      await ctx.telegram.sendMessage(channelId, message);
      console.log(`✅ Successfully sent notification to channel ${channelId}`);
      conversation.notificationSent = true;
      return true;
    } catch (error) {
      console.error('❌ Error sending notification:', error.message);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Mark as sent anyway to prevent repeated attempts
      conversation.notificationSent = true;
      return false;
    }
  } catch (error) {
    console.error('Error in notification process:', error);
    // Mark as sent to prevent repeated attempts
    if (conversation) {
      conversation.notificationSent = true;
    }
    return false;
  }
}

module.exports = sendAgentNotification;