import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { defaultTemplate } from "./templates/default.js";
import { plainTemplate } from "./templates/plain.js";

export class HtmlTemplate {
  readonly content: string;

  constructor(content: string) {
    this.content = content;
  }
}

const predefinedTemplateNames = ["none", "default", "plain"] as const;
type EmbedTemplateName = typeof predefinedTemplateNames[number];

const predefinedTemplates = {
  none: new HtmlTemplate("{{{content}}}"),
  default: new HtmlTemplate(defaultTemplate),
  plain: new HtmlTemplate(plainTemplate),
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
      return TemplateProvider.embed.default;
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

    if (this.isPredefined(template)) {
      return TemplateProvider.embed[template];
    }

    console.warn(`Template file not found: ${template}`);
    return TemplateProvider.embed.default;
  }
}
