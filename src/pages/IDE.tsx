import MonacoEditor from "@monaco-editor/react";
import type { Position } from "monaco-editor";
import React, { useEffect, useState } from "react";
import { getFileParts, getLanguage } from "../api/fs";
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

export function IDE(): JSX.Element {
  const [activeFile, setActiveFile] = useState<string>("~/index.html");
  const [value, setValue] = useState<string | null>(null);
  const fs = useFileSystem();

  // Populate a few example files on the first run
  useEffect(() => {
    async function initial(signal: AbortSignal) {
      const files = await fs.ls();
      if (files.length === 0) {
        const initialValue = `<!DOCTYPE html>
<html>
  <head>
    <link href="./index.css" rel="stylesheet" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="./index.tsx" type="module"></script>
  </body>
</html>
`;
        fs.write(
          "~/index.html",
          new File([initialValue], "~/index.html", { type: "text/plain" }),
        );
        fs.write(
          "~/index.tsx",
          new File(
            [
              `import React from "https://cdn.skypack.dev/react";
import ReactDOM from "https://cdn.skypack.dev/react-dom";

function App(): JSX.Element {
  return <h1>Hello, World!</h1>;
}

ReactDOM.render(<App />, document.getElementById("root"));
`,
            ],
            "~/index.tsx",
            { type: "text/plain" },
          ),
        );
        fs.write(
          "~/index.css",
          new File(
            [
              `body {
  text-decoration: underline;
}
`,
            ],
            "~/index.css",
            { type: "text/plain" },
          ),
        );
        if (!signal.aborted) {
          setActiveFile("~/index.html");
          setValue(initialValue);
        }
      }
    }
    const controller = new AbortController();
    initial(controller.signal);
    return () => controller.abort();
  }, [fs]);

  useEffect(() => {
    async function loadFile(path: string, signal: AbortSignal) {
      const file = await fs.read(path);
      const content = file ? await file.text() : "";
      if (!signal.aborted) {
        setValue(content);
      }
    }
    const controller = new AbortController();
    loadFile(activeFile, controller.signal);
    return () => controller.abort();
  }, [fs, activeFile]);

  async function handleValueChange(
    value: string | undefined = "",
  ): Promise<void> {
    setValue(value);
    // TODO: Debounce this
    const { name } = getFileParts(activeFile) ?? { name: activeFile };
    await fs.write(activeFile, new File([value], name, { type: "text/plain" }));
  }

  const [cursor, setCursor] = useState<Pick<Position, "column" | "lineNumber">>(
    { column: 0, lineNumber: 0 },
  );

  return (
    <main className={styles.root}>
      <Sidebar>
        <FileSystemTree onOpen={(v) => setActiveFile(v)} />
      </Sidebar>
      {typeof value === "string" ? (
        <MonacoEditor
          onChange={(v) => handleValueChange(v)}
          language={getLanguage(activeFile)}
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
          path={activeFile}
          theme="vs-dark"
          value={value}
        />
      ) : (
        <div />
      )}
      <Preview />
      <StatusBar className={styles.statusBar}>
        <StatusBarSpacer />
        <StatusBarItem>
          Ln {cursor.lineNumber}, Col {cursor.column}
        </StatusBarItem>
      </StatusBar>
    </main>
  );
}
