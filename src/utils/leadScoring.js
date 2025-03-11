/**
 * Calculate lead score based on conversation data
 * @param {Object} conversation - Conversation data
 * @returns {number} Lead score (0-100)
 */
function calculateLeadScore(conversation) {
  let score = 0;
  
  // Essential information for a broker to provide a quote
  
  // Route specificity (max 30 points) - ESSENTIAL
  if (conversation.origin && conversation.destination) {
    score += 30; // Increased weight for complete route information
  } else if (conversation.origin || conversation.destination) {
    score += 10;
  }
  
  // Passenger count (max 20 points) - ESSENTIAL
  if (conversation.pax) {
    score += 20; // Increased weight for passenger count
  }
  
  // Date specificity (max 25 points) - ESSENTIAL
  if (conversation.exactDate) {
    score += 25;
  } else if (conversation.dateRange) {
    score += 15;
  } else if (conversation.mentionedTiming) {
    score += 5;
  }
  
  // Aircraft preference (max 10 points) - HELPFUL BUT NOT ESSENTIAL
  if (conversation.aircraftModel) {
    score += 10;
  } else if (conversation.aircraftCategory) {
    score += 5;
  }
  
  // Contact information (max 5 points)
  if (conversation.firstName && conversation.firstName !== 'Anonymous') {
    score += 5;
  }
  
  // Special requirements or preferences (max 5 points)
  if (conversation.askedDetailedQuestions) {
    score += 5;
  }
  
  // Urgency signals (max 5 points)
  if (conversation.urgencySignals) {
    score += 5;
  }
  
  console.log('Lead score calculation:', {
    route: conversation.origin && conversation.destination ? 30 : (conversation.origin || conversation.destination ? 10 : 0),
    passengers: conversation.pax ? 20 : 0,
    date: conversation.exactDate ? 25 : (conversation.dateRange ? 15 : (conversation.mentionedTiming ? 5 : 0)),
    aircraft: conversation.aircraftModel ? 10 : (conversation.aircraftCategory ? 5 : 0),
    contact: conversation.firstName && conversation.firstName !== 'Anonymous' ? 5 : 0,
    details: conversation.askedDetailedQuestions ? 5 : 0,
    urgency: conversation.urgencySignals ? 5 : 0,
    total: score
  });
  
  return score;
}

/**
 * Determine if lead should be escalated to agent
 * @param {number} score - Lead score
 * @returns {boolean} Whether lead should be escalated
 */
function shouldEscalateToAgent(score) {
  return score >= 70; // Set threshold to 70 as requested
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