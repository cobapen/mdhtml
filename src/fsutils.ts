import { Dirent, existsSync, lstatSync } from "node:fs";
import fs from "node:fs/promises";
import path, { basename, dirname, extname } from "node:path";

/**
 * Return basename without extension.
 */
export function basenameWithoutExt(path: string) {
  return basename(path, extname(path));
}


/**
 * Append extension if missing, otherwise return original path.
 */
export function appendMissingExt(path: string, ext: string) {
  if (!ext.startsWith(".")) {
    ext = "." + ext;
  }
  if (extname(basename(path)) === "") {
    return path + ext;
  } else {
    return path;
  }
}



/**
 * Create parent directory if not exists for the given path
 */
export async function prepareDir(path: string) {
  const dir = dirname(path);
  if (dir != path && !existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Remove directory contents recursively.
 */
export async function cleanDir(dir: string) {
  if (existsSync(dir)) {
    const files = await fs.readdir(dir, { withFileTypes: true });
    const promises = files.map(async file => {
      const filePath = path.join(dir, file.name);
      if (file.isDirectory()) {
        return fs.rm(dir, { recursive: true, force: true });
      } else {
        return fs.unlink(filePath);
      }
    });
    await Promise.all(promises);
  }
}

/**
 * Returns true if given path (or dirent) is a file
 */
export function isFile(file: string | Dirent) {
  if (file instanceof Dirent) {
    return file.isFile();
  } else {
    return lstatSync(file).isFile();
  }
}