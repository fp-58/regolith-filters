export function validateRootConfig(configData: object) {
  if (!("compiler" in configData)) {
    console.error('Missing "compiler" key in config.json');
    return false;
  } else if (typeof configData.compiler !== "object" || !configData.compiler) {
    console.error('"compiler" key in config.json is not an object.');
    return false;
  } else if (!("plugins" in configData.compiler)) {
    console.error('Missing "plugins" key in "compiler" key in config.json');
    return false;
  } else if (!Array.isArray(configData.compiler.plugins)) {
    console.error(
      '"plugins" key in "compiler" key in config.json is not an array.',
    );
    return false;
  }
  return true;
}

// deno-lint-ignore no-explicit-any
export function rewriteRootConfig(configData: any) {
  configData.packs = {
    behaviorPack: "./BP",
    resourcePack: "./RP",
  };

  const plugins = configData.compiler.plugins;
  for (let i = 0; i < plugins.length; i++) {
    switch (plugins[i]) {
      case "simpleRewrite":
        plugins[i] = { packName: "project" };
        break;

      case "rewriteForPackaging":
        console.warn('Dash plugin "rewriteForPackaging" will be ignored.');
        plugins.splice(i--, 1);
        break;

      default:
        if (Array.isArray(plugins[i])) {
          switch (plugins[i][0]) {
            case "simpleRewrite":
              plugins[i][1].packName = "project";
              delete plugins[i][1].packNameSuffix;
              break;

            case "rewriteForPackaging":
              console.warn(
                'Dash plugin "rewriteForPackaging" will be ignored.',
              );
              plugins.splice(i--, 1);
              break;

            default:
              break;
          }
        }
        break;
    }
  }
}
