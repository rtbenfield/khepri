import React from "react";
import { settings } from "../api/settings";
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
            <h2>Recently Used</h2>
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
            <h2>Recently Used</h2>
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
React.lazy;

function Templates(): JSX.Element {
  const openWorkspace = useOpenWorkspace();

  async function handleClick(
    factory: () => Promise<{ default: WorkspaceTemplate }>,
  ): Promise<void> {
    try {
      const handle = await window.showDirectoryPicker();
      const { default: template } = await factory();
      await inflateTemplate(handle, template);
      await settings.addRecent(handle);
      openWorkspace({ root: handle });
    } catch {}
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
      <RecentlyUsed />
      <Templates />
    </main>
  );
}
