import MonacoEditor from "@monaco-editor/react";
import type { Position } from "monaco-editor";
import React, { PropsWithChildren, useEffect, useState } from "react";
import { getLanguage } from "../api/fs";
import { FileSystemTree } from "../components/FileSystemTree";
import { Preview } from "../components/Preview";
import { Sidebar } from "../components/Sidebar";
import {
  StatusBar,
  StatusBarItem,
  StatusBarSpacer,
} from "../components/StatusBar";
import { useFileSystem } from "../providers/FileSystemProvider";
import styles from "./IDE.module.css";

/**
 * Blocks rendering of children until dev server is started.
 */
function DevServer({ children }: PropsWithChildren<{}>): JSX.Element | null {
  const [isLoading, setIsLoading] = useState(true);

  const fs = useFileSystem();
  useEffect(() => {
    const controller = new AbortController();
    async function go(signal: AbortSignal): Promise<void> {
      const cache = await caches.open("khepri");
      const { startServer } = await import("../api/engine");
      const esbuild = await import("../api/plugins/esbuild");
      const devServer = await startServer({
        cache,
        fs,
        plugins: [esbuild.getPlugin],
      });
      signal.addEventListener("abort", () => {
        devServer.shutdown();
      });
      setIsLoading(false);
    }
    go(controller.signal);
    return () => controller.abort();
  }, [fs]);

  if (isLoading) {
    return null;
  } else {
    return <>{children}</>;
  }
}

async function save(
  file: FileSystemFileHandle,
  content: string,
  signal: AbortSignal,
): Promise<void> {
  const writer = await file.createWritable({ keepExistingData: false });
  signal.addEventListener("abort", () => {
    writer.abort();
  });
  await writer.write(content);
  await writer.close();
}

export default function IDE(): JSX.Element {
  const [activeFile, setActiveFile] = useState<FileSystemFileHandle | null>(
    null,
  );
  const [value, setValue] = useState<string | null>(null);
  const fs = useFileSystem();

  useEffect(() => {
    async function loadFile(handle: FileSystemFileHandle, signal: AbortSignal) {
      const file = await handle.getFile();
      const content = file ? await file.text() : "";
      if (!signal.aborted) {
        setValue(content);
      }
    }
    const controller = new AbortController();
    if (activeFile) {
      loadFile(activeFile, controller.signal);
    } else {
      setValue(null);
    }
    return () => controller.abort();
  }, [fs, activeFile]);

  useEffect(() => {
    const controller = new AbortController();
    if (activeFile) {
      const timeout = setTimeout(() => {
        save(activeFile, value ?? "", controller.signal);
      }, 1000);
      controller.signal.addEventListener("abort", () => {
        clearTimeout(timeout);
      });
    }
    return () => controller.abort();
  }, [activeFile, value]);

  const [cursor, setCursor] = useState<Pick<Position, "column" | "lineNumber">>(
    { column: 0, lineNumber: 0 },
  );

  return (
    <main className={styles.root}>
      <Sidebar>
        <FileSystemTree onOpen={(v) => setActiveFile(v)} />
      </Sidebar>
      {activeFile && typeof value === "string" ? (
        <MonacoEditor
          onChange={(v = "") => setValue(v)}
          language={getLanguage(activeFile.name)}
          beforeMount={(monaco) => {
            monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
              jsx: monaco.languages.typescript.JsxEmit.Preserve,
            });
            monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
              jsx: monaco.languages.typescript.JsxEmit.Preserve,
            });
          }}
          onMount={(editor) => {
            editor.onDidChangeCursorPosition((e) => {
              const { column, lineNumber } = e.position;
              setCursor({ column, lineNumber });
            });
          }}
          keepCurrentModel
          // TODO: Reconstruct path from root
          path={activeFile.name}
          theme="vs-dark"
          value={value}
        />
      ) : (
        <div />
      )}
      <DevServer>
        <Preview />
      </DevServer>
      <StatusBar className={styles.statusBar}>
        <StatusBarSpacer />
        <StatusBarItem>
          Ln {cursor.lineNumber}, Col {cursor.column}
        </StatusBarItem>
      </StatusBar>
    </main>
  );
}
