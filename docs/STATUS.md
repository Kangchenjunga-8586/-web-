# STATUS — GoalBudget

最終更新: 2026-09-30（Claude Code クラウドセッション）
作業ブランチ: `claude/nifty-allen-bcdfi0` → `main` へマージすると自動デプロイ

## Current state

v1 の機能はすべて実装済み・テスト済み。`main` へのマージと GitHub Pages の有効化（iPhone で 1 回だけ）で公開される状態。

## Completed

- [x] Phase 1 Bootstrap: Vite 8 / React 19 / TypeScript 6 / Tailwind 4 / ESLint 10 / Vitest 5 / Playwright 1.56.1
- [x] Phase 2 Data model + financial calculations（`src/domain`、純粋関数）
- [x] Phase 3 IndexedDB（Dexie 4、`src/storage`、スキーマ v1、原子的インポート）
- [x] Phase 4 初回セットアップ（目標日プリセット、バックアップからの復元導線）
- [x] Phase 5 Home ダッシュボード（目標カード、順調度、必要額、今月の収支、推移グラフ、最近の記録、バックアップ催促）
- [x] Phase 6 取引（追加 / 編集 / 削除 + 取り消し、月・種類・カテゴリ絞り込み、カテゴリ別内訳）
- [x] Phase 7 定期収入・固定支出（毎月/毎週/毎年、開始/終了日、有効/無効、決定的 ID + ウォーターマークで二重生成なし）
- [x] Phase 8 予測（定期収支 + 直近 ≤90 日平均、30 日未満は「支出データがまだ十分ありません」）
- [x] Phase 9 グラフ（貯金推移: 実績/理想/予測、月別収支 + 表、カテゴリ内訳）※配色は CVD/コントラスト検証済み
- [x] Phase 10 設定 / JSON バックアップ（共有シート or ダウンロード）/ 復元（検証→確認→原子的置換）/ CSV / テーマ / 目標リセット / 全削除（「削除」入力必須）
- [x] Phase 11 PWA（manifest、アイコン、Service Worker、オフライン起動、更新はプロンプト式）
- [x] Phase 12 iPhone 17 Pro Max 最適化（440×956、Safe Area、dvh、キーボード追従シート、片手操作の下部アクション）
- [x] Phase 13 アクセシビリティ（ラベル、role、フォーカス、44pt タッチ領域、reduced motion、コントラスト、グラフの表ビュー）
- [x] Phase 14 テスト（ユニット/結合 80 件、E2E 23 件 × Chromium・WebKit）
- [x] Phase 15 440×956 ビジュアル確認（ライト/ダーク、キーボード表示時、横向き、125% 文字拡大、長い商品名）
- [x] Phase 16 本番ビルド
- [x] Phase 17 GitHub Actions（全ブランチで検証、`main` で GitHub Pages へデプロイ）
- [x] Phase 18 自己監査

## Remaining

- 実機（iPhone 17 Pro Max）での最終確認のみ。クラウド環境では WebKit（Linux 版）と Chromium でのエミュレーションまで検証済み。

## Tests

| 種類 | 件数 | 実行場所 |
| --- | --- | --- |
| Lint / typecheck | — | ローカル（クラウド）+ CI |
| Unit / integration (Vitest + React Testing Library) | 80 | ローカル（クラウド）+ CI |
| E2E Chromium (440×956, Safe Area エミュレーション) | 23 | ローカル（クラウド）+ CI |
| E2E WebKit (440×956) | 23 | CI |

主な E2E: シナリオ 1〜8（初回設定、支出、収入、定期収入、固定支出、編集・削除、バックアップ往復、再読み込み後の保持）、CSV、入力検証、取り消し、iPhone レイアウト（Safe Area / 横スクロールなし / 44pt / キーボード / 横向き / 文字拡大 / ダーク）、PWA オフライン起動。

スクリーンショットは CI の成果物 `e2e-report`（`e2e/screenshots/`）に保存される。

## Deployment

- ワークフロー: `.github/workflows/ci.yml`
- `main` への push → verify（lint, typecheck, unit, build, E2E Chromium+WebKit）→ deploy（GitHub Pages）
- 公開 URL（有効化後）: https://kangchenjunga-8586.github.io/-web-/
- ビルド時に `BASE_PATH=/<repo名>/` を設定（ローカル/E2E は `/`）

## Known issues / limitations

- 実機 iOS Safari / ホーム画面アプリでの確認はクラウドからは不可能（WebKit エンジンと Safe Area/キーボードのエミュレーションで代替検証）。
- Playwright の WebKit はオフライン emulation 時に Service Worker 経由のナビゲーションができないため、WebKit ではキャッシュ内容（index.html・JS・CSS）の検証まで、実際のオフライン再起動は Chromium で検証。
- ステータスバーは `apple-mobile-web-app-status-bar-style=default`（読みやすさ優先）。
- iPhone からホーム画面アイコンを削除すると、ブラウザ保存データも削除される（バックアップで復元可能）。
- 予測は「定期収支 + 直近平均」の線形モデル。大きな臨時出費があると一時的に悲観的になる。

## Manual actions (iPhone だけで可能)

1. GitHub（Safari で github.com）: リポジトリ **Settings → Pages → Source: GitHub Actions**
2. private リポジトリで GitHub 無料プランの場合: **Settings → General → Change repository visibility → Public**（コードのみ公開、家計データは含まれない）
3. 作業ブランチを `main` にマージ（Claude Code に PR 作成を依頼 → GitHub アプリで Merge）
4. Safari で公開 URL を開く → 共有 → **ホーム画面に追加**
