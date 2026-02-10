import { readFile } from "node:fs/promises";
import path from "node:path";
import { MdHtmlError, Options as MdHtmlOptions } from "./mdhtml.js";

const argnames: Record<keyof CliConfig, string> = {
  output: "output",
  template: "template",
  watch: "watch",
  quiet: "quiet",
  clean: "clean",
  stdout: "stdout",
  math: "math",
  mathFontUrl: "math-font-url",
  ignore: "ignore",
};


export interface CliConfig {
  output?: string,
  template?: string,
  watch?: boolean,
  quiet?: boolean,
  clean?: boolean,
  stdout?: boolean,
  math?: string | boolean,
  mathFontUrl?: string,
  ignore?: string[],
};

export async function loadConfigFile(file: string): Promise<CliConfig> {
  const configPath = path.resolve(process.cwd(), file);
  let text: string;
  try {
    text = await readFile(configPath, "utf-8");
  } catch (e) {
    if (e instanceof Error) {
      switch ((e as NodeJS.ErrnoException).code) {
        case "ENOENT":
          throw new MdHtmlError(`config file not found: ${file}`);
        default:
          throw new MdHtmlError(`config file error: (${file}) ${e.message}`);
      }
    } else {
      throw e;
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new MdHtmlError(`failed to parse config JSON: ${file}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new MdHtmlError(`invalid config format: ${file}`);
  }

  const obj = parsed as Record<string, unknown>;
  
  // Warn unknown keys
  const awareKeys = new Set(Object.values(argnames));
  for (const key of Object.keys(obj)) {
    if (!awareKeys.has(key)) {
      console.warn(`Unknown key "${key}" in config file`);
    }
  }
  
  const ignore = normalizeList(obj.ignore);

  const getValue = <T>(obj: Record<string, unknown>, key: string, types: string[]): T | undefined => {
    return types.includes(typeof obj[key]) ? obj[key] as T : undefined;
  };

  return {
    output: getValue<string>(obj, argnames.output, ["string"]),
    template: getValue<string>(obj, argnames.template, ["string"]),
    watch: getValue<boolean>(obj, argnames.watch, ["boolean"]),
    quiet: getValue<boolean>(obj, argnames.quiet, ["boolean"]),
    clean: getValue<boolean>(obj, argnames.clean, ["boolean"]),
    stdout: getValue<boolean>(obj, argnames.stdout, ["boolean"]),
    math: getValue<string|boolean>(obj, argnames.math, ["string", "boolean"]),
    mathFontUrl: getValue<string>(obj, argnames.mathFontUrl, ["string"]),
    ignore: ignore.length > 0 ? ignore : undefined,
  };
}

export function mergeOptions(config: CliConfig, options: any): CliConfig {
  const merged: CliConfig = { ...config };

  // Merge ignore additively.
  const cfgIgnore = config.ignore ?? [];
  const cliIgnore = (options.ignore ?? []) as string[];
  merged.ignore = [...cfgIgnore, ...cliIgnore];
  
  return merged;
}

export function intoConvOptions(config: CliConfig) : Partial<MdHtmlOptions> {
  return {
    quiet: config.quiet,
    clean: config.clean,
    stdout: config.stdout,
    math: withDefaults(config.math, "math.css"),
    mathFontUrl: config.mathFontUrl,
    ignore: config.ignore,
  };
}

function normalizeList(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === "string") as string[];
  }
  return [];
}

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
