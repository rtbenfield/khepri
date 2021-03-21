import { useCallback } from "react";
import { QuickPickItem, useQuickPick } from "../components/QuickPick";

interface FileSystemQuickPickItem extends QuickPickItem {
  requestFileSystem(): Promise<FileSystemDirectoryHandle | undefined>;
}

interface UseFileSystemPickerResult {
  /**
   * Shows a QuickPick for selecting a file system.
   * Returns a promise that resolves with the a FileSystemDirectoryHandle
   * for the root of the workspace or undefined if the request was canceled.
   */
  showFileSystemPicker(): Promise<FileSystemDirectoryHandle | undefined>;
}

export function useFileSystemPicker(): UseFileSystemPickerResult {
  const { showInputBox, showQuickPick } = useQuickPick();
  const showFileSystemPicker = useCallback(async () => {
    async function handlePickBrowserStorage(): Promise<
      FileSystemDirectoryHandle | undefined
    > {
      const { createIDBFileSystem } = await import(
        "../api/filesystem/indexeddb"
      );
      const workspaceName = await showInputBox({
        prompt: "Workspace name",
      });
      return workspaceName
        ? await createIDBFileSystem(workspaceName)
        : undefined;
    }

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
  }, [showInputBox, showQuickPick]);
  return { showFileSystemPicker };
}
