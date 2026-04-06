const path = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  // Sempre assoluti da questa cartella: `next build` può avere cwd = root monorepo.
  content: [
    path.join(__dirname, "app/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "components/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "core/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(__dirname, "lib/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {
      colors: {
        empathy: {
          violet: "var(--empathy-violet)",
          "violet-bright": "var(--empathy-violet-bright)",
          "violet-deep": "var(--empathy-violet-deep)",
          "violet-soft": "var(--empathy-violet-soft)",
          "violet-muted": "var(--empathy-violet-muted)",
          pink: "var(--empathy-pink)",
          "pink-hot": "var(--empathy-pink-hot)",
          orange: "var(--empathy-orange)",
          "orange-bright": "var(--empathy-orange-bright)",
          void: "var(--empathy-void)",
          canvas: "var(--empathy-canvas)",
          "canvas-mid": "var(--empathy-canvas-mid)",
          elevated: "var(--empathy-elevated)",
          surface: "var(--empathy-surface)",
          "surface-solid": "var(--empathy-surface-solid)",
          border: "var(--empathy-border)",
          "border-hot": "var(--empathy-border-hot)",
          "border-orange": "var(--empathy-border-orange)",
          text: "var(--empathy-text)",
          muted: "var(--empathy-text-muted)",
          dim: "var(--empathy-text-dim)",
          sidebar: "var(--empathy-sidebar)",
        },
      },
      borderRadius: {
        empathy: "var(--empathy-radius)",
        "empathy-sm": "var(--empathy-radius-sm)",
      },
      boxShadow: {
        empathy: "var(--empathy-shadow-md)",
        "empathy-sm": "var(--empathy-shadow-sm)",
        glow: "var(--empathy-shadow-glow)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        "empathy-scan": {
          "0%": { backgroundPosition: "0% 0%" },
          "100%": { backgroundPosition: "200% 0%" },
        },
        "empathy-glow-pulse": {
          "0%, 100%": { opacity: "0.55" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "empathy-scan": "empathy-scan 8s linear infinite",
        "empathy-glow-pulse": "empathy-glow-pulse 3.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
