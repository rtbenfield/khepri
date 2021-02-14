import React, {
  createContext,
  Dispatch,
  PropsWithChildren,
  useContext,
  useState,
} from "react";

export interface Workspace {
  root: FileSystemDirectoryHandle;
}

const context = createContext<
  [Workspace | null, Dispatch<Workspace | null>] | null
>(null);
context.displayName = "WorkspaceProvider";

export function useWorkspace(): Workspace | null {
  const value = useContext(context);
  if (!value) {
    throw new Error(
      "useWorkspace can only be used in a descendent of WorkspaceProvider",
    );
  }
  return value[0];
}

export function useOpenWorkspace(): (workspace: Workspace | null) => void {
  const value = useContext(context);
  if (!value) {
    throw new Error(
      "useOpenWorkspace can only be used in a descendent of WorkspaceProvider",
    );
  }
  return value[1];
}

export function WorkspaceProvider({ children }: PropsWithChildren<{}>) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  return (
    <context.Provider value={[workspace, setWorkspace]}>
      {children}
    </context.Provider>
  );
}
