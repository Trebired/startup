# @trebired/startup

Generic Trebired application startup shell.

It sits above `@trebired/bootstrap`. Bootstrap owns dependency-ordered lifecycle execution. Startup owns reusable boot glue: config loading, requirements checks, timing helpers, shutdown binding, early boot decisions, and configured startup messages.

Apps keep domain-specific services in their own code and pass them in as hooks or bootstrap subsystems.

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
