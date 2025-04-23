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
 * @param {string} reason - The reason for the notification
 * @returns {Promise<boolean>} - Whether the notification was sent successfully
 */
const sendAgentNotification = async (ctx, conversation, reason) => {
  try {
    // Store lead data in Firebase
    const leadId = await storeLeadData({
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
      notificationReason: reason
    });

    // Format the notification message
    const message = formatNotificationMessage(conversation);

    // Send the notification to the agent channel
    const channelId = config.telegram.agentChannel;
    console.log(`Sending notification to channel ID: ${channelId}`);
    
    await ctx.telegram.sendMessage(channelId, message);
    console.log('Notification sent successfully');
    
    return true;
  } catch (error) {
    console.error('Error sending notification:', error);
    return false;
  }
};

module.exports = {
  sendAgentNotification
};