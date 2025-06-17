# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト構造

これはHonoフレームワークを使用したCloudflare Workersプロジェクトで、以下の機能を提供します：
- **Counter**: キリ番検出機能付きグローバル訪問カウンター（Durable Object）
- **BBS**: ページネーション機能付き掲示板システム（Durable Object）
- **Diary**: Basic認証付き日記システム（Durable Object）
- **テンプレートシステム**: ビルド時コンパイル付きmicro-templateを使用したHTMLテンプレート
- **静的アセット**: カウンター表示用SVG数字レンダリング

## 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# Cloudflare Workersへのデプロイ
npm run deploy

# バンドルサイズレポートの生成
npm run size

# Cloudflare型定義の生成
npm run cf-typegen

# テンプレートのビルド（HTMLテンプレートをJSにコンパイル）
npm run build:templates

# テストの実行
npm run test
```

## アーキテクチャ概要

### Durable Objects
- **Counter** (`src/Counter.ts`): アトミックなインクリメント操作にSQLiteを使用するグローバルカウンター
- **BBS** (`src/BBS.ts`): 論理削除とIP追跡機能付きの掲示板（SQLiteを使用）
- **Diary** (`src/Diary.ts`): Basic認証で保護された日記システム（SQLiteを使用）

### メインアプリケーション (`src/index.ts`)
- `x-requested-with`ヘッダーによるCSRF保護付きHonoアプリ
- カウンターエンドポイント: GET/POST `/counter`（SVG生成付き）
- BBSエンドポイント: GET `/bbs`, GET `/bbs/list`, POST `/bbs/post`, POST `/bbs/delete`
- 日記エンドポイント: GET/POST `/diary/*`（認証必須）
- プライバシー保護のためのIPハッシュ化

### テンプレートシステム
- `templates/` ディレクトリのテンプレートがmicro-templateにより `src/templates.js` にコンパイル
- サブディレクトリ構造をサポート（例: `templates/diary/`）
- ビルドプロセスがテンプレート変更を監視して自動再コンパイル

### テスト
- Durable Objectsのテスト用にCloudflare Workers poolを使用したVitest
- `vitest.config.ts` の設定が `wrangler.jsonc` を参照

## 主要機能
- キリ番検出（1111、10000等のマイルストーン番号）
- 数字アセットからのSVGカウンター画像生成
- 削除キーと論理削除機能付きBBS
- プライバシー保護のためのIPアドレスハッシュ化
- Cloudflare Workers Assetsによる静的アセット配信
- Basic認証で保護された日記システム

## セキュリティ対策
- CSRF保護: `x-requested-with: XMLHttpRequest`ヘッダーの必須化
- SQLインジェクション対策: パラメータ化クエリの使用
- 入力値検証: 各エンドポイントでの適切なバリデーション
- IPプライバシー: salt付きSHA-256ハッシュ化
- 認証: 日記機能でのBasic認証

## UI/UX設計
- **日記削除**: 編集画面からのみ実行可能（詳細ページには編集リンクのみ）
- **CSRF保護**: すべてのPOSTリクエストでfetchを使用してヘッダー送信
- **レスポンシブ**: モバイルフレンドリーなテンプレート設計
