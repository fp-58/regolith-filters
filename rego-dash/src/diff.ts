import { hashFile } from "./hash.ts";
import { readDirRecursive } from "./ioUtils.ts";

export async function sourceDiff(
  expectedHashes: { path: string; hash: string }[],
  srcDir: string,
): Promise<
  {
    hashes: { path: string; hash: string }[];
    removedFiles: string[];
    updatedFiles: string[];
  }
> {
  const hashes: { path: string; hash: string }[] = [];
  let hashIndex = 0;

  const sourceFiles = await getSourceFiles(srcDir);
  let sourceIndex = 0;

  const removedFiles = [];
  const updatedFiles = [];

  while (
    hashIndex < expectedHashes.length &&
    sourceIndex < sourceFiles.length
  ) {
    const hashPath = expectedHashes[hashIndex].path;
    const prefixedSourcePath = sourceFiles[sourceIndex];
    const sourcePath = prefixedSourcePath.substring(srcDir.length + 1);

    if (hashPath < sourcePath) {
      removedFiles.push(hashPath);
      hashIndex++;
    } else if (hashPath > sourcePath) {
      updatedFiles.push(sourcePath);
      hashes.push({
        path: sourcePath,
        hash: await hashFile(prefixedSourcePath),
      });
      sourceIndex++;
    } else {
      const expectedHash = expectedHashes[hashIndex].hash;
      const actualHash = await hashFile(prefixedSourcePath);

      if (expectedHash !== actualHash) {
        updatedFiles.push(sourcePath);
      }

      hashes.push({
        path: sourcePath,
        hash: actualHash,
      });

      hashIndex++;
      sourceIndex++;
    }
  }

  for (; hashIndex < expectedHashes.length; hashIndex++) {
    removedFiles.push(expectedHashes[hashIndex].path);
  }
  for (; sourceIndex < sourceFiles.length; sourceIndex++) {
    const prefixedSourcePath = sourceFiles[sourceIndex];
    const sourcePath = prefixedSourcePath.substring(srcDir.length + 1);
    updatedFiles.push(sourcePath);
    hashes.push({
      path: sourcePath,
      hash: await hashFile(prefixedSourcePath),
    });
  }

  return {
    hashes,
    removedFiles,
    updatedFiles,
  };
}

async function getSourceFiles(srcDir: string) {
  const sourceFiles = [];
  for await (const path of await readDirRecursive(srcDir)) {
    sourceFiles.push(path);
  }
  sourceFiles.sort();
  return sourceFiles;
}
