import { KhepriPlugin, PluginRunOptions } from "./types.ts";

export function extname(value: string): string {
  const filename = value.substring(value.lastIndexOf("/"));
  return filename.substring(filename.indexOf("."));
}

export async function runPlugin(
  plugin: KhepriPlugin,
  options: PluginRunOptions,
  logger: Console,
  signal: AbortSignal,
): Promise<void> {
  if (!("run" in plugin)) {
    return;
  }

  logger.debug(
    `[KHEPRI] plugin ${plugin.name} run starting...`,
    options,
  );
  try {
    await plugin.run(options, signal);
    logger.debug(
      `[KHEPRI] plugin ${plugin.name} run completed`,
    );
  } catch (err) {
    logger.error(
      `[KHEPRI] plugin ${plugin.name} run: ${err}`,
      err,
    );
  }
}
