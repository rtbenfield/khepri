function combine(...paths: readonly string[]): string {
  return paths.join("/").replaceAll("//", "/");
}

function getFileName(path: string): string {
  return path.substring(path.lastIndexOf("/") + 1);
}

function validate(name: string): void {
  if (name.includes("/")) {
    throw new Error(`Invalid file name ${name}`);
  }
}

export class IDBFileSystemDirectoryHandle implements FileSystemDirectoryHandle {
  readonly #fs: IDBFileSystem;
  readonly #path: string;

  public get isDirectory() {
    return true as this["kind"] extends "directory" ? true : false;
  }

  public get isFile() {
    return false as this["kind"] extends "file" ? true : false;
  }

  public get kind() {
    return "directory" as const;
  }

  public get name() {
    return getFileName(this.path);
  }

  public get path() {
    return this.#path;
  }

  public constructor(path: string, fs: IDBFileSystem) {
    this.#fs = fs;
    this.#path = path;
  }

  public [Symbol.asyncIterator]() {
    return this.entries();
  }

  public async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    // TODO: What is the string here? the file name?
    for await (const child of this.#fs.getSubdirectories(this.path)) {
      yield [
        getFileName(child),
        new IDBFileSystemDirectoryHandle(child, this.#fs),
      ];
    }
    for await (const child of this.#fs.getDirectoryFiles(this.path)) {
      yield [getFileName(child), new IDBFileSystemFileHandle(this.#fs, child)];
    }
  }

  /**
   * @deprecated Old property just for Chromium <=85. Use `.getDirectoryHandle()` in the new API.
   */
  public getDirectory(
    name: string,
    options?: FileSystemGetDirectoryOptions | undefined,
  ): Promise<FileSystemDirectoryHandle> {
    return this.getDirectoryHandle(name, options);
  }

  public getDirectoryHandle(
    name: string,
    options?: FileSystemGetDirectoryOptions,
  ): Promise<FileSystemDirectoryHandle> {
    validate(name);
    const path = combine(this.path, name);
    return this.#fs.getDirectoryHandle(path, options);
  }

  /**
   * @deprecated Old property just for Chromium <=85. Use `.keys()`, `.values()`, `.entries()`, or the directory itself as an async iterable in the new API.
   */
  public getEntries(): AsyncIterableIterator<FileSystemHandle> {
    return this.values();
  }

  /**
   * @deprecated Old property just for Chromium <=85. Use `.getFileHandle()` in the new API.
   */
  public getFile(
    name: string,
    options?: FileSystemGetFileOptions | undefined,
  ): Promise<FileSystemFileHandle> {
    return this.getFileHandle(name, options);
  }

  public getFileHandle(
    name: string,
    options?: FileSystemGetFileOptions,
  ): Promise<FileSystemFileHandle> {
    validate(name);
    const path = combine(this.path, name);
    return this.#fs.getFileHandle(path, options);
  }

  public isSameEntry(other: FileSystemHandle): Promise<boolean> {
    if (other instanceof IDBFileSystemDirectoryHandle) {
      return Promise.resolve(this.path === other.path);
    } else {
      return Promise.resolve(false);
    }
  }

  public async *keys(): AsyncIterableIterator<string> {
    for await (const child of this.#fs.getChildren(this.path)) {
      yield getFileName(child);
    }
  }

  public queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState> {
    return Promise.resolve("granted");
  }

  public removeEntry(
    name: string,
    options: FileSystemRemoveOptions,
  ): Promise<void> {
    validate(name);
    const path = combine(this.path, name);
    return this.#fs.removeEntry(path, options);
  }

  public requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState> {
    return Promise.resolve("granted");
  }

  public resolve(
    possibleDescendant: FileSystemHandle,
  ): Promise<string[] | null> {
    if (
      possibleDescendant instanceof IDBFileSystemFileHandle ||
      possibleDescendant instanceof IDBFileSystemDirectoryHandle
    ) {
      return this.#fs.resolve(
        this.path,
        possibleDescendant.path,
        possibleDescendant.kind,
      );
    } else {
      throw new TypeError(
        "Argument must of type IDBFileSystemFileHandle or IDBFileSystemDirectoryHandle",
      );
    }
  }

  public async *values(): AsyncIterableIterator<FileSystemHandle> {
    for await (const child of this.#fs.getSubdirectories(this.#path)) {
      yield new IDBFileSystemDirectoryHandle(child, this.#fs);
    }
    for await (const child of this.#fs.getDirectoryFiles(this.#path)) {
      yield new IDBFileSystemFileHandle(this.#fs, child);
    }
  }
}

export class IDBFileSystemFileHandle implements FileSystemFileHandle {
  readonly #fs: IDBFileSystem;
  readonly #path: string;

  public get isDirectory() {
    return false as this["kind"] extends "directory" ? true : false;
  }

  public get isFile() {
    return true as this["kind"] extends "file" ? true : false;
  }

  public get kind() {
    return "file" as const;
  }

  public get name() {
    return getFileName(this.path);
  }

  public get path() {
    return this.#path;
  }

  public constructor(fs: IDBFileSystem, path: string) {
    this.#fs = fs;
    this.#path = path;
  }

  public createWritable({
    keepExistingData = false,
  }: FileSystemCreateWritableOptions = {}): Promise<FileSystemWritableFileStream> {
    const sink = new IDBFileWriterSink(this.#fs, this.#path, keepExistingData);
    const stream = new IDBFileSystemWritableFileStream(sink);
    return Promise.resolve(stream);
  }

  public getFile(): Promise<File> {
    return this.#fs.getFile(this.#path);
  }

  public isSameEntry(other: FileSystemHandle): Promise<boolean> {
    if (other instanceof IDBFileSystemFileHandle) {
      return Promise.resolve(this.#path === other.#path);
    } else {
      return Promise.resolve(false);
    }
  }

  public queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState> {
    return Promise.resolve<PermissionState>("granted");
  }

  public requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<PermissionState> {
    return Promise.resolve<PermissionState>("granted");
  }
}

class IDBFileWriterSink implements UnderlyingSink<BlobPart> {
  readonly #fs: IDBFileSystem;
  readonly #keepExistingData: boolean;
  readonly #parts: BlobPart[] = [];
  readonly #path: string;

  public constructor(
    fs: IDBFileSystem,
    path: string,
    keepExistingData: boolean,
  ) {
    this.#fs = fs;
    this.#keepExistingData = keepExistingData;
    this.#path = path;
  }

  public async close(): Promise<void> {
    const fileName = getFileName(this.#path);
    const lastModified = new Date().getTime();
    const file = new File(this.#parts, fileName, { lastModified });
    await this.#fs.writeFile(this.#path, file);
  }

  public async start(
    controller: WritableStreamDefaultController,
  ): Promise<void> {
    if (this.#keepExistingData) {
      try {
        const file = await this.#fs.getFile(this.#path);
        const bytes = await file.arrayBuffer();
        this.#parts.push(bytes);
      } catch (e) {
        if (!(e instanceof NotFoundError)) {
          controller.error(e);
          throw e;
        }
      }
    }
  }

  public write(
    chunk: BlobPart,
    controller: WritableStreamDefaultController,
  ): Promise<void> {
    this.#parts.push(chunk);
    return Promise.resolve();
  }
}

class IDBFileSystemWritableFileStream
  extends WritableStream<BlobPart>
  implements FileSystemWritableFileStream {
  public seek(position: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public truncate(size: number): Promise<void> {
    throw new Error("Method not implemented.");
  }

  public async write(data: FileSystemWriteChunkType): Promise<void> {
    if (
      data instanceof ArrayBuffer ||
      ArrayBuffer.isView(data) ||
      data instanceof Blob ||
      typeof data === "string"
    ) {
      const writer = this.getWriter();
      await writer.write(data);
      await writer.ready;
      writer.releaseLock();
    } else {
      switch (data.type) {
        case "seek":
          return this.seek(data.position);
        case "truncate":
          return this.truncate(data.size);
        case "write":
          if (typeof data.position === "number") {
            this.seek(data.position);
          }
          return this.write(data.data);
      }
    }
  }
}

class IDBFileSystem {
  readonly #db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.#db = db;
  }

  readonly #directories = (mode: "readonly" | "readwrite"): IDBObjectStore => {
    return this.#db.transaction("directories", mode).objectStore("directories");
  };

  readonly #files = (mode: "readonly" | "readwrite"): IDBObjectStore => {
    return this.#db.transaction("files", mode).objectStore("files");
  };

  public async createDirectory(
    path: string,
  ): Promise<FileSystemDirectoryHandle> {
    await new Promise<void>((resolve, reject) => {
      const request = this.#directories("readwrite").add({ path });
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve());
    });
    return new IDBFileSystemDirectoryHandle(path, this);
  }

  public async createFile(path: string): Promise<FileSystemFileHandle> {
    await new Promise<void>((resolve, reject) => {
      const lastModified = new Date().getTime();
      const fileName = getFileName(path);
      const file = new File([], fileName, { lastModified });
      const request = this.#files("readwrite").add(file, path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve());
    });
    return new IDBFileSystemFileHandle(this, path);
  }

  public async *getChildren(path: string): AsyncIterableIterator<string> {
    for await (const key of this.getSubdirectories(path)) {
      yield key;
    }
    for await (const key of this.getDirectoryFiles(path)) {
      yield key;
    }
  }

  public async *getSubdirectories(path: string): AsyncIterableIterator<string> {
    const allKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      // TODO: Wille IDBKeyRange work here?
      const request = this.#directories("readonly").getAllKeys();
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
    });
    const children = allKeys
      .filter((x): x is string => typeof x === "string")
      .filter((x) => x !== path)
      .filter((x) => x.startsWith(path))
      .filter((x) => !x.substring(path.length + 1).includes("/"));
    for (const child of children) {
      yield child;
    }
  }

  public async *getDirectoryFiles(path: string): AsyncIterableIterator<string> {
    const allKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      // TODO: Wille IDBKeyRange work here?
      const request = this.#files("readonly").getAllKeys();
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
    });
    const children = allKeys
      .filter((x): x is string => typeof x === "string")
      .filter((x) => x !== path)
      .filter((x) => x.startsWith(path))
      .filter((x) => !x.substring(path.length + 1).includes("/"));
    for (const child of children) {
      yield child;
    }
  }

  public async getDirectoryHandle(
    path: string,
    { create = false }: FileSystemGetDirectoryOptions = {},
  ): Promise<FileSystemDirectoryHandle> {
    const existing = await new Promise<unknown>((resolve, reject) => {
      const request = this.#directories("readonly").get(path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
    });
    if (existing) {
      return new IDBFileSystemDirectoryHandle(path, this);
    } else if (create) {
      return this.createDirectory(path);
    } else {
      throw new NotFoundError();
    }
  }

  public async getFile(path: string): Promise<File> {
    const existing = await new Promise<unknown>((resolve, reject) => {
      const request = this.#files("readonly").get(path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
    });
    if (existing instanceof File) {
      return existing;
    } else if (existing) {
      // Not a File...
      throw new TypeMismatchError();
    } else {
      throw new NotFoundError();
    }
  }

  public async getFileHandle(
    path: string,
    { create = false }: FileSystemGetFileOptions = {},
  ): Promise<FileSystemFileHandle> {
    const existing = await new Promise<unknown>((resolve, reject) => {
      const request = this.#files("readonly").get(path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
    });
    if (existing instanceof File) {
      return new IDBFileSystemFileHandle(this, path);
    } else if (existing) {
      // Not a File...
      throw new TypeMismatchError();
    } else if (create) {
      return this.createFile(path);
    } else {
      throw new NotFoundError();
    }
  }

  public async removeDirectory(
    path: string,
    { recursive = false }: FileSystemRemoveOptions = {},
  ): Promise<void> {
    if (recursive) {
      const subdirectoryKeys = await new Promise<IDBArrayKey>(
        (resolve, reject) => {
          // TODO: Wille IDBKeyRange work here?
          const request = this.#directories("readonly").getAllKeys();
          request.addEventListener("error", () => reject(request.error));
          request.addEventListener("success", () => {
            const keys: IDBArrayKey = request.result
              .filter((x): x is string => typeof x === "string")
              .filter((x) => x !== path)
              .filter((x) => x.startsWith(path));
            resolve(keys);
          });
        },
      );
      const fileKeys = await new Promise<IDBArrayKey>((resolve, reject) => {
        // TODO: Wille IDBKeyRange work here?
        const request = this.#files("readonly").getAllKeys();
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const keys: IDBArrayKey = request.result
            .filter((x): x is string => typeof x === "string")
            .filter((x) => x.startsWith(path));
          resolve(keys);
        });
      });

      await new Promise<void>((resolve, reject) => {
        const transaction = this.#db.transaction(
          ["directories", "files"],
          "readwrite",
        );
        transaction.objectStore("directories").delete(subdirectoryKeys);
        transaction.objectStore("files").delete(fileKeys);
        transaction.addEventListener("error", () => reject(transaction.error));
        transaction.addEventListener("success", () => resolve());
      });
    } else {
      const subdirectoryExists = await new Promise<boolean>(
        (resolve, reject) => {
          // TODO: Wille IDBKeyRange work here?
          const request = this.#directories("readonly").getAllKeys();
          request.addEventListener("error", () => reject(request.error));
          request.addEventListener("success", () => {
            const exists = request.result
              .filter((x): x is string => typeof x === "string")
              .filter((x) => x !== path)
              .some((x) => x.startsWith(path));
            resolve(exists);
          });
        },
      );
      const fileExists = await new Promise<boolean>((resolve, reject) => {
        // TODO: Wille IDBKeyRange work here?
        const request = this.#files("readonly").getAllKeys();
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => {
          const exists = request.result
            .filter((x): x is string => typeof x === "string")
            .some((x) => x.startsWith(path));
          resolve(exists);
        });
      });
      if (subdirectoryExists || fileExists) {
        throw new InvalidModificationError();
      } else {
        await new Promise<void>((resolve, reject) => {
          const request = this.#directories("readwrite").delete(path);
          request.addEventListener("error", () => reject(request.error));
          request.addEventListener("success", () => resolve());
        });
      }
    }
  }

  public async removeEntry(
    path: string,
    options?: FileSystemRemoveOptions,
  ): Promise<void> {
    await Promise.all([
      await this.removeDirectory(path, options),
      await this.removeFile(path),
    ]);
  }

  public removeFile(...paths: string[]): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = this.#files("readonly").delete(paths);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve());
    });
  }

  public async resolve(
    root: string,
    path: string,
    type: FileSystemHandleKind,
  ): Promise<string[] | null> {
    switch (type) {
      case "directory":
        return null;
      case "file":
        return null;
    }
  }

  public writeFile(path: string, file: File): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = this.#files("readwrite").put(file, path);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve());
    });
  }

  static async create(name: string): Promise<IDBFileSystem> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = window.indexedDB.open(name, 1);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("upgradeneeded", () => {
        request.result.createObjectStore("directories", { keyPath: "path" });
        request.result.createObjectStore("files");
      });
    });
    return new IDBFileSystem(db);
  }
}

export async function createIDBFileSystem(
  name: string,
): Promise<FileSystemDirectoryHandle> {
  const fs = await IDBFileSystem.create(name);
  return await fs.getDirectoryHandle("/", { create: true });
}

export class InvalidModificationError extends Error {}
export class NotFoundError extends Error {}
export class TypeMismatchError extends Error {}
