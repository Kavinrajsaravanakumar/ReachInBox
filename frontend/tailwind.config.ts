import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1B8A4A",
          hover: "#167540",
          forest: "#12803C",
          mint: "#E7F6EC",
          google: "#DCEFDC",
          googleHover: "#D0E8D0",
          nav: "#E6F4EA",
          ink: "#0F8A4B",
        },
        canvas: "#F4F4F1",
        ink: "#111111",
        muted: "#8A8A8A",
        "muted-2": "#6B6B6B",
        line: "#E8E8E8",
        field: "#EFEFEF",
        editor: "#F7F7F7",
        scheduled: {
          bg: "#FDE9D2",
          text: "#C06A1A",
        },
        sent: {
          bg: "#E9E9E9",
          text: "#5A5A5A",
        },
        failed: {
          bg: "#FDECEC",
          text: "#C53030",
        },
        highlight: "#FFF6D6",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 8px 30px rgba(0,0,0,0.06)",
        pop: "0 12px 40px rgba(0,0,0,0.12)",
      },
      borderRadius: {
        login: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
