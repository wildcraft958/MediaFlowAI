/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-base':        '#0a0a0a',
        'bg-card':        '#111111',
        'bg-card-hover':  '#1a1a1a',
        'border-1':       '#1f1f1f',
        'border-2':       '#2a2a2a',
        'accent':         '#e63946',
        'accent-hover':   '#c62828',
        'accent-soft':    '#ff8fa3',
        'text-primary':   '#ffffff',
        'text-secondary': '#a0a0a0',
        'text-muted':     '#555555',
        success:          '#4caf50',
        warning:          '#ff9800',
        info:             '#2196f3',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 24px rgba(0,0,0,0.4)',
        'card-lg': '0 8px 40px rgba(0,0,0,0.6)',
        accent: '0 0 24px rgba(230,57,70,0.3)',
      },
      borderRadius: {
        card:   '16px',
        badge:  '8px',
        button: '10px',
      },
      animation: {
        'count-up': 'countUp 0.8s ease-out forwards',
        'fade-in':  'fadeIn 0.3s ease-out forwards',
        'slide-in': 'slideIn 0.3s ease-out forwards',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        countUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.6' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-top': 'radial-gradient(ellipse 80% 40% at 50% -20%, rgba(230,57,70,0.15), transparent)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
