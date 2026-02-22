/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "SF Pro Text",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      colors: {
        // 苹果极简黑白灰色系
        apple: {
          black: "#000000",
          white: "#FFFFFF",
          gray: {
            50: "#F9F9F9",
            100: "#F5F5F5",
            200: "#E8E8E8",
            300: "#D1D1D1",
            400: "#A0A0A0",
            500: "#6E6E6E",
            600: "#494949",
            700: "#333333",
            800: "#1A1A1A",
            900: "#0A0A0A",
          },
        },
      },
      boxShadow: {
        apple: "0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)",
        "apple-md": "0 4px 20px rgba(0,0,0,0.10)",
        "apple-lg": "0 8px 40px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
}
