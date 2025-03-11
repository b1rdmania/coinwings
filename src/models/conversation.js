/**
 * Conversation state manager
 * Tracks user interactions and extracts relevant information
 */
class Conversation {
  /**
   * Create a new conversation
   * @param {string} userId - User ID (Telegram ID)
   * @param {string} username - Username
   */
  constructor(userId, username) {
    this.userId = userId;
    this.username = username;
    this.messages = [];
    this.origin = null;
    this.destination = null;
    this.exactDate = null;
    this.dateRange = null;
    this.mentionedTiming = false;
    this.pax = null;
    this.aircraftModel = null;
    this.aircraftCategory = null;
    this.askedDetailedQuestions = false;
    this.urgencySignals = false;
    this.lastActivity = Date.now();
    this.handoffRequested = false;
    this.handoffSuggested = false;
    
    // New properties for lead-in questions
    this.askedPreviousExperience = false;
    this.explainedPaymentSystem = false;
    this.explainedJetTravel = false;
    this.leadInQuestionsAsked = 0;
    
    // User location
    this.country = null;
    
    // User name
    this.firstName = null;
    this.lastName = null;
    this.askedName = false;
  }

  /**
   * Add a message to the conversation
   * @param {string} text - Message text
   * @param {string} role - Message role (user/assistant)
   */
  addMessage(text, role = 'user') {
    // Ensure role is compatible with OpenAI
    if (role === 'bot') {
      role = 'assistant';
    }
    
    this.messages.push({
      text,
      role,
      timestamp: Date.now()
    });
    
    this.lastActivity = Date.now();
    
    // If it's a user message, analyze it
    if (role === 'user') {
      this.analyzeMessage(text);
    }
  }

  /**
   * Analyze message for relevant information
   * @param {string} text - Message text
   * @private
   */
  analyzeMessage(text) {
    const lowerText = text.toLowerCase();
    
    // Check for cities/airports (simplified - would use NLP in production)
    this.extractLocations(lowerText);
    
    // Check for dates
    this.extractDates(lowerText);
    
    // Check for passenger count
    this.extractPassengers(lowerText);
    
    // Check for aircraft preferences
    this.extractAircraft(lowerText);
    
    // Check for country
    this.extractCountry(lowerText);
    
    // Check for name
    this.extractName(text);
    
    // Check for detailed questions
    this.checkForDetailedQuestions(lowerText);
    
    // Check for urgency signals
    this.checkForUrgencySignals(lowerText);
    
    // Check for handoff request
    this.checkForHandoffRequest(lowerText);
  }

  /**
   * Extract locations from message
   * @param {string} text - Lowercase message text
   * @private
   */
  extractLocations(text) {
    // This is a simplified version - would use NLP in production
    const fromPatterns = [
      /from\s+([a-z\s]+)(?:\s+to|\s+and)/i,
      /flying\s+from\s+([a-z\s]+)/i,
      /departing\s+from\s+([a-z\s]+)/i
    ];
    
    const toPatterns = [
      /to\s+([a-z\s]+)(?:\s+from|\s+and)/i,
      /flying\s+to\s+([a-z\s]+)/i,
      /arriving\s+in\s+([a-z\s]+)/i
    ];
    
    // Check for origin
    for (const pattern of fromPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        this.origin = match[1].trim();
        break;
      }
    }
    
    // Check for destination
    for (const pattern of toPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        this.destination = match[1].trim();
        break;
      }
    }
    
    // Check for city pairs (e.g., "NYC to Miami")
    const cityPairPattern = /([a-z\s]+)\s+(?:to|and)\s+([a-z\s]+)/i;
    const cityPairMatch = text.match(cityPairPattern);
    if (cityPairMatch && cityPairMatch[1] && cityPairMatch[2]) {
      if (!this.origin) this.origin = cityPairMatch[1].trim();
      if (!this.destination) this.destination = cityPairMatch[2].trim();
    }
  }

  /**
   * Extract dates from message
   * @param {string} text - Lowercase message text
   * @private
   */
  extractDates(text) {
    // Check for exact dates (simplified - would use NLP in production)
    const exactDatePattern = /(?:on|for)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\w*)(?:\s+\d{4})?)/i;
    const exactDateMatch = text.match(exactDatePattern);
    
    if (exactDateMatch && exactDateMatch[1]) {
      this.exactDate = exactDateMatch[1].trim();
    }
    
    // Check for date ranges
    const dateRangePattern = /(?:between|from)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\w*))(?:\s+(?:to|and|until|-))\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)(?:\w*))/i;
    const dateRangeMatch = text.match(dateRangePattern);
    
    if (dateRangeMatch && dateRangeMatch[1] && dateRangeMatch[2]) {
      this.dateRange = {
        start: dateRangeMatch[1].trim(),
        end: dateRangeMatch[2].trim()
      };
    }
    
    // Check for timing mentions
    const timingPatterns = [
      /next\s+(?:week|month|weekend)/i,
      /this\s+(?:week|month|weekend)/i,
      /(?:tomorrow|today|tonight)/i,
      /in\s+(?:a|one|two|three|four|five|1|2|3|4|5)\s+(?:day|week|month)/i,
      /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i
    ];
    
    for (const pattern of timingPatterns) {
      if (pattern.test(text)) {
        this.mentionedTiming = true;
        break;
      }
    }
  }

  /**
   * Extract passenger count from message
   * @param {string} text - Lowercase message text
   * @private
   */
  extractPassengers(text) {
    // Check for passenger count
    const paxPatterns = [
      /(\d+)\s+(?:passenger|person|people|pax)/i,
      /(?:passenger|person|people|pax)\s+(?:count|number)(?:\s+(?:of|is))?\s+(\d+)/i,
      /(?:for|with)\s+(\d+)\s+(?:passenger|person|people|pax)/i,
      /(?:we are|there are|we're|there's|we have)\s+(\d+)\s+(?:of us|people|passengers)/i
    ];
    
    for (const pattern of paxPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        this.pax = parseInt(match[1], 10);
        break;
      }
    }
  }

  /**
   * Extract aircraft preferences from message
   * @param {string} text - Lowercase message text
   * @private
   */
  extractAircraft(text) {
    // Check for specific aircraft models
    const aircraftModels = [
      'citation', 'learjet', 'gulfstream', 'g550', 'g650', 'g450', 'g500', 
      'global express', 'challenger', 'phenom', 'legacy', 'falcon', 'hawker'
    ];
    
    for (const model of aircraftModels) {
      if (text.includes(model)) {
        this.aircraftModel = model;
        break;
      }
    }
    
    // Check for aircraft categories
    const categoryPatterns = [
      { pattern: /light\s+jet/i, category: 'light' },
      { pattern: /mid(?:\s*-?\s*size)?\s+jet/i, category: 'midsize' },
      { pattern: /heavy\s+jet/i, category: 'heavy' },
      { pattern: /large\s+(?:cabin|jet)/i, category: 'heavy' }
    ];
    
    for (const { pattern, category } of categoryPatterns) {
      if (pattern.test(text)) {
        this.aircraftCategory = category;
        break;
      }
    }
  }

  /**
   * Check for detailed questions
   * @param {string} text - Lowercase message text
   * @private
   */
  checkForDetailedQuestions(text) {
    const detailedQuestionPatterns = [
      /what\s+(?:kind|type)\s+of\s+(?:aircraft|jet|plane)/i,
      /how\s+(?:much|long|many)/i,
      /(?:tell|explain)\s+(?:me|us)\s+(?:about|more)/i,
      /what\s+(?:is|are)\s+the\s+(?:difference|options|features)/i,
      /can\s+you\s+(?:provide|give|show)/i,
      /(?:details|specifics)\s+(?:on|about)/i
    ];
    
    for (const pattern of detailedQuestionPatterns) {
      if (pattern.test(text)) {
        this.askedDetailedQuestions = true;
        break;
      }
    }
  }

  /**
   * Check for urgency signals
   * @param {string} text - Lowercase message text
   * @private
   */
  checkForUrgencySignals(text) {
    const urgencyPatterns = [
      /(?:urgent|immediately|asap|right away|emergency)/i,
      /(?:today|tomorrow|tonight)/i,
      /need\s+(?:it|this|to)\s+(?:fast|quickly|soon)/i,
      /as\s+soon\s+as\s+possible/i,
      /(?:this|next)\s+(?:week|weekend)/i
    ];
    
    for (const pattern of urgencyPatterns) {
      if (pattern.test(text)) {
        this.urgencySignals = true;
        break;
      }
    }
  }

  /**
   * Check for handoff requests
   * @param {string} text - Lowercase message text
   * @private
   */
  checkForHandoffRequest(text) {
    const handoffPatterns = [
      /(?:speak|talk)\s+(?:to|with)\s+(?:a|an|the)\s+(?:human|agent|person|representative|specialist|team|someone)/i,
      /(?:connect|transfer)\s+(?:me|us)\s+(?:to|with)\s+(?:a|an|the)\s+(?:human|agent|person|representative|specialist|team|someone)/i,
      /(?:is|are)\s+(?:there|someone)\s+(?:a|an)\s+(?:human|agent|person|representative|specialist|team)/i,
      /(?:can|could)\s+(?:i|we|you)\s+(?:get|have|connect)\s+(?:a|an|the)\s+(?:human|agent|person|representative|specialist|team|someone)/i,
      /(?:real|actual)\s+(?:human|agent|person|representative|specialist|team)/i,
      /(?:send|forward)\s+(?:to|with)\s+(?:a|an|the)\s+(?:human|agent|person|representative|specialist|team)/i,
      /(?:agent|human|specialist|team)/i,
      /(?:yes|sure|ok|okay|connect|please)/i
    ];
    
    // Also check for simple keywords
    const handoffKeywords = ['agent', 'human', 'person', 'specialist', 'team', 'send', 'connect', 'talk', 'speak'];
    
    for (const pattern of handoffPatterns) {
      if (pattern.test(text)) {
        this.handoffRequested = true;
        return;
      }
    }
    
    // Check for simple keywords
    const lowerText = text.toLowerCase();
    for (const keyword of handoffKeywords) {
      if (lowerText.includes(keyword)) {
        this.handoffRequested = true;
        return;
      }
    }
  }

  /**
   * Extract country from message
   * @param {string} text - Message text (lowercase)
   * @private
   */
  extractCountry(text) {
    // Common countries
    const countries = [
      'united states', 'usa', 'us', 'america', 
      'uk', 'united kingdom', 'england', 'britain', 
      'france', 'germany', 'italy', 'spain', 
      'switzerland', 'monaco', 'dubai', 'uae', 'united arab emirates',
      'russia', 'china', 'japan', 'australia', 
      'canada', 'brazil', 'mexico', 'india',
      'singapore', 'hong kong', 'saudi arabia'
    ];
    
    // Check for country mentions
    for (const country of countries) {
      if (text.includes(country)) {
        // Map common variations to standard names
        if (country === 'usa' || country === 'us' || country === 'america') {
          this.country = 'United States';
        } else if (country === 'uk' || country === 'britain' || country === 'england') {
          this.country = 'United Kingdom';
        } else if (country === 'uae') {
          this.country = 'United Arab Emirates';
        } else {
          // Capitalize first letter of each word
          this.country = country.split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
        }
        return;
      }
    }
    
    // Check for "based in" or "from" phrases
    const basedInMatch = text.match(/(?:based|located|living|staying|residing|from|in) (?:the |a )?([\w\s]+)(?:right now)?/);
    if (basedInMatch && basedInMatch[1] && basedInMatch[1].length > 2 && !['here', 'there', 'now'].includes(basedInMatch[1].trim())) {
      const potentialCountry = basedInMatch[1].trim();
      // Avoid setting very short or common words as countries
      if (potentialCountry.length > 2 && !['the', 'and', 'but', 'for', 'with'].includes(potentialCountry)) {
        this.country = potentialCountry.charAt(0).toUpperCase() + potentialCountry.slice(1);
      }
    }
  }

  /**
   * Extract name from message
   * @param {string} text - Message text (original case)
   * @private
   */
  extractName(text) {
    // Skip if we already have both first and last name
    if (this.firstName && this.lastName) {
      return;
    }
    
    // Check for direct name responses
    const namePatterns = [
      // My name is pattern
      /my name is (?:([A-Z][a-z]+)(?: ([A-Z][a-z]+))?)/i,
      // I am/I'm pattern
      /I(?:'m| am) (?:([A-Z][a-z]+)(?: ([A-Z][a-z]+))?)/i,
      // Direct name response
      /^(?:([A-Z][a-z]+)(?: ([A-Z][a-z]+))?)$/i,
      // Name: pattern
      /name:? (?:([A-Z][a-z]+)(?: ([A-Z][a-z]+))?)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        this.firstName = match[1];
        if (match[2]) {
          this.lastName = match[2];
        }
        return;
      }
    }
    
    // Check for "call me" pattern
    const callMeMatch = text.match(/(?:call|address) me(?: as)? (?:([A-Z][a-z]+)(?: ([A-Z][a-z]+))?)/i);
    if (callMeMatch && callMeMatch[1]) {
      this.firstName = callMeMatch[1];
      if (callMeMatch[2]) {
        this.lastName = callMeMatch[2];
      }
      return;
    }
  }

  /**
   * Get conversation data for lead scoring
   * @returns {Object} Conversation data for lead scoring
   */
  getDataForScoring() {
    return {
      origin: this.origin,
      destination: this.destination,
      exactDate: this.exactDate,
      dateRange: this.dateRange,
      mentionedTiming: this.mentionedTiming,
      pax: this.pax,
      aircraftModel: this.aircraftModel,
      aircraftCategory: this.aircraftCategory,
      messageCount: this.messages.filter(m => m.role === 'user').length,
      askedDetailedQuestions: this.askedDetailedQuestions,
      urgencySignals: this.urgencySignals,
      handoffRequested: this.handoffRequested
    };
  }

  /**
   * Get conversation summary
   * @returns {string} Conversation summary
   */
  getSummary() {
    const parts = [];
    
    if (this.firstName) {
      if (this.lastName) {
        parts.push(`Name: ${this.firstName} ${this.lastName}`);
      } else {
        parts.push(`Name: ${this.firstName}`);
      }
    }
    
    if (this.origin && this.destination) {
      parts.push(`Route: ${this.origin} → ${this.destination}`);
    } else if (this.origin) {
      parts.push(`From: ${this.origin}`);
    } else if (this.destination) {
      parts.push(`To: ${this.destination}`);
    }
    
    if (this.exactDate) {
      parts.push(`Date: ${this.exactDate}`);
    } else if (this.dateRange) {
      parts.push(`Date Range: ${this.dateRange.start} to ${this.dateRange.end}`);
    } else if (this.mentionedTiming) {
      parts.push('Timing: Mentioned');
    }
    
    if (this.pax) {
      parts.push(`Passengers: ${this.pax}`);
    }
    
    if (this.aircraftModel) {
      parts.push(`Aircraft: ${this.aircraftModel}`);
    } else if (this.aircraftCategory) {
      parts.push(`Aircraft Category: ${this.aircraftCategory}`);
    }
    
    if (this.country) {
      parts.push(`Country: ${this.country}`);
    }
    
    if (this.urgencySignals) {
      parts.push('Urgency: Yes');
    }
    
    return parts.join('\n');
  }
}

// Map to store active conversations
const activeConversations = new Map();

/**
 * Get or create a conversation for a user
 * @param {string} userId - User ID (Telegram ID)
 * @param {string} username - Username
 * @returns {Conversation} Conversation object
 */
function getConversation(userId, username) {
  if (!activeConversations.has(userId)) {
    activeConversations.set(userId, new Conversation(userId, username));
  }
  
  return activeConversations.get(userId);
}

/**
 * Remove a conversation
 * @param {string} userId - User ID (Telegram ID)
 */
function removeConversation(userId) {
  activeConversations.delete(userId);
}

module.exports = {
  getConversation,
  removeConversation
}; 