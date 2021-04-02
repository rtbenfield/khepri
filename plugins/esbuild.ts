import {
  initialize,
  Loader,
  transform,
  TransformResult,
  version,
} from "esbuild-wasm";
import { KhepriConfig, KhepriPlugin } from "../scarab/types.ts";

const msFormatter = new globalThis.Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
});

let init: Promise<void>;

export function getPlugin({ logger }: KhepriConfig): KhepriPlugin {
  // TODO: Move this into a worker. esbuild-wasm's worker has issues in Deno
  logger.debug(`[KHEPRI:ESBUILD] initializing esbuild v${version}`);
  init = init ?? initialize({
    wasmURL: `https://unpkg.com/esbuild-wasm@${version}/esbuild.wasm`,
    worker: false,
  });
  init.catch((err: unknown) => {
    logger.error(err);
  });
  return {
    name: "@khepri/plugin-esbuild",
    resolve: {
      input: [".js", ".jsx", ".ts", ".tsx"],
      output: [".js"],
    },
    async load({ file }, signal) {
      await init;
      logger.debug(`[KHEPRI:ESBUILD] compiling ${file.name}`);
      const start = performance.now();
      const input = await file.text();
      throwIfAborterd(signal);
      const result: TransformResult = await transform(input, {
        loader: getLoader(file),
      });
      throwIfAborterd(signal);
      const duration = performance.now() - start;
      logger.debug(
        `[KHEPRI:ESBUILD] compiled ${file.name} in ${
          msFormatter.format(duration)
        }`,
      );
      for (const warning of result.warnings) {
        logger.warn(`[KHEPRI:ESBUILD] ${warning.text}`, warning);
      }
      return new File([result.code], file.name, {
        type: getContentType(file),
      });
    },
  };
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
