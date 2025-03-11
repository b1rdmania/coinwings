/**
 * Calculate lead score based on conversation data
 * @param {Object} conversation - Conversation data
 * @returns {number} Lead score (0-100)
 */
function calculateLeadScore(conversation) {
  let score = 0;
  
  // Route specificity (max 25 points)
  if (conversation.origin && conversation.destination) {
    score += 25;
  } else if (conversation.origin || conversation.destination) {
    score += 10;
  }
  
  // Date specificity (max 25 points)
  if (conversation.exactDate) {
    score += 25;
  } else if (conversation.dateRange) {
    score += 15;
  } else if (conversation.mentionedTiming) {
    score += 5;
  }
  
  // Passenger count (max 15 points)
  if (conversation.pax) {
    score += 15;
  }
  
  // Aircraft preference (max 10 points)
  if (conversation.aircraftModel) {
    score += 10;
  } else if (conversation.aircraftCategory) {
    score += 5;
  }
  
  // Engagement signals (max 15 points)
  if (conversation.messageCount >= 5) {
    score += 10;
  } else if (conversation.messageCount >= 3) {
    score += 5;
  }
  
  if (conversation.askedDetailedQuestions) {
    score += 5;
  }
  
  // Urgency signals (max 10 points)
  if (conversation.urgencySignals) {
    score += 10;
  }
  
  return score;
}

/**
 * Determine if lead should be escalated to agent
 * @param {number} score - Lead score
 * @returns {boolean} Whether lead should be escalated
 */
function shouldEscalateToAgent(score) {
  return score >= 40; // Significantly lowered threshold for agent escalation
}

/**
 * Get lead priority level based on score
 * @param {number} score - Lead score
 * @returns {string} Priority level (low, medium, high)
 */
function getLeadPriority(score) {
  if (score >= 70) {
    return 'high';
  } else if (score >= 40) {
    return 'medium';
  } else {
    return 'low';
  }
}

module.exports = {
  calculateLeadScore,
  shouldEscalateToAgent,
  getLeadPriority
}; 