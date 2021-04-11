import {
  initialize,
  Loader,
  transform,
  TransformResult,
  version,
} from "esbuild-wasm";
import {
  KhepriConfig,
  KhepriLoadPlugin,
  KhepriPlugin,
  KhepriPluginResolve,
  PluginLoadOptions,
} from "../scarab/types.ts";

const msFormatter = new globalThis.Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
});

let init: Promise<void>;

class EsbuildPlugin implements KhepriLoadPlugin<[".js"]> {
  readonly #config: KhepriConfig;

  public constructor(config: KhepriConfig) {
    this.#config = config;
  }

  public get name() {
    return "@khepri/plugin-esbuild";
  }

  public get resolve(): KhepriPluginResolve<[".js"]> {
    return {
      input: [".js", ".jsx", ".ts", ".tsx"],
      output: [".js"],
    };
  }

  public async load(
    { file }: PluginLoadOptions,
    signal: AbortSignal,
  ): Promise<Record<".js", Blob>> {
    await init;
    this.#config.logger.debug(`[KHEPRI:ESBUILD] compiling ${file.name}`);
    const start = performance.now();
    const input = await file.text();
    throwIfAborterd(signal);
    const result: TransformResult = await transform(input, {
      loader: getLoader(file),
    });
    throwIfAborterd(signal);
    const duration = performance.now() - start;
    this.#config.logger.debug(
      `[KHEPRI:ESBUILD] compiled ${file.name} in ${
        msFormatter.format(duration)
      }`,
    );
    for (const warning of result.warnings) {
      this.#config.logger.warn(`[KHEPRI:ESBUILD] ${warning.text}`, warning);
    }
    return {
      ".js": new Blob([result.code], { type: getContentType(file) }),
    };
  }
}

export function getPlugin(config: KhepriConfig): EsbuildPlugin {
  // TODO: Move this into a worker. esbuild-wasm's worker has issues in Deno
  config.logger.debug(`[KHEPRI:ESBUILD] initializing esbuild v${version}`);
  init = init ?? initialize({
    wasmURL: `https://unpkg.com/esbuild-wasm@${version}/esbuild.wasm`,
    worker: false,
  });
  init.catch((err: unknown) => {
    config.logger.error(err);
  });
  return new EsbuildPlugin(config);
}

function getContentType(file: File): string {
  const extension = file.name.substring(file.name.lastIndexOf("."));
  switch (extension) {
    case ".js":
    case ".jsx":
    case ".ts":
    case ".tsx":
      return "text/javascript";
    case ".json":
      return "application/json";
    default:
      return "text";
  }
}

function getLoader(file: File): Loader {
  const extension = file.name.substring(file.name.lastIndexOf("."));
  switch (extension) {
    case ".js":
    case ".jsx":
      return "jsx";
    case ".json":
      return "json";
    case ".ts":
      return "ts";
    case ".tsx":
      return "tsx";
    default:
      return "text";
  }
}

function throwIfAborterd(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}
