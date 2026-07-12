export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,svelte,vue,md,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // Monospace carries the display role — the actual aesthetic risk.
        // Body stays on Inter (already self-hosted) for pure readability.
        display: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'ui-monospace', 'monospace'],
      },
      colors: {
        ink: '#0B0E0C',
        surface: {
          900: '#0B0E0C',
          800: '#12160F',
          700: '#171C14',
          600: '#1D231A',
        },
        paper: '#EDEAE0',
        signal: {
          DEFAULT: '#D9A441',
          soft: '#E8C27A',
          dim: '#8A6A2C',
        },
        optimal: {
          DEFAULT: '#4FA97A',
          soft: '#7FC79E',
        },
        danger: {
          DEFAULT: '#C1523D',
          soft: '#D98572',
        },
        ink_text: {
          primary: '#EDEAE0',
          secondary: '#9AA396',
          muted: '#5E675A',
        },
      },
      animation: {
        // One deliberate moment, not ambient glow loops.
        'draw-curve': 'drawCurve 1.4s cubic-bezier(0.65, 0, 0.35, 1) forwards',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        drawCurve: {
          '0%': { strokeDashoffset: '1000' },
          '100%': { strokeDashoffset: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      borderRadius: {
        // Slightly squared-off, not the generic 1rem SaaS card everywhere.
        'xl': '0.5rem',
        '2xl': '0.625rem',
      },
      boxShadow: {
        // Flat elevation, no colored glow.
        'card': '0 1px 0 rgba(237, 234, 224, 0.06), 0 8px 20px rgba(0, 0, 0, 0.35)',
      },
    },
  },
  plugins: [],
};
