/**
 * Database service for storing and retrieving data
 * This is a simplified version that uses Firebase
 */

const { storeLead } = require('./firebase');

/**
 * Store lead data in the database
 * @param {Object} leadData - Lead data to store
 * @returns {Promise<boolean>} - Success status
 */
async function storeLeadData(leadData) {
  try {
    await storeLead(leadData);
    console.log('Lead data stored in database');
    return true;
  } catch (error) {
    console.error('Error storing lead data:', error);
    return false;
  }
}

/**
 * Get admin users from the database
 * Currently returns a hardcoded list of admin users
 * @returns {Promise<Array>} - List of admin users
 */
async function getAdminUsers() {
  // In a real implementation, this would fetch from the database
  // For now, we'll use the agent channel from the environment
  const agentChannelId = process.env.AGENT_CHANNEL;
  
  return [
    {
      userId: agentChannelId,
      isAdmin: true
    }
  ];
}

module.exports = {
  storeLeadData,
  getAdminUsers
}; 