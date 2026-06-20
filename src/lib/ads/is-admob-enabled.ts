/** EAS / Dev Client ビルドでのみ true。Expo Go 開発では false。 */
export function isAdMobEnabled(): boolean {
  return process.env.EXPO_PUBLIC_ENABLE_ADMOB === 'true';
}
