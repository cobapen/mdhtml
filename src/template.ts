import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export class HtmlTemplate {
  readonly content: string;

  constructor(content: string) {
    this.content = content;
  }
}

type ResolveTemplateArgs = {
  srcDir: string,
  useCache: boolean
};
export class TemplateProvider {
  readonly cache: Record<string, HtmlTemplate>;

  constructor() {
    this.cache = {};
  }

  async resolveTemplate(template: string, args?: Partial<ResolveTemplateArgs>): Promise<HtmlTemplate> {
    const _srcDir = args?.srcDir ?? process.cwd();
    const useCache = args?.useCache ?? true;

    if (template === undefined || template.trim().length === 0) {
      return embedTemplates.fallback;
    }
    if (useCache && this.cache[template]) {
      return this.cache[template];
    }
    const templatePaths = [template];

    for (const templatePath of templatePaths) {
      if (existsSync(templatePath)) {
        const content = await readFile(templatePath, "utf-8");
        const tmpl = new HtmlTemplate(content);
        this.cache[template] = tmpl;
        return tmpl;
      }
    }

    console.warn(`Template file not found: ${template}`);
    return embedTemplates.fallback;
  }
}

const fallbackTemplate = new HtmlTemplate(`<!DOCTYPE html>
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
`);

const noneTemplate = new HtmlTemplate("{{{content}}}");

const _embedTemplateNames = <const>["default", "fallback", "none"];
type EmbedTemplateNames = typeof _embedTemplateNames[number];

const embedTemplates = {
  none: noneTemplate,
  default: fallbackTemplate,
  fallback: fallbackTemplate,
} satisfies Record<EmbedTemplateNames, HtmlTemplate>;