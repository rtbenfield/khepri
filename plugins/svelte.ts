import { compile, VERSION } from "https://cdn.skypack.dev/svelte/compiler";
import {
  KhepriConfig,
  KhepriPlugin,
  PluginLoadOptions,
} from "../scarab/types.ts";

class SveltePlugin implements KhepriPlugin {
  #config: KhepriConfig;

  public get resolve() {
    return {
      input: [".svelte"],
      output: [".js", ".css"],
    };
  }

  constructor(config: KhepriConfig) {
    this.#config = config;
  }

  readonly #fetchFile = async (
    request: Request,
    signal: AbortSignal,
  ): Promise<FileSystemFileHandle | null> => {
    const mount = this.#config.mount.find((x) => request.url.startsWith(x.url));
    if (!mount) {
      return null;
    }
    const parts = request.url.replace(mount.url, "").split("/").filter(Boolean);
    try {
      let dir = mount.root;
      for (const part of parts.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(part, { create: false });
        throwIfAborterd(signal);
      }
      const fileName = parts.slice(-1)[0];
      const baseName = fileName.replace(/\.css$/, "").replace(/\.js$/, "");
      return await dir.getFileHandle(`${baseName}.svelte`, { create: false });
    } catch {
      return null;
    }
  };

  public get name() {
    return "@khepri/svelte";
  }

  public async load({
    file,
    isDev,
  }: PluginLoadOptions, signal: AbortSignal): Promise<File> {
    const source = await file.text();
    throwIfAborterd(signal);
    const { ast, css, js, stats, vars, warnings } = compile(source, {
      css: true,
      dev: isDev,
      filename: file.name,
      preserveComments: isDev,
      preserveWhitespace: isDev,
    });
    const baseName = file.name.replace(/\.svelte$/, "");
    for (const warning of warnings) {
      this.#config.logger.warn(warning);
    }
    this.#config.logger.debug(`[KHEPRI:SVELTE] ${file.name} stats`, stats);
    return new File([js.code], `${baseName}.js`, { type: "text/javascript" });
    // return new File([css.code], `${baseName}.css`, { type: "text/css" });
    // return [
    //   new File([css.code], `${baseName}.css`),
    //   new File([js.code], `${baseName}.js`),
    // ];
  }

  public async handles(
    request: Request,
    signal: AbortSignal,
  ): Promise<File | null> {
    if (request.url.endsWith(".js") || request.url.endsWith(".css")) {
      const fileHandle = await this.#fetchFile(request, signal);
      return fileHandle ? await fileHandle.getFile() : null;
    } else {
      return null;
    }
  }

  public resolves(file: File, signal: AbortSignal): Promise<boolean> {
    return Promise.resolve(file.name.endsWith(".svelte"));
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
