import React, { useEffect, useState } from "react";
import { useFileSystem } from "../providers/FileSystemProvider";
import styles from "./FileSystemTree.module.css";
import { Pane, PaneHeader } from "./Sidebar";

export type MutableDeep<ObjectType> = {
  -readonly // For each `Key` in the keys of `ObjectType`, make a mapped type by removing the `readonly` modifier from the key.
  [KeyType in keyof ObjectType]: MutableDeep<ObjectType[KeyType]>;
};

interface FileSystemTreeProps {
  onOpen(fileHandle: FileSystemFileHandle): void;
}

interface FileTreeItem {
  readonly children: readonly FileTreeItem[];
  readonly handle: FileSystemHandle;
}

async function addFile(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<void> {
  const pathParts = path.split("/");
  const [fileName] = pathParts.slice(-1);
  const dirNames = pathParts.slice(0, -1);
  let dirHandle = root;
  for (const dirName of dirNames) {
    dirHandle = await dirHandle.getDirectoryHandle(dirName, { create: true });
  }
  await dirHandle.getFileHandle(fileName, { create: true });
}

async function buildTree(
  dir: FileSystemDirectoryHandle,
): Promise<FileTreeItem> {
  const dirs: FileTreeItem[] = [];
  const files: FileTreeItem[] = [];
  for await (const entry of dir.values()) {
    switch (entry.kind) {
      case "directory": {
        dirs.push(await buildTree(entry));
        break;
      }
      case "file": {
        files.push({
          children: [],
          handle: entry,
        });
        break;
      }
    }
  }
  return {
    children: [
      // List directories before files
      ...dirs,
      ...files,
    ],
    handle: dir,
  };
}

export function FileSystemTree({
  onOpen,
}: FileSystemTreeProps): React.ReactElement {
  const [tree, setTree] = useState<FileTreeItem | null>(null);
  const fs = useFileSystem();
  useEffect(() => {
    async function getFiles(signal: AbortSignal): Promise<void> {
      const newTree = await buildTree(fs);
      if (!signal.aborted) {
        setTree(newTree);
      }
    }
    const controller = new AbortController();
    getFiles(controller.signal);
    return () => controller.abort();
  }, [fs]);

  const [expanded, setExpanded] = useState<string[]>(() =>
    JSON.parse(localStorage.getItem("file-system-tree-expanded") ?? "[]"),
  );
  useEffect(() => {
    localStorage.setItem("file-system-tree-expanded", JSON.stringify(expanded));
  }, [expanded]);

  async function handleAddClick(): Promise<void> {
    const input = prompt("File name:");
    if (input) {
      await addFile(fs, input);
      const newTree = await buildTree(fs);
      setTree(newTree);
    }
  }

  function renderLayer({ children, handle }: FileTreeItem): JSX.Element {
    return (
      <React.Fragment key={handle.name}>
        <li role="treeitem">
          {/* TODO: This should be a true link */}
          <div className={styles.label}>
            <span
              style={{
                visibility: children.length > 0 ? "visible" : "hidden",
              }}
            >
              &#9654;
            </span>
            {handle.kind === "file" ? (
              <a onClick={() => onOpen(handle)}>
                <span>{handle.name}</span>
              </a>
            ) : (
              <span>{handle.name}</span>
            )}
          </div>
        </li>
        {children.length > 0 && <ul>{children.map(renderLayer)}</ul>}
      </React.Fragment>
    );
  }

  return (
    <Pane className={styles.root}>
      <PaneHeader>Workspace</PaneHeader>
      {tree && <ul role="tree">{tree.children.map(renderLayer)}</ul>}
      <button onClick={() => handleAddClick()} type="button">
        Add File
      </button>
    </Pane>
  );
}
