import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sauna: {
          ember: "#ff7a18",
          glow: "#f8cb2e",
          midnight: "#0f172a",
          frost: "#38bdf8"
        }
      },
      fontFamily: {
        display: ["'Saira Extra Condensed'", "sans-serif"],
        body: ["'Inter'", "sans-serif"]
      },
      boxShadow: {
        neon: "0 0 40px rgba(56, 189, 248, 0.35)"
      }
    }
  },
  plugins: []
} satisfies Config;
