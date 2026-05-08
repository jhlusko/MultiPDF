import { getPdfBlob } from './services/sessionStore';
import { createChannel } from './services/syncService';
import { pageForRole } from './services/spreadService';
import type { ReadingState } from './types/state';

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session');
const role = params.get('role') as 'left' | 'right' | null;
if (!sessionId || !role) throw new Error('Missing session or role');

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const blank = document.querySelector<HTMLDivElement>('#blank')!;
const pageLabel = document.querySelector<HTMLSpanElement>('#pageLabel')!;
const roleBadge = document.querySelector<HTMLSpanElement>('#roleBadge')!;
roleBadge.textContent = role.toUpperCase();

const sourceWindowId = crypto.randomUUID();
const channel = createChannel(sessionId);
let state: ReadingState | null = null;
let pdfDoc: any;

async function ensureDoc() {
  if (pdfDoc) return pdfDoc;
  const blob = await getPdfBlob(sessionId);
  const buffer = await blob.arrayBuffer();
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs');
  const task = pdfjs.getDocument({ data: buffer });
  pdfDoc = await task.promise;
  return pdfDoc;
}

async function render() {
  if (!state) return;
  const pageNumber = pageForRole(state.spreadIndex, role, state.spreadMode);
  if (!pageNumber || pageNumber < 1 || pageNumber > state.pageCount) {
    canvas.classList.add('hidden');
    blank.classList.remove('hidden');
    pageLabel.textContent = 'Blank';
    return;
  }
  blank.classList.add('hidden');
  canvas.classList.remove('hidden');
  pageLabel.textContent = `Page ${pageNumber}`;

  const doc = await ensureDoc();
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(window.innerWidth / viewport.width, window.innerHeight / viewport.height);
  const fitted = page.getViewport({ scale });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(fitted.width * dpr);
  canvas.height = Math.floor(fitted.height * dpr);
  canvas.style.width = `${Math.floor(fitted.width)}px`;
  canvas.style.height = `${Math.floor(fitted.height)}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvasContext: ctx, viewport: fitted }).promise;
}

channel.onmessage = (event) => {
  const msg = event.data;
  if (msg?.sourceWindowId === sourceWindowId) return;
  if (msg?.type === 'STATE_UPDATE') {
    state = msg.state;
    render();
  }
};

window.addEventListener('keydown', (event) => {
  if (!state) return;
  if (event.key === 'ArrowRight') {
    channel.postMessage({ type: 'STATE_UPDATE', sourceWindowId, state: { ...state, spreadIndex: state.spreadIndex + 1, updatedAt: Date.now() } });
  }
  if (event.key === 'ArrowLeft') {
    channel.postMessage({ type: 'STATE_UPDATE', sourceWindowId, state: { ...state, spreadIndex: Math.max(0, state.spreadIndex - 1), updatedAt: Date.now() } });
  }
});

window.addEventListener('resize', () => void render());
channel.postMessage({ type: 'STATE_REQUEST', sourceWindowId });
