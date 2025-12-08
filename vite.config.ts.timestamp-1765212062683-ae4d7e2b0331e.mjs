// vite.config.ts
import { defineConfig } from "file:///C:/Users/PROFESSOR/Desktop/chamadadiaria_v2.0.0/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/PROFESSOR/Desktop/chamadadiaria_v2.0.0/node_modules/@vitejs/plugin-react-swc/index.mjs";
import path from "path";
import { VitePWA } from "file:///C:/Users/PROFESSOR/Desktop/chamadadiaria_v2.0.0/node_modules/vite-plugin-pwa/dist/index.js";
var __vite_injected_original_dirname = "C:\\Users\\PROFESSOR\\Desktop\\chamadadiaria_v2.0.0";
var vite_config_default = defineConfig({
  server: {
    host: "::",
    port: 8080
  },
  // MODIFICADO: Adicionado o plugin VitePWA com a configuração
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // Inclui assets da pasta public no cache
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Chamada Di\xE1ria",
        short_name: "Chamada Di\xE1ria",
        description: "Sistema de gest\xE3o de frequ\xEAncia escolar.",
        theme_color: "#7c3aed",
        // Cor principal da sua UI
        background_color: "#ffffff",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "radix-vendor": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip"
          ],
          "supabase-vendor": ["@supabase/supabase-js"],
          "tanstack-vendor": ["@tanstack/react-query"],
          "chart-vendor": ["recharts"],
          "tailwind-vendor": [
            "tailwindcss",
            "tailwindcss-animate",
            "tailwind-merge",
            "@tailwindcss/typography"
          ],
          "form-vendor": [
            "react-hook-form",
            "@hookform/resolvers",
            "zod",
            "clsx",
            "class-variance-authority"
          ],
          "date-vendor": ["date-fns", "react-day-picker"],
          "misc-vendor": [
            "lucide-react",
            "cmdk",
            "vaul",
            "input-otp",
            "xlsx",
            "react-resizable-panels",
            "next-themes",
            "sonner"
          ]
        }
      }
    }
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      // Radix
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-aspect-ratio",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-slot",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
      // Supabase
      "@supabase/supabase-js",
      // Tanstack
      "@tanstack/react-query",
      // Charts
      "recharts",
      // Tailwind
      "tailwindcss",
      "tailwindcss-animate",
      "tailwind-merge",
      "@tailwindcss/typography",
      // Forms
      "react-hook-form",
      "@hookform/resolvers",
      "zod",
      "clsx",
      "class-variance-authority",
      // Datas
      "date-fns",
      "react-day-picker",
      // Misc
      "lucide-react",
      "cmdk",
      "vaul",
      "input-otp",
      "xlsx",
      "react-resizable-panels",
      "next-themes",
      "sonner"
    ]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxQUk9GRVNTT1JcXFxcRGVza3RvcFxcXFxjaGFtYWRhZGlhcmlhX3YyLjAuMFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUFJPRkVTU09SXFxcXERlc2t0b3BcXFxcY2hhbWFkYWRpYXJpYV92Mi4wLjBcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL1BST0ZFU1NPUi9EZXNrdG9wL2NoYW1hZGFkaWFyaWFfdjIuMC4wL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3Qtc3djXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwicGF0aFwiO1xuLy8gTk9WTzogSW1wb3J0ZSBvIHBsdWdpbiBkbyBQV0FcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBzZXJ2ZXI6IHtcbiAgICBob3N0OiBcIjo6XCIsXG4gICAgcG9ydDogODA4MCxcbiAgfSxcbiAgLy8gTU9ESUZJQ0FETzogQWRpY2lvbmFkbyBvIHBsdWdpbiBWaXRlUFdBIGNvbSBhIGNvbmZpZ3VyYVx1MDBFN1x1MDBFM29cbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgVml0ZVBXQSh7XG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgIC8vIEluY2x1aSBhc3NldHMgZGEgcGFzdGEgcHVibGljIG5vIGNhY2hlXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ2FwcGxlLXRvdWNoLWljb24ucG5nJywgJ21hc2staWNvbi5zdmcnXSxcbiAgICAgIG1hbmlmZXN0OiB7XG4gICAgICAgIG5hbWU6ICdDaGFtYWRhIERpXHUwMEUxcmlhJyxcbiAgICAgICAgc2hvcnRfbmFtZTogJ0NoYW1hZGEgRGlcdTAwRTFyaWEnLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ1Npc3RlbWEgZGUgZ2VzdFx1MDBFM28gZGUgZnJlcXVcdTAwRUFuY2lhIGVzY29sYXIuJyxcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjN2MzYWVkJywgLy8gQ29yIHByaW5jaXBhbCBkYSBzdWEgVUlcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyNmZmZmZmYnLFxuICAgICAgICBkaXNwbGF5OiAnc3RhbmRhbG9uZScsXG4gICAgICAgIHNjb3BlOiAnLycsXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJ3B3YS0xOTJ4MTkyLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBzcmM6ICdwd2EtNTEyeDUxMi5wbmcnLFxuICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAncHdhLTUxMng1MTIucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICAgIHB1cnBvc2U6ICdhbnkgbWFza2FibGUnLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgIH0pLFxuICBdLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiBcImRpc3RcIixcbiAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgb3V0cHV0OiB7XG4gICAgICAgIG1hbnVhbENodW5rczoge1xuICAgICAgICAgICdyZWFjdC12ZW5kb3InOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbSddLFxuICAgICAgICAgICdyYWRpeC12ZW5kb3InOiBbXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWFjY29yZGlvbicsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWFsZXJ0LWRpYWxvZycsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWFzcGVjdC1yYXRpbycsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWF2YXRhcicsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWNoZWNrYm94JyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtY29sbGFwc2libGUnLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1jb250ZXh0LW1lbnUnLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1kcm9wZG93bi1tZW51JyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtaG92ZXItY2FyZCcsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LWxhYmVsJyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtbWVudWJhcicsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LW5hdmlnYXRpb24tbWVudScsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1wcm9ncmVzcycsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXJhZGlvLWdyb3VwJyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc2Nyb2xsLWFyZWEnLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zZWxlY3QnLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zZXBhcmF0b3InLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zbGlkZXInLFxuICAgICAgICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zbG90JyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc3dpdGNoJyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdGFicycsXG4gICAgICAgICAgICAnQHJhZGl4LXVpL3JlYWN0LXRvYXN0JyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9nZ2xlJyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9nZ2xlLWdyb3VwJyxcbiAgICAgICAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcCcsXG4gICAgICAgICAgXSxcbiAgICAgICAgICAnc3VwYWJhc2UtdmVuZG9yJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcbiAgICAgICAgICAndGFuc3RhY2stdmVuZG9yJzogWydAdGFuc3RhY2svcmVhY3QtcXVlcnknXSxcbiAgICAgICAgICAnY2hhcnQtdmVuZG9yJzogWydyZWNoYXJ0cyddLFxuICAgICAgICAgICd0YWlsd2luZC12ZW5kb3InOiBbXG4gICAgICAgICAgICAndGFpbHdpbmRjc3MnLFxuICAgICAgICAgICAgJ3RhaWx3aW5kY3NzLWFuaW1hdGUnLFxuICAgICAgICAgICAgJ3RhaWx3aW5kLW1lcmdlJyxcbiAgICAgICAgICAgICdAdGFpbHdpbmRjc3MvdHlwb2dyYXBoeScsXG4gICAgICAgICAgXSxcbiAgICAgICAgICAnZm9ybS12ZW5kb3InOiBbXG4gICAgICAgICAgICAncmVhY3QtaG9vay1mb3JtJyxcbiAgICAgICAgICAgICdAaG9va2Zvcm0vcmVzb2x2ZXJzJyxcbiAgICAgICAgICAgICd6b2QnLFxuICAgICAgICAgICAgJ2Nsc3gnLFxuICAgICAgICAgICAgJ2NsYXNzLXZhcmlhbmNlLWF1dGhvcml0eScsXG4gICAgICAgICAgXSxcbiAgICAgICAgICAnZGF0ZS12ZW5kb3InOiBbJ2RhdGUtZm5zJywgJ3JlYWN0LWRheS1waWNrZXInXSxcbiAgICAgICAgICAnbWlzYy12ZW5kb3InOiBbXG4gICAgICAgICAgICAnbHVjaWRlLXJlYWN0JyxcbiAgICAgICAgICAgICdjbWRrJyxcbiAgICAgICAgICAgICd2YXVsJyxcbiAgICAgICAgICAgICdpbnB1dC1vdHAnLFxuICAgICAgICAgICAgJ3hsc3gnLFxuICAgICAgICAgICAgJ3JlYWN0LXJlc2l6YWJsZS1wYW5lbHMnLFxuICAgICAgICAgICAgJ25leHQtdGhlbWVzJyxcbiAgICAgICAgICAgICdzb25uZXInLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIG9wdGltaXplRGVwczoge1xuICAgIGluY2x1ZGU6IFtcbiAgICAgICdyZWFjdCcsXG4gICAgICAncmVhY3QtZG9tJyxcbiAgICAgIC8vIFJhZGl4XG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LWFjY29yZGlvbicsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LWFsZXJ0LWRpYWxvZycsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LWFzcGVjdC1yYXRpbycsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LWF2YXRhcicsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LWNoZWNrYm94JyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtY29sbGFwc2libGUnLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1jb250ZXh0LW1lbnUnLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1kaWFsb2cnLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1kcm9wZG93bi1tZW51JyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtaG92ZXItY2FyZCcsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LWxhYmVsJyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtbWVudWJhcicsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LW5hdmlnYXRpb24tbWVudScsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LXBvcG92ZXInLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1wcm9ncmVzcycsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LXJhZGlvLWdyb3VwJyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc2Nyb2xsLWFyZWEnLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zZWxlY3QnLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zZXBhcmF0b3InLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zbGlkZXInLFxuICAgICAgJ0ByYWRpeC11aS9yZWFjdC1zbG90JyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3Qtc3dpdGNoJyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtdGFicycsXG4gICAgICAnQHJhZGl4LXVpL3JlYWN0LXRvYXN0JyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9nZ2xlJyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9nZ2xlLWdyb3VwJyxcbiAgICAgICdAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcCcsXG4gICAgICAvLyBTdXBhYmFzZVxuICAgICAgJ0BzdXBhYmFzZS9zdXBhYmFzZS1qcycsXG4gICAgICAvLyBUYW5zdGFja1xuICAgICAgJ0B0YW5zdGFjay9yZWFjdC1xdWVyeScsXG4gICAgICAvLyBDaGFydHNcbiAgICAgICdyZWNoYXJ0cycsXG4gICAgICAvLyBUYWlsd2luZFxuICAgICAgJ3RhaWx3aW5kY3NzJyxcbiAgICAgICd0YWlsd2luZGNzcy1hbmltYXRlJyxcbiAgICAgICd0YWlsd2luZC1tZXJnZScsXG4gICAgICAnQHRhaWx3aW5kY3NzL3R5cG9ncmFwaHknLFxuICAgICAgLy8gRm9ybXNcbiAgICAgICdyZWFjdC1ob29rLWZvcm0nLFxuICAgICAgJ0Bob29rZm9ybS9yZXNvbHZlcnMnLFxuICAgICAgJ3pvZCcsXG4gICAgICAnY2xzeCcsXG4gICAgICAnY2xhc3MtdmFyaWFuY2UtYXV0aG9yaXR5JyxcbiAgICAgIC8vIERhdGFzXG4gICAgICAnZGF0ZS1mbnMnLFxuICAgICAgJ3JlYWN0LWRheS1waWNrZXInLFxuICAgICAgLy8gTWlzY1xuICAgICAgJ2x1Y2lkZS1yZWFjdCcsXG4gICAgICAnY21kaycsXG4gICAgICAndmF1bCcsXG4gICAgICAnaW5wdXQtb3RwJyxcbiAgICAgICd4bHN4JyxcbiAgICAgICdyZWFjdC1yZXNpemFibGUtcGFuZWxzJyxcbiAgICAgICduZXh0LXRoZW1lcycsXG4gICAgICAnc29ubmVyJyxcbiAgICBdLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlVLFNBQVMsb0JBQW9CO0FBQ3RXLE9BQU8sV0FBVztBQUNsQixPQUFPLFVBQVU7QUFFakIsU0FBUyxlQUFlO0FBSnhCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUVBLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLGNBQWM7QUFBQTtBQUFBLE1BRWQsZUFBZSxDQUFDLGVBQWUsd0JBQXdCLGVBQWU7QUFBQSxNQUN0RSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUE7QUFBQSxRQUNiLGtCQUFrQjtBQUFBLFFBQ2xCLFNBQVM7QUFBQSxRQUNULE9BQU87QUFBQSxRQUNQLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEs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
