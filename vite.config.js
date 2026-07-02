import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  build: {
    outDir: "dist/product-app",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        app: resolve(__dirname, "app/index.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    fs: {
      allow: ["app", "state", "reviews", "wiki", "sources", "indexes", "node_modules"],
    },
  },
});
