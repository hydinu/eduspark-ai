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

    // Clean up markdown before speaking
    const cleanText = text
      .replace(/[#*`_\[\]]/g, "") // Remove common markdown symbols
      .replace(/https?:\/\/[^\s]+/g, "link") // Replace URLs with "link"
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = "en-US";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try to find a good English voice
    let voices = window.speechSynthesis.getVoices();
    const findVoice = (vList: SpeechSynthesisVoice[]) => 
      vList.find(v => v.lang.startsWith("en-") && (v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Natural")));
    
    let voice = findVoice(voices);
    if (voice) {
      utterance.voice = voice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log("Speaking started:", cleanText.slice(0, 30) + "...");
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("TTS Error:", e);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
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
