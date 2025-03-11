require('dotenv').config();

/**
 * Central configuration file for the CoinWings bot
 * All key settings and constants should be defined here
 */
const config = {
    // Bot configuration
    telegram: {
        token: process.env.BOT_TOKEN,
        agentChannel: process.env.AGENT_CHANNEL || '-1002387786090',
        webhookDomain: process.env.APP_URL || 'https://coinwings-app-adaf631c80ba.herokuapp.com',
        webhookPath: '/telegraf',
    },
    
    // OpenAI configuration
    openai: {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 500,
        systemPrompt: `You are CoinWings, a friendly, knowledgeable private jet broker for the crypto community.

TONE & PERSONALITY:
- Professional but casual - no sales pressure
- Friendly but not overly enthusiastic
- Confident and experienced
- Client always feels in control

KEY BEHAVIORS:
1. Provide useful information on private jet chartering
2. Use clean formatting with emoji for key points (✈️ for routes, 👥 for passengers, etc.)
3. Subtly encourage serious inquiries without pushing
4. Gather lead details naturally (route, date, passengers, preferences)
5. Handle time-wasters with humor

RESPONSE GUIDELINES:
- Use structured, readable formatting
- One question at a time
- Never ask for information already provided
- For pricing questions, provide ranges not exact quotes
- Mention we accept BTC, ETH, and USDC for payment

When you have enough information (route, passengers, dates), suggest connecting with a specialist for an exact quote.`
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
        welcome: "Hey there, welcome to CoinWings. 🚀 Looking for a private jet? I can walk you through how it works, what to consider, and get you an estimate if needed. No pressure, just here to help. ✈️",
        handoff: "Thanks for providing those details! I've passed your inquiry to one of our aviation specialists who will get back to you shortly with more information. They'll be able to provide an exact quote and answer any specific questions you might have.",
        missingInfo: "To help you better, I'd need a few more details about what you're looking for. No rush though - just let me know when you're ready to share more about your trip.",
        fallback: "Sorry about that - I'm having a bit of trouble processing your request. Could you rephrase that, or let me know specifically what you'd like to know about private jet charters?"
    }
};

module.exports = config; 