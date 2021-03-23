import { getHandle } from "../deno/file_system_access_api.ts";
import { getPlugin as esbuild } from "../plugins/esbuild.ts";

const root = await getHandle(Deno.cwd());
if (root.kind !== "directory") {
  throw new Error("... what have you done...");
}

export default {
  logger: console,
  mount: [
    {
      root: await root.getDirectoryHandle("src"),
      static: false,
      url: "/src",
    },
    {
      root: await root.getDirectoryHandle("public"),
      static: true,
      url: "/",
    },
  ],
  plugins: [esbuild],
  root,
};
