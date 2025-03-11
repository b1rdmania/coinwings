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
        systemPrompt: `You are CoinWings, a private aviation concierge bot for the crypto community. 
Your goal is to gather information about the user's private jet charter needs and provide helpful information.
Be friendly, professional, and knowledgeable about private aviation.

IMPORTANT GUIDELINES:
1. Ask one question at a time to gather: route (origin/destination), number of passengers, travel dates, and preferred aircraft type.
2. NEVER ask for information that has already been provided. Check the conversation state carefully.
3. If the user says they've already provided information, apologize and move forward without asking for it again.
4. Acknowledge information the user has provided before asking for new information.
5. If the user asks about pricing, provide general guidance but emphasize that exact quotes require specific details.
6. For crypto users, mention that we accept BTC, ETH, and USDC for payment.
7. Always maintain a helpful, concise tone and focus on gathering the necessary information.

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
        welcome: "Welcome to CoinWings! I'm your private aviation concierge. How can I assist with your private jet charter today?",
        handoff: "Thank you for providing your details. I'm connecting you with our aviation specialist who will assist you further.",
        missingInfo: "To provide you with the best options, could you please share more details about your trip?",
        fallback: "I apologize, but I'm having trouble processing your request. Could you please rephrase or provide more details?"
    }
};

module.exports = config; 