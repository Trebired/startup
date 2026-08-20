# Changelog

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
