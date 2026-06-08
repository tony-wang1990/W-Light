/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
// Electron 打包时由 prepare:web 脚本注入 ELECTRON=true，使资源路径使用相对路径
// 避免 file:// 协议下绝对路径 /assets/xxx.js 无法加载导致白屏
export default defineConfig({
    plugins: [react()],
    base: process.env.ELECTRON === 'true' ? './' : '/',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/v1': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    build: {
        target: 'es2015',
        minify: 'esbuild',
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    var moduleId = id.replace(/\\/g, '/');
                    if (!moduleId.includes('node_modules'))
                        return undefined;
                    if (moduleId.includes('lucide-react'))
                        return 'vendor-icons';
                    if (moduleId.includes('recharts') || moduleId.includes('d3-') || moduleId.includes('victory-vendor')) {
                        return 'vendor-charts';
                    }
                    if (moduleId.includes('react-router') || moduleId.includes('@remix-run'))
                        return 'vendor-router';
                    if (moduleId.includes('/react/') || moduleId.includes('/react-dom/') || moduleId.includes('/scheduler/')) {
                        return 'vendor-react';
                    }
                    if (moduleId.includes('/zustand/'))
                        return 'vendor-state';
                    return undefined;
                },
            },
        },
    },
    test: {
        environment: 'jsdom',
        setupFiles: './src/test/setup.ts',
        globals: true,
        include: ['src/**/*.spec.{ts,tsx}'],
        exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    },
});
