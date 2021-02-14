async function getDb(): Promise<IDBDatabase> {
  return await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("settings", 1);
    request.addEventListener("error", () => reject(request.error));
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("upgradeneeded", () => {
      request.result.createObjectStore("settings");
      request.result.createObjectStore("recents", { autoIncrement: true });
    });
  });
}

class Settings {
  public async addRecent(
    ...directories: readonly FileSystemDirectoryHandle[]
  ): Promise<void> {
    const db = await getDb();
    const store = db.transaction("recents", "readwrite").objectStore("recents");
    const requests = directories.map((directory) => {
      new Promise<void>((resolve, reject) => {
        const request = store.put(directory);
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => resolve());
      });
    });
    await Promise.all(requests);
  }

  public async getRecents(): Promise<readonly FileSystemDirectoryHandle[]> {
    const db = await getDb();
    const store = db.transaction("recents", "readonly").objectStore("recents");
    return new Promise<FileSystemDirectoryHandle[]>((resolve, reject) => {
      const request = store.getAll();
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => resolve(request.result ?? []));
    });
  }
}

export const settings = new Settings();
