import type { SpreadMode } from '../types/state';

export function pageForRole(spreadIndex: number, role: 'left' | 'right', mode: SpreadMode): number | null {
  if (mode === 'cover') {
    if (spreadIndex === 0) return role === 'right' ? 1 : null;
    return role === 'left' ? spreadIndex * 2 : spreadIndex * 2 + 1;
  }
  return role === 'left' ? spreadIndex * 2 + 1 : spreadIndex * 2 + 2;
}

export function maxSpread(pageCount: number, mode: SpreadMode) {
  return mode === 'cover' ? Math.ceil(pageCount / 2) : Math.ceil(pageCount / 2) - 1;
}
