# deno-dash

A filter for installing and running Bridge's
[standalone Dash compiler](https://github.com/bridge-core/deno-dash-compiler).

Supports any version of Dash for Windows and Mac, but only supports version
1.0.0 or greater for any other system. This is because on systems other than
Windows or Mac, the Dash compiler has to be compiled from source using Deno v2
and previous versions of Dash were compiled with Deno v1.

## Before running

- Make sure you have Deno v2 installed.
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
- dashVersion: The version of Dash to install. This is a semantic version
  specifier similar to the ones used by npm. Default is `"*"` (any version).
- autoUpdate: Whether to automatically update Dash to the latest version that
  satisfies `dashVersion`.

## Default configuration

```json
{
  "useGlobalDash": false,
  "globalDashCommand": "dash_compiler",
  "dashVersion": "*",
  "autoUpdate": false
}
```
