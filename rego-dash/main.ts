import { isMatch } from "@bridge-editor/common-utils";
// @deno-types = "https://esm.sh/@bridge-editor/dash-compiler@0.11.7"
import { Dash, initRuntimes } from "@bridge-editor/dash-compiler";
import { dirname, join } from "@std/path";
import { FileTypeImpl, PackTypeImpl, requestJsonData } from "./src/denoDash.ts";
import { MappedFileSystem } from "./src/fileSystem.ts";
import { FILTER_NAME, HASHES_FILE_NAME, SWC_VERSION } from "./src/constants.ts";
import { rewriteRootConfig, validateRootConfig } from "./src/config.ts";
import {
  copyDir,
  pathExists,
  readJsonFile,
  readJsonIfExists,
  removeIfExists,
} from "./src/ioUtils.ts";
import { sourceDiff } from "./src/diff.ts";
import { MAX_DATA_CACHE_LIFE } from "./src/constants.ts";

if (import.meta.main) {
  const srcDir = "src";
  const dataDir = join("data", FILTER_NAME);
  const cacheDir = join(dataDir, "cache");
  const lockFile = join(cacheDir, ".sessionlock");
  const sourceHashesFile = join(cacheDir, HASHES_FILE_NAME);
  const dashDataFile = join(cacheDir, "dashData.json");
  const fileCacheDir = join(cacheDir, "files");
  const dataCacheDir = join(cacheDir, "data");

  const rootDir = Deno.env.get("ROOT_DIR");
  if (!rootDir) {
    Deno.exit(1);
  }

  const projectConfig = await readJsonFile(join(rootDir, "config.json"));
  if (!validateRootConfig(projectConfig)) {
    Deno.exit(1);
  }
  rewriteRootConfig(projectConfig);

  await Deno.mkdir("src", { recursive: true });
  await Promise.all([
    Deno.rename("BP", join("src", "BP")),
    Deno.rename("RP", join("src", "RP")),
  ]);

  let expectedHashes;
  if (await pathExists(lockFile)) {
    expectedHashes = [];
    // If the session lock file still exists then the files edited by dash are
    // probably corrupted, so we need to remove them.
    await Promise.all([
      removeIfExists(fileCacheDir, { recursive: true }),
      removeIfExists(dashDataFile),
    ]);
  } else {
    expectedHashes = await readJsonIfExists(sourceHashesFile) ?? [];
  }

  const { hashes, removedFiles, updatedFiles } = await sourceDiff(
    expectedHashes,
    srcDir,
  );

  console.log(
    `Found ${updatedFiles.length} updated files and ${removedFiles.length} removed files.`,
  );

  await Deno.mkdir(fileCacheDir, { recursive: true });
  await Deno.writeTextFile(sourceHashesFile, JSON.stringify(hashes));

  initRuntimes(`https://esm.sh/@swc/wasm-web@${SWC_VERSION}/wasm-web_bg.wasm`);
  const dash = createDashService(
    srcDir,
    fileCacheDir,
    dataCacheDir,
    dashDataFile,
    projectConfig,
  );
  await dash.setup();

  await Deno.create(lockFile);
  if (removedFiles.length > 0) {
    await dash.unlinkMultiple(removedFiles, updatedFiles.length === 0);
  }
  if (updatedFiles.length > 0) {
    await dash.updateFiles(updatedFiles, true);
  }
  await Deno.remove(lockFile);

  console.log("Copying cached compiled files into BP and RP directories.");
  await Promise.all([
    Deno.mkdir("BP").then(() => copyDir(join(fileCacheDir, "BP"), "BP")),
    Deno.mkdir("RP").then(() => copyDir(join(fileCacheDir, "RP"), "RP")),
  ]);
}

function createDashService(
  srcDir: string,
  fileCacheDir: string,
  dataCacheDir: string,
  dashDataFile: string,
  projectConfig: object,
) {
  const fileMappings: Record<string, string> = {
    ".bridge/.dash.development.json": dashDataFile,
  };
  const mappedFs = new MappedFileSystem(srcDir, {
    fileMappings,
    directoryMappings: {
      [join("builds", "dev", "project BP")]: join(fileCacheDir, "BP"),
      [join("builds", "dev", "project RP")]: join(fileCacheDir, "RP"),
    },
    virtualFiles: {
      "config.json": JSON.stringify(projectConfig),
    },
  });
  return new Dash(mappedFs, undefined, {
    config: "config.json",
    // deno-lint-ignore no-explicit-any
    fileType: new FileTypeImpl(undefined, isMatch) as any,
    // deno-lint-ignore no-explicit-any
    packType: new PackTypeImpl(undefined) as any,
    requestJsonData: (dataPath: string) =>
      requestCachedJsonData(dataCacheDir, dataPath),
    mode: "development",
    verbose: true,
  });
}

async function requestCachedJsonData(dataCacheDir: string, dataPath: string) {
  const cachedPath = join(
    dataCacheDir,
    // Remove leading 'data' since that should already be in dataCacheDir.
    dataPath.replace(/^data[/\\]/, ""),
  );

  try {
    const cachedFile = await Deno.open(cachedPath);
    const fileInfo = await cachedFile.stat();
    const mtime = fileInfo.mtime?.getTime() ?? 0;

    if (Date.now() - mtime < MAX_DATA_CACHE_LIFE) {
      const cachedResponse = new Response(cachedFile.readable);
      return await cachedResponse.json();
    } else {
      // Surround this in a try-catch since requestJsonData can throw errors
      // when there are network connectivity errors (such as timeouts).
      try {
        return await updateCachedJsonData(dataPath, cachedPath);
      } catch (error) {
        console.error(error);
        console.warn(`Failed to update cached value for ${dataPath}`);
        console.warn(`Using stale content for ${dataPath}`);

        const cachedResponse = new Response(cachedFile.readable);
        return await cachedResponse.json();
      }
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return await updateCachedJsonData(dataPath, cachedPath);
    } else {
      throw error;
    }
  }
}

async function updateCachedJsonData(dataPath: string, cachedPath: string) {
  const updatedContent = await requestJsonData(dataPath);
  await Deno.mkdir(dirname(cachedPath), { recursive: true });
  await Deno.writeTextFile(cachedPath, JSON.stringify(updatedContent));
  return updatedContent;
}
