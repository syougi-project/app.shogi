export type ActiveDeckSummaryPlacement = {
  rowNo: number;
  colNo: number;
  pieceId: number;
  char: string;
  name: string;
};

export type ActiveDeckSummary = {
  deckId: number | null;
  name: string | null;
  placements: ActiveDeckSummaryPlacement[];
};

export interface LoadActiveDeckSummaryUseCase {
  execute(): Promise<ActiveDeckSummary>;
}
