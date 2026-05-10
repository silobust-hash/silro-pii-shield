import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@tests': resolve(__dirname, 'tests'),
      // pdfjs-dist의 기본 빌드는 DOMMatrix 등 브라우저 API가 필요하므로
      // 테스트 환경에서는 legacy 빌드로 대체한다.
      'pdfjs-dist': resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.mjs'),
    },
  },
});
