/// <reference lib="webworker" />
import { startService, TransformOptions } from "esbuild-wasm";

const esbuild = startService({
  wasmURL: new URL("/esbuild.wasm", import.meta.url).toString(),
});
const cacheFileSystem = caches.open("filesystem");

export type CompilerFileUpdate =
  | { action: "remove"; path: string }
  | { action: "write"; content: string; path: string };

self.addEventListener("message", async (e) => {
  const files = e.data as readonly CompilerFileUpdate[];
  const cache = await cacheFileSystem;
  files.map<Promise<void>>(async (file) => {
    // TODO: Figure out better path resolution instead of /dist/
    const path = `/dist/${file.path}`;
    switch (file.action) {
      case "remove":
        await cache.delete(new Request(path));
        break;
      case "write": {
        console.debug(`Compiling ${file.path}`);
        const compiled = await getCompiledFile(file.path, file.content);
        const cache = await cacheFileSystem;
        await cache.put(
          new Request(path),
          new Response(compiled, { status: 200 }),
        );
        console.debug(`Compiling ${file.path} complete`);
        break;
      }
    }
  });
  self.postMessage("complete");
});

async function getCompiledFile(file: string, content: string): Promise<Blob> {
  const compiler = await esbuild;
  if (file.endsWith(".js")) {
    const options: TransformOptions = { loader: "js" };
    console.debug(`Compiling ${file} with esbuild`, options);
    const { code } = await compiler.transform(content, options);
    return new Blob([code], { type: "application/javascript" });
  } else if (file.endsWith(".jsx")) {
    const options: TransformOptions = { loader: "jsx" };
    console.debug(`Compiling ${file} with esbuild`, options);
    const { code } = await compiler.transform(content, options);
    return new Blob([code], { type: "application/javascript" });
  } else if (file.endsWith(".ts")) {
    const options: TransformOptions = { loader: "ts" };
    console.debug(`Compiling ${file} with esbuild`, options);
    const { code } = await compiler.transform(content, options);
    return new Blob([code], { type: "application/javascript" });
  } else if (file.endsWith(".tsx")) {
    const options: TransformOptions = { loader: "tsx" };
    console.debug(`Compiling ${file} with esbuild`, options);
    const { code } = await compiler.transform(content, options);
    return new Blob([code], { type: "application/javascript" });
  } else if (file.endsWith(".html")) {
    return new Blob([content], { type: "text/html" });
  } else {
    return new Blob([content]);
  }
}
