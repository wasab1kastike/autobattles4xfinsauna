import type { Config } from 'tailwindcss';

const config = {
  content: ['./src/**/*.{html,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ui: {
          bg: '#020617',
        },
        accent: '#38bdf8',
      },
      spacing: {
        'hud-xs': '0.25rem',
        'hud-sm': '0.5rem',
        'hud-md': '1rem',
      },
      borderRadius: {
        'hud-sm': '2px',
        'hud-md': '4px',
        'hud-lg': '8px',
        'hud-pill': '999px',
      },
      boxShadow: {
        'hud-sm': '0 1px 2px rgba(8, 25, 53, 0.25)',
        'hud-md': '0 8px 20px rgba(8, 25, 53, 0.35)',
        'hud-lg': '0 24px 48px rgba(8, 25, 53, 0.5)',
        'hud-glow': '0 0 36px rgba(56, 189, 248, 0.5)',
      },
      zIndex: {
        hud: '850',
        overlay: '980',
        toast: '990',
        scrim: '1000',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
