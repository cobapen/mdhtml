#! /usr/bin/env node
import { Command } from "commander";
import { MdHtmlConverter } from "./mdhtml.js";

const program = new Command();

program
  .name("mdhtml")
  .argument("<input>", "Input directory containing markdown files")
  .option("-o, --output <dir>", "output filename or directory (default: output)")
  .option("-t, --template <file>", "HTML template file (default: _template.html)")
  .option("-w, --watch", "Run in watch mode")
  .option("-q, --quiet", "Run in quiet mode")
  .option("-c, --clean", "Delete output directory before conversion")
  .option("--math [file]", "Generate math stylesheet")
  .action((input, options) => {
    const converter = new MdHtmlConverter({
      template: options.template,
      output: options.output,
      quiet: options.quiet,
      clean: options.clean,
      math: withDefaults(options.math, "math.css"),
    });
    
    if (options.watch === true) {
      converter.watch(input);
    } else {
      converter.convert(input);
    }
  });

program.parse(process.argv);


/**
 * <none> : undefined
 * --flag : true
 * --flag <arg> : string
 * @template T
 * @param {string|boolean|undefined} option 
 * @param {T} defaultValue
 */
function withDefaults(option, defaultValue) {
  if (!option) {
    return undefined;
  }
  if (option === true) {
    return defaultValue;
  }
  return option;
}