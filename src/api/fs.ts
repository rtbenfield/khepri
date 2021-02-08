export interface FileSystem {
  addEventListener<K extends keyof FileSystemEventMap>(
    type: K,
    listener: (this: FileSystem, ev: FileSystemEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ): void;
  close(): Promise<void>;
  create(path: string): Promise<File>;
  ls(): Promise<string[]>;
  mkdir(path: string, options?: MkdirOptions): Promise<void>;
  read(path: string): Promise<File | null>;
  remove(path: string, options?: RemoveOptions): Promise<void>;
  removeEventListener<K extends keyof FileSystemEventMap>(
    type: K,
    listener: (this: FileSystem, ev: FileSystemEventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  rename(oldpath: string, newpath: string): Promise<void>;
  stat(path: string): Promise<unknown>;
  write(path: string, file: File, options?: WriteFileOptions): Promise<void>;
}

export class FileSystemUpdateEvent extends Event {
  #files: readonly FileSystemUpdate[];
  #fs: FileSystem;

  constructor(fs: FileSystem, files: readonly FileSystemUpdate[]) {
    super("update");
    this.#fs = fs;
    this.#files = files;
  }

  get fs(): FileSystem {
    return this.#fs;
  }

  get files(): readonly FileSystemUpdate[] {
    return this.#files;
  }
}

export interface FileSystemUpdate {
  action: "remove" | "write";
  path: string;
}

export interface FileSystemEventMap {
  update: FileSystemUpdateEvent;
}

export interface MkdirOptions {
  readonly recursive?: boolean;
}

export interface ReadOptions {}

export interface RemoveOptions {
  readonly recursive?: boolean;
}

export interface WriteFileOptions {
  readonly append?: boolean;
  readonly create?: boolean;
}

const IDB_FILE_STORE = "files";
export class IDBFileSystem extends EventTarget implements FileSystem {
  #db: IDBDatabase;

  constructor(db: IDBDatabase, options?: IDBFileSystemOptions) {
    super();
    this.#db = db;
  }

  #getStore = (mode: "readonly" | "readwrite"): IDBObjectStore => {
    return this.#db
      .transaction(IDB_FILE_STORE, mode)
      .objectStore(IDB_FILE_STORE);
  };

  close(): Promise<void> {
    this.#db.close();
    return Promise.resolve();
  }

  async create(path: string): Promise<File> {
    const file = await new Promise<File>((resolve, reject) => {
      const store = this.#getStore("readwrite");
      const file = new File([], path);
      const request = store.add(file, path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(file));
    });
    this.dispatchEvent(
      new FileSystemUpdateEvent(this, [{ action: "write", path }]),
    );
    return file;
  }

  async ls(): Promise<string[]> {
    return await new Promise<string[]>((resolve, reject) => {
      const store = this.#getStore("readonly");
      const request = store.getAllKeys();
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () =>
        resolve(
          request.result.filter((x): x is string => typeof x === "string"),
        ),
      );
    });
  }

  mkdir(path: string, options?: MkdirOptions): Promise<void> {
    throw new Error("Method not implemented.");
  }

  read(path: string, options?: ReadOptions): Promise<File | null> {
    return new Promise<File | null>((resolve, reject) => {
      const store = this.#getStore("readonly");
      const request = store.get(path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () =>
        resolve(request.result ?? null),
      );
    });
  }

  async remove(path: string, options?: RemoveOptions): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const store = this.#getStore("readwrite");
      const request = store.delete(path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve());
    });
    this.dispatchEvent(
      new FileSystemUpdateEvent(this, [{ action: "remove", path }]),
    );
  }

  async rename(oldpath: string, newpath: string): Promise<void> {
    const value = await this.read(oldpath);
    await new Promise<void>((resolve, reject) => {
      const store = this.#getStore("readwrite");
      store.transaction.addEventListener("complete", () => resolve());
      store.transaction.addEventListener("error", () =>
        reject(store.transaction.error),
      );
      store.add(value, newpath);
      store.delete(oldpath);
    });
    this.dispatchEvent(
      new FileSystemUpdateEvent(this, [
        { action: "remove", path: oldpath },
        { action: "write", path: newpath },
      ]),
    );
  }

  stat(path: string): Promise<unknown> {
    throw new Error("Method not implemented.");
  }

  async write(
    path: string,
    file: File,
    options?: WriteFileOptions,
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const store = this.#getStore("readwrite");
      const request = store.put(file, path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve());
    });
    this.dispatchEvent(
      new FileSystemUpdateEvent(this, [{ action: "write", path }]),
    );
  }

  static async fromWorkspace(
    { name }: Workspace,
    options?: IDBFileSystemOptions,
  ): Promise<IDBFileSystem> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("upgradeneeded", () => {
        request.result.createObjectStore(IDB_FILE_STORE);
      });
    });
    return new IDBFileSystem(db, options);
  }
}

export interface IDBFileSystemOptions {}

export interface Workspace {
  readonly name: string;
}

const enum KnownLanguage {
  html = "html",
  javascript = "jaascript",
  typescript = "typescript",
  text = "text",
}

export function getFileParts(
  path: string,
): { extension: string; name: string } | null {
  const match = path.match(/^(?<name>.*)(?<extension>\.\w+$)/);
  return match && match.groups
    ? { extension: match.groups.extension, name: match.groups.name }
    : null;
}

export function getLanguage(path: string): KnownLanguage {
  const { extension } = getFileParts(path) ?? { extension: "" };
  switch (extension) {
    case ".html":
      return KnownLanguage.html;
    case ".js":
    case ".jsx":
      return KnownLanguage.javascript;
    case ".ts":
    case ".tsx":
      return KnownLanguage.typescript;
    default:
      return KnownLanguage.text;
  }
}
