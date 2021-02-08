import React, { useEffect, useState } from "react";
import { useFileSystem } from "../providers/FileSystemProvider";

interface FileSystemTreeProps {
  onOpen(file: string): void;
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

  return (
    <div>
      <ul role="tree">
        {files.map((file) => (
          <li key={file} onClick={() => onOpen(file)} role="treeitem">
            {file.replace("~/", "")}
          </li>
        ))}
      </ul>
      <button
        onClick={() => {
          const name = prompt("File name:");
          if (name) {
            onOpen(`~/${name}`);
          }
        }}
        type="button"
      >
        Add File
      </button>
    </div>
  );
}

// interface FileSystemTreeItemProps {
//   file: string;
// }

// function FileSystemTreeItem({ file }: FileSystemTreeItemProps): React.ReactElement {
//   return (
//     <li onClick={() => } role="treeitem">
//       {file}
//     </li>
//   )
// }
