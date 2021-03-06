import React from "react";
import { settings } from "../api/settings";
import { useAsync } from "../hooks/useAsync";
import { useFileSystemPicker } from "../hooks/useFileSystemPicker";
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
          </header>
          <ul>
            {recents.data.map((r) => (
              <li key={r.name} onClick={() => handleClick(r)}>
                {r.name}
              </li>
            ))}
          </ul>
          {recents.data.length === 0 && <p>No recently opened</p>}
        </section>
      );
    case "error":
      return (
        <section>
          <header>
            <h2>Recent</h2>
          </header>
          <p>Error</p>
        </section>
      );
    case "loading":
      return (
        <section>
          <header>
            <h2>Recently Used</h2>
          </header>
          <p>Loading...</p>
        </section>
      );
  }
}

function Start(): JSX.Element {
  const openWorkspace = useOpenWorkspace();
  const { showFileSystemPicker } = useFileSystemPicker();

  async function handleOpen(): Promise<void> {
    const handle = await showFileSystemPicker();
    if (handle) {
      await settings.addRecent(handle);
      openWorkspace({ root: handle });
    }
  }

  return (
    <section>
      <header>
        <h2>Start</h2>
      </header>
      <button onClick={() => handleOpen()} type="button">
        Open
      </button>
    </section>
  );
}

function Templates(): JSX.Element {
  const openWorkspace = useOpenWorkspace();
  const { showFileSystemPicker } = useFileSystemPicker();

  async function handleClick(
    factory: () => Promise<{ default: WorkspaceTemplate }>,
  ): Promise<void> {
    const handle = await showFileSystemPicker();
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
      </header>
      <ul>
        <li
          onClick={() =>
            handleClick(() => import("../templates/react-typescript"))
          }
        >
          TypeScript React
        </li>
      </ul>
    </section>
  );
}

export default function Welcome(): JSX.Element {
  return (
    <main className={styles.root}>
      <header>
        <h1>Khepri Code</h1>
      </header>
      {/* <Start /> */}
      <RecentlyUsed />
      <Templates />
    </main>
  );
}
