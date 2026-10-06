import type { Config } from "tailwindcss";

// Brand colours are averaged from solid regions of the client's logo
// (WhatsApp Image 2026-09-14 at 10.56.07 PM.jpeg). The v1 orange accent is dropped.
// brand.teal is too light for small text on white (about 3.3:1), so links and small
// text use brand.teal-dark (about 5.2:1, passes AA).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  // Hover styles apply only on devices that can hover, so they do not stick after a tap on phones.
  future: { hoverOnlyWhenSupported: true },
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
        // Client package palette, separate from brand. Only bc-bar is used so far.
        bc: {
          shell: "#0F172A",
          bar: "#005A8C",
          teal: "#0D9488",
          amber: "#D97706",
          green: "#16A34A",
          canvas: "#F8FAFC",
        },
      },
      keyframes: {
        rise: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        // Small state changes: opacity plus a few px of travel, always used under motion-safe.
        "menu-in": { from: { opacity: "0", transform: "translateY(-6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "swap-in": { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        rise: "rise 300ms cubic-bezier(0.16, 1, 0.3, 1) backwards",
        "menu-in": "menu-in 180ms cubic-bezier(0.23, 1, 0.32, 1) backwards",
        "swap-in": "swap-in 200ms cubic-bezier(0.23, 1, 0.32, 1) backwards",
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
