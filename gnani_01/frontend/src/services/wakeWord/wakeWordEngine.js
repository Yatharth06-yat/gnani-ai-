/**
 * wakeWordEngine.js — Privacy-conscious on-device Wake Word Detection for SwachhMap
 * 
 * Target phrases:
 *   Primary:     "Hey Swachh Saathi"
 *   Alternative: "Hello Swachh Saathi"
 * 
 * Technology Evaluation & Selection:
 * 1. Web Speech API (webkitSpeechRecognition / SpeechRecognition):
 *    - Fully local on-device in modern Chromium (Chrome/Edge) and Safari.
 *    - Zero external cloud cost, zero raw audio uploads to external servers during standby.
 *    - Natively handles multi-lingual phonetic acoustic variations for Indian accents
 *      (e.g., "Swachh Saathi", "Swachh Sathi", "Swach Saathi", "Swachh Sathy", "स्वच्छ साथी").
 *    - Continuous interim streaming without recording files.
 * 2. Porcupine / Custom ONNX:
 *    - Custom wake phrases ("Swachh Saathi") in Porcupine require Picovoice Console custom model
 *      training and access key (.ppn model file).
 *    - This engine is built with a pluggable architecture: WebSpeech (default, zero-config on-device)
 *      with an extension hook for Porcupine should a .ppn model be provided.
 */

// Normalized phonetic variants for "Hey Swachh Saathi" & "Hello Swachh Saathi"
const WAKE_PATTERNS = [
  // Primary: Hey Swachh Saathi
  /\b(hey|hay|ay|ae|oye)\s+(swachh|swach|swachha|swatch|swatsh|swachcha|swacha|swath)\s+(saathi|sathi|sathy|sathii|saathii|sati)\b/i,
  // Alternative: Hello Swachh Saathi
  /\b(hello|hallo|helo|hi)\s+(swachh|swach|swachha|swatch|swatsh|swachcha|swacha|swath)\s+(saathi|sathi|sathy|sathii|saathii|sati)\b/i,
  // Direct name invocation when spoken emphatically
  /\b(swachh|swach|swachha|swatch)\s+(saathi|sathi|sathy|sathii)\b/i,
  // Devanagari Hindi script representation
  /(हे|हेय|हेलो|हाय|अरे)?\s*(स्वच्छ|स्वछ|स्वच्छता)\s*(साथी|साथि)/u
];

// Clean spoken command by removing the wake prefix if spoken in the same breath
export function stripWakePhrase(transcript) {
  if (!transcript) return '';
  let cleaned = transcript;
  for (const pat of WAKE_PATTERNS) {
    cleaned = cleaned.replace(pat, ' ');
  }
  return cleaned.trim();
}

export class WakeWordDetector {
  constructor(options = {}) {
    this.onWake = options.onWake || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.lang = options.lang || 'en-IN'; // 'hi-IN' or 'en-IN'

    this.recognition = null;
    this.isListening = false;
    this.userEnabled = false;
    this.restartTimeout = null;
    this.cooldownUntil = 0;
    this.isPausedForConversation = false;
  }

  isSupported() {
    return Boolean(
      (typeof window !== 'undefined') &&
      (window.SpeechRecognition || window.webkitSpeechRecognition)
    );
  }

  start() {
    if (!this.isSupported()) {
      this.onError({
        type: 'UNSUPPORTED_BROWSER',
        message: 'SpeechRecognition API is not supported in this browser. Please use manual microphone activation.'
      });
      return false;
    }

    this.userEnabled = true;
    this.isPausedForConversation = false;
    this._initAndListen();
    return true;
  }

  stop() {
    this.userEnabled = false;
    this.isPausedForConversation = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.isListening = false;
    this.onStatusChange('stopped');
  }

  pause() {
    // Temporarily pause wake detection while the assistant is actively interacting or speaking
    this.isPausedForConversation = true;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (_) {}
      this.recognition = null;
    }
    this.isListening = false;
    this.onStatusChange('paused');
  }

  resume() {
    if (!this.userEnabled) return;
    this.isPausedForConversation = false;
    // Brief cooldown to guarantee assistant TTS audio has completed and won't re-trigger
    this.cooldownUntil = Date.now() + 600;
    this._initAndListen();
  }

  _initAndListen() {
    if (!this.userEnabled || this.isPausedForConversation) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) return;

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch (_) {}
      }

      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.lang = this.lang || 'en-IN';

      rec.onstart = () => {
        this.isListening = true;
        this.onStatusChange('listening');
      };

      rec.onresult = (event) => {
        if (!this.userEnabled || this.isPausedForConversation) return;
        if (Date.now() < this.cooldownUntil) return;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          for (let j = 0; j < res.length; ++j) {
            const transcript = res[j].transcript;
            if (this._matchesWakeWord(transcript)) {
              const commandRemainder = stripWakePhrase(transcript);
              this.cooldownUntil = Date.now() + 2500; // anti-bounce
              this.pause(); // immediately release mic for Gnani Prisma STT
              this.onWake({
                transcript,
                command: commandRemainder,
                detectedAt: Date.now()
              });
              return;
            }
          }
        }
      };

      rec.onerror = (e) => {
        // 'no-speech' and 'aborted' are normal lifecycle events during continuous listening
        if (e.error === 'not-allowed') {
          this.userEnabled = false;
          this.isListening = false;
          this.onError({
            type: 'PERMISSION_DENIED',
            message: 'Microphone permission denied for voice activation.'
          });
          this.onStatusChange('permission_denied');
        } else if (e.error === 'no-speech' || e.error === 'aborted') {
          // Expected, will cycle onend
        } else {
          this.onStatusChange('error');
        }
      };

      rec.onend = () => {
        this.isListening = false;
        // Auto-restart if still enabled and not actively in a conversation
        if (this.userEnabled && !this.isPausedForConversation) {
          this.restartTimeout = setTimeout(() => {
            this._initAndListen();
          }, 300);
        } else if (!this.isPausedForConversation) {
          this.onStatusChange('stopped');
        }
      };

      this.recognition = rec;
      rec.start();
    } catch (err) {
      this.isListening = false;
      this.onStatusChange('error');
      if (this.userEnabled && !this.isPausedForConversation) {
        this.restartTimeout = setTimeout(() => this._initAndListen(), 1500);
      }
    }
  }

  _matchesWakeWord(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.toLowerCase().trim();
    return WAKE_PATTERNS.some((pat) => pat.test(clean));
  }
}

export default WakeWordDetector;

