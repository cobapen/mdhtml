import { existsSync, lstatSync } from "node:fs";
import fs from "node:fs/promises";
import path, { basename, dirname, extname } from "node:path";
import { CMarkdown } from "@cobapen/markdown";
import chokidar from "chokidar";
import mustache from "mustache";
import { appendMissingExt, basenameWithoutExt, cleanDir, isFile, prepareDir } from "./fsutils.js";

const useFallbackTemplate = "__$fallback";

/**
 * @typedef {Object} Options
 * @property {string} template - Path to the HTML template file in input directory.
 * @property {string} output - Directory to save the converted HTML files
 * @property {boolean} quiet - Do not print successful log messages
 * @property {boolean} clean - Remove dst folder before conversion
 * @property {string}  math - Output path to the stylesheet
 */
const defaultOptions = {
  template: "_template.html",
  output: "output",
  quiet: false,
  clear: false,
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
  /** @type {Map<string, string>} */
  #lastUsedTemplates;
  #lastWrittenMathCSS;
  #fallbackTemplate;


  /**
   * Create a new instance of MdHtmlConverter.
   * @param {Options} option  converter options
   */
  constructor(option) {
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
   * @param {string} input 
   */
  async convertSingle(input) {
    const templateText = await this.#resolveTemplateSingle(false);
    const dstPath = this.#resolveOutputPathSingle(input);
    await this.#renderFileWithTemplate(input, dstPath, templateText);
    if (this.#userSpecifiedMathStylesheet) {
      await this.#writeMathCSS(dirname(dstPath));
    }
  }

  /**
   * Convert all files in the input directory.
   * @param {string} inputDir 
   */
  async convert(inputDir) {
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
        prepareDir(outputPath);
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
   * @param {string} inputDir 
   */
  async watchSingle(input) {
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
   * @param {string} inputDir 
   */
  async watch(inputDir) {
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
          this.#lastUsedTemplates = "";
        }
        await renderOnChange(filePath);
      })
      .on("unlink", (_filepath) => {
        // do nothing?
      });

    this.#print(`Watch started: ${inputDir}`);

    const self = this;
    const renderOnChange = async filePath => {
      const outputPath = self.#resolveOutputPath(outputDir, filePath);
      await self.#renderFile(inputDir, filePath, outputPath); 
      if (self.#userSpecifiedMathStylesheet) {
        await self.#writeMathCSS(outputDir, true);
      }
    };
  }

  /**
   * Render markdown to dstFilePath.
   * @param {string} file         relative path to the file.
   * @param {string} sourceDir    path to source dir.
   * @param {string} templateText   
   */
  async #renderFileWithTemplate(source, destination, templateText) {
    const name = basename(source, extname(source));
    const content = await fs.readFile(source, "utf-8");
    const html = this.#md.render(content);
    const outputHtml = mustache.render(templateText, { 
      title: name,
      content: html 
    });

    prepareDir(destination);
    await fs.writeFile(destination, outputHtml, "utf-8");
    this.#print("wrote:", destination);
  }


  /**
   * Render markdown to dstFilePath, resolving template per call.
   * @param {string} inputDir       input directory (required to resolve template)
   * @param {string} source         
   * @param {string} destination 
   */
  async #renderFile(inputDir, source, destination) {
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
   * @param {string} template   template name (absolute or relative)
   * @param {string} [sourceDir]  the source directory
   * @param {string} [useCache]
   * @returns {Promise<string>} tempalte text
   */
  async resolveTemplate(template, sourceDir, useCache) {

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
   * @param {string} outputDir
   * @param {string} relPath
   */
  #resolveOutputPath(outputDir, relPath) {
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
   * 
   * @param {string} input
   */
  #resolveOutputPathSingle(input) {
    // If user did not specified the output name, use different default value.
    const { output } = this.#config; 
    return this.#userSpecifiedOutput 
      ? appendMissingExt(output, ".html")
      : appendMissingExt(basenameWithoutExt(input), ".html");
  }

  
  /**
   * Write math stylesheet to the output directory.
   * @param {string} outputDir 
   * @param {boolean} checkCache
   */
  async #writeMathCSS(outputDir, checkCache = false) {
    const css = this.#md.mathcss();
    if (checkCache && this.#lastWrittenMathCSS === css) {
      return;
    }
    const { math: stylesheet } = this.#config;
    const cssPath = this.#resolveOutputPath(outputDir, stylesheet);
    prepareDir(cssPath);
    await fs.writeFile(cssPath, css, "utf-8");
    this.#print("wrote:", cssPath);
    this.#lastWrittenMathCSS = css; 
  }
}


/**
 * undefined aware shallow merge.
 * @template T
 * @param  {...T} args 
 * @returns {T}
 */
function merge(...args) {
  return args.reduce((acc, arg) => {
    Object.keys(arg).forEach(key => {
      if (arg[key] !== undefined) {
        acc[key] = arg[key];
      }
    });
    return acc;
  }, {});
}


/**
 * @param {boolean} quiet 
 * @returns {(...args: any[]) => void}
 */
function printFn(quiet) {
  if (quiet === true) {
    return () => {};
  } else {
    return console.log;
  }
}

