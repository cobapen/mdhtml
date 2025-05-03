import { Dirent, existsSync, lstatSync } from "node:fs";
import fs from "node:fs/promises";
import path, { basename, dirname, extname } from "node:path";

/**
 * Return basename without extension.
 * @param {string} path 
 */
export function basenameWithoutExt(path) {
  return basename(path, extname(path));
}


/**
 * Append extension if missing, otherwise return original path.
 * @param {string} path     filename
 * @param {string} ext      extension
 * @returns 
 */
export function appendMissingExt(path, ext) {
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
 * @param {string} path 
 */
export async function prepareDir(path) {
  const dir = dirname(path);
  if (dir != path && !existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Remove directory contents recursively.
 * @param {string} dir
 */
export async function cleanDir(dir) {
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
 * @param {string|Dirent} file
 */
export function isFile(file) {
  if (file instanceof Dirent) {
    return file.isFile();
  } else {
    return lstatSync(file).isFile();
  }
}