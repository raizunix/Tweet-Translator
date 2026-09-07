import { build, defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { copyFileSync, cpSync, mkdirSync } from "node:fs";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "extension-assets",
      async closeBundle() {
        // MV3 manifest content scripts are classic scripts. Shared runtime
        // modules must be bundled into an IIFE, not emitted as ESM imports.
        await build({
          configFile: false,
          publicDir: false,
          build: {
            outDir: "extension",
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, "src/content/index.ts"),
              name: "TweetTranslator",
              formats: ["iife"],
              fileName: () => "content.js"
            }
          }
        });
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
