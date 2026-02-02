import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import mustache from "mustache";

const __dirname = import.meta.dirname;

const projectRoot = path.resolve(__dirname, "..", "..", "..");
const filepaths = {
  htmlTemplate: path.join(__dirname, "template.tmpl"),
  stylesheet0: path.join(__dirname, "style.css"),
  stylesheet1: path.join(__dirname, "highlight.css"),
  tsTemplate: path.join(__dirname, "..", "template.ts.tmpl"),
  packageJson: path.join(projectRoot, "package.json"),
  outputTs: path.join(projectRoot, "src", "templates", "default.ts"),
};

if (!existsSync(filepaths.packageJson)) {
  throw new Error(`package.json not found. (${path.dirname(filepaths.packageJson)})`);
}

function escapeForTemplateLiteral(value) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("`", "\\`")
    .replaceAll("${", "\\${");
}

async function buildTemplate() {
  const [html, css0, css1, tsTmpl] = await Promise.all([
    fs.readFile(filepaths.htmlTemplate, "utf-8"),
    fs.readFile(filepaths.stylesheet0, "utf-8"),
    fs.readFile(filepaths.stylesheet1, "utf-8"),
    fs.readFile(filepaths.tsTemplate, "utf-8"),
  ]);

  const templateText = mustache.render(html, {
    stylesheet: css0 + "\n" + css1,
  }, {}, ["{{{%", "%}}}",]);

  const output = mustache.render(tsTmpl, {
    varname: "defaultTemplate",
    string: escapeForTemplateLiteral(templateText).trimEnd() + "\n",
  });

  await fs.writeFile(filepaths.outputTs, output, "utf-8");
  return { outputTsPath: filepaths.outputTs };
}

await buildTemplate();
console.log("wrote:", filepaths.outputTs);

