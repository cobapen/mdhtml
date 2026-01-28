import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";

export class HtmlTemplate {
  readonly content: string;

  constructor(content: string) {
    this.content = content;
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

const predefinedTemplateNames = ["none", "default", "fallback"] as const;
type EmbedTemplateName = typeof predefinedTemplateNames[number];

const predefinedTemplates = {
  none: noneTemplate,
  default: fallbackTemplate,
  fallback: fallbackTemplate,
} satisfies Record<EmbedTemplateName, HtmlTemplate>;

type ResolveTemplateArgs = {
  srcDir: string,
  useCache: boolean
};
export class TemplateProvider {
  readonly cache: Record<string, HtmlTemplate>;

  constructor() {
    this.cache = {};
  }

  static get embed(): Record<EmbedTemplateName, HtmlTemplate> { return predefinedTemplates; }
  static get defaultTemplateName(): EmbedTemplateName { return "default"; }

  isPredefined(name: string): name is EmbedTemplateName {
    return predefinedTemplateNames.includes(name as EmbedTemplateName);
  }

  async resolveTemplate(template: string, args?: Partial<ResolveTemplateArgs>): Promise<HtmlTemplate> {
    const _srcDir = args?.srcDir ?? process.cwd();
    const useCache = args?.useCache ?? true;

    if (template === undefined || template.trim().length === 0) {
      return TemplateProvider.embed.fallback;
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
    return TemplateProvider.embed.fallback;
  }
}
