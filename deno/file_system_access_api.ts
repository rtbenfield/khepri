/// <reference path="../types/wicg-file-system-access.d.ts" />
import {
  basename,
  join,
  resolve,
  sep,
} from "https://deno.land/std@0.93.0/path/mod.ts";

// TODO: This file needs to be audited for spec-compliance and then migrated into its own project outside of Khepri.
// Right now it is close enough to serve Khepri's needs so I am running with it.

abstract class DenoBaseFileSystemHandle {
  readonly #path: string;

  protected constructor(path: string) {
    this.#path = resolve(path);
  }

  get isDirectory() {
    return true as this["kind"] extends "directory" ? true : false;
  }

  get isFile() {
    return false as this["kind"] extends "file" ? true : false;
  }

  abstract get kind(): FileSystemHandleKind;

  get name(): string {
    return basename(this.#path);
  }

  get path(): string {
    return this.#path;
  }
}

class DenoFileSystemDirectoryHandle extends DenoBaseFileSystemHandle
  implements FileSystemDirectoryHandle {
  constructor(path: string) {
    super(path);
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<
    [string, FileSystemHandle]
  > {
    return this.entries();
  }

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for await (const entry of this.values()) {
      yield [entry.name, entry];
    }
  }

  getDirectory(
    name: string,
    options?: FileSystemGetDirectoryOptions | undefined,
  ): Promise<FileSystemDirectoryHandle> {
    return this.getDirectoryHandle(name, options);
  }

  async getDirectoryHandle(
    name: string,
    { create = false }: FileSystemGetDirectoryOptions = {},
  ): Promise<FileSystemDirectoryHandle> {
    const path = join(this.path, name);
    try {
      const fileInfo = await Deno.stat(path);
      if (fileInfo.isDirectory) {
        return new DenoFileSystemDirectoryHandle(path);
      } else {
        throw new Error(`Path is not a directory: ${path}`);
      }
    } catch (err) {
      if (create && err instanceof Deno.errors.NotFound) {
        await Deno.mkdir(path);
        return new DenoFileSystemDirectoryHandle(path);
      } else {
        throw err;
      }
    }
  }

  getEntries(): AsyncIterableIterator<FileSystemHandle> {
    return this.values();
  }

  getFile(
    name: string,
    options?: FileSystemGetFileOptions | undefined,
  ): Promise<FileSystemFileHandle> {
    return this.getFileHandle(name, options);
  }

  async getFileHandle(
    name: string,
    { create = false }: FileSystemGetFileOptions = {},
  ): Promise<FileSystemFileHandle> {
    const path = join(this.path, name);
    try {
      const fileInfo = await Deno.stat(path);
      if (fileInfo.isFile) {
        return new DenoFileSystemFileHandle(path);
      } else {
        throw new Error(`Path is not a file: ${path}`);
      }
    } catch (err) {
      if (create && err instanceof Deno.errors.NotFound) {
        const file = await Deno.create(path);
        file.close();
        return new DenoFileSystemFileHandle(path);
      } else {
        throw err;
      }
    }
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    const isSame = other instanceof DenoFileSystemDirectoryHandle &&
      other.path === this.path;
    return Promise.resolve(isSame);
  }

  async *keys(): AsyncIterableIterator<string> {
    for await (const entry of Deno.readDir(this.path)) {
      yield entry.name;
    }
  }

  get kind(): "directory" {
    return "directory";
  }

  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }

  async removeEntry(
    name: string,
    { recursive = false }: FileSystemRemoveOptions = {},
  ): Promise<void> {
    const path = join(this.path, name);
    await Deno.remove(path, { recursive });
  }

  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }

  resolve(
    possibleDescendant: FileSystemHandle,
  ): Promise<string[] | null> {
    if (
      (possibleDescendant instanceof DenoFileSystemDirectoryHandle ||
        possibleDescendant instanceof DenoFileSystemFileHandle) &&
      possibleDescendant.path.startsWith(this.path)
    ) {
      const startIndex = this.path.endsWith(sep)
        ? this.path.length + 1
        : this.path.length;
      const sub = possibleDescendant.path.substring(startIndex);
      const parts = sub.split(sep);
      return Promise.resolve(parts);
    }
    return Promise.resolve(null);
  }

  async *values(): AsyncIterableIterator<FileSystemHandle> {
    for await (const entry of Deno.readDir(this.path)) {
      const path = join(this.path, entry.name);
      if (entry.isDirectory) {
        yield new DenoFileSystemDirectoryHandle(path);
      } else if (entry.isFile) {
        yield new DenoFileSystemFileHandle(path);
      } else if (entry.isSymlink) {
        const fileInfo = await Deno.stat(path);
        if (fileInfo.isDirectory) {
          yield new DenoFileSystemDirectoryHandle(path);
        } else if (fileInfo.isFile) {
          yield new DenoFileSystemFileHandle(path);
        } else {
          throw new Error("Unexpected FileInfo type");
        }
      } else {
        throw new Error("Unexpected DirEntry type");
      }
    }
  }
}

class DenoFileSystemFileHandle extends DenoBaseFileSystemHandle
  implements FileSystemFileHandle {
  constructor(path: string) {
    super(path);
  }

  async createWritable(
    { keepExistingData = false }: FileSystemCreateWritableOptions = {},
  ): Promise<FileSystemWritableFileStream> {
    const file = await Deno.open(this.path, {
      append: keepExistingData,
      truncate: !keepExistingData,
      write: true,
    });
    const sink = new DenoFileWriterSink(file);
    return new DenoFileSystemWritableFileStream(sink);
  }

  async getFile(): Promise<File> {
    const { mtime } = await Deno.stat(this.path);
    const content = await Deno.readFile(this.path);
    return new File([content], this.name, { lastModified: mtime?.getTime() });
  }

  isSameEntry(other: FileSystemHandle): Promise<boolean> {
    const isSame = other instanceof DenoFileSystemFileHandle &&
      other.path === this.path;
    return Promise.resolve(isSame);
  }

  get kind(): "file" {
    return "file";
  }

  queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }

  requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }
}

class DenoFileSystemWritableFileStream extends WritableStream<BlobPart>
  implements FileSystemWritableFileStream {
  readonly #sink: DenoFileWriterSink;

  constructor(sink: DenoFileWriterSink) {
    super(sink);
    this.#sink = sink;
  }

  async seek(position: number): Promise<void> {
    await this.#sink.file.seek(position, Deno.SeekMode.Start);
  }

  async truncate(size: number): Promise<void> {
    await this.seek(0);
    const bytes = new Uint8Array(size);
    await this.#sink.file.write(bytes);
  }

  async write(data: FileSystemWriteChunkType): Promise<void> {
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

class DenoFileWriterSink implements UnderlyingSink<BlobPart> {
  readonly #file: Deno.File;

  constructor(file: Deno.File) {
    this.#file = file;
  }

  abort(reason: unknown): void {
    this.#file.close();
  }

  close(): void {
    this.#file.close();
  }

  get file(): Deno.File {
    return this.#file;
  }

  async write(
    chunk: BlobPart,
    controller: WritableStreamDefaultController,
  ): Promise<void> {
    if (chunk instanceof Blob) {
      const buffer = await chunk.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      await this.#file.write(bytes);
    } else if (chunk instanceof ArrayBuffer) {
      const bytes = new Uint8Array(chunk);
      await this.#file.write(bytes);
    } else if (ArrayBuffer.isView(chunk)) {
      const bytes = new Uint8Array(
        chunk.buffer,
        chunk.byteOffset,
        chunk.byteLength,
      );
      await this.#file.write(bytes);
    } else if (typeof chunk === "string") {
      const encoder = new TextEncoder();
      const bytes = encoder.encode(chunk);
      await this.#file.write(bytes);
    } else {
      throw new Error(`Invalid chunk value: ${typeof chunk}`);
    }
  }
}

export async function getHandle(
  path: string,
  kind: "file",
): Promise<FileSystemFileHandle>;
export async function getHandle(
  path: string,
  kind: "directory",
): Promise<FileSystemDirectoryHandle>;
export async function getHandle(
  path: string,
): Promise<FileSystemHandle>;
export async function getHandle(
  path: string,
  kind?: FileSystemHandleKind,
): Promise<FileSystemHandle> {
  const fileInfo = await Deno.stat(path);
  if (fileInfo.isDirectory && kind !== "file") {
    return new DenoFileSystemDirectoryHandle(path);
  } else if (fileInfo.isFile && kind !== "directory") {
    return new DenoFileSystemFileHandle(path);
  } else {
    throw new Error(`Invalid FileInfo response`);
  }
}
