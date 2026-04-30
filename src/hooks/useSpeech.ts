import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

interface UseSpeechOptions {
  /** Called when the AI finishes speaking all queued utterances */
  onSpeechEnd?: () => void;
}

interface UseSpeechReturn {
  isListening: boolean;
  isSpeaking: boolean;
  supported: boolean;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  stopSpeaking: () => void;
  transcript: string;
  finalTranscript: string;
  resetTranscript: () => void;
}

export function useSpeech(options?: UseSpeechOptions): UseSpeechReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<any>(null);
  const wantListeningRef = useRef(false); // true when we WANT the mic on
  const onSpeechEndRef = useRef(options?.onSpeechEnd);

  // Keep callback ref fresh
  useEffect(() => {
    onSpeechEndRef.current = options?.onSpeechEnd;
  }, [options?.onSpeechEnd]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check TTS support
    if (!window.speechSynthesis) {
      setSupported(false);
    } else {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }

    // Setup Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (event: any) => {
        let final = "";
        let interim = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        if (final) {
          setFinalTranscript((prev) => (prev ? prev + " " + final : final).trim());
        }
        setInterimTranscript(interim);
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === "no-speech" || event.error === "aborted") {
          // These are benign — auto-restart if we still want to listen
          if (wantListeningRef.current) {
            setTimeout(() => {
              try {
                rec.start();
              } catch (_) {
                /* ignore */
              }
            }, 300);
          }
          return;
        }
        setIsListening(false);
        wantListeningRef.current = false;
        toast.error(`Microphone error: ${event.error}`);
      };

      rec.onend = () => {
        // Browser stopped recognition — auto-restart if we still want it on
        if (wantListeningRef.current) {
          try {
            setTimeout(() => {
              if (wantListeningRef.current) {
                rec.start();
              } else {
                setIsListening(false);
              }
            }, 200);
          } catch (_) {
            setIsListening(false);
            wantListeningRef.current = false;
          }
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = rec;
    } else {
      setSupported(false);
    }
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      toast.error(
        "Your browser does not support Speech Recognition. Please try Google Chrome or Microsoft Edge.",
      );
      return;
    }
    // Clear previous transcript when starting a new listening session
    setFinalTranscript("");
    setInterimTranscript("");
    wantListeningRef.current = true;
    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err: any) {
      if (err.name === "InvalidStateError") {
        // Already started — that's fine
        setIsListening(true);
        return;
      }
      console.error("Speech start error:", err);
      toast.error("Could not start microphone. Check permissions.");
      setIsListening(false);
      wantListeningRef.current = false;
    }
  }, []);

  const stopListening = useCallback(() => {
    wantListeningRef.current = false;
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
    } catch (_) {
      /* ignore */
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setFinalTranscript("");
    setInterimTranscript("");
  }, []);

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean up markdown/URLs before speaking
    const cleanText = text
      .replace(/```[\s\S]*?```/g, " code block ")
      .replace(/[#*`_\[\]()]/g, "")
      .replace(/https?:\/\/[^\s]+/g, "link")
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, ", ")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!cleanText) return;

    // Pick the best natural-sounding English voice
    const pickVoice = (): SpeechSynthesisVoice | null => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return null;

      const enVoices = voices.filter((v) => v.lang.startsWith("en"));
      if (!enVoices.length) return null;

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
        const match = enVoices.find((v) => v.name.includes(keyword));
        if (match) return match;
      }

      return enVoices.find((v) => !v.localService) || enVoices[0];
    };

    // Split into sentences for more natural pacing
    const sentences = cleanText.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

    const voice = pickVoice();

    sentences.forEach((sentence, i) => {
      const utterance = new SpeechSynthesisUtterance(sentence.trim());
      utterance.lang = "en-US";
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;

      if (voice) utterance.voice = voice;

      if (i === 0) {
        utterance.onstart = () => setIsSpeaking(true);
      }
      if (i === sentences.length - 1) {
        utterance.onend = () => {
          setIsSpeaking(false);
          // Fire the callback so interview.tsx can auto-start mic
          onSpeechEndRef.current?.();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          onSpeechEndRef.current?.();
        };
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
    transcript: finalTranscript + (interimTranscript ? " " + interimTranscript : ""),
    finalTranscript,
    resetTranscript,
  };
}
