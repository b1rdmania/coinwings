const { OpenAI } = require('openai');
const config = require('../config/config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openai.apiKey
});

/**
 * Generate a response using OpenAI
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} conversation - Conversation object with state information
 * @returns {Promise<string>} - The generated response text
 */
async function generateResponse(messages, conversation) {
  try {
    console.log('Attempting OpenAI response');
    
    // Create a custom system prompt that includes conversation state
    let systemPrompt = config.openai.systemPrompt;
    
    // Add conversation state if available
    if (conversation) {
      const providedInfo = conversation.getProvidedInformation();
      const nextQuestion = conversation.getNextQuestion();
      
      // Add information about what we already know
      systemPrompt += `\n\nCurrent conversation state:`;
      
      if (conversation.origin) {
        systemPrompt += `\n- Origin: ${conversation.origin}`;
      }
      
      if (conversation.destination) {
        systemPrompt += `\n- Destination: ${conversation.destination}`;
      }
      
      if (conversation.pax) {
        systemPrompt += `\n- Passengers: ${conversation.pax}`;
      }
      
      if (conversation.exactDate) {
        systemPrompt += `\n- Travel date: ${conversation.exactDate}`;
      } else if (conversation.dateRange) {
        systemPrompt += `\n- Travel dates: ${conversation.dateRange.start} to ${conversation.dateRange.end}`;
      } else if (conversation.mentionedTiming) {
        systemPrompt += `\n- Approximate timing: ${conversation.mentionedTiming}`;
      }
      
      if (conversation.aircraftModel) {
        systemPrompt += `\n- Preferred aircraft: ${conversation.aircraftModel}`;
      } else if (conversation.aircraftCategory) {
        systemPrompt += `\n- Preferred aircraft category: ${conversation.aircraftCategory}`;
      }
      
      // Add guidance on what to ask next
      if (nextQuestion) {
        systemPrompt += `\n\nNext question to ask: "${nextQuestion}"`;
      } else {
        systemPrompt += `\n\nAll essential information has been collected. Focus on providing helpful information about the journey.`;
      }
      
      // Add important instruction to avoid asking for information we already have
      systemPrompt += `\n\nIMPORTANT: DO NOT ask for information that has already been provided. Review the conversation state carefully.`;
    }
    
    // Prepend system message
    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    
    const response = await openai.chat.completions.create({
      model: config.openai.model,
      messages: fullMessages,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens
    });
    
    console.log('OpenAI response received');
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating OpenAI response:', error);
    throw error;
  }
}

/**
 * Generate a fallback response based on user query
 * @param {string} query - The user's message
 * @returns {string} - A fallback response
 */
function generateFallbackResponse(query) {
  // Check for common queries to provide basic responses when OpenAI fails
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('price') || lowerQuery.includes('cost') || lowerQuery.includes('how much')) {
    return "Private jet pricing depends on several factors including distance, aircraft type, and travel dates. For example, a light jet for a short trip might start around $15,000, while international flights on heavy jets can exceed $50,000. To provide an accurate quote, I'll need your specific route, dates, and passenger count.";
  }
  
  if (lowerQuery.includes('process') || lowerQuery.includes('how does it work') || lowerQuery.includes('booking')) {
    return "Our booking process is simple: 1) Share your trip details (route, dates, passengers), 2) We'll provide aircraft options and pricing, 3) Our aviation team will handle all arrangements, 4) Pay with crypto or traditional methods, 5) Enjoy your private flight! Would you like to start by telling me about your trip?";
  }
  
  // Default fallback
  return config.templates.fallback;
}

module.exports = {
  generateResponse,
  generateFallbackResponse
}; 