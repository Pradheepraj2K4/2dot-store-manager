/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#0F172A',
        'sidebar-hover': '#1E293B',
        'main-bg': '#F8FAFC',
        'trust-blue': '#1D4ED8',
        'trust-blue-hover': '#1E40AF',
        'credit-green': '#059669',
        'debit-red': '#E11D48',
        'pending-amber': '#F59E0B',
      },
    },
  },
  plugins: [],
};
