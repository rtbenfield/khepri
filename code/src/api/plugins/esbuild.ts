import { startService, TransformOptions } from "esbuild-wasm";
import type { KhepriPluginFactory } from "../engine";

const logger = console;

export const getPlugin: KhepriPluginFactory = () => {
  const esbuildPromise = startService({
    wasmURL: new URL("/esbuild.wasm", import.meta.url).toString(),
  });

  return {
    name: "esbuild",
    async cleanup() {
      const esbuild = await esbuildPromise;
      esbuild.stop();
    },
    async load({ file }) {
      const esbuild = await esbuildPromise;
      const startTime = performance.now();
      logger.debug(`[ESBUILD] ${file.name} compiling...`);
      const options = getTransformOptions(file);
      logger.debug(`[ESBUILD] ${file.name} options`, options);
      const input = await file.text();
      const { code, map, warnings } = await esbuild.transform(input, options);
      for (const warning of warnings) {
        logger.warn(`[ESBUILD] ${file.name}: ${warning.text}`, warning);
      }
      const duration = performance.now() - startTime;
      logger.debug(`[ESBUILD] ${file.name} compiled | ${duration}ms`);
      return {
        ".js": {
          code: new Blob([code], { type: "application/javascript" }),
          map: new Blob([map], { type: "application/json" }),
        },
      };
    },
    resolve: {
      input: [".js", ".json", ".jsx", ".ts", ".tsx"],
      output: [".js"],
    },
  };
};

function getTransformOptions(file: File): TransformOptions {
  if (file.name.endsWith(".js")) {
    return { loader: "js" };
  } else if (file.name.endsWith(".jsx")) {
    return { loader: "jsx" };
  } else if (file.name.endsWith(".ts")) {
    return { loader: "ts" };
  } else if (file.name.endsWith(".tsx")) {
    return { loader: "tsx" };
  } else {
    return {};
  }
}

export default getPlugin;
