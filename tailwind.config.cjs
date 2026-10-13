/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`
module.exports = {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'Segoe UI', 'system-ui', 'sans-serif']
      },
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        'surface-2': v('surface-2'),
        'surface-3': v('surface-3'),
        border: v('border'),
        text: v('text'),
        muted: v('muted'),
        subtle: v('subtle'),
        accent: v('accent'),
        'accent-2': v('accent-2'),
        'on-accent': v('on-accent'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info')
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem'
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.05)',
        glow: 'none'
      },
      keyframes: {
        'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } },
        'scale-in': { from: { opacity: 0, transform: 'scale(.97)' }, to: { opacity: 1, transform: 'none' } }
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        'scale-in': 'scale-in .18s ease-out both'
      }
    }
  },
  plugins: []
}
