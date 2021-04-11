import { getHandle } from "../../deno/file_system_access_api.ts";
import { getPlugin as esbuild } from "../../plugins/esbuild.ts";
import { getPlugin as svelte } from "../../plugins/svelte.ts";

const root = await getHandle(Deno.cwd(), "directory");

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
  plugins: [esbuild, svelte],
  root,
};
