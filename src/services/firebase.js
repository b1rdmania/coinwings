const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');

// Firebase configuration - will be loaded from environment variables
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/**
 * Get aircraft information from Firebase
 * @param {string} category - Optional aircraft category (light, midsize, heavy)
 * @param {string} model - Optional specific aircraft model
 * @returns {Promise<Object>} Aircraft information
 */
async function getAircraftInfo(category = null, model = null) {
  try {
    if (model) {
      const modelRef = ref(database, `aircraft/specific_models/${model}`);
      const snapshot = await get(modelRef);
      return snapshot.exists() ? snapshot.val() : null;
    } else if (category) {
      const categoryRef = ref(database, `aircraft/categories/${category}`);
      const snapshot = await get(categoryRef);
      return snapshot.exists() ? snapshot.val() : null;
    } else {
      const aircraftRef = ref(database, 'aircraft');
      const snapshot = await get(aircraftRef);
      return snapshot.exists() ? snapshot.val() : null;
    }
  } catch (error) {
    console.error('Error fetching aircraft info:', error);
    return null;
  }
}

/**
 * Get route information from Firebase
 * @param {string} origin - Origin city/airport
 * @param {string} destination - Destination city/airport
 * @returns {Promise<Object>} Route information
 */
async function getRouteInfo(origin = null, destination = null) {
  try {
    if (origin && destination) {
      // Normalize city names for lookup
      const normalizedOrigin = origin.toLowerCase().replace(/\s+/g, '_');
      const normalizedDestination = destination.toLowerCase().replace(/\s+/g, '_');
      const routeKey = `${normalizedOrigin}_${normalizedDestination}`;
      
      const routeRef = ref(database, `routes/popular_routes/${routeKey}`);
      const snapshot = await get(routeRef);
      
      if (snapshot.exists()) {
        return snapshot.val();
      }
      
      // Try reverse route if direct route not found
      const reverseRouteKey = `${normalizedDestination}_${normalizedOrigin}`;
      const reverseRouteRef = ref(database, `routes/popular_routes/${reverseRouteKey}`);
      const reverseSnapshot = await get(reverseRouteRef);
      
      return reverseSnapshot.exists() ? reverseSnapshot.val() : null;
    } else {
      // Get all routes
      const routesRef = ref(database, 'routes/popular_routes');
      const snapshot = await get(routesRef);
      return snapshot.exists() ? snapshot.val() : null;
    }
  } catch (error) {
    console.error('Error fetching route info:', error);
    return null;
  }
}

/**
 * Store lead information in Firebase
 * @param {Object} leadData - Lead information
 * @returns {Promise<string>} Lead ID
 */
async function storeLead(leadData) {
  try {
    const timestamp = Date.now();
    const leadId = `lead_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    const leadRef = ref(database, `leads/${leadId}`);
    
    // Ensure all required fields are present and properly formatted
    const lead = {
      id: leadId,
      timestamp: timestamp,
      userId: leadData.userId || 0,
      username: leadData.username || 'Anonymous',
      firstName: leadData.firstName || 'Anonymous',
      lastName: leadData.lastName || '',
      score: leadData.score || 0,
      priority: leadData.priority || 'low',
      triggerType: leadData.triggerType || 'auto',
      status: 'new',
      lastUpdated: timestamp,
      
      // Optional conversation data
      summary: leadData.summary || 'No summary available',
      
      // Optional trip details
      origin: leadData.origin || null,
      destination: leadData.destination || null,
      date: leadData.date || null,
      pax: leadData.pax || null,
      aircraft: leadData.aircraft || null,
      
      // Additional fields
      notes: leadData.notes || '',
      assignedAgent: null
    };
    
    // Store conversation messages as a stringified JSON to avoid Firebase validation issues
    if (leadData.conversation && Array.isArray(leadData.conversation)) {
      lead.conversationData = JSON.stringify(leadData.conversation);
    } else {
      lead.conversationData = '[]';
    }
    
    await set(leadRef, lead);
    console.log(`Lead ${leadId} stored successfully`);
    return leadId;
  } catch (error) {
    console.error('Error storing lead:', error);
    throw error;
  }
}

/**
 * Update lead status in Firebase
 * @param {string} leadId - Lead ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<boolean>} Success status
 */
async function updateLead(leadId, updateData) {
  try {
    const leadRef = ref(database, `leads/${leadId}`);
    updateData.lastUpdated = Date.now();
    
    await update(leadRef, updateData);
    return true;
  } catch (error) {
    console.error('Error updating lead:', error);
    return false;
  }
}

/**
 * Get FAQ information from Firebase
 * @param {string} category - Optional FAQ category
 * @returns {Promise<Object>} FAQ information
 */
async function getFAQ(category = null) {
  try {
    if (category) {
      const faqRef = ref(database, `faq/${category}`);
      const snapshot = await get(faqRef);
      return snapshot.exists() ? snapshot.val() : null;
    } else {
      const faqRef = ref(database, 'faq');
      const snapshot = await get(faqRef);
      return snapshot.exists() ? snapshot.val() : null;
    }
  } catch (error) {
    console.error('Error fetching FAQ:', error);
    return null;
  }
}

module.exports = {
  getAircraftInfo,
  getRouteInfo,
  storeLead,
  updateLead,
  getFAQ
}; 