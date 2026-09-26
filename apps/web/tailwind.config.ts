import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "rgb(var(--paper) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        smoke: "rgb(var(--smoke) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SF Mono", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [typography],
} satisfies Config;
