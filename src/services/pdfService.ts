import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function loadPdfFromBuffer(data: ArrayBuffer) {
  const task = pdfjs.getDocument({ data });
  return task.promise;
}

export async function getPdfPageCountFromFile(file: File): Promise<number> {
  const data = await file.arrayBuffer();
  const doc = await loadPdfFromBuffer(data);
  return doc.numPages;
}
