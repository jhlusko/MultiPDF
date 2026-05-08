export type SpreadMode = 'cover' | 'no-cover';

export interface ReadingState {
  sessionId: string;
  pageCount: number;
  spreadIndex: number;
  spreadMode: SpreadMode;
  pageOffset: number;
  zoom: number;
  rotation: number;
  updatedAt: number;
}
