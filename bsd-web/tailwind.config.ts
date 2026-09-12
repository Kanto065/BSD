import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#0f766e",
          light: "#14b8a6",
        },
        accent: {
          DEFAULT: "#ea580c",
        },
      },
    },
  },
  plugins: [],
};

export default config;
