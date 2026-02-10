import { existsSync } from "node:fs";
import { createWriteStream, Dirent, Stats, statSync } from "node:fs";
import { mkdir, readdir, rm, unlink } from "node:fs/promises";
import path from "node:path";

import { Writable } from "node:stream";

/** 
 * ResolvedPath represents absolute path converted from relative path.
 */
export class ResolvedPath {
  readonly absPath: string;

  constructor(input: ResolvedPath);
  constructor(input: string, srcDir: string);
  constructor(absPath: string);
  constructor(input: string|ResolvedPath, srcDir?: string) {
    if (input instanceof ResolvedPath) {
      this.absPath = input.absPath;
    }else if (srcDir !== undefined) {
      this.absPath = path.resolve(srcDir, input);
    } else {
      this.absPath = path.resolve(input);
    }
  }

  /** Create new instance from path like strings */
  static new<T extends typeof ResolvedPath>(this: T, input: string|ResolvedPath, srcDir?: string|DirPath): InstanceType<T> {
    if (input === undefined || input === null) {
      throw new Error("input is undefined or null");
    }
    else if (input instanceof ResolvedPath) {
      return new this(input.absPath) as InstanceType<T>;
    } 
    else {
      const absPath = path.resolve(srcDir?.toString() ?? process.cwd(), input);
      return new this(absPath) as InstanceType<T>;
    }
  }


  /** Return clean relative path from cwd (or absolute) */
  get location(): string { 
    const relPath = this.getPath(process.cwd());
    return relPath.startsWith("..") ? this.absPath : relPath;
  }

  get basename(): string {
    return path.basename(this.absPath);
  }

  /** Return relative path from dir */
  getPath(dir: string|ResolvedPath): string {
    return ResolvedPath.relative(dir, this.absPath);
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
    return new DirPath(path.resolve(this.absPath, ".."));
  }
  getWriteStream(): Writable {
    return createWriteStream(this.absPath);
  }
  /** Return new instance with different source directory */
  chdir(dir: string|DirPath): FilePath {
    return FilePath.new(this.getPath(dir), dir);
  }
  rename(re: RegExp, to: string): FilePath {
    return new FilePath(this.absPath.replace(re, to));
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
    // The parentPath in dirent is always absolute (/path/to/file) when 
    // absolute path is passed to the API.
    return readdir(this.absPath, { 
      recursive: options?.recursive ?? true, 
      withFileTypes: true, 
    });
  }

  /** Return new instance with different source directory */
  chdir(dir: string|DirPath): DirPath {
    return DirPath.new(this.getPath(dir), dir);
  }

  static cwd(): DirPath {
    return DirPath.new("", process.cwd());
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