"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = "idle" | "recording" | "error";

interface UseVoiceInputReturn {
  supported: boolean;
  state: VoiceState;
  transcript: string;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySpeechRecognition = any;

export function useVoiceInput(onFinal?: (text: string) => void): UseVoiceInputReturn {
  const [supported, setSupported] = useState(false);
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<AnySpeechRecognition | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    setSupported(!!(w.SpeechRecognition ?? w.webkitSpeechRecognition));
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  const start = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: AnySpeechRecognition = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onstart = () => setState("recording");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final && onFinal) onFinal(final);
    };

    rec.onerror = () => {
      setState("error");
      recognitionRef.current = null;
    };

    rec.onend = () => {
      setState("idle");
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    rec.start();
  }, [onFinal]);

  const reset = useCallback(() => {
    setTranscript("");
    setState("idle");
  }, []);

  return { supported, state, transcript, start, stop, reset };
}
