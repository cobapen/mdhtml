#! /usr/bin/env node
import { Command, Option } from "commander";
import pkg from "../package.json" with { type: "json" };
import { intoConvOptions, loadConfigFile, mergeOptions } from "./config.js";
import { MdHtmlConverter, MdHtmlError } from "./mdhtml.js";

const program = new Command();

program
  .name("mdhtml")
  .version(pkg.version)
  .argument("<input>", "Input file or directory")
  .option("-o, --output <path>", "output filename or directory")
  .option("-t, --template <file>", "HTML template")
  .option("-w, --watch", "Run in watch mode")
  .option("-c, --config <file>", "config file (JSON)")
  .option("-i, --ignore <pattern>", "ignore files (glob/path)", multiple, [] as string[])
  .option("-q, --quiet", "Run in quiet mode")
  .option("--clean", "Delete output directory before conversion")
  .option("--math [file]", "Generate math stylesheet")
  .addOption(new Option("--stdout", "Print to stdout (file mode only)").hideHelp())
  .addOption(new Option("--math-font-url <path>", "set math font").hideHelp())
  .action(async (input: string, options: Record<string, unknown>) => {

    const fileConfig = options.config
      ? await loadConfigFile(options.config as string)
      : {};

    const merged = mergeOptions(fileConfig, options);
    const convOptions = intoConvOptions(merged);
    const converter = new MdHtmlConverter(convOptions);

    const template = merged.template;
    const output = merged.output;
    
    try {
      if (merged.watch === true) {
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

function multiple(val: string, prev: string[]) {
  prev.push(val);
  return prev;
}






