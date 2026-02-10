#! /usr/bin/env node
import { Command, Option } from "commander";
import pkg from "../package.json" with { type: "json" };

const program = new Command();

program
  .name("mdhtml")
  .argument("[input]", "Input file or directory")
  .addOption(new Option("-o, --output <path>", "output filename or directory"))
  .addOption(new Option("-t, --template <file>", "HTML template"))
  .addOption(new Option("-w, --watch", "Run in watch mode"))
  .addOption(new Option("-c, --clean", "Delete output directory before conversion"))
  .addOption(new Option("-i, --ignore <pattern>", "ignore files (glob/file)").argParser(multiple).default([] as string[]))
  .addOption(new Option("-q, --quiet", "Run in quiet mode"))
  .addOption(new Option("--config <file>", "use config file"))
  .addOption(new Option("--math [file]", "Generate math stylesheet").hideHelp())
  .addOption(new Option("--math-font-url <path>", "set math font").hideHelp())
  .addOption(new Option("--stdout", "Print to stdout (file mode only)").hideHelp())
  .version(pkg.version)
  .action(async (input: string | undefined, options: Record<string, unknown>) => {

    const { intoConvOptions, loadConfigFile, mergeOptions } = await import("./config.js");
    const { MdHtmlConverter, MdHtmlError } = await import("./mdhtml.js");

    const fileConfig = options.config
      ? await loadConfigFile(options.config as string)
      : {};
    
    try {
      const merged = mergeOptions(fileConfig, options);
      const resolvedInput = merged.input ?? input ?? "";
      if (resolvedInput.trim().length === 0) {
        throw new MdHtmlError("<input> is not specified");
      }
      const convOptions = intoConvOptions(merged);
      const converter = new MdHtmlConverter(convOptions);

      const template = merged.template;
      const output = merged.output;
    
      if (merged.watch === true) {
        await converter.watch(resolvedInput, output, template);
      } else {
        await converter.convert(resolvedInput, output, template);
      }
    } 
    catch (err: unknown) {
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






