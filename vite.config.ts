import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// NOVO: Importe o plugin do PWA
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  // MODIFICADO: Adicionado o plugin VitePWA com a configuração
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inclui assets da pasta public no cache
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Chamada Diária',
        short_name: 'Chamada Diária',
        description: 'Sistema de gestão de frequência escolar.',
        theme_color: '#7c3aed', // Cor principal da sua UI
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'radix-vendor': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-aspect-ratio',
            '@radix-ui/react-avatar',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-collapsible',
            '@radix-ui/react-context-menu',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-hover-card',
            '@radix-ui/react-label',
            '@radix-ui/react-menubar',
            '@radix-ui/react-navigation-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-slot',
            '@radix-ui/react-switch',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
            '@radix-ui/react-toggle',
            '@radix-ui/react-toggle-group',
            '@radix-ui/react-tooltip',
          ],
          'supabase-vendor': ['@supabase/supabase-js'],
          'tanstack-vendor': ['@tanstack/react-query'],
          'chart-vendor': ['recharts'],
          'tailwind-vendor': [
            'tailwindcss',
            'tailwindcss-animate',
            'tailwind-merge',
            '@tailwindcss/typography',
          ],
          'form-vendor': [
            'react-hook-form',
            '@hookform/resolvers',
            'zod',
            'clsx',
            'class-variance-authority',
          ],
          'date-vendor': ['date-fns', 'react-day-picker'],
          'misc-vendor': [
            'lucide-react',
            'cmdk',
            'vaul',
            'input-otp',
            'xlsx',
            'react-resizable-panels',
            'next-themes',
            'sonner',
          ],
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      // Radix
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-aspect-ratio',
      '@radix-ui/react-avatar',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-collapsible',
      '@radix-ui/react-context-menu',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-hover-card',
      '@radix-ui/react-label',
      '@radix-ui/react-menubar',
      '@radix-ui/react-navigation-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-progress',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-scroll-area',
      '@radix-ui/react-select',
      '@radix-ui/react-separator',
      '@radix-ui/react-slider',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      // Supabase
      '@supabase/supabase-js',
      // Tanstack
      '@tanstack/react-query',
      // Charts
      'recharts',
      // Tailwind
      'tailwindcss',
      'tailwindcss-animate',
      'tailwind-merge',
      '@tailwindcss/typography',
      // Forms
      'react-hook-form',
      '@hookform/resolvers',
      'zod',
      'clsx',
      'class-variance-authority',
      // Datas
      'date-fns',
      'react-day-picker',
      // Misc
      'lucide-react',
      'cmdk',
      'vaul',
      'input-otp',
      'xlsx',
      'react-resizable-panels',
      'next-themes',
      'sonner',
    ],
  },
});
