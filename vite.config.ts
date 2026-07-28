import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync, cpSync, mkdirSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "extension-assets",
      closeBundle() {
        mkdirSync("extension", { recursive: true });
        copyFileSync("manifest.json", "extension/manifest.json");
        cpSync("_locales", "extension/_locales", { recursive: true });
      }
    }
  ],
  build: {
    outDir: "extension",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, "src/background/index.ts"),
        content: resolve(__dirname, "src/content/index.ts"),
        options: resolve(__dirname, "options.html")
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "content" || chunk.name === "background"
            ? `${chunk.name}.js`
            : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
