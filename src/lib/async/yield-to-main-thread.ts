/** 描画・タップ処理へ制御を返す（重い同期処理の合間用） */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      setTimeout(resolve, 0);
    });
  });
}
