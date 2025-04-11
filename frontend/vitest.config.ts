import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['@testing-library/jest-dom'],
    coverage: {
      reporter: ['text', 'html'],
    },
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
