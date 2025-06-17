import { DurableObject } from "cloudflare:workers";

export interface DiaryEntry {
  id: string;        // YYYY-MM-DD 形式
  body: string;      // 本文
  createdAt: string; // ISO8601 文字列
  updatedAt: string; // ISO8601 文字列
}

export class Diary extends DurableObject {
  private async initTables() {
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS diaries (
        id TEXT PRIMARY KEY,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  }

  // 指定日の日記を取得
  async get(date: string): Promise<DiaryEntry | null> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "SELECT id, body, created_at, updated_at FROM diaries WHERE id = ?",
      date
    );
    
    const rows = result.toArray();
    if (rows.length === 0) {
      return null;
    }
    
    const row = rows[0];
    return {
      id: row.id as string,
      body: row.body as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    };
  }

  // 日記を保存（新規作成または更新）
  async save(entry: Omit<DiaryEntry, "createdAt" | "updatedAt">): Promise<DiaryEntry> {
    await this.initTables();
    
    const now = new Date().toISOString();
    const existing = await this.get(entry.id);
    
    if (existing) {
      // 更新
      this.ctx.storage.sql.exec(
        "UPDATE diaries SET body = ?, updated_at = ? WHERE id = ?",
        entry.body, now, entry.id
      );
      
      return {
        id: entry.id,
        body: entry.body,
        createdAt: existing.createdAt,
        updatedAt: now
      };
    } else {
      // 新規作成
      this.ctx.storage.sql.exec(
        "INSERT INTO diaries (id, body, created_at, updated_at) VALUES (?, ?, ?, ?)",
        entry.id, entry.body, now, now
      );
      
      return {
        id: entry.id,
        body: entry.body,
        createdAt: now,
        updatedAt: now
      };
    }
  }

  // 日記を削除（物理削除）
  async delete(date: string): Promise<boolean> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "DELETE FROM diaries WHERE id = ?",
      date
    );
    
    return result.rowsWritten > 0;
  }

  // 最新の日記を取得
  async getRecent(limit: number): Promise<DiaryEntry[]> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "SELECT id, body, created_at, updated_at FROM diaries ORDER BY id DESC LIMIT ?",
      limit
    );
    
    const rows = result.toArray();
    return rows.map(row => ({
      id: row.id as string,
      body: row.body as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    }));
  }

  // 指定月の日記を取得
  async getByMonth(year: number, month: number): Promise<DiaryEntry[]> {
    await this.initTables();
    
    // 入力値の検証とサニタイゼーション
    if (year < 1900 || year > 2100 || month < 1 || month > 12) {
      return [];
    }
    
    // YYYY-MM形式の日付プレフィックスを正確に構築
    const yearMonth = `${year.toString()}-${month.toString().padStart(2, '0')}`;
    
    // より安全な範囲検索を使用（LIKEを完全に除去）
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;
    
    const result = this.ctx.storage.sql.exec(
      "SELECT id, body, created_at, updated_at FROM diaries WHERE id >= ? AND id <= ? ORDER BY id DESC",
      startDate, endDate
    );
    
    const rows = result.toArray();
    return rows.map(row => ({
      id: row.id as string,
      body: row.body as string,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string
    }));
  }

  // 投稿がある年のリストを取得
  async getYearsWithEntries(): Promise<number[]> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "SELECT DISTINCT substr(id, 1, 4) as year FROM diaries ORDER BY year DESC"
    );
    
    const rows = result.toArray();
    return rows.map(row => parseInt(row.year as string));
  }

  // 指定年で投稿がある月のリストを取得
  async getMonthsWithEntries(year: number): Promise<number[]> {
    await this.initTables();
    
    const result = this.ctx.storage.sql.exec(
      "SELECT DISTINCT substr(id, 6, 2) as month FROM diaries WHERE substr(id, 1, 4) = ? ORDER BY month",
      year.toString()
    );
    
    const rows = result.toArray();
    return rows.map(row => parseInt(row.month as string));
  }
}
