import { join } from "@std/path/join";

export async function readJsonFile(path: string) {
  const text = await Deno.readTextFile(path);
  return JSON.parse(text);
}

export async function pathExists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw error;
    }
  }
}

export async function readJsonIfExists(path: string) {
  const text = await readTextIfExists(path);
  if (text) {
    return JSON.parse(text);
  } else {
    return undefined;
  }
}

export async function removeIfExists(
  path: string,
  options?: Deno.RemoveOptions,
) {
  try {
    await Deno.remove(path, options);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) {
      throw error;
    }
  }
}

export async function readTextIfExists(
  path: string,
  options?: Deno.ReadFileOptions,
) {
  try {
    return await Deno.readTextFile(path, options);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return undefined;
    } else {
      throw error;
    }
  }
}

export async function* readDirRecursive(path: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(path)) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory) {
      yield* readDirRecursive(entryPath);
    } else {
      yield entryPath;
    }
  }
}

export async function copyDir(srcDir: string, destDir: string) {
  const copyPromises = [];
  for await (const entry of Deno.readDir(srcDir)) {
    const entrySrc = join(srcDir, entry.name);
    const entryDest = join(destDir, entry.name);
    if (entry.isFile) {
      copyPromises.push(Deno.copyFile(entrySrc, entryDest));
    } else if (entry.isDirectory) {
      copyPromises.push(
        Deno.mkdir(entryDest, { recursive: true }).then(() =>
          copyDir(entrySrc, entryDest)
        ),
      );
    }
  }

  await Promise.all(copyPromises);
}
