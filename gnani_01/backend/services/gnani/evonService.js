const gnaniConfig = require('./gnaniConfig');
const { getLanguageConfig } = require('./languageConfig');
const { validateStructuredComplaint } = require('./gnaniValidators');
const { handleGnaniError } = require('./gnaniErrorHandler');

/**
 * Gnani Evon 30B NLU & Reasoning Adapter
 * Transforms unstructured citizen speech/text (Hindi, Devanagari, Marathi, English)
 * into structured civic complaints.
 */
async function analyzeComplaintWithEvon({
  transcript = '',
  citizenText = '',
  visualEvidence = null,
  coordinates = null,
  language = 'hi-IN',
  correlationId = ''
}) {
  const inputText = (transcript || citizenText || '').trim();

  if (!inputText) {
    throw new Error('Input text or transcript is required for Evon reasoning');
  }

  const langConfig = getLanguageConfig(language);

  // System Prompt for structured extraction incorporating language-specific guidance
  const systemPrompt = `You are Gnani Evon 30B, the conversational intelligence engine for SwachhMap AI 2.0.
${langConfig.systemInstruction}
Your task is to parse citizen civic waste complaints (in Hindi, Devanagari, Marathi, or Indian English) and return ONLY a valid JSON object matching this schema:
{
  "summary": "Concise 1-sentence description of the problem",
  "waste_category": "plastic_waste" | "food_waste" | "paper_cardboard" | "construction_debris" | "mixed_waste" | "hazardous_waste" | "sanitation_overflow" | "other",
  "location_description": "Extracted landmark, street, or area description",
  "duration": "Duration if mentioned or 'unknown'",
  "severity": "low" | "medium" | "high" | "critical",
  "missing_information": ["list of key missing items like landmark, road name, or image"],
  "clarification_required": true | false,
  "clarification_question": "Polite clarification in citizen language if key info is missing",
  "evidence_summary": ["Key evidence points"],
  "uncertainties": ["Ambiguities or unresolved points"],
  "suggested_priority_factors": ["Factors like near school, blocking road, health hazard"]
}`;

  if (!gnaniConfig.isConfigured()) {
    const parsed = ruleBasedCivicParser(inputText, visualEvidence, coordinates, langConfig.code);
    return {
      success: true,
      source: 'offline_adapter_unconfigured',
      isLiveApi: false,
      data: validateStructuredComplaint(parsed),
      note: 'Live Evon 30B reasoning requires GNANI_API_KEY and GNANI_EVON_ENDPOINT.'
    };
  }

  try {
    const payload = {
      model: 'evon-30b',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: JSON.stringify({
            citizen_speech: inputText,
            visual_evidence: visualEvidence,
            coordinates: coordinates,
            language: langConfig.code
          })
        }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const response = await fetch(gnaniConfig.evonEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': gnaniConfig.apiKey,
        'Authorization': `Bearer ${gnaniConfig.apiKey}`,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(gnaniConfig.timeoutMs)
    });

    if (response.ok) {
      const resData = await response.json();
      const content = resData?.choices?.[0]?.message?.content || '{}';
      const jsonResult = typeof content === 'object' ? content : JSON.parse(content);
      const validatedData = validateStructuredComplaint(jsonResult);

      return {
        success: true,
        source: 'gnani_evon_api',
        isLiveApi: true,
        data: validatedData,
        correlationId
      };
    } else {
      // Scope or HTTP error -> use robust multilingual civic parser
      const parsed = ruleBasedCivicParser(inputText, visualEvidence, coordinates, langConfig.code);
      return {
        success: true,
        source: 'multilingual_civic_parser',
        isLiveApi: false,
        data: validateStructuredComplaint(parsed),
        note: `Evon endpoint returned ${response.status}. Multilingual civic parser used.`
      };
    }
  } catch (error) {
    const parsed = ruleBasedCivicParser(inputText, visualEvidence, coordinates, langConfig.code);
    return {
      success: true,
      source: 'multilingual_civic_parser',
      isLiveApi: false,
      data: validateStructuredComplaint(parsed),
      note: 'Multilingual civic parser fallback applied.'
    };
  }
}

/**
 * Robust Multilingual Civic NLP Parser (Hindi Devanagari, Marathi, English)
 */
function ruleBasedCivicParser(text, visualEvidence, coordinates, langCode = 'hi-IN') {
  // 1. Waste category detection
  let waste_category = null;
  if (/plastic|bottle|panni|thaili|polythene|प्लास्टिक|बोतल|पॉलीथीन|पन्नी|थैली|बाटली/i.test(text)) {
    waste_category = 'plastic_waste';
  } else if (/food|khana|rotten|sabzi|fruit|kitchen|खाना|सब्जी|फल|रसोई|सड़ा|भोजन|अन्न|भाजी|फळे|ओला कचरा/i.test(text)) {
    waste_category = 'food_waste';
  } else if (/malba|construction|debris|cement|eent|pathar|मलबा|सीमेंट|ईंट|पत्थर|निर्माण|दगड|विटा|बांधकाम/i.test(text)) {
    waste_category = 'construction_debris';
  } else if (/nali|drain|sewage|water|ganda pani|overflow|नाली|सीवर|गंदा पानी|नाला|गटार|सांडपाणी/i.test(text)) {
    waste_category = 'sanitation_overflow';
  } else if (/kachra|garbage|waste|kuda|dher|कचरा|कूड़ा|गंदगी|ढेर|कचरे|घाण|उकिरडा/i.test(text)) {
    waste_category = 'mixed_waste';
  }

  // 2. Duration detection (Hindi, Marathi, English)
  let duration = 'unknown';
  if (/काफी समय|बहुत समय|लंबे समय|काफी दिन|बहुत दिन|खूप दिवसांपासून|फार दिवसांपासून|काही दिवसांपासून/i.test(text)) {
    duration = langCode === 'mr-IN' ? 'खूप दिवसांपासून (Long-standing)' : 'काफी समय से (Long-standing)';
  } else if (/कुछ दिन|कुछ दिनों|थोड़े दिन|काही दिवस/i.test(text)) {
    duration = langCode === 'mr-IN' ? 'काही दिवसांपासून (Few days)' : 'कुछ दिनों से (Few days)';
  } else if (/कल से|yesterday|since yesterday|कालपासून/i.test(text)) {
    duration = langCode === 'mr-IN' ? 'कालपासून (Since yesterday)' : 'कल से (Since yesterday)';
  } else if (/आज से|today|आजपासून/i.test(text)) {
    duration = langCode === 'mr-IN' ? 'आजपासून (Today)' : 'आज से (Today)';
  } else {
    const durMatch = text.match(/(\d+|kai|kaafi|bahut|one|two|three|several|एक|दो|तीन|चार|पांच|दस|दोन|पाच|दहा)\s*(din|days|mahine|months|hafte|weeks|घंटे|दिन|हफ्ते|महीने|दिवस|आठवडे|तास)/i);
    if (durMatch) {
      duration = durMatch[0];
    } else if (/din|day|week|month|hafte|mahina|दिन|हफ्ता|महीना|दिवस|आठवडा/i.test(text)) {
      duration = text.trim();
    }
  }

  // 3. Frequency detection
  let frequency = 'regular';
  if (/रोज|रोजाना|हमेशा|हर दिन|नियमित|दररोज|नेहमी|roz|daily|every day|har din|regular|always|morning/i.test(text)) {
    frequency = 'daily';
  } else if (/कभी-कभी|कभी कभी|kabhi kabhi|occasionally|sometimes|weekly|rarely|कधीतरी|अधूनमधून/i.test(text)) {
    frequency = 'occasional';
  }

  // 4. Severity detection
  let severity = 'medium';
  if (/बहुत ज्यादा|बड़ा ढेर|रास्ता बंद|दुर्गंध|बीमारी|खतरनाक|खूप जास्त|मोठा ढीग|दुर्गंधी|त्रास|bahut|huge|massive|road block|block|severe|critical|durgandh|smell/i.test(text)) {
    severity = 'high';
  } else if (/थोड़ा|कम|हल्का|कमी|थोडा|chhota|thoda|small|light/i.test(text)) {
    severity = 'low';
  }

  // 5. Landmark / location description
  let location_description = '';
  const landmarkMatch = text.match(/(near|paas|opposite|samne|ke samne|road|market|school|hospital|park|mandir|temple|चौक|पास|सामने|सड़क|मार्केट|स्कूल|अस्पताल|मंदिर|पार्क|जवळ|समोर|रस्ता|बाजार|शाळा|दवाखाना)\s+([^,.]+)/i);
  if (landmarkMatch) {
    location_description = landmarkMatch[0].trim();
  }

  const missing_info = [];
  if (!location_description && (!coordinates || !coordinates.lat)) {
    missing_info.push('exact landmark or GPS location');
  }

  const clarification_required = missing_info.length > 0;
  let clarification_question = '';
  if (clarification_required) {
    clarification_question = langCode === 'mr-IN'
      ? 'कृपया जवळची एखादी खूण किंवा रस्त्याचे नाव सांगा जेणेकरून जागेची पुष्टी करता येईल?'
      : (langCode === 'en-IN'
        ? 'Could you please name a nearby landmark or street to help locate the waste spot?'
        : 'कृपया पास का कोई लैंडमार्क या सड़क का नाम बताएं ताकि स्थान की पुष्टि की जा सके?');
  }

  return {
    summary: text.length > 100 ? `${text.substring(0, 97)}...` : text,
    waste_category,
    location_description: location_description || (coordinates ? 'GPS coordinates supplied' : 'Location not specified'),
    duration,
    frequency,
    severity,
    missing_information: missing_info,
    clarification_required,
    clarification_question,
    evidence_summary: [
      `Report text: "${text.substring(0, 60)}..."`,
      visualEvidence ? `Visual tags: ${JSON.stringify(visualEvidence)}` : 'No visual evidence attached yet'
    ],
    uncertainties: missing_info.length > 0 ? ['Specific street landmark unverified in speech'] : [],
    suggested_priority_factors: severity === 'high' ? ['High accumulation volume mentioned'] : []
  };
}


/**
 * Generic Evon JSON call (used by the dialogue engine). Returns { ok, data } — never throws, never invents data.
 */
async function callEvonJSON(systemPrompt, userPayload, correlationId = '') {
  if (!gnaniConfig.isConfigured()) return { ok: false, reason: 'not_configured' };
  try {
    const response = await fetch(gnaniConfig.evonEndpoint, {
      method: 'POST',
      headers: {
        'X-API-Key-ID': gnaniConfig.apiKey,
        'Authorization': `Bearer ${gnaniConfig.apiKey}`,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId
      },
      body: JSON.stringify({
        model: 'evon-30b',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: JSON.stringify(userPayload) }],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(gnaniConfig.timeoutMs)
    });
    if (!response.ok) return { ok: false, reason: `http_${response.status}` };
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    const data = typeof content === 'object' ? content : JSON.parse(String(content || '{}').replace(/```json|```/g, '').trim());
    return { ok: true, data };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? 'timeout' : 'error' };
  }
}

module.exports = {
  callEvonJSON,
  analyzeComplaintWithEvon,
  ruleBasedCivicParser
};
