#! /usr/bin/env node
import { Command } from "commander";
import { MdHtmlConverter } from "./mdhtml.js";

const program = new Command();

program
  .name("mdhtml")
  .argument("<input>", "Input file or directory")
  .option("-o, --output <path>", "output filename or directory")
  .option("-t, --template <file>", "HTML template")
  .option("-w, --watch", "Run in watch mode")
  .option("-q, --quiet", "Run in quiet mode")
  .option("-c, --clean", "Delete output directory before conversion")
  .option("--math [file]", "Generate math stylesheet")
  .action(async (input, options) => {
    const converter = new MdHtmlConverter({
      quiet: options.quiet,
      clean: options.clean,
      math: withDefaults(options.math, "math.css"),
    });

    const template = options.template ?? "";
    const output = options.output ?? "";
    
    if (options.watch === true) {
      await converter.watch(input, output, template);
    } else {
      await converter.convert(input, output, template);
    }
  });

program.parse(process.argv);


/**
 * <none> : undefined
 * --flag : true
 * --flag <arg> : string
 */
function withDefaults<T>(option: string|boolean|undefined, defaultValue: T) {
  if (!option) {
    return undefined;
  }
  if (option === true) {
    return defaultValue;
  }
  return option;
}