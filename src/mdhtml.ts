import fs from "node:fs";
import { copyFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { text as readStreamAsText } from "node:stream/consumers";
import { pipeline } from "node:stream/promises";
import { CMarkdown } from "@cobapen/markdown";
import chokidar from "chokidar";
import { DirPath, FilePath, PathUtils } from "./pathutil.js";
import { HtmlTemplate, TemplateProvider } from "./template.js";

type PrintFn = (...args: any[]) => void;

export interface RenderOptions {
  quiet: boolean,         // Do not print successful log messages
  math?: string,          // Math stylesheet path
}

export interface Options extends RenderOptions {
  clean: boolean,       // Clear dst folder before conversion
  stdout: boolean,        // Output to stdout
  mathFontUrl?: string, // URL to the math font
};

const defaultOptions: Options = {
  quiet: false,
  clean: false,
  stdout: false,
  math: undefined,
  mathFontUrl: undefined,
};

export class MdHtmlConverter {
  #options: Options;
  #pathProvider: PathProvider;
  #tmplProvider: TemplateProvider;
  #md: CMarkdown;
  #mdr: MdHtmlRenderer;
  #print: PrintFn;
  #mathcache: string = "";

  constructor(args?: Partial<Options>) {
    this.#options = { ...defaultOptions, ...args };
    this.#tmplProvider = new TemplateProvider();
    this.#pathProvider = new PathProvider();
    this.#print = this.#options.quiet ? () => {} : console.log;
    this.#md = new CMarkdown({
      math: {
        chtml: {
          fontURL: this.#options.mathFontUrl,
        }
      }
    });
    this.#mdr = new MdHtmlRenderer(this.#md, this.#pathProvider);
    this.#mathcache = "";
  }

  /**
   * Check input arguments validity and print messages to the user.
   * 
   * @param input       input option
   * @param output      output option (if specified)
   * @param template    template option (if specified)
   */
  checkArguments(input: string, output?: string, template?: string) {
    // Check input file exists. ---------------------------
    const inputPath = PathUtils.open(input);

    // Check input and output. ---------------------------
    if (inputPath.kind === "file") {
      if (output !== undefined && output.trim().length === 0) {
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
    if (template === undefined) {}
    else if (template !== undefined && template.trim().length === 0) {
      throw new MdHtmlError("template name cannot be empty");
    }
    else if (!this.#tmplProvider.isPredefined(template) && !FilePath.new(template).exists()) {
      throw new MdHtmlError(`template not found: ${template}`);
    }
  }

  #configurePathsForSingle() {
    this.#pathProvider.configure(DirPath.cwd(), DirPath.cwd());
  }

  #configurePaths(input: DirPath, output: DirPath) {
    this.#pathProvider.configure(input, output);
  }

  #configureForTemplate(template: HtmlTemplate): void {
    if (this.#options.math === undefined && template.acceptsMathcss) {
      this.#mdr.embedMathcssEnabled = true;
    } else {
      this.#mdr.embedMathcssEnabled = false;
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
    const inputPath = PathUtils.open(input);
    output = output ?? PathProvider.defaultOutput(input);
    template = template ?? TemplateProvider.defaultTemplateName;

    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    
    if (inputPath.kind === "file") {
      const outputFile = FilePath.new(output);
      await this.#convertSingle(inputPath, outputFile, tmpl);
    }
    else if (inputPath.kind === "dir") {
      const outputDir = DirPath.new(output);
      await this.#convertDir(inputPath, outputDir, tmpl);
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
    const inputPath = PathUtils.open(input);
    output = output ?? PathProvider.defaultOutput(input);
    template = template ?? TemplateProvider.defaultTemplateName;

    if (inputPath.kind === "file") {
      const outputFile = FilePath.new(output);
      await this.#watchSingle(inputPath, outputFile, template);
    }
    else if (inputPath.kind === "dir") {
      const outputDir = DirPath.new(output);
      await this.#watchDir(inputPath, outputDir, template);
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
  async #convertSingle(input: FilePath, output: FilePath, template: HtmlTemplate): Promise<void> {
    if (this.#options.stdout === true) {
      return this.#convertToStdout(input, template);
    }

    this.#configurePathsForSingle();
    this.#configureForTemplate(template);

    await this.#mdr.writeFile(input, output, template);
    this.#printPath("wrote:", output);

    if (this.#options.math !== undefined) {
      await this.#writeMathcss();
    }
  }

  /**
   * Convert single file, and print output to stdout.
   * 
   * This method is same as `convertSingle`, but generates no files.
   * 
   * @param input       markdown file path
   * @param template    template to use
   */
  async #convertToStdout(input: FilePath, template: HtmlTemplate): Promise<void> {
    this.#configurePathsForSingle();
    this.#configureForTemplate(template);
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
  async #convertDir(inputDir: DirPath, outputDir: DirPath, template: HtmlTemplate): Promise<void> {
    this.#configurePaths(inputDir, outputDir);
    this.#configureForTemplate(template);

    if (this.#options.clean) {
      await outputDir.clean();
    }

    const files = await inputDir.readdir();

    // If embed-mathcss is ON, prerender all markdown files and obtain a 
    // full math css before transformation.
    if (this.#mdr.embedMathcssEnabled) {
      const promises = files.map(async file => {
        const filePath = FilePath.new(file.parentPath + "/" + file.name);
        if (filePath.ext === ".md") {
          await this.#prerender(filePath, template);
        }
      });
      for (const p of promises) {
        await p;
      }
    }

    // Transform (copy + convert) all files.
    const promises = files.map(async file => {
      const filePath = FilePath.new(file.parentPath + "/" + file.name);
      await this.#transform(filePath, template);
    });
    for (const p of promises) {
      await p;
    }

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
  async #watchSingle(input: FilePath, output: FilePath, template: string): Promise<void> {
    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    
    await this.#convertSingle(input, output, tmpl);

    const watchlist = [input.absPath];
    const watcher = chokidar.watch(watchlist, {
      persistent: true,
      ignoreInitial: true
    });

    watcher.on("change", async (changedFile) => {
      const file = PathUtils.open(changedFile);
      if (PathUtils.isFilePath(file)) {
        await this.#convertSingle(file, output, tmpl);
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
  async #watchDir(inputDir: DirPath, outputDir: DirPath, template: string): Promise<void> {
    const templateFilePath = FilePath.new(template);
    const tmpl = await this.#tmplProvider.resolveTemplate(template);
    await this.#convertDir(inputDir, outputDir, tmpl);

    const renderOnChange = async (filepath: string) => {
      const changedFile = FilePath.new(filepath);
      await this.#transform(changedFile, tmpl);
      await this.#writeMathcss();
    };

    const onTemplateChange = async () => {
      const newTmpl = await this.#tmplProvider.resolveTemplate(template, { useCache: false });
      this.#mathcache = "";
      this.#configureForTemplate(newTmpl);
      await this.#convertDir(inputDir, outputDir, newTmpl);
    };
    
    const watchlist = [inputDir.absPath];
    if (templateFilePath.exists()) {
      watchlist.push(templateFilePath.absPath);
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
        if (filePath === templateFilePath.absPath) {
          await onTemplateChange();
        } else {
          await renderOnChange(filePath);
        }
      })
      .on("unlink", (_filepath) => {
        // do nothing?
      });

    this.#print(`Watch started: ${inputDir}`);
  }

  async #prerender(file: FilePath, template: HtmlTemplate): Promise<string> {
    const content = await readFile(file.absPath, "utf-8");
    return this.#mdr.renderMarkdown(content, template, file);
  }

  async #transform(file: FilePath, template: HtmlTemplate): Promise<void> {
    const inDir = this.#pathProvider.inputDir;
    const outDir = this.#pathProvider.outputDir;
    const relPath = file.getPath(inDir);

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
      const mathcss = this.#mdr.getMathcss();
      if (this.#mathcache !== mathcss) {
        const dstPath = this.#pathProvider.relativeFromOutput(this.#options.math);
        this.#mdr.writeMathcss(dstPath);
        this.#printPath("wrote:", dstPath);
        this.#mathcache = mathcss;
      }
    }
  }

  #printPath(msg: string, file: FilePath, refDir: DirPath = this.#pathProvider.outputDir): void {
    const relPath = file.getPath(refDir);
    const path = relPath.startsWith("..") ? file.absPath : relPath;
    this.#print(msg, path);
  }
}


export class MdHtmlRenderer {
  readonly #md: CMarkdown;
  readonly #pathProvider: PathProvider;

  #embedMathcss: boolean;
  
  constructor(md: CMarkdown, pathProvider: PathProvider) {
    this.#md = md;
    this.#pathProvider = pathProvider;
    this.#embedMathcss = false;
  }

  get embedMathcssEnabled(): boolean { return this.#embedMathcss; }
  set embedMathcssEnabled(value: boolean) { this.#embedMathcss = value; }

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
  async write(md: string|Readable, filepath: string|FilePath, w: Writable, template: HtmlTemplate, ): Promise<void> {
    if (md instanceof Readable) { 
      md = await readStreamAsText(md);
    }
    if (typeof filepath === "string") { 
      filepath = FilePath.new(filepath);
    }

    const html = this.renderMarkdown(md, template, filepath);
    await pipeline(Readable.from(html), w);
  }

  renderMarkdown(content: string, template: HtmlTemplate, file: FilePath) : string {
    let html = this.#md.render(content, {
      file: file.location,
    });

    // If output contains math and embed math mode is enabled, use embed the
    // css input the output.
    const mathcss = (html.includes("<mjx-") && this.#embedMathcss)
      ? this.getMathcss() : "";

    html = template.render(html, {
      title: file.filename,
      date: new Date(Date.now()),
      mathcss: mathcss,
    });
    html = this.replaceHtmlLinks(html, file);
    return html;
  }
  
  replaceHtmlLinks(html: string, file: FilePath): string {
    const attrs = [
      "href", "src", "action", "formaction", "poster", "cite", "data",
      "manifest", "srcset", "imgsrcset", "ping", "content", "usemap"
    ].join("|");
    
    const regex = new RegExp(`(${attrs})\\s*=\\s*["']([^"']+)["']`, "g");
    const absMarker = "@/";

    const replaceLink = (link: string) =>{
      if (link.startsWith(absMarker)) {
        const target = this.#pathProvider.relativeFromInput(link.substring(2));
        return target.getPath(file.parent).replace(/\\/g, "/");
      } else {
        return link;
      }
    };

    return html.replace(regex, (match, attr: string, value: string) => {
      if (attr === "srcset" || attr === "imgsrcset") {
        const replaced = value.split(",")
          .map(part => part
            .split(" ")
            .map(text => text.startsWith(absMarker) ? replaceLink(text) : text)
            .join(" "))
          .join(",");
        
        return `${attr}="${replaced}"`;
      }
      else if (value.startsWith(absMarker)) {
        return `${attr}="${replaceLink(value)}"`;
      }
      return match;
    });
  }  

  
  async writeMathcss(dstPath: FilePath): Promise<void> {
    const mathcss = this.getMathcss();
    await dstPath.parent.mkdir();
    await writeFile(dstPath.absPath, mathcss);
  }

  getMathcss() : string {
    return this.#md.mathcss().replace(/\n*$/, ""); // bug? remove empty lines at end of file
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