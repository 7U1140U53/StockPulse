import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Clean build configuration
export default defineConfig({
  plugins: [react()],
});
