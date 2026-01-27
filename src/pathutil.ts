import { existsSync } from "node:fs";
import { createWriteStream, Dirent, Stats, statSync } from "node:fs";
import { mkdir, readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";

import { Writable } from "node:stream";

/** 
 * ResolvedPath is a helper object that manages relative paths.
 * 
 * By using the absolute path as an anchor, the instance returns paths
 * relative from different roots.
 * 
 * - `absPath` is the absolute path.
 * - `relPath` is relative from the srcDir. 
 * - `location` is relative from process.cwd().
 */
export class ResolvedPath {
  readonly raw: string;     
  readonly srcDir: string;
  readonly absPath: string;

  /** Create new instance from path like strings */
  constructor(input: string, srcDir?: string|DirPath) {
    this.raw = input.trim();
    this.srcDir = srcDir instanceof DirPath
      ? srcDir.absPath
      : path.resolve(srcDir ?? process.cwd());
    this.absPath = path.resolve(this.srcDir, input);
  }
  /** Return clean relative path from srcDir (or absolute) */
  get path(): string { 
    return this.isAbsolute()
      ? this.absPath
      : this.pathFrom(this.srcDir);
  }
  /** Return clean relative path from cwd (or absolute) */
  get location(): string { 
    return this.isAbsolute()
      ? this.absPath
      : this.pathFrom(process.cwd());
  }
  
  exists(): boolean {
    return existsSync(this.absPath);
  }
  stat(): Stats {
    return statSync(this.absPath);
  }
  isFile(): boolean {
    return this.stat().isFile();
  }
  isDir(): boolean {
    return this.stat().isDirectory();
  }
  isAbsolute(): boolean {
    return path.isAbsolute(path.normalize(this.raw));
  }
  pathFrom(from: string|ResolvedPath): string {
    //
    return path.normalize(path.relative(from.toString() + path.sep, this.absPath));
  }
  toString(): string {
    return this.absPath;
  }
}

/**
 * FilePath provides file apis over ResolvedPath.
 */
export class FilePath extends ResolvedPath {
  readonly kind = "file";
  constructor(input: string|FilePath, srcDir?: string|DirPath) {
    if (input instanceof FilePath) {
      const chdir = srcDir ?? input.srcDir;
      super(input.pathFrom(chdir), chdir);
    } else {
      super(input, srcDir);
    }
  }

  get filename(): string {
    return path.basename(this.absPath);
  }
  get ext(): string {
    return path.extname(this.absPath).toLowerCase();
  }
  get parent(): DirPath {
    return new DirPath(path.dirname(this.absPath));
  }
  getWriteStream(): Writable {
    return createWriteStream(this.absPath);
  }
  /** Return new instance with different source directory */
  chdir(dir: string|DirPath): FilePath {
    return new FilePath(this, dir.toString());
  }
  rename(re: RegExp, to: string): FilePath {
    return new FilePath(this.path.replace(re, to), this.srcDir);
  }
}

/**
 * DirPath provides directory apis over ResolvedPath.
 */
export class DirPath extends ResolvedPath {
  readonly kind = "dir";
  constructor(input: string|DirPath, srcDir?: string|DirPath) {
    if (input instanceof DirPath) {
      const chdir = srcDir ?? input.srcDir;
      super(input.pathFrom(chdir), chdir);
    } else {
      super(input, srcDir);
    }
  }
  async mkdir(): Promise<void> {
    await mkdir(this.absPath, { recursive: true });
  }
  async clean(): Promise<void> {
    await cleanDir(this.absPath);
  }
  /** Recursively read all files in this directory. */
  async readdir(options?: { recursive?: boolean}): Promise<Dirent<string>[]> {
    // When `withFileTypes` is true, the node API returns Dirents.
    // The parentPath in dirent is always absolute (/path/to/file) because
    // we pass absolute path to the API.
    return readdir(this.absPath, { 
      recursive: options?.recursive ?? true, 
      withFileTypes: true, 
    });
  }

  /** Return new instance with different source directory */
  chdir(dir: string|DirPath): DirPath {
    return new DirPath(this, dir.toString());
  }
}

export class PathProvider {
  readonly input: string;
  readonly output: string;

  constructor(input: string, output: string) {
    this.input = input.trim();
    this.output = output.trim();
  }

  get inputFile(): FilePath {
    return new FilePath(this.input);
  }
  get inputDir(): DirPath {
    return new DirPath(this.input);
  }
  get outputFile(): FilePath {
    return new FilePath(this.output);
  }
  get outputDir(): DirPath {
    return new DirPath(this.output);
  }
  outputDefined(): boolean {
    return this.output.length > 0;
  }
}

/**
 * Remove directory contents recursively.
 */
export async function cleanDir(dir: string) {
  if (existsSync(dir)) {
    const files = await readdir(dir, { withFileTypes: true });
    const promises = files.map(async file => {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        return rm(filePath, { recursive: true, force: true });
      } else {
        return unlink(filePath);
      }
    });
    await Promise.all(promises);
  }
}

export class PathUtils {
  /** Open existing file */
  static open(input: string): FilePath | DirPath {
    return statSync(input).isFile() ? new FilePath(input) : new DirPath(input);
  }
  static isFilePath(path: FilePath | DirPath): path is FilePath {
    return path.kind === "file";
  }
  static isDirPath(path: FilePath | DirPath): path is DirPath {
    return path.kind === "dir";
  }
}