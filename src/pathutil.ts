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
 */
export class ResolvedPath {
  readonly raw: string;     
  readonly absPath: string;

  constructor(raw: string, absPath: string) {
    this.raw = raw.trim();
    this.absPath = absPath.trim();
  }

  /** Create new instance from path like strings */
  static new<T extends typeof ResolvedPath>(this: T, input: string|ResolvedPath, srcDir?: string|DirPath): InstanceType<T> {
    if (input === undefined || input === null) {
      throw new Error("input is undefined or null");
    }
    else if (input instanceof ResolvedPath) {
      if (srcDir === undefined) {
        return new this(input.raw, input.absPath) as InstanceType<T>;
      } else {
        const raw = this.relative(srcDir, input);
        return new this(raw, input.absPath) as InstanceType<T>;
      }
    } 
    else {
      const absPath = path.resolve(srcDir?.toString() ?? process.cwd(), input);
      return new this(input, absPath) as InstanceType<T>;
    }
  }


  /** Return clean relative path from cwd (or absolute) */
  get location(): string { 
    return this.getPath(process.cwd());
  }

  /** Return relative path from dir, or absolute path if external */
  getPath(dir: string|ResolvedPath): string {
    return this.isAbsolute() ? this.absPath : this.pathFrom(dir);
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
    return ResolvedPath.relative(from, this.absPath);
  }
    
  toString(): string {
    return this.absPath;
  }

  static relative(from: string|ResolvedPath, to: string|ResolvedPath): string {
    // normalize because path.relative may return zero-length string
    return path.normalize(path.relative(from.toString(), to.toString()));
  }
}

/**
 * FilePath provides file apis over ResolvedPath.
 */
export class FilePath extends ResolvedPath {
  readonly kind = "file";

  get filename(): string {
    return path.basename(this.absPath);
  }
  get ext(): string {
    return path.extname(this.absPath).toLowerCase();
  }
  get parent(): DirPath {
    const raw = path.normalize(path.join(this.raw, ".."));
    const abs = path.resolve(path.join(this.absPath, ".."));
    return new DirPath(raw, abs);
  }
  getWriteStream(): Writable {
    return createWriteStream(this.absPath);
  }
  /** Return new instance with different source directory */
  chdir(dir: string|DirPath): FilePath {
    return FilePath.new(this.getPath(dir), dir);
  }
  rename(re: RegExp, to: string): FilePath {
    const raw = this.raw.replace(re, to);
    const abs = this.absPath.replace(re, to);
    return new FilePath(raw, abs);
  }
}

/**
 * DirPath provides directory apis over ResolvedPath.
 */
export class DirPath extends ResolvedPath {
  readonly kind = "dir";

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
    return DirPath.new(this.getPath(dir), dir);
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
    return statSync(input).isFile() ? FilePath.new(input) : DirPath.new(input);
  }
  static isFilePath(path: FilePath | DirPath): path is FilePath {
    return path.kind === "file";
  }
  static isDirPath(path: FilePath | DirPath): path is DirPath {
    return path.kind === "dir";
  }
}