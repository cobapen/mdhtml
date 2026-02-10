
import { test } from "vitest";
import { cliMain, fileMissing, libMain, measurePerf } from "./perf.js";

const TEST_TIMEOUT_MS = 15000;

test.skipIf(fileMissing)("Performance Check", async () => {
  await import("./perf.js");
}, TEST_TIMEOUT_MS);

test("Performance Check (lib)", async () => {
  await measurePerf(libMain);
}, TEST_TIMEOUT_MS);

test("Performance Check (dist)", async () => {
  await measurePerf(cliMain);
}, TEST_TIMEOUT_MS);