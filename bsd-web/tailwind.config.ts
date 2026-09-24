import type { Config } from "tailwindcss";

// Brand colours are averaged from solid regions of the client's logo
// (WhatsApp Image 2026-09-14 at 10.56.07 PM.jpeg). The v1 orange accent is dropped.
// brand.teal is too light for small text on white (about 3.3:1), so links and small
// text use brand.teal-dark (about 5.2:1, passes AA).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#0C2E42",
          blue: "#05669D",
          teal: "#219E89",
          "teal-dark": "#167A69",
          red: "#C42B26",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-montserrat)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
