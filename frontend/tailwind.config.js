/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sidebar
        sidebar: {
          bg:     '#0f172a',
          active: '#1e3a5f',
          hover:  'rgba(255,255,255,0.08)',
          text:   '#94a3b8',
          'active-text': '#ffffff',
        },
        // Main layout
        main: {
          bg:     '#f8fafc',
        },
        // Card
        card: {
          bg:     '#ffffff',
          border: '#e2e8f0',
        },
        // Brand / Primary
        primary: {
          DEFAULT: '#1e3a5f',
          hover:   '#0f172a',
        },
        // Text
        text: {
          primary:   '#0f172a',
          secondary: '#475569',
          muted:     '#94a3b8',
        },
        // Status
        status: {
          green: '#16a34a',
          red:   '#dc2626',
          amber: '#d97706',
        },
        // Navy shades (utility)
        navy: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          200: '#c2d3ff',
          300: '#93b0ff',
          400: '#6080ff',
          500: '#3a54f5',
          600: '#2030ea',
          700: '#1e3a5f',
          800: '#172d4d',
          900: '#0f172a',
          950: '#080e1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        xs:   ['0.75rem',  { lineHeight: '1rem' }],
        sm:   ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem',     { lineHeight: '1.5rem' }],
        lg:   ['1.125rem', { lineHeight: '1.75rem' }],
        xl:   ['1.25rem',  { lineHeight: '1.75rem' }],
        '2xl':['1.5rem',   { lineHeight: '2rem' }],
        '3xl':['1.875rem', { lineHeight: '2.25rem' }],
        '4xl':['2.25rem',  { lineHeight: '2.5rem' }],
      },
      borderRadius: {
        sm:  '0.375rem',
        DEFAULT: '0.5rem',
        md:  '0.625rem',
        lg:  '0.75rem',
        xl:  '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card:   '0 1px 3px 0 rgba(0,0,0,0.08), 0 1px 2px -1px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10), 0 2px 4px -2px rgba(0,0,0,0.06)',
        modal:  '0 20px 60px -10px rgba(0,0,0,0.30)',
        input:  '0 0 0 3px rgba(30,58,95,0.15)',
      },
      keyframes: {
        // Page transition
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        // Skeleton shimmer
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        // Toast slide-in from top-right
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        // Modal entrance
        'modal-in': {
          '0%':   { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Number counter pulse
        'counter-in': {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up':        'fade-up 200ms ease-out both',
        'shimmer':        'shimmer 1.6s linear infinite',
        'slide-in-right': 'slide-in-right 300ms ease-out both',
        'modal-in':       'modal-in 150ms ease-out both',
        'counter-in':     'counter-in 800ms ease-out both',
      },
      transitionTimingFunction: {
        'ease-out-smooth': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
