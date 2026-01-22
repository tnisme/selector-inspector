import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const distDir = "dist/locator-inspector";
const srcDir = "src";

function copyRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

fs.rmSync("dist", { recursive: true, force: true });

fs.mkdirSync(distDir, { recursive: true });

fs.copyFileSync("manifest.json", `${distDir}/manifest.json`);

copyRecursive(srcDir, distDir);

console.log("Build completed");
