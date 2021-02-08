import React, { ReactElement } from "react";
import "./App.css";
import { IDE } from "./pages/IDE";
import { FileSystemProvider } from "./providers/FileSystemProvider";

function App(): ReactElement {
  return (
    <FileSystemProvider>
      <IDE />
    </FileSystemProvider>
  );
}

export default App;
