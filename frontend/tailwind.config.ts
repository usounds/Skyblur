/** @type {import('tailwindcss').Config} */
/* eslint-disable max-len */
import plugin from 'tailwindcss/plugin';

module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  plugins: [
    plugin(({ addVariant }) => {
      addVariant('disabled-within', '&:has(input:is(:disabled),button:is(:disabled))');
    })
  ],
};
