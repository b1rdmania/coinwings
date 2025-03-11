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
      
      // Add conversation guidance
      systemPrompt += `\n\nCONVERSATION GUIDELINES:
- Most users are new to private jets - offer educational information about private jets when relevant
- Always provide pricing in USD ($) first, then optionally in crypto
- Have a leisurely conversation - don't rush to connect with an agent
- Take time to collect information naturally through conversation
- When asking for a name, be direct: "What's your name?" or "May I ask your name?"
- Only suggest connecting with an agent when the user explicitly asks or when you have all essential information
- Share interesting facts about private jets to make the conversation engaging
- When discussing pricing, provide realistic ranges based on aircraft type and route
- Remember that users enjoy getting a feel for pricing even if they're just exploring
- Don't try to extract information from casual greetings like "hi there" - these are not names`;
      
      // Add pricing information
      systemPrompt += `\n\nPRICING GUIDELINES:
- Light Jets (4-6 passengers): $4,000-5,500 per hour, typically $15,000-25,000 for short routes
- Mid-size Jets (7-9 passengers): $5,500-7,000 per hour, typically $25,000-40,000 for medium routes
- Heavy Jets (10-16 passengers): $8,000-12,000 per hour, typically $40,000-80,000 for long routes

Common route pricing examples:
- New York to Miami: $18,000-22,000 (Light Jet), $25,000-30,000 (Mid-size), $35,000-45,000 (Heavy)
- London to Dubai: $45,000-55,000 (Mid-size), $65,000-80,000 (Heavy)
- San Francisco to Austin: $25,000-30,000 (Light Jet), $32,000-38,000 (Mid-size), $45,000-55,000 (Heavy)

Always emphasize that these are estimates and final pricing depends on specific aircraft availability, exact dates, and other factors.`;

      // Add summary generation guidance
      systemPrompt += `\n\nSUMMARY GENERATION:
When a user requests to connect with an agent, you'll need to generate a structured summary of their inquiry.
If asked to generate a summary, respond with a JSON object in the following format:
{
  "origin": "City name only, no country",
  "destination": "City name only, no country",
  "passengers": "Number of passengers",
  "date": "Travel date or date range",
  "aircraft": "Aircraft preference if mentioned",
  "name": "User's name if provided explicitly",
  "additional_details": "Any other relevant details"
}
Only include fields where information has been clearly provided by the user. Do not include fields with uncertain or inferred information.`;
      
      // Important reminder
      systemPrompt += `\n\nIMPORTANT: Always maintain a friendly, helpful tone. Never pressure the user. Focus on providing accurate information and a great experience.`;
    }
    
    // Add a function to generate a structured summary
    const functions = [
      {
        name: "generate_inquiry_summary",
        description: "Generate a structured summary of the user's inquiry for the agent",
        parameters: {
          type: "object",
          properties: {
            origin: {
              type: "string",
              description: "The departure city (without country)"
            },
            destination: {
              type: "string",
              description: "The arrival city (without country)"
            },
            passengers: {
              type: "string",
              description: "Number of passengers"
            },
            date: {
              type: "string",
              description: "Travel date or date range"
            },
            aircraft: {
              type: "string",
              description: "Aircraft preference if mentioned"
            },
            name: {
              type: "string",
              description: "User's name if explicitly provided"
            },
            additional_details: {
              type: "string",
              description: "Any other relevant details"
            }
          },
          required: []
        }
      }
    ];
    
    // Create the OpenAI request
    const openaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];
    
    // Check if this is a handoff request
    const isHandoffRequest = conversation.handoffRequested || 
                            (conversation.messages.length > 0 && 
                             conversation.checkForHandoffRequest(conversation.messages[conversation.messages.length - 1].text));
    
    // If this is a handoff request, ask the model to generate a summary
    if (isHandoffRequest) {
      // Add a message asking for a summary
      openaiMessages.push({
        role: 'system',
        content: "The user has requested to connect with an agent. Please generate a structured summary of their inquiry using the generate_inquiry_summary function."
      });
    }
    
    // Call the OpenAI API
    const completion = await openai.chat.completions.create({
      model: config.openai.model,
      messages: openaiMessages,
      temperature: config.openai.temperature,
      max_tokens: config.openai.maxTokens,
      functions: functions,
      function_call: isHandoffRequest ? { name: "generate_inquiry_summary" } : "auto"
    });
    
    // Get the response
    const responseMessage = completion.choices[0].message;
    
    // Check if there's a function call
    if (responseMessage.function_call && responseMessage.function_call.name === "generate_inquiry_summary") {
      // Parse the function call arguments
      const summaryData = JSON.parse(responseMessage.function_call.arguments);
      
      // Update the conversation with the extracted data
      if (summaryData.origin) conversation.origin = summaryData.origin;
      if (summaryData.destination) conversation.destination = summaryData.destination;
      if (summaryData.passengers) conversation.pax = summaryData.passengers;
      if (summaryData.date) {
        if (summaryData.date.includes("to")) {
          const [start, end] = summaryData.date.split("to").map(d => d.trim());
          conversation.dateRange = { start, end };
        } else {
          conversation.exactDate = summaryData.date;
        }
      }
      if (summaryData.aircraft) {
        if (["light", "midsize", "heavy"].includes(summaryData.aircraft.toLowerCase())) {
          conversation.aircraftCategory = summaryData.aircraft;
        } else {
          conversation.aircraftModel = summaryData.aircraft;
        }
      }
      if (summaryData.name) {
        const nameParts = summaryData.name.split(" ");
        conversation.firstName = nameParts[0];
        if (nameParts.length > 1) {
          conversation.lastName = nameParts.slice(1).join(" ");
        }
      }
      if (summaryData.additional_details) {
        conversation.additionalDetails = summaryData.additional_details;
      }
      
      // Return the regular response
      return completion.choices[0].message.content;
    }
    
    console.log('OpenAI response received');
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error with OpenAI:', error);
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