import type { SpreadMode } from '../types/state';

export function pageForRole(
  spreadIndex: number,
  role: 'left' | 'right',
  mode: SpreadMode,
  pageOffset = 0
): number | null {
  let pageNumber: number | null;
  if (mode === 'cover') {
    if (spreadIndex === 0) pageNumber = role === 'right' ? 1 : null;
    else pageNumber = role === 'left' ? spreadIndex * 2 : spreadIndex * 2 + 1;
  } else {
    pageNumber = role === 'left' ? spreadIndex * 2 + 1 : spreadIndex * 2 + 2;
  }

  return pageNumber === null ? null : pageNumber + pageOffset;
}

export function maxSpread(pageCount: number, mode: SpreadMode, pageOffset = 0) {
  const searchLimit = pageCount + Math.abs(pageOffset) + 2;
  let lastValidSpread = 0;

  for (let spreadIndex = 0; spreadIndex <= searchLimit; spreadIndex += 1) {
    const left = pageForRole(spreadIndex, 'left', mode, pageOffset);
    const right = pageForRole(spreadIndex, 'right', mode, pageOffset);
    const hasVisiblePage = [left, right].some((page) => page !== null && page >= 1 && page <= pageCount);
    if (hasVisiblePage) lastValidSpread = spreadIndex;
  }

  return lastValidSpread;
}
