const admin = require('firebase-admin');
const config = require('../config/config');

// Use the existing Firebase Admin instance
const db = admin.database();

/**
 * Generate a new affiliate code
 * @returns {string} - The generated affiliate code
 */
const generateAffiliateCode = () => {
  const prefix = 'AFF';
  const timestamp = Date.now().toString().slice(-4);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
};

/**
 * Create a new affiliate
 * @param {Object} affiliateData - The affiliate data
 * @returns {Promise<string>} - The affiliate code
 */
const createAffiliate = async (affiliateData) => {
  try {
    const code = generateAffiliateCode();
    const data = {
      code,
      name: affiliateData.name,
      email: affiliateData.email,
      status: 'active',
      createdAt: Date.now(),
      lastUsed: null,
      totalLeads: 0,
      convertedLeads: 0,
      commissionRate: affiliateData.commissionRate || 0.05,
      paymentDetails: {
        cryptoAddress: affiliateData.cryptoAddress,
        preferredCurrency: affiliateData.preferredCurrency || 'USDC'
      }
    };

    await db.ref(`affiliates/${code}`).set(data);
    console.log(`Affiliate created with code: ${code}`);
    return code;
  } catch (error) {
    console.error('Error creating affiliate:', error);
    throw error;
  }
};

/**
 * Get affiliate by code
 * @param {string} code - The affiliate code
 * @returns {Promise<Object>} - The affiliate data
 */
const getAffiliate = async (code) => {
  try {
    const snapshot = await db.ref(`affiliates/${code}`).once('value');
    return snapshot.val();
  } catch (error) {
    console.error('Error getting affiliate:', error);
    throw error;
  }
};

/**
 * Update affiliate stats
 * @param {string} code - The affiliate code
 * @param {boolean} converted - Whether the lead was converted
 * @returns {Promise<void>}
 */
const updateAffiliateStats = async (code, converted = false) => {
  try {
    const updates = {
      lastUsed: Date.now(),
      totalLeads: admin.database.ServerValue.increment(1)
    };

    if (converted) {
      updates.convertedLeads = admin.database.ServerValue.increment(1);
    }

    await db.ref(`affiliates/${code}`).update(updates);
    console.log(`Affiliate stats updated for code: ${code}`);
  } catch (error) {
    console.error('Error updating affiliate stats:', error);
    throw error;
  }
};

/**
 * Get all affiliates
 * @returns {Promise<Array>} - Array of affiliates
 */
const getAllAffiliates = async () => {
  try {
    const snapshot = await db.ref('affiliates').once('value');
    return snapshot.val() || {};
  } catch (error) {
    console.error('Error getting all affiliates:', error);
    throw error;
  }
};

module.exports = {
  createAffiliate,
  getAffiliate,
  updateAffiliateStats,
  getAllAffiliates
}; 