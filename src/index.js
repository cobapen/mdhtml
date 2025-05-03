#! /usr/bin/env node
import { CMarkdown } from "@cobapen/markdown";
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
  .action((input, options) => {
    const md = new CMarkdown();
    const converter = new MdHtmlConverter(md, {
      template: options.template,
      outputDir: options.output,
      quiet: options.quiet,
      clean: options.clean,
    });
    
    if (options.watch === true) {
      converter.watch(input);
    } else {
      converter.convert(input);
    }
  });

program.parse(process.argv);