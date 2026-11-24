export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

export function getBaseName(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx > 0 ? filename.slice(0, idx) : filename;
}

export async function computeFileHash(file: File): Promise<string> {
  const slice = await file.slice(0, 1024 * 1024).arrayBuffer();
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", slice);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export async function readDroppedItems(dataTransfer: DataTransfer): Promise<{
  files: File[];
  folderName: string | null;
  hasFolder: boolean;
}> {
  const files: File[] = [];
  let folderName: string | null = null;
  let hasFolder = false;

  const readDirectory = (dir: FileSystemDirectoryEntry): Promise<File[]> =>
    new Promise((resolve) => {
      const reader = dir.createReader();
      const collected: File[] = [];
      const nextBatch = () => {
        reader.readEntries(async (entries) => {
          if (!entries.length) {
            resolve(collected);
            return;
          }
          for (const ent of entries) {
            if (ent.isFile) {
              const file = await new Promise<File>((res) => (ent as FileSystemFileEntry).file(res));
              collected.push(file);
            } else if (ent.isDirectory) {
              const nested = await readDirectory(ent as FileSystemDirectoryEntry);
              collected.push(...nested);
            }
          }
          nextBatch();
        });
      };
      nextBatch();
    });

  if (dataTransfer.items && dataTransfer.items.length > 0) {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < dataTransfer.items.length; i++) {
      const ent = dataTransfer.items[i].webkitGetAsEntry?.();
      if (ent) entries.push(ent);
    }
    if (entries.length > 0) {
      for (const ent of entries) {
        if (ent.isDirectory) {
          hasFolder = true;
          if (!folderName) folderName = ent.name;
          const nested = await readDirectory(ent as FileSystemDirectoryEntry);
          files.push(...nested);
        } else if (ent.isFile) {
          const f = await new Promise<File>((res) => (ent as FileSystemFileEntry).file(res));
          files.push(f);
        }
      }
      return { files, folderName, hasFolder };
    }
  }

  return { files: Array.from(dataTransfer.files), folderName: null, hasFolder: false };
}
