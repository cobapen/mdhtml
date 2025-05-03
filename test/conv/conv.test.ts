import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import chokidar from "chokidar";
import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MdHtmlConverter, Options } from "../../src/mdhtml.js";

vi.mock("node:fs", () => vi.importActual("../_mocks/fs.cjs"));
vi.mock("node:fs/promises", () => vi.importActual("../_mocks/fs/promises.cjs"));
vi.mock("chokidar", () => vi.importActual("../_mocks/chokidar.js"));

describe.sequential("Conversion Tests", () => {
  beforeEach(async () => {
    vol.reset();
    // node:process is not mocked, so currentDir initially not exist in memfs.
    await fs.mkdir("/test", { recursive: true });
    await fs.mkdir("input", { recursive: true });
    await fs.mkdir("input-dir", { recursive: true });
    await fs.mkdir("input-dir/abc", { recursive: true });
    await fs.writeFile("input-dir/_template.html", "{{{content}}}");
    await fs.writeFile("input-dir/test.md", "Hello World!");
    await fs.writeFile("file.md", "This is file");
    await fs.writeFile("/test/absTemplate.html", "abs:{{{content}}}");
    await fs.writeFile("/test/absFile.md", "abyss");

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  type Verifier = () => Promise<void> | void;

  type TestPatterns = {
    name: string,
    input: string,
    options: Partial<Options>,
    verify: Verifier[],
  };

  function expectFileExists(filepath: string, exist: boolean = true): Verifier {
    return () => expect(existsSync(filepath)).toBe(exist);
  }

  function expectFileContents(filepath: string, expected: string): Verifier {
    return async () => {
      const contents = await fs.readFile(filepath, { encoding: "utf-8" });
      expect(contents).toEqual(expected);
    };
  }

  function expectStdOutLines(n: number): Verifier {
    return () => expect(console.log).toHaveBeenCalledTimes(n);
  }

  function expectConvertLogPrinted(filename: string, flag: boolean = true): Verifier {
    return () => {
      if (flag) {
        expect(console.log).toHaveBeenCalledWith("wrote:", filename);
      } else {
        expect(console.log).not.toHaveBeenCalledWith("wrote:", filename);
      }
    };
  }

  function expectWatchCalled(input: string): Verifier {
    return () => {
      expect(chokidar.watch).toHaveBeenCalledWith(input, { persistent: true, ignoreInitial: true });
    };
  }
  
  function createConverter(option?: Partial<Options>) {
    return new MdHtmlConverter({
      template: undefined,
      output: undefined,
      quiet: undefined,
      clean: undefined,
      ...option,
    });
  }

  const validTestPatterns: TestPatterns[] = [
    // file.md
    // file.md --output output,
    // file.md --output output.html,
    // file.md --output output.xxx,
    // file.md --output /somewhere/abs.html,
    // file.md --template template.html",
    // file.md --template /template.html",
    // file.md --quiet",
    // file.md --clean",
    // file.md --math math.css:full",
    {
      name: "single file",
      input: "file.md",
      options: {},
      verify: [
        expectFileExists("file.html"),
        expectConvertLogPrinted("file.html"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with output specified (no ext)",
      input: "file.md",
      options: { output: "output" },
      verify: [
        expectFileExists("output.html"),
        expectConvertLogPrinted("output.html"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with output specified (with ext html)",
      input: "file.md",
      options: { output: "output.html" },
      verify: [
        expectFileExists("output.html"),
        expectConvertLogPrinted("output.html"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with output specified (with ext xxx)",
      input: "file.md",
      options: { output: "output.xxx" },
      verify: [
        expectFileExists("output.xxx"),
        expectConvertLogPrinted("output.xxx"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with output specified (abs path)",
      input: "file.md",
      options: { output: "/xxx/output" },
      verify: [
        expectFileExists("/xxx/output.html"),
        expectConvertLogPrinted("/xxx/output.html"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with template (relative)",
      input: "file.md",
      options: { template: "input-dir/_template.html" },
      verify: [
        expectFileExists("file.html"),
        expectConvertLogPrinted("file.html"),
        expectFileContents("file.html", "<p>This is file</p>\n"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with template (absolute)",
      input: "file.md",
      options: { template: "/test/absTemplate.html" },
      verify: [
        expectFileExists("file.html"),
        expectConvertLogPrinted("file.html"),
        expectFileContents("file.html", "abs:<p>This is file</p>\n"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with quiet mode",
      input: "file.md",
      options: { quiet: true },
      verify: [
        expectFileExists("file.html"),
        expectConvertLogPrinted("file.html", false),
        expectStdOutLines(0),
      ]
    },
    {
      name: "single file with math option",
      input: "file.md",
      options: { math: "math.css" },
      verify: [
        expectFileExists("file.html"),
        expectConvertLogPrinted("file.html"),
        expectFileExists("math.css"),
        expectConvertLogPrinted("math.css"),
        expectStdOutLines(2),
      ]
    },
    {
      name: "single file with math option (full)",
      input: "file.md",
      options: { math: "math.css:full" },
      verify: [
        expectFileExists("file.html"),
        expectFileExists("math.css"),
      ],
    },
    {
      name: "single file, absolute output + math option",
      input: "/test/absFile.md",
      options: { 
        template: "/test/absTemplate.html",
        output: "/test2/output.txt",
        math: "math.css:full"
      },
      verify: [
        expectFileExists("/test2/output.txt"),
        expectFileExists("/test2/math.css"),
      ],
    },
    {
      name: "single file with clean option (?)",
      input: "file.md",
      options: { clean: true },
      verify: [
        expectFileExists("file.html"),
      ],
    },
    // "input",
    // "input -q/--quiet",
    // "input -w/--watch",
    // "input --clean",
    // "input --math",
    // "input --math math.css",
    // "input --math math.css:full",
    {
      name: "input directory (no template)",
      input: "input-dir",
      options: {},
      verify: [
        expectFileExists("output/_template.html"),
        expectFileExists("output/test.html"),
        expectFileContents("output/test.html", "<p>Hello World!</p>\n"),
      ]
    },
    {
      name: "input directory with template (template name)",
      input: "input-dir",
      options: { template: "_template.html" },
      verify: [
        expectFileExists("output/_template.html"),
        expectFileExists("output/test.html"),
        expectFileContents("output/test.html", "<p>Hello World!</p>\n"),
      ]
    },
    {
      name: "input directory with math option",
      input: "input-dir",
      options: { math: "math.css" },
      verify: [
        expectFileExists("output/_template.html"),
        expectFileExists("output/test.html"),
        expectFileExists("output/math.css"),
      ]
    },
    {
      name: "input directory with math option (full)",
      input: "input-dir",
      options: { math: "math.css:full" },
      verify: [
        expectFileExists("output/_template.html"),
        expectFileExists("output/test.html"),
        expectFileExists("output/math.css"),
      ]
    }
  ];

  validTestPatterns.forEach(({ name, input, options, verify }) => {
    it(name, async () => {
      const converter = createConverter(options);
      await converter.convert(input);
      for (const check of verify) {
        await check();
      }
    });
  });

  it ("run twice and check dst folder is cleaned", async () => {
    const converter = createConverter({ clean: true });
    await converter.convert("input-dir");
    await fs.writeFile("output/dummy.txt", "12345");
    await converter.convert("input-dir");
    const verify = [
      expectFileExists("output/test.html"),
      expectFileExists("output/dummy.txt", false),
    ];
    for (const check of verify) {
      await check();
    }
  });

  it ("watch file", async () => {
    const converter = createConverter();
    await converter.watch("file.md");
    const verify = [
      expectFileExists("file.html"),
      expectConvertLogPrinted("file.html"),
      expectStdOutLines(1),  
      expectWatchCalled("file.md")
    ];
    for (const check of verify) {
      await check();
    }
  });

  it ("watch directory", async () => {
    const converter = createConverter();
    await converter.watch("input-dir");
    const verify = [
      expectFileExists("output/_template.html"),
      expectFileExists("output/test.html"),
      expectStdOutLines(4),  
      expectConvertLogPrinted("output/test.html".replaceAll(/\//g, path.sep)),
      expectWatchCalled("input-dir"),
    ];
    for (const check of verify) {
      await check();
    }
  });
});

