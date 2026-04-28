/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        green: {
          DEFAULT: "#2E7D32",
          dark: "#1B5E20",
          light: "#4CAF50",
        },
      },
    },
  },
  plugins: [],
};
