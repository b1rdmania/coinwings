const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set, update } = require('firebase/database');
const admin = require('firebase-admin');
const config = require('../config');

// Firebase configuration - will be loaded from environment variables
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  databaseURL: process.env.FIREBASE_DATABASE_URL
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Initialize Firebase Admin
const serviceAccount = require('../../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: config.firebase.databaseURL
});

const db = admin.database();

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
 * Store lead data in Firebase
 * @param {Object} leadData - The lead data to store
 * @returns {Promise<string>} - The ID of the stored lead
 */
const storeLeadData = async (leadData) => {
  try {
    // Add timestamp and source
    const data = {
      ...leadData,
      timestamp: Date.now(),
      source: 'CoinWings',
      status: 'new',
      lastUpdated: Date.now(),
      affiliateSource: leadData.affiliateSource || null
    };

    // Generate a unique ID for the lead
    const leadRef = db.ref('leads').push();
    await leadRef.set(data);
    
    console.log(`Lead stored successfully with ID: ${leadRef.key}`);
    return leadRef.key;
  } catch (error) {
    console.error('Error storing lead data:', error);
    throw error;
  }
};

/**
 * Get admin users from Firebase
 * @returns {Promise<Array>} - Array of admin users
 */
const getAdminUsers = async () => {
  try {
    const snapshot = await db.ref('adminUsers').once('value');
    return snapshot.val() || [];
  } catch (error) {
    console.error('Error getting admin users:', error);
    return [];
  }
};

/**
 * Update lead status
 * @param {string} leadId - The ID of the lead to update
 * @param {string} status - The new status
 * @returns {Promise<void>}
 */
const updateLeadStatus = async (leadId, status) => {
  try {
    await db.ref(`leads/${leadId}`).update({
      status,
      lastUpdated: Date.now()
    });
    console.log(`Lead ${leadId} status updated to ${status}`);
  } catch (error) {
    console.error('Error updating lead status:', error);
    throw error;
  }
};

/**
 * Get lead by ID
 * @param {string} leadId - The ID of the lead to retrieve
 * @returns {Promise<Object>} - The lead data
 */
const getLeadById = async (leadId) => {
  try {
    const snapshot = await db.ref(`leads/${leadId}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('Error getting lead:', error);
    throw error;
  }
};

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
  storeLeadData,
  getAdminUsers,
  updateLeadStatus,
  getLeadById,
  getFAQ
}; 