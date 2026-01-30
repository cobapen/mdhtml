import fs, { existsSync } from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { text as readStreamAsText } from "node:stream/consumers";
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
  #md: CMarkdown;
  #mdr: MdHtmlRenderer;
  #print: PrintFn;
  #mathcache: string;

  constructor(args?: Partial<Options>) {
    this.#options = { ...defaultOptions, ...args };
    this.#tmplProvider = new TemplateProvider();
    this.#pathProvider = new PathProvider();
    this.#print = this.#options.quiet ? () => {} : console.log;
    this.#md = new CMarkdown();
    this.#mdr = new MdHtmlRenderer(this.#md, this.#pathProvider);
    this.#mathcache = "";
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
        throw new MdHtmlError("--stdout cannot be used when input is directory");
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
  
  /**
   * Convert markdown to HTML.
   *  
   * If input is file, the conversion mode is "single file mode".
   * If input is directory, the conversion mode is "directory mode".
   * 
   * @param input     conversion source
   * @param output    conversion output.
   * @param template  template to use
   */
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

  /**
   * Watch to convert markdown.
   *  
   * If input is file, the conversion mode is "single file mode".
   * If input is directory, the conversion mode is "directory mode".
   * 
   * @param input       conversion source
   * @param output      conversion output
   * @param template    template to use
   */
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

  /**
   * Convert single file.
   * 
   * In a single file conversion mode, one HTML file is generated. 
   * The paths are relative from the working directory (cwd).
   * 
   * Stdout/Math options take effects and slightly changes the behavior.
   * 
   * @param input       markdown file path.
   * @param output      output html file path.
   * @param template    HTML template to use 
   * @returns 
   */
  async convertSingle(input: FilePath, output: string, template: HtmlTemplate): Promise<void> {
    if (this.#options.stdout === true) {
      return this.convertToStdout(input, template);
    }

    const outputPath = FilePath.new(output);
    await this.#mdr.writeFile(input, outputPath, template);
    this.#print("wrote:", outputPath.location);

    if (this.#options.math !== undefined) {
      await this.#writeMathcss();
    }
  }

  /**
   * Convert single file, and print output to stdout.
   * 
   * This method is same as `convertSingle`, but generates no files.
   * 
   * Other options does not take effects. 

   * @param input       markdown file path
   * @param template    template to use
   */
  async convertToStdout(input: FilePath, template: HtmlTemplate): Promise<void> {
    await this.#mdr.writeStream(input, process.stdout, template);
  }

  /**
   * Convert all markdown files in the input directory.
   * 
   * In this mode, input must be a directory. Markdown files are converted to 
   * HTML, other files are copied without modified. 
   * 
   * Stdout option cannot be used in this mode.
   * 
   * @param inputDir    input directory path
   * @param outputDir   ouput directory path
   * @param template    template to use
   */
  async convertDir(inputDir: DirPath, outputDir: DirPath, template: HtmlTemplate): Promise<void> {
    if (this.#options.clean) {
      await outputDir.clean();
    }
    const files = await inputDir.readdir();
    const promises = files.map(async file => {
      const filePath = FilePath.new(file.parentPath + "/" + file.name);
      await this.#transform(filePath, template);
    });
    await Promise.all(promises);

    if (this.#options.math !== undefined) {
      await this.#writeMathcss();
    }
  }

  /**
   * Start watch mode for single file.
   * 
   * The method converts the file once, and start watching the file.
   * 
   * @param input     markdown file path
   * @param output    output html file path
   * @param template 
   */
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

  /**
   * Start watch mode.
   * 
   * The method converts all files first, then converts or copies the source
   * files that have changed.
   * 
   * @param inputDir    input directory
   * @param outputDir   output html directory
   * @param template    template to use
   */
  async watchDir(inputDir: DirPath, outputDir: DirPath, template: string): Promise<void> {
    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    await this.convertDir(inputDir, outputDir, tmpl);
    const renderOnChange = async (filepath: string) => {
      const inputFile = FilePath.new(filepath);
      await this.#transform(inputFile, tmpl);
      await this.#writeMathcss();
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

  async #transform(file: FilePath, template: HtmlTemplate): Promise<void> {
    const relPath = file.getPath(this.#pathProvider.inputDir);
    const outDir = this.#pathProvider.outputDir;

    if (file.ext === ".md") {
      const outputPath = FilePath.new(relPath.replace(/\.md$/i, ".html"), outDir);
      await this.#mdr.writeFile(file, outputPath, template);
      this.#printPath("wrote:", outputPath);
    }
    else if (file.isFile()) {
      const outputPath = FilePath.new(relPath, outDir);
      await outputPath.parent.mkdir();
      await copyFile(file.absPath, outputPath.absPath, fs.constants.COPYFILE_FICLONE);
      this.#printPath("copied:", outputPath);
    }
  }
  
  async #writeMathcss(): Promise<void> {
    if (this.#options.math) {
      const mathcss = this.#md.mathcss()
        .replace(/\n*$/, ""); // bug? remove empty lines at end of file
      if (this.#mathcache !== mathcss) {
        const dstPath = this.#pathProvider.relativeFromOutput(this.#options.math);
        await dstPath.parent.mkdir();
        await writeFile(dstPath.absPath, mathcss);
        this.#printPath("wrote:", dstPath);
        this.#mathcache = mathcss;
      }
    }
  }

  #printPath(msg: string, file: FilePath, refDir: DirPath = this.#pathProvider.outputDir) {
    const relPath = file.getPath(refDir);
    const path = relPath.startsWith("..") ? file.absPath : relPath;
    this.#print(msg, path);
  }
}

export class MdHtmlRenderer {
  readonly #md: CMarkdown;
  readonly #pathProvider: PathProvider;
  
  constructor(md: CMarkdown, pathProvider: PathProvider) {
    this.#md = md;
    this.#pathProvider = pathProvider;
  }

  /** Open file and write converted HTML to dst. */
  async writeFile(file: FilePath, dst: FilePath|undefined, template: HtmlTemplate): Promise<void> {
    if (dst === undefined) {
      return this.writeStream(file, process.stdout, template);
    } 
    else {
      await dst.parent.mkdir();
      const w = dst.getWriteStream();
      return this.writeStream(file, w, template);
    }
  }

  /** Open file and write converted HTML to stream */
  async writeStream(filePath: FilePath, w: Writable, template: HtmlTemplate): Promise<void> {
    const content = await readFile(filePath.absPath, "utf-8");
    return this.write(Readable.from(content), filePath, w, template);
    
  }

  /** Convert markdown and write HTML to stream*/
  async write(md: string|Readable, fileLocation: string|FilePath, w: Writable, template: HtmlTemplate, ): Promise<void> {
    if (md instanceof Readable) { 
      md = await readStreamAsText(md);
    }
    if (typeof fileLocation === "string") { 
      fileLocation = FilePath.new(fileLocation);
    }
    const html = this.renderMarkdown(md, fileLocation, template);
    await pipeline(Readable.from(html), w);
  }

  renderMarkdown(content: string, fileLocation: FilePath, template: HtmlTemplate) : string {
    let html = this.#md.render(content, {
      file: fileLocation.location,
    });
    html = mustache.render(template.content, {
      title: fileLocation.filename,
      content: html
    });
    html = this.replaceHtmlLinks(html, fileLocation);
    return html;
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