export type CancelMatchingInput = {
  userId?: string | null;
};

export interface CancelMatchingUseCase {
  execute(input: CancelMatchingInput): Promise<void>;
}
