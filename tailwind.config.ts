import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1.25rem", lg: "2rem" }, screens: { "2xl": "1280px" } },
    extend: {
      colors: {
        cream: { 50: "#FDFBF7", 100: "#F8F4EC", 200: "#EFE8DA", 300: "#E3D8C3" },
        charcoal: { 700: "#3A3A3A", 800: "#2A2A2A", 900: "#1C1C1C", 950: "#121212" },
        wood: { 300: "#C9A27E", 400: "#B4875F", 500: "#9A6B43", 600: "#7C5433", 700: "#5E3F27" },
        bronze: { 300: "#D9BE8C", 400: "#C8A46A", 500: "#B08D57" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-manrope)", "var(--font-inter)", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 40px -12px rgba(28,28,28,0.15)",
        card: "0 2px 12px -4px rgba(28,28,28,0.08)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(16px)" }, "100%": { opacity: "1", transform: "none" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        "fade-up": "fade-up .7s ease-out both",
        "fade-in": "fade-in .5s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
