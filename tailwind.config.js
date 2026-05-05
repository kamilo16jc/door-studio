/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#f8f9fa',
          800: '#ffffff',
          700: '#f1f3f5',
          600: '#e9ecef',
          500: '#dee2e6',
          400: '#ced4da',
        },
        accent: {
          DEFAULT: '#c8a96e',
          light: '#dfc08a',
          dark: '#a8894e',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
}
