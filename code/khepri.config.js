import { getHandle } from "../deno/file_system_access_api.ts";
import { getPlugin as esbuild } from "../plugins/esbuild.ts";

const fileSystem = await getHandle(Deno.cwd());
if (fileSystem.kind !== "directory") {
  throw new Error("... what have you done...");
}

export default {
  fileSystem,
  plugins: [esbuild],
  logger: console,
};
