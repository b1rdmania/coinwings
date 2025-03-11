/**
 * Conversation class to manage user conversations
 */
class Conversation {
  /**
   * Create a new conversation
   * @param {string} userId - User ID
   * @param {string} username - Username
   */
  constructor(userId, username) {
    this.userId = userId;
    this.username = username;
    this.messages = [];
    this.notificationSent = false;
    this.shouldNotifyAgent = false;
    this.notificationReason = null;
    this.createdAt = new Date();
    this.lastActivity = new Date();
    
    // Basic conversation state
    this.origin = null;
    this.destination = null;
    this.pax = null;
    this.exactDate = null;
    this.dateRange = null;
    this.aircraftCategory = null;
    this.aircraftModel = null;
    this.firstName = null;
    this.lastName = null;
    this.country = null;
    this.flownPrivateBefore = null;
    this.additionalDetails = null;
    this.funSummary = null;
  }

  /**
   * Add a message to the conversation
   * @param {string} text - Message text
   * @param {string} role - Message role (user/assistant)
   */
  addMessage(text, role = 'user') {
    this.messages.push({
      role,
      text,
      timestamp: new Date()
    });
    
    this.lastActivity = new Date();
  }

  /**
   * Get messages formatted for OpenAI
   * @returns {Array} - Messages formatted for OpenAI
   */
  getMessagesForAI() {
    return this.messages.map(message => ({
      role: message.role,
      content: message.text
    }));
  }
}

// Store conversations in memory
const conversations = {};

/**
 * Get or create a conversation for a user
 * @param {string} userId - User ID
 * @param {string} username - Username
 * @returns {Conversation} - User conversation
 */
function getConversation(userId, username) {
  if (!conversations[userId]) {
    conversations[userId] = new Conversation(userId, username);
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