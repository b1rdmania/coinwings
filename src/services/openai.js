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
      } else if (conversation.origin && conversation.destination && conversation.pax) {
        // If we have the essential information, suggest connecting with an agent
        systemPrompt += `\n\nEssential information has been collected. Consider suggesting connecting with a specialist for an exact quote, but only if the conversation naturally leads to it. Don't be pushy.`;
      } else {
        systemPrompt += `\n\nFocus on providing helpful information about private jet chartering while naturally gathering missing details.`;
      }
      
      // Add formatting instructions
      systemPrompt += `\n\nFORMATTING GUIDELINES:
- Use emoji to highlight key points (✈️ for routes, 📅 for dates, 👥 for passengers, 💰 for pricing)
- Format lists with emoji bullet points
- Bold important information using **bold text**
- Break up text into readable chunks with line breaks
- When providing pricing ranges, format them clearly: **$X,XXX - $Y,YYY**
- Keep responses concise and easy to read on a mobile device`;
      
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
    return `💡 Private jet pricing varies based on:
- ✈️ Aircraft type and size
- 📏 Flight distance
- 📅 Seasonality and availability
- 🏢 Airport fees and handling

For example:
- 🛩 **Light Jet**: $4,000-5,500 per hour
- ✈️ **Mid-size Jet**: $5,500-7,000 per hour
- 🚀 **Heavy Jet**: $8,000-12,000 per hour

If you'd like a more specific estimate, just let me know your route and passenger count. No pressure! 🙂`;
  }
  
  if (lowerQuery.includes('process') || lowerQuery.includes('how does it work') || lowerQuery.includes('booking')) {
    return `📋 **Booking with CoinWings is simple:**

1️⃣ Share your trip details (route, dates, passengers)
2️⃣ We provide aircraft options and pricing ranges
3️⃣ Our aviation team handles all arrangements
4️⃣ Pay with crypto (BTC, ETH, USDC) or traditional methods
5️⃣ Enjoy your private flight!

Would you like to start by telling me about your trip? Or just exploring options for now? Either way is perfectly fine. 👍`;
  }
  
  if (lowerQuery.includes('aircraft') || lowerQuery.includes('jet') || lowerQuery.includes('plane')) {
    return `✈️ **Private Aircraft Categories:**

- 🛩 **Light Jets** (4-6 passengers)
  Perfect for shorter trips (2-3 hours)
  Examples: Citation CJ3, Phenom 300

- ✈️ **Mid-size Jets** (7-9 passengers)
  Great for domestic flights (4-5 hours)
  Examples: Citation XLS, Learjet 60

- �� **Heavy Jets** (10-16 passengers)
  Ideal for international travel (6+ hours)
  Examples: Gulfstream G550, Falcon 7X

What type of trip are you considering? I can help recommend the right aircraft. 🙂`;
  }
  
  if (lowerQuery.includes('crypto') || lowerQuery.includes('payment') || lowerQuery.includes('bitcoin') || lowerQuery.includes('eth')) {
    return `💰 **Crypto Payments at CoinWings:**

We accept:
- ₿ Bitcoin (BTC)
- Ξ Ethereum (ETH)
- 💵 USDC

The payment process is simple and secure. Once you confirm your booking, we provide wallet addresses for payment. After transaction confirmation, your flight is secured.

We also accept traditional payment methods if you prefer. Would you like more information about our payment process?`;
  }
  
  // Default fallback
  return config.templates.fallback;
}

module.exports = {
  generateResponse,
  generateFallbackResponse
}; 