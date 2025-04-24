const config = require('../config/config.js');
const { storeLeadData } = require('../services/firebase');

/**
 * Format the notification message
 * @param {Object} conversation - The conversation object
 * @returns {string} - The formatted notification message
 */
const formatNotificationMessage = (conversation) => {
  const dateTimeStr = new Date().toLocaleString();
  
  return `
🤖 🔴 NEW LEAD - ${dateTimeStr}

Contact: ${conversation.firstName} ${conversation.lastName} (${conversation.username ? '@' + conversation.username : 'No Username'})
Telegram ID: ${conversation.telegramId}
${conversation.affiliateId ? `Affiliate: ${conversation.affiliateId} (via ${conversation.affiliateSource})` : ''}
Firebase Lead ID: ${conversation.id}

Lead Details:
✈️ Route: ${conversation.origin} → ${conversation.destination}
👥 Passengers: ${conversation.passengers}
📅 Date: ${conversation.date}
🛩 Aircraft: ${conversation.aircraft}
${conversation.country ? `🌍 Country: ${conversation.country}` : ''}
${conversation.flownPrivateBefore ? `✈️ Experience: ${conversation.flownPrivateBefore}` : ''}

Source: CoinWings
${conversation.notificationReason ? `Reason: ${conversation.notificationReason}` : ''}

Reply to this user: https://t.me/user?id=${conversation.telegramId}
`;
};

/**
 * Send notification to agent channel
 * @param {Object} ctx - Telegram context
 * @param {Object} conversation - The conversation object
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
const sendAgentNotification = async (ctx, conversation) => {
  console.log(`[NotificationHandler] Attempting to send notification for conversation ID: ${conversation.id}`);
  try {
    // Store lead data in Firebase
    const leadDataPayload = {
      id: conversation.id,
      telegramId: conversation.telegramId,
      firstName: conversation.firstName,
      lastName: conversation.lastName,
      username: conversation.username,
      origin: conversation.origin,
      destination: conversation.destination,
      passengers: conversation.passengers,
      date: conversation.date,
      aircraft: conversation.aircraft,
      country: conversation.country,
      flownPrivateBefore: conversation.flownPrivateBefore,
      affiliateId: conversation.affiliateId,
      notificationReason: conversation.notificationReason // Use reason from conversation
    };
    console.log(`[NotificationHandler] Storing lead data:`, leadDataPayload);
    const leadId = await storeLeadData(leadDataPayload);
    console.log(`[NotificationHandler] Lead data stored successfully with Firebase ID: ${leadId}`);

    // Format the notification message
    const message = formatNotificationMessage(conversation);

    // Send the notification to the agent channel
    const channelId = config.telegram.agentChannel;
    console.log(`[NotificationHandler] Sending notification message to channel ID: ${channelId}`);
    console.log(`[NotificationHandler] Message content:
${message}`); // Log the actual message
    
    await ctx.telegram.sendMessage(channelId, message);
    console.log('[NotificationHandler] Telegram message sent successfully.');
    
    // Maybe return true on success?
    return true;
  } catch (error) {
    console.error('[NotificationHandler] Error sending notification:', error);
    // Log specific parts of the error if helpful
    if (error.response) {
        console.error('[NotificationHandler] Telegram API Error Response:', error.response);
    }
    // Maybe return false on failure?
    return false;
  }
};

module.exports = {
  sendAgentNotification
};