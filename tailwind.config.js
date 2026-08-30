/** @type {import('tailwindcss').Config} */
// Names map onto the CSS custom properties in src/styles/theme.css. Retheming
// means editing that one file — components never hard-code a colour.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--paper) / <alpha-value>)',
        chalk: 'rgb(var(--chalk) / <alpha-value>)',
        pitch: {
          DEFAULT: 'rgb(var(--pitch) / <alpha-value>)',
          mid: 'rgb(var(--pitch-mid) / <alpha-value>)',
        },
        ink: 'rgb(var(--ink) / <alpha-value>)',
        mist: 'rgb(var(--mist) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        hivis: 'rgb(var(--hivis) / <alpha-value>)',
        whistle: 'rgb(var(--whistle) / <alpha-value>)',
      },
      fontFamily: {
        // Chivo: a sturdy, deliberately NON-condensed grotesque with real
        // tabular figures. Condensed type is the reflex sports choice and reads
        // as club-wordmark; this reads as institutional.
        display: ['Chivo', 'Helvetica Neue', 'sans-serif'],
        // Atkinson Hyperlegible: built by the Braille Institute for low vision —
        // unambiguous I/l/1 and O/0, open apertures, high x-height. Chosen for
        // bright-daylight glanceability, not for style.
        body: ['"Atkinson Hyperlegible"', 'Helvetica Neue', 'sans-serif'],
      },
      borderRadius: {
        md: '0.375rem',
      },
      maxWidth: {
        prose: '68ch',
      },
    },
  },
  plugins: [],
}
