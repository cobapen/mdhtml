import path from "node:path";
import { CMarkdown } from "@cobapen/markdown";
import { describe, expect, it } from "vitest";
import { MdHtmlRenderer, PathProvider } from "../src/mdhtml.js";
import { DirPath, FilePath } from "../src/pathutil.js";

describe("PathProvider", () => {
  
  const inputDir = "input";
  const outputDir = "output";
  const _token = {} as any;

  // PathProvider here is configured as:
  // input:  $cwd/input
  // output: $cwd/output
  const provider = new PathProvider();
  const inDir = DirPath.new(inputDir);
  const outDir = DirPath.new(outputDir);
  provider.configure(inDir, outDir);

  describe("configure", () => {
    it("should set input and output directories", () => {
      expect(provider.inputDir.absPath).toBe(inDir.absPath);
      expect(provider.outputDir.absPath).toBe(outDir.absPath);
    });

    it("should set to current working directory for single file mode", () => {
      const provider = new PathProvider();
      provider.configureForSingle();

      const cwd = path.resolve(process.cwd());
      expect(provider.inputDir.absPath).toBe(cwd);
      expect(provider.outputDir.absPath).toBe(cwd);
    });
  });

  describe("relativeFromInput", () => {
    it("should resolve relative path from input directory", () => {
      const filePath = provider.relativeFromInput("docs/guide.md");
      expect(filePath.location).toBe(path.join(inputDir, "docs", "guide.md"));
    });

    it("should resolve @/ prefix paths from input directory", () => {
      const filePath = provider.relativeFromInput("@/docs/guide.md");
      expect(filePath.location).toBe(path.join(inputDir, "docs", "guide.md"));
    });

    it("should handle @/ prefix with nested paths", () => {
      const filePath = provider.relativeFromInput("@/docs/sub/detail.md");
      expect(filePath.location).toBe(
        path.join(inputDir, "docs", "sub", "detail.md")
      );
    });
  });

  describe("relativeFromOutput", () => {
    it("should resolve relative path from output directory", () => {
      const filePath = provider.relativeFromOutput("docs/guide.html");
      expect(filePath.location).toBe(path.join(outputDir, "docs", "guide.html"));
    });

    it("should resolve @/ prefix paths from output directory", () => {
      const filePath = provider.relativeFromOutput("@/css/style.css");
      expect(filePath.location).toBe(path.join(outputDir, "css", "style.css"));
    });
  });

  describe("defaultOutput", () => {
    it("should return default html filename for single markdown file", () => {
      const filePath = path.join(inputDir, "README.md");
      const result = PathProvider.defaultOutput(filePath);
      expect(result).toBe("README.html");
    });

    it("should handle different markdown file names", () => {
      const filePath = path.join(inputDir, "docs", "guide.md");
      const result = PathProvider.defaultOutput(filePath);
      expect(result).toBe("guide.html");
    });
  });
});

describe("MdHtmlRenderer", () => {
  const inputDir = "input";
  const outputDir = "output";

  const provider = new PathProvider();
  const inDir = DirPath.new(inputDir);
  const outDir = DirPath.new(outputDir);
  provider.configure(inDir, outDir);

  const renderer = new MdHtmlRenderer({} as any, provider);

  describe("replaceHtmlLinks", () => {
    describe("should resolve @/ links correctly", () => {
      it("href from file to root", () => {
        // file:  input/docs/guide.md
        // dst:  output/docs/guide.html
        // link: output/README.html
        const file = FilePath.new("docs/guide.md", inDir);
        const html = "<a href=\"@/README.html\">Readme</a>";
        expect(renderer.replaceHtmlLinks(html, file)).toBe("<a href=\"../README.html\">Readme</a>");
      });

      it("href from nested file to root", () => {
        // file:  input/docs/sub/detail.md
        // dst:  output/docs/sub/detail.html
        // link: output/README.html
        const file = FilePath.new("docs/sub/detail.md", inDir);
        const html = "<a href=\"@/README.html\">Readme</a>";
        expect(renderer.replaceHtmlLinks(html, file)).toBe("<a href=\"../../README.html\">Readme</a>");
      });

      it("href from root to nested file", () => {
        // file:  input/README.md
        // dst:  output/README.html
        // link: output/docs/guide.html
        const file = FilePath.new("README.md", inDir);
        const html = "<a href=\"@/docs/guide.html\">Guide</a>";
        expect(renderer.replaceHtmlLinks(html, file)).toBe("<a href=\"docs/guide.html\">Guide</a>");
      });

      it("href between sibling files", () => {
        // file:  input/docs/guide.md
        // dst:  output/docs/guide.html
        // link: output/sub/detail.html
        const file = FilePath.new("docs/guide.md", inDir);
        const html = "<a href=\"@/docs/sub/detail.html\">Detail</a>";
        expect(renderer.replaceHtmlLinks(html, file)).toBe("<a href=\"sub/detail.html\">Detail</a>");
      });

      it("src attributes too", () => {
        const file = FilePath.new("docs/guide.md", inDir);
        const html = "<img src=\"@/images/logo.png\">";
        expect(renderer.replaceHtmlLinks(html, file)).toBe("<img src=\"../images/logo.png\">");
      });
    });

    it("should leave non-@/ links unchanged", () => {
      const file = FilePath.new("docs/guide.md", inDir);
      const html = "<a href=\"README.html\">Readme</a>";
      expect(renderer.replaceHtmlLinks(html, file)).toBe(html);
    });

    it("should output forward slashes on Windows", () => {
      const file = (process.platform === "win32")
        ? FilePath.new("docs\\guide.md", inDir)
        : FilePath.new("docs/guide.md", inDir);
      const html = "<a href=\"@/README.html\">Readme</a>";
      const result = renderer.replaceHtmlLinks(html, file);
      expect(result).not.toContain("\\");
      expect(result).toContain("../README.html");
    });
  });
});


describe("CMarkdown", () => {
  it("initial mathcss has contents", () => {
    const md = new CMarkdown();
    expect(md.mathcss().trim().replaceAll("\n", "").length).toBeGreaterThan(0);
  });
});