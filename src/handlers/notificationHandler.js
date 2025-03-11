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
    const username = conversation.username || userData.username || 'no_username';
    const userId = conversation.telegramId || userData.id;
    
    console.log(`🔍 NOTIFICATION DEBUG: Preparing notification for user ${username}`);
    
    // Create a unique lead ID
    const leadId = `lead_${Date.now()}_${Math.floor(Math.random() * 10)}`;
    
    // Store lead data in database
    const leadData = {
      id: leadId,
      userId: userId,
      username: username,
      firstName: firstName,
      lastName: lastName,
      timestamp: new Date().toISOString(),
      origin: conversation.origin || null,
      destination: conversation.destination || null,
      date: conversation.exactDate || null,
      pax: conversation.pax || null,
      aircraft: conversation.aircraftModel || conversation.aircraftCategory || null,
      reason: conversation.notificationReason || 'Not specified',
      status: 'new',
      messages: conversation.messages.slice(-10) // Last 10 messages
    };
    
    // Store lead in database
    await storeLead(leadData);
    console.log(`Lead ${leadId} stored successfully`);
    console.log('🔍 NOTIFICATION DEBUG: Lead data stored in database');
    
    // Get agent channel ID from config
    const channelId = config.telegram.agentChannel;
    console.log('🔍 NOTIFICATION DEBUG: Agent channel ID from config:', channelId);
    
    // Convert channel ID to number if it's a string
    const numericChannelId = typeof channelId === 'string' ? parseInt(channelId, 10) : channelId;
    console.log('🔍 NOTIFICATION DEBUG: Converted channel ID to number:', numericChannelId);
    
    // Format the notification message
    let recentMessages = '';
    const lastMessages = conversation.messages.slice(-10).reverse(); // Get last 10 messages in reverse order
    
    for (let i = 0; i < lastMessages.length; i++) {
      const msg = lastMessages[i];
      const icon = msg.role === 'user' ? '👤' : '🤖';
      // Truncate long messages
      const text = msg.text.length > 100 ? msg.text.substring(0, 97) + '...' : msg.text;
      recentMessages += `${icon} ${text}\n`;
    }
    
    // Create a direct reply link using the user's ID
    const replyLink = userId ? `https://t.me/user?id=${userId}` : `https://t.me/${username}`;
    
    // Format the notification message
    const message = `🤖 NEW LEAD - ${new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}

Contact: ${firstName} ${lastName}${username ? ` (@${username})` : ''}

Lead Details:
${conversation.origin && conversation.destination ? `🛫 Route: ${conversation.origin} to ${conversation.destination}` : ''}
${conversation.pax ? `👥 Passengers: ${conversation.pax}` : ''}
${conversation.exactDate ? `📅 Date: ${conversation.exactDate}` : ''}
${conversation.aircraftModel || conversation.aircraftCategory ? `✈️ Aircraft: ${conversation.aircraftModel || conversation.aircraftCategory}` : ''}
📝 Reason for Handoff: ${conversation.notificationReason || 'Not specified'}

Conversation History:
${recentMessages}
Trigger: ${triggerType === 'request' ? 'User Requested' : 'AI Recommended'}

Reply to this user: ${replyLink}`;

    console.log(`🔍 NOTIFICATION DEBUG: Attempting to send notification to channel ID: ${numericChannelId}`);
    console.log(`🔍 NOTIFICATION DEBUG: Message length: ${message.length} characters`);
    
    // Send notification to agent channel
    const result = await ctx.telegram.sendMessage(numericChannelId, message);
    console.log(`✅ Successfully sent notification to channel ${numericChannelId}`);
    console.log('🔍 NOTIFICATION DEBUG: Telegram API response:', JSON.stringify(result, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Error sending agent notification:', error);
    
    // Try to notify the user that there was an issue
    try {
      await ctx.reply("I'm having trouble connecting you with our team. Please try again in a few moments or contact us directly at support@coinwings.io");
    } catch (replyError) {
      console.error('Failed to send error message to user:', replyError);
    }
    
    return false;
  }
}

module.exports = {
  sendAgentNotification
};