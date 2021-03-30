import { extname } from "https://deno.land/std@0.91.0/path/mod.ts";
import type { KhepriConfig, KhepriPlugin, PluginLoadOptions } from "./types.ts";
import { runPlugin } from "./utils.ts";

const msFormatter = new globalThis.Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
});

export const DEFAULT_BUILD_DIRECTORY = "build";

export interface BuildOptions {
  readonly config: KhepriConfig;
  readonly isDev?: boolean;
  readonly out: FileSystemDirectoryHandle;
}

export async function build(
  { config, isDev = false, out }: BuildOptions,
  signal: AbortSignal = new AbortController().signal,
): Promise<void> {
  const { logger, mount } = config;
  const start = performance.now();
  logger.info(`[KHEPRI] starting build`);

  const plugins = config.plugins.map((plugin) => plugin(config));
  await Promise.all(
    plugins.map((plugin) => runPlugin(plugin, { isDev }, logger, signal)),
  );

  logger.info(`[KHEPRI] cleaning ${out.name}...`);
  await cleanDirectory(out);
  logger.info(`[KHEPRI] clean complete`);

  for (const m of mount) {
    if (m.static) {
      await copyStaticDirectory(m.root, out);
    } else {
      const parts = m.url.split("/").filter(Boolean);
      let mountOut = out;
      for (const part of parts) {
        mountOut = await mountOut.getDirectoryHandle(part, { create: true });
      }
      await buildDirectory(m.root, mountOut, plugins, {
        isDev,
        isHmrEnabled: false,
        isSSR: false,
      }, signal);
    }
  }

  const duration = performance.now() - start;
  logger.info(`[KHEPRI] build complete in ${msFormatter.format(duration)}`);
}

async function buildDirectory(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle,
  plugins: readonly KhepriPlugin[],
  options: Omit<PluginLoadOptions, "file">,
  signal: AbortSignal,
): Promise<void> {
  for await (const entry of source.values()) {
    switch (entry.kind) {
      case "directory": {
        const newDirectory = await destination.getDirectoryHandle(entry.name, {
          create: true,
        });
        await buildDirectory(entry, newDirectory, plugins, options, signal);
        break;
      }
      case "file":
        await buildFile(entry, destination, plugins, options, signal);
        break;
    }
  }
}

async function buildFile(
  source: FileSystemFileHandle,
  destination: FileSystemDirectoryHandle,
  plugins: readonly KhepriPlugin[],
  options: Omit<PluginLoadOptions, "file">,
  signal: AbortSignal,
): Promise<void> {
  const extension = extname(source.name);
  const plugin = plugins.find((x) =>
    typeof x.load === "function" && x.resolve?.input.includes(extension)
  );
  if (plugin) {
    const sourceFile = await source.getFile();
    let outFile = await plugin.load!({ ...options, file: sourceFile }, signal);
    for (
      const transform of plugins.filter((x) =>
        typeof x.transform === "function" &&
        x.resolve?.input.includes(extname(outFile.name))
      )
    ) {
      outFile = await transform.transform!({
        file: outFile,
        isDev: options.isDev,
      }, signal);
    }
    const newFile = await destination.getFileHandle(source.name, {
      create: true,
    });
    const writer = await newFile.createWritable({
      keepExistingData: false,
    });
    await outFile.stream().pipeTo(writer);
  }
}

async function cleanDirectory(dir: FileSystemDirectoryHandle): Promise<void> {
  for await (const key of dir.keys()) {
    await dir.removeEntry(key, { recursive: true });
  }
}

async function copyStaticDirectory(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const entry of source.values()) {
    switch (entry.kind) {
      case "directory": {
        const newDirectory = await destination.getDirectoryHandle(entry.name, {
          create: true,
        });
        await copyStaticDirectory(entry, newDirectory);
        break;
      }
      case "file":
        await copyStaticFile(entry, destination);
        break;
    }
  }
}

async function copyStaticFile(
  source: FileSystemFileHandle,
  destination: FileSystemDirectoryHandle,
): Promise<void> {
  const sourceFile = await source.getFile();
  const newFile = await destination.getFileHandle(source.name, {
    create: true,
  });
  const writer = await newFile.createWritable({
    keepExistingData: false,
  });
  await sourceFile.stream().pipeTo(writer);
}
