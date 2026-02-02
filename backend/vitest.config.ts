import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node', // Use node environment for logic tests. For Worker specific tests we might need minimal-wrangler or similar, but for now logic is pure TS/Node compatible mostly.
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        alias: {
            '@': path.resolve(__dirname, './src'),
            'cloudflare:workers': path.resolve(__dirname, './test/mocks/cloudflare-workers.ts'),
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            'cloudflare:workers': path.resolve(__dirname, './test/mocks/cloudflare-workers.ts'),
        },
    },
});
