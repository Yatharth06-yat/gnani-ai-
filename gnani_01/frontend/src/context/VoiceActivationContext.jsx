import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import WakeWordDetector from '../services/wakeWord/wakeWordEngine';
import soundEffects from '../services/wakeWord/audioBeep';
import { toast } from 'react-toastify';

const VoiceActivationContext = createContext();

export const VoiceActivationProvider = ({ children }) => {
  const [wakeWordEnabled, setWakeWordEnabled] = useState(() => {
    return localStorage.getItem('swachh_wakeword_enabled') === 'true';
  });
  const [detectorStatus, setDetectorStatus] = useState('stopped'); // 'stopped' | 'listening' | 'paused' | 'permission_denied' | 'error'
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isSupported, setIsSupported] = useState(true);

  const detectorRef = useRef(null);

  // Initialize WakeWordDetector singleton
  useEffect(() => {
    const detector = new WakeWordDetector({
      lang: 'en-IN',
      onWake: ({ transcript, command }) => {
        console.log('🎙️ [WakeWord] Activated via phrase:', transcript, '| Command:', command);
        if (soundEnabled) soundEffects.playWakeTone();
        setPendingCommand(command || null);
        setAssistantOpen(true);
      },
      onStatusChange: (status) => {
        setDetectorStatus(status);
      },
      onError: (err) => {
        if (err.type === 'PERMISSION_DENIED') {
          toast.warn('🎙️ Microphone access was not granted. Voice wake-word is disabled.');
          setWakeWordEnabled(false);
          localStorage.setItem('swachh_wakeword_enabled', 'false');
        } else if (err.type === 'UNSUPPORTED_BROWSER') {
          setIsSupported(false);
        }
      }
    });

    detectorRef.current = detector;
    setIsSupported(detector.isSupported());

    if (wakeWordEnabled && detector.isSupported()) {
      detector.start();
    }

    return () => {
      detector.stop();
    };
  }, []); // eslint-disable-line

  // Handle user toggling wake word on/off
  const toggleWakeWord = useCallback((enable) => {
    const nextState = typeof enable === 'boolean' ? enable : !wakeWordEnabled;
    setWakeWordEnabled(nextState);
    localStorage.setItem('swachh_wakeword_enabled', String(nextState));

    if (!detectorRef.current) return;

    if (nextState) {
      const ok = detectorRef.current.start();
      if (ok) {
        toast.info('🎙️ Voice activation ON: Say "Hey Swachh Saathi" anytime.');
      }
    } else {
      detectorRef.current.stop();
      toast.info('Voice activation turned OFF.');
    }
  }, [wakeWordEnabled]);

  // Pause detector when assistant modal is open to release microphone for Prisma STT
  const pauseWakeWord = useCallback(() => {
    if (detectorRef.current && wakeWordEnabled) {
      detectorRef.current.pause();
    }
  }, [wakeWordEnabled]);

  // Resume detector after assistant conversation completes or closes
  const resumeWakeWord = useCallback(() => {
    if (detectorRef.current && wakeWordEnabled) {
      detectorRef.current.resume();
    }
  }, [wakeWordEnabled]);

  // Open assistant manually (e.g., from UI button)
  const openAssistant = useCallback((initialCommand = null) => {
    pauseWakeWord();
    setPendingCommand(initialCommand);
    setAssistantOpen(true);
  }, [pauseWakeWord]);

  // Close assistant and return safely to standby
  const closeAssistant = useCallback(() => {
    setAssistantOpen(false);
    setPendingCommand(null);
    if (soundEnabled) soundEffects.playDismissTone();
    resumeWakeWord();
  }, [resumeWakeWord, soundEnabled]);

  return (
    <VoiceActivationContext.Provider
      value={{
        wakeWordEnabled,
        toggleWakeWord,
        detectorStatus,
        isSupported,
        assistantOpen,
        openAssistant,
        closeAssistant,
        pendingCommand,
        setPendingCommand,
        soundEnabled,
        setSoundEnabled,
        pauseWakeWord,
        resumeWakeWord
      }}
    >
      {children}
    </VoiceActivationContext.Provider>
  );
};

export const useVoiceActivation = () => {
  const ctx = useContext(VoiceActivationContext);
  if (!ctx) {
    throw new Error('useVoiceActivation must be used within a VoiceActivationProvider');
  }
  return ctx;
};

