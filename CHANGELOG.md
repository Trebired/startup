# Changelog

## 0.6.1

### Changed

- Moved the `@trebired/utils` dependency range from `^0.6.0` to `^0.8.0`, matching the rest of
  the `@trebired` packages. For 0.x versions those two ranges are disjoint (`>=0.6.0 <0.7.0` vs
  `>=0.8.0 <0.9.0`), so any project combining this package with one already on `^0.8.0`
  (`@trebired/frontend`, `@trebired/uploads`, `@trebired/env`, `@trebired/security`) resolved two
  copies of `@trebired/utils` — a hoisted 0.6.x alongside a nested 0.8.x — duplicating code and
  letting app-level imports of `@trebired/utils` silently resolve to a different copy than this
  package used internally. Nothing this package uses changed across those releases; the only
  breaking change in 0.8.0 was the env module moving to `@trebired/env`, which this package does
  not import.

## 0.6.0

### Added

- Startup messages can select a named preset instead of restating a template. `messages.<key>.preset` picks from a registry grouped by message key, so a `ready` style cannot be chosen for `welcome`. `welcome` offers `prose`, `minimal`, and `banner`; `ready` offers `prose`, `raw`, `timed`, and `minimal`. Resolution is explicit `text` first, then the named preset, then the key's default preset; `level` follows the same order, so a preset carries its own level unless one is configured. An unknown preset name throws during `normalizeConfig()` rather than falling back, so a typo cannot silently emit different output than the config asked for.
- `origin` and `loopbackOrigin` are derived from the primary port requirement. Both were already declared on `StartupMessageData` but were only ever populated when a caller passed them, so an origin-based message rendered as `Server ready :: `. `resolvePrimaryOrigins()` builds them from the requirement's `host`/`hostEnv` and resolved port, treating a wildcard bind (`0.0.0.0`, `::`) as loopback since that is where the server is actually reachable. A caller-supplied value still wins.
- `MESSAGE_PRESETS`, `messagePresetNames()`, and `resolveMessagePreset()` are exported for tooling.

### Fixed

- A message line whose placeholders cannot be resolved is now skipped instead of logged half-rendered. `renderTemplate()` substitutes an empty string for anything missing, which turned `Server ready :: {origin}` into `Server ready :: ` when no port was resolvable. Other lines of the same message still emit.

The shipped `welcome` and `ready` text is unchanged — it is now the `prose` preset and remains the default, so an app that configures no preset logs exactly what it logged before.

## 0.5.5

- Updated bootstrap and result dependency ranges to the current package releases so consumers do not retain older nested logger-adapter installs.

## 0.5.4

- Updated bootstrap and logger-adapter dependencies so startup-owned bootstrap initialization logs use the idempotent package initialization path.

## 0.5.3

- Removed dead `config.creator` from `package.json`.
- Updated shared utilities to `@trebired/utils@^0.6.0` and replaced the removed `readPackageIdentity()` with `readPackageJsonUrl()` + `readOrganizationIdentity()` + `packageSlug()`/`joinLogGroup()`. No change to exported metadata values.

## 0.5.2

- Made startup task, service, step, lifecycle, and timing logs package-owned and generic.
- Kept caller-specific labels in metadata instead of allowing custom groups or messages.
- Stopped logging successful scheduled task runs; only failures are logged.

## 0.5.0

- Added generic process requirements so apps can declare root, uid, and gid preflight checks in startup config.

## 0.4.1

- Trimmed public config type exports so requirement internals stay internal to the package.

## 0.4.0

- Added generic startup helpers for boot token parsing, lifecycle failure handling, startup state flags, strict listen handling, task cleanup management, startup step orchestration, and discovered-file bootstrapping.

## 0.3.1

- Normalized loggers inside direct requirement checks so apps can pass the standard Trebired logger shape.

## 0.3.0

- Renamed public config types to package-local names such as `Config`, `NormalizedConfig`, and `PathRequirementConfig`.

## 0.2.0

- Added generic value validators, path templates, URL required part checks, and port host env support for startup requirements.
- Moved startup requirement, message, and runtime logs under explicit package-owned log groups.
- Updated direct package dependencies to current Trebired versions.

## 0.1.3

- Updated shared utilities to `@trebired/utils@^0.4.4`.

All notable package changes are documented here.

## 0.1.2

- Updated shared utilities to `@trebired/utils@^0.4.3`.
- Replaced local value/version helpers and package metadata parsing with shared utilities.

## 0.1.1

- Fixed shutdown logging so Bootstrap-owned shutdown events keep the Bootstrap log group instead of being nested under Startup.

## 0.1.0

- Added the first generic startup shell with config loading, requirements checks, lifecycle glue, shutdown binding, timing helpers, and configurable startup messages.
