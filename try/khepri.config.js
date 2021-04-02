import { join } from "https://deno.land/std@0.91.0/path/mod.ts";
import { getHandle } from "../deno/file_system_access_api.ts";
import { getPlugin as esbuild } from "../plugins/esbuild.ts";

const root = await getHandle(Deno.cwd(), "directory");

export default {
  logger: console,
  mount: [
    {
      root: await getHandle(join(Deno.cwd(), "..", "plugins")),
      static: false,
      url: "/@khepri/plugins",
    },
    {
      root: await getHandle(join(Deno.cwd(), "..", "scarab")),
      static: false,
      url: "/@khepri/scarab",
    },
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
