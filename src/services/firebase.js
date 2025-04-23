// const { initializeApp } = require('firebase/app'); // Removed Client SDK
// const { getDatabase, ref, get, set, update } = require('firebase/database'); // Removed Client SDK
const admin = require('firebase-admin');
const config = require('../config/config.js');

// Firebase configuration - will be loaded from environment variables
// const firebaseConfig = { // Removed Client SDK config
//   projectId: process.env.FIREBASE_PROJECT_ID,
//   databaseURL: process.env.FIREBASE_DATABASE_URL
// };

// Initialize Firebase Client SDK - Removed
// const app = initializeApp(firebaseConfig);
// const database = getDatabase(app);

// Initialize Firebase Admin
if (!admin.apps.length) {
    try {
        let serviceAccount;
        if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_PRIVATE_KEY) {
            // Heroku/Production: Use environment variables
            console.log('Initializing Firebase Admin using Heroku Config Vars...');
            // Need to replace \n characters in the private key if they exist
            const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\n/g, '\n');
            serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: privateKey
            }
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: config.firebase.databaseURL // Ensure config file also loads databaseURL from env
            });
        } else {
            // Local Development: Use service account key file
            console.log('Initializing Firebase Admin using local service account key...');
            serviceAccount = require('../../serviceAccountKey.json');
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                databaseURL: config.firebase.databaseURL
            });
        }
        console.log('Firebase Admin Initialized successfully.');
    } catch (error) {
        console.error('Firebase Admin Initialization failed:', error);
        if (process.env.NODE_ENV !== 'production') {
             console.error('Ensure serviceAccountKey.json exists for local dev OR FIREBASE_* env vars are set for production.');
        }
        process.exit(1); // Exit if Firebase initialization fails
    }
} else {
    console.log('Firebase Admin already initialized (firebase.js)');
}

const db = admin.database(); // Use Admin SDK database

/**
 * Get aircraft information from Firebase using Admin SDK
 * @param {string} category - Optional aircraft category (light, midsize, heavy)
 * @param {string} model - Optional specific aircraft model
 * @returns {Promise<Object|null>} Aircraft information or null
 */
async function getAircraftInfo(category = null, model = null) {
  try {
    let dataRef;
    if (model) {
      dataRef = db.ref(`aircraft/specific_models/${model}`);
    } else if (category) {
      dataRef = db.ref(`aircraft/categories/${category}`);
    } else {
      dataRef = db.ref('aircraft');
    }
    const snapshot = await dataRef.once('value');
    return snapshot.val(); // .val() returns null if path doesn't exist
  } catch (error) {
    console.error('Error fetching aircraft info:', error);
    return null;
  }
}

/**
 * Get route information from Firebase using Admin SDK
 * @param {string} origin - Origin city/airport
 * @param {string} destination - Destination city/airport
 * @returns {Promise<Object|null>} Route information or null
 */
async function getRouteInfo(origin = null, destination = null) {
  try {
    let dataRef;
    if (origin && destination) {
      const normalizedOrigin = origin.toLowerCase().replace(/\s+/g, '_');
      const normalizedDestination = destination.toLowerCase().replace(/\s+/g, '_');
      const routeKey = `${normalizedOrigin}_${normalizedDestination}`;
      dataRef = db.ref(`routes/popular_routes/${routeKey}`);
      const snapshot = await dataRef.once('value');
      if (snapshot.exists()) {
        return snapshot.val();
      }
      // Try reverse route
      const reverseRouteKey = `${normalizedDestination}_${normalizedOrigin}`;
      const reverseRouteRef = db.ref(`routes/popular_routes/${reverseRouteKey}`);
      const reverseSnapshot = await reverseRouteRef.once('value');
      return reverseSnapshot.val();
    } else {
      dataRef = db.ref('routes/popular_routes');
      const snapshot = await dataRef.once('value');
      return snapshot.val();
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
 * Get FAQ information from Firebase using Admin SDK
 * @param {string} category - Optional FAQ category
 * @returns {Promise<Object|null>} FAQ information or null
 */
async function getFAQ(category = null) {
  try {
    let dataRef;
    if (category) {
      dataRef = db.ref(`faq/${category}`);
    } else {
      dataRef = db.ref('faq');
    }
    const snapshot = await dataRef.once('value');
    return snapshot.val();
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