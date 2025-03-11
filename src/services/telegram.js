/**
 * Telegram service for sending messages
 */

const { Telegraf } = require('telegraf');
const config = require('../config/config');

// Initialize the bot
const bot = new Telegraf(process.env.BOT_TOKEN);

/**
 * Send a message to a user or channel
 * @param {string} chatId - Chat ID to send the message to
 * @param {string} text - Message text
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Message object
 */
async function sendMessage(chatId, text, options = {}) {
  try {
    return await bot.telegram.sendMessage(chatId, text, options);
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
}

module.exports = {
  sendMessage,
  bot
}; 