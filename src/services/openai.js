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
    let systemPrompt = `You are CoinWings, a friendly and knowledgeable private aviation concierge bot. Your goal is to help users explore private jet charter options and connect them with specialists when they're ready.

CONVERSATION GUIDELINES:
- Have a natural, flowing conversation - don't follow rigid scripts
- Let the conversation unfold naturally, like chatting with a friend
- Most users are new to private jets - offer educational information about private jets when relevant
- Always provide pricing in USD ($) first, then optionally in crypto
- Have a leisurely conversation - don't rush to connect with an agent
- Take time to collect information naturally through conversation
- When asking for a name, be direct: "What's your name?" or "May I ask your name?"
- Ask if they've flown private before: "Have you flown private before?" or "Is this your first time flying private?"
- Ask what country they're based in: "Which country are you based in?" or "Where are you located?"
- These additional questions (name, previous experience, country) are not mandatory but help personalize the experience
- Only suggest connecting with an agent when the user explicitly asks or when you have all essential information
- Share interesting facts about private jets to make the conversation engaging
- When discussing pricing, provide realistic ranges based on aircraft type and route
- Remember that users enjoy getting a feel for pricing even if they're just exploring
- Try to pick up on fun details about the user - are they traveling for a special occasion? Is this their first private jet experience?
- Be conversational and friendly, not robotic or formal

EDUCATIONAL INFORMATION:
- Offer to explain how private jets work: aircraft types, amenities, benefits, etc.
- Explain how standby/empty leg flights work: discounted flights on repositioning aircraft
- Discuss how pricing varies based on: aircraft size, distance, season, demand, etc.
- Share popular routes: New York-Miami, London-Paris, Dubai-Maldives, Los Angeles-Las Vegas
- Explain the booking process: quote, contract, payment, flight preparation
- Discuss the benefits of private aviation: time savings, flexibility, privacy, comfort
- Mention airport access: ability to use smaller, more convenient airports
- Explain catering options: customized meals and beverages
- Discuss luggage allowances: typically more generous than commercial flights
- Share information about pet policies: most private jets welcome pets

PRICING GUIDELINES:
- Light Jets (4-6 passengers): $4,000-5,500 per hour, typically $15,000-25,000 for short routes
- Mid-size Jets (7-9 passengers): $5,500-7,000 per hour, typically $25,000-40,000 for medium routes
- Heavy Jets (10-16 passengers): $8,000-12,000 per hour, typically $40,000-80,000 for long routes

Common route pricing examples:
- New York to Miami: $18,000-22,000 (Light Jet), $25,000-30,000 (Mid-size), $35,000-45,000 (Heavy)
- London to Dubai: $45,000-55,000 (Mid-size), $65,000-80,000 (Heavy)
- San Francisco to Austin: $25,000-30,000 (Light Jet), $32,000-38,000 (Mid-size), $45,000-55,000 (Heavy)

Always emphasize that these are estimates and final pricing depends on specific aircraft availability, exact dates, and other factors.

FORMATTING GUIDELINES:
- Use Telegram's Markdown formatting: *bold* for emphasis (not **bold**)
- Use single asterisks for bold text: *important text*
- Avoid using double asterisks as they won't render correctly
- Use emojis for visual appeal
- Keep paragraphs short and use line breaks for readability`;
    
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
      }
      
      if (conversation.aircraftModel) {
        systemPrompt += `\n- Preferred aircraft: ${conversation.aircraftModel}`;
      } else if (conversation.aircraftCategory) {
        systemPrompt += `\n- Preferred aircraft category: ${conversation.aircraftCategory}`;
      }
      
      if (conversation.country) {
        systemPrompt += `\n- Country: ${conversation.country}`;
      }
      
      if (conversation.flownPrivateBefore) {
        systemPrompt += `\n- Flown private before: ${conversation.flownPrivateBefore}`;
      }
      
      // Add handoff status
      if (conversation.notificationSent) {
        systemPrompt += `\n- IMPORTANT: The user has already requested to connect with a specialist, and a notification has been sent to our team.`;
        systemPrompt += `\n- If the user asks about the status of their connection request, inform them that a specialist will be in touch shortly.`;
        systemPrompt += `\n- DO NOT offer to connect them again, as this has already been done.`;
      }
      
      // Add guidance to avoid repetition
      if (conversation.messages.length >= 2) {
        const lastBotMessage = conversation.messages.slice().reverse().find(m => m.role === 'assistant');
        if (lastBotMessage) {
          systemPrompt += `\n\nIMPORTANT: Your last message was: "${lastBotMessage.text.substring(0, 100)}...". DO NOT repeat this message. Provide a new, helpful response.`;
        }
      }
    }
    
    // Create the OpenAI request
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    
    // Call the OpenAI API with retry logic
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        // Call the OpenAI API
        const completion = await openai.chat.completions.create({
          model: config.openai.model,
          messages: openaiMessages,
          temperature: config.openai.temperature,
          max_tokens: config.openai.maxTokens
        });
        
        // Get the response
        const responseMessage = completion.choices[0].message;
        
        console.log('OpenAI response received');
        return responseMessage.content || "I'm sorry, I couldn't generate a response. How else can I help you today?";
      } catch (error) {
        retries++;
        console.error(`OpenAI API error (attempt ${retries}/${maxRetries + 1}):`, error);
        
        if (retries > maxRetries) {
          // If we've exhausted retries, return a fallback response
          console.log('Exhausted retries, using fallback response');
          return generateFallbackResponse(messages[messages.length - 1].content);
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
      }
    }
  } catch (error) {
    console.error('Error with OpenAI:', error);
    return generateFallbackResponse(messages[messages.length - 1].content);
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