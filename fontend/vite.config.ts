import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('xlsx')) return 'vendor-xlsx';
            if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
            if (id.includes('html5-qrcode') || id.includes('qrcode.react')) return 'vendor-qrcode';
            if (id.includes('react-quill') || id.includes('quill')) return 'vendor-editor';
            if (id.includes('antd') || id.includes('@ant-design') || id.includes('rc-')) return 'vendor-antd';
          }
        },
      },
    },
  },
})
