import { KhepriPlugin, PluginRunOptions } from "./types.ts";

export async function runPlugin(
  plugin: KhepriPlugin,
  options: PluginRunOptions,
  logger: Console,
  signal: AbortSignal,
): Promise<void> {
  if (!plugin.run) {
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
