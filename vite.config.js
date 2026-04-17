import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function copyExtensionAssets() {
  return {
    name: "copy-extension-assets",
    writeBundle() {
      const rootDir = __dirname;
      const outDir = resolve(rootDir, "dist");

      mkdirSync(outDir, { recursive: true });

      const filesToCopy = ["content.js", "background.js", "manifest.json"];
      for (const file of filesToCopy) {
        cpSync(resolve(rootDir, file), resolve(outDir, file));
      }

      const imagesDir = resolve(rootDir, "images");
      if (existsSync(imagesDir)) {
        cpSync(imagesDir, resolve(outDir, "images"), { recursive: true });
      }

      const manifestPath = resolve(outDir, "manifest.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

      if (manifest.icons?.["128"] === "formfill-ai_icon.png") {
        manifest.icons["128"] = "images/formfill-ai_icon.png";
      }

      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  };
}

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "form_input.html")
      }
    }
  },
  plugins: [copyExtensionAssets()]
});
