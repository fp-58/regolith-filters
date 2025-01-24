# deno-dash

A filter for installing and running Bridge's
[standalone Dash compiler](https://github.com/bridge-core/deno-dash-compiler).

## Before running

- Make sure you have Deno installed (both to run the filter and compile Dash if
  necessary).
- Make sure your project's `config.json` has a `"compiler"` key so Dash actually
  runs.

## Configuration

The filter can be configured by editing the `config.json` file inside the
filter's data directory (`data/deno-dash`). The following configuration options
are available:

- useGlobalDash (`true` or `false`): Skips installing Dash and tries to use a
  global Dash installation.
- globalDashCommand: The command to run if `useGlobalDash` is `true`. Default is
  `"dash_compiler"`
- dashGithubRepository: The repository to install Dash from. Default is
  `"bridge-core/deno-dash-compiler"`.
- dashVersion: The version of Dash to install. This is a semantic version
  specifier similar to the ones used by npm. Default is `"*"` (any version).
- autoUpdate: Whether to automatically update Dash to the latest version that
  satisfies `dashVersion`.

## Default configuration

```json
{
  "useGlobalDash": false,
  "globalDashCommand": "dash_compiler",
  "dashGithubRepository": "bridge-core/deno-dash-compiler",
  "dashVersion": "*",
  "autoUpdate": false
}
```
