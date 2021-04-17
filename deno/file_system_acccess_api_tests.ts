import {
  assert,
  assertEquals,
  assertThrowsAsync,
} from "https://deno.land/std@0.93.0/testing/asserts.ts";
import { dirname, fromFileUrl } from "https://deno.land/std@0.93.0/path/mod.ts";
import { getHandle } from "./file_system_access_api.ts";

const __filename = fromFileUrl(import.meta.url);
const __dirname = dirname(__filename);

Deno.test("open directory, write file, delete file", async () => {
  const tempDir = await Deno.makeTempDir();
  try {
    const directoryHandle = await getHandle(tempDir);
    assert(directoryHandle.kind === "directory");

    assertThrowsAsync(async () => {
      await directoryHandle.getFileHandle("test.txt");
    });
    assertThrowsAsync(async () => {
      await directoryHandle.getFileHandle("test.txt", { create: false });
    });
    const fileHandle = await directoryHandle.getFileHandle(
      "test.txt",
      { create: true },
    );
    assertEquals(fileHandle.kind, "file");
    assertEquals(fileHandle.name, "test.txt");

    const before = await fileHandle.getFile();
    assertEquals(before.name, fileHandle.name);
    assertEquals(await before.text(), "");

    const writeable = await fileHandle.createWritable();
    await writeable.write("hello");
    await writeable.write(" ");
    await writeable.write("world");
    await writeable.close();

    const after = await fileHandle.getFile();
    assertEquals(await after.text(), "hello world");

    const truncate = await fileHandle.createWritable();
    await truncate.truncate(0);
    await truncate.close();

    await directoryHandle.removeEntry(fileHandle.name);
    assertThrowsAsync(async () => {
      await directoryHandle.getFileHandle(fileHandle.name);
    });
  } finally {
    await Deno.remove(tempDir, { recursive: true });
  }
});

Deno.test("directory isSameEntry", async () => {
  const handle1 = await getHandle(__dirname);
  const handle2 = await getHandle(__dirname);
  assert(handle1.isSameEntry(handle2));
  assert(handle2.isSameEntry(handle1));
});

Deno.test("directory resolve", async () => {
  const directory = await getHandle(__dirname);
  const file = await getHandle(__filename);
  assert(directory.kind === "directory");
  assert(file.kind === "file");

  const resolvedParts = await directory.resolve(file);
  assert(Array.isArray(resolvedParts));
  assertEquals(resolvedParts, [...resolvedParts]);

  const temp = await Deno.makeTempFile();
  try {
    const tempFile = await getHandle(temp);
    const notResolved = await directory.resolve(tempFile);
    assertEquals(notResolved, null);
  } finally {
    await Deno.remove(temp);
  }
});

Deno.test("file isSameEntry", async () => {
  const handle1 = await getHandle(__filename);
  const handle2 = await getHandle(__filename);
  assert(handle1.isSameEntry(handle2));
  assert(handle2.isSameEntry(handle1));
});
