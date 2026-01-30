import fs, { createWriteStream, existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
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
  stdout: boolean     // Output to stdout
  math?: string       // Output path to the stylesheet
};

const defaultOptions: Options = {
  quiet: false,
  clean: false,
  stdout: false,
  math: undefined,
};

export class MdHtmlConverter {
  #options: Options;
  #pathProvider: PathProvider;
  #tmplProvider: TemplateProvider;
  #mdr: MdHtmlRenderer;
  #print: PrintFn;

  constructor(args?: Partial<Options>) {
    this.#options = { ...defaultOptions, ...args };
    this.#tmplProvider = new TemplateProvider();
    this.#pathProvider = new PathProvider();
    this.#print = this.#options.quiet ? () => {} : console.log;
    this.#mdr = new MdHtmlRenderer(new CMarkdown(), this.#pathProvider);
  }

  checkArguments(input: string, output?: string, template?: string) {
    const inputPath = PathUtils.open(input);

    // Check input and output. ---------------------------
    if (inputPath.kind === "file") {
      if (output === undefined) {
        // OK
      }
      else if (output.trim().length === 0) {
        throw new MdHtmlError("output file cannot be empty");
      }
    }
    else {
      if (output === undefined || output.trim().length === 0) {
        throw new MdHtmlError("output dir is not specified");
      }
      if (this.#options.stdout === true) {
        throw new MdHtmlError("--stdout cannot be used when input is a directory");
      }
    }

    // Check template. --------------------------------------
    if (template === undefined) {
      // OK
    }
    else if (template !== undefined && template.trim().length === 0) {
      throw new MdHtmlError("template name cannot be empty");
    }
    else if (!this.#tmplProvider.isPredefined(template) && !FilePath.new(template).exists()) {
      throw new MdHtmlError(`template not found: ${template}`);
    }
  }
  

  async convert(input: string, output?: string, template?: string): Promise<void> {
    this.checkArguments(input, output, template);
    output = output ?? PathProvider.defaultOutput(input);
    template = template ?? TemplateProvider.defaultTemplateName;
    
    const inputPath = PathUtils.open(input);
    const tmpl = await this.#tmplProvider.resolveTemplate(template);    
    
    if (inputPath.kind === "file") {
      this.#pathProvider.configureForSingle();
      await this.convertSingle(inputPath, output, tmpl);
    }
    else if (inputPath.kind === "dir") {
      const outputDir = DirPath.new(output);
      this.#pathProvider.configure(inputPath, outputDir);
      await this.convertDir(inputPath, outputDir, tmpl);
    }
  }

  async watch(input: string, output?: string, template?: string): Promise<void> {
    this.checkArguments(input, output, template);
    output = output ?? PathProvider.defaultOutput(input);
    template = template ?? TemplateProvider.defaultTemplateName;
    
    const inputPath = PathUtils.open(input);
    if (inputPath.kind === "file") {
      this.#pathProvider.configureForSingle();
      await this.watchSingle(inputPath, output, template);
    }
    else if (inputPath.kind === "dir") {
      const outputDir = DirPath.new(output);
      this.#pathProvider.configure(inputPath, outputDir);
      await this.watchDir(inputPath, outputDir, template);
    }
  }

  async convertSingle(input: FilePath, output: string, template: HtmlTemplate): Promise<void> {
    if (this.#options.stdout === true) {
      return this.convertToStdout(input, template);
    }

    const outputPath = FilePath.new(output);
    // If output path already exists as directory, throw error.
    // The only exception is when output is empty, then use stdout.
    if (outputPath.exists() && outputPath.isDir()) {
      if (outputPath.raw.length === 0) {
        return this.convertToStdout(input, template);
      }
      else {
        throw new MdHtmlError(`Error: output=${output} already exists as a directory.`);
      }
    } 
    
    await outputPath.parent.mkdir();
    const w = outputPath.getWriteStream();
    await this.#mdr.renderFile(input, w, template);
    
    this.#print("wrote:", outputPath.location);

    if (this.#options.math !== undefined) {
      await this.#writeMathcss();
    }
  }

  async convertToStdout(input: FilePath, template: HtmlTemplate): Promise<void> {
    const w: Writable = process.stdout;
    await this.#mdr.renderFile(input, w, template);
  }

  async convertDir(inputDir: DirPath, outputDir: DirPath, template: HtmlTemplate): Promise<void> {
    if (this.#options.clean) {
      await outputDir.clean();
    }
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
        await this.#mdr.renderFile(srcFile, wstream, template);
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

    if (this.#options.math !== undefined) {
      await this.#writeMathcss();
    }
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

  async #writeMathcss(): Promise<void> {
    if (this.#options.math !== undefined) {
      const dstPath = this.#pathProvider.relativeFromOutput(this.#options.math);
      await this.#mdr.writeMathcss(dstPath);
      this.#print("wrote:", dstPath.location);
    }
  }

  
}

export class MdHtmlRenderer {
  #md: CMarkdown;
  #pathProvider: PathProvider;
  
  constructor(md: CMarkdown, pathProvider: PathProvider) {
    this.#md = md;
    this.#pathProvider = pathProvider;
  }

  async renderFile(file: FilePath, w: Writable, template: HtmlTemplate): Promise<void> {
    const content = await readFile(file.absPath, "utf-8");
    return this.renderMarkdown(content, file, w, template);
  }

  async renderMarkdown(content: string, fileLocation: FilePath, w: Writable, template: HtmlTemplate): Promise<void> {
    let html = this.#md.render(content, {
      file: fileLocation.location,
    });
    html = mustache.render(template.content, {
      title: fileLocation.filename,
      content: html
    });
    html = this.replaceHtmlLinks(html, fileLocation);
    await pipeline(Readable.from(html), w);
  }

  async writeMathcss(dstPath: FilePath): Promise<void> {
    await dstPath.parent.mkdir();
    await writeFile(dstPath.absPath, this.#md.mathcss());
  }

  replaceHtmlLinks(html: string, file: FilePath): string {
    const regex = /(href|src)\s*=\s*["']([^"']+)["']/g;
    return html.replace(regex, (match, attr: string, link: string) => {
      if (link.startsWith("@/")) {
        const target = this.#pathProvider.relativeFromInput(link);
        const newLink = target.getPath(file.parent).replace(/\\/g, "/");
        return `${attr}="${newLink}"`;
      }
      return match;
    });
  }  
}

export class PathProvider {

  #inputDir = DirPath.new(process.cwd());
  #outputDir = DirPath.new(process.cwd());
  constructor() {}

  get inputDir(): DirPath { return this.#inputDir; }
  get outputDir(): DirPath { return this.#outputDir; }

  configureForSingle() {
    this.#inputDir = DirPath.cwd();
    this.#outputDir = DirPath.cwd();
  }

  configure(input: DirPath, output: DirPath) {
    this.#inputDir = input;
    this.#outputDir = output;
  }

  relativeFromInput(path: string): FilePath {
    if (path.startsWith("@/")) {
      return FilePath.new(path.substring(2), this.#inputDir);
    } else {
      return FilePath.new(path, this.#inputDir);
    }
  }

  relativeFromOutput(path: string): FilePath {
    if (path.startsWith("@/")) {
      return FilePath.new(path.substring(2), this.#outputDir);
    } else {
      return FilePath.new(path, this.#outputDir);
    }
  }

  /** Get default output path. (Valid only for single mode) */
  static defaultOutput(input: string): string {
    return path.basename(input, path.extname(input)) + ".html";
  }
}

export class MdHtmlError extends Error {}