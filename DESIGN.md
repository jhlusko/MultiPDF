# Design doc: Dual-window PDF reader web app for Zenbook Duo

## 1. Problem

Current PDF readers usually implement “two-page” or “book-facing” mode inside a **single window**. On a dual-screen laptop such as a Zenbook Duo, stretching one window across both displays is clumsy.

The better model is:

> One PDF document, two synchronized browser windows, one page per display.

The left/lower screen gets one page. The right/upper screen gets the facing page. Page turns, zoom, fit mode, rotation, and document position remain synchronized.

## 2. Goals

### Primary goals

1. Open a PDF from local disk.
2. Render with PDF.js.
3. Open two windows for one document.
4. Assign left/right page roles.
5. Synchronize navigation.
6. Support cover mode, no-cover mode, and configurable offset.
7. Support manual placement with optional semi-automatic placement.
8. Keep processing local-first (no upload).

### Secondary goals

- Keyboard shortcuts
- Touch gestures
- Persistent reading position
- Fullscreen/kiosk mode
- Thumbnails, TOC, search, bookmarks
- Annotations later (not v1)

### Non-goals (v1)

No PDF editing, OCR, cloud sync, DRM support, or collaboration.

## 3. Product concept

### Core flow

1. User opens local app (`localhost:5173` or static files).
2. User loads a PDF.
3. Controller window opens two viewer windows:
   - `viewer.html?session=<id>&role=left`
   - `viewer.html?session=<id>&role=right`
4. User places windows on two screens.
5. App starts synchronized book mode.

## 4. Architecture

Use a **controller + two viewer windows** model.

- Controller owns session + settings.
- Viewers render a single page each.
- State sync via `BroadcastChannel`.
- PDF/session persistence via IndexedDB.

## 5. Tech choices

- Vite + TypeScript
- PDF.js
- IndexedDB
- BroadcastChannel
- Optional: File System Access API
- Optional: Window Management API (progressive enhancement)

## 6. Core services

1. **pdfDocumentService**: load/store PDF session.
2. **pdfRenderService**: render single page with scale/rotation and render cancelation.
3. **spreadService**: map spread index + role => page number.
4. **syncService**: window messaging, loop prevention, last-writer-wins.
5. **windowService**: open/manual placement; optional automatic placement.
6. **settingsStore**: persist per-document state.

## 7. Page mapping modes

- **Cover mode**:
  - Spread 0: left blank, right 1
  - Spread 1: left 2, right 3
- **No-cover mode**:
  - Spread 0: left 1, right 2
- **Custom offset**:
  - Adjustable by integer offset for troublesome scans.

Out-of-range pages render as blank.

## 8. Sync protocol

Channel name: `dual-pdf-reader:${sessionId}`.

Include message types like:
- `HELLO`
- `STATE_REQUEST`
- `STATE_UPDATE`
- `NAV_TO_SPREAD`
- `ZOOM_SET`
- `ROTATION_SET`

Each message includes `sourceWindowId`; receivers ignore self-originated messages.

## 9. UI summary

### Controller

- Open PDF
- Open dual-window mode
- Optional auto-placement
- Spread mode/offset controls
- Prev/next spread, zoom, fit mode, rotation
- Connection status for left/right windows

### Viewer

- Single-page canvas
- Minimal overlay controls
- Role indicator (LEFT/RIGHT)
- Fullscreen reading mode

## 10. MVP scope

- Open PDF
- Store session in IndexedDB
- Open 2 viewer windows
- Render one page/window
- BroadcastChannel navigation sync
- Cover + no-cover modes
- Fit page

## 11. Staged roadmap

1. Single-window rendering baseline
2. Dual windows + shared document session
3. Synced navigation
4. Book-facing modes + offset
5. Usability polish
6. Optional automatic display placement

## 12. Risks and mitigations

- Popup blockers: open windows directly from user gesture.
- Placement variability: manual placement is baseline.
- Child access to PDF: store blob in IndexedDB before window open.
- Sync races: source IDs + timestamps + idempotent handlers.
- Performance: cancel stale renders, cap effective DPR.
- Pairing confusion: visible pairing preview and shift controls.

## 13. Recommendation

Build a local-first PDF.js web app first:

> Two independent single-page viewer windows, synchronized through BroadcastChannel, backed by IndexedDB sessions, with manual display placement first and optional Window Management API enhancements later.
