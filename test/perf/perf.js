/**
 * Performance Measurement Script
 * 
 * This script measures the time to launch a process for mdhtml conversion.
 * 
 * - lib/index.js
 * - dist/index.js
 * 
 * For some reason, lib/index.js is very slow. 
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { expect } from "vitest";

const __dirname = import.meta.dirname;
const __projectRoot = path.resolve(__dirname, "../../");
export const packageJson = path.resolve(__projectRoot, "package.json");
export const libMain = path.resolve(__projectRoot, "lib/index.js");
export const cliMain = path.resolve(__projectRoot, "dist/index.js");

export const fileMissing = [packageJson, libMain, cliMain].some((p) => !existsSync(p));

// if (import.meta.main) (node >=22.18,24.2)
if (process.argv[1] === import.meta.filename) {
  console.log(`${cliMain}`);
  if (existsSync(cliMain)) {
    await measurePerf(cliMain);
  }
  console.log(`${libMain}`);
  if (existsSync(libMain)) {
    await measurePerf(libMain);
  }
}


/**
 * @param {string} scriptPath
 */
export async function measurePerf(scriptPath) {
  const dtempDir = await fs.mkdtemp(path.resolve(tmpdir(), "mdhtml-test-"));

  try {
    const mdFile = path.resolve(dtempDir, "dummy.md");
    const mdText = "# Hello World \n $$E=mc^2$$\n";
    await fs.writeFile(mdFile, mdText, "utf8");

    const start = performance.now();
    const result = spawnSync("node", [scriptPath, mdFile, "--stdout"], {
      encoding: "utf8",
      stdio: "pipe",
      cwd: dtempDir,
      maxBuffer: 1024 * 1024 * 50,
    });
    const end = performance.now();
    const elapsedMs = end - start;

    if (result.status === 0) {
      console.log(`${elapsedMs.toFixed(3)} ms`);
      expect(result.output[1]).toContain("<!DOCTYPE html>");
      expect(result.output[1]).toContain("<mjx-container");
    }
    else {
      throw new Error(`spawn failed (status=${result.status})\n${result.stderr ?? ""}`);
    }
  } finally {
    await fs.rm(dtempDir, { recursive: true, force: true });
  }
}