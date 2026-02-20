import { useState, useRef, useCallback, useEffect } from "react";

interface UseVoiceInputReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  voiceError: string;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  resetTranscript: () => void;
}

export function useVoiceInput(
  onTranscript?: (text: string) => void
): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<any>(null);
  const manualStopRef = useRef(false);
  const finalTextRef = useRef("");
  const onTranscriptRef = useRef(onTranscript);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionCtor;

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  const createRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor) return null;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("[Voice] Recognition started");
      setIsListening(true);
      setVoiceError("");
    };

    recognition.onaudiostart = () => {
      console.log("[Voice] Audio capture started — mic is active");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript + " ";
        } else {
          interim += result[0].transcript;
        }
      }
      const full = (finalTextRef.current + interim).trim();
      setTranscript(full);
      if (onTranscriptRef.current) onTranscriptRef.current(full);
    };

    recognition.onerror = (event: any) => {
      console.warn("[Voice] Error:", event.error, event.message);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setVoiceError("Microphone access denied. Allow mic permission and try again.");
        manualStopRef.current = true;
        setIsListening(false);
      } else if (event.error === "aborted") {
        manualStopRef.current = true;
        setIsListening(false);
      } else if (event.error === "network") {
        setVoiceError("Network error — speech service unavailable. Check your internet connection.");
        manualStopRef.current = true;
        setIsListening(false);
      } else if (event.error === "no-speech") {
        console.log("[Voice] No speech detected, will auto-restart...");
      } else if (event.error === "audio-capture") {
        setVoiceError("No microphone found. Check your audio input device.");
        manualStopRef.current = true;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      console.log("[Voice] onend — manualStop:", manualStopRef.current);
      clearRestartTimer();

      if (!manualStopRef.current) {
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          if (manualStopRef.current) {
            setIsListening(false);
            return;
          }
          try {
            const fresh = new SpeechRecognitionCtor();
            fresh.continuous = true;
            fresh.interimResults = true;
            fresh.lang = "en-US";
            fresh.maxAlternatives = 1;
            fresh.onstart = recognition.onstart;
            fresh.onaudiostart = recognition.onaudiostart;
            fresh.onresult = recognition.onresult;
            fresh.onerror = recognition.onerror;
            fresh.onend = recognition.onend;
            recognitionRef.current = fresh;
            fresh.start();
          } catch (e: any) {
            console.warn("[Voice] Restart failed:", e);
            setIsListening(false);
          }
        }, 300);
      } else {
        setIsListening(false);
      }
    };

    return recognition;
  }, [SpeechRecognitionCtor, clearRestartTimer]);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setVoiceError("Speech recognition is not supported in this browser.");
      return;
    }
    if (isListening) return;

    setVoiceError("");
    manualStopRef.current = false;
    finalTextRef.current = "";
    clearRestartTimer();

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    const recognition = createRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e: any) {
      console.warn("[Voice] Start failed:", e);
      setVoiceError(`Failed to start voice: ${e.message || e}`);
      recognitionRef.current = null;
    }
  }, [SpeechRecognitionCtor, isListening, createRecognition, clearRestartTimer]);

  const stopListening = useCallback(() => {
    manualStopRef.current = true;
    clearRestartTimer();
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, [clearRestartTimer]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    finalTextRef.current = "";
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    voiceError,
    startListening,
    stopListening,
    toggleListening,
    resetTranscript,
  };
}
