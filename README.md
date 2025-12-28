# CF-Neocities

![Top Page](docs/images/top.png)

HonoフレームワークとCloudflare Workersを使用したウェブアプリケーションです。

## 機能

- **Counter**: キリ番検出機能付きグローバル訪問カウンター
- **BBS**: ページネーション機能付き掲示板システム
- **Diary**: Basic認証付き日記システム
- **テンプレートシステム**: ビルド時コンパイル付きHTMLテンプレート
- **静的アセット**: カウンター表示用SVG数字レンダリング

### 画面イメージ

| BBS | Diary |
| --- | --- |
| ![BBS](docs/images/bbs.png) | ![Diary](docs/images/diary.png) |

## 技術スタック

- [Hono](https://hono.dev/) - 軽量ウェブフレームワーク
- [Cloudflare Workers](https://workers.cloudflare.com/) - サーバーレスプラットフォーム
- [Durable Objects](https://developers.cloudflare.com/durable-objects/) - 永続化ストレージ
- SQLite - データベース
- TypeScript - 型安全性

## 開発

### 前提条件

- Node.js 18+
- Cloudflare Workers アカウント

### セットアップ

```bash
npm install
```

### 開発サーバー

```bash
npm run dev
```

### デプロイ

```bash
npm run deploy
```

### その他のコマンド

```bash
# バンドルサイズレポート
npm run size

# 型定義生成
npm run cf-typegen

# テンプレートビルド
npm run build:templates

# テスト実行
npm run test
```

## 環境変数の設定

### 日記機能の Basic 認証

日記機能の管理画面にアクセスするためのBasic認証の設定:

```bash
# ユーザー名を設定
npx wrangler secret put DIARY_AUTH_USERNAME

# パスワードを設定
npx wrangler secret put DIARY_AUTH_PASSWORD
```

設定しない場合はデフォルト値（username: admin, password: password）が使用されます。

## 型生成

[Worker設定に基づいて型を生成/同期する場合](https://developers.cloudflare.com/workers/wrangler/commands/#types):

```bash
npm run cf-typegen
```

Honoインスタンス化時に`CloudflareBindings`をジェネリクスとして渡す:

```ts
// src/index.ts
const app = new Hono<{ Bindings: CloudflareBindings }>()
```

## アーキテクチャ

![Architecture Diagram](docs/images/architecture.png)

### Durable Objects

- **Counter**: アトミックなインクリメント操作
- **BBS**: 論理削除とIP追跡機能付き掲示板
- **Diary**: Basic認証で保護された日記システム

### セキュリティ

- CSRF保護（`x-requested-with`ヘッダー）
- SQLインジェクション対策（パラメータ化クエリ）
- IPアドレスハッシュ化（プライバシー保護）
- Basic認証（日記機能）

## 運用コスト見積もり（2025年12月時点）

### 無料枠での運用限界（現時点の結論）
**月額0円（＋ドメイン代）で、1日約3万〜5万アクセス程度の個人サイトを永続的に運用可能。**
- 趣味のブログ、掲示板、ポートフォリオ等の規模であれば、無料枠内で十分に収まる。
- 固定費はドメイン維持費（.comで年額約$10.44程度）のみ。

### 律速要素（ボトルネックの評価）
無料運用の限界を決定する要素は、以下の優先順位で発生する。

1. **1日のリクエスト数 (100,000回/日)** ★最重要
   - Cloudflare Workers および Durable Objects の共通制限。
   - 1ページ表示につき「HTML取得」と「API実行（カウンター等）」で計2リクエストを消費する場合、**1日5万PV**が実質的な上限。
   - 上限超過時は HTTP 429 エラーにより一時的にサービス停止となる。

2. **Durable Objects の実行時間 (13,000 GB-s/日)**
   - インスタンスのメモリ占有時間による制限。
   - 通常の軽量なAPI処理においては、リクエスト数制限の方が先に到達するため、実働上の影響は限定的。

3. **Durable Objects のストレージ容量 (5GB)**
   - テキストデータ用ストレージ。1投稿を1KBと仮定した場合、**約500万投稿**分を保存可能。
   - 1日100投稿の頻度でも上限到達まで**約130年**を要するため、個人利用において律速になる可能性は極めて低い。

### 算出根拠（公式料金仕様）

- **Cloudflare Workers** ([公式料金表](https://developers.cloudflare.com/workers/platform/pricing/))
  - Freeプラン: 100,000リクエスト/日
- **Durable Objects (SQLite)** ([公式料金表](https://developers.cloudflare.com/durable-objects/platform/pricing/))
  - Freeプラン: 100,000リクエスト/日、13,000 GB-s/日、5GBストレージ
  - ※SQLiteストレージ課金は2026年1月より開始予定だが、5GBまでは無料枠に包含。
- **R2 (オブジェクトストレージ)** ([公式料金表](https://developers.cloudflare.com/r2/pricing/))
  - 10 GB-month（月間平均10GB）、Class A 100万回、Class B 1,000万回まで無料。
- **ドメイン** ([公式情報](https://www.cloudflare.com/products/registrar/))
  - Cloudflare Registrarの卸値価格を適用（.com で約$10.44/年程度）。

### 有料プランへの移行指標
1日のリクエスト数が恒常的に10万回を超える場合、Paidプラン（$5/月〜）への移行を推奨。移行後は月間1,000万リクエストまでカバーされ、個人規模のサイトで追加の従量課金が発生するリスクは極めて低い。

## ライセンス

MIT License
