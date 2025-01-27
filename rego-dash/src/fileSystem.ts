import { basename, join, normalize } from "@std/path";
import { DenoFileSystem } from "./denoDash.ts";
import json5 from "json5";

interface MappedFileSystemOptions {
  fileMappings?: Record<string, string>;
  directoryMappings?: Record<string, string>;
  virtualFiles?: Record<string, BlobPart>;
}

export class MappedFileSystem extends DenoFileSystem {
  private fileMappings: Record<string, string>;
  private dirMappings: Record<string, string>;
  private virtualFiles: Record<string, BlobPart>;
  constructor(protected baseDir?: string, options?: MappedFileSystemOptions) {
    super(baseDir);
    this.fileMappings = options?.fileMappings ?? {};
    this.dirMappings = options?.directoryMappings ?? {};
    this.virtualFiles = options?.virtualFiles ?? {};
  }

  protected override resolvePath(filePath: string) {
    const normalizedPath = normalize(filePath);
    if (normalizedPath in this.fileMappings) {
      return this.fileMappings[normalizedPath];
    } else {
      for (const prefix in this.dirMappings) {
        if (normalizedPath.startsWith(`${prefix}/`)) {
          return join(
            this.dirMappings[prefix],
            normalizedPath.substring(prefix.length + 1),
          );
        }
      }

      return super.resolvePath(filePath);
    }
  }

  override async readFile(filePath: string): Promise<File> {
    const virtFile = this.virtualFiles[normalize(filePath)];
    if (virtFile) {
      return new File([virtFile], basename(filePath));
    } else {
      return await super.readFile(filePath);
    }
  }
  override async readJson(path: string): Promise<any> {
    const content = await this.readFile(path);
    return json5.parse(await content.text());
  }
  override async writeFile(
    filePath: string,
    content: string | Uint8Array,
  ): Promise<void> {
    const normalizedPath = normalize(filePath);
    if (normalizedPath in this.virtualFiles) {
      this.virtualFiles[normalizedPath] = content;
    } else {
      return await super.writeFile(filePath, content);
    }
  }
  override async copyFile(
    from: string,
    to: string,
    destFs: this = this,
  ): Promise<void> {
    if (this !== destFs) return await super.copyFile(from, to, destFs);

    const normalizedSrc = normalize(from);
    const normalizedDest = normalize(to);

    const srcIsVirtual = normalizedSrc in this.virtualFiles;
    const destIsVirtual = normalizedDest in this.virtualFiles;

    if (srcIsVirtual && destIsVirtual) {
      this.virtualFiles[normalizedSrc] = this.virtualFiles[normalizedDest];
    } else if (destIsVirtual) {
      this.virtualFiles[normalizedDest] = await this.readFile(from);
    } else if (srcIsVirtual) {
      let srcData = this.virtualFiles[normalizedSrc];
      if (typeof srcData === "string") {
        await this.writeFile(to, srcData);
      } else {
        await this.writeFile(to, await new Blob([srcData]).bytes());
      }
    } else {
      return await super.copyFile(from, to, destFs);
    }
  }

  override lastModified(filePath: string): Promise<number> {
    const normalizedPath = normalize(filePath);
    if (normalizedPath in this.virtualFiles) {
      return Promise.resolve(0);
    } else {
      return super.lastModified(filePath);
    }
  }
}
