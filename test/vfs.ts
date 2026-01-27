/**
 * Virtual File System Utilities (For testing)
 * 
 * Intended to be used with memfs and vitest. 
 */
import fs from "node:fs/promises";
import { dirname, resolve } from "node:path";

export type Arg0<T> = T extends (_0: infer A) => any ? A : never;
export type Arg1<T> = T extends (_0: any, _1: infer A) => any ? A : never;
export type Arg2<T> = T extends (_0: any, _1: any, _2: infer A) => any ? A : never;

export async function mkdir(path: string): Promise<void> {
  await fs.mkdir(resolve(path), { recursive: true });
}

export async function writeFile<T extends typeof fs.writeFile>(path: string, data: Arg1<T>): Promise<void> {
  if (typeof path === "string") {
    await fs.mkdir(dirname(path), { recursive: true });
    await fs.writeFile(resolve(path), data);
  } 
  else {
    await fs.writeFile(path, data);
  }
}

export const vfs = {
  mkdir,
  writeFile
};

export default vfs;

