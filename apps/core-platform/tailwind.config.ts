import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#C2410C",
          soft: "#FDBA74",
          dark: "#7C2D12"
        }
      }
    }
  },
  plugins: []
};
export default config;
