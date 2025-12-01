/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./contexts/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./App.tsx",
    "./index.tsx",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#121212',
        'surface-hover': '#1e1e1e',
        foreground: '#ffffff',
        muted: '#a3a3a3',
        primary: '#ffd208',
        'primary-hover': '#e6bd00',
        'primary-dark': '#b39200',
        border: '#333333',
        'border-hover': '#ffd208',
        success: '#4ade80',
        warning: '#fb923c',
        error: '#f87171',
        info: '#60a5fa',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
      },
      boxShadow: {
        'neo': '5px 5px 0px 0px #ffd208',
        'neo-sm': '3px 3px 0px 0px #ffd208',
        'neo-white': '5px 5px 0px 0px #ffffff',
        'neo-hover': '2px 2px 0px 0px #ffd208',
      }
    }
  },
  plugins: [],
}
