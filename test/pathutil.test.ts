import path, { dirname } from "node:path";
import { describe, expect, it } from "vitest";

import { FilePath, ResolvedPath } from "../src/pathutil.js";

const cwd = process.cwd();






/**
 * ResolvedPath resolves relative path to absolute path.
 * 
 * 
 * 
 * 
 * 
 */


describe("ResolvedPath", () => {
  describe("init ResolvedPaths with", () => {
    it("file in cwd", () => {
      // $cwd/file.md
      const rp = ResolvedPath.new("file.md");
      expect(rp.location).toBe("file.md");
      expect(rp.absPath).toBe(path.join(cwd, "file.md"));
    });

    it("file in absDir", () => {
      // $cwd/file.md
      const rp = ResolvedPath.new("file.md", "/tmp");
      expect(rp.absPath).toBe(path.resolve("/tmp", "file.md"));
    });

    it("empty path", () => {
      // $__dirname/
      const rp = ResolvedPath.new("", __dirname);
      expect(rp.absPath).toBe(__dirname);
      expect(rp.location).toBe(path.relative(cwd, __dirname));
    });

    it("empty path + any srcDir", () => {
      // /temp/dir/
      const rp = ResolvedPath.new("", "/temp/dir");
      expect(rp.absPath).toBe(path.resolve("/temp", "dir"));
    });

    it("empty path, empty srcDir", () => {
      // $cwd/
      const rp = ResolvedPath.new("", "");
      expect(rp.absPath).toBe(cwd);
      // Empty path resolves to cwd (directory)
      expect(path.resolve("")).toBe(cwd);
    });

    it("unnormalized path", () => {
      // $cwd/.././//abc.txt
      const rp = ResolvedPath.new(".././//a.txt");
      expect(rp.absPath).toBe(path.resolve(dirname(cwd), "a.txt"));
      expect(rp.location).not.toBe(path.join("..", "a.txt"));
      expect(rp.location).toBe(rp.absPath);
    });

    it("file in relative srcDir", () => {
      // $cwd/hello/abc.txt
      const rp = ResolvedPath.new("abc.txt", "folder");
      expect(rp.location).toBe(path.join("folder", "abc.txt"));
      expect(rp.getPath("folder")).toBe("abc.txt");
      // Relative with same path returns zero-length string
      expect(path.relative("a", "a")).toBe("");
    });

    it("path with trailing slash", () => {
      // $cwd/folder/
      const rp = ResolvedPath.new("folder/");
      expect(rp.location).toBe("folder");
      expect(rp.absPath).toBe(path.resolve(cwd, "folder"));
      // Relative with same path returns zero-length string
      expect(path.relative("a", "a")).toBe("");
    });
  });
});

describe("FilePath", () => {
  describe("init FilePath with", () => {
    it("file", () => {
      const file = FilePath.new("abc.txt", "input");
      expect(file.getPath("input")).toBe("abc.txt");
    }); 
  });
});
