export type SpreadMode = 'cover' | 'no-cover';

export interface ReadingState {
  sessionId: string;
  pageCount: number;
  spreadIndex: number;
  spreadMode: SpreadMode;
  updatedAt: number;
}
