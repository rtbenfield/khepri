import { extname } from "https://deno.land/std@0.91.0/path/mod.ts";
import type {
  KhepriConfig,
  KhepriMountConfig,
  KhepriPlugin,
  PluginRunOptions,
} from "./types.ts";
import { runPlugin } from "./utils.ts";

const msFormatter = new globalThis.Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
});

// function createResponse(
//   body: string | void | KhepriBuildMap | null | undefined,
// ): Response {
//   if (typeof body === "string") {
//     return new Response(body, { status: 200 });
//   } else if (body) {
//     return new Response(body, { status: 200 });
//   } else {
//     return new Response(null, { status: 404 });
//   }
// }

function getCacheKey(request: Request): string {
  return `${request.method}|${request.url}`;
}

class Cache {
  readonly #cache = new Map<string, Response>();

  public async add(request: Request): Promise<void> {
    const response = await fetch(request);
    this.#cache.set(getCacheKey(request), response.clone());
  }

  public async addAll(requests: readonly Request[]): Promise<void> {
    await Promise.all(requests.map((r) => this.add(r)));
  }

  public match(request: Request): Promise<Response | undefined> {
    // Disable cache until we know when to invalidate
    return Promise.resolve(undefined);
    if (request instanceof Request) {
      return Promise.resolve(this.#cache.get(getCacheKey(request)));
    } else {
      throw new TypeError("Parameter request must be of type Request or URL");
    }
  }

  public matchAll(request: Request): Promise<Response[] | undefined> {
    throw new Error("Not implemented.");
  }

  public put(request: Request, response: Response): Promise<void> {
    this.#cache.set(getCacheKey(request), response);
    return Promise.resolve();
  }
}

/**
 * KhepriDevServer starts a development environment suitable for live editing
 * and handling incoming requests. It **does not** start a web server bound
 * to a port, but remains unopinionated about the web server implementation.
 * Remaining unopinionated allows KhepriDevServer to support multiple
 * JavaScript runtimes through lightweight wrappers.
 * 
 * KhepriDevServer utilizes standard Request and Response types for
 * interfacing with consumers exposing an HTTP layer. It also utilizes the
 * File System Access API for supplying a file system interface. These
 * standard interfaces should be capable of implementation in all JavaScript
 * runtimes.
 */
export class KhepriDevServer {
  readonly #cache = new Cache();
  readonly #config: KhepriConfig;
  readonly #controller = new AbortController();
  readonly #logger: Console;
  readonly #plugins: readonly KhepriPlugin[];

  private constructor(config: KhepriConfig) {
    this.#config = config;
    this.#logger = config.logger;
    this.#plugins = config.plugins.map((plugin) => plugin(config));
  }

  readonly #findLoader = (request: Request): KhepriPlugin | undefined => {
    const extension = extname(request.url);
    return this.#plugins.find((x) =>
      typeof x.load === "function" && x.resolve?.output.includes(extension)
    );
  };

  readonly #getFileMount = async (
    request: Request,
  ): Promise<[File, KhepriMountConfig] | null> => {
    const { pathname } = new URL(request.url);
    const mount = this.#config.mount.find((x) => pathname.startsWith(x.url));
    if (mount) {
      const parts = pathname.replace(mount.url, "").split("/");
      try {
        let dir: FileSystemDirectoryHandle = mount.root;
        for (const dirName of parts.slice(0, -1)) {
          dir = await dir.getDirectoryHandle(dirName);
        }
        const fileHandle = await dir.getFileHandle(parts.slice(-1)[0]);
        const file = await fileHandle.getFile();
        return [file, mount];
      } catch (err) {
        // TODO: Check for specific error types. Target the file not found
        return null;
      }
    } else {
      return null;
    }
  };

  public async load(request: Request): Promise<Response> {
    this.#logger.debug(`[KHEPRI] ${request.method} ${request.url} load`);
    const cacheHit = await this.#cache.match(request);
    if (cacheHit) {
      this.#logger.debug(`[KHEPRI] ${request.method} ${request.url} cache hit`);
      return cacheHit.clone();
    }

    const pair = await this.#getFileMount(request);
    if (!pair) {
      return new Response(null, { status: 404 });
    } else if (pair[1].static) {
      return new Response(pair[0].stream(), { status: 200 });
    } else {
      const [file] = pair;
      const loader = this.#findLoader(request);
      if (loader && typeof loader.load === "function") {
        this.#logger.debug(
          `[KHEPRI] ${request.method} ${request.url} matched ${loader.name}`,
        );
        try {
          const results = await loader.load({
            file,
            isDev: true,
            isHmrEnabled: false,
            isSSR: false,
          }, this.#controller.signal);
          const response = new Response(results.stream(), {
            headers: {
              "Content-Type": results.type,
            },
            status: 200,
          });
          this.#cache.put(request.clone(), response.clone());
          return response;
        } catch (err) {
          this.#logger.error(
            `[KHEPRI] load error using plugin ${loader.name}`,
            err,
          );
          return new Response(null, { status: 500 });
        }
      } else {
        // Not a static file, but no loader matched
        this.#logger.warn(
          `[KHEPRI] ${request.method} ${request.url} did not match a compatible loader plugin`,
        );
        return new Response(null, { status: 404 });
      }
    }
  }

  readonly #run = (): void => {
    for (const plugin of this.#plugins) {
      const options: PluginRunOptions = { isDev: true };
      runPlugin(plugin, options, this.#logger, this.#controller.signal);
    }
  };

  /**
   * Stops the dev server instance and spawned process.
   * Shutdown is recommended when the server should be stopped but the
   * JavaScript runtime process will remain active. Failing to shutdown
   * will leak processes and memory.
   * @returns Promise that resolves when the dev server is stopped.
   */
  public shutdown(): Promise<void> {
    this.#controller.abort();
    return Promise.resolve();
  }

  /**
   * Starts a new KhepriDevServer instance with the provided configuration.
   * Start is preferred to a constructor to ensure that all lifecycle events
   * are handled, such as running plugins.
   * @param config
   * @returns Promise that resolves when the dev server is started.
   */
  public static start(
    config: KhepriConfig,
  ): Promise<KhepriDevServer> {
    const devServer = new KhepriDevServer(config);
    devServer.#run();
    return Promise.resolve(devServer);
  }
}
