import { join, resolve } from "@std/path";
import { DASH_BIN_PREFIX } from "./constants.ts";
import { compare as compareVersions, parse as parseVersion } from "@std/semver";

export function getDashName(version: string): string {
  return DASH_BIN_PREFIX + version;
}

function getDashBinaryUrl(repo: string, version: string) {
  if (
    compareVersions(
      parseVersion(version),
      { major: 0, minor: 4, patch: 2 },
    ) == -1
  ) {
    // Versions before 0.4.2 don't have prebuilt binary.
    return null;
  }

  const urlPrefix =
    `https://github.com/${repo}/releases/download/v${version}/dash`;

  switch (Deno.build.os) {
    case "darwin":
      switch (Deno.build.arch) {
        case "x86_64":
          return `${urlPrefix}-apple-x64`;
        case "aarch64":
          return `${urlPrefix}-apple-aarch64`;
        default:
          return null;
      }
    case "windows":
      return `${urlPrefix}.exe`;
    default:
      return null;
  }
}

export async function installDash(
  binDir: string,
  repo: string,
  version: string,
): Promise<string | null> {
  console.log(`Installing dash version ${version} into ${binDir}`);
  const installPath = join(binDir, getDashName(version));
  const dashUrl = getDashBinaryUrl(repo, version);
  if (dashUrl) {
    const dashBin = await fetch(dashUrl);
    if (dashBin.ok) {
      await Deno.writeFile(installPath, dashBin.body!);
    } else {
      if (dashBin.status == 404) {
        console.error(
          "Received HTTP 404 status while downloading prebuilt dash binary.",
        );
        console.log("Falling back to compiling from source.");
        if (await compileDash(version, installPath)) {
          return installPath;
        }
      } else {
        console.error(
          `Error while downloading prebuilt binary for dash version ${version}`,
        );
        if (dashBin.statusText) {
          console.error(`HTTP ${dashBin.status}: ${dashBin.statusText}`);
        } else {
          console.error(`HTTP ${dashBin.status}`);
        }
      }
      return null;
    }
  } else {
    console.log(
      "No prebuilt dash binary found for the current platform. Compiling from source.",
    );

    if (
      !await compileDash(version, installPath)
    ) {
      return null;
    }
  }

  return installPath;
}

function getDashScriptUrl(version: string) {
  const urlPrefix =
    "https://raw.githubusercontent.com/bridge-core/deno-dash-compiler/refs/tags/v";
  if (version === "0.1.0") {
    return `${urlPrefix}${version}/src/main.ts`;
  } else {
    return `${urlPrefix}${version}/mod.ts`;
  }
}

async function compileDash(version: string, outFile: string) {
  const compileCommand = new Deno.Command("deno", {
    args: [
      "compile",
      // --no-lock because there's issues with the lockfile for version 1.0.0
      // TODO: figure out a better solution.
      "--no-lock",
      "--output",
      resolve(outFile),
      "-A",
      getDashScriptUrl(version),
    ],
    stdout: "inherit",
    stderr: "inherit",
  });
  return (await compileCommand.output()).success;
}

export async function uninstallDash(binDir: string, version: string) {
  console.log(`Uninstalling dash version ${version} from ${binDir}`);
  await Deno.remove(
    join(binDir, getDashName(version)),
  );
}

export async function getInstalledVersions(binDir: string) {
  const versions = [];
  for await (const entry of Deno.readDir(binDir)) {
    if (!entry.isFile) continue;
    if (!entry.name.startsWith(DASH_BIN_PREFIX)) continue;
    versions.push(
      entry.name.substring(DASH_BIN_PREFIX.length),
    );
  }
  return versions;
}

interface GithubTagInfo {
  name: string;
}

export async function getAllVersions(repo: string) {
  const apiRes = await fetch(
    `https://api.github.com/repos/${repo}/tags`,
  );
  if (!apiRes.ok) {
    console.error("Failed to fetch version info for dash from Github.");
    return null;
  }
  const versions = [];
  const tagInfo: GithubTagInfo[] = await apiRes.json();
  for (const tag of tagInfo.map((v) => v.name)) {
    if (tag.startsWith("v")) {
      versions.push(
        tag.substring(1),
      );
    }
  }
  return versions;
}
