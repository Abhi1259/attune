import type { Config } from 'tailwindcss'

/**
 * Attune design tokens.
 * Colors resolve to CSS variables set by the theme system on <html>
 * (--att-accent is set at runtime from album-art dominant color).
 */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      colors: {
        base: 'var(--att-base)',
        surface: 'var(--att-surface)',
        elevated: 'var(--att-elevated)',
        line: 'var(--att-line)',
        ink: 'var(--att-ink)',
        'ink-muted': 'var(--att-ink-muted)',
        'ink-faint': 'var(--att-ink-faint)',
        accent: 'var(--att-accent)',
        'accent-ink': 'var(--att-accent-ink)'
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        card: '0.75rem'
      },
      transitionDuration: {
        fast: '150ms'
      }
    }
  },
  plugins: []
} satisfies Config
