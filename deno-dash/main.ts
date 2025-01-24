import { join } from "@std/path";
import {
  compare as compareVers,
  format as formatVer,
  formatRange,
  maxSatisfying,
  parse as parseVer,
  parseRange,
  Range as VerRange,
} from "@std/semver";
import {
  getAllVersions,
  getInstalledVersions,
  installDash,
  uninstallDash,
} from "./src/installer.ts";
import { DASH_BIN_PREFIX, FILTER_NAME } from "./src/constants.ts";
import { readJsonFile } from "./src/utils.ts";
import {
  checkProjectConfig,
  loadFilterConfig,
  prepareProjectConfig,
} from "./src/config.ts";

const dataDir = join("data", FILTER_NAME);
const binDir = join(dataDir, "bin");

if (import.meta.main) {
  await Deno.mkdir(dataDir, { recursive: true });

  const projectDir = Deno.env.get("ROOT_DIR")!;
  const projectConfig = await readJsonFile(join(projectDir, "config.json"));
  if (!checkProjectConfig(projectConfig)) {
    Deno.exit(1);
  }
  prepareProjectConfig(projectConfig);
  await Deno.writeTextFile("config.json", JSON.stringify(projectConfig));

  const filterConfig = await loadFilterConfig(join(dataDir, "config.json"));

  let dashCommandPath: string | null = null;
  if (filterConfig.useGlobalDash) {
    console.log("Using global dash installation.");
    dashCommandPath = filterConfig.globalDashCommand;
  } else {
    console.log("Using local dash installation.");
    dashCommandPath = await findOrInstallLocalDash(
      parseRange(filterConfig.dashVersion),
      filterConfig.autoUpdate,
    );
  }
  if (!dashCommandPath) {
    Deno.exit(1);
  }

  const dashProcess = await new Deno.Command(dashCommandPath, {
    args: ["build"],
    stdout: "inherit",
    stderr: "inherit",
  }).output();
  if (!dashProcess.success) {
    Deno.exit(dashProcess.code);
  }

  const packMovers = [];
  if ("behaviorPack" in projectConfig.packs) {
    packMovers.push(
      Deno.remove("BP", { recursive: true }).then(() =>
        Deno.rename(join("builds", "dist", "project BP"), "BP")
      ),
    );
  }
  if ("resourcePack" in projectConfig.packs) {
    packMovers.push(
      Deno.remove("RP", { recursive: true }).then(() =>
        Deno.rename(join("builds", "dist", "project RP"), "RP")
      ),
    );
  }
  await Promise.allSettled(packMovers);
}

async function findOrInstallLocalDash(
  versionRange: VerRange,
  autoUpdate: boolean,
): Promise<string | null> {
  await Deno.mkdir(binDir, { recursive: true });

  const installedVersions = await getInstalledVersions(binDir);
  let usableVersion = maxSatisfying(
    installedVersions.map(parseVer),
    versionRange,
  );

  if (!usableVersion) {
    const allVersions = await getAllVersions();
    if (allVersions) {
      usableVersion = maxSatisfying(
        allVersions.map(parseVer),
        versionRange,
      );
      if (usableVersion) {
        return await installDash(
          binDir,
          formatVer(usableVersion),
        );
      } else {
        console.error(
          `No dash version matched range ${formatRange(versionRange)}`,
        );
      }
    }
    return null;
  } else {
    if (autoUpdate) {
      const allVersions = await getAllVersions();
      if (allVersions) {
        const newVersion = maxSatisfying(
          allVersions.map(parseVer),
          versionRange,
        );
        if (newVersion && compareVers(newVersion, usableVersion) > 0) {
          const newVerStr = formatVer(newVersion);
          console.log(`Found newer dash version ${newVerStr}.`);
          const dashCommandPath = await installDash(binDir, newVerStr);
          if (dashCommandPath) {
            await uninstallDash(binDir, formatVer(usableVersion));
          }
          return dashCommandPath;
        }
      }
    }
    return join(binDir, DASH_BIN_PREFIX + formatVer(usableVersion));
  }
}
