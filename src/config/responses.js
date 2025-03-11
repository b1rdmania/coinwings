/**
 * Predefined responses for common questions and scenarios
 */
const responses = {
  welcome_message: {
    trigger: ["start", "hello", "hi"],
    response: "Hey there, welcome to CoinWings. 🚀 Looking for a private jet? I can walk you through how it works, what to consider, and get you an estimate if needed. No pressure, just here to help. ✈️"
  },

  how_it_works: {
    trigger: ["how does this work", "how do i book", "explain process", "booking process"],
    response: "Simple: \n1️⃣ Tell me your route, date, and passengers. \n2️⃣ I'll estimate a price range. \n3️⃣ If you're interested, I'll connect you to an agent. \n4️⃣ Pay in crypto & take off. 🚀"
  },

  pricing_info: {
    trigger: ["how much does it cost", "pricing", "quote", "price", "cost"],
    response: "💡 Private jet pricing varies based on:\n- ✈️ Aircraft type\n- 📅 Flight timing & availability\n- 🏢 Departure & landing fees\n\nWant an estimate? Tell me your route and I'll give a rough range."
  },

  crypto_payments: {
    trigger: ["do you accept crypto", "pay with btc", "payment options", "crypto", "bitcoin", "ethereum"],
    response: "✅ We accept **BTC, ETH, USDC**, and other major cryptocurrencies. \n✅ No unnecessary KYC—just smooth, secure transactions."
  },

  lead_capture: {
    trigger: ["i want to book", "get me a jet", "send to agent", "book now", "charter"],
    response: "Great! Let's get the details:\n- 🛩 **From:** [Enter city/airport]\n- 📍 **To:** [Enter destination]\n- 📅 **Date:** [Enter date]\n- 👥 **Passengers:** [Enter number]\n- 💰 **Crypto payment? (Yes/No)**\n\nI'll pass this over to an agent once you confirm."
  },

  agent_handoff: {
    trigger: ["confirm", "yes", "send", "connect me", "speak to agent"],
    response: "Got it. Quick summary:\n- ✈️ Route: {from} → {to}\n- 📅 Date: {date}\n- 👥 Passengers: {passengers}\n- 💰 Crypto: {payment}\n\nI'm sending this to an agent now. They'll reach out shortly. ✅"
  },

  faq: {
    trigger: ["tips", "advice", "how to fly private", "suggestions", "recommendations"],
    response: "Some quick tips for private jet travel: \n💡 **Book flexibly:** Empty legs can save you 50%+.\n💡 **Aircraft matters:** A Light Jet = cost-effective, Heavy Jet = ultimate comfort.\n💡 **Crypto is fast:** But **confirm USDC availability** in advance for smooth payments.\n💡 **Flight times:** Private jets need slots too—best book early for busy routes.\n\nNeed more advice? Happy to help."
  }
};

/**
 * Find a matching response for the given text
 * @param {string} text - User message text
 * @returns {string|null} Matching response or null if no match
 */
function findMatchingResponse(text) {
  if (!text) return null;
  
  const lowerText = text.toLowerCase().trim();
  
  for (const [key, responseObj] of Object.entries(responses)) {
    for (const trigger of responseObj.trigger) {
      if (lowerText.includes(trigger)) {
        return responseObj.response;
      }
    }
  }
  
  return null;
}

module.exports = {
  responses,
  findMatchingResponse
}; 