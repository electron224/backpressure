// apps/web/components/voice-controls.tsx
"use client";

import { useEffect, useRef, useState } from "react";

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

// Dictates into a callback. Final results only: interim chatter would make
// the transcript jump. One tap starts, a second tap stops.
export function DictateButton({ onText, label }: { onText: (text: string) => void; label: string }): JSX.Element {
  const [listening, setListening] = useState<boolean>(false);
  const [note, setNote] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const ctor = recognitionCtor();

  useEffect(() => {
    if (recognitionRef.current !== null) recognitionRef.current.abort();
  }, []);

  if (ctor === null) {
    return (
      <p className="font-mono text-sm text-smoke" role="note">
        Dictation needs a browser with the Web Speech API (Chrome/Edge).
      </p>
    );
  }
  const Ctor = ctor;

  function toggle(): void {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const parts: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result === undefined || !result.isFinal) continue;
        const transcript = result[0]?.transcript;
        if (transcript !== undefined) parts.push(transcript);
      }
      if (parts.length > 0) onText(parts.join(" "));
    };
    recognition.onerror = (event) => {
      setNote(event.error === "not-allowed" ? "Microphone blocked: allow it in the browser bar, then try again." : `Dictation error: ${event.error}`);
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setNote(null);
  }

  return (
    <span>
      <button type="button" className="border border-ink px-3 py-1.5 min-h-[44px] text-sm" onClick={toggle}>
        {listening ? "Stop dictation" : label}
      </button>
      {listening && <span className="ml-2 font-mono text-sm text-ember" aria-live="polite">listening…</span>}
      {note !== null && (
        <span className="ml-2 font-mono text-sm text-ember" role="alert">
          {note}
        </span>
      )}
    </span>
  );
}

// Reads the given text with the browser's speech synthesis. Cancel-safe on
// unmount. No API involved: the words are already on the page.
export function ReadAloudButton({ text, label }: { text: string; label: string }): JSX.Element {
  const [speaking, setSpeaking] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return <p className="font-mono text-sm text-smoke" role="note">
      Speech synthesis unavailable in this browser.
    </p>;
  }

  function speak(): void {
    const synthesis = window.speechSynthesis;
    synthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synthesis.speak(utterance);
  }

  function stop(): void {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  return (
    <button
      type="button"
      className="border border-ink px-3 py-1.5 min-h-[44px] text-sm"
      onClick={speaking ? stop : speak}
      aria-pressed={speaking}
    >
      {speaking ? "Stop reading" : label}
    </button>
  );
}
