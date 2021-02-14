// TODO: Many of these types are direct copies of Snowpack types. Maybe Khepri can be Snowpack compatible?

const logger = console;

/**
 * Starts the Khepri dev server with the specified config
 *
 * @param config
 */
export async function startServer(
  config: KhepriConfig,
): Promise<KhepriDevServer> {
  logger.debug(`[KHEPRI] dev server starting...`);

  const plugins = config.plugins.map((x) => x(config, {}));

  for (const runPlugin of plugins) {
    if (runPlugin.run) {
      const runOptions: PluginRunOptions = { isDev: true };
      logger.debug(
        `[KHEPRI] plugin ${runPlugin.name} run starting...`,
        runOptions,
      );
      runPlugin
        .run(runOptions)
        .then(() => {
          logger.debug(`[KHEPRI] plugin ${runPlugin.name} run completed`);
        })
        .catch((err) => {
          logger.error(`[KHEPRI] plugin ${runPlugin.name} run: ${err}`, err);
        });
    }
  }

  function findLoadPlugin(file: File): [KhepriPlugin, string] | null {
    for (const plugin of plugins) {
      if (plugin.resolve) {
        for (const input of plugin.resolve.input) {
          if (file.name.endsWith(input)) {
            return [plugin, input];
          }
        }
      }
    }
    return null;
  }

  async function copyStaticFile(file: File): Promise<void> {
    const startTime = performance.now();
    logger.debug(`[KHEPRI] caching static file ${file.name}...`);
    const content = await file.arrayBuffer();
    await config.cache.put(
      new Request(file.name),
      new Response(content, {
        status: 200,
      }),
    );
    const duration = performance.now() - startTime;
    logger.debug(
      `[KHEPRI] caching static file ${file.name} complete | ${duration}ms`,
    );
  }

  async function handleLoad(file: File): Promise<void> {
    const pair = findLoadPlugin(file);
    if (pair) {
      const [plugin, extension] = pair;
      if (plugin.load) {
        const result = await plugin.load({
          file,
          isDev: true,
          isHmrEnabled: false,
          isSSR: false,
        });
        if (typeof result === "string") {
          // TODO: What is this file name? Same as input?
          const outputFileName = file.name;
          const startTime = performance.now();
          logger.debug(`[KHEPRI] caching output file ${outputFileName}...`);
          await config.cache.put(
            new Request(outputFileName),
            new Response(new Blob([result]), {
              status: 200,
            }),
          );
          const duration = performance.now() - startTime;
          logger.debug(
            `[KHEPRI] caching output file ${outputFileName} complete | ${duration}ms`,
          );
        } else if (result) {
          for (const [name, { code, map }] of Object.entries(result)) {
            // TODO: Handle map file
            const outputFileName = file.name; //.replace(extension, name);
            const startTime = performance.now();
            logger.debug(`[KHEPRI] caching output file ${outputFileName}...`);
            await config.cache.put(
              new Request(outputFileName),
              new Response(code, {
                status: 200,
              }),
            );
            const duration = performance.now() - startTime;
            logger.debug(
              `[KHEPRI] caching output file ${outputFileName} complete | ${duration}ms`,
            );
          }
        } else {
          await copyStaticFile(file);
        }
      } else {
        await copyStaticFile(file);
      }
    } else {
      await copyStaticFile(file);
    }
  }

  async function handleTransform(file: File): Promise<void> {
    for (const plugin of plugins) {
      // TODO
      // plugin.transform?.({
      // })
    }
  }

  // config.fs.addEventListener("update", async (e) => {
  //   for (const file of e.files) {
  //     switch (file.action) {
  //       case "remove":
  //         // TODO
  //         return;
  //       case "write":
  //         const f = await e.fs.read(file.path);
  //         if (f) {
  //           await handleLoad(f);
  //         }
  //         return;
  //     }
  //   }
  // });

  async function buildDirectory(
    directory: FileSystemDirectoryHandle,
  ): Promise<void> {
    for await (const entry of directory.values()) {
      switch (entry.kind) {
        case "directory": {
          await buildDirectory(entry);
          break;
        }
        case "file": {
          const file = await entry.getFile();
          await handleLoad(file);
          break;
        }
      }
    }
  }
  await buildDirectory(config.fs);

  logger.debug(`[KHEPRI] dev server ready`);

  return {
    async shutdown() {
      logger.debug(`[KHEPRI] dev server shutdown...`);
      for (const plugin of plugins) {
        if (plugin.cleanup) {
          logger.log(`[KHEPRI] plugin ${plugin.name} stopping...`);
          await plugin.cleanup();
          logger.log(`[KHEPRI] plugin ${plugin.name} stopped...`);
        }
      }
      logger.debug(`[KHEPRI] dev server shutdown complete`);
    },
  };
}

export interface KhepriConfig {
  cache: Cache;
  fs: FileSystemDirectoryHandle;
  plugins: KhepriPluginFactory[];
}

export interface KhepriDevServer {
  shutdown(): Promise<void>;
}

export interface KhepriPlugin {
  /** name of the plugin */
  name: string;
  /** Tell Khepri how the load() function will resolve files. */
  resolve?: {
    /**
     * file extensions that this load function takes as input
     * (e.g. [".jsx", ".js", …])
     */
    input: string[];
    /**
     * file extensions that this load function outputs (e.g. [".js", ".css"])
     */
    output: string[];
  };
  /** load a file that matches resolve.input */
  load?(
    options: PluginLoadOptions,
  ): Promise<PluginLoadResult | string | null | undefined | void>;
  /** transform a file that matches resolve.input */
  transform?(
    options: PluginTransformOptions,
  ): Promise<PluginTransformResult | string | null | undefined | void>;
  /** runs a command, unrelated to file building (e.g. TypeScript, ESLint) */
  run?(options: PluginRunOptions): Promise<unknown>;
  /** optimize the entire built application */
  // No optimize support yet
  // optimize?(options: PluginOptimizeOptions): Promise<void>;
  /** cleanup any long-running instances/services before exiting.  */
  cleanup?(): void | Promise<void>;
  /** Known dependencies that should be installed */
  knownEntrypoints?: string[];
  /** read and modify the Khepri config object */
  config?(khepriConfig: KhepriConfig): void;
  /** Called when a watched file changes during development. */
  onChange?({ filePath }: { filePath: string }): void;
  /** (internal interface, not set by the user) Mark a file as changed. */
  markChanged?(file: string): void;
}

export type KhepriBuildMap = Record<string, KhepriBuiltFile>;

export interface KhepriBuiltFile {
  code: Blob;
  map?: Blob;
}

export type KhepriPluginFactory<PluginOptions = object> = (
  khepriConfig: KhepriConfig,
  pluginOptions?: PluginOptions,
) => KhepriPlugin;

export interface PluginLoadOptions {
  /** File object. */
  file: File;
  /** True if builder is in dev mode */
  isDev: boolean;
  /** True if builder is in SSR mode */
  isSSR: boolean;
  /** True if HMR is enabled (add any HMR code to the output here). */
  isHmrEnabled: boolean;
}

/** map of extensions -> code (e.g. { ".js": "[code]", ".css": "[code]" }) */
export type PluginLoadResult = KhepriBuildMap;

export interface PluginRunOptions {
  isDev: boolean;
}

export interface PluginTransformOptions {
  /** The absolute file path of the source file, on disk. */
  id: string;
  /** The extension of the file */
  fileExt: string;
  /** Contents of the file to transform */
  contents: string | Buffer;
  /** True if builder is in dev mode */
  isDev: boolean;
  /** True if HMR is enabled (add any HMR code to the output here). */
  isHmrEnabled: boolean;
  /** True if builder is in SSR mode */
  isSSR: boolean;
}

export interface PluginTransformResult {
  contents: string;
  map: string | RawSourceMap;
}

export interface RawSourceMap {
  version: number;
  sources: string[];
  names: string[];
  sourceRoot?: string;
  sourcesContent?: string[];
  mappings: string;
  file: string;
}
