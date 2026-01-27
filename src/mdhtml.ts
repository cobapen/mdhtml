import fs, { createWriteStream, existsSync } from "node:fs";
import { copyFile, readFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { CMarkdown } from "@cobapen/markdown";
import chokidar from "chokidar";
import mustache from "mustache";
import { DirPath, FilePath, PathUtils } from "./pathutil.js";
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
  // #_pathProvider: PathProvider;
  #tmplProvider: TemplateProvider;
  #print: PrintFn;

  constructor(args?: Partial<Options>) {
    const options = { ...defaultOptions, ...args };
    this.#tmplProvider = new TemplateProvider();
    this.#md = new CMarkdown();
    this.#print = options.quiet ? () => {} : console.log;
  }

  async convert(input: string, output: string, template: string): Promise<void> {

    const tmpl = await this.#tmplProvider.resolveTemplate(template);

    const inputPath = PathUtils.open(input);
    if (inputPath.kind === "file") {
      await this.convertSingle(inputPath, output, tmpl);
    }
    else if (inputPath.kind === "dir") {
      const outputPath = new DirPath(output);
      await this.convertDir(inputPath, outputPath, tmpl);
    }
  }

  async watch(input: string, output: string, template: string): Promise<void> {
    const inputPath = PathUtils.open(input);
    if (inputPath.kind === "file") {
      await this.watchSingle(inputPath, output, template);
    }
    else if (inputPath.kind === "dir") {
      const outputPath = new DirPath(output);
      await this.watchDir(inputPath, outputPath, template);
    }
  }

  async convertSingle(input: FilePath, output: string, template: HtmlTemplate): Promise<void> {

    if (output === undefined)
      output = "";

    const outputPath = new FilePath(output);
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
      const srcFile = new FilePath(relPath, inputDir);

      if (srcFile.ext === ".md") {
        const outputPath = new FilePath(relPath.replace(/\.md$/i, ".html"), outputDir);
        await outputPath.parent.mkdir();
        const wstream = createWriteStream(outputPath.absPath);
        await this.renderFileWithTemplate(srcFile, wstream, template);
        this.#print("wrote:", outputPath.location);
      }
      else if (srcFile.isFile()) {
        const outputPath = new FilePath(relPath, outputDir);
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
    const html = this.#md.render(content);
    const outputHtml = mustache.render(tmpl.content, {
      title: file.filename,
      content: html
    });
    await pipeline(Readable.from(outputHtml), w);
  }
}

