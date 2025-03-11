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

INFORMATION TRACKING:
- CAREFULLY track all information the user has already provided
- NEVER ask for information they've already given you
- If they mention a route (e.g., "London to New York"), remember both the origin and destination
- If they mention a date (e.g., "May 1st"), remember it as their travel date
- If they mention aircraft preferences, remember those exact preferences
- When a user says they've already told you something, apologize sincerely and refer to your notes
- Before asking for more details, review the conversation history to avoid repetition
- If you're unsure if information was provided, phrase your question as "I may have missed this, but..."
- When connecting users with specialists, summarize ALL the information they've provided so far

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
      
      // Add route information with more context
      if (conversation.origin && conversation.destination) {
        systemPrompt += `\n- Route: ${conversation.origin} to ${conversation.destination}`;
        systemPrompt += `\n- IMPORTANT: User has already provided their route. Do not ask for this information again.`;
      } else if (conversation.origin) {
        systemPrompt += `\n- Origin: ${conversation.origin}`;
        systemPrompt += `\n- IMPORTANT: User has already provided their origin. Only ask for their destination if needed.`;
      } else if (conversation.destination) {
        systemPrompt += `\n- Destination: ${conversation.destination}`;
        systemPrompt += `\n- IMPORTANT: User has already provided their destination. Only ask for their origin if needed.`;
      }
      
      // Add passenger information with more context
      if (conversation.pax) {
        systemPrompt += `\n- Passengers: ${conversation.pax}`;
        systemPrompt += `\n- IMPORTANT: User has already provided passenger count. Do not ask for this information again.`;
      }
      
      // Add date information with more context
      if (conversation.exactDate) {
        systemPrompt += `\n- Travel date: ${conversation.exactDate}`;
        systemPrompt += `\n- IMPORTANT: User has already provided their travel date. Do not ask for this information again.`;
      } else if (conversation.dateRange) {
        systemPrompt += `\n- Travel dates: ${conversation.dateRange.start} to ${conversation.dateRange.end}`;
        systemPrompt += `\n- IMPORTANT: User has already provided their travel date range. Do not ask for this information again.`;
      }
      
      // Add aircraft information with more context
      if (conversation.aircraftModel) {
        systemPrompt += `\n- Preferred aircraft: ${conversation.aircraftModel}`;
        systemPrompt += `\n- IMPORTANT: User has already specified their preferred aircraft. Do not ask for this information again.`;
      } else if (conversation.aircraftCategory) {
        systemPrompt += `\n- Preferred aircraft category: ${conversation.aircraftCategory}`;
        systemPrompt += `\n- IMPORTANT: User has already specified their preferred aircraft category. Do not ask for this information again.`;
      }
      
      // Add country information with more context
      if (conversation.country) {
        systemPrompt += `\n- Country: ${conversation.country}`;
        systemPrompt += `\n- IMPORTANT: User has already provided their country. Do not ask for this information again.`;
      }
      
      // Add previous experience information with more context
      if (conversation.flownPrivateBefore) {
        systemPrompt += `\n- Flown private before: ${conversation.flownPrivateBefore}`;
        systemPrompt += `\n- IMPORTANT: User has already indicated whether they've flown private before. Do not ask for this information again.`;
      }
      
      // Add handoff status
      if (conversation.notificationSent) {
        systemPrompt += `\n- IMPORTANT: The user has already requested to connect with a specialist, and a notification has been sent to our team.`;
        systemPrompt += `\n- If the user asks about the status of their connection request, inform them that a specialist will be in touch shortly.`;
        systemPrompt += `\n- DO NOT offer to connect them again, as this has already been done.`;
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
    
    // Simple retry logic
    let response;
    let attempts = 0;
    const maxAttempts = 2;
    
    while (!response && attempts <= maxAttempts) {
      try {
        attempts++;
        console.log(`OpenAI attempt ${attempts}/${maxAttempts + 1}`);
        
        // Call the OpenAI API
        const completion = await openai.chat.completions.create({
          model: config.openai.model,
          messages: openaiMessages,
          temperature: config.openai.temperature,
          max_tokens: config.openai.maxTokens,
          functions: functions,
          function_call: "auto"
        });
        
        const responseMessage = completion.choices[0].message;
        
        // Check for function call
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
        
        // Get the response text
        response = responseMessage.content;
        
        // If we got an empty response, throw an error to trigger retry
        if (!response) {
          throw new Error('Empty response from OpenAI');
        }
        
      } catch (error) {
        console.error(`OpenAI API error (attempt ${attempts}/${maxAttempts + 1}):`, error.message);
        
        // If we've exhausted retries, use a fallback
        if (attempts > maxAttempts) {
          console.log('Exhausted retries, using fallback response');
          return "I apologize, but I'm having trouble processing your request right now. Could you please try again or rephrase your question?";
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('Unexpected error with OpenAI:', error);
    return "I apologize, but I'm having trouble processing your request right now. Could you please try again or rephrase your question?";
  }
}

module.exports = {
  generateResponse
}; 