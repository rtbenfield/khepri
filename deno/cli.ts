// deno-lint-ignore-file no-fallthrough
import { exists } from "https://deno.land/std@0.91.0/fs/mod.ts";
import { join, toFileUrl } from "https://deno.land/std@0.91.0/path/mod.ts";
import {
  args,
  flags,
  symbols,
  values,
} from "https://deno.land/x/args@2.0.8/index.ts";
import { getHandle } from "./file_system_access_api.ts";
import { KhepriConfig } from "../scarab/types.ts";
import { startDevServer } from "./server.ts";

const parser = args
  .sub("help", args.describe("Show help"))
  .sub(
    "dev",
    args.describe("Start dev server")
      .with(flags.PartialOption("config", {
        default: undefined,
        type: values.Text,
      })),
  );

const res = parser.parse(Deno.args);

switch (res.tag) {
  case symbols.PARSE_FAILURE:
    console.error(res.error.toString());
    Deno.exit(1);
  case symbols.MAIN_COMMAND: {
    const remaining = res.remaining().rawValues();
    if (remaining.length) {
      console.error(`Invalid subcommand: ${remaining[0]}`);
    } else {
      console.error("Missing subcommand");
    }
    console.log(parser.help());
    Deno.exit(1);
  }
  case "dev": {
    const config = await getConfig(res.value.value.config);
    // TODO: Handle hostname and port from config file
    await startDevServer({
      config,
      hostname: "0.0.0.0",
      port: 8080,
    });
    Deno.exit(0);
  }
  case "help":
    console.log(parser.help());
    Deno.exit(0);
}

async function getConfig(path?: string): Promise<KhepriConfig> {
  const defaultConfigPath = join(Deno.cwd(), "khepri.config.js");
  if (path) {
    const fullPath = join(Deno.cwd(), path);
    if (!await exists(fullPath)) {
      throw new Error(`No config file found at ${path}`);
    }
    const importPath = toFileUrl(fullPath).toString();
    return import(importPath).then((x) => x.default);
  } else if (await exists(defaultConfigPath)) {
    const importPath = toFileUrl(defaultConfigPath).toString();
    return import(importPath).then((x) => x.default);
  } else {
    // Use the default config
    const fileSystem = await getHandle(Deno.cwd());
    if (fileSystem.kind !== "directory") {
      throw new Error("... what have you done...");
    }
    const { getPlugin: esbuild } = await import("../plugins/esbuild.ts");
    return {
      fileSystem,
      plugins: [esbuild],
      logger: console,
    };
  }
}
