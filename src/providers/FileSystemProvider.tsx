import React, { createContext, useContext, useEffect, useState } from "react";
import { FileSystem, IDBFileSystem } from "../api/fs";

const context = createContext<FileSystem | undefined>(undefined);
context.displayName = "FileSystemProvider";

export function useFileSystem(): FileSystem {
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
  const [value, setValue] = useState<IDBFileSystem | null>(null);

  useEffect(() => {
    IDBFileSystem.fromWorkspace({ name: "DEFAULT" }).then((fs) => setValue(fs));
  }, []);

  if (value) {
    return <context.Provider value={value}>{children}</context.Provider>;
  } else {
    return null;
  }
}
