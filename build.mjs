import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = process.cwd();
const distDir = resolve(rootDir, "dist");

const requiredPaths = [
  "manifest.json",
  "form_input.html",
  "popup.js",
  "content.js",
  "background.js"
];

for (const relativePath of requiredPaths) {
  const absolutePath = resolve(rootDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Missing required build input: ${relativePath}`);
  }
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });

const pathsToCopy = [
  "manifest.json",
  "form_input.html",
  "popup.js",
  "content.js",
  "background.js",
  "prompt.json",
  "images"
];

for (const relativePath of pathsToCopy) {
  const sourcePath = resolve(rootDir, relativePath);
  if (!existsSync(sourcePath)) {
    continue;
  }

  cpSync(sourcePath, resolve(distDir, relativePath), { recursive: true });
}

console.log("Build completed:", distDir);
