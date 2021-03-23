import {
  listenAndServe,
  ServerRequest,
} from "https://deno.land/std@0.91.0/http/server.ts";
import { readerFromStreamReader } from "https://deno.land/std@0.91.0/io/mod.ts";
import { KhepriDevServer } from "../scarab/scarab.ts";
import { KhepriConfig } from "../scarab/types.ts";

export interface KhepriDevServerOptions {
  config: KhepriConfig;
  hostname?: string;
  port?: number;
  signal?: AbortSignal;
}

const msFormatter = new globalThis.Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
});

async function handleRequest(
  request: ServerRequest,
  devServer: KhepriDevServer,
  logger: Console,
): Promise<void> {
  try {
    const start = performance.now();
    const host = request.headers.get("host");
    const url = `http://${host}${request.url}`;
    logger.info(`[KHEPRI:DENO] ${request.method} ${url} received`);
    const buffer = await Deno.readAll(request.body);
    const req = new Request(url, {
      body: buffer,
      headers: request.headers,
      method: request.method,
    });
    const response = await devServer.load(req);
    await request.respond({
      body: response.body
        ? readerFromStreamReader(response.body.getReader())
        : undefined,
      headers: response.headers,
      status: response.status,
    });
    const duration = performance.now() - start;
    logger.info(
      `[KHEPRI:DENO] ${request.method} ${url} ${response.status} ${response.statusText} completed in ${
        msFormatter.format(duration)
      }`,
    );
  } catch (err) {
    logger.error(err);
  }
}

export async function startDevServer({
  config,
  hostname = "0.0.0.0",
  port = 8080,
}: KhepriDevServerOptions): Promise<void> {
  const { logger = console } = config;
  logger.info(
    `[KHEPRI:DENO] webserver running. Access it at: http://${hostname}:${port}/`,
  );
  const devServer = await KhepriDevServer.start(config);
  // Listen for incoming requests without waiting
  await listenAndServe({ hostname, port }, (request) => {
    handleRequest(request, devServer, logger);
  });
}
