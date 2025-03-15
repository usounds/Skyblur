/** @type {import('tailwindcss').Config} */
/* eslint-disable max-len */
import plugin from 'tailwindcss/plugin';
import { colorPalette } from 'reablocks';

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/reablocks/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: colorPalette.blue[400],
          active: colorPalette.blue[400],
          hover: colorPalette.blue[500],
          inactive: colorPalette.blue[200],
        },
        secondary: {
          DEFAULT: colorPalette.gray[500],
          active: colorPalette.gray[500],
          hover: colorPalette.gray[600],
          inactive: colorPalette.gray[300]
        },
        success: {
          DEFAULT: colorPalette.green[500],
          active: colorPalette.green[500],
          hover: colorPalette.green[600]
        },
        error: {
          DEFAULT: colorPalette.red[500],
          active: colorPalette.red[500],
          hover: colorPalette.red[600]
        },
        warning: {
          DEFAULT: colorPalette.orange[500],
          active: colorPalette.orange[500],
          hover: colorPalette.orange[600]
        },
        info: {
          DEFAULT: colorPalette.blue[300],
          active: colorPalette.blue[300],
          hover: colorPalette.blue[500]
        },
        background: {
          level1: colorPalette.white,
          level2: colorPalette.gray[400],
          level3: colorPalette.gray[300],
          level4: colorPalette.gray[200],
        },
        panel: {
          DEFAULT: colorPalette['athens-gray'],
          accent: colorPalette.gray[200]
        },
        surface: {
          DEFAULT: colorPalette['charade'],
          accent: colorPalette.blue[400]
        },
        typography: {
          DEFAULT: colorPalette['athens-gray'],
        },
        accent: {
          DEFAULT: colorPalette['waterloo'],
          active: colorPalette['anakiwa']
        }
      }
    }
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('disabled-within', '&:has(input:is(:disabled),button:is(:disabled))');
    })
  ],
};
