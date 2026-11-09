/**
 * locationService.js - Client Location & Reverse Geocoding Service for Swachh Saathi
 * 
 * - Handles GPS acquisition with precision & accuracy estimation.
 * - Calls backend geocoding proxy to retrieve human-readable place names.
 * - Formats verified spoken announcements in Hindi, English, and Hinglish.
 * - Distinguishes between Citizen GPS Location and Verified Garbage Waste Location.
 */

import api from '../../utils/api';

/**
 * Request citizen GPS location through browser Geolocation API
 * @param {Object} options
 * @returns {Promise<{lat: number, lng: number, accuracy: number}>}
 */
export async function getCitizenGPS(options = { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }) {
  if (!navigator.geolocation) {
    throw new Error('GEOLOCATION_UNSUPPORTED');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy || 10
        });
      },
      (error) => {
        let errType = 'GEOLOCATION_FAILED';
        if (error.code === 1) errType = 'GEOLOCATION_DENIED';
        else if (error.code === 3) errType = 'GEOLOCATION_TIMEOUT';
        reject(new Error(errType));
      },
      options
    );
  });
}

/**
 * Reverse geocode coordinates to human-readable address
 * @param {number} lat 
 * @param {number} lng 
 * @returns {Promise<Object>}
 */
export async function reverseGeocode(lat, lng) {
  try {
    const res = await api.get(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (res.data && res.data.success) {
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Geocoding failed');
  } catch (error) {
    console.warn('⚠️ Reverse geocoding failed:', error.message);
    return null;
  }
}

/**
 * Generate a spoken announcement for retrieved location
 * @param {Object} locationData
 * @param {string} language
 * @param {boolean} isGarbageLocation - true if this is where garbage is, false if user's current GPS location
 * @returns {string} Natural announcement text
 */
export function buildLocationAnnouncement(locationData, language = 'hi', isGarbageLocation = false) {
  if (!locationData) {
    if (language === 'en') {
      return isGarbageLocation 
        ? "Selected location coordinates saved, but the place name could not be resolved. Would you like to confirm this point on the map?"
        : "GPS location detected, but could not resolve place name. Would you like to confirm your coordinates?";
    }
    return isGarbageLocation
      ? "Chuni hui jagah ke coordinates save ho gaye hain, lekin jagah ka naam resolve nahi ho paya. Kya aap isi jagah garbage report karna chahte hain?"
      : "Aapki GPS location detect ho gayi hai, par exact area ka naam resolve nahi ho paya. Kya garbage aapki isi position ke paas hai?";
  }

  const { landmark, locality, neighborhood, road, city, state, formattedSummary, spokenLocation } = locationData;

  // Pick the most specific identifiable area name
  const place = spokenLocation || locality || neighborhood || road || landmark || city || formattedSummary;

  if (language === 'en') {
    if (isGarbageLocation) {
      return `You have selected the location near ${place}. Is this where the garbage is located?`;
    }
    return `Your current location is near ${place}, ${city || state}. Is the garbage located right here?`;
  }

  // Hindi / Hinglish default
  if (isGarbageLocation) {
    return `Aapne ${place} ke paas wali location select ki hai. Kya ye garbage ki correct location hai?`;
  }
  return `Aapki current location ${place}, ${city || state} ke aas-paas hai. Kya garbage isi jagah par pada hai?`;
}
