const express = require('express');
const router = express.Router();
const { createAffiliate, getAffiliate, getAllAffiliates } = require('../services/affiliateService');

// Create new affiliate
router.post('/affiliates', async (req, res) => {
  try {
    const { name, email, commissionRate, cryptoAddress, preferredCurrency } = req.body;
    console.log('Creating affiliate with data:', req.body);
    const code = await createAffiliate({
      name,
      email,
      commissionRate,
      cryptoAddress,
      preferredCurrency
    });
    console.log('Affiliate created with code:', code);
    res.json({ code });
  } catch (error) {
    console.error('Error creating affiliate:', error);
    res.status(500).json({ error: 'Error creating affiliate', details: error.message });
  }
});

// Get all affiliates
router.get('/affiliates', async (req, res) => {
  try {
    const affiliates = await getAllAffiliates();
    res.json(affiliates);
  } catch (error) {
    console.error('Error getting affiliates:', error);
    res.status(500).json({ error: 'Error getting affiliates', details: error.message });
  }
});

// Get affiliate by code
router.get('/affiliates/:code', async (req, res) => {
  try {
    const affiliate = await getAffiliate(req.params.code);
    if (!affiliate) {
      return res.status(404).json({ error: 'Affiliate not found' });
    }
    res.json(affiliate);
  } catch (error) {
    console.error('Error getting affiliate:', error);
    res.status(500).json({ error: 'Error getting affiliate', details: error.message });
  }
});

module.exports = router; 