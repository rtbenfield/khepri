import React, { ReactElement, Suspense } from "react";
import "./App.css";
import { QuickPickProvider } from "./components/QuickPick";
import { FileSystemProvider } from "./providers/FileSystemProvider";
import { useWorkspace, WorkspaceProvider } from "./providers/WorkspaceProvider";

const IDE = React.lazy(() => import("./pages/IDE"));
const Welcome = React.lazy(() => import("./pages/Welcome"));

function Router(): JSX.Element {
  const workspace = useWorkspace();
  if (workspace) {
    return (
      <FileSystemProvider>
        <IDE />
      </FileSystemProvider>
    );
  } else {
    return <Welcome />;
  }
}

function App(): ReactElement {
  return (
    <QuickPickProvider>
      <WorkspaceProvider>
        <Suspense fallback={null}>
          <Router />
        </Suspense>
      </WorkspaceProvider>
    </QuickPickProvider>
  );
}

export default App;
