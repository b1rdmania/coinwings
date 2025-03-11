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
      systemPrompt += `\n\nCurrent conversation state:`;
      
      // Add user's name if available
      if (conversation.firstName) {
        systemPrompt += `\n- User's name: ${conversation.firstName}${conversation.lastName ? ' ' + conversation.lastName : ''}`;
        systemPrompt += `\n- IMPORTANT: Address the user by their name to create a personalized experience.`;
      }
      
      // Add known information
      if (conversation.origin) systemPrompt += `\n- Origin: ${conversation.origin}`;
      if (conversation.destination) systemPrompt += `\n- Destination: ${conversation.destination}`;
      if (conversation.pax) systemPrompt += `\n- Passengers: ${conversation.pax}`;
      
      if (conversation.exactDate) {
        systemPrompt += `\n- Travel date: ${conversation.exactDate}`;
      } else if (conversation.dateRange) {
        systemPrompt += `\n- Travel dates: ${conversation.dateRange.start} to ${conversation.dateRange.end}`;
      } else if (conversation.mentionedTiming) {
        systemPrompt += `\n- Approximate timing mentioned`;
      }
      
      if (conversation.aircraftModel) {
        systemPrompt += `\n- Preferred aircraft: ${conversation.aircraftModel}`;
      } else if (conversation.aircraftCategory) {
        systemPrompt += `\n- Preferred aircraft category: ${conversation.aircraftCategory}`;
      }
      
      // Add guidance on what to ask next
      const nextQuestion = conversation.getNextQuestion();
      if (nextQuestion) {
        systemPrompt += `\n\nNext question to ask: "${nextQuestion}"`;
      } else if (conversation.origin && conversation.destination && conversation.pax) {
        systemPrompt += `\n\nEssential information has been collected. Consider suggesting connecting with a specialist for an exact quote.`;
      }
      
      // Add guidance to avoid repetition
      if (conversation.messages.length >= 2) {
        const lastBotMessage = conversation.messages.slice().reverse().find(m => m.role === 'assistant');
        if (lastBotMessage) {
          systemPrompt += `\n\nIMPORTANT: Your last message was: "${lastBotMessage.text.substring(0, 100)}...". DO NOT repeat this message. Provide a new, helpful response.`;
        }
      }
      
      // Add formatting guidance
      systemPrompt += `\n\nFORMATTING GUIDELINES:
- Use Telegram's Markdown formatting: *bold* for emphasis (not **bold**)
- Use single asterisks for bold text: *important text*
- Avoid using double asterisks as they won't render correctly
- Use emojis for visual appeal
- Keep paragraphs short and use line breaks for readability`;
      
      // Important reminder
      systemPrompt += `\n\nIMPORTANT: DO NOT ask for information that has already been provided.`;
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
    return `💡 Private jet pricing varies based on:
- ✈️ Aircraft type and size
- 📏 Flight distance
- 📅 Seasonality and availability
- 🏢 Airport fees and handling

For example:
- Light Jet: $4,000-5,500 per hour
- Mid-size Jet: $5,500-7,000 per hour
- Heavy Jet: $8,000-12,000 per hour

If you'd like a more specific estimate, just let me know your route and passenger count.`;
  }
  
  if (lowerQuery.includes('process') || lowerQuery.includes('how does it work') || lowerQuery.includes('booking')) {
    return `📋 Booking with CoinWings is simple:

1. Share your trip details (route, dates, passengers)
2. We provide aircraft options and pricing ranges
3. Our aviation team handles all arrangements
4. Pay with crypto (BTC, ETH, USDC) or traditional methods
5. Enjoy your private flight!

Would you like to start by telling me about your trip?`;
  }
  
  if (lowerQuery.includes('aircraft') || lowerQuery.includes('jet') || lowerQuery.includes('plane')) {
    return `✈️ Private Aircraft Categories:

- Light Jets (4-6 passengers)
  Perfect for shorter trips (2-3 hours)
  Examples: Citation CJ3, Phenom 300

- Mid-size Jets (7-9 passengers)
  Great for domestic flights (4-5 hours)
  Examples: Citation XLS, Learjet 60

- Heavy Jets (10-16 passengers)
  Ideal for international travel (6+ hours)
  Examples: Gulfstream G550, Falcon 7X

What type of trip are you considering?`;
  }
  
  if (lowerQuery.includes('crypto') || lowerQuery.includes('payment')) {
    return `💰 Crypto Payments at CoinWings:

We accept:
- Bitcoin (BTC)
- Ethereum (ETH)
- USDC

The payment process is simple and secure. Once you confirm your booking, we provide wallet addresses for payment. We also accept traditional payment methods if you prefer.`;
  }
  
  // Default fallback
  return config.templates.fallback;
}

module.exports = {
  generateResponse,
  generateFallbackResponse
}; 