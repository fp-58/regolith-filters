import { isMatch } from "@bridge-editor/common-utils";
// @deno-types = "https://esm.sh/@bridge-editor/dash-compiler@0.11.7"
import { Dash, initRuntimes } from "@bridge-editor/dash-compiler";
import { join } from "@std/path/join";
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

if (import.meta.main) {
  const srcDir = "src";
  const dataDir = join("data", FILTER_NAME);
  const cacheDir = join(dataDir, "cache");
  const lockFile = join(cacheDir, ".sessionlock");
  const sourceHashesFile = join(cacheDir, HASHES_FILE_NAME);
  const dashDataFile = join(cacheDir, "dashData.json");
  const fileCacheDir = join(cacheDir, "files");

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
    // If the session lock file still exists then the cache is probably
    // corrupted, so we need to remove its files.
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

  await Deno.mkdir(fileCacheDir, { recursive: true });
  await Deno.writeTextFile(sourceHashesFile, JSON.stringify(hashes));

  initRuntimes(`https://esm.sh/@swc/wasm-web@${SWC_VERSION}/wasm-web_bg.wasm`);
  const dash = createDashService(
    srcDir,
    fileCacheDir,
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

  await Promise.all([
    Deno.mkdir("BP").then(() => copyDir(join(fileCacheDir, "BP"), "BP")),
    Deno.mkdir("RP").then(() => copyDir(join(fileCacheDir, "RP"), "RP")),
  ]);
}

function createDashService(
  srcDir: string,
  fileCacheDir: string,
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
    requestJsonData,
    mode: "development",
    verbose: true,
  });
}
