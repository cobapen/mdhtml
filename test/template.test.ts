import fs from "node:fs/promises";
import { vol } from "memfs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TemplateProvider } from "../src/template.js";

vi.mock("node:fs", () => vi.importActual("./_mocks/fs.cjs"));
vi.mock("node:fs/promises", () => vi.importActual("./_mocks/fs/promises.cjs"));

describe.sequential("template", () => {

  beforeEach(async () => {
    vol.reset();
    await fs.mkdir("tmpl", { recursive: true });
    await fs.writeFile("tmpl/a.html", "A: {{{content}}}");
    await fs.writeFile("tmpl/b.html", "B: {{{content}}}");
  });

  it("returns fallback template for empty input", async () => {
    const provider = new TemplateProvider();
    const tmpl1 = await provider.resolveTemplate("");
    const tmpl2 = await provider.resolveTemplate("   ");

    expect(tmpl1.content).toContain("<!DOCTYPE html>");
    expect(tmpl1.content).toContain("{{{content}}}");
    expect(tmpl2.content).toContain("<!DOCTYPE html>");
  });

  it("loads template content from file", async () => {
    const provider = new TemplateProvider();
    const tmpl = await provider.resolveTemplate("tmpl/a.html");
    expect(tmpl.content).toBe("A: {{{content}}}");
  });

  it("caches templates by default", async () => {
    const provider = new TemplateProvider();
    const fsPromises = await import("node:fs/promises");
    const readSpy = vi.spyOn(fsPromises, "readFile");

    const first = await provider.resolveTemplate("tmpl/a.html");
    await fs.writeFile("tmpl/a.html", "A2: {{{content}}}");
    const second = await provider.resolveTemplate("tmpl/a.html");

    expect(first.content).toBe("A: {{{content}}}");
    expect(second.content).toBe("A: {{{content}}}");
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it("can bypass cache when useCache=false", async () => {
    const provider = new TemplateProvider();

    const first = await provider.resolveTemplate("tmpl/b.html");
    await fs.writeFile("tmpl/b.html", "B2: {{{content}}}");
    const second = await provider.resolveTemplate("tmpl/b.html", { useCache: false });

    expect(first.content).toBe("B: {{{content}}}");
    expect(second.content).toBe("B2: {{{content}}}");
  });

  it("warns and returns fallback when template file is missing", async () => {
    const provider = new TemplateProvider();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const tmpl = await provider.resolveTemplate("tmpl/missing.html");
    expect(warnSpy).toHaveBeenCalledWith("Template file not found: tmpl/missing.html");
    expect(tmpl.content).toContain("<!DOCTYPE html>");
  });
});
