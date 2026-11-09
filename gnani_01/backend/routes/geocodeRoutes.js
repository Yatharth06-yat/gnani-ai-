/**
 * geocodeRoutes.js - Reverse & Forward Geocoding Proxy for SwachhMap
 * 
 * - Integrates OpenStreetMap Nominatim with caching, rate-limit protection, and user-agent compliance.
 * - Extracts human-readable locality, neighborhood, road, city, state, country.
 * - Protects against API abuse and avoids exposing third-party service dependencies to the client.
 */

const express = require('express');
const router = express.Router();

// In-memory cache for reverse geocode coordinates (rounded to 4 decimal places ~11 meters)
const geocodeCache = new Map();
const MAX_CACHE_ENTRIES = 500;

// Rate-limiting delay state to respect OSM 1 request/second guideline
let lastRequestTime = 0;

/**
 * Format address object into human-readable hierarchy
 */
function extractLocationComponents(osmData) {
  if (!osmData || !osmData.address) {
    return {
      displayName: osmData?.display_name || 'Unknown Location',
      locality: null,
      neighborhood: null,
      road: null,
      landmark: null,
      city: null,
      state: null,
      country: null,
      formattedSummary: osmData?.display_name || 'Unknown Location'
    };
  }

  const addr = osmData.address;

  const landmark = osmData.name || addr.amenity || addr.leisure || addr.tourism || addr.building || null;
  const neighborhood = addr.neighbourhood || addr.suburb || addr.residential || addr.quarter || null;
  const locality = addr.locality || addr.village || addr.town || neighborhood || null;
  const road = addr.road || addr.pedestrian || addr.footway || null;
  const city = addr.city || addr.town || addr.county || addr.state_district || 'City';
  const state = addr.state || '';
  const country = addr.country || 'India';

  // Build clean conversational summary (e.g., "Kartavya Path, Raisina Hill, New Delhi")
  const parts = [];
  if (landmark && landmark !== road) parts.push(landmark);
  if (road && !parts.includes(road)) parts.push(road);
  if (neighborhood && !parts.includes(neighborhood)) parts.push(neighborhood);
  if (city && !parts.includes(city)) parts.push(city);
  if (state && !parts.includes(state)) parts.push(state);

  const formattedSummary = parts.length > 0 ? parts.join(', ') : (osmData.display_name || `${city}, ${state}`);

  return {
    displayName: osmData.display_name || formattedSummary,
    landmark,
    road,
    neighborhood,
    locality,
    city,
    state,
    country,
    formattedSummary,
    spokenLocation: parts.slice(0, 3).join(', ') // Concise for TTS speech
  };
}

/**
 * GET /api/geocode/reverse?lat=28.6139&lng=77.2090
 */
router.get('/reverse', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng || req.query.lon);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({
        success: false,
        message: 'Valid latitude and longitude are required.'
      });
    }

    // Cache key: rounded to 4 decimals (~11m precision)
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (geocodeCache.has(cacheKey)) {
      const cached = geocodeCache.get(cacheKey);
      return res.json({
        success: true,
        source: 'cache',
        coordinates: { lat, lng },
        data: cached
      });
    }

    // Throttle OSM Nominatim requests if necessary (1 req/sec policy)
    const now = Date.now();
    const waitTime = Math.max(0, 1000 - (now - lastRequestTime));
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    // Use dynamic import for fetch or global fetch in Node 18+
    const fetchFn = global.fetch || (await import('node-fetch')).default;
    const response = await fetchFn(nominatimUrl, {
      headers: {
        'User-Agent': 'SwachhMap-CivicApp/2.0 (contact: admin@swachhmap.org; educational civic technology project)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim returned HTTP ${response.status}`);
    }

    const osmData = await response.json();
    const locationInfo = extractLocationComponents(osmData);

    // Save in cache (prune if exceeds limit)
    if (geocodeCache.size >= MAX_CACHE_ENTRIES) {
      const firstKey = geocodeCache.keys().next().value;
      geocodeCache.delete(firstKey);
    }
    geocodeCache.set(cacheKey, locationInfo);

    return res.json({
      success: true,
      source: 'nominatim',
      coordinates: { lat, lng },
      data: locationInfo
    });

  } catch (error) {
    console.error('❌ Reverse Geocode Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to resolve location address. Please verify GPS coordinates or select manually on map.',
      error: error.message
    });
  }
});

module.exports = router;

