import fs from "node:fs";
import path from "node:path";

const __dirname = import.meta.dirname;
const __projectRoot = path.resolve(__dirname, "..");
const packageJsonFile = path.resolve(__projectRoot, "package.json");
const readmeHtmlFile = path.resolve(__projectRoot, "README.html");

if (!fs.existsSync(packageJsonFile)) {
  throw new Error("package.json not found. check the path.");
}


// Remove README.html because npm pack/publish always include this file.
if (fs.existsSync(readmeHtmlFile)) {
  fs.rmSync(readmeHtmlFile);
}