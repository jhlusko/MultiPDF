import { createSession } from './services/sessionStore';
import { createChannel, postState } from './services/syncService';
import { getPdfPageCountFromFile } from './services/pdfService';
import { maxSpread } from './services/spreadService';
import type { ReadingState, SpreadMode } from './types/state';

const fileInput = document.querySelector<HTMLInputElement>('#fileInput')!;
const openDual = document.querySelector<HTMLButtonElement>('#openDual')!;
const openLeft = document.querySelector<HTMLButtonElement>('#openLeft')!;
const openRight = document.querySelector<HTMLButtonElement>('#openRight')!;
const prevBtn = document.querySelector<HTMLButtonElement>('#prev')!;
const nextBtn = document.querySelector<HTMLButtonElement>('#next')!;
const spreadMode = document.querySelector<HTMLSelectElement>('#spreadMode')!;
const pageOffset = document.querySelector<HTMLInputElement>('#pageOffset')!;
const zoom = document.querySelector<HTMLInputElement>('#zoom')!;
const rotation = document.querySelector<HTMLSelectElement>('#rotation')!;
const spreadLabel = document.querySelector<HTMLElement>('#spreadLabel')!;
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
      state = normalizeState(msg.state);
      syncControls();
      renderStatus();
    }
  };
}

function normalizeState(nextState: ReadingState): ReadingState {
  const safePageOffset = Number.isFinite(nextState.pageOffset) ? nextState.pageOffset : 0;
  const safeZoom = Number.isFinite(nextState.zoom) ? nextState.zoom : 1;
  const safeRotation = Number.isFinite(nextState.rotation) ? nextState.rotation : 0;
  const normalizedPageOffset = Math.min(Math.max(-20, safePageOffset), 20);
  const nextMaxSpread = maxSpread(nextState.pageCount, nextState.spreadMode, normalizedPageOffset);

  return {
    ...nextState,
    spreadIndex: Math.min(Math.max(0, nextState.spreadIndex), nextMaxSpread),
    pageOffset: normalizedPageOffset,
    zoom: Math.min(Math.max(0.5, safeZoom), 2.5),
    rotation: ((safeRotation % 360) + 360) % 360
  };
}

function updateState(patch: Partial<ReadingState>) {
  if (!state) return;
  state = normalizeState({ ...state, ...patch, updatedAt: Date.now() });
  broadcast();
}

function renderStatus() {
  if (!state) {
    status.textContent = 'Load a PDF to start. Files stay in this browser via IndexedDB.';
    spreadLabel.textContent = 'No PDF loaded';
    return;
  }

  const lastSpread = maxSpread(state.pageCount, state.spreadMode, state.pageOffset);
  spreadLabel.textContent = `Spread ${state.spreadIndex + 1} of ${lastSpread + 1}`;
  status.textContent = JSON.stringify(state, null, 2);
}

function updateButtons() {
  const ready = Boolean(state);
  openDual.disabled = !ready;
  openLeft.disabled = !ready;
  openRight.disabled = !ready;
  prevBtn.disabled = !ready;
  nextBtn.disabled = !ready;
}

function syncControls() {
  if (!state) return;
  spreadMode.value = state.spreadMode;
  pageOffset.value = String(state.pageOffset);
  zoom.value = String(state.zoom);
  rotation.value = String(state.rotation);
}

function broadcast() {
  if (state && channel) postState(channel, sourceWindowId, state);
  renderStatus();
}

function viewerUrl(role: 'left' | 'right') {
  if (!state) throw new Error('Cannot create viewer URL without state.');
  return `/viewer.html?session=${state.sessionId}&role=${role}`;
}

function openViewer(role: 'left' | 'right') {
  if (!state) return null;
  const width = 900;
  const height = 1200;
  const left = role === 'left' ? 0 : width;
  return window.open(viewerUrl(role), `dual-${role}`, `popup,width=${width},height=${height},left=${left},top=0`);
}

function openDualViewers() {
  if (!state) return;

  const leftWindow = window.open('', 'dual-left', 'popup,width=900,height=1200,left=0,top=0');
  const rightWindow = window.open('', 'dual-right', 'popup,width=900,height=1200,left=900,top=0');

  if (leftWindow) leftWindow.location.href = viewerUrl('left');
  if (rightWindow) rightWindow.location.href = viewerUrl('right');

  broadcast();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const pageCount = await getPdfPageCountFromFile(file);
  const { sessionId } = await createSession(file, pageCount);
  state = {
    sessionId,
    pageCount,
    spreadIndex: 0,
    spreadMode: 'cover',
    pageOffset: 0,
    zoom: 1,
    rotation: 0,
    updatedAt: Date.now()
  };
  channel?.close();
  channel = createChannel(sessionId);
  attachChannelHandlers(channel);
  syncControls();
  updateButtons();
  broadcast();
});

openDual.addEventListener('click', () => {
  openDualViewers();
});

openLeft.addEventListener('click', () => {
  openViewer('left');
  broadcast();
});

openRight.addEventListener('click', () => {
  openViewer('right');
  broadcast();
});

spreadMode.addEventListener('change', () => {
  updateState({ spreadMode: spreadMode.value as SpreadMode });
});

pageOffset.addEventListener('change', () => {
  updateState({ pageOffset: Number(pageOffset.value) || 0 });
});

zoom.addEventListener('input', () => {
  updateState({ zoom: Number(zoom.value) || 1 });
});

rotation.addEventListener('change', () => {
  updateState({ rotation: Number(rotation.value) || 0 });
});

nextBtn.addEventListener('click', () => {
  if (!state) return;
  updateState({ spreadIndex: state.spreadIndex + 1 });
});

prevBtn.addEventListener('click', () => {
  if (!state) return;
  updateState({ spreadIndex: state.spreadIndex - 1 });
});

renderStatus();
updateButtons();
