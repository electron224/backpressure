// apps/web/components/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";

function currentTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle(): JSX.Element {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(currentTheme());
  }, []);

  function toggle(): void {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      window.localStorage.setItem("bp:theme", next);
    } catch {
      // Private mode: theme simply does not persist.
    }
    window.dispatchEvent(new CustomEvent("bp:theme", { detail: next }));
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="border border-paper/40 px-2 py-1 font-mono text-sm"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? "light" : "dark"}
    </button>
  );
}

export function useTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(currentTheme());
    const listener = (event: Event): void => {
      const detail: unknown = (event as CustomEvent).detail;
      if (detail === "dark" || detail === "light") setTheme(detail);
    };
    window.addEventListener("bp:theme", listener);
    return () => window.removeEventListener("bp:theme", listener);
  }, []);
  return theme;
}
