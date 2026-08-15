import { parsePort } from "#ports";

type ListenAddress = {
  host: string | null;
  port: number;
};

type ListenStrictOptions = {
  host?: string;
  port: number;
};

function parsePortStrict(raw: unknown, label = "PORT"): number {
  return parsePort(raw, label);
}

function listenStrict(
  server: any,
  options: ListenStrictOptions,
): Promise<ListenAddress> {
  return new Promise((resolve, reject) => {
      const host = String(options.host || "").trim() || undefined;
      const port = Number(options.port);
      const onError = createListenErrorHandler(server, host, port, reject);

      server.on("error", onError);
      server.listen({ host, port }, () => {
          server.off("error", onError);
          resolve(readListenAddress(server, host, port));
      });
  });
}

function createListenErrorHandler(
  server: any,
  host: string | undefined,
  port: number,
  reject: (reason?: unknown) => void,
) {
  return function onError(error: any) {
    server.off("error", onError);
    if (error && typeof error === "object") {
      if (error.requested_host == null) error.requested_host = host || null;
      if (error.requested_port == null) error.requested_port = port;
    }
    reject(error);
  };
}

function readListenAddress(
  server: any,
  host: string | undefined,
  port: number,
): ListenAddress {
  const address = typeof server.address === "function" ? server.address() : null;
  return {
    host:
    address && typeof address === "object" && typeof address.address === "string"
    ? address.address
    : host || null,
    port:
    address && typeof address === "object" && typeof address.port === "number"
    ? address.port
    : port,
  };
}

export {
  listenStrict,
  parsePortStrict,
};

export type {
  ListenAddress,
  ListenStrictOptions,
};
