import React from "react";
import { settings } from "../api/settings";
import { QuickPickItem, useQuickPick } from "../components/QuickPick";
import { useAsync } from "../hooks/useAsync";
import { useOpenWorkspace } from "../providers/WorkspaceProvider";
import styles from "./Welcome.module.css";

export interface WorkspaceTemplate {
  readonly files: readonly File[];
  readonly name: string;
}

async function inflateTemplate(
  directory: FileSystemDirectoryHandle,
  template: WorkspaceTemplate,
): Promise<void> {
  for (const file of template.files) {
    const fileHandle = await directory.getFileHandle(file.name, {
      create: true,
    });
    const writer = await fileHandle.createWritable({ keepExistingData: false });
    await writer.write(file);
    await writer.close();
  }
}

function RecentlyUsed(): JSX.Element {
  const openWorkspace = useOpenWorkspace();
  const recents = useAsync(() => settings.getRecents(), []);

  async function handleClick(handle: FileSystemDirectoryHandle): Promise<void> {
    const initialPermission = await handle.queryPermission({
      mode: "readwrite",
    });
    if (initialPermission === "granted") {
      openWorkspace({ root: handle });
    } else {
      const requestedPermission = await handle.requestPermission({
        mode: "readwrite",
      });
      if (requestedPermission === "granted") {
        openWorkspace({ root: handle });
      }
    }
  }

  switch (recents.status) {
    case "complete":
      return (
        <section>
          <header>
            <h2>Recent</h2>
            <ul>
              {recents.data.map((r) => (
                <li key={r.name} onClick={() => handleClick(r)}>
                  {r.name}
                </li>
              ))}
            </ul>
            {recents.data.length === 0 && <p>No recently opened</p>}
          </header>
        </section>
      );
    case "error":
      return (
        <section>
          <header>
            <h2>Recent</h2>
            <p>Error</p>
          </header>
        </section>
      );
    case "loading":
      return (
        <section>
          <header>
            <h2>Recently Used</h2>
            <p>Loading...</p>
          </header>
        </section>
      );
  }
}

interface FileSystemQuickPickItem extends QuickPickItem {
  requestFileSystem(): Promise<FileSystemDirectoryHandle | undefined>;
}

function Templates(): JSX.Element {
  const openWorkspace = useOpenWorkspace();
  const { showInputBox, showQuickPick } = useQuickPick();

  async function handlePickBrowserStorage(): Promise<
    FileSystemDirectoryHandle | undefined
  > {
    const { createIDBFileSystem } = await import("../api/filesystem/indexeddb");
    const workspaceName = await showInputBox({
      prompt: "Workspace name",
    });
    return workspaceName ? await createIDBFileSystem(workspaceName) : undefined;
  }

  async function getFileSystem(): Promise<
    FileSystemDirectoryHandle | undefined
  > {
    if ("showDirectoryPicker" in window) {
      const items: FileSystemQuickPickItem[] = [
        {
          alwaysShow: true,
          key: "FileSystemAccessAPI",
          label: "Local File System",
          requestFileSystem() {
            return window.showDirectoryPicker();
          },
        },
        {
          alwaysShow: true,
          key: "IndexedDB",
          label: "Browser Storage",
          requestFileSystem() {
            return handlePickBrowserStorage();
          },
        },
      ];
      const fs = await showQuickPick(items, {
        placeHolder: "Select a file system",
      });
      return await fs?.requestFileSystem();
    } else {
      // Only available option is browser storage
      return await handlePickBrowserStorage();
    }
  }

  async function handleClick(
    factory: () => Promise<{ default: WorkspaceTemplate }>,
  ): Promise<void> {
    const handle = await getFileSystem();
    if (handle) {
      try {
        const { default: template } = await factory();
        await inflateTemplate(handle, template);
        await settings.addRecent(handle);
        openWorkspace({ root: handle });
      } catch (e) {
        console.error(e);
      }
    }
  }

  return (
    <section>
      <header>
        <h2>Templates</h2>
        <ul>
          <li
            onClick={() =>
              handleClick(() => import("../templates/react-typescript"))
            }
          >
            TypeScript React
          </li>
        </ul>
      </header>
    </section>
  );
}

export default function Welcome(): JSX.Element {
  return (
    <main className={styles.root}>
      <header>
        <h1>Khepri Code</h1>
      </header>
      <RecentlyUsed />
      <Templates />
    </main>
  );
}
