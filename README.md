# @trebired/startup

Generic startup shell for Trebired applications.

This package owns config loading, requirements, preflight checks, startup timing, early stop behavior, shutdown binding, and configured startup messages. Callers own product-specific hooks, domain subsystems, server creation, and termination policy.

## Install

Runtime support: Bun 1+.

```sh
bun i @trebired/startup
```

## Quick Start

```ts
import { runStartup } from "@trebired/startup";

await runStartup({
  config: {
    forVersion: "0.5.0",
    requirements: {
      process: { root: true },
    },
  },
  bootstrap: {
    subsystems: [
      {
        id: "app",
        async bootstrap() {
          return null;
        },
      },
    ],
  },
});
```

## Concepts

### Startup Boundary

`@trebired/startup` sits above `@trebired/bootstrap`. Bootstrap owns dependency-ordered lifecycle execution. Startup owns reusable boot glue around requirements, timing, messages, and shutdown.

### Requirements

Requirements are structured checks for environment values, paths, URLs, PostgreSQL connections, ports, and process identity. Checks return structured results and do not terminate directly.

## Configuration

Configure startup through `.trebired/startup/config.ts`:

```ts
import { defineConfig } from "@trebired/startup/config";

export default defineConfig({
  forVersion: "0.5.0",
  requirements: {
    env: {
      required: ["DATA_DIR", "LOG_DIR"],
    },
  },
});
```

## Runtime

`runStartup()` loads config, runs early boot actions, checks requirements, executes bootstrap subsystems, emits configured messages, and binds shutdown signals. High-level runtime termination happens only through caller-provided hooks.

## Public API

Entrypoints:

- `@trebired/startup`
- `@trebired/startup/config`

The root entrypoint exports runtime creation, requirement checks, message rendering, port helpers, timing helpers, and runtime types. The config entrypoint exports `defineConfig()`, loading, normalization, and config types.

## What It Does Not Do

This package does not:

- Own product factory reset, updates, security reconciliation, or entity repair.
- Create application servers by itself.
- Replace `@trebired/bootstrap`.
- Terminate the process without caller-provided termination behavior.
