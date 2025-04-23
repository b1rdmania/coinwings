/**
 * Conversation class to manage user conversations
 */
class Conversation {
  /**
   * Create a new conversation
   * @param {string} userId - User ID
   */
  constructor(userId) {
    this.id = `conv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    this.userId = userId;
    this.messages = [];
    this.firstName = '';
    this.lastName = '';
    this.username = '';
    this.telegramId = userId;
    this.origin = null;
    this.destination = null;
    this.passengers = null;
    this.date = null;
    this.aircraft = null;
    this.country = null;
    this.flownPrivateBefore = null;
    this.affiliateId = null;
    this.affiliateSource = null; // 'telegram', 'website', 'twitter'
    this.notificationSent = false;
    this.notificationReason = null;
    this.lastUpdated = Date.now();
  }

  /**
   * Set affiliate information
   * @param {string} affiliateId - The affiliate code
   * @param {string} source - The source of the affiliate (telegram, website, twitter)
   */
  setAffiliate(affiliateId, source) {
    this.affiliateId = affiliateId;
    this.affiliateSource = source;
    this.lastUpdated = Date.now();
  }

  /**
   * Add a message to the conversation
   * @param {string} role - The role of the message sender (user/assistant)
   * @param {string} text - The message text
   */
  addMessage(role, text) {
    this.messages.push({
      role,
      text,
      timestamp: Date.now()
    });
    this.lastUpdated = Date.now();
  }

  /**
   * Get the last N messages from the conversation
   * @param {number} n - Number of messages to retrieve
   * @returns {Array} - Array of messages
   */
  getLastMessages(n = 10) {
    return this.messages.slice(-n);
  }

  /**
   * Get messages formatted for OpenAI
   * @returns {Array} - Messages formatted for OpenAI
   */
  getMessagesForAI() {
    return this.messages.map(msg => ({
      role: msg.role,
      content: msg.text
    }));
  }

  /**
   * Get the conversation summary
   * @returns {Object} - Summary of the conversation
   */
  getSummary() {
    return {
      id: this.id,
      userId: this.userId,
      firstName: this.firstName,
      lastName: this.lastName,
      username: this.username,
      telegramId: this.telegramId,
      origin: this.origin,
      destination: this.destination,
      passengers: this.passengers,
      date: this.date,
      aircraft: this.aircraft,
      country: this.country,
      flownPrivateBefore: this.flownPrivateBefore,
      affiliateId: this.affiliateId,
      affiliateSource: this.affiliateSource,
      notificationSent: this.notificationSent,
      notificationReason: this.notificationReason,
      lastUpdated: this.lastUpdated
    };
  }
}

// Store conversations in memory
const conversations = {};

/**
 * Get or create a conversation for a user
 * @param {string} userId - User ID
 * @returns {Conversation} - User conversation
 */
function getConversation(userId) {
  if (!conversations[userId]) {
    conversations[userId] = new Conversation(userId);
  }
  return conversations[userId];
}

/**
 * Remove a conversation for a user
 * @param {string} userId - User ID
 */
function removeConversation(userId) {
  delete conversations[userId];
}

module.exports = {
  getConversation,
  removeConversation
}; 