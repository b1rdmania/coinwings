const config = require('../config/config');
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
    console.log('🔍 NOTIFICATION DEBUG: Starting notification process...');
    console.log('🔍 NOTIFICATION DEBUG: Context object keys:', Object.keys(ctx));
    console.log('🔍 NOTIFICATION DEBUG: Telegram object available:', !!ctx.telegram);
    
    const userData = ctx.from;
    console.log('🔍 NOTIFICATION DEBUG: User data:', JSON.stringify(userData, null, 2));
    
    // Use the name from the conversation object if available
    const firstName = conversation.firstName || userData.first_name || 'Anonymous';
    const lastName = conversation.lastName || userData.last_name || '';
    const username = userData.username || `ID: ${userData.id}`;
    
    console.log(`🔍 NOTIFICATION DEBUG: Preparing notification for user ${username}`);
    
    // Create a clean summary of the conversation
    let summary = '';
    
    // Create a notification message
    let message = `🤖 NEW LEAD - ${dateTimeStr}\n\n`;
    
    // Add contact info
    message += `Contact: ${firstName} ${lastName} (@${username})\n\n`;
    
    // Add lead details section header
    message += `Lead Details:\n`;
    
    // Add route information
    if (conversation.origin && conversation.destination) {
      message += `🛫 Route: ${conversation.origin} to ${conversation.destination}\n`;
    } else if (conversation.origin) {
      message += `🛫 Origin: ${conversation.origin}\n`;
    } else if (conversation.destination) {
      message += `🛬 Destination: ${conversation.destination}\n`;
    }
    
    // Add passenger information
    if (conversation.pax) {
      message += `👥 Passengers: ${conversation.pax}\n`;
    }
    
    // Add date information
    if (conversation.exactDate) {
      message += `📅 Date: ${conversation.exactDate}\n`;
    } else if (conversation.dateRange) {
      message += `📅 Date Range: ${conversation.dateRange.start} to ${conversation.dateRange.end}\n`;
    }
    
    // Add aircraft information
    if (conversation.aircraftModel) {
      message += `✈️ Aircraft: ${conversation.aircraftModel}\n`;
    } else if (conversation.aircraftCategory) {
      message += `✈️ Aircraft Category: ${conversation.aircraftCategory}\n`;
    }
    
    // Add country information
    if (conversation.country) {
      message += `🌍 Country: ${conversation.country}\n`;
    }
    
    // Add additional information if available
    if (conversation.flownPrivateBefore) {
      message += `🔄 Flown Private Before: ${conversation.flownPrivateBefore}\n`;
    }
    
    // Add notification reason if available
    if (conversation.notificationReason) {
      message += `📝 Reason for Handoff: ${conversation.notificationReason}\n`;
    }
    
    // Add conversation history
    message += `\nConversation History:\n`;
    const recentMessages = conversation.messages.slice(-10);
    recentMessages.forEach(msg => {
      const role = msg.role === 'user' ? '👤' : '🤖';
      // Truncate long messages
      const text = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
      message += `${role} ${text}\n`;
    });
    
    // Get current date and time
    const now = new Date();
    const dateTimeStr = now.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
    
    // Add trigger type
    message += `\nTrigger: ${triggerType === 'manual' ? 'User Requested' : (triggerType === 'test' ? 'Test' : 'AI Recommended')}\n`;
    
    // Add reply link
    message += `\nReply to this user: https://t.me/${userData.username || `user?id=${userData.id}`}`;
    
    // Try to store lead in database
    try {
      // Create a summary for database storage
      let summaryText = '';
      if (conversation.origin && conversation.destination) {
        summaryText += `Route: ${conversation.origin} to ${conversation.destination}\n`;
      } else if (conversation.origin) {
        summaryText += `Origin: ${conversation.origin}\n`;
      } else if (conversation.destination) {
        summaryText += `Destination: ${conversation.destination}\n`;
      }
      
      if (conversation.pax) {
        summaryText += `Passengers: ${conversation.pax}\n`;
      }
      
      if (conversation.exactDate) {
        summaryText += `Date: ${conversation.exactDate}\n`;
      } else if (conversation.dateRange) {
        summaryText += `Date Range: ${conversation.dateRange.start} to ${conversation.dateRange.end}\n`;
      }
      
      if (conversation.aircraftModel) {
        summaryText += `Aircraft: ${conversation.aircraftModel}\n`;
      } else if (conversation.aircraftCategory) {
        summaryText += `Aircraft Category: ${conversation.aircraftCategory}\n`;
      }
      
      if (conversation.country) {
        summaryText += `Country: ${conversation.country}\n`;
      }
      
      const leadData = {
        userId: userData.id,
        username: userData.username || 'Anonymous',
        firstName: firstName,
        lastName: lastName,
        triggerType: triggerType,
        timestamp: new Date().toISOString(),
        summary: summaryText,
        conversation: conversation.messages,
        origin: conversation.origin,
        destination: conversation.destination,
        pax: conversation.pax,
        date: conversation.exactDate || (conversation.dateRange ? `${conversation.dateRange.start} to ${conversation.dateRange.end}` : null),
        aircraft: conversation.aircraftModel || conversation.aircraftCategory,
        flownPrivateBefore: conversation.flownPrivateBefore,
        notificationReason: conversation.notificationReason
      };
      
      await storeLead(leadData);
      console.log('🔍 NOTIFICATION DEBUG: Lead data stored in database');
    } catch (dbError) {
      console.error('🔍 NOTIFICATION DEBUG: Error storing lead in database:', dbError);
      // Continue with notification even if database storage fails
    }
    
    // Send to agent channel
    let channelId = config.telegram.agentChannel;
    console.log('🔍 NOTIFICATION DEBUG: Agent channel ID from config:', channelId);
    
    // Ensure channel ID is in the correct format
    if (typeof channelId === 'string' && channelId.startsWith('-100')) {
      // Convert to number if it's a string with -100 prefix (Telegram supergroup format)
      channelId = parseInt(channelId, 10);
      console.log('🔍 NOTIFICATION DEBUG: Converted channel ID to number:', channelId);
    }
    
    if (!channelId) {
      console.error('❌ Agent channel not configured');
      return false;
    }
    
    console.log(`🔍 NOTIFICATION DEBUG: Attempting to send notification to channel ID: ${channelId}`);
    console.log(`🔍 NOTIFICATION DEBUG: Message length: ${message.length} characters`);
    
    // Try sending with the primary channel ID
    try {
      const result = await ctx.telegram.sendMessage(channelId, message);
      console.log(`✅ Successfully sent notification to channel ${channelId}`);
      console.log('🔍 NOTIFICATION DEBUG: Telegram API response:', JSON.stringify(result, null, 2));
      conversation.notificationSent = true;
      return true;
    } catch (error) {
      console.error('❌ Error sending notification:', error.message);
      console.error('🔍 NOTIFICATION DEBUG: Full error object:', JSON.stringify(error, null, 2));
      
      // Try alternative channel ID formats
      const alternativeFormats = [
        channelId.toString(),                   // Try as string
        channelId.toString().replace('-100', '-'), // Try with -100 replaced by -
        channelId.toString().replace('-', '-100')  // Try with - replaced by -100
      ];
      
      // Try each alternative format
      for (const altId of alternativeFormats) {
        if (altId === channelId.toString()) continue; // Skip if same as original
        
        try {
          console.log(`🔍 NOTIFICATION DEBUG: Trying alternative channel ID format: ${altId}`);
          await ctx.telegram.sendMessage(altId, message);
          console.log(`✅ Successfully sent notification using alternative format: ${altId}`);
          conversation.notificationSent = true;
          return true;
        } catch (altError) {
          console.error(`❌ Error with alternative format ${altId}:`, altError.message);
        }
      }
      
      // Try with a simpler message as a last resort
      try {
        console.log('🔍 NOTIFICATION DEBUG: Attempting to send simplified notification as fallback');
        const simpleMessage = `NEW LEAD - ${firstName} ${lastName} (@${username})`;
        await ctx.telegram.sendMessage(channelId, simpleMessage);
        console.log('✅ Successfully sent simplified notification');
        conversation.notificationSent = true;
        return true;
      } catch (fallbackError) {
        console.error('❌ Error sending simplified notification:', fallbackError.message);
        // Mark as sent anyway to prevent repeated attempts
        conversation.notificationSent = true;
        return false;
      }
    }
  } catch (error) {
    console.error('Error in notification process:', error);
    console.error('🔍 NOTIFICATION DEBUG: Stack trace:', error.stack);
    // Mark as sent to prevent repeated attempts
    if (conversation) {
      conversation.notificationSent = true;
    }
    return false;
  }
}

module.exports = sendAgentNotification;