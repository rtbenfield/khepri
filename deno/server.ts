import { KhepriDevServer } from "../scarab/mod.ts";
import type { KhepriConfig } from "../scarab/mod.ts";

export interface KhepriDevServerOptions {
  config: KhepriConfig;
  hostname?: string;
  port?: number;
  signal?: AbortSignal;
}

async function handleConnection(
  conn: Deno.Conn<Deno.NetAddr>,
  devServer: KhepriDevServer,
  logger: Console,
): Promise<void> {
  try {
    for await (const { request, respondWith } of Deno.serveHttp(conn)) {
      // Fix Request.url property
      // Deno.serveHttp in 1.9 constructs this with the path only
      // This breaks new URL(request.url) and request.clone()
      const url = new URL(
        request.url,
        `http://${conn.localAddr.hostname}:${conn.localAddr.port}`,
      );
      const req = new Request(url.toString(), request);
      const response = await devServer.load(req);
      await respondWith(response);
    }
  } catch (err) {
    logger.error(err);
  }
}

export async function startDevServer({
  config,
  hostname = "0.0.0.0",
  port = 8080,
}: KhepriDevServerOptions): Promise<void> {
  const { logger } = config;
  logger.info(
    `[KHEPRI:DENO] webserver running. Access it at: http://${hostname}:${port}/`,
  );
  const devServer = await KhepriDevServer.start(config);
  // Listen for incoming requests without waiting
  for await (const conn of Deno.listen({ hostname, port })) {
    handleConnection(conn, devServer, logger);
  }
}
