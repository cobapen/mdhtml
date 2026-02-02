import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import mustache from "mustache";
import { defaultTemplate } from "./templates/default.js";
import { plainTemplate } from "./templates/plain.js";


export type TemplateVars = {
  title: string,
  date: Date,
  mathcss: string,
};
export class HtmlTemplate {
  readonly content: string;

  constructor(content: string) {
    this.content = content;
  }

  get acceptsMathcss(): boolean { 
    return this.content.match(/\{\{\{\s*mathcss\s*\}\}\}/) !== null;
  }

  render(content: string, vars: TemplateVars): string {
    return mustache.render(this.content, {
      content,
      title: vars.title,
      date: vars.date.toISOString(),
      mathcss: vars.mathcss,
    });
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
    this.cache = { ...predefinedTemplates };
  }

  static get embed(): Record<EmbedTemplateName, HtmlTemplate> { return predefinedTemplates; }
  static get defaultTemplateName(): EmbedTemplateName { return "default"; }

  isPredefined(name: string): name is EmbedTemplateName {
    return predefinedTemplateNames.includes(name as EmbedTemplateName);
  }
  fromCache(name: string): HtmlTemplate | undefined {
    return this.cache[name];
  }
  fromCacheOrDefault(name: string): HtmlTemplate {
    return this.cache[name] ?? TemplateProvider.embed.default;
  }
  setCache(name: string, tmpl: HtmlTemplate): void {
    this.cache[name] = tmpl;
  }

  async resolveTemplate(template: string, args?: Partial<ResolveTemplateArgs>): Promise<HtmlTemplate> {
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
