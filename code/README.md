# Khepri Code

Khepri Code explores the idea of a browser-first IDE experience built on the web platform. While other projects are also exploring this space, they are using build tools and workflows designed for development in a traditional desktop environment. Khepri attempts to start over using only web platform APIs and abandoning features that don't exist on the web platform.

Khepri Code is built on the Scarab engine (Khepri core). Similar to working in a local environment, Scarab can be configured to suit the needs of various projects. However, because Khepri Code runs in the browser, it can only consume plugins that are browser-compatible. All official plugins are and will be browser-compatible, but community plugins could deviate from this to meet their own goals.

Khepri Code is still experimental and will rapidly change.

## Goals

- Rely on web platform APIs as much as possible, even if those APIs are experimental.
- Encourage local-first development. Cloud functionality should be opt-in. Functionality in local-mode should only be limited if necessary, like collaboration or sharing.
- Provide an browser-based editor experience that rivals local editing. This includes an editor with good syntax highlighting, suggestions, a preview window, and even Git support.

## Local-first Development

Khepri Code is a browser-based IDE, so a local-first approach may seem strange. Hear me out.

Just because something runs in the browser doesn't mean it has to rely on the cloud. The modern web platform provides a lot of functionality to make working offline feel natural. The File System Access API lets us work with local files, IndexedDB lets us take structured data offline, and Service Workers let us cache files for offline and even intercept network requests. Browsers are more than just a tool for opening web sites. They are the door to the safest and most accessible development platform we have.

How does Khepri Code handle local-first development? For starters, all code starts local and offline. Either the File System Access API (if available) or IndexedDB are used to store and work with files. Cloud saving will likely be an option in the future, but it will be entirely opt-in. The default will still be to start locally.

Compiling also happens locally in the browser using Scarab. Scarab will compile the files from the selected file system and place them into a cache for serving to the preview window. When the preview window requests a compiled resource, a Service Worker will intercept the request and supply the compiled output. Eventually this may be moved to run compilation on-the-fly.

To collaborate with your team, Khepri Code will provide Git support right in the browser. Files can be committed and pushed to your Git repository just like any local editor and without any middle-man. That means your code always stays with you and your team until you are ready to share it.

Eventually some features may arise that require some cloud services. Collaboration is an example that comes to mind. In these cases, local-first options will be explored first (like P2P) with cloud services taking as little responsibility as possible.

This may all seem extreme, but it is in an effort to keep your code where it belongs: with you and your team.
