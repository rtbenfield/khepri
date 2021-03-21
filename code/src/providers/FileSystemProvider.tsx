import React, { createContext, useContext } from "react";
import { useWorkspace } from "./WorkspaceProvider";

const context = createContext<FileSystemDirectoryHandle | undefined>(undefined);
context.displayName = "FileSystemProvider";

export function useFileSystem(): FileSystemDirectoryHandle {
  const value = useContext(context);
  if (!value) {
    throw new Error(
      `useFileSystem can only be used in a descendant of FileSystemProvider`,
    );
  }
  return value;
}

interface FileSystemProviderProps {
  children: React.ReactNode;
}

export function FileSystemProvider({
  children,
}: FileSystemProviderProps): JSX.Element | null {
  const workspace = useWorkspace();
  if (workspace) {
    return (
      <context.Provider value={workspace.root}>{children}</context.Provider>
    );
  } else {
    throw new Error();
  }
}
