import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        emerald: {
          950: "#04140f",
          900: "#06241a",
          850: "#0a2e21",
          800: "#0d3a29",
          700: "#13503a",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f4d27a",
          dark: "#a8821f",
        },
        panel: "#0b2419",
        panelborder: "#1f4536",
        positive: "#34d399",
        warning: "#f59e0b",
        danger: "#f87171",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        card: "0 4px 20px rgba(0,0,0,0.35)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
