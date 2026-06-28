/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'phish-dark': '#0f172a',
        'phish-card': '#1e293b',
        'phish-accent': '#3b82f6',
        'phish-safe': '#22c55e',
        'phish-danger': '#ef4444',
      },
    },
  },
  plugins: [],
}
