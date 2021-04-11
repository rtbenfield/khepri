import { compile, VERSION } from "https://cdn.skypack.dev/svelte/compiler";
import {
  KhepriConfig,
  KhepriLoadPlugin,
  KhepriPlugin,
  KhepriPluginResolve,
  PluginLoadOptions,
} from "../scarab/types.ts";

class SveltePlugin implements KhepriLoadPlugin<[".js", ".css"]> {
  #config: KhepriConfig;

  public get resolve(): KhepriPluginResolve<[".js", ".css"]> {
    return {
      input: [".svelte"],
      output: [".js", ".css"],
    };
  }

  constructor(config: KhepriConfig) {
    this.#config = config;
  }

  public get name() {
    return "@khepri/svelte";
  }

  public async load(
    {
      file,
      isDev,
    }: PluginLoadOptions,
    signal: AbortSignal,
  ): Promise<Record<".js" | ".css", Blob>> {
    const source = await file.text();
    throwIfAborterd(signal);
    const { ast, css, js, stats, vars, warnings } = compile(source, {
      css: true,
      dev: isDev,
      filename: file.name,
      preserveComments: isDev,
      preserveWhitespace: isDev,
    });
    for (const warning of warnings) {
      this.#config.logger.warn(warning);
    }
    this.#config.logger.debug(`[KHEPRI:SVELTE] ${file.name} stats`, stats);
    return {
      ".css": new Blob([css.code], { type: "text/css" }),
      ".js": new Blob([js.code], { type: "text/javascript" }),
    };
  }
}

export function getPlugin(config: KhepriConfig): KhepriPlugin {
  return new SveltePlugin(config);
}

function throwIfAborterd(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
}
