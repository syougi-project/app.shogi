# Shogi Mobile App Frontend

将棋モバイルアプリのフロントエンド（Expo + React Native + TypeScript）です。

## 動作環境
- Node.js 20 以上（推奨: 20/22 LTS）
- Bun（推奨）または npm
- Xcode / Android Studio（実機・エミュレータ利用時）

## Tech Stack
- Expo SDK 54
- React Native
- TypeScript
- Expo Router
- NativeWind

## セットアップ
```bash
# 依存関係インストール
bun install
# or
npm install
```

## 環境変数
`.env.example` をコピーして `.env` を作成してください。

```bash
cp .env.example .env
```

主な変数:
- `EXPO_PUBLIC_DATA_SOURCE`
  - `local` または `api`
  - `local`: ローカル固定データ（旧 `mock` も互換で同等動作）
- `EXPO_PUBLIC_API_BASE_URL`
  - API(BFF) のベースURL
  - 実機確認時は `http://<実機のIP>:3000` を使用
  - 例: `http://192.168.1.25:3000`

実機IPの確認:
- macOS: `ipconfig getifaddr en0`（取得できない場合: `ifconfig | grep "inet "`）
- Windows: `ipconfig`（`IPv4 Address` / `IPv4 アドレス` を使用）

## 起動
```bash
# 通常起動
bun run start
# or
npx expo start

# キャッシュクリア
bun run start:clear

# LAN / Tunnel
bun run start:lan
bun run start:tunnel
bun run start:lan:clear
bun run start:tunnel:clear
```

## よく使うコマンド
```bash
# iOS / Android / Web
bun run ios
bun run android
bun run web

# Lint / Format / Typecheck / Test
bun run lint
bun run format
bun run typecheck
bun run test

# CI相当チェック
bun run ci
```

## マッチング負荷テスト

AWS 環境の BFF / matching server に対して、Supabase のテストユーザー作成、battle setup 作成、matchmaking ticket 発行、WebSocket 接続までまとめて実行します。終了時は通常終了、エラー、`Ctrl+C` / `SIGTERM` のいずれでも、待機中は `cancel_queue`、マッチ済みは `resign` を送ってから、作成した Supabase Auth ユーザーを削除します。

`.env` または環境変数に以下が必要です。

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `EXPO_PUBLIC_API_BASE_URL` または `LOAD_MATCHING_API_BASE_URL`
- `EXPO_PUBLIC_MATCHING_SERVER_WS_URL` または `LOAD_MATCHING_WS_URL`

```bash
bun run load:matchmaking -- --users 100
bun run load:spike -- --users 1000
bun run load:gameplay -- --users 100
bun run load:gameplay -- --users 100 --moves-per-match 10
bun run load:reconnect -- --users 100
bun run load:soak -- --users 100 --duration-seconds 1800
```

主なオプション:

- `--users`: テストユーザー数。マッチング前提のため偶数を指定
- `--api-base-url`: BFF URL
- `--ws-url`: matching server WebSocket URL
- `--prepare-concurrency`: テストユーザー準備の並列数
- `--start-concurrency`: WebSocket 接続開始 / queue 投入の並列数
- `--stagger-ms`: 接続開始 / queue 投入のずらし幅
- `--timeout-ms`: WebSocket 応答待ちタイムアウト
- `--duration-seconds`: `load:soak` の継続秒数
- `--moves-per-match`: `load:gameplay` で1マッチあたりに送る着手数

結果には段階別の `p50` / `p95` / `p99` / `max` が出ます。`load:matchmaking` は `connect`、`queue_entered`、`queue_to_game_started`、`load:gameplay` はそれに加えて `battle_ready_ack`、着手者 ACK、相手 broadcast、`load:reconnect` は再接続 open と再同期を確認します。

## アーキテクチャ（概要）
依存方向:
`UI -> UseCase -> Repository(interface) -> DataSource(API/Supabase)`

主なディレクトリ:
```text
src/
  app/          # Expo Router のルート定義
  features/     # 画面・機能単位のUIと状態管理
  usecases/     # ユースケース
  domain/       # ドメインモデル・リポジトリIF
  infra/        # DI / Repository実装 / DataSource / HTTP
  components/   # 共通UIコンポーネント
  hooks/        # 共通フック
assets/         # 画像・音声などの静的アセット
```

## 補足
- API モードで動かす場合、backend が `:3000` で起動している必要があります。
- 実機と開発PCは同じネットワークに接続してください。
