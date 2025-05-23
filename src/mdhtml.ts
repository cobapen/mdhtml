import { existsSync, lstatSync } from "node:fs";
import fs from "node:fs/promises";
import path, { basename, dirname, extname } from "node:path";
import { CMarkdown } from "@cobapen/markdown";
import chokidar from "chokidar";
import mustache from "mustache";
import { appendMissingExt, basenameWithoutExt, cleanDir, isFile, prepareDir } from "./fsutils.js";

const useFallbackTemplate = "__$fallback";

type Options = {
  template: string,   // Path to the HTML template file in input directory.
  output: string,     // Directory to save the converted HTML files
  quiet: boolean,     // Do not print successful log messages
  clean: boolean,     // Remove dst folder before conversion
  math: string        // Output path to the stylesheet
};

const defaultOptions: Options = {
  template: "_template.html",
  output: "output",
  quiet: false,
  clean: false,
  math: "math.css",
};

const fallbackTemplate = 
`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{title}}</title>
</head>
<body>
{{{content}}}
</body>
</html>
`;


/**
 * Markdown to HTML document converter
 */
export class MdHtmlConverter {

  #md;
  #config;
  #print;
  #userSpecifiedOutput;
  #userSpecifiedTemplate;
  #userSpecifiedMathStylesheet;
  #lastUsedTemplates: Record<string, string>;
  #lastWrittenMathCSS;
  #fallbackTemplate;


  /**
   * Create a new instance of MdHtmlConverter.
   */
  constructor(option?: Partial<Options>) {
    option = { ...option };

    let adaptiveCSS = true;
    if (option.math?.endsWith(":full")) {
      option.math = option.math.slice(0, -5);
      adaptiveCSS = false;
    }
    
    this.#md = new CMarkdown({
      math: {
        chtml: { adaptiveCSS },
      }
    });
    this.#config = merge(defaultOptions, option); 
    this.#print = printFn(this.#config.quiet);
    this.#lastUsedTemplates = {};
    this.#lastWrittenMathCSS = "";
    this.#userSpecifiedOutput = option.output !== undefined;
    this.#userSpecifiedTemplate = option.template !== undefined;
    this.#userSpecifiedMathStylesheet = option.math !== undefined;
    this.#fallbackTemplate = fallbackTemplate;
  }

  get defaultTemplate() {
    return this.#fallbackTemplate;
  }

  set defaultTemplate(template) {
    this.#fallbackTemplate = template;
  }


  get md() {
    return this.#md;
  }
  
  set md(md) {
    this.#md = md;
  }

  /**
   * Convert single file
   */
  async convertSingle(input: string) {
    const templateText = await this.#resolveTemplateSingle(false);
    const dstPath = this.#resolveOutputPathSingle(input);
    await this.#renderFileWithTemplate(input, dstPath, templateText);
    if (this.#userSpecifiedMathStylesheet) {
      await this.#writeMathCSS(dirname(dstPath));
    }
  }

  /**
   * Convert all files in the input directory.
   */
  async convert(inputDir: string) {
    if (!existsSync(inputDir)) {
      console.error(`No such file or directory: ${inputDir}`);
      return;
    }
    if (lstatSync(inputDir).isFile()) {
      // treat inputDir as input and do single conversion
      await this.convertSingle(inputDir);
      return;
    }

    if (this.#config.clean) {
      await cleanDir(this.#config.output);
    }

    const { template, output: outputDir } = this.#config;
    const templateText = await this.resolveTemplate(template, inputDir, false);

    // scan all files in "inputDir". This returns collection of dirents.
    // direct.parentPath is always relative from currentDir.
    const files = await fs.readdir(inputDir, { recursive: true, withFileTypes: true });

    const promises = files.map(async file => {
      const name = file.name;

      // Dirent.parentPath is always relative from current dir.
      // inputDir is absolute or relative from current.
      // We need relative filepath "from inputDir".
      const filepath = path.join(file.parentPath, name);
      const absPath = path.resolve(filepath);
      const absInputPath = path.resolve(inputDir);
      const relPath = path.relative(absInputPath, absPath);

      if (path.extname(name) === ".md") {
        const outputPath = this.#resolveOutputPath(outputDir, relPath);
        await this.#renderFileWithTemplate(absPath, outputPath, templateText);
        this.#print("wrote:", outputPath);
      } 
      else if (isFile(absPath)) {
        const outputPath = this.#resolveOutputPath(outputDir, relPath);
        await prepareDir(outputPath);
        await fs.copyFile(absPath, outputPath, fs.constants.COPYFILE_FICLONE);
        this.#print("copied:", outputPath);
      } 
    });

    await Promise.all(promises);

    if (this.#userSpecifiedMathStylesheet) {
      await this.#writeMathCSS(outputDir);
    }
  }


  /**
   * Convert all files and then keep watching changes
   */
  async watchSingle(input: string) {
    await this.convertSingle(input);

    const watcher = chokidar.watch(input, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher.on("change", async filepath => {
      await this.convertSingle(filepath);
    });
  }

  
  /**
   * Convert all files and then keep watching changes
   */
  async watch(inputDir: string) {
    if (!existsSync(inputDir)) {
      console.error(`No such file or directory: ${inputDir}`);
      return;
    }
    if (lstatSync(inputDir).isFile()) {
      // treat inputDir as input and do single conversion
      await this.watchSingle(inputDir);
      return;
    }

    const { output: outputDir } = this.#config;
    await this.convert(inputDir);

    const watcher = chokidar.watch(inputDir, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on("add", async filePath => {
        await renderOnChange(filePath);
      })
      .on("change", async filePath => {
        if (filePath === this.#config.template) {
          delete this.#lastUsedTemplates[filePath];
        }
        await renderOnChange(filePath);
      })
      .on("unlink", (_filepath) => {
        // do nothing?
      });

    this.#print(`Watch started: ${inputDir}`);

    const self = this;
    const renderOnChange = async (filePath: string) => {
      const outputPath = self.#resolveOutputPath(outputDir, filePath);
      await self.#renderFile(inputDir, filePath, outputPath); 
      if (self.#userSpecifiedMathStylesheet) {
        await self.#writeMathCSS(outputDir, true);
      }
    };
  }

  /**
   * Render markdown to dstFilePath.
   * @param file         relative path to the file.
   * @param sourceDir    path to source dir.
   * @param templateText   
   */
  async #renderFileWithTemplate(file: string, destination: string, templateText: string) {
    const name = basename(file, extname(file));
    const content = await fs.readFile(file, "utf-8");
    const html = this.#md.render(content);
    const outputHtml = mustache.render(templateText, { 
      title: name,
      content: html 
    });

    await prepareDir(destination);
    await fs.writeFile(destination, outputHtml, "utf-8");
    this.#print("wrote:", destination);
  }


  /**
   * Render markdown to dstFilePath, resolving template per call.
   * @param inputDir       input directory (required to resolve template)
   * @param source         
   * @param destination 
   */
  async #renderFile(inputDir: string, source: string, destination: string) {
    const { template } = this.#config;
    const templateText = await this.resolveTemplate(template, inputDir, false);
    await this.#renderFileWithTemplate(source, destination, templateText);
  }


  /**
   * Resolve template file.
   * 
   * From the template path/name, the function looks up from the following paths.
   * Once found, the template is cached and it can be reused without file access.
   * 
   * 1. <file>              (absolute path)
   * 2. <file>              (relative from currentDir)
   * 3. inputDir/<file>     (relative from input, if inputDir is directory)
   * 
   * @example
   * // mdhtml inputDir --output <output> --template <file>
   * //                                              ^^^^^^
   * 
   * @param template   template name (absolute or relative)
   * @param sourceDir  the source directory
   * @param useCache
   * @returns template text
   */
  async resolveTemplate(template: string, sourceDir?: string, useCache?: boolean): Promise<string> {

    if (!sourceDir) {
      sourceDir = process.cwd();
    }

    if (template === undefined || template === "") {
      console.warn("No template specified. Using fallback template.");
      return fallbackTemplate;
    }

    if (template === useFallbackTemplate) {
      return fallbackTemplate;
    }

    if (useCache && this.#lastUsedTemplates[template]) {
      return this.#lastUsedTemplates[template];
    }

    const templatePaths = [template];

    if (existsSync(sourceDir) && lstatSync(sourceDir).isDirectory()) {
      // sourceDir === currentDir is unchecked. Fix if any problem arises.
      templatePaths.push(path.join(sourceDir, template));
    }

    for (const templatePath of templatePaths) {
      if (existsSync(templatePath)) {
        const content = await fs.readFile(templatePath, "utf-8");
        this.#lastUsedTemplates[template] = content;
        return content;
      }
    }

    console.warn(`Template file not found: ${template}`);
    return fallbackTemplate;
  }

  /**
   * Resolve template file for single file conversion mode.
   * 
   * This method handles special case where inputDir does not exist, 
   * and does not raise any warnings to use the default fallback template.
   * 
   * @param {boolean} useCache
   */
  async #resolveTemplateSingle(useCache = false) {
    const { template } = this.#config;

    // If user did not specifiy the template, use default template.
    // This handle special case where no alert is 
    const useTemplate = this.#userSpecifiedTemplate
      ? template
      : useFallbackTemplate;
    
    return await this.resolveTemplate(useTemplate, process.cwd(), useCache);
  }

  /**
   * Resolve output filepath from relative path from inputDir
   */
  #resolveOutputPath(outputDir: string, relPath: string) {
    if (relPath.endsWith(".md")) {
      return path.join(outputDir, relPath.replace(/\.md$/, ".html"));
    } else {
      return path.join(outputDir, relPath);
    }
  }

  /**
   * Resolve output filepath from input file (single file conversion mode)
   * 
   * This method handles special case where inputDir does not exist,
   * and the output path may be calculated from the input file name.
   */
  #resolveOutputPathSingle(input: string) {
    // If user did not specified the output name, use different default value.
    const { output } = this.#config; 
    return this.#userSpecifiedOutput 
      ? appendMissingExt(output, ".html")
      : appendMissingExt(basenameWithoutExt(input), ".html");
  }

  
  /**
   * Write math stylesheet to the output directory.
   */
  async #writeMathCSS(outputDir: string, checkCache: boolean = false) {
    const css = this.#md.mathcss();
    if (checkCache && this.#lastWrittenMathCSS === css) {
      return;
    }
    const { math: stylesheet } = this.#config;
    const cssPath = this.#resolveOutputPath(outputDir, stylesheet);
    await prepareDir(cssPath);
    await fs.writeFile(cssPath, css, "utf-8");
    this.#print("wrote:", cssPath);
    this.#lastWrittenMathCSS = css; 
  }
}


/**
 * undefined aware shallow merge.
 */
function merge<T extends Record<string, any>>(...args: T[]) {
  return args.reduce((acc, arg) => {
    Object.keys(arg).forEach(key => {
      if (arg[key] !== undefined) {
        acc[key] = arg[key];
      }
    });
    return acc;
  }, {} as Record<string, any>);
}


function printFn(quiet: boolean): (...args: any[]) => void {
  if (quiet === true) {
    return () => {};
  } else {
    return console.log;
  }
}

