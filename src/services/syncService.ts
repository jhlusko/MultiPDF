import type { ReadingState } from '../types/state';

export function createChannel(sessionId: string) {
  return new BroadcastChannel(`dual-pdf-reader:${sessionId}`);
}

export function postState(channel: BroadcastChannel, sourceWindowId: string, state: ReadingState) {
  channel.postMessage({ type: 'STATE_UPDATE', sourceWindowId, state });
}
