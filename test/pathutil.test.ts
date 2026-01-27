import path, { dirname } from "node:path";
import { describe, expect, it } from "vitest";

import { FilePath, ResolvedPath } from "../src/pathutil.js";

const cwd = process.cwd();

describe("ResolvedPath", () => {
  describe("init ResolvedPaths with", () => {
    it("file in cwd", () => {
      // $cwd/file.md
      const rp = new ResolvedPath("file.md");
      expect(rp.raw).toBe("file.md");
      expect(rp.path).toBe("file.md");
      expect(rp.location).toBe("file.md");
      expect(rp.absPath).toBe(path.join(cwd, "file.md"));
      expect(rp.pathFrom(cwd)).toBe("file.md");
    });

    it("file in absDir", () => {
      // $cwd/file.md
      const rp = new ResolvedPath("file.md", "/tmp");
      expect(rp.raw).toBe("file.md");
      expect(rp.path).toBe("file.md");
      expect(rp.absPath).toBe(path.resolve("/tmp", "file.md"));
    });

    it("empty path", () => {
      // $__dirname/
      const rp = new ResolvedPath("", __dirname);
      expect(rp.raw).toBe("");
      expect(rp.path).toBe(".");
      expect(rp.absPath).toBe(__dirname);
      expect(rp.location).toBe(path.relative(cwd, __dirname));
    });

    it("empty path + any srcDir", () => {
      // /temp/dir/
      const rp = new ResolvedPath("", "/temp/dir");
      expect(rp.raw).toBe("");
      expect(rp.path).toBe(".");
      expect(rp.absPath).toBe(path.resolve("/temp", "dir"));
    });

    it("empty path, empty srcDir", () => {
      // $cwd/
      const rp = new ResolvedPath("", "");
      expect(rp.raw).toBe("");
      expect(rp.path).toBe(".");
      expect(rp.absPath).toBe(cwd);
      // Empty path resolves to cwd (directory)
      expect(path.resolve("")).toBe(cwd);
    });

    it("unnormalized path", () => {
      // $cwd/.././//abc.txt
      const rp = new ResolvedPath(".././//a.txt");
      expect(rp.raw).toBe(".././//a.txt");
      expect(rp.path).toBe(path.join("..", "a.txt"));
      expect(rp.absPath).toBe(path.resolve(dirname(cwd), "a.txt"));
    });

    it("file in relative srcDir", () => {
      // $cwd/hello/abc.txt
      const rp = new ResolvedPath("abc.txt", "hello");
      expect(rp.raw).toBe("abc.txt");
      expect(rp.path).toBe("abc.txt");
      expect(rp.location).toBe(path.join("hello", "abc.txt"));
      // Relative with same path returns zero-length string
      expect(path.relative("a", "a")).toBe("");
    });

    it("path with trailing slash", () => {
      // $cwd/folder/
      const rp = new ResolvedPath("folder/");
      expect(rp.raw).toBe("folder/");
      expect(rp.path).toBe("folder");
      expect(rp.location).toBe("folder");
      expect(rp.absPath).toBe(path.resolve(cwd, "folder"));
      // Relative with same path returns zero-length string
      expect(path.relative("a", "a")).toBe("");
    });    
  });


  describe("isAbsolute is correct", () => {
    it("test", () => {
      expect(new ResolvedPath("/abs/path").isAbsolute()).toBe(true);
      expect(new ResolvedPath("rel/path").isAbsolute()).toBe(false);
    });
  });
});

describe("FilePath", () => {
  describe("init FilePath with", () => {
    it("file", () => {
      const file = new FilePath("abc.txt", "input");
      expect(file.raw).toBe("abc.txt");
    }); 
  });
});
