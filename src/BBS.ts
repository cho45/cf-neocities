import { DurableObject } from "cloudflare:workers";

export interface BBSPost {
  id: string;
  name: string;
  body: string;
  date: string;
  deleteKey?: string;
  deleted?: boolean; // 論理削除フラグ
  ip?: string; // 投稿元IPアドレス
}

export class BBS extends DurableObject {
  private async initTables() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        date TEXT NOT NULL,
        delete_key TEXT,
        deleted INTEGER DEFAULT 0,
        ip TEXT
      )
    `);
  }

  // 新規投稿（IPアドレスも記録）
  async post(newPost: Omit<BBSPost, "id" | "date" | "ip">, ip?: string): Promise<{ id: string; post: BBSPost }> {
    await this.initTables();
    
    const id = crypto.randomUUID();
    const date = new Date().toISOString();
    const post: BBSPost = { ...newPost, id, date, ip };
    
    this.ctx.storage.sql.exec(
      "INSERT INTO posts (id, name, body, date, delete_key, ip) VALUES (?, ?, ?, ?, ?, ?)",
      id, post.name, post.body, date, post.deleteKey || null, ip || null
    );
    
    return { id, post };
  }

  // 投稿削除（論理削除: 削除済みフラグを立てる）
  async deletePost(id: string, deleteKey: string): Promise<boolean> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "UPDATE posts SET name = '(削除)', body = '(削除)', delete_key = NULL, deleted = 1 WHERE id = ? AND delete_key = ? AND deleted = 0",
      id, deleteKey
    );
    
    return result.rowsWritten > 0;
  }

  // 任意範囲取得（新しい順、論理削除は除外）
  async getRange(offset: number, limit: number): Promise<BBSPost[]> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "SELECT id, name, body, date, delete_key, ip FROM posts WHERE deleted = 0 ORDER BY date DESC LIMIT ? OFFSET ?",
      limit, offset
    );
    
    const rows = result.toArray();
    
    return rows.map(row => ({
      id: row.id as string,
      name: row.name as string,
      body: row.body as string,
      date: row.date as string,
      deleteKey: row.delete_key as string | undefined,
      ip: row.ip as string | undefined
    }));
  }

  // 総投稿数を返す（削除されていない投稿のみ）
  async getCount(): Promise<number> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec("SELECT COUNT(*) as count FROM posts WHERE deleted = 0");
    const rows = result.toArray();
    return (rows[0]?.count || 0) as number;
  }
}
