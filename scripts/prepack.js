import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const __dirname = import.meta.dirname;
const __projectRoot = path.resolve(__dirname, "..");
const packageJsonFile = path.resolve(__projectRoot, "package.json");
const readmeHtmlFile = path.resolve(__projectRoot, "README.html");
const libDir = path.resolve(__projectRoot, "lib");

if (!fs.existsSync(packageJsonFile)) {
  throw new Error("package.json not found. check the path.");
}


// Remove README.html because npm pack/publish always include this file.
if (fs.existsSync(readmeHtmlFile)) {
  fs.rmSync(readmeHtmlFile);
}

// Remove lib/ to ensure fresh build. 
if (fs.existsSync(libDir)) {
  fs.rmSync(libDir, { recursive: true, force: true });
}

spawnSync("npm", ["run", "build"], {
  stdio: "inherit",
  cwd: __projectRoot,
  shell: true,
});

spawnSync("node", ["scripts/bundle.js"], {
  stdio: "inherit",
  cwd: __projectRoot,
  shell: true,
});