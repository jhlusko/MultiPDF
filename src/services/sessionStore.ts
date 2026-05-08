const DB_NAME = 'dual-pdf-reader';
const DB_VERSION = 1;
const BLOBS = 'pdfBlobs';
const SESSIONS = 'sessions';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOBS)) db.createObjectStore(BLOBS, { keyPath: 'sessionId' });
      if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function createSession(file: File, pageCount: number) {
  const sessionId = crypto.randomUUID();
  const db = await openDb();
  await Promise.all([
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(BLOBS, 'readwrite');
      tx.objectStore(BLOBS).put({ sessionId, blob: file, fileName: file.name, createdAt: Date.now() });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    }),
    new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SESSIONS, 'readwrite');
      tx.objectStore(SESSIONS).put({ id: sessionId, fileName: file.name, pageCount, createdAt: Date.now() });
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    })
  ]);
  return { sessionId, pageCount };
}

export async function getPdfBlob(sessionId: string): Promise<Blob> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOBS, 'readonly');
    const req = tx.objectStore(BLOBS).get(sessionId);
    req.onsuccess = () => req.result ? resolve(req.result.blob) : reject(new Error('Session not found'));
    req.onerror = () => reject(req.error);
  });
}
