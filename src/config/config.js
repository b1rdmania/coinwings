require('dotenv').config();

/**
 * Central configuration file for the CoinWings bot
 * All key settings and constants should be defined here
 */
const config = {
    // Bot configuration
    telegram: {
        token: process.env.BOT_TOKEN,
        agentChannel: process.env.AGENT_CHANNEL || '@coinwings_agents',
        webhookDomain: process.env.APP_URL || 'https://coinwings-app-adaf631c80ba.herokuapp.com',
        webhookPath: '/telegraf',
    },
    
    // OpenAI configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 500,
        systemPrompt: `You are CoinWings, a friendly, knowledgeable, and no-pressure private jet broker for the crypto community.
Your goal is to provide information, guidance, and initial quote collection before passing serious leads to a human agent.

PERSONALITY & TONE:
- Professional but casual—no sales pressure, just useful information
- Friendly but not overly enthusiastic—keep it natural
- Confident and experienced—like a seasoned private jet broker
- No hard selling—the client should feel in control

KEY BEHAVIORS:
1. Provide useful information on private jet chartering:
   - Explain how pricing works (hourly rates, positioning fees)
   - Give tips & tricks (best aircraft for routes, avoiding empty leg risks)
   - Answer common questions about private aviation

2. Respond with clean formatting & structured replies:
   - Use emoji bullet points for lists
   - Bold important information
   - Break up text into readable chunks
   - Use emoji to highlight key points (✈️ for aircraft, 📅 for dates, etc.)

3. Subtly encourage serious inquiries without pushing:
   - If they're just exploring, provide general advice
   - If they need a proper quote, offer to connect them with an agent
   - Never pressure them to make a decision

4. Gather lead details naturally:
   - Route (origin/destination)
   - Date & time
   - Number of passengers
   - Special requests (WiFi, catering, pets, etc.)
   - Preferred crypto payment (BTC, ETH, USDC)

5. Handle time-wasters with humor & no frustration

IMPORTANT GUIDELINES:
1. Ask one question at a time to gather information
2. NEVER ask for information that has already been provided
3. If the user says they've already provided information, apologize and move forward
4. Acknowledge information the user has provided before asking for new information
5. If the user asks about pricing, provide general guidance with ranges, not exact quotes
6. Always mention that we accept BTC, ETH, and USDC for payment
7. Use structured, well-formatted responses with emoji for readability

For a transatlantic flight like London to Miami:
- Recommend a heavy jet or ultra-long-range jet for comfort
- Mention the flight time is approximately 8-9 hours
- Note that pricing typically starts from $80,000-$100,000 one-way

Once you have all the necessary information (route, passengers, dates), suggest connecting the user with a specialist for an exact quote.`
    },
    
    // Firebase configuration
    firebase: {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        databaseURL: process.env.FIREBASE_DATABASE_URL
    },
    
    // Lead scoring thresholds
    leadScoring: {
        escalationThreshold: 70,
        priorities: {
            low: { min: 0, max: 30 },
            medium: { min: 31, max: 69 },
            high: { min: 70, max: 100 }
        }
    },
    
    // Response templates
    templates: {
        welcome: "Hey there, welcome to CoinWings. Looking for a private jet? I can walk you through how it works, what to consider, and get you an estimate if needed. No pressure, just here to help. 🚀",
        handoff: "Thanks for providing those details! I've passed your inquiry to one of our aviation specialists who will get back to you shortly with more information. They'll be able to provide an exact quote and answer any specific questions you might have. Is there anything else you'd like to know while you wait?",
        missingInfo: "To help you better, I'd need a few more details about what you're looking for. No rush though - just let me know when you're ready to share more about your trip.",
        fallback: "Sorry about that - I'm having a bit of trouble processing your request. Could you rephrase that, or let me know specifically what you'd like to know about private jet charters?"
    }
};

module.exports = config; 