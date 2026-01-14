/**
 * Voice Input Hook
 *
 * Provides speech-to-text functionality for voice commands in the Fluid Session.
 * Uses expo-speech-recognition for native speech recognition.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export interface UseVoiceInputReturn {
  /** Whether currently listening for speech */
  isListening: boolean;
  /** Current transcript (may be partial) */
  transcript: string;
  /** Final transcript after speech ends */
  finalTranscript: string;
  /** Whether we have microphone permission */
  hasPermission: boolean | null;
  /** Any error that occurred */
  error: string | null;
  /** Start listening for speech */
  startListening: () => Promise<void>;
  /** Stop listening */
  stopListening: () => void;
  /** Clear the transcript */
  clearTranscript: () => void;
  /** Request microphone permission */
  requestPermission: () => Promise<boolean>;
}

export function useVoiceInput(): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track if we're mounted to avoid state updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    checkPermission();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check initial permission status
  const checkPermission = async () => {
    try {
      const status = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (mountedRef.current) {
        setHasPermission(status.granted);
      }
    } catch (e) {
      console.log('Error checking speech permission:', e);
    }
  };

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const status = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (mountedRef.current) {
        setHasPermission(status.granted);
      }
      return status.granted;
    } catch (e) {
      console.error('Error requesting speech permission:', e);
      return false;
    }
  }, []);

  // Handle speech recognition events
  useSpeechRecognitionEvent('start', () => {
    if (mountedRef.current) {
      setIsListening(true);
      setError(null);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (mountedRef.current) {
      setIsListening(false);
    }
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!mountedRef.current) return;

    const results = event.results;
    if (results && results.length > 0) {
      const lastResult = results[results.length - 1];
      const text = lastResult?.transcript || '';

      // isFinal is on the event, not individual results
      if (event.isFinal) {
        setFinalTranscript(text);
        setTranscript(text);
      } else {
        setTranscript(text);
      }
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (mountedRef.current) {
      console.error('Speech recognition error:', event.error);
      setError(event.error || 'Speech recognition failed');
      setIsListening(false);
    }
  });

  // Start listening
  const startListening = useCallback(async () => {
    try {
      // Check/request permission first
      if (!hasPermission) {
        const granted = await requestPermission();
        if (!granted) {
          setError('Microphone permission denied');
          return;
        }
      }

      // Clear previous transcript
      setTranscript('');
      setFinalTranscript('');
      setError(null);

      // Start recognition
      await ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        maxAlternatives: 1,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
        contextualStrings: [
          // Workout-related words for better recognition
          'reps',
          'sets',
          'weight',
          'pounds',
          'kilos',
          'RPE',
          'too easy',
          'too hard',
          'perfect',
          'fatigue',
          'add set',
          'skip',
          'done',
          'next exercise',
          'rest',
        ],
      });
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
      if (mountedRef.current) {
        setError('Failed to start speech recognition');
      }
    }
  }, [hasPermission, requestPermission]);

  // Stop listening
  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      console.error('Failed to stop speech recognition:', e);
    }
  }, []);

  // Clear transcript
  const clearTranscript = useCallback(() => {
    setTranscript('');
    setFinalTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    finalTranscript,
    hasPermission,
    error,
    startListening,
    stopListening,
    clearTranscript,
    requestPermission,
  };
}

/**
 * Check if speech recognition is available on this device
 */
export async function isSpeechRecognitionAvailable(): Promise<boolean> {
  // Web doesn't support expo-speech-recognition
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const status = await ExpoSpeechRecognitionModule.getStateAsync();
    return status !== 'inactive';
  } catch {
    return false;
  }
}
