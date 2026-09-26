// apps/web/components/assistant-sidebar.tsx
"use client";

import { useState } from "react";
import { usePageContext } from "./assistant-store";

interface Message {
  role: "user" | "assistant";
  text: string;
}

interface SessionKeys {
  provider: "anthropic" | "openai" | "google";
  apiKey: string;
  baseUrl: string;
  model: string;
}

export function AssistantSidebar(): JSX.Element {
  const [open, setOpen] = useState<boolean>(false);
  const [tab, setTab] = useState<"ask" | "settings">("ask");
  const [question, setQuestion] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [keys, setKeys] = useState<SessionKeys>({ provider: "openai", apiKey: "", baseUrl: "", model: "" });
  const page = usePageContext();

  async function ask(): Promise<void> {
    const trimmed = question.trim();
    if (trimmed.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    const next = [...messages, { role: "user" as const, text: trimmed }];
    setMessages(next);
    setQuestion("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: "ask",
          question: trimmed,
          page: page ?? { kind: "unknown", slug: "unknown", title: "unknown", summary: "" },
          history: next.slice(-6),
          attemptId: "assistant-sidebar",
          provider: keys.provider,
          apiKey: keys.apiKey.length > 0 ? keys.apiKey : undefined,
          baseUrl: keys.baseUrl.length > 0 ? keys.baseUrl : undefined,
          model: keys.model.length > 0 ? keys.model : undefined,
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        setError(typeof body === "object" && body !== null && "error" in body ? String((body as { error: unknown }).error) : "assistant request failed");
        return;
      }
      const answer: unknown = (body as { answer?: unknown }).answer;
      if (typeof answer === "object" && answer !== null && typeof (answer as { answer?: unknown }).answer === "string") {
        const record = answer as { answer: string; followUps?: unknown };
        const followUps = Array.isArray(record.followUps)
          ? record.followUps.filter((f): f is string => typeof f === "string")
          : [];
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: record.answer + (followUps.length > 0 ? `\nTry next: ${followUps.join(" / ")}` : "") },
        ]);
      } else {
        setError("assistant returned an unshaped response");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-4 right-4 z-50 border border-ember bg-ember px-4 py-2 text-paper"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Open assistant"}
      >
        Ask
      </button>
      {open && (
        <aside
          aria-label="Assistant"
          className="fixed bottom-16 right-4 top-16 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col border border-ink/20 bg-paper"
        >
          <div className="flex border-b border-ink/20" role="tablist" aria-label="Assistant tabs">
            {(["ask", "settings"] as const).map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={`px-3 py-2 font-mono text-sm ${tab === name ? "font-bold text-ember" : "text-smoke"}`}
                onClick={() => setTab(name)}
              >
                {name === "ask" ? "Ask" : "Keys"}
              </button>
            ))}
            {page !== null && <span className="ml-auto px-3 py-2 font-mono text-xs text-smoke">on: {page.slug}</span>}
          </div>
          {tab === "ask" ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3" aria-live="polite">
                {messages.length === 0 && (
                  <li className="text-sm text-smoke">
                    Stuck on a term or a number? Ask here — answers use this page for context.
                  </li>
                )}
                {messages.map((message, i) => (
                  <li key={i} className={message.role === "user" ? "font-bold" : ""}>
                    <span className="font-mono text-xs text-smoke">{message.role === "user" ? "you" : "coach"}: </span>
                    <span className="text-sm leading-relaxed">{message.text}</span>
                  </li>
                ))}
              </ul>
              {error !== null && <p className="px-3 font-bold text-ember">{error}</p>}
              <div className="border-t border-ink/20 p-3">
                <label className="block text-sm">
                  Question
                  <textarea
                    className="mt-1 block w-full border border-ink/30 bg-paper p-2 text-sm"
                    rows={3}
                    value={question}
                    onChange={(e) => setQuestion(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void ask();
                      }
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="mt-2 border border-ember bg-ember px-3 py-1.5 text-paper disabled:opacity-50"
                  disabled={loading || question.trim().length === 0}
                  onClick={() => void ask()}
                >
                  {loading ? "Asking…" : "Ask"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-3 text-sm">
              <p className="leading-relaxed">
                Your key lives in this tab only: sent with each question, used server-side, never stored. Close the
                tab and it is gone.
              </p>
              <label className="block">
                Provider
                <select
                  className="mt-1 block w-full border border-ink/30 bg-paper p-2"
                  value={keys.provider}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setKeys((prev) => ({
                      ...prev,
                      provider: value === "google" || value === "anthropic" ? value : "openai",
                    }));
                  }}
                >
                  <option value="openai">OpenAI / compatible</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google Gemini</option>
                </select>
              </label>
              <label className="block">
                API key
                <input
                  className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
                  type="password"
                  autoComplete="off"
                  value={keys.apiKey}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setKeys((prev) => ({ ...prev, apiKey: value }));
                  }}
                />
              </label>
              <label className="block">
                Base URL <span className="text-smoke">(OpenAI-compatible only, blank for default)</span>
                <input
                  className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
                  type="text"
                  inputMode="url"
                  placeholder="https://api.openai.com/v1"
                  value={keys.baseUrl}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setKeys((prev) => ({ ...prev, baseUrl: value }));
                  }}
                />
              </label>
              <label className="block">
                Model <span className="text-smoke">(blank for provider default)</span>
                <input
                  className="mt-1 block w-full border border-ink/30 bg-paper p-2 font-mono text-sm"
                  type="text"
                  value={keys.model}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setKeys((prev) => ({ ...prev, model: value }));
                  }}
                />
              </label>
              <p className="font-mono text-xs text-smoke">
                {keys.apiKey.length > 0 ? `key present for ${keys.provider} (this tab only)` : "no key: answers fall back to deterministic guidance"}
              </p>
            </div>
          )}
        </aside>
      )}
    </>
  );
}
