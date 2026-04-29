import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UseSpeechReturn {
  isListening: boolean;
  isSpeaking: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  transcript: string;
  resetTranscript: () => void;
}

export function useSpeech(): UseSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check support
    if (!window.speechSynthesis) {
      setSupported(false);
    } else {
      // Pre-load voices (Chrome loads them async)
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = "";
        let interimTrans = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTrans += event.results[i][0].transcript;
          } else {
            interimTrans += event.results[i][0].transcript;
          }
        }
        
        if (finalTrans) {
          setTranscript((prev) => (prev ? prev + " " + finalTrans : finalTrans).trim());
        }
        setInterimTranscript(interimTrans);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        if (event.error !== "no-speech") {
          toast.error(`Microphone error: ${event.error}`);
        }
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error("Your browser does not support Speech Recognition. Please try Google Chrome or Microsoft Edge.");
      return;
    }
    try {
      // Clear previous transcript when starting new session
      setTranscript("");
      setInterimTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      if (err.name === 'InvalidStateError') {
        // Already started, ignore
        return;
      }
      console.error("Speech start error:", err);
      toast.error("Could not start microphone. Check permissions.");
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean up markdown/URLs before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, " code block ") // Replace code blocks
      .replace(/[#*`_\[\]()]/g, "") // Remove markdown symbols
      .replace(/https?:\/\/[^\s]+/g, "link") // Replace URLs
      .replace(/\n{2,}/g, ". ") // Double newlines become pauses
      .replace(/\n/g, ", ") // Single newlines become short pauses
      .replace(/\s{2,}/g, " ") // Collapse whitespace
      .trim();

    if (!cleanText) return;

    // Pick the best natural-sounding English voice
    const pickVoice = (): SpeechSynthesisVoice | null => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return null;

      const enVoices = voices.filter(v => v.lang.startsWith("en"));
      if (!enVoices.length) return null;

      // Priority keywords for natural/premium voices (ordered by preference)
      const priority = [
        "Google UK English Female",
        "Google US English",
        "Microsoft Zira",
        "Microsoft Jenny",
        "Samantha",
        "Karen",
        "Natural",
        "Enhanced",
        "Premium",
        "Google",
      ];

      for (const keyword of priority) {
        const match = enVoices.find(v => v.name.includes(keyword));
        if (match) return match;
      }

      // Fallback: prefer any non-local voice (usually better quality)
      return enVoices.find(v => !v.localService) || enVoices[0];
    };

    // Split into sentences for more natural pacing
    const sentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .filter(s => s.trim().length > 0);

    const voice = pickVoice();

    sentences.forEach((sentence, i) => {
      const utterance = new SpeechSynthesisUtterance(sentence.trim());
      utterance.lang = "en-US";
      utterance.rate = 0.95; // Slightly slower for clarity
      utterance.pitch = 1.05; // Slightly higher for warmth
      utterance.volume = 1.0;

      if (voice) utterance.voice = voice;

      if (i === 0) {
        utterance.onstart = () => setIsSpeaking(true);
      }
      if (i === sentences.length - 1) {
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
      }

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isListening,
    isSpeaking,
    supported,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    transcript: transcript + (interimTranscript ? " " + interimTranscript : ""),
    resetTranscript,
  };
}
