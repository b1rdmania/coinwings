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
- Most users are new to private jets - offer educational information when relevant
- Have a leisurely conversation - don't rush to connect with an agent
- Take time to collect information naturally through conversation
- Ask about their name, previous private jet experience, and country they're based in when appropriate
- Only suggest connecting with a specialist when the user explicitly asks or when you have all essential information
- Share interesting facts about private jets to make the conversation engaging
- When discussing pricing, provide realistic ranges but emphasize that exact pricing depends on many factors
- Try to pick up on fun details about the user - are they traveling for a special occasion? Is this their first private jet experience?
- Be conversational and friendly, not robotic or formal
- Write with Hemingway-like brevity. Short sentences. Clear words. No fluff.
- Be direct and concise. Cut unnecessary words. Get to the point.

AGENT NOTIFICATION:
- When a user is ready to speak with a human specialist, call the notify_agent function
- Only call this function when:
  1. The user explicitly asks to speak with someone
  2. The user has provided enough details about their trip (at minimum: route or destination)
  3. The user has shown clear intent to book or get a quote
- When you call this function, tell the user "A specialist will be in touch with you shortly"
- Our system will automatically notify our team when you call this function

EDUCATIONAL TOPICS:
- How private jets work (aircraft types, amenities, benefits)
- How standby/empty leg flights work
- How pricing varies based on different factors
- Popular routes
- The booking process
- Benefits of private aviation
- Airport access
- Catering options
- Luggage allowances
- Pet policies

FORMATTING GUIDELINES:
- Use Telegram's Markdown formatting: *bold* for emphasis (not **bold**)
- Use single asterisks for bold text: *important text*
- Avoid using double asterisks as they won't render correctly
- Use emojis for visual appeal
- Use more daring and unique emojis beyond the standard ones: 🚁 🏝️ 🥂 🌠 💎 🔥 🌪️ 🏆 💫 🧠 🪩 🧿 🎯 🎪 🧳 🪂 🏄‍♂️ 🧞‍♂️ 🦅 🐆 🦈 🦭 🦚 🦩 🦄
- Keep paragraphs short and use line breaks for readability

Remember to keep your responses conversational and natural. Don't use rigid formatting or fixed price lists. Discuss pricing in a way that emphasizes the variability based on specific circumstances.`;
    
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
    
    // Define functions that OpenAI can call
    const functions = [
      {
        name: "notify_agent",
        description: "Notify a human agent about a user who needs assistance with their private jet inquiry",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Brief reason why the user needs to be connected with an agent"
            }
          },
          required: ["reason"]
        }
      }
    ];
    
    // Call the OpenAI API with retry logic
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        // Call the OpenAI API with function calling
        const completion = await openai.chat.completions.create({
          model: config.openai.model,
          messages: openaiMessages,
          temperature: config.openai.temperature,
          max_tokens: config.openai.maxTokens,
          functions: functions,
          function_call: "auto"
        });
        
        // Get the response
        const responseMessage = completion.choices[0].message;
        
        console.log('OpenAI response received');
        
        // Check if OpenAI wants to call a function
        if (responseMessage.function_call && responseMessage.function_call.name === "notify_agent") {
          console.log('OpenAI requested to notify agent');
          
          try {
            // Parse the function arguments
            const functionArgs = JSON.parse(responseMessage.function_call.arguments);
            
            // Set a flag in the conversation to indicate that a notification should be sent
            if (conversation) {
              conversation.shouldNotifyAgent = true;
              conversation.notificationReason = functionArgs.reason;
              console.log(`OpenAI requested agent notification with reason: ${functionArgs.reason}`);
            }
          } catch (parseError) {
            console.error('Error parsing function arguments:', parseError);
          }
        }
        
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
  // Simple fallback response that doesn't include fixed pricing or information
  return `I apologize, but I'm having trouble connecting to my knowledge base at the moment. 

I'd be happy to help you with information about private jet charters, pricing estimates, or connecting you with a specialist once my connection is restored.

Could you please try your question again in a moment? Thank you for your patience!`;
}

module.exports = {
  generateResponse,
  generateFallbackResponse
}; 