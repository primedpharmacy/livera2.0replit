import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        brand: {
          DEFAULT: "#6366f1",
          dark: "#4338ca",
          light: "#eef2ff",
          mid: "#818cf8",
        },
        bdr: { DEFAULT: "#e2e8f0", d: "#cbd5e1" },
        nav: "#1e1b4b",
        surface: "#ffffff",
        "page-bg": "#f1f0ef",
        t1: "#0f172a",
        t2: "#475569",
        t3: "#94a3b8",
        ok: { DEFAULT: "#10b981", bg: "#ecfdf5", bdr: "#a7f3d0" },
        warn: { DEFAULT: "#f59e0b", bg: "#fffbeb", bdr: "#fde68a" },
        err: { DEFAULT: "#ef4444", bg: "#fef2f2", bdr: "#fecaca" },
        info: { DEFAULT: "#3b82f6", bg: "#eff6ff", bdr: "#bfdbfe" },
        coach: { DEFAULT: "#a855f7", bg: "#faf5ff", bdr: "#e9d5ff" },
        welcome: { DEFAULT: "#0ea5e9", bg: "#f0f9ff", bdr: "#bae6fd" },
        clinical: { DEFAULT: "#dc2626", bg: "#fef2f2", bdr: "#fecaca" },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;
