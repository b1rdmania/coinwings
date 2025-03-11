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
- Don't try to extract information from casual greetings like "hi there" - these are not names
- Try to pick up on fun details about the user - are they traveling for a special occasion? Is this their first private jet experience?
- Be conversational and friendly, not robotic or formal
- Handle time-wasters with humor (e.g., pets flying alone, flying to the moon, teleportation)
- If someone asks about pets flying alone, respond with humor but mention we do accommodate pets with owners
- If someone asks about flying to the moon/mars/space, respond with humor but redirect to Earth destinations
- If someone asks about "cheapest possible" flights, gently explain private jets aren't about being cheap
- For teleportation/time travel jokes, respond with humor but redirect to real travel options`;

      // Add educational information
      systemPrompt += `\n\nEDUCATIONAL INFORMATION:
- Offer to explain how private jets work: aircraft types, amenities, benefits, etc.
- Explain how standby/empty leg flights work: discounted flights on repositioning aircraft
- Discuss how pricing varies based on: aircraft size, distance, season, demand, etc.
- Share popular routes: New York-Miami, London-Paris, Dubai-Maldives, Los Angeles-Las Vegas
- Explain the booking process: quote, contract, payment, flight preparation
- Discuss the benefits of private aviation: time savings, flexibility, privacy, comfort
- Mention airport access: ability to use smaller, more convenient airports
- Explain catering options: customized meals and beverages
- Discuss luggage allowances: typically more generous than commercial flights
- Share information about pet policies: most private jets welcome pets`;

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

      // Add handoff guidance
      systemPrompt += `\n\nHANDOFF GUIDANCE:
- If the user explicitly asks to speak with a human/agent/specialist, acknowledge this and let them know you'll connect them
- If you have collected essential information (origin, destination, passengers, date) and the user seems serious, you can suggest connecting with a specialist
- When suggesting a handoff, use phrases like "Would you like me to connect you with a specialist who can provide an exact quote?"
- Never pressure the user into a handoff - it should feel natural and helpful
- If the user agrees to connect with a specialist, thank them and let them know someone will be in touch soon`;

      // Add summary guidance
      systemPrompt += `\n\nSUMMARY GUIDANCE:
- If the user asks for a summary of their request or inquiry, provide a concise summary of what they've told you so far
- Include details like origin, destination, date, number of passengers, and any preferences they've mentioned
- Make the summary conversational and natural, not just a list of facts
- After providing the summary, ask if they'd like to add or change anything
- Never respond with "I'm processing your request" - always provide a helpful, natural response`;

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
  "country": "User's country if mentioned",
  "flown_private_before": "Yes/No/Unknown if mentioned",
  "additional_details": "Any other relevant details",
  "fun_summary": "A short, fun summary with emojis about anything quirky or interesting (e.g., if they've flown private before, if it's for a special occasion, their personality, etc.)"
}
Only include fields where information has been clearly provided by the user. Do not include fields with uncertain or inferred information.
For the fun_summary field, be creative and personable - this helps our agents connect with the client better.`;
      
      // Add agent channel formatting guidance
      systemPrompt += `\n\nAGENT CHANNEL FORMATTING:
When formatting conversation summaries for the agent channel:
- Use 👤 emoji to represent the user
- Use 🤖 emoji to represent the bot
- Keep the conversation summary concise, not the entire conversation
- Focus on key information exchanged, not every message
- Highlight important details the user has shared
- Format the summary in a clean, easy-to-read way`;
      
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
            country: {
              type: "string",
              description: "User's country if mentioned"
            },
            flown_private_before: {
              type: "string",
              description: "Yes/No/Unknown if mentioned"
            },
            additional_details: {
              type: "string",
              description: "Any other relevant details"
            },
            fun_summary: {
              type: "string",
              description: "A short, fun summary with emojis about anything quirky or interesting about this lead (e.g., if they've flown private before, if it's for a special occasion, their personality, etc.)"
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
          max_tokens: config.openai.maxTokens,
          functions: functions,
          function_call: isHandoffRequest ? { name: "generate_inquiry_summary" } : "auto"
        });
        
        // Get the response
        const responseMessage = completion.choices[0].message;
        
        // Check if there's a function call
        if (responseMessage.function_call && responseMessage.function_call.name === "generate_inquiry_summary") {
          try {
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
            if (summaryData.country) {
              conversation.country = summaryData.country;
            }
            if (summaryData.flown_private_before) {
              conversation.flownPrivateBefore = summaryData.flown_private_before;
            }
            if (summaryData.additional_details) {
              conversation.additionalDetails = summaryData.additional_details;
            }
            if (summaryData.fun_summary) {
              conversation.funSummary = summaryData.fun_summary;
            }
          } catch (parseError) {
            console.error('Error parsing function call arguments:', parseError);
            // Continue with the response even if parsing fails
          }
          
          // Generate a natural response instead of "I'm processing your request"
          let naturalResponse = '';
          
          // Check if the user's last message was a simple confirmation like "yes", "ok", "all good", etc.
          const lastUserMessage = messages[messages.length - 1].content.toLowerCase().trim();
          const isSimpleConfirmation = /^(yes|yeah|yep|ok|okay|sure|all good|sounds good|great|perfect|fine|alright|go ahead|connect me|connect|proceed)$/i.test(lastUserMessage);
          
          if (isSimpleConfirmation) {
            // If the user is just confirming, give a simple acknowledgment
            naturalResponse = `Perfect! I've notified our team, and a specialist will be in touch with you shortly about your trip from ${conversation.origin || 'your origin'} to ${conversation.destination || 'your destination'}.`;
          } else {
            // Otherwise, give the standard response asking for more details
            naturalResponse = `Great! I'll connect you with a specialist who can provide an exact quote for your trip from ${conversation.origin || 'your origin'} to ${conversation.destination || 'your destination'}.

They'll be in touch shortly to discuss the details and answer any questions you might have. Is there anything specific you'd like them to know about your preferences or requirements?`;
          }
          
          console.log('OpenAI response received (function call)');
          return naturalResponse;
        }
        
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