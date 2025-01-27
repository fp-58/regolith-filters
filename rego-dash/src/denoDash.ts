/*
 * MIT License
 *
 * Copyright (c) 2022 bridge-team
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Function and class bodies copied from deno-dash-compiler version 1.0.0

import { FileType, IFileType, PackType } from "@bridge-editor/mc-project-core";
import { FileSystem } from "@bridge-editor/dash-compiler";
import * as path from "@std/path";

export function requestJsonData(dataPath: string) {
  return fetch(
    dataPath.replace(
      "data/",
      "https://raw.githubusercontent.com/bridge-core/editor-packages/main/",
    ),
  ).then((resp) => resp.json());
}

export class PackTypeImpl extends PackType<void> {
  async setup() {
    this.packTypes = await fetch(
      "https://raw.githubusercontent.com/bridge-core/editor-packages/main/packages/minecraftBedrock/packDefinitions.json",
    ).then((resp) => resp.json());
  }
}
export class FileTypeImpl extends FileType<void> {
  protected _cache = new Map<string, IFileType | null>();

  async setup() {
    this._cache.clear();
    this.fileTypes = await fetch(
      "https://raw.githubusercontent.com/bridge-core/editor-packages/main/dist/minecraftBedrock/fileDefinitions.json",
    ).then((resp) => resp.json());
  }

  override addPluginFileType(fileDef: IFileType) {
    this._cache.clear();

    return super.addPluginFileType(fileDef);
  }

  override get(
    filePath?: string,
    searchFileType?: string,
    checkFileExtension = true,
  ) {
    const result = (() => {
      if (!filePath || !checkFileExtension || searchFileType !== undefined) {
        return super.get(filePath, searchFileType, checkFileExtension);
      }

      const cached = this._cache.get(filePath);
      if (cached !== undefined) return cached ?? undefined;

      const result = super.get(filePath, searchFileType, checkFileExtension);
      this._cache.set(filePath, result ?? null);
      return result;
    })();
    return result;
  }
}

export class DenoFileSystem extends FileSystem {
  constructor(protected baseDirectory: string = "") {
    super();
  }

  protected resolvePath(filePath: string) {
    // If filePath is absolute path or no baseDirectory is set, return filePath
    if (this.baseDirectory === "" || path.isAbsolute(filePath)) {
      return filePath;
    }

    // console.log(path.join(this.baseDirectory, filePath))
    return path.join(this.baseDirectory, filePath);
  }

  async readFile(filePath: string) {
    const fileData = await Deno.readFile(this.resolvePath(filePath));

    return new File([fileData], path.basename(filePath));
  }
  async writeFile(filePath: string, content: string | Uint8Array) {
    const dirPath = path.dirname(this.resolvePath(filePath));

    await Deno.mkdir(dirPath, {
      recursive: true,
    });

    if (typeof content === "string") {
      await Deno.writeTextFile(this.resolvePath(filePath), content);
    } else return Deno.writeFile(this.resolvePath(filePath), content);
  }
  async unlink(path: string) {
    await Deno.remove(this.resolvePath(path), { recursive: true });
  }
  async readdir(path: string) {
    const entries = [];

    for await (const entry of Deno.readDir(this.resolvePath(path))) {
      entries.push(
        {
          name: entry.name,
          kind: entry.isDirectory ? "directory" : "file",
        } as const,
      );
    }

    return entries;
  }
  override async copyFile(from: string, to: string, destFs = this) {
    // Fallback to slow path if destination fs !== this
    if (destFs !== this) return super.copyFile(from, to, destFs);

    const transformedTo = this.resolvePath(to);
    const dirPath = path.dirname(transformedTo);
    await Deno.mkdir(dirPath, {
      recursive: true,
    });

    await Deno.copyFile(this.resolvePath(from), transformedTo);
  }
  async mkdir(dirPath: string): Promise<void> {
    await Deno.mkdir(this.resolvePath(dirPath), { recursive: true });
  }
  async lastModified(filePath: string) {
    return (
      (await Deno.stat(this.resolvePath(filePath))).mtime?.getTime() ?? 0
    );
  }
}
