
import fs from "node:fs/promises";
import { platform } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import vfs from "./vfs.js";


vi.mock("node:fs", () => vi.importActual("./_mocks/fs.cjs"));
vi.mock("node:fs/promises", () => vi.importActual("./_mocks/fs/promises.cjs"));

describe("vfs", () => {

  describe("writeFile succeeds with", () => {

    it("file", async () => {
      const testPath = "test/vfs_dir/subdir/file.txt";
      const content = "Hello!";
      await vfs.writeFile(testPath, content);
      const readContent = await fs.readFile(testPath, "utf-8");
      expect(readContent).toBe(content);
    });

    it("absPath", async () => {
      // Check absPath can be used. 
      // On windows platform, the absPath contains a driver letter. 
      // Make sure vfs handles path with drive letter.
      const testPath = resolve("/test/vfs_dir2/subdir2/file2.txt");
      const content = "Hello!";
      await vfs.writeFile(testPath, content);
      const readContent = await fs.readFile(testPath, "utf-8");
      expect(readContent).toBe(content);



      if (platform() === "win32") {
        expect(testPath).toMatch(/^[A-Z]\:/i);
      }
    });
    
  });
});
