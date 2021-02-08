import React, { useEffect, useRef, useState } from "react";
import type { CompilerFileUpdate } from "../api/compiler";
import type { FileSystemUpdateEvent } from "../api/fs";
import { useFileSystem } from "../providers/FileSystemProvider";

const compilerWorker = new Worker(
  new URL("../api/compiler.js", import.meta.url),
  {
    name: "compiler",
    type: "module",
  },
);

export function Preview(): JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const fs = useFileSystem();
  useEffect(() => {
    async function handleUpdate(e: FileSystemUpdateEvent): Promise<void> {
      setIsLoading(true);
      const message = e.files.map<Promise<CompilerFileUpdate>>(async (f) => {
        switch (f.action) {
          case "remove":
            return { action: "remove", path: f.path };
          case "write":
            return {
              action: "write",
              content: await e.fs.read(f.path).then((x) => x?.text() ?? ""),
              path: f.path,
            };
        }
      });
      compilerWorker.postMessage(await Promise.all(message));
    }
    fs.addEventListener("update", handleUpdate);
    return () => fs.removeEventListener("update", handleUpdate);
  }, [fs]);

  useEffect(() => {
    function handleMessage() {
      setIsLoading(false);
    }
    compilerWorker.addEventListener("message", handleMessage);
    return () => compilerWorker.removeEventListener("message", handleMessage);
  }, []);

  // TODO: Handle projects that don't use index.html as default
  return (
    <iframe
      src={isLoading ? "about:blank" : "/dist/~/index.html"}
      ref={previewRef}
    />
  );
}
