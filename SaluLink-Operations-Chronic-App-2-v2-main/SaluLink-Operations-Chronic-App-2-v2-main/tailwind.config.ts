import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // SaluLink brand blue — #38b6ff is the exact logo colour
        primary: {
          50:  '#eff9ff',
          100: '#dff2ff',
          200: '#b8e7ff',
          300: '#78d5ff',
          400: '#38b6ff',
          500: '#0d9de8',
          600: '#007ec6',
          700: '#00649e',
          800: '#004f7c',
          900: '#003d5e',
        },
        // Authi brand purple — violet-purple orb palette
        accent: {
          50:  '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        // SaluLink black (logo wordmark)
        brand: {
          black: '#000000',
          blue:  '#38b6ff',
        },
      },
    },
  },
  plugins: [],
};

export default config;

