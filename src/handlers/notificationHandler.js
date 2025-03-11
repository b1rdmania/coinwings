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
    
    // Use the name from the conversation object if available
    if (conversation.firstName) {
      userData.first_name = conversation.firstName;
    }
    if (conversation.lastName) {
      userData.last_name = conversation.lastName;
    }
    
    console.log(`Sending ${triggerType} notification for user ${userData.username || userData.id} with score ${score}`);
    
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
    message += `Contact: ${userData.first_name || ''} ${userData.last_name || ''} ${userData.username ? `(@${userData.username})` : '(no username)'}\n\n`;
    
    // Add lead details
    message += `Lead Details:\n${summary}\n`;
    
    // Add additional information if available
    if (conversation.flownPrivateBefore) {
      message += `Flown Private Before: ${conversation.flownPrivateBefore}\n`;
    }
    
    // Add lead score and trigger
    message += `Lead Score: ${score}/100 (${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority)\n`;
    message += `Trigger: ${triggerType === 'manual' ? 'User Requested' : 'Auto-escalated'}\n`;
    
    // Add fun summary if available
    if (conversation.funSummary) {
      message += `\n${triggerEmoji} Quick Note: ${conversation.funSummary}\n`;
    }
    
    // Add reply link
    message += `\nReply to this user: https://t.me/${userData.username || `user?id=${userData.id}`}`;
    
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
        aircraft: conversation.aircraftModel || conversation.aircraftCategory,
        funSummary: conversation.funSummary,
        flownPrivateBefore: conversation.flownPrivateBefore
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
        console.log(`Notification text: ${message.substring(0, 100)}...`);
        
        // Send without parse_mode to avoid formatting errors
        await ctx.telegram.sendMessage(config.telegram.agentChannel, message);
        
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
              `Failed to send to agent channel. Here's the notification:\n\n${message}`);
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

module.exports = sendAgentNotification;