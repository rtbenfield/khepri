/// <reference path="../types/wicg-file-system-access.d.ts" />
import {
  basename,
  join,
  resolve,
  sep,
} from "https://deno.land/std@0.91.0/path/mod.ts";

// TODO: This file needs to be audited for spec-compliance and then migrated into its own project outside of Khepri.
// Right now it is close enough to serve Khepri's needs so I am running with it.

abstract class DenoBaseFileSystemHandle {
  readonly #path: string;

  protected constructor(path: string) {
    this.#path = resolve(path);
  }

  public get isDirectory() {
    return true as this["kind"] extends "directory" ? true : false;
  }

  public get isFile() {
    return false as this["kind"] extends "file" ? true : false;
  }

  public abstract get kind(): FileSystemHandleKind;

  public get name(): string {
    return basename(this.#path);
  }

  public get path(): string {
    return this.#path;
  }
}

class DenoFileSystemDirectoryHandle extends DenoBaseFileSystemHandle
  implements FileSystemDirectoryHandle {
  public constructor(path: string) {
    super(path);
  }

  public [Symbol.asyncIterator](): AsyncIterableIterator<
    [string, FileSystemHandle]
  > {
    return this.entries();
  }

  public async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for await (const entry of this.values()) {
      yield [entry.name, entry];
    }
  }

  public getDirectory(
    name: string,
    options?: FileSystemGetDirectoryOptions | undefined,
  ): Promise<FileSystemDirectoryHandle> {
    return this.getDirectoryHandle(name, options);
  }

  public async getDirectoryHandle(
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

  public getEntries(): AsyncIterableIterator<FileSystemHandle> {
    return this.values();
  }

  public getFile(
    name: string,
    options?: FileSystemGetFileOptions | undefined,
  ): Promise<FileSystemFileHandle> {
    return this.getFileHandle(name, options);
  }

  public async getFileHandle(
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

  public isSameEntry(other: FileSystemHandle): Promise<boolean> {
    const isSame = other instanceof DenoFileSystemDirectoryHandle &&
      other.path === this.path;
    return Promise.resolve(isSame);
  }

  public async *keys(): AsyncIterableIterator<string> {
    for await (const entry of Deno.readDir(this.path)) {
      yield entry.name;
    }
  }

  public get kind(): "directory" {
    return "directory";
  }

  public queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }

  public async removeEntry(
    name: string,
    { recursive = false }: FileSystemRemoveOptions = {},
  ): Promise<void> {
    const path = join(this.path, name);
    await Deno.remove(path, { recursive });
  }

  public requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }

  public resolve(
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

  public async *values(): AsyncIterableIterator<FileSystemHandle> {
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
  public constructor(path: string) {
    super(path);
  }

  public async createWritable(
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

  public async getFile(): Promise<File> {
    const { mtime } = await Deno.stat(this.path);
    const content = await Deno.readFile(this.path);
    return new File([content], this.name, { lastModified: mtime?.getTime() });
  }

  public isSameEntry(other: FileSystemHandle): Promise<boolean> {
    const isSame = other instanceof DenoFileSystemFileHandle &&
      other.path === this.path;
    return Promise.resolve(isSame);
  }

  public get kind(): "file" {
    return "file";
  }

  public queryPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }

  public requestPermission(
    descriptor?: FileSystemHandlePermissionDescriptor,
  ): Promise<"denied" | "granted" | "prompt"> {
    return Promise.resolve("granted");
  }
}

class DenoFileSystemWritableFileStream extends WritableStream<BlobPart>
  implements FileSystemWritableFileStream {
  readonly #sink: DenoFileWriterSink;

  public constructor(sink: DenoFileWriterSink) {
    super(sink);
    this.#sink = sink;
  }

  public async seek(position: number): Promise<void> {
    await this.#sink.file.seek(position, Deno.SeekMode.Start);
  }

  public async truncate(size: number): Promise<void> {
    await this.seek(0);
    const bytes = new Uint8Array(size);
    await this.#sink.file.write(bytes);
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

class DenoFileWriterSink implements UnderlyingSink<BlobPart> {
  readonly #file: Deno.File;

  public constructor(file: Deno.File) {
    this.#file = file;
  }

  public abort(reason: unknown): void {
    this.#file.close();
  }

  public close(): void {
    this.#file.close();
  }

  public get file(): Deno.File {
    return this.#file;
  }

  public async write(
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
