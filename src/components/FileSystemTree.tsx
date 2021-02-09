import React, { useEffect, useState } from "react";
import { useFileSystem } from "../providers/FileSystemProvider";
import styles from "./FileSystemTree.module.css";
import { Pane, PaneHeader } from "./Sidebar";

export type MutableDeep<ObjectType> = {
  -readonly // For each `Key` in the keys of `ObjectType`, make a mapped type by removing the `readonly` modifier from the key.
  [KeyType in keyof ObjectType]: MutableDeep<ObjectType[KeyType]>;
};

interface FileSystemTreeProps {
  onOpen(file: string): void;
}

interface FileTreeItem {
  readonly children: readonly FileTreeItem[];
  readonly name: string;
  readonly path: string;
}

function buildTree(files: readonly string[]): FileTreeItem {
  const root: MutableDeep<FileTreeItem> = {
    children: [],
    name: "~",
    path: "~",
  };
  for (const file of files) {
    const parts = file.replace(/^~\//, "").split("/");
    parts.reduce((prev, part) => {
      let next = prev.children.find((x) => x.name === part);
      if (!next) {
        next = {
          children: [],
          name: part,
          path: `${prev.path}/${part}`,
        };
        prev.children.push(next);
      }
      return next;
    }, root);
  }
  return root;
}

export function FileSystemTree({
  onOpen,
}: FileSystemTreeProps): React.ReactElement {
  const [files, setFiles] = useState<string[]>([]);
  const fs = useFileSystem();
  useEffect(() => {
    async function getFiles(signal: AbortSignal): Promise<void> {
      const results = await fs.ls();
      if (!signal.aborted) {
        setFiles(results);
      }
    }
    const controller = new AbortController();
    getFiles(controller.signal);
    return () => controller.abort();
  }, [fs]);
  useEffect(() => {
    async function handleUpdate(): Promise<void> {
      const results = await fs.ls();
      setFiles(results);
    }
    fs.addEventListener("update", handleUpdate);
    return () => fs.removeEventListener("update", handleUpdate);
  }, [fs]);

  const [expanded, setExpanded] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("file-system-tree-expanded") ?? "[]"),
  );
  useEffect(() => {
    localStorage.setItem("file-system-tree-expanded", JSON.stringify(expanded));
  }, [expanded]);

  async function addFile(): Promise<void> {
    const input = prompt("File name:");
    if (input) {
      const path = `~/${input}`;
      await fs.write(path, new File([], path, { type: "text/plain" }));
      onOpen(path);
    }
  }

  function renderLayer(node: FileTreeItem): JSX.Element {
    return (
      <React.Fragment key={node.path}>
        <li role="treeitem">
          {/* TODO: This should be a true link */}
          <div className={styles.label}>
            <span
              style={{
                visibility: node.children.length > 0 ? "visible" : "hidden",
              }}
            >
              &#9654;
            </span>
            <a onClick={() => onOpen(node.path)}>
              <span>{node.name}</span>
            </a>
          </div>
        </li>
        {node.children.length > 0 && <ul>{node.children.map(renderLayer)}</ul>}
      </React.Fragment>
    );
  }

  const root = buildTree(files);
  console.debug("File tree", root, files);
  return (
    <Pane className={styles.root}>
      <PaneHeader>Workspace</PaneHeader>
      <ul role="tree">{root.children.map(renderLayer)}</ul>
      <button onClick={() => addFile()} type="button">
        Add File
      </button>
    </Pane>
  );
}
