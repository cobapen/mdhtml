import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import chokidar from "chokidar";
import { CMarkdown } from "@cobapen/markdown";
import { vol } from "memfs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { MdHtmlConverter } from "../../src/mdhtml.js";

vi.mock("node:fs", () => vi.importActual("../_mocks/fs.cjs"));
vi.mock("node:fs/promises", () => vi.importActual("../_mocks/fs/promises.cjs"));
vi.mock("chokidar", () => vi.importActual("../_mocks/chokidar.js"));

describe.sequential("Conversion Tests", () => {

  beforeAll(() => {
    process.chdir("/"); // Without this memfs fails
  });

  beforeEach(async () => {
    vol.reset();
    await fs.mkdir("input");
    await fs.mkdir("input-dir");
    await fs.writeFile("input-dir/_template.html", "{{{content}}}");
    await fs.writeFile("input-dir/test.md", "Hello World!");
    await fs.writeFile("file.md", "This is file");
  });

  describe.sequential("with default options", () => {

    /** @param {import("../../src/mdhtml.js").Options} [option] */
    function createConverter(option) {
      const md = new CMarkdown();
      return new MdHtmlConverter(md, {
        template: undefined,
        output: undefined,
        quiet: undefined,
        clean: undefined,
        ...option,
      });
    }

    it("if input do not exist, throw error", async () => {
      const converter = createConverter();
      vi.spyOn(console, "error").mockImplementation(() => {});
      await converter.convert("nonexistent-dir");
      expect(console.error).toHaveBeenCalledWith(
        "No such file or directory: nonexistent-dir"
      );
    });

    it("convert single file", async () => {
      const converter = createConverter();
      await converter.convert("file.md");
      expect(existsSync("file.html")).toBe(true);
    });

    it("convert input directory", async () => {
      const converter = createConverter();
      await converter.convert("input-dir");
      expect(existsSync("output/_template.html")).toBe(true);
      expect(existsSync("output/test.html")).toBe(true);
      const contents = await fs.readFile("output/test.html", { encoding: "utf-8" });
      expect(contents).toEqual("<p>Hello World!</p>\n");
    });

    it("run twice and check dst folder is cleaned", async () => {
      const converter = createConverter({ clean: true });
      await converter.convert("input-dir");
      await fs.writeFile("output/dummy.txt", "12345");
      await converter.convert("input-dir");
      expect(existsSync("output/test.html")).toBe(true);
      expect(existsSync("output/dummy.txt")).toBe(false);
    });

    it("watch directory", async () => {
      const converter = createConverter();
      await converter.watch("input-dir");
      expect(chokidar.watch).toBeCalled();
      expect(existsSync("output")).toBe(true);
    });

    it("watch file", async () => {
      const converter = createConverter();
      await converter.watch("file.md");
      expect(chokidar.watch).toBeCalled();
      expect(existsSync("file.html")).toBe(true);
    });
  });
});

