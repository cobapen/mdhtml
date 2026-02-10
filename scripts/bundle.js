import path from "node:path";
import esbuild from "esbuild";

const __dirname = import.meta.dirname;
const __projectRoot = path.resolve(__dirname, "..");
const entryfile = path.resolve(__projectRoot, "lib", "index.js");
const outfile = path.resolve(__projectRoot, "dist", "index.js");

const isWatch = process.argv.includes("--watch");

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: [entryfile],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: outfile,
  logLevel: "info",
  minify: true,
  legalComments: "none",

  // Some dependencies use dynamic require even when bundled.
  // In ESM output, Node doesn't provide `require`, so we polyfill it via createRequire.
  banner: {
    js: [
      "import { createRequire } from \"node:module\";",
      "import { fileURLToPath } from \"node:url\";",
      "import { dirname as __pathDirname } from \"node:path\";",
      "const require = createRequire(import.meta.url);",
      "const __filename = fileURLToPath(import.meta.url);",
      "const __dirname = __pathDirname(__filename);",
    ].join("\n"),
  },
};

const keepAliveUntilSignal = () =>
  new Promise((resolve) => {
    process.on("SIGINT", () => resolve());
    process.on("SIGTERM", () => resolve());
  });

if (isWatch) {
  await watch();
} else {
  await build();
}

async function build() {
  try {
    await esbuild.build(options);
  }
  catch(e) {
    console.error(e);
    process.exitCode = 1;
  }
}

async function watch() {
  let context;
  try {
    context = await esbuild.context(options);
    await context.watch();
    await context.rebuild();
    await keepAliveUntilSignal();
  }
  catch(e) {
    console.error(e);
    process.exitCode = 1;
  }
  finally {
    await context?.dispose;
  }
}