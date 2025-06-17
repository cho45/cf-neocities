# 日記機能 仕様・設計メモ

## 概要
- 昔の個人ホームページ風Web日記機能を追加する。
- シンプルなUI・縦並びレイアウト。
- 管理者のみ投稿・編集・削除可能。

## 必要な機能・要件

### 1. 投稿・編集・削除
- 日記の新規投稿（本文・日付のみ、タイトル欄は不要。日付がタイトル扱い）
- 本文の文字長制限なし
- 日付は手動入力（初期値は今日の日付）
- 過去の日記の編集
- 日記の論理削除（削除フラグで非表示）
- 1日1エントリ制（同じ日付で複数投稿不可。既存エントリがあれば編集画面として表示）

### 2. 一覧・詳細・アーカイブ表示
- 日記一覧（最新n件表示、ページングなし）
- 各日記の詳細ページ（本文・投稿日・編集日時）
- 月別アーカイブ：その月の全日分を一括表示（最大31日なのでページング不要）
- 年別アーカイブ：その年に投稿がある月へのリンクのみ表示（月ページへの導線）
- 年ごとに投稿がある場合のみ年リンク有効化（投稿がない年は無効/グレーアウト）
- 削除済みの日記は一覧・詳細・アーカイブに表示しない

### 3. UI/UX
- 昔の個人ホームページ風の縦並びレイアウト
- 日記投稿フォーム（本文・日付のみ、日付は初期値で今日）
- 一覧・詳細・編集・削除ボタン
- 投稿後や削除後のフィードバック表示

### 4. ルーティング・HTMLレンダリング設計
- `GET    /diary?limit=n`         : 最新n件の日記一覧ページ（HTML、ページングなし）
- `GET    /diary/:date`           : 指定日(YYYY-MM-DD)の日記詳細ページ（HTML）
- `GET    /diary/year/:year`      : 年ごとのアーカイブページ（月リンクのみ、HTML）
- `GET    /diary/year/:year/month/:month` : 月ごとのアーカイブページ（その月の全日分を一括表示、HTML）
- `GET    /diary/new`             : 新規投稿フォーム（HTML）
- `GET    /diary/:date/edit`      : 編集フォーム（HTML）
- `POST   /diary`                 : 新規投稿（フォーム送信、リダイレクト or エラーHTML）
- `POST   /diary/:date/edit`      : 編集（フォーム送信、リダイレクト or エラーHTML）
- `POST   /diary/:date/delete`    : 論理削除（フォーム送信、リダイレクト or エラーHTML）
- すべてのエンドポイントはHTMLを返す
- 投稿・編集・削除はPOSTでフォーム送信、CSRF対策必須

### 5. データ構造・保存先
- Diary: { id, body, createdAt, updatedAt }
  - id: string (`YYYY-MM-DD`)
  - body: string
  - createdAt: ISO8601文字列（保存時はUTC（Z）で記録）
  - updatedAt: ISO8601文字列（保存時はUTC（Z）で記録）
- author, deleted フィールドは不要（1日1件、削除は物理削除＝KVから完全削除）

#### 保存先
- Cloudflare DOを使用

### 6. セキュリティ・運用
- 管理者操作はBasic認証（HTTPS前提、パスワードは環境変数等で安全に管理）
  - Cloudflare Workersでは `wrangler secret` 機能で `BASIC_AUTH_USER` `BASIC_AUTH_PASS` などの名前で登録し、`env.BASIC_AUTH_USER` などとして参照する
  - 例: `wrangler secret put BASIC_AUTH_USER` で登録
  - Worker内で `env.BASIC_AUTH_USER`/`env.BASIC_AUTH_PASS` を使ってAuthorizationヘッダを検証
  - Basic認証は毎リクエストごとにAuthorizationヘッダを送る方式なので、サーバ側でセッションを持つ必要はない
  - ブラウザが認証情報をキャッシュするため、ユーザー体験も問題なし
- CSRF対策（トークン or X-Requested-With等）
- 入力値バリデーション（必須・XSS対策、サニタイズ・エスケープ、不正日付のみ弾く。未来日も許可）
- API/HTMLレスポンスは必要最小限

### 7. 実装・UI方針
- 投稿・編集・削除成功時は詳細ページへリダイレクト
- 失敗時はフォーム再表示＋エラーメッセージ表示（表示方法は特に指定なし）
- テンプレートエンジンは micro-template.js を使用
- 日付・時刻の表示は必要に応じてJST等へ変換して表示
- 競合対策は不要（管理者1人運用想定）


---

## 実装方針

### 1. Diary Durable Object の実装
BBS の実装を参考に、SQLite ベースの Diary Durable Object を作成：

```typescript
export interface DiaryEntry {
  id: string;        // YYYY-MM-DD 形式
  body: string;      // 本文
  createdAt: string; // ISO8601 文字列
  updatedAt: string; // ISO8601 文字列
}

export class Diary extends DurableObject {
  // SQLite テーブル: diaries (id TEXT PRIMARY KEY, body TEXT, created_at TEXT, updated_at TEXT)
  // 主要メソッド: get(date), save(entry), delete(date), getRecent(limit), getByMonth(year, month), getYearsWithEntries()
}
```

### 2. 認証ミドルウェアの実装
Basic認証を実装：

```typescript
const basicAuth: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header('authorization');
  if (!authHeader || !validateBasicAuth(authHeader, c.env)) {
    return c.text('Unauthorized', 401, {
      'WWW-Authenticate': 'Basic realm="Diary Admin"'
    });
  }
  return await next();
};
```

### 3. ルーティングの実装
設計通りの各エンドポイントを実装：

- `GET /diary` - 最新n件の日記一覧
- `GET /diary/:date` - 指定日の日記詳細
- `GET /diary/year/:year` - 年別アーカイブ
- `GET /diary/year/:year/month/:month` - 月別アーカイブ
- `GET /diary/new` - 新規投稿フォーム（要認証）
- `GET /diary/:date/edit` - 編集フォーム（要認証）
- `POST /diary` - 新規投稿（要認証）
- `POST /diary/:date/edit` - 編集（要認証）
- `POST /diary/:date/delete` - 削除（要認証、物理削除）

### 4. テンプレートの実装
micro-template を使用してHTMLテンプレートを作成：

- `diary-list.html` - 日記一覧ページ
- `diary-detail.html` - 日記詳細ページ
- `diary-form.html` - 投稿・編集フォーム
- `diary-archive-year.html` - 年別アーカイブ
- `diary-archive-month.html` - 月別アーカイブ

### 5. 日付ユーティリティの実装
日付操作・検証のためのユーティリティ関数：

```typescript
// 日付バリデーション（YYYY-MM-DD形式、有効な日付かチェック）
function isValidDate(dateString: string): boolean
// 今日の日付を YYYY-MM-DD 形式で取得
function getTodayDate(): string
// 月の日数を取得（アーカイブ表示用）
function getDaysInMonth(year: number, month: number): number
// JST変換（表示用）
function formatDateForDisplay(isoString: string): string
```

### 6. バリデーションの実装
入力値の検証：

- 日付形式の検証（YYYY-MM-DD、有効な日付）
- 本文の必須チェック
- XSS対策（HTMLエスケープ）
- CSRF対策（既存の x-requested-with チェックを利用）

### 7. wrangler.jsonc の更新
Diary Durable Object の追加：

```json
"durable_objects": {
  "bindings": [
    { "name": "COUNTER", "class_name": "Counter" },
    { "name": "BBS", "class_name": "BBS" },
    { "name": "DIARY", "class_name": "Diary" }
  ]
},
"migrations": [
  { "tag": "v1", "new_sqlite_classes": ["Counter"] },
  { "tag": "v2", "new_sqlite_classes": ["BBS"] },
  { "tag": "v3", "new_sqlite_classes": ["Diary"] }
]
```

### 8. 実装の優先順位
1. Diary Durable Object の実装
2. 基本的なCRUD操作（作成・読取・更新・削除）
3. 認証ミドルウェアの実装
4. 基本的なルーティング（一覧・詳細・フォーム）
5. テンプレートの実装
6. アーカイブ機能の実装
7. 日付ユーティリティの実装
8. バリデーション強化

### 9. テスト方針
BBS.test.ts を参考に、Diary.test.ts を作成：

- 日記の作成・取得・更新・削除
- 1日1件制の制約テスト
- 日付バリデーションのテスト
- 月別・年別アーカイブのテスト

