# Scarab (Khepri Core)

Scarab is the underlying build system and core of the Khepri project.

Scarab, along with the rest of Khepri, is still experimental and will rapidly
change.

## Goals

- Support any spec compliant JavaScript runtime, including modern browsers. This
  implies that Scarab must remain platform agnostic.
- Build on web platform standards as much as possible. This further enforces the
  previous point.

## Non-goals

- Scarab will not do any transformations by default. Plugins and default
  configuration are part of Khepri, but not implemented by Scarab.
- Scarab will not provide polyfills to target any JavaScript runtimes. Khepri
  will provide wrappers for runtimes like Deno or Node, but Scarab will remain
  agnostic.
- Scarab will not supply a CLI. The CLI will require a JavaScript runtime which
  violates Scarab's goals. However, Khepri may provide a CLI that uses Scarab.

## Usage

Scarab can be used by importing `scarab.ts` and using the provided classes and
functions.

### Dev Server

Unlike most build tools, the Scarab dev server does not start a web server.
However, it does provide functions for handling standard JavaScript `Request`
objects and responding with standard `Response` objects. This aligns with the
goals of remaining JavaScript runtime agnostic and relying on web platform
standards.

Wrappers for JavaScript runtimes can start a web server and map their
request/response types to the standard types, if needed.

```typescript
import { KhepriDevServer } from "./scarab.ts";
import { KhepriConfig } from "./types.ts";

// Note that showOpenDirectoryPicker is currently only implemented in Chrome.
// Other browsers could supply a ponyfill solution using another storage mechanism like IndexedDB.
// JavaScript runtimes like Deno and Node will require a different API.
const fileSystem: FileSystemDirectoryHandle = await window.showDirectoryPicker();

const config: KhepriConfig {
  fileSystem,
  logger: console,
  plugins: [
    /* Plugin factories go here */
  ],
};

const devServer: KhepriDevServer = await KhepriDevServer.start(config);
```

### Build

Scarab's `build` behaves more like traditional build tools. It takes all source
files configured in `mount` and sends them through the build pipeline. The
results are written to the specified `out` directory (defaults to `./build`)
based on the mount's URL path and file location.

## Plugins

> // TODO: Description, example plugins, etc.

### Plugin Recommendations

- Remain compatible with standards-compliant JavaScript runtimes. This primarily
  means focusing on browser-compatibility.
- Do heavy lifting in WebAssembly and web workers.
- Use object instances provided by Scarab when possible. For example, use
  Scarab's `logger` over `console`. This creates a more unified user experience
  and improves runtime compatibility.

### Plugin Test Framework

One of Scarab's roadmap items is to implement a plugin testing framework. This
will first be developed for official plugins and be extended to the community if
all goes well. Ideally this framework will run tests in all official
environments to ensure maximum compatibility, but there is a lot to explore in
this area. Suggestions are welcomed.
