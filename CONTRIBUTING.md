# Contributing

Run the package checks before publishing:

```sh
bun run typecheck
bun run build
bun run verify:runtime
bun run verify:pack
bunx @trebired/code-discipline check
```
