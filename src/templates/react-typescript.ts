import type { WorkspaceTemplate } from "../pages/Welcome";

export default Object.freeze<WorkspaceTemplate>({
  files: [
    new File(
      [
        `<!DOCTYPE html>
<html>
  <head>
    <link href="./index.css" rel="stylesheet" />
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="./index.tsx" type="module"></script>
  </body>
</html>
`,
      ],
      "index.html",
      { type: "text/plain" },
    ),
    new File(
      [
        `import React from "https://cdn.skypack.dev/react";
import ReactDOM from "https://cdn.skypack.dev/react-dom";

function App(): JSX.Element {
return <h1>Hello, World!</h1>;
}

ReactDOM.render(<App />, document.getElementById("root"));
`,
      ],
      "index.tsx",
      { type: "text/plain" },
    ),
    new File(
      [
        `body {
text-decoration: underline;
}
`,
      ],
      "index.css",
      { type: "text/plain" },
    ),
  ],
  name: "React TypeScript",
});
