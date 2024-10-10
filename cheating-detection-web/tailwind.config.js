/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#FFFFFF", // White background for a clean, minimal look
          light: "#F7F7F7", // Slightly off-white for subtle contrasts
        },
        secondary: {
          DEFAULT: "#000000", // Black for text and primary elements
          light: "#2E2E2E", // Dark gray for hover states or borders
        },
        accent: {
          DEFAULT: "#666666", // Medium gray for less prominent text and elements
          light: "#999999", // Light gray for softer accents and borders
        },
      },
    },
  },
  plugins: [],
};
