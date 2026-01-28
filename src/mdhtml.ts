import fs, { createWriteStream, existsSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CMarkdown } from "@cobapen/markdown";
import chokidar from "chokidar";
import Token from "markdown-it/lib/token.mjs";
import mustache from "mustache";
import { DirPath, FilePath, PathUtils, ResolvedPath } from "./pathutil.js";
import { HtmlTemplate, TemplateProvider } from "./template.js";

type PrintFn = (...args: any[]) => void;

export type Options = {
  quiet: boolean,     // Do not print successful log messages
  clean: boolean,     // Remove dst folder before conversion
  math: string        // Output path to the stylesheet
};

const defaultOptions: Options = {
  quiet: false,
  clean: false,
  math: "math.css",
};

export class MdHtmlConverter {
  #md: CMarkdown;
  #linkResolver: MdLinkResolver;
  #tmplProvider: TemplateProvider;
  #print: PrintFn;

  constructor(args?: Partial<Options>) {
    const options = { ...defaultOptions, ...args };
    this.#tmplProvider = new TemplateProvider();
    this.#linkResolver = new MdLinkResolver();
    this.#print = options.quiet ? () => {} : console.log;
    this.#md = new CMarkdown({
      linkRewrite: this.#linkResolver.rewriteLink.bind(this.#linkResolver),
    });
  }

  async convert(input: string, output: string, template: string): Promise<void> {
    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    const inputPath = PathUtils.open(input);
    if (inputPath.kind === "file") {
      this.#linkResolver.configure(inputPath.parent);
      await this.convertSingle(inputPath, output, tmpl);
    }
    else if (inputPath.kind === "dir") {
      const outputPath = DirPath.new(output);
      this.#linkResolver.configure(inputPath);
      await this.convertDir(inputPath, outputPath, tmpl);
    }
  }

  async watch(input: string, output: string, template: string): Promise<void> {
    const inputPath = PathUtils.open(input);
    if (inputPath.kind === "file") {
      this.#linkResolver.configure(inputPath.parent);
      await this.watchSingle(inputPath, output, template);
    }
    else if (inputPath.kind === "dir") {
      const outputPath = DirPath.new(output);
      this.#linkResolver.configure(inputPath);
      await this.watchDir(inputPath, outputPath, template);
    }
  }

  async convertSingle(input: FilePath, output: string, template: HtmlTemplate): Promise<void> {
    if (output === undefined)
      output = "";
    const outputPath = FilePath.new(output);
    let w: Writable;
    
    // If output path already exists as directory, throw error.
    // The only exception is when output is empty, then use stdout.
    if (outputPath.exists() && outputPath.isDir()) {
      if (outputPath.raw.length > 0) {
        throw new Error(`Error: output=${output} already exists as a directory.`);
      }
      w = process.stdout;
    } 
    else {
      await outputPath.parent.mkdir();
      w = outputPath.getWriteStream();
    }
    await this.renderFileWithTemplate(input, w, template);
    if (w !== process.stdout) {
      this.#print("wrote:", outputPath.location);
    }
  }

  async convertDir(inputDir: DirPath, outputDir: DirPath, template: HtmlTemplate): Promise<void> {
    const files = await inputDir.readdir();

    const promises = files.map(async file => {
      // parentPath in dirent is absolute here. For 
      // We need relative file path "from inputDir".
      const filePath = file.parentPath + "/" + file.name;
      const relPath = path.relative(inputDir.absPath, filePath);
      const srcFile = FilePath.new(relPath, inputDir);

      if (srcFile.ext === ".md") {
        const outputPath = FilePath.new(relPath.replace(/\.md$/i, ".html"), outputDir);
        await outputPath.parent.mkdir();
        const wstream = createWriteStream(outputPath.absPath);
        await this.renderFileWithTemplate(srcFile, wstream, template);
        this.#print("wrote:", outputPath.location);
      }
      else if (srcFile.isFile()) {
        const outputPath = FilePath.new(relPath, outputDir);
        await outputPath.parent.mkdir();
        await copyFile(srcFile.absPath, outputPath.absPath, fs.constants.COPYFILE_FICLONE);
        this.#print("copied:", outputPath.location);
      }
    });
    await Promise.all(promises);
  }



  async watchSingle(input: FilePath, output: string, template: string): Promise<void> {
    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    await this.convertSingle(input, output, tmpl);

    const watchlist = [input.absPath];
    const watcher = chokidar.watch(watchlist, {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on("change", async (changedFile) => {
      const file = PathUtils.open(changedFile);
      if (PathUtils.isFilePath(file)) {
        await this.convertSingle(file, output, tmpl);
      }
    });
  }

  async watchDir(inputDir: DirPath, outputDir: DirPath, template: string): Promise<void> {
    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    await this.convertDir(inputDir, outputDir, tmpl);
    const renderOnChange = (filepath: string) => {
      console.log(filepath);
    };
    const watchlist = [inputDir.absPath];
    if (existsSync(template)) {
      watchlist.push(template);
    }
    const watcher = chokidar.watch(watchlist, {
      persistent: true,
      ignoreInitial: true
    });
    watcher
      .on("add", async filePath => {
        await renderOnChange(filePath);
      })
      .on("change", async filePath => {
        await renderOnChange(filePath);
      })
      .on("unlink", (_filepath) => {
        // do nothing?
      });

    this.#print(`Watch started: ${inputDir}`);
  }

  async renderFileWithTemplate(file: FilePath, w: Writable, tmpl: HtmlTemplate): Promise<void> {
    const content = await readFile(file.absPath, "utf-8");
    const html = this.#md.render(content, {
      file: file.location,
    });
    const outputHtml = mustache.render(tmpl.content, {
      title: file.filename,
      content: html
    });
    await pipeline(Readable.from(outputHtml), w);
  }
}

export class MdLinkResolver {

  #inputRef = DirPath.new("");
  constructor() {}

  configure(input: DirPath) {
    this.#inputRef = input;
  }

  /**
   * Resolve markdown links. Absolute links are converted to relative links.
   */
  resolve(file: string, link: string): string {
    if (link.startsWith("@/")) {
      const filePath = FilePath.new(file);
      const target = ResolvedPath.new(link.substring(2), this.#inputRef);
      link = target.pathFrom(filePath.parent).replace(/\\/g, "/");
    }
    return link;
  }

  rewriteLink(link: string, env: any, _token: Token) {
    if (env.file !== undefined) {
      link = this.resolve(env.file, link);
    }
    if (!link.startsWith("http") && link.endsWith(".md")) {
      link = link.replace(/\.md$/i, ".html");
    }
    return link;
  }
}