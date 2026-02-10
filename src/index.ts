#! /usr/bin/env node
import { Command, Option } from "commander";
import pkg from "../package.json" with { type: "json" };
import { MdHtmlConverter, MdHtmlError } from "./mdhtml.js";

const program = new Command();

program
  .name("mdhtml")
  .version(pkg.version)
  .argument("<input>", "Input file or directory")
  .option("-o, --output <path>", "output filename or directory")
  .option("-t, --template <file>", "HTML template")
  .option("-w, --watch", "Run in watch mode")
  .option("-q, --quiet", "Run in quiet mode")
  .option("-c, --clean", "Delete output directory before conversion")
  .option("--math [file]", "Generate math stylesheet")
  .addOption(new Option("--stdout", "Print to stdout (file mode only)").hideHelp())
  .addOption(new Option("--math-font-url <path>", "set math font").hideHelp())
  .action(async (input, options) => {
    const converter = new MdHtmlConverter({
      quiet: options.quiet,
      clean: options.clean,
      stdout: options.stdout,
      math: withDefaults(options.math, "math.css"),
      mathFontUrl: options["mathFontUrl"],
    });

    const template = options.template;
    const output = options.output;
    
    try {
      if (options.watch === true) {
        await converter.watch(input, output, template);
      } else {
        await converter.convert(input, output, template);
      }
    } catch (err: unknown) {
      if (err instanceof MdHtmlError) {
        console.error(`Error: ${err.message}`);
      } else {
        throw err;
      }
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



