import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import chokidar from "chokidar";
import { vol, Volume } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MdHtmlConverter, Options } from "../../src/mdhtml.js";
import vfs from "../vfs.js";

vi.mock("node:fs", () => vi.importActual("../_mocks/fs.cjs"));
vi.mock("node:fs/promises", () => vi.importActual("../_mocks/fs/promises.cjs"));
vi.mock("chokidar", () => vi.importActual("../_mocks/chokidar.js"));

const fpath = {
  file_md:"file.md",
  file_html: "file.html",
  test_md: "test.md",
  test_html: "test.html",
  input_dir: "input",
  child_dir: "input/child",
  template_html:"template.html",
  abs_file_md:"/test/absFile.md",
  abs_template_html:"/test/absTemplate.html",
  output: "output",
  output_html: "output.html",
  output_xxx: "output.xxx",
};

describe.sequential("Conversion Tests", () => {
  beforeEach(async () => {
    vol.reset();
    // node:process is not mocked, so currentDir initially not exist in memfs.

    await vfs.writeFile(fpath.file_md, "This is file");
    await vfs.writeFile(fpath.template_html, "{{{content}}}");
    await vfs.writeFile(fpath.abs_file_md, "abyss");
    await vfs.writeFile(fpath.abs_template_html, "abs:{{{content}}}");
    await vfs.writeFile(join(fpath.input_dir, fpath.file_md), "Hello World!");
    await vfs.writeFile(join(fpath.input_dir, fpath.test_md), "This is test");
    // await vfs.writeFile(fpath.child_dir + "/" + fpath.file_md, "Child file");

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  type Verifier = () => Promise<void> | void;
  type ValidateFn<T> = (value: T) => void;

  type TestPatterns = {
    name: string,
    input: string,
    output?: string,
    template?: string,
    options?: Partial<Options>,
    verify: Verifier[],
  };

  function expectVolume(cb: ValidateFn<Volume>): Verifier {
    return () => cb(vol);
  }

  function expectFileExists(filepath: string, exist: boolean = true): Verifier {
    return () => expect(existsSync(filepath)).toBe(exist);
  }

  function expectFileContents(filepath: string, expected: string|ValidateFn<string>): Verifier {
    return async () => {
      const contents = await fs.readFile(filepath, { encoding: "utf-8" });
      expected instanceof Function
        ? expected(contents)
        : expect(contents).toEqual(expected);
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

  function expectWatchCalled(input: string | string[]): Verifier {
    return () => {
      expect(chokidar.watch).toHaveBeenCalledWith(input, { persistent: true, ignoreInitial: true });
    };
  }
  
  function createConverter(option?: Partial<Options>) {
    return new MdHtmlConverter({
      quiet: undefined,
      clean: undefined,
      ...option,
    });
  }

  /**
   * Test Patterns
   * 
   * mdhtml <input> --output <output> --template <template> [+other options]
   * 
   * <input>
   * - file.md    (file)
   * - /file.md   (file, absPath)
   * - input      (dir)
   * - /input     (dir, absPath)
   * - not-found
   * 
   * <output>
   * - output     (file)
   * - output.x   (file)
   * - /output.x  (file, absPath)
   * - output     (dir)
   * - output.x   (dir)
   * - /output.x  (dir, absPath)
   * - none       
   * - collide    (already exists as invalid type)
   * 
   * <template>
   * - name     (embed)
   * - path     (file)
   * - /path    (file, absPath)
   * - @/path   (file, underDir)
   * - none     (use default)
   * - not-found
   * 
   */


  const validTestPatterns: TestPatterns[] = [
    {
      name: "single file",
      input: fpath.file_md,
      output: fpath.file_html,
      template: fpath.template_html,
      verify: [
        expectFileExists(fpath.file_html),
        expectConvertLogPrinted(fpath.file_html),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with output (no ext)",
      input: fpath.file_md,
      output: fpath.output,
      template: undefined,
      verify: [
        expectFileExists(fpath.output),
        expectConvertLogPrinted(fpath.output),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file --> output.html",
      input: fpath.file_md,
      output: fpath.output_html,
      template: undefined,
      verify: [
        expectFileExists(fpath.output_html),
        expectConvertLogPrinted(fpath.output_html),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file --> output.xxx",
      input: fpath.file_md,
      output: fpath.output_xxx,
      template: undefined,
      verify: [
        expectFileExists(fpath.output_xxx),
        expectConvertLogPrinted(fpath.output_xxx),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file --> /output.html (abs path)",
      input: fpath.file_md,
      output: "/xxx/output.html",
      template: undefined,
      verify: [
        expectFileExists(resolve("/xxx/output.html")),
        expectConvertLogPrinted(resolve("/xxx/output.html")),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file --> file.html with template",
      input: fpath.file_md,
      output: fpath.file_html,
      template: fpath.template_html,
      verify: [
        expectFileExists(fpath.file_html),
        expectConvertLogPrinted(fpath.file_html),
        expectFileContents(fpath.file_html, "<p>This is file</p>\n"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with template (absolute)",
      input: fpath.file_md,
      output: fpath.file_html,
      template: fpath.abs_template_html,
      verify: [
        expectFileExists(fpath.file_html),
        expectConvertLogPrinted(fpath.file_html),
        expectFileContents(fpath.file_html, "abs:<p>This is file</p>\n"),
        expectStdOutLines(1),
      ]
    },
    {
      name: "single file with quiet mode",
      input: fpath.file_md,
      output: fpath.file_html,
      template: undefined,
      options: { quiet: true },
      verify: [
        expectFileExists(fpath.file_html),
        expectConvertLogPrinted(fpath.file_html, false),
        expectStdOutLines(0),
      ]
    },
    // {
    //   name: "single file with math option",
    //   input: fpath.file_md,
    //   output: fpath.file_html,
    //   template: undefined,
    //   options: { math: "math.css" },
    //   verify: [
    //     expectFileExists(fpath.file_html),
    //     expectConvertLogPrinted(fpath.file_html),
    //     expectFileExists("math.css"),
    //     expectConvertLogPrinted("math.css"),
    //     expectStdOutLines(2),
    //   ]
    // },
    // // {
    // //   name: "single file with math option (full)",
    // //   input: fpath.file_md,
    // //   output: fpath.file_html,
    // //   template: undefined,
    // //   options: { math: "math.css:full" },
    // //   verify: [
    // //     expectFileExists(fpath.file_html),
    // //     expectFileExists("math.css"),
    // //   ],
    // // },
    // // {
    // //   name: "single file, absolute output + math option",
    // //   input: "/test/absFile.md",
    // //   output: "/test2/output.txt",
    // //   template: fpath.abs_template_html,
    // //   options: { math: "math.css:full" },
    // //   verify: [
    // //     expectFileExists("/test2/output.txt"),
    // //     expectFileExists("/test2/math.css"),
    // //   ],
    // // },
    {
      name: "single file with clean option (?)",
      input: fpath.file_md,
      output: fpath.file_html,
      template: undefined,
      options: { clean: true },
      verify: [
        expectFileExists(fpath.file_html),
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
      input: fpath.input_dir,
      output: fpath.output,
      template: undefined,
      verify: [
        expectFileExists(resolve(fpath.output, fpath.test_html)),
        expectFileContents(resolve(fpath.output, fpath.test_html), contents => {
          expect(contents).toContain("<p>This is test</p>");
        }),
        
      ]
    },
    {
      name: "input directory with ignore (skip test.md)",
      input: fpath.input_dir,
      output: fpath.output,
      template: undefined,
      options: { ignore: [fpath.test_md] },
      verify: [
        expectFileExists(resolve(fpath.output, fpath.test_html), false),
        expectFileExists(resolve(fpath.output, fpath.file_html)),
      ]
    },
    // {
    //   name: "input directory with template",
    //   input: fpath.input_dir,
    //   output: fpath.output,
    //   template: fpath.template_html,
    //   verify: [
    //     expectFileExists("output/test.html"),
    //     expectFileContents("output/test.html", "<p>Hello World!</p>\n"),
    //   ]
    // },
    // {
    //   name: "input directory with math option",
    //   input: fpath.subdir_name,
    //   output: fpath.output,
    //   template: undefined,
    //   options: { math: "math.css" },
    //   verify: [
    //     expectFileExists("output/_template.html"),
    //     expectFileExists("output/test.html"),
    //     expectFileExists("output/math.css"),
    //   ]
    // },
    // {
    //   name: "input directory with math option (full)",
    //   input: fpath.subdir_name,
    //   output: fpath.output,
    //   template: undefined,
    //   options: { math: "math.css:full" },
    //   verify: [
    //     expectFileExists("output/_template.html"),
    //     expectFileExists("output/test.html"),
    //     expectFileExists("output/math.css"),
    //   ]
    // }
  ];

  validTestPatterns.forEach(({ name, input, output, template, options, verify }) => {
    it(name, async () => {
      const converter = createConverter(options);
      await converter.convert(input, output, template);
      for (const check of verify) {
        await check();
      }
      vi.clearAllMocks();
    });
  });

  // it ("run twice and check dst folder is cleaned", async () => {
  //   const converter = createConverter({ clean: true });
  //   await converter.convert(fpath.subdir_name, fpath.output, "");
  //   await fs.writeFile("output/dummy.txt", "12345");
  //   await converter.convert(fpath.subdir_name, fpath.output, "");
  //   const verify = [
  //     expectFileExists("output/test.html"),
  //     expectFileExists("output/dummy.txt", false),
  //   ];
  //   for (const check of verify) {
  //     await check();
  //   }
  // });

  // it ("watch file", async () => {
  //   const converter = createConverter();
  //   await converter.watch(fpath.file_md, fpath.file_html, "");
  //   const verify = [
  //     expectFileExists(fpath.file_html),
  //     expectConvertLogPrinted(fpath.file_html),
  //     expectStdOutLines(1),  
  //     expectWatchCalled(resolve(fpath.file_md))
  //   ];
  //   for (const check of verify) {
  //     await check();
  //   }
  // });

  // it ("watch directory", async () => {
  //   const converter = createConverter();
  //   await converter.watch(fpath.subdir_name, fpath.output, fpath.template_html);
  //   const verify = [
  //     expectFileExists("output/_template.html"),
  //     expectFileExists("output/test.html"),
  //     expectStdOutLines(4),  
  //     expectConvertLogPrinted("output/test.html".replaceAll(/\//g, path.sep)),
  //     expectWatchCalled([path.resolve(fpath.subdir_name), fpath.template_html]),
  //   ];
  //   for (const check of verify) {
  //     await check();
  //   }
  // });

  it("sample", () => {
    expect(1 + 1).toBe(2);
  });
});

