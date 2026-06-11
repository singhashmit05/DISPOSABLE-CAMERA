/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        retro: {
          bg: "#F5F0E8",
          accent: "#C9A96E",
          dark: "#1A1410",
          shutter: "#C0392B",
          developing: "#3B0000",
          yellow: "#F1C40F",
        }
      },
      fontFamily: {
        handwritten: ["Caveat", "cursive"],
        mono: ["DM Mono", "monospace"],
      }
    },
  },
  plugins: [],
}
