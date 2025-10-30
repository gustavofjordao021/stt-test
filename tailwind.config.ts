import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          500: "var(--primary-500)",
          600: "var(--primary-600)",
          700: "var(--primary-700)",
        },
        gray: {
          50: "var(--gray-50)",
          100: "var(--gray-100)",
          200: "var(--gray-200)",
          300: "var(--gray-300)",
          400: "var(--gray-400)",
          600: "var(--gray-600)",
          700: "var(--gray-700)",
          900: "var(--gray-900)",
        },
        success: {
          500: "var(--success-500)",
        },
        error: {
          500: "var(--error-500)",
        },
        warning: {
          500: "var(--warning-500)",
        }
      },
      animation: {
        'fadeIn': 'fadeIn var(--transition-normal)',
        'messageSlideIn': 'messageSlideIn var(--transition-normal)',
        'bounceIn': 'bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slideDown': 'slideDown var(--transition-normal)',
        'shimmer': 'shimmer 1.5s infinite',
      },
      transitionDuration: {
        fast: 'var(--transition-fast)',
        normal: 'var(--transition-normal)',
        slow: 'var(--transition-slow)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [],
} satisfies Config;
