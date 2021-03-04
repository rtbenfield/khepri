// FileSystemObserver is a temporary implementation of the proposal defined here:
// https://docs.google.com/document/d/1jYXOZGen4z7kNrKnwBk5z4tbGRmGXmQ9nmoyJRm-V9M/edit

const enum FileSystemChangeType {
  "updated",
  "added",
  "deleted",
}

// interface FileTraceResult {
//   readonly changedHandle: FileSystemHandle;
//   readonly lastModified: File["lastModified"];
//   readonly relativePath: readonly string[];
//   readonly root: FileSystemHandle;
//   readonly type: FileSystemChangeType;
// }

// async function traceHandle(
//   handle: FileSystemHandle,
//   signal?: AbortSignal,
// ): FileTraceResult {
//   switch (handle.kind) {
//     case "directory": {
//       let max: File["lastModified"] = 0;
//       for await (const entry of handle.values()) {
//         max = Math.max(max, await getLastModified(entry));
//         if (signal?.aborted) {
//           throw new DOMException(
//             "Calculation aborted by the user",
//             "AbortError",
//           );
//         }
//       }
//       return max;
//     }
//     case "file": {
//       const file = await handle.getFile();
//       return file.lastModified;
//     }
//   }
// }

async function getLastModified(
  handle: FileSystemHandle,
  signal?: AbortSignal,
): Promise<File["lastModified"]> {
  switch (handle.kind) {
    case "directory": {
      let max: File["lastModified"] = 0;
      for await (const entry of handle.values()) {
        max = Math.max(max, await getLastModified(entry));
        if (signal?.aborted) {
          throw new DOMException(
            "Calculation aborted by the user",
            "AbortError",
          );
        }
      }
      return max;
    }
    case "file": {
      const file = await handle.getFile();
      return file.lastModified;
    }
  }
}

export class PollingFileSystemObserver {
  readonly #callback: FileSystemObserverCallback;
  readonly #controller = new AbortController();
  readonly #handles = new Map<
    FileSystemHandle,
    [AbortController, File["lastModified"]]
  >();
  readonly #options: PollingFileSystemObserverOptions;

  constructor(
    callback: FileSystemObserverCallback,
    options: PollingFileSystemObserverOptions = {},
  ) {
    this.#callback = callback;
    this.#options = options;

    const interval = setInterval(
      this.#poll,
      options.intervalMilliseconds ?? 5000,
    );
    this.#controller.signal.addEventListener("abort", () => {
      clearInterval(interval);
    });
  }

  /**
   * Returns the existing handle matching the specified handle.
   * Searches for an isSameEntry match if a reference match does not exist.
   * @param handle
   */
  #getExistingHandle = (handle: FileSystemHandle): FileSystemHandle | null => {
    if (this.#handles.has(handle)) {
      return handle;
    } else {
      // No reference match found. Search by isSameEntry
      for (const h of this.#handles.keys()) {
        if (h.isSameEntry(handle)) {
          return h;
        }
      }
      return null;
    }
  };

  #poll = async (): Promise<void> => {
    const entries: FileSystemObserverEntry[] = [];
    for (const [handle, [, prev]] of this.#handles.entries()) {
      try {
        const lastModified = await getLastModified(
          handle,
          this.#controller.signal,
        );
        if (lastModified > prev) {
          entries.push({
            changedHandle: handle,
            relativePath: [],
            root: handle,
            type: FileSystemChangeType.updated,
          });
        }
      } catch (e) {
        if (e instanceof DOMException) {
          entries.push({
            changedHandle: handle,
            relativePath: [],
            root: handle,
            type: FileSystemChangeType.deleted,
          });
        } else {
          throw e;
        }
      }
    }
    if (entries.length > 0) {
      this.#callback(entries, this);
    }
  };

  public disconnect(): void {
    this.#controller.abort();
    this.#handles.clear();
  }

  public async observe(handle: FileSystemHandle): Promise<void> {
    if (this.#controller.signal.aborted) {
      throw new DOMException(
        "FileSystemObserver has been disconnected",
        "AbortError",
      );
    } else if (!this.#getExistingHandle(handle)) {
      const controller = new AbortController();
      this.#controller.signal.addEventListener("abort", () => {
        controller.abort();
      });
      const lastModified = await getLastModified(handle, controller.signal);
      this.#handles.set(handle, [controller, lastModified]);
    }
  }

  public unobserve(handle: FileSystemHandle): void {
    const existing = this.#getExistingHandle(handle);
    if (existing) {
      const [controller] = this.#handles.get(existing) ?? [];
      controller?.abort();
      this.#handles.delete(existing);
    }
  }
}

type FileSystemObserverCallback = (
  entries: FileSystemObserverEntry[],
  observer: PollingFileSystemObserver,
) => void;

export abstract class FileSystemObserverEntry {
  abstract get changedHandle(): FileSystemHandle;
  /** The path of changed_handle, relative to |root|. */
  abstract get relativePath(): readonly string[];
  /** The handle that was passed to FileSystemObserver.observe */
  abstract get root(): FileSystemHandle;
  abstract get type(): FileSystemChangeType;
}

interface PollingFileSystemObserverOptions {
  /**
   * @default 5000
   */
  intervalMilliseconds?: number;

  /**
   * @default false
   */
  recursive?: boolean;
}
