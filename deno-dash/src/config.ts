import defaultConfig from "./defaults.json" with { type: "json" };
import { readJsonFile } from "../src/utils.ts";

export async function loadFilterConfig(
  configFile: string,
): Promise<typeof defaultConfig> {
  try {
    const config = await readJsonFile(configFile);
    if (typeof config !== "object" || Array.isArray(config)) {
      console.warn("Invalid config file: root object is not an object.");
    } else {
      for (const key in defaultConfig) {
        if (!(key in config)) {
          config[key] = defaultConfig[key as keyof typeof defaultConfig];
        }
      }
      return config;
    }
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      console.warn(`Missing config file at ${configFile}`);
    } else {
      throw err;
    }
  }

  console.warn(`Using default configuration.`);
  return defaultConfig;
}

export function checkProjectConfig(config: object) {
  if (!("compiler" in config)) {
    console.error('Missing "compiler" property in project config.');
    return false;
  }

  return true;
}

// deno-lint-ignore no-explicit-any
export function prepareProjectConfig(projectConfig: any) {
  if ("behaviorPack" in projectConfig.packs) {
    projectConfig.packs.behaviorPack = "./BP";
  }
  if ("resourcePack" in projectConfig.packs) {
    projectConfig.packs.resourcePack = "./RP";
  }

  // deno-lint-ignore no-explicit-any
  const plugins: (string | [string, any])[] = projectConfig.compiler.plugins;
  for (let i = 0; i < plugins.length; i++) {
    if (Array.isArray(plugins[i])) {
      switch (plugins[i][0]) {
        case "simpleRewrite":
          plugins[i][1].packName = "project";
          delete plugins[i][1].packNameSuffix;
          break;
        case "rewriteForPackaging":
          console.warn('Dash plugin "rewriteForPackaging" will be ignored.');
          plugins.splice(i--, 1);
          break;
        default:
          break;
      }
    }
  }
}
