/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/index.html",
    "./src/renderer/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        antd: {
          blue: '#1677ff',
          'blue-hover': '#4096ff',
          'blue-active': '#0958d9',
          'blue-bg': '#e6f4ff',
          border: '#e5e7eb',
          'border-light': '#f0f2f5',
          bg: '#f8fafc',
          canvas: '#f1f5f9',
          card: '#ffffff',
          'text-primary': '#1e293b',
          'text-secondary': '#64748b',
          'text-muted': '#94a3b8',
          success: '#52c41a',
          'success-bg': '#f6ffed',
          warning: '#faad14',
          'warning-bg': '#fffbe6',
          error: '#ff4d4f',
          'error-bg': '#fff2f0',
        },
        brand: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#1677ff',
          700: '#1d4ed8',
          900: '#1e3a8a',
        }
      },
      boxShadow: {
        'antd': '0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
        'antd-hover': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'antd-modal': '0 6px 16px 0 rgba(0, 0, 0, 0.08), 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 9px 28px 8px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
