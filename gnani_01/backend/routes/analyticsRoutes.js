const express = require('express');
const mongoose = require('mongoose');
const Issue = require('../models/Issue');
const { generateHotspotIntelligence } = require('../services/complaints/hotspotService');
const { findPotentialDuplicates } = require('../services/complaints/duplicateService');
const { analyzeLocationRecurrence } = require('../services/complaints/recurrenceService');
const { getDemoIssues } = require('../controllers/issueController');

const router = express.Router();

// Helper to fetch issues whether DB is connected or using fallback
async function fetchAllIssues() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const dbIssues = await Issue.find().lean();
      if (dbIssues && dbIssues.length > 0) return dbIssues;
    } catch (err) {
      // DB offline, fall through to demo issues
    }
  }
  return getDemoIssues();
}

/**
 * GET /api/analytics/hotspots
 * Dynamic Garbage Hotspot & Heatmap Points
 */
router.get('/hotspots', async (req, res) => {
  try {
    const { timeRange, status, category } = req.query;
    const issues = await fetchAllIssues();
    const result = generateHotspotIntelligence(issues, { timeRange, status, category });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ /api/analytics/hotspots error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/analytics/duplicates
 * Check potential duplicate complaints near lat/lng
 */
router.get('/duplicates', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const title = req.query.title || '';
    const category = req.query.category || 'Garbage';

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng required' });
    }

    const issues = await fetchAllIssues();
    const result = findPotentialDuplicates(
      { location: { lat, lng }, title, category },
      issues,
      parseInt(req.query.radius, 10) || 150
    );

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ /api/analytics/duplicates error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/analytics/recurrence
 * Historical Waste Recurrence Analytics
 */
router.get('/recurrence', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ success: false, message: 'Valid lat and lng required' });
    }

    const issues = await fetchAllIssues();
    const result = analyzeLocationRecurrence(lat, lng, issues);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ /api/analytics/recurrence error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;

