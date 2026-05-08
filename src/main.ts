import { createSession } from './services/sessionStore';
import { createChannel, postState } from './services/syncService';
import { maxSpread } from './services/spreadService';
import type { ReadingState, SpreadMode } from './types/state';

const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!;
const openDual = document.querySelector<HTMLButtonElement>('#openDual')!;
const prevBtn = document.querySelector<HTMLButtonElement>('#prev')!;
const nextBtn = document.querySelector<HTMLButtonElement>('#next')!;
const spreadMode = document.querySelector<HTMLSelectElement>('#spreadMode')!;
const status = document.querySelector<HTMLPreElement>('#status')!;

let state: ReadingState | null = null;
let channel: BroadcastChannel | null = null;
const sourceWindowId = crypto.randomUUID();

function attachChannelHandlers(ch: BroadcastChannel) {
  ch.onmessage = (event) => {
    const msg = event.data;
    if (!state || msg?.sourceWindowId === sourceWindowId) return;
    if (msg?.type === 'STATE_REQUEST') {
      broadcast();
      return;
    }
    if (msg?.type === 'STATE_UPDATE' && msg.state?.updatedAt > state.updatedAt) {
      state = msg.state;
      renderStatus();
    }
  };
}

async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs');
  const data = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data });
  const doc = await task.promise;
  return doc.numPages;
}

function renderStatus() {
  status.textContent = state ? JSON.stringify(state, null, 2) : 'Load a PDF to start.';
}

function updateButtons() {
  const ready = Boolean(state);
  openDual.disabled = !ready;
  prevBtn.disabled = !ready;
  nextBtn.disabled = !ready;
}

function broadcast() {
  if (state && channel) postState(channel, sourceWindowId, state);
  renderStatus();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const pageCount = await getPdfPageCount(file);
  const { sessionId } = await createSession(file, pageCount);
  state = { sessionId, pageCount, spreadIndex: 0, spreadMode: 'cover', updatedAt: Date.now() };
  channel?.close();
  channel = createChannel(sessionId);
  attachChannelHandlers(channel);
  updateButtons();
  broadcast();
});

openDual.addEventListener('click', () => {
  if (!state) return;
  window.open(`/viewer.html?session=${state.sessionId}&role=left`, 'dual-left', 'popup,width=900,height=1200');
  window.open(`/viewer.html?session=${state.sessionId}&role=right`, 'dual-right', 'popup,width=900,height=1200');
  broadcast();
});

spreadMode.addEventListener('change', () => {
  if (!state) return;
  state.spreadMode = spreadMode.value as SpreadMode;
  state.updatedAt = Date.now();
  broadcast();
});

nextBtn.addEventListener('click', () => {
  if (!state) return;
  state.spreadIndex = Math.min(state.spreadIndex + 1, maxSpread(state.pageCount, state.spreadMode));
  state.updatedAt = Date.now();
  broadcast();
});

prevBtn.addEventListener('click', () => {
  if (!state) return;
  state.spreadIndex = Math.max(0, state.spreadIndex - 1);
  state.updatedAt = Date.now();
  broadcast();
});

renderStatus();
updateButtons();
