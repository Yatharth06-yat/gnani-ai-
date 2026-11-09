/**
 * agentOrchestrator.js — Phase 1, Phase 2, and Phase 3 Agent Dispatcher for Swachh Saathi
 * 
 * Maps citizen voice intents to authorized SwachhMap agents:
 * - Phase 1: Core AI, Intent Recognition, Conversation Context
 * - Phase 2:
 *     • Complaint Agent (Waste reporting, slot filling, Evon reasoning, Prisma STT)
 *     • Status Agent (Track existing complaints, check resolution status, get recent reports)
 * - Phase 3:
 *     • Vision Agent (Invoke camera / image upload, YOLO11n validation)
 *     • Location Agent (GPS detection, coordinates confirmation, map positioning)
 * - Control Commands:
 *     • Stop Listening / Cancel
 *     • Gratitude / Exit ("Thank you Swachh Saathi")
 */

import api from '../../utils/api';
import { getCitizenGPS, reverseGeocode, buildLocationAnnouncement } from './locationService';

export const AGENT_TYPES = {
  COMPLAINT: 'complaint_agent',
  STATUS: 'status_agent',
  VISION: 'vision_agent',
  LOCATION: 'location_agent',
  CONTROL: 'control_agent',
  GENERAL: 'general_agent'
};

export function classifyIntent(text) {
  if (!text || typeof text !== 'string') return { agent: AGENT_TYPES.GENERAL, action: 'none' };
  const t = text.toLowerCase().trim();

  // Control / Cancel / Stop
  if (/(stop|ruko|band karo|shut up|exit|close|chup|khatam|rehne do|cancel)/i.test(t)) {
    return { agent: AGENT_TYPES.CONTROL, action: 'stop' };
  }

  // Location correction / Denial / "Nahi, ye location galat hai"
  if (/(location galat|galat hai|thoda aage|park ke|gate ke|dusri location|change location|wahan nahi|idhar nahi)/i.test(t)) {
    return { agent: AGENT_TYPES.LOCATION, action: 'correct_location' };
  }

  // Gratitude / Polite exit
  if (/(thank you|thanks|shukriya|dhanyawad|dhanyavad|bahut accha|good job)/i.test(t)) {
    return { agent: AGENT_TYPES.CONTROL, action: 'gratitude' };
  }

  // Status Agent: Status check, tracking, my complaints
  if (/(status|check status|track|mera complaint|meri complaint|shikayat ka status|kya hua|progress|update|pichli shikayat)/i.test(t)) {
    return { agent: AGENT_TYPES.STATUS, action: 'check_status' };
  }

  // Vision Agent: Camera, photo, picture, scan
  if (/(camera|kamera|photo|tasveer|picture|snap|image|khicho|kholo|take photo|open camera|scan)/i.test(t)) {
    return { agent: AGENT_TYPES.VISION, action: 'open_camera' };
  }

  // Location Agent: GPS, location, address, map, yahan, jagah, meri location
  if (/(location|gps|pata|address|jagah|map|nakshe|yahan|current location|meri location|meri jagah|batao|kahan hoon|where am i)/i.test(t)) {
    return { agent: AGENT_TYPES.LOCATION, action: 'get_location' };
  }

  // Complaint Agent: Garbage, waste, kachra, safai, litter, dump
  if (/(garbage|waste|kachra|kuda|litter|safai|gandagi|dump|overflow|debris|plastic|clean|report)/i.test(t)) {
    return { agent: AGENT_TYPES.COMPLAINT, action: 'report_garbage' };
  }

  return { agent: AGENT_TYPES.COMPLAINT, action: 'conversation' };
}

/**
 * Executes Location Agent to retrieve citizen GPS and reverse-geocode to verified place name
 */
export async function executeLocationQuery(language = 'hi') {
  try {
    const coords = await getCitizenGPS();
    const geocodeData = await reverseGeocode(coords.lat, coords.lng);
    const spokenMessage = buildLocationAnnouncement(geocodeData, language, false);

    return {
      success: true,
      coords,
      locationData: geocodeData,
      spokenMessage,
      displayText: geocodeData?.formattedSummary || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    };
  } catch (error) {
    let msg = 'GPS location prapt nahi ho saki. Kripya map par manually jagah select karein.';
    if (error.message === 'GEOLOCATION_DENIED') {
      msg = 'Browser ne location permission block kar di hai. Kripya browser settings me permission allow karein ya map use karein.';
    }
    return {
      success: false,
      error: error.message,
      spokenMessage: msg,
      displayText: msg
    };
  }
}

/**
 * Resolves a manually selected map location (Leaflet marker placement or movement)
 */
export async function resolveMapMarkerLocation(lat, lng, language = 'hi') {
  try {
    const geocodeData = await reverseGeocode(lat, lng);
    const spokenMessage = buildLocationAnnouncement(geocodeData, language, true);

    return {
      success: true,
      coords: { lat, lng },
      locationData: geocodeData,
      spokenMessage,
      displayText: geocodeData?.formattedSummary || `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };
  } catch (error) {
    return {
      success: false,
      coords: { lat, lng },
      spokenMessage: 'Chuni hui jagah ka address resolve nahi ho paya, lekin coordinates select ho chuke hain.',
      displayText: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
    };
  }
}

/**
 * Executes Status Agent query against backend REST endpoints
 */
export async function executeStatusQuery(userId) {
  try {
    const res = await api.get('/api/issues/my-reports');
    const reports = res.data?.data || [];
    if (reports.length === 0) {
      return {
        found: false,
        message: 'Aapki koi active complaint darj nahi hai. Nayi complaint darj karne ke liye bataiye.'
      };
    }
    const latest = reports[0];
    return {
      found: true,
      latestReport: latest,
      message: `Aapki latest complaint #${latest.complaintId || latest._id} ka status: "${latest.status}". Category: ${latest.category || 'Garbage'}.`
    };
  } catch (err) {
    return {
      found: false,
      message: 'Complaint status check karne me dikkat aayi. Kripya My Reports page check karein.'
    };
  }
}

