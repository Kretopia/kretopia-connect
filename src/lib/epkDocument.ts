import { PDFDocument, degrees } from "pdf-lib";

export interface EPKPageEdit { index: number; rotation: number }

/** Copy original PDF pages without rasterizing or recreating their content. */
export async function editEPKDocument(source: Uint8Array, pages: EPKPageEdit[]): Promise<Uint8Array> {
  if (!pages.length) throw new Error("Keep at least one page in your EPK.");
  const original = await PDFDocument.load(source);
  const result = await PDFDocument.create();
  for (const edit of pages) {
    if (!Number.isInteger(edit.index) || edit.index < 0 || edit.index >= original.getPageCount()) throw new Error("Invalid PDF page.");
    const [page] = await result.copyPages(original, [edit.index]);
    page.setRotation(degrees((page.getRotation().angle + edit.rotation) % 360));
    result.addPage(page);
  }
  return result.save();
}

export function epkPassportPath(userId: string): string {
  return `${userId}/epk/passport.pdf`;
}

const DB_NAME = "kretopia-epk-drafts";
function draftDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drafts");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Draft storage is unavailable on this browser."));
  });
}

export interface EPKStoredDraft { name: string; file: Blob; editor: string; savedAt: number }
export async function epkDraftStorage(userId: string, action: "read" | "save" | "delete", draft?: EPKStoredDraft): Promise<EPKStoredDraft | undefined> {
  const db = await draftDB();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction("drafts", action === "read" ? "readonly" : "readwrite");
      const store = transaction.objectStore("drafts");
      const request = action === "read" ? store.get(userId) : action === "delete" ? store.delete(userId) : store.put(draft, userId);
      transaction.oncomplete = () => resolve(action === "read" ? request.result : draft);
      transaction.onerror = () => reject(new Error("Could not save your draft. Check available browser storage."));
    });
  } finally { db.close(); }
}