import { getPdfBlob } from './services/sessionStore';
import { createChannel } from './services/syncService';
import { loadPdfFromBuffer } from './services/pdfService';
import { maxSpread, pageForRole } from './services/spreadService';
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
let renderTask: any;
let renderToken = 0;

async function ensureDoc() {
  if (pdfDoc) return pdfDoc;
  const blob = await getPdfBlob(sessionId);
  const buffer = await blob.arrayBuffer();
  pdfDoc = await loadPdfFromBuffer(buffer);
  return pdfDoc;
}

async function render() {
  if (!state) return;
  const token = ++renderToken;
  const pageNumber = pageForRole(state.spreadIndex, role, state.spreadMode, state.pageOffset);
  if (!pageNumber || pageNumber < 1 || pageNumber > state.pageCount) {
    renderTask?.cancel();
    canvas.classList.add('hidden');
    blank.classList.remove('hidden');
    pageLabel.textContent = 'Blank';
    return;
  }
  blank.classList.add('hidden');
  canvas.classList.remove('hidden');
  pageLabel.textContent = `Page ${pageNumber}`;

  const doc = await ensureDoc();
  if (token !== renderToken) return;
  const page = await doc.getPage(pageNumber);
  if (token !== renderToken) return;
  const viewport = page.getViewport({ scale: 1 });
  const fitScale = Math.min(window.innerWidth / viewport.width, window.innerHeight / viewport.height);
  const fitted = page.getViewport({ scale: fitScale * state.zoom, rotation: state.rotation });

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(fitted.width * dpr);
  canvas.height = Math.floor(fitted.height * dpr);
  canvas.style.width = `${Math.floor(fitted.width)}px`;
  canvas.style.height = `${Math.floor(fitted.height)}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderTask?.cancel();
  renderTask = page.render({ canvasContext: ctx, viewport: fitted });
  try {
    await renderTask.promise;
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') throw error;
  }
}

function navigate(delta: number) {
  if (!state) return;
  const lastSpread = maxSpread(state.pageCount, state.spreadMode, state.pageOffset);
  const spreadIndex = Math.min(Math.max(0, state.spreadIndex + delta), lastSpread);
  if (spreadIndex === state.spreadIndex) return;

  state = { ...state, spreadIndex, updatedAt: Date.now() };
  channel.postMessage({ type: 'STATE_UPDATE', sourceWindowId, state });
  void render();
}

channel.onmessage = (event) => {
  const msg = event.data;
  if (msg?.sourceWindowId === sourceWindowId) return;
  if (msg?.type === 'STATE_UPDATE') {
    state = msg.state;
    void render();
  }
};

window.addEventListener('keydown', (event) => {
  if (!state) return;
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    navigate(1);
  }
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    navigate(-1);
  }
});

window.addEventListener('resize', () => void render());
channel.postMessage({ type: 'STATE_REQUEST', sourceWindowId });
