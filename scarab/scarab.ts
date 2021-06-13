import type {
  KhepriConfig,
  KhepriLoadPlugin,
  KhepriMountConfig,
  KhepriPlugin,
  PluginRunOptions,
} from "./types.ts";
import { extname, runPlugin } from "./utils.ts";

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

  async add(request: Request): Promise<void> {
    const response = await fetch(request);
    this.#cache.set(getCacheKey(request), response.clone());
  }

  async addAll(requests: readonly Request[]): Promise<void> {
    await Promise.all(requests.map((r) => this.add(r)));
  }

  match(request: Request): Promise<Response | undefined> {
    // Disable cache until we know when to invalidate
    return Promise.resolve(undefined);
    if (request instanceof Request) {
      return Promise.resolve(this.#cache.get(getCacheKey(request)));
    } else {
      throw new TypeError("Parameter request must be of type Request or URL");
    }
  }

  matchAll(request: Request): Promise<Response[] | undefined> {
    throw new Error("Not implemented.");
  }

  put(request: Request, response: Response): Promise<void> {
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

  readonly #findLoader = async (
    request: Request,
    mount: KhepriMountConfig,
    signal: AbortSignal,
  ): Promise<[KhepriLoadPlugin<string[]>, File] | undefined> => {
    const extension = extname(request.url);
    const possibleLoaders = this.#plugins
      .filter((x): x is KhepriLoadPlugin<string[]> => "load" in x)
      .filter((x) => x.resolve.output.includes(extension));
    for (const loader of possibleLoaders) {
      const source = await this.#getSourceFile(request, mount, loader, signal);
      if (source) {
        return [loader, source];
      }
    }
  };

  readonly #getMount = (request: Request): KhepriMountConfig | undefined => {
    const { pathname } = new URL(request.url);
    return this.#config.mount.find((x) => pathname.startsWith(x.url));
  };

  readonly #getSourceFile = async (
    request: Request,
    mount: KhepriMountConfig,
    plugin: KhepriLoadPlugin<string[]>,
    signal: AbortSignal,
  ): Promise<File | null> => {
    const { pathname } = new URL(request.url);
    const parts = pathname.replace(mount.url, "").split("/");
    try {
      let dir: FileSystemDirectoryHandle = mount.root;
      for (const dirName of parts.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(dirName);
      }
      const baseName = parts.slice(-1)[0].replace(
        extname(parts.slice(-1)[0]),
        "",
      );
      for (const possibleExt of plugin.resolve.input) {
        try {
          const fileHandle = await dir.getFileHandle(
            `${baseName}${possibleExt}`,
          );
          const file = await fileHandle.getFile();
          return file;
        } catch {}
      }
      return null;
    } catch (err) {
      // TODO: Check for specific error types. Target the file not found
      return null;
    }
  };

  readonly #getStaticFile = async (
    request: Request,
    mount: KhepriMountConfig,
    signal: AbortSignal,
  ): Promise<File | null> => {
    const { pathname } = new URL(request.url);
    const parts = pathname.replace(mount.url, "").split("/");
    try {
      let dir: FileSystemDirectoryHandle = mount.root;
      for (const dirName of parts.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(dirName);
      }
      const fileHandle = await dir.getFileHandle(parts.slice(-1)[0]);
      const file = await fileHandle.getFile();
      return file;
    } catch (err) {
      // TODO: Check for specific error types. Target the file not found
      return null;
    }
  };

  async load(request: Request): Promise<Response> {
    this.#logger.debug(`[KHEPRI] ${request.method} ${request.url} load`);
    const cacheHit = await this.#cache.match(request);
    if (cacheHit) {
      this.#logger.debug(`[KHEPRI] ${request.method} ${request.url} cache hit`);
      return cacheHit.clone();
    }

    const mount = this.#getMount(request);
    if (!mount) {
      return new Response(null, { status: 404 });
    } else if (mount.static) {
      const file = await this.#getStaticFile(
        request,
        mount,
        this.#controller.signal,
      );
      return file
        ? new Response(file.stream(), { status: 200 })
        : new Response(null, { status: 404 });
    } else {
      const pair = await this.#findLoader(
        request,
        mount,
        this.#controller.signal,
      );
      if (pair) {
        const [loader, file] = pair;
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
          const blob = results[extname(request.url)];
          const response = new Response(blob.stream(), {
            headers: {
              "Content-Type": blob.type,
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
          `[KHEPRI] ${request.method} ${request.url} did not match a compatible loader plugin or source file`,
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
  shutdown(): Promise<void> {
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
  static start(
    config: KhepriConfig,
  ): Promise<KhepriDevServer> {
    const devServer = new KhepriDevServer(config);
    devServer.#run();
    return Promise.resolve(devServer);
  }
}
